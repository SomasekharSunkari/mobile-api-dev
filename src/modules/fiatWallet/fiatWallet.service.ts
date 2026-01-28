import { BadRequestException, Inject, Injectable, Logger } from '@nestjs/common';
import { Knex } from 'knex';
import { DateTime } from 'luxon';
import { add } from 'mathjs';
import { FiatWalletAdapter } from '../../adapters/fiat-wallet/fiat-wallet.adapter';
import { WaasAdapter } from '../../adapters/waas/waas.adapter';
import { FiatWalletConfigProvider } from '../../config/fiat-wallet.config';
import { CurrencyUtility, SUPPORTED_CURRENCIES } from '../../currencies/currencies';
import { FiatWalletStatus, TransactionStatus, UserModel } from '../../database';
import { IPaginatedResponse } from '../../database/base/base.interface';
import { FiatWalletModel } from '../../database/models/fiatWallet/fiatWallet.model';
import { FiatWalletTransactionType } from '../../database/models/fiatWalletTransaction/fiatWalletTransaction.interface';
import { FiatWalletTransactionModel } from '../../database/models/fiatWalletTransaction/fiatWalletTransaction.model';
import { VirtualAccountModel } from '../../database/models/virtualAccount';
import { EventEmitterEventsEnum } from '../../services/eventEmitter/eventEmitter.interface';
import { EventEmitterService } from '../../services/eventEmitter/eventEmitter.service';
import { LockerService } from '../../services/locker';
import { ExternalAccountRepository } from '../externalAccount/external-account.repository';
import { FiatWalletTransactionRepository } from '../fiatWalletTransactions/fiatWalletTransactions.repository';
import { TransactionRepository } from '../transaction/transaction.repository';
import { IFiatWalletTransactionMetadata } from './fiatWallet.interface';
import { FiatWalletRepository } from './fiatWallet.repository';

/**
 * Base FiatWalletService containing generic wallet operations.
 * Withdrawal and exchange functionality are in separate services that extend this base.
 */
@Injectable()
export class FiatWalletService {
  protected readonly logger = new Logger(FiatWalletService.name);

  @Inject(FiatWalletRepository)
  public readonly fiatWalletRepository: FiatWalletRepository;

  @Inject(ExternalAccountRepository)
  protected readonly externalAccountRepository: ExternalAccountRepository;

  @Inject(FiatWalletAdapter)
  public readonly fiatWalletAdapter: FiatWalletAdapter;

  @Inject(FiatWalletTransactionRepository)
  public readonly fiatWalletTransactionRepository: FiatWalletTransactionRepository;

  @Inject(LockerService)
  public readonly lockerService: LockerService;

  @Inject(TransactionRepository)
  public readonly transactionRepository: TransactionRepository;

  @Inject(FiatWalletConfigProvider)
  public readonly fiatWalletConfig: FiatWalletConfigProvider;

  @Inject(WaasAdapter)
  public readonly waasAdapter: WaasAdapter;

  @Inject(EventEmitterService)
  public readonly eventEmitterService: EventEmitterService;

  public async getUserWallet(
    userId: string,
    asset: string = SUPPORTED_CURRENCIES.NGN.code,
    trx?: Knex.Transaction,
  ): Promise<FiatWalletModel> {
    // validate currency
    if (!CurrencyUtility.isSupportedCurrency(asset)) {
      throw new BadRequestException('Invalid currency');
    }

    // make sure user does not have a fiat wallet in same currency
    const existingWallet = await this.fiatWalletRepository.findOne({ user_id: userId, asset: asset }, null, { trx });

    if (existingWallet) {
      return existingWallet;
    }

    try {
      return await this.fiatWalletRepository.create(
        {
          user_id: userId,
          asset,
          balance: 0,
          credit_balance: 0,
          status: FiatWalletStatus.ACTIVE,
        },
        trx,
      );
    } catch (error) {
      // Handle unique constraint violation (error code 23505 for PostgreSQL)
      if (error.code === '23505' || error.constraint === 'fiat_wallets_user_id_asset_unique') {
        this.logger.warn(`Unique constraint violation for user ${userId} and asset ${asset}, fetching existing wallet`);
        // Fetch the wallet that was created by another process
        const wallet = await this.fiatWalletRepository.findOne({ user_id: userId, asset: asset }, null, { trx });
        if (wallet) {
          return wallet;
        }
      }

      this.logger.error(error);
      throw new BadRequestException('Failed to create fiat wallet');
    }
  }

  public async findById(id: string, user?: UserModel, trx?: Knex.Transaction): Promise<FiatWalletModel> {
    const fiatWallet = await this.fiatWalletRepository.findById(id, undefined, trx);
    if (!fiatWallet) {
      throw new BadRequestException('Fiat wallet not found');
    }

    if (user && user.id !== fiatWallet.user_id) {
      throw new BadRequestException('Forbidden Resource');
    }
    return fiatWallet as FiatWalletModel;
  }

  private async createAllSupportedCurrenciesWallets(userId: string) {
    const supportedCurrencies = Object.values(SUPPORTED_CURRENCIES);
    const wallets = await Promise.all(supportedCurrencies.map((currency) => this.getUserWallet(userId, currency.code)));
    return wallets;
  }

  private async checkIfUserHasAllSupportedCurrenciesWallets(userId: string) {
    const supportedCurrencies = Object.values(SUPPORTED_CURRENCIES);
    const wallets = await this.fiatWalletRepository.findAll({ user_id: userId });
    const supportedCurrenciesWallets = (wallets as any)?.['fiat_wallets']?.filter((wallet) =>
      supportedCurrencies.some((currency) => currency.code === wallet.asset),
    );

    return supportedCurrenciesWallets.length === supportedCurrencies.length;
  }

  public async findUserWallets(userId: string): Promise<IPaginatedResponse<FiatWalletModel>> {
    // create all supported currencies wallets
    const hasAllSupportedCurrenciesWallets = await this.checkIfUserHasAllSupportedCurrenciesWallets(userId);
    if (!hasAllSupportedCurrenciesWallets) {
      await this.createAllSupportedCurrenciesWallets(userId);
    }
    return await this.fiatWalletRepository.findAll({ user_id: userId }, {}, { graphFetch: '[virtualAccounts]' });
  }

  /**
   * Update fiat wallet balance with locking to prevent race conditions
   *
   * @param walletId The ID of the fiat wallet to update
   * @param amount The amount to add or subtract from balance (positive for addition, negative for subtraction)
   * @param transactionId The ID of the transaction to update
   * @param transactionType The type of transaction (deposit, withdrawal, etc)
   * @param metadata Additional metadata for the transaction
   * @returns The updated fiat wallet with the new balance
   */
  public async updateBalance(
    walletId: string,
    amount: number,
    transactionId: string,
    transactionType: FiatWalletTransactionType,
    status: TransactionStatus,
    metadata: {
      description?: string;
      provider?: string;
      provider_reference?: string;
      provider_fee?: number;
      provider_metadata?: Record<string, any>;
      source?: string;
      destination?: string;
      fiat_wallet_transaction_id?: string;
    } = {},
    knexTransaction?: Knex.Transaction,
  ): Promise<FiatWalletModel> {
    // Create a lock key based on wallet ID to prevent race conditions
    const lockKey = `fiat-wallet:${walletId}:balance-update`;

    return await this.lockerService.withLock(
      lockKey,
      async () => {
        // Get the current wallet with fresh data within transaction context
        const wallet = await this.findById(walletId, undefined, knexTransaction);

        // Confirm the transaction is not already completed
        const transaction = await this.transactionRepository.findById(transactionId, undefined, knexTransaction);
        if (!transaction) {
          throw new BadRequestException('Transaction not found');
        }

        if (transaction.status === TransactionStatus.COMPLETED) {
          throw new BadRequestException('Transaction already completed');
        }

        // Check if the wallet exists
        if (!wallet) {
          throw new BadRequestException(`Fiat wallet with ID ${walletId} not found`);
        }

        // For withdrawals, ensure there are sufficient funds
        const finalBalance = add(wallet.balance, amount); // when amount is negative, it's a withdrawal
        if (amount < 0 && finalBalance < 0) {
          throw new BadRequestException('Insufficient balance for this transaction');
        }

        // Record the current balance before update
        const balanceBefore = Number(wallet.balance);

        // Calculate new balance
        const balanceAfter = add(balanceBefore, amount);

        const createFiatWalletTransaction = async (trx: Knex.Transaction) => {
          return await this.fiatWalletTransactionRepository.create(
            {
              fiat_wallet_id: walletId,
              user_id: wallet.user_id,
              transaction_id: transactionId,
              transaction_type: transactionType,
              amount,
              balance_before: balanceBefore,
              balance_after: balanceAfter,
              currency: wallet.asset,
              status,
              description: metadata.description,
              provider: metadata.provider,
              provider_reference: metadata.provider_reference,
              provider_fee: metadata.provider_fee,
              provider_metadata: metadata.provider_metadata,
              source: metadata.source,
              destination: metadata.destination,
              completed_at: status === TransactionStatus.COMPLETED ? DateTime.now().toSQL() : null,
            },
            trx,
          );
        };

        if (knexTransaction) {
          return await this.updateBalanceWithTransaction(
            walletId,
            amount,
            transactionId,
            status,
            metadata,
            wallet,
            balanceBefore,
            balanceAfter,
            createFiatWalletTransaction,
            knexTransaction,
          );
        }

        return await this.fiatWalletRepository.transaction(async (trx) => {
          return await this.updateBalanceWithTransaction(
            walletId,
            amount,
            transactionId,
            status,
            metadata,
            wallet,
            balanceBefore,
            balanceAfter,
            createFiatWalletTransaction,
            trx,
          );
        });
      },
      { ttl: 30000, retryCount: 5, retryDelay: 500 },
    );
  }

  async updateBalanceWithTransaction(
    walletId: string,
    amount: number,
    transactionId: string,
    status: TransactionStatus,
    metadata: IFiatWalletTransactionMetadata,
    wallet: FiatWalletModel,
    balanceBefore: number,
    balanceAfter: number,
    createFiatWalletTransaction: (trx: Knex.Transaction) => Promise<FiatWalletTransactionModel>,
    trx: Knex.Transaction,
  ) {
    try {
      // Update the wallet balance
      const updatedWallet = await this.fiatWalletRepository.update(walletId, { balance: balanceAfter }, { trx });

      // If the fiat wallet transaction id is provided, update the fiat wallet transaction
      if (metadata.fiat_wallet_transaction_id) {
        // Update the fiat wallet transaction
        const fiatWalletTransaction = await this.fiatWalletTransactionRepository.findOne(
          {
            id: metadata.fiat_wallet_transaction_id,
            user_id: wallet.user_id,
          },
          {},
          { trx },
        );

        if (!fiatWalletTransaction) {
          throw new BadRequestException('Fiat wallet transaction not found');
        }

        await this.fiatWalletTransactionRepository.update(
          metadata.fiat_wallet_transaction_id,
          {
            status,
            balance_after: balanceAfter,
            processed_at: DateTime.now().toSQL(),
            completed_at: status === TransactionStatus.COMPLETED ? DateTime.now().toSQL() : null,
          },
          { trx },
        );
      } else {
        // If the fiat wallet transaction id is not provided, create a new fiat wallet transaction
        await createFiatWalletTransaction(trx);
      }

      this.logger.log(
        `Updated wallet ${walletId} balance from ${balanceBefore} to ${balanceAfter} (${amount > 0 ? '+' : ''}${amount})`,
      );

      this.eventEmitterService.emit(EventEmitterEventsEnum.WALLET_BALANCE_CHANGED, {
        userId: wallet.user_id,
        walletType: 'fiat',
        walletId: walletId,
        currency: wallet.asset,
        balance: balanceAfter.toString(),
        previousBalance: balanceBefore.toString(),
        transactionId: transactionId,
        timestamp: new Date(),
        wallet: updatedWallet,
      });

      return updatedWallet;
    } catch (error) {
      this.logger.error(`Failed to update wallet ${walletId} balance: ${error.message}`, error.stack);
      throw new BadRequestException('Failed to update wallet balance');
    }
  }

  async checkIfUserHasEnoughBalanceOrThrow(
    userId: string,
    amount: number,
    currencyCode: string = 'NGN',
    trx?: Knex.Transaction,
  ) {
    this.logger.log(`Checking if user ${userId} has enough balance for ${amount} ${currencyCode}`);
    const fiatWallet = (await this.fiatWalletRepository
      .query(trx)
      .forUpdate()
      .where('user_id', userId)
      .andWhere('asset', currencyCode)
      .first()) as FiatWalletModel;

    if (fiatWallet?.balance < CurrencyUtility.formatCurrencyAmountToSmallestUnit(amount, currencyCode)) {
      throw new BadRequestException('Insufficient balance');
    }
  }

  protected async getActiveVirtualAccount(virtualAccounts: VirtualAccountModel[]) {
    this.logger.log({ caseMessage: 'To lower case 2' });

    const activeVirtualAccount = virtualAccounts.find(
      (virtualAccount) => virtualAccount.provider?.toLowerCase() === this.waasAdapter.getProviderName()?.toLowerCase(),
    );

    if (!activeVirtualAccount) {
      throw new BadRequestException('No active virtual account found');
    }

    return activeVirtualAccount;
  }

  protected mapWaasTransactionStatusToTransactionStatus(status: string) {
    this.logger.log({ caseMessage: 'To lower case 3' });

    switch (status?.toLowerCase()) {
      case 'success':
        return TransactionStatus.COMPLETED;
      case 'failed':
        return TransactionStatus.FAILED;
    }

    return TransactionStatus.PENDING;
  }

  /**
   * Reconciles the user's USD fiat wallet balance with the provider (Zerohash) balance.
   * This method fetches the account details from Zerohash and updates the local wallet balance
   * if there's a discrepancy.
   *
   * @param userId - The user ID to reconcile balance for
   * @returns Object containing reconciliation result with provider balance, local balance, and whether update occurred
   */
  public async reconcileUsdBalanceFromProvider(userId: string): Promise<{
    success: boolean;
    providerBalance: number;
    localBalance: number;
    updated: boolean;
    message: string;
  }> {
    this.logger.log(`[FiatWalletService.reconcileUsdBalanceFromProvider] Starting reconciliation for user: ${userId}`);

    try {
      // Get the external account to find the participant_code
      const externalAccount = await this.externalAccountRepository.findOne({
        user_id: userId,
        provider: 'zerohash',
      });

      if (!externalAccount?.participant_code) {
        this.logger.warn(
          `[reconcileUsdBalanceFromProvider] No external account or participant_code found for user: ${userId}`,
        );
        return {
          success: false,
          providerBalance: 0,
          localBalance: 0,
          updated: false,
          message: 'No external account found for user',
        };
      }

      // Get the default underlying currency from config (e.g., "USDC.ETH" -> extract "USDC")
      const defaultUnderlyingCurrency = this.fiatWalletConfig.getConfig().default_underlying_currency;

      this.logger.log(
        `[FiatWalletService.reconcileUsdBalanceFromProvider] Fetching account details from Zerohash for participant: ${externalAccount.participant_code}, asset: ${defaultUnderlyingCurrency}`,
      );

      // Fetch account details from Zerohash
      const accountDetails = await this.fiatWalletAdapter.getAccountDetails({
        accountOwner: externalAccount.participant_code,
        asset: defaultUnderlyingCurrency,
      });

      if (!accountDetails?.accounts?.length) {
        this.logger.warn(
          `[reconcileUsdBalanceFromProvider] No accounts found from Zerohash for participant: ${externalAccount.participant_code}`,
        );
        return {
          success: false,
          providerBalance: 0,
          localBalance: 0,
          updated: false,
          message: 'No accounts found from provider',
        };
      }

      // Sum up all account balances from the provider
      const providerBalanceInMainUnit = accountDetails.accounts.reduce((sum, account) => {
        return sum + Number.parseFloat(account.balance || '0');
      }, 0);

      // Convert provider balance to smallest unit (cents)
      const providerBalanceInSmallestUnit = CurrencyUtility.formatCurrencyAmountToSmallestUnit(
        providerBalanceInMainUnit,
        SUPPORTED_CURRENCIES.USD.code,
      );

      // Get the user's local USD wallet
      const localWallet = await this.getUserWallet(userId, SUPPORTED_CURRENCIES.USD.code);
      const localBalance = Number(localWallet.balance);

      this.logger.log(
        `[reconcileUsdBalanceFromProvider] Provider balance: ${providerBalanceInSmallestUnit}, Local balance: ${localBalance}`,
      );

      // Check if there's a discrepancy
      if (providerBalanceInSmallestUnit === localBalance) {
        this.logger.log(`[reconcileUsdBalanceFromProvider] Balances match, no update needed`);
        return {
          success: true,
          providerBalance: providerBalanceInSmallestUnit,
          localBalance: localBalance,
          updated: false,
          message: 'Balances are in sync',
        };
      }

      // Use a lock to prevent race conditions during balance update
      const lockKey = `fiat-wallet-reconcile:${userId}:usd`;

      return await this.lockerService.withLock(
        lockKey,
        async () => {
          // Re-fetch local balance within lock to ensure accuracy
          const currentWallet = await this.fiatWalletRepository.findOne({
            user_id: userId,
            asset: SUPPORTED_CURRENCIES.USD.code,
          });

          if (!currentWallet) {
            return {
              success: false,
              providerBalance: providerBalanceInSmallestUnit,
              localBalance: 0,
              updated: false,
              message: 'Local USD wallet not found',
            };
          }

          const currentLocalBalance = Number(currentWallet.balance);

          // Double-check if update is still needed after acquiring lock
          if (providerBalanceInSmallestUnit === currentLocalBalance) {
            this.logger.log(`[reconcileUsdBalanceFromProvider] Balances now match after lock, no update needed`);
            return {
              success: true,
              providerBalance: providerBalanceInSmallestUnit,
              localBalance: currentLocalBalance,
              updated: false,
              message: 'Balances are in sync',
            };
          }

          this.logger.log(
            `[reconcileUsdBalanceFromProvider] Updating local balance from ${currentLocalBalance} to ${providerBalanceInSmallestUnit}`,
          );

          // Update the local wallet balance to match provider
          await this.fiatWalletRepository.update(currentWallet.id, {
            balance: providerBalanceInSmallestUnit,
          });

          this.logger.log(
            `[reconcileUsdBalanceFromProvider] Balance reconciled successfully for user: ${userId}. Previous: ${currentLocalBalance}, New: ${providerBalanceInSmallestUnit}`,
          );

          return {
            success: true,
            providerBalance: providerBalanceInSmallestUnit,
            localBalance: currentLocalBalance,
            updated: true,
            message: `Balance updated from ${currentLocalBalance} to ${providerBalanceInSmallestUnit}`,
          };
        },
        { ttl: 30000, retryCount: 3, retryDelay: 500 },
      );
    } catch (error) {
      this.logger.error(
        `[reconcileUsdBalanceFromProvider] Error reconciling balance for user ${userId}: ${error.message}`,
        error.stack,
      );
      return {
        success: false,
        providerBalance: 0,
        localBalance: 0,
        updated: false,
        message: `Reconciliation failed: ${error.message}`,
      };
    }
  }
}
