import {
  BadRequestException,
  forwardRef,
  Inject,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import axios from 'axios';
import { add, subtract } from 'mathjs';
import * as crypto from 'node:crypto';
import { Transaction } from 'objection';
import { PagaAdapter } from '../../adapters/waas/paga/paga.adapter';
import { PagaPersistentAccountWebhookPayload } from '../../adapters/waas/paga/paga.interface';
import { EnvironmentService } from '../../config';
import { PagaConfigProvider } from '../../config/paga.config';
import { SUPPORTED_CURRENCIES } from '../../currencies';
import { FetchQuery, IPaginatedResponse } from '../../database/base/base.interface';
import { IPagaLedgerAccount } from '../../database/models/pagaLedgerAccount/pagaLedgerAccount.interface';
import { PagaLedgerAccountModel } from '../../database/models/pagaLedgerAccount/pagaLedgerAccount.model';
import { LockerService } from '../../services/locker';
import { PagaLedgerTransactionService } from '../pagaLedgerTransaction/pagaLedgerTransaction.service';
import { CreditAccountDto } from './dtos/creditAccount.dto';
import { PagaDashboardAnalyticsDto } from './dtos/pagaDashboardAnalytics.dto';
import { PagaLedgerAccountRepository } from './pagaLedgerAccount.repository';

@Injectable()
export class PagaLedgerAccountService {
  @Inject(PagaLedgerAccountRepository)
  private readonly pagaLedgerAccountRepository: PagaLedgerAccountRepository;

  @Inject(LockerService)
  private readonly lockerService: LockerService;

  @Inject(PagaLedgerTransactionService)
  private readonly pagaLedgerTransactionService: PagaLedgerTransactionService;

  @Inject(forwardRef(() => PagaAdapter))
  private readonly pagaAdapter: PagaAdapter;

  private readonly logger = new Logger(PagaLedgerAccountService.name);

  /**
   * Create a new Paga ledger account
   */
  async create(
    data: Omit<IPagaLedgerAccount, 'id' | 'created_at' | 'updated_at' | 'deleted_at'>,
  ): Promise<PagaLedgerAccountModel> {
    try {
      this.logger.log(`Creating Paga ledger account for user: ${data.email}`);

      return await this.pagaLedgerAccountRepository.create(data);
    } catch (error) {
      this.logger.error(`Error creating Paga ledger account for user ${data.email}: ${error.message}`, error.stack);
      throw new InternalServerErrorException('Failed to create Paga ledger account');
    }
  }

  /**
   * Update a Paga ledger account by account number
   */
  async update(
    accountNumber: string,
    data: Partial<Omit<IPagaLedgerAccount, 'id' | 'created_at' | 'updated_at' | 'deleted_at' | 'user'>>,
  ): Promise<PagaLedgerAccountModel> {
    try {
      this.logger.log(`Updating Paga ledger account: ${accountNumber}`);

      const existingAccount = await this.pagaLedgerAccountRepository.findOne({ account_number: accountNumber });

      if (!existingAccount) {
        throw new NotFoundException(`Paga ledger account with account number ${accountNumber} not found`);
      }

      return await this.pagaLedgerAccountRepository.update({ account_number: accountNumber }, data);
    } catch (error) {
      this.logger.error(`Error updating Paga ledger account ${accountNumber}: ${error.message}`, error.stack);

      throw new InternalServerErrorException('Failed to update Paga ledger account');
    }
  }

  /**
   * Find all Paga ledger accounts with pagination
   */
  async findAll(params?: FetchQuery): Promise<IPaginatedResponse<PagaLedgerAccountModel>> {
    try {
      this.logger.log('Finding all Paga ledger accounts');

      return await this.pagaLedgerAccountRepository.findAll({}, params, {
        graphFetch: 'user',
      });
    } catch (error) {
      this.logger.error(`Error finding all Paga ledger accounts: ${error.message}`, error.stack);
      throw new InternalServerErrorException('Failed to retrieve Paga ledger accounts');
    }
  }

  /**
   * Find one Paga ledger account by filter
   */
  async findOne(filter: Partial<IPagaLedgerAccount>, trx?: Transaction): Promise<PagaLedgerAccountModel | null> {
    try {
      this.logger.log(`Finding Paga ledger account with filter: ${JSON.stringify(filter)}`);

      const account = await this.pagaLedgerAccountRepository.findOne(filter, undefined, { trx });

      return account || null;
    } catch (error) {
      this.logger.error(
        `Error finding Paga ledger account with filter ${JSON.stringify(filter)}: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException('Failed to find Paga ledger account');
    }
  }

  /**
   * Find or create a Paga ledger account by account number
   */
  async findOrCreate(
    data: Omit<IPagaLedgerAccount, 'id' | 'created_at' | 'updated_at' | 'deleted_at'>,
  ): Promise<PagaLedgerAccountModel> {
    try {
      this.logger.log(`Finding or creating Paga ledger account: ${data.account_number}`);

      const existingAccount = await this.findOne({ account_number: data.account_number });

      if (existingAccount) {
        this.logger.log(`Found existing Paga ledger account: ${data.account_number}`);
        return existingAccount;
      }

      this.logger.log(`Creating new Paga ledger account: ${data.account_number}`);
      return await this.create(data);
    } catch (error) {
      this.logger.error(
        `Error finding or creating Paga ledger account ${data.account_number}: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException('Failed to find or create Paga ledger account');
    }
  }

  /**
   * Delete a Paga ledger account by ID
   */
  async delete(id: string): Promise<void> {
    try {
      this.logger.log(`Deleting Paga ledger account: ${id}`);

      const existingAccount = await this.pagaLedgerAccountRepository.findById(id);

      if (!existingAccount) {
        throw new NotFoundException(`Paga ledger account with ID ${id} not found`);
      }

      await this.pagaLedgerAccountRepository.delete(id);
    } catch (error) {
      this.logger.error(`Error deleting Paga ledger account ${id}: ${error.message}`, error.stack);

      throw new InternalServerErrorException('Failed to delete Paga ledger account');
    }
  }

  /**
   * Update the balance of a Paga ledger account with locking to prevent race conditions
   *
   * @param accountNumber The account number of the Paga ledger account to update
   * @param amountToUpdate The new balance to set
   * @param pagaLedgerTransactionId The ID of the Paga ledger transaction to mark as complete
   * @returns The updated Paga ledger account with the new balance
   */
  async updateBalance(
    accountNumber: string,
    amountToUpdate: number,
    pagaLedgerTransactionId: string,
    knexTransaction?: Transaction,
  ): Promise<PagaLedgerAccountModel> {
    // Create a lock key based on account number to prevent race conditions
    const lockKey = `paga-ledger-account:${accountNumber}:balance-update`;

    return await this.lockerService.withLock(
      lockKey,
      async () => {
        try {
          this.logger.log(
            `Updating balance for Paga ledger account: ${accountNumber} to ${amountToUpdate} with transaction: ${pagaLedgerTransactionId}`,
          );
          // Get the current account with fresh data
          const existingAccount = await this.pagaLedgerAccountRepository.findOne(
            { account_number: accountNumber },
            undefined,
            {
              trx: knexTransaction,
            },
          );

          if (!existingAccount) {
            throw new NotFoundException(`Paga ledger account with account number ${accountNumber} not found`);
          }

          // Verify the Paga ledger transaction exists
          const pagaLedgerTransaction = await this.pagaLedgerTransactionService.findOne(
            {
              id: pagaLedgerTransactionId,
              account_number: accountNumber,
            },
            knexTransaction,
          );

          if (!pagaLedgerTransaction) {
            throw new NotFoundException(
              `Paga ledger transaction with ID ${pagaLedgerTransactionId} not found for account ${accountNumber}`,
            );
          }

          if (knexTransaction) {
            return await this.updateBalanceWithTransaction(
              accountNumber,
              amountToUpdate,
              pagaLedgerTransactionId,
              existingAccount,
              knexTransaction,
            );
          }

          // Begin transaction to ensure both the account balance update and transaction status update are atomic
          return await this.pagaLedgerAccountRepository.transaction(async (trx) => {
            return await this.updateBalanceWithTransaction(
              accountNumber,
              amountToUpdate,
              pagaLedgerTransactionId,
              existingAccount,
              trx,
            );
          });
        } catch (error) {
          this.logger.error(
            `Error updating balance for Paga ledger account ${accountNumber}: ${error.message}`,
            error.stack,
          );

          throw new InternalServerErrorException('Failed to update Paga ledger account balance');
        }
      },
      /**
       * 30 seconds lock time
       * 5 retry attempts
       * 500ms retry delay
       */
      { ttl: 30000, retryCount: 5, retryDelay: 500 },
    );
  }

  private async updateBalanceWithTransaction(
    accountNumber: string,
    amountToUpdate: number,
    pagaLedgerTransactionId: string,
    existingAccount: PagaLedgerAccountModel,
    trx?: Transaction,
  ): Promise<PagaLedgerAccountModel> {
    let newBalance = Number(existingAccount.available_balance);

    newBalance = add(Number(newBalance), Number(amountToUpdate));

    try {
      // Update the account balance
      const updatedAccount = await this.pagaLedgerAccountRepository.update(
        existingAccount.id,
        { available_balance: newBalance },
        { trx },
      );

      // Update the Paga ledger transaction status to completed
      await this.pagaLedgerTransactionService.update(pagaLedgerTransactionId, 'SUCCESSFUL', trx);

      this.logger.log(
        `Updated Paga ledger account ${accountNumber} balance to ${amountToUpdate} and marked transaction ${pagaLedgerTransactionId} as completed`,
      );

      return updatedAccount;
    } catch (error) {
      this.logger.error(
        `Failed to update Paga ledger account ${accountNumber} balance or transaction status: ${error.message}`,
        error.stack,
      );
      throw new BadRequestException('Failed to update account balance and transaction status');
    }
  }

  /**
   * Deposit money into an account.
   * Steps:
   * - lock by account
   * - create a Paga ledger transaction (PENDING)
   * - move funds to ledger balance (hold)
   * - update current balance using updateBalance (marks transaction SUCCESSFUL)
   * - clear the ledger on success
   * - if any step fails, move funds back to current balance and mark transaction FAILED
   */
  async depositMoney(
    payload: {
      amount: number;
      referenceNumber: string;
      fee: number;
      accountNumber: string;
      currency?: string;
      description?: string;
    },
    knexTransaction: Transaction,
  ): Promise<PagaLedgerAccountModel> {
    const { amount, referenceNumber, fee, accountNumber, currency = 'NGN', description } = payload;

    // Validate inputs early before acquiring lock
    if (amount <= 0) {
      throw new BadRequestException('Amount must be greater than zero');
    }
    if (fee < 0) {
      throw new BadRequestException('Fee cannot be negative');
    }

    const lockKey = `paga-ledger-account:${accountNumber}-${referenceNumber}:deposit-money`;

    return await this.lockerService.withLock(
      lockKey,
      async () => {
        let createdTransactionId: string | undefined;

        try {
          this.logger.log(
            `Depositing amount=${amount}, fee=${fee} into account=${accountNumber} ref=${referenceNumber}`,
          );

          const account = await this.pagaLedgerAccountRepository.findOne({ account_number: accountNumber }, undefined, {
            trx: knexTransaction,
          });

          if (!account) {
            throw new NotFoundException(`Paga ledger account with account number ${accountNumber} not found`);
          }

          const netAmount = add(amount, -fee) as number; // amount - fee
          const balanceBefore = Number(account.available_balance);
          const expectedBalanceAfter = add(balanceBefore, netAmount) as number;

          // Create Paga ledger transaction in PENDING state
          const transaction = await this.pagaLedgerTransactionService.create(
            {
              account_number: accountNumber,
              amount,
              fee,
              reference_number: referenceNumber,
              transaction_reference: referenceNumber,
              balance_before: balanceBefore,
              balance_after: expectedBalanceAfter,
              transaction_type: 'CREDIT',
              currency,
              status: 'PENDING',
              description,
            },
            knexTransaction,
          );

          createdTransactionId = transaction.id;

          // Update current balance and mark transaction SUCCESSFUL
          const updatedAccount = await this.updateBalance(accountNumber, netAmount, transaction.id, knexTransaction);

          this.logger.log(
            `Deposit completed for account=${accountNumber}, ref=${referenceNumber}. Net credited=${netAmount}`,
          );
          return updatedAccount;
        } catch (error) {
          this.logger.error(
            `Deposit failed for account=${accountNumber}, ref=${referenceNumber}: ${error.message}`,
            error.stack,
          );

          // Mark transaction as FAILED if it was created
          if (createdTransactionId) {
            try {
              await this.pagaLedgerTransactionService.update(createdTransactionId, 'FAILED', knexTransaction);
            } catch (statusError) {
              this.logger.error(
                `Failed to mark transaction ${createdTransactionId} as FAILED: ${statusError.message}`,
                statusError.stack,
              );
            }
          }

          // Re-throw the original error to maintain proper error types
          throw error;
        }
      },
      { ttl: 30000, retryCount: 5, retryDelay: 500 },
    );
  }

  async topUp(body: CreditAccountDto) {
    if (EnvironmentService.isProduction()) {
      throw new BadRequestException('This endpoint is not available in production');
    }

    // check if the reference number is already in use
    const existingTransaction = await this.pagaLedgerTransactionService.findOne({
      reference_number: body.reference_number,
    });
    if (existingTransaction) {
      throw new BadRequestException('Reference number already in use');
    }

    if (body.reference_number?.length < 15 || body.reference_number?.length > 30) {
      throw new BadRequestException('Reference number must be 15 - 30 characters');
    }

    const webhookUrls = [`https://webhook-relay.onedosh.com/webhooks/paga`];

    // send a sample webhook to the webhook urls
    const webhookPayload: PagaPersistentAccountWebhookPayload = {
      accountNumber: body.account_number,
      amount: body.amount.toString(),
      transactionReference: body.reference_number,
      fundingTransactionReference: body.reference_number,
      fundingPaymentReference: body.reference_number,
      accountName: body.source_account_name,
      financialIdentificationNumber: null,
      clearingFeeAmount: '0',
      payerDetails: {
        paymentReferenceNumber: body.reference_number,
        narration: body.source_account_number,
        payerBankName: body.source_account_number,
        payerName: body.source_account_name,
        paymentMethod: 'BANK_TRANSFER',
        payerBankAccountNumber: body.source_account_number,
      },
      instantSettlementStatus: '1',
      narration: body.description,
      hash: body.reference_number,
      statusCode: '0',
      statusMessage: 'success',
    };

    // genrate the hash using this statusCode + accountNumber + amount + clearingFeeAmount + transferFeeAmount + hashKey
    const pagaConfig = new PagaConfigProvider().getConfig();

    const hash = crypto
      .createHash('sha512')
      .update(
        webhookPayload.statusCode +
          webhookPayload.accountNumber +
          webhookPayload.amount +
          webhookPayload.clearingFeeAmount +
          pagaConfig.hmac,
      )
      .digest('hex');

    webhookPayload.hash = hash;

    // send a post request to the webhook urls
    const auth = Buffer.from(`${pagaConfig.webhookUsername}:${pagaConfig.webhookPassword}`).toString('base64');

    // Send webhooks after 2 seconds in the background
    setTimeout(async () => {
      const results = [];

      for (const webhookUrl of webhookUrls) {
        try {
          const response = await axios.post(webhookUrl, webhookPayload, {
            headers: {
              Authorization: `Basic ${auth}`,
              'Content-Type': 'application/json',
              'User-Agent': 'PagaLedgerService/1.0',
            },
            timeout: 15000, // 15 seconds timeout
            maxRedirects: 3,
            validateStatus: (status) => status >= 200 && status < 300,
          });

          const data = response.data;

          console.log('Paga webhook response', data);

          results.push({
            url: webhookUrl,
            success: true,
            status: response.status,
            statusText: response.statusText,
          });

          this.logger.log(`Webhook sent successfully to ${webhookUrl}: ${response.status}`);
        } catch (error) {
          const errorMessage = error.response?.data?.message || error.message || 'Unknown error';
          const statusCode = error.response?.status || 'N/A';

          results.push({
            url: webhookUrl,
            success: false,
            error: errorMessage,
            status: statusCode,
          });

          this.logger.error(`Failed to send webhook to ${webhookUrl}: ${errorMessage} (Status: ${statusCode})`);
          // Continue with other webhooks even if one fails
        }
      }

      this.logger.log('Webhook sending completed:', JSON.stringify(results, null, 2));
    }, 2000);
  }

  /**
   * Get admin dashboard analytics for Paga balance reconciliation
   * Returns the actual Paga business balance and total user balances for reconciliation
   */
  async getDashboardAnalytics(): Promise<PagaDashboardAnalyticsDto> {
    try {
      this.logger.log('Fetching Paga dashboard analytics');

      const [pagaBusinessBalance, totalUserBalances, totalAccounts] = await Promise.all([
        this.pagaAdapter.getBusinessAccountBalance(),
        this.pagaLedgerAccountRepository.getTotalUserBalances(),
        this.pagaLedgerAccountRepository.getTotalAccountsCount(),
      ]);

      // Paga returns balance in Naira, convert to kobo for consistency with internal storage
      const pagaBalanceKobo = Math.round(pagaBusinessBalance.availableBalance * 100);
      const balanceDifference = subtract(pagaBalanceKobo, totalUserBalances);
      const needsTopUp = pagaBalanceKobo < totalUserBalances;
      const topUpAmountRequired = needsTopUp ? Math.abs(Number(balanceDifference)) : 0;

      // minorUnit is 100 for NGN (2 decimal places)
      const divisor = SUPPORTED_CURRENCIES.NGN.minorUnit;
      const decimalPlaces = 2;

      return {
        paga_business_balance: pagaBalanceKobo,
        paga_business_balance_naira: pagaBusinessBalance.availableBalance,
        total_user_balances: totalUserBalances,
        total_user_balances_naira: Number((totalUserBalances / divisor).toFixed(decimalPlaces)),
        balance_difference: Number(balanceDifference),
        balance_difference_naira: Number((Number(balanceDifference) / divisor).toFixed(decimalPlaces)),
        needs_top_up: needsTopUp,
        top_up_amount_required: topUpAmountRequired,
        top_up_amount_required_naira: Number((topUpAmountRequired / divisor).toFixed(decimalPlaces)),
        total_accounts: totalAccounts,
        currency: pagaBusinessBalance.currency,
        generated_at: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error(`Error fetching Paga dashboard analytics: ${error.message}`, error.stack);
      throw new InternalServerErrorException('Failed to fetch Paga dashboard analytics');
    }
  }

  /**
   * Get only the sum of total user NGN balances
   * Useful for quick internal reconciliation without calling Paga API
   */
  async getTotalUserBalances(): Promise<{
    total_balances: number;
    total_balances_naira: number;
    total_accounts: number;
  }> {
    try {
      this.logger.log('Fetching total user balances');

      const [totalUserBalances, totalAccounts] = await Promise.all([
        this.pagaLedgerAccountRepository.getTotalUserBalances(),
        this.pagaLedgerAccountRepository.getTotalAccountsCount(),
      ]);

      // minorUnit is 100 for NGN (2 decimal places)
      const divisor = SUPPORTED_CURRENCIES.NGN.minorUnit;
      const decimalPlaces = 2;

      return {
        total_balances: totalUserBalances,
        total_balances_naira: Number((totalUserBalances / divisor).toFixed(decimalPlaces)),
        total_accounts: totalAccounts,
      };
    } catch (error) {
      this.logger.error(`Error fetching total user balances: ${error.message}`, error.stack);
      throw new InternalServerErrorException('Failed to fetch total user balances');
    }
  }
}
