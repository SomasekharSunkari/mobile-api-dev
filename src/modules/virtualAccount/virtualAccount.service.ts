import { Inject, Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { DateTime } from 'luxon';
import * as math from 'mathjs';
import { Transaction } from 'objection';
import { WaasAdapter } from '../../adapters/waas/waas.adapter';
import { VirtualPermanentAccountPayload, WaasTransactionStatus } from '../../adapters/waas/waas.adapter.interface';
import { CurrencyUtility, SUPPORTED_CURRENCIES } from '../../currencies';
import {
  FetchQuery,
  FiatWalletTransactionType,
  TransactionCategory,
  TransactionModel,
  TransactionScope,
  TransactionStatus,
  TransactionType,
} from '../../database';
import { VirtualAccountModel, VirtualAccountType } from '../../database/models/virtualAccount';
import { LockerService } from '../../services/locker/locker.service';
import { UtilsService } from '../../utils/utils.service';
import { UserRepository } from '../auth/user/user.repository';
import { FiatWalletService } from '../fiatWallet';
import { TransactionRepository } from '../transaction/transaction.repository';
import { TransactionService } from '../transaction/transaction.service';
import { CreateVirtualAccountDto } from './dtos/createVirtualAccount.dto';
import { TransferToOtherBankDto } from './dtos/transferToOtherBank.dto';
import { VirtualAccountQueryDto } from './dtos/virtualAccountQuery.dto';
import { VirtualAccountRepository } from './virtualAccount.repository';

@Injectable()
export class VirtualAccountService {
  @Inject(VirtualAccountRepository)
  private readonly virtualAccountRepository: VirtualAccountRepository;

  @Inject(WaasAdapter)
  private readonly waasAdapter: WaasAdapter;

  @Inject(UserRepository)
  private readonly userRepository: UserRepository;

  @Inject(TransactionRepository)
  private readonly transactionRepository: TransactionRepository;

  @Inject(FiatWalletService)
  private readonly fiatWalletService: FiatWalletService;

  @Inject(TransactionService)
  private readonly transactionService: TransactionService;

  @Inject(LockerService)
  private readonly lockerService: LockerService;

  private readonly logger = new Logger(VirtualAccountService.name);

  public async create(
    userId: string,
    data: CreateVirtualAccountDto,
    type: VirtualAccountType,
    trx?: Transaction,
    forceCreate?: boolean,
  ) {
    this.logger.log('Create', 'VirtualAccountService');

    // Skip existing account check if forceCreate is true
    if (!forceCreate) {
      // confirm if user already have virtual account
      const query = this.virtualAccountRepository.query(trx).where({
        user_id: userId,
        type: type,
      });

      if (data.fiat_wallet_id) {
        query.where('fiat_wallet_id', data.fiat_wallet_id);
      } else {
        query.whereNull('fiat_wallet_id');
      }

      // For exchange accounts, also filter by transaction_id
      if (type === VirtualAccountType.EXCHANGE_ACCOUNT) {
        if (data.transaction_id) {
          query.where('transaction_id', data.transaction_id);
        } else {
          query.whereNull('transaction_id');
        }
      }

      const existingVirtualAccount = (await query.first()) as unknown as VirtualAccountModel;

      if (existingVirtualAccount) {
        this.logger.debug(`User with ${userId} already have virtual account`);
        return existingVirtualAccount;
      }
    }

    let virtualAccount: VirtualAccountModel;

    try {
      const user = await this.userRepository.findOne({ id: userId }, {}, { graphFetch: 'userProfile' });

      if (!user.userProfile && !user.userProfile?.dob) {
        throw new InternalServerErrorException('User Date of birth is required');
      }

      const ref = UtilsService.generateCode(15);

      const payload: VirtualPermanentAccountPayload = {
        address: user.userProfile?.address_line1,
        bvn: data.bvn, // only available for NG users
        date_of_birth: user.userProfile?.dob?.toString(),
        email: user.email,
        first_name: user.first_name,
        gender: user.userProfile?.gender,
        last_name: user.last_name,
        phone_number: user.phone_number,
        ref,
      };

      const { account_name, account_number, bank_name, provider_ref, provider_name } =
        await this.waasAdapter.findOrCreateVirtualAccount(payload);

      virtualAccount = await this.virtualAccountRepository.create(
        {
          user_id: userId,
          fiat_wallet_id: data.fiat_wallet_id || null,
          account_name: account_name,
          account_number: account_number,
          address: user.userProfile?.address_line1,
          bank_name: bank_name,
          bank_ref: provider_ref,
          city: user.userProfile?.city,
          postal_code: user.userProfile?.postal_code,
          routing_number: account_number,
          state: user.userProfile?.state_or_province,
          provider: provider_name,
          provider_balance: 0,
          type: type,
          transaction_id: type === VirtualAccountType.EXCHANGE_ACCOUNT ? data.transaction_id || null : null,
        },
        trx,
      );

      return virtualAccount;
    } catch (error) {
      this.logger.error(`Failed to create virtual account for user ${userId}: ${error.message}`, error.stack);
      throw new InternalServerErrorException(`Failed to create virtual account: ${error.message}`);
    }
  }

  public async findOrCreateVirtualAccount(
    userId: string,
    data: CreateVirtualAccountDto,
    type: VirtualAccountType,
    trx?: Transaction,
  ) {
    this.logger.log('findOrCreateVirtualAccount', 'VirtualAccountService');

    try {
      // Build query based on type
      const query = this.virtualAccountRepository.query(trx).where('user_id', userId).where('type', type);

      // For exchange accounts, also filter by transaction_id
      if (type === VirtualAccountType.EXCHANGE_ACCOUNT) {
        if (data.transaction_id) {
          query.where('transaction_id', data.transaction_id);
        } else {
          query.whereNull('transaction_id');
        }
      }

      const virtualAccount = await query.first();

      this.logger.debug(`Found virtual account for user ${userId} and type ${type}: ${JSON.stringify(virtualAccount)}`);
      if (virtualAccount) {
        return virtualAccount as VirtualAccountModel;
      }

      this.logger.error(`Failed to find virtual account for user ${userId} and type ${type}`);

      return await this.create(userId, data, type, trx);
    } catch (error) {
      // Handle unique constraint violation (error code 23505 for PostgreSQL)
      if (error.code === '23505' || error.constraint?.includes('virtual_accounts')) {
        this.logger.warn(
          `Unique constraint violation for user ${userId} and type ${type}, fetching existing virtual account`,
        );
        // Fetch the virtual account that was created by another process
        const query = this.virtualAccountRepository.query(trx).where({
          user_id: userId,
          type: type,
        });

        if (type === VirtualAccountType.EXCHANGE_ACCOUNT && data.transaction_id) {
          query.where('transaction_id', data.transaction_id);
        }

        const account = await query.first();
        if (account) {
          return account as VirtualAccountModel;
        }
      }

      this.logger.error(error.message);
      throw new InternalServerErrorException('Something went wrong While fetching virtualAccount');
    }
  }

  public async findOneByUserIdOrThrow(userId: string, trx?: Transaction) {
    const provider = this.waasAdapter.getProviderName();
    const virtualAccount = await this.virtualAccountRepository.findOne(
      {
        user_id: userId,
        provider: provider,
        type: VirtualAccountType.MAIN_ACCOUNT,
      },
      undefined,
      { trx },
    );

    if (!virtualAccount) {
      throw new InternalServerErrorException('Virtual account not found');
    }

    return virtualAccount;
  }

  public async findAll(userId: string, params: FetchQuery & VirtualAccountQueryDto) {
    this.logger.log('FindAll', 'VirtualAccountService');
    try {
      const virtualAccountQuery = this.virtualAccountRepository.findSync({
        user_id: userId,
        type: VirtualAccountType.MAIN_ACCOUNT,
      });
      if (params.walletId) {
        virtualAccountQuery.where({ fiat_wallet_id: params.walletId });
      }

      const virtualAccount = await virtualAccountQuery;

      return virtualAccount;
    } catch (error) {
      this.logger.error(error.message);
      throw new InternalServerErrorException('Something went wrong While fetching virtualAccount');
    }
  }

  private async findOrThrowVirtualAccountByUserId(userId: string, type: VirtualAccountType) {
    const virtualAccount = await this.virtualAccountRepository.findOne({
      user_id: userId,
      type: type,
    });

    if (!virtualAccount) {
      throw new InternalServerErrorException('Virtual account not found');
    }

    return virtualAccount;
  }

  public async transferToOtherBank(
    userId: string,
    data: TransferToOtherBankDto,
    metadata: {
      description: string;
      receiverUserId?: string;
      fees?: number;
      transactionId?: string;
      fiatWalletTransactionId?: string;
      transactionStatus?: TransactionStatus;
      transactionReference?: string;
    },
  ) {
    const lockKey = `virtual-account-service:${userId}:transfer-to-other-bank`;

    return await this.lockerService.withLock(lockKey, async () => {
      this.logger.log('TransferToOtherBank', 'VirtualAccountService');

      try {
        const virtualAccount = await this.findOrThrowVirtualAccountByUserId(userId, VirtualAccountType.MAIN_ACCOUNT);
        const transactionReference = metadata?.transactionReference || UtilsService.generateTransactionReference();

        const fiatWallet = await this.fiatWalletService.getUserWallet(userId, SUPPORTED_CURRENCIES.NGN.code);
        const balanceBefore = Number(fiatWallet.balance);
        const formattedAmount = UtilsService.convertToNegative(
          CurrencyUtility.formatCurrencyAmountToSmallestUnit(
            data.amount + (metadata?.fees || 0),
            SUPPORTED_CURRENCIES.NGN.code,
          ),
        );
        const balanceAfter = math.add(balanceBefore, formattedAmount);

        let transaction: TransactionModel;

        if (metadata?.transactionId) {
          transaction = await this.transactionRepository.findOne({ id: metadata.transactionId });
        } else {
          // Create a transaction for the transfer
          transaction = await this.transactionRepository.create({
            amount: data.amount,
            transaction_type: TransactionType.TRANSFER_OUT,
            category: TransactionCategory.FIAT,
            transaction_scope: TransactionScope.EXTERNAL,
            balance_before: balanceBefore,
            balance_after: balanceAfter,
            user_id: userId,
            asset: SUPPORTED_CURRENCIES.NGN.code,
            status: TransactionStatus.PENDING,
            external_reference: transactionReference,
            reference: UtilsService.generateTransactionReference(),
            description: metadata?.description || 'Transfer to other bank',
            metadata: {
              source: virtualAccount.account_number,
              destination: data.account_number,
              description: metadata?.description || 'Transfer to other bank',
              source_bank: virtualAccount.bank_name,
            },
          });
        }

        //TODO: Add this after testing
        // const bankList = await this.waasAdapter.getBankList();
        // const bank = bankList.data.find((bank) => {
        //   return bank.bankName?.toLowerCase()?.includes(data.bank_name?.toLowerCase());
        // });

        const response = await this.waasAdapter.transferToOtherBank({
          amount: data.amount,
          transactionReference: transactionReference,
          sender: {
            accountNumber: virtualAccount.account_number,
            accountName: virtualAccount.account_name,
            bankName: virtualAccount.bank_name,
          },
          receiver: {
            accountNumber: data.account_number,
            bankRef: data.bank_ref,
            accountName: data.account_name,
          },
          transactionType: 'INTRA_BANK',
          description: 'Transfer to other bank',
          currency: SUPPORTED_CURRENCIES.NGN.code,
        });

        // verify the transaction status
        const transactionStatus = await this.waasAdapter.getTransactionStatus({
          transactionRef: transactionReference,
        });
        const status = this.transformToTransactionStatus(transactionStatus.status);
        this.throwIfTransactionIsFailed(status);

        await this.fiatWalletService.updateBalance(
          fiatWallet.id,
          formattedAmount,
          transaction.id,
          FiatWalletTransactionType.TRANSFER_OUT,
          metadata?.transactionStatus || TransactionStatus.COMPLETED,
          {
            description: metadata?.description || 'Transfer to other bank',
            source: virtualAccount.account_number,
            destination: data.account_number,
            fiat_wallet_transaction_id: metadata?.fiatWalletTransactionId,
          },
        );

        await this.transactionService.updateStatus(
          transaction.id,
          metadata?.transactionStatus || TransactionStatus.COMPLETED,
        );

        return response;
      } catch (error) {
        this.logger.error(`Failed to transfer to other bank for user ${userId}: ${error.message}`, error.stack);
        throw new InternalServerErrorException(error?.message);
      }
    });
  }

  private transformToTransactionStatus(status: WaasTransactionStatus): TransactionStatus {
    switch (status) {
      case WaasTransactionStatus.FAILED:
        return TransactionStatus.FAILED;
      case WaasTransactionStatus.SUCCESS:
        return TransactionStatus.COMPLETED;
      default:
        return TransactionStatus.PENDING;
    }
  }

  private throwIfTransactionIsFailed(status: TransactionStatus) {
    if (status?.toLowerCase() === TransactionStatus.FAILED.toLowerCase()) {
      throw new InternalServerErrorException('Transaction failed');
    }
  }

  /**
   * Create a new exchange virtual account for a transaction.
   * This method always creates a new virtual account on Paga, even if one exists.
   * Used by admins to create a new account when retrying failed exchanges.
   */
  public async createExchangeVirtualAccountForTransaction(transactionId: string): Promise<VirtualAccountModel> {
    this.logger.log(`Creating exchange virtual account for transaction: ${transactionId}`);

    // Validate transaction exists and is an exchange transaction
    const transaction = await this.transactionRepository.findById(transactionId);

    if (!transaction) {
      throw new InternalServerErrorException(`Transaction with ID ${transactionId} not found`);
    }

    if (transaction.transaction_type !== TransactionType.EXCHANGE) {
      throw new InternalServerErrorException(
        `Transaction ${transactionId} is not an exchange transaction. Type: ${transaction.transaction_type}`,
      );
    }

    // Use existing create method with forceCreate=true to always create a new account
    return this.create(
      transaction.user_id,
      { transaction_id: transactionId },
      VirtualAccountType.EXCHANGE_ACCOUNT,
      undefined,
      true,
    );
  }

  /**
   * Get all virtual accounts for a transaction
   */
  public async getVirtualAccountsForTransaction(transactionId: string): Promise<VirtualAccountModel[]> {
    return this.virtualAccountRepository.findSync({ transaction_id: transactionId }) as unknown as Promise<
      VirtualAccountModel[]
    >;
  }

  /**
   * Clear the scheduled_deletion_at for a virtual account (unschedule deletion)
   */
  public async unscheduleVirtualAccountDeletion(virtualAccountId: string): Promise<VirtualAccountModel> {
    const virtualAccount = await this.virtualAccountRepository.findById(virtualAccountId);

    if (!virtualAccount) {
      throw new InternalServerErrorException(`Virtual account with ID ${virtualAccountId} not found`);
    }

    if (!virtualAccount.scheduled_deletion_at) {
      throw new InternalServerErrorException(`Virtual account ${virtualAccountId} is not scheduled for deletion`);
    }

    await this.virtualAccountRepository.update(virtualAccountId, {
      scheduled_deletion_at: null,
    });

    this.logger.log(`Unscheduled deletion for virtual account ${virtualAccountId}`);

    return (await this.virtualAccountRepository.findById(virtualAccountId)) as VirtualAccountModel;
  }

  /**
   * Schedule deletion of exchange virtual account when transaction fails.
   * Sets scheduled_deletion_at to 7 days from now.
   */
  public async scheduleExchangeVirtualAccountDeletion(
    userId: string,
    transactionId: string,
    reason: string,
  ): Promise<void> {
    const DELETION_DELAY_DAYS = 7;

    try {
      const virtualAccount = await this.findOrCreateVirtualAccount(
        userId,
        { transaction_id: transactionId },
        VirtualAccountType.EXCHANGE_ACCOUNT,
      );

      if (virtualAccount?.id) {
        const scheduledDeletionAt = DateTime.now().plus({ days: DELETION_DELAY_DAYS }).toJSDate();

        await this.virtualAccountRepository.update(virtualAccount.id, {
          scheduled_deletion_at: scheduledDeletionAt,
        });

        this.logger.log(
          `Scheduled deletion of exchange virtual account ${virtualAccount.account_number} for ${scheduledDeletionAt.toISOString()}. Reason: ${reason}`,
        );
      }
    } catch (error) {
      this.logger.error('Error scheduling exchange virtual account deletion', error);
    }
  }
}
