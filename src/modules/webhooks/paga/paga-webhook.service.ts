import { forwardRef, Inject, Injectable, Logger } from '@nestjs/common';
import { DateTime } from 'luxon';
import { add, divide, floor, multiply, subtract } from 'mathjs';
import { Transaction } from 'objection';
import { ExchangeAdapter } from '../../../adapters/exchange/exchange.adapter';
import {
  PagaPersistentAccountWebhookPayload,
  PagaWebhookTransactionStatusEnum,
} from '../../../adapters/waas/paga/paga.interface';
import { WaasAdapter } from '../../../adapters/waas/waas.adapter';
import { EnvironmentService } from '../../../config';
import { DATE_TIME_FORMAT } from '../../../constants/constants';
import { CurrencyUtility, SUPPORTED_CURRENCIES } from '../../../currencies';
import {
  FiatWalletModel,
  FiatWalletTransactionModel,
  FiatWalletTransactionType,
  TransactionCategory,
  TransactionModel,
  TransactionScope,
  TransactionStatus,
  TransactionType,
  UserModel,
} from '../../../database';
import { VirtualAccountModel, VirtualAccountType } from '../../../database/models/virtualAccount';
import {
  CurrencyConversionSuccessData,
  CurrencyConversionSuccessMail,
} from '../../../notifications/mails/currency_conversion_success_mail';
import { NgDepositMail } from '../../../notifications/mails/ng_deposit_mail';
import { WalletExchangeSuccessMail } from '../../../notifications/mails/wallet_exchange_success_mail';
import { LockerService } from '../../../services/locker/locker.service';
import { PushNotificationService } from '../../../services/pushNotification/pushNotification.service';
import { MailerService } from '../../../services/queue/processors/mailer/mailer.service';
import { UtilsService } from '../../../utils/utils.service';
import { UserService } from '../../auth/user/user.service';
import { UserProfileService } from '../../auth/userProfile/userProfile.service';
import { ExternalAccountRepository } from '../../externalAccount/external-account.repository';
import { FiatWalletRepository, FiatWalletService } from '../../fiatWallet';
import { FiatWalletTransactionRepository } from '../../fiatWalletTransactions/fiatWalletTransactions.repository';
import { FiatWalletTransactionService } from '../../fiatWalletTransactions/fiatWalletTransactions.service';
import { PagaLedgerAccountService } from '../../pagaLedgerAccount/pagaLedgerAccount.service';
import { RateRepository } from '../../rate/rate.repository';
import { RateConfigRepository } from '../../rateConfig/rateConfig.repository';
import { TransactionService } from '../../transaction';
import { TransactionRepository } from '../../transaction/transaction.repository';
import { VirtualAccountRepository } from '../../virtualAccount';
import { ZerohashWebhookService } from '../zerohash/zerohash-webhook.service';

interface SendCurrencyConversionEmailParams {
  userId: string;
  fromCurrency: string;
  toCurrency: string;
  fromAmountInSmallestUnit: number;
  toAmountInSmallestUnit: number;
  exchangeRate: number;
  transactionId: string;
  transactionDate: Date;
  orderNumber?: string;
  feeInSmallestUnit?: number;
}

@Injectable()
export class PagaWebhookService {
  @Inject(WaasAdapter)
  private readonly waasAdapter: WaasAdapter;

  @Inject(PagaLedgerAccountService)
  private readonly pagaLedgerAccountService: PagaLedgerAccountService;

  @Inject(TransactionService)
  private readonly transactionService: TransactionService;

  @Inject(FiatWalletService)
  private readonly fiatWalletService: FiatWalletService;

  @Inject(FiatWalletTransactionService)
  private readonly fiatWalletTransactionService: FiatWalletTransactionService;

  @Inject(TransactionRepository)
  private readonly transactionRepository: TransactionRepository;

  @Inject(FiatWalletTransactionRepository)
  private readonly fiatWalletTransactionRepository: FiatWalletTransactionRepository;

  @Inject(VirtualAccountRepository)
  private readonly virtualAccountRepository: VirtualAccountRepository;

  @Inject(PushNotificationService)
  private readonly pushNotificationService: PushNotificationService;

  @Inject(UserProfileService)
  private readonly userProfileService: UserProfileService;

  @Inject(UserService)
  private readonly userService: UserService;

  @Inject(MailerService)
  private readonly mailerService: MailerService;

  @Inject(RateRepository)
  private readonly rateRepository: RateRepository;

  @Inject(RateConfigRepository)
  private readonly rateConfigRepository: RateConfigRepository;

  @Inject(FiatWalletRepository)
  private readonly fiatWalletRepository: FiatWalletRepository;

  @Inject(ExternalAccountRepository)
  private readonly externalAccountRepository: ExternalAccountRepository;

  @Inject(ExchangeAdapter)
  private readonly exchangeAdapter: ExchangeAdapter;

  @Inject(LockerService)
  private readonly lockerService: LockerService;

  @Inject(forwardRef(() => ZerohashWebhookService))
  private readonly zerohashWebhookService: ZerohashWebhookService;

  private readonly logger = new Logger(PagaWebhookService.name);

  async handlePersistentAccountWebhook(payload: PagaPersistentAccountWebhookPayload) {
    // Sanitize amount by removing commas (e.g., "4,000.00" -> "4000.00")
    if (payload.amount) {
      payload.amount = String(payload.amount).replace(/,/g, '');
    }

    // Log received webhook payload
    this.logger.log(
      `[PagaWebhookService] Received persistent account webhook: ${JSON.stringify(payload)}`,
      'PagaWebhookService.handlePersistentAccountWebhook',
    );

    const virtualAccount = await this.getVirtualAccount(payload.accountNumber);
    const user = virtualAccount?.user;

    this.logger.log(
      `[PagaWebhookService] Fetched user for accountNumber ${payload.accountNumber}: ${user ? user.id : 'NOT FOUND'}`,
      'PagaWebhookService.handlePersistentAccountWebhook',
    );

    if (!user) {
      this.logger.warn(
        `[PagaWebhookService] User not found for accountNumber ${payload.accountNumber}`,
        'PagaWebhookService.handlePersistentAccountWebhook',
      );
      return { status: 'SUCCESS', message: 'User not found' };
    }

    // Verify transaction status
    const pagaTransactionStatus: PagaWebhookTransactionStatusEnum = this.transformToTransactionStatus(
      payload.statusMessage,
    );

    if (
      virtualAccount.type === VirtualAccountType.MAIN_ACCOUNT ||
      virtualAccount.type !== VirtualAccountType.EXCHANGE_ACCOUNT ||
      !virtualAccount.type
    ) {
      const fiatWallet = await this.fiatWalletService.getUserWallet(user.id, SUPPORTED_CURRENCIES.NGN.code);
      this.logger.log(
        `[PagaWebhookService] Fetched fiat wallet for user ${user.id}: ${fiatWallet ? fiatWallet.id : 'NOT FOUND'}`,
        'PagaWebhookService.handlePersistentAccountWebhook',
      );

      // Fetch transaction by external reference
      let transaction = await this.transactionRepository.findOne({ reference: payload.transactionReference });
      let fiatWalletTransaction: FiatWalletTransactionModel;

      this.logger.log(
        `[PagaWebhookService] Fetched transaction for reference ${payload.transactionReference}: ${transaction ? transaction.id : 'NOT FOUND'}`,
        'PagaWebhookService.handlePersistentAccountWebhook',
      );

      if (transaction && transaction.status?.toLowerCase() === TransactionStatus.COMPLETED.toLowerCase()) {
        this.logger.log(
          `[PagaWebhookService] Transaction ${transaction.id} already completed`,
          'PagaWebhookService.handlePersistentAccountWebhook',
        );
        return { status: 'SUCCESS', message: 'Transaction already completed' };
      }

      if (transaction) {
        fiatWalletTransaction = await this.fiatWalletTransactionRepository.findOne({ transaction_id: transaction.id });
        this.logger.log(
          `[PagaWebhookService] Fetched fiat wallet transaction for transaction ${transaction.id}: ${fiatWalletTransaction ? fiatWalletTransaction.id : 'NOT FOUND'}`,
          'PagaWebhookService.handlePersistentAccountWebhook',
        );
      }

      // If no transaction, create new transaction and fiat wallet transaction
      if (!transaction) {
        this.logger.log(
          `[PagaWebhookService] No transaction found, creating new transaction and fiat wallet transaction for user ${user.id}`,
          'PagaWebhookService.handlePersistentAccountWebhook',
        );
        const allTransactions = await this.createTransactionAndFiatWalletTransaction(user.id, payload, fiatWallet);
        transaction = allTransactions.transaction;
        fiatWalletTransaction = allTransactions.fiatWalletTransaction;
        this.logger.log(
          `[PagaWebhookService] Created transaction ${transaction.id} and fiat wallet transaction ${fiatWalletTransaction.id}`,
          'PagaWebhookService.handlePersistentAccountWebhook',
        );
      }

      if (pagaTransactionStatus?.toLowerCase() === PagaWebhookTransactionStatusEnum.SUCCESS.toLowerCase()) {
        this.logger.log(
          `[PagaWebhookService] Transaction ${transaction.id} is successful, handling successful transaction`,
          'PagaWebhookService.handlePersistentAccountWebhook',
        );
        await this.handleSuccessfulTransaction(payload, transaction, fiatWalletTransaction);

        this.logger.log(
          `[PagaWebhookService] Transaction ${transaction.id} completed successfully`,
          'PagaWebhookService.handlePersistentAccountWebhook',
        );
        return { status: 'SUCCESS', message: 'Transaction completed' };
      }

      if (pagaTransactionStatus === PagaWebhookTransactionStatusEnum.FAILED) {
        this.logger.warn(
          `[PagaWebhookService] Transaction ${transaction.id} failed, updating status to FAILED`,
          'PagaWebhookService.handlePersistentAccountWebhook',
        );
        await this.updateFiatWalletTransactionAndTransaction(
          transaction.id,
          fiatWalletTransaction.id,
          TransactionStatus.FAILED,
        );

        this.logger.log(
          `[PagaWebhookService] Transaction ${transaction.id} marked as FAILED`,
          'PagaWebhookService.handlePersistentAccountWebhook',
        );
        return { status: 'SUCCESS', message: 'Transaction failed' };
      }

      this.logger.log(
        `[PagaWebhookService] Transaction ${transaction.id} is pending`,
        'PagaWebhookService.handlePersistentAccountWebhook',
      );
      return { status: 'SUCCESS', message: 'Transaction pending' };
    } else if (virtualAccount.type === VirtualAccountType.EXCHANGE_ACCOUNT) {
      this.logger.log(
        `[PagaWebhookService] Exchange transaction detected, handling exchange transaction`,
        'PagaWebhookService.handlePersistentAccountWebhook',
      );
      await this.handleExchangeTransaction(user, payload, virtualAccount);
      return { status: 'SUCCESS', message: 'Exchange transaction completed' };
    }
  }

  private async handleExchangeTransaction(
    user: UserModel,
    payload: PagaPersistentAccountWebhookPayload,
    virtualAccount: VirtualAccountModel,
  ) {
    this.logger.log(
      `[PagaWebhookService] Handling exchange transaction for virtual account ${virtualAccount.account_number}`,
      'PagaWebhookService.handleExchangeTransaction',
    );

    // Get the parent transaction using the virtual account's transaction_id
    if (!virtualAccount.transaction_id) {
      this.logger.warn(
        `[PagaWebhookService] Virtual account ${virtualAccount.account_number} has no transaction_id`,
        'PagaWebhookService.handleExchangeTransaction',
      );
      return;
    }

    const parentTransaction = await this.transactionRepository.findById(virtualAccount.transaction_id);
    if (!parentTransaction) {
      this.logger.warn(
        `[PagaWebhookService] Parent transaction ${virtualAccount.transaction_id} not found`,
        'PagaWebhookService.handleExchangeTransaction',
      );
      return;
    }

    this.logger.log(
      `[PagaWebhookService] Found parent transaction ${parentTransaction.id}`,
      'PagaWebhookService.handleExchangeTransaction',
    );

    // Use shared lock with ZeroHash and YellowCard webhooks to ensure sequential processing
    // This prevents race conditions where Paga webhook arrives before ZeroHash creates the child transaction
    const exchangeWebhookLockKey = `exchange_webhook_${parentTransaction.id}`;
    const exchangeWebhookLockOptions = { ttl: 240000, retryCount: 60, retryDelay: 4000 };

    await this.lockerService.runWithLock(
      exchangeWebhookLockKey,
      async () => {
        // Check if parent USD transaction is still in PROCESSING status
        // If so, call Zerohash API to check withdrawal status and complete if confirmed
        if (parentTransaction.status?.toLowerCase() !== TransactionStatus.COMPLETED.toLowerCase()) {
          this.logger.log(
            `[PagaWebhookService] Parent USD transaction ${parentTransaction.id} is not completed, checking Zerohash withdrawal status`,
            'PagaWebhookService.handleExchangeTransaction',
          );

          const withdrawalCompleted = await this.zerohashWebhookService.checkAndCompleteUsdWithdrawal(
            parentTransaction.id,
            parentTransaction.user_id,
          );

          if (withdrawalCompleted) {
            this.logger.log(
              `[PagaWebhookService] USD withdrawal completed via inline check for parent transaction ${parentTransaction.id}`,
              'PagaWebhookService.handleExchangeTransaction',
            );
          } else {
            this.logger.log(
              `[PagaWebhookService] USD withdrawal not yet confirmed, continuing with NGN processing for parent transaction ${parentTransaction.id}`,
              'PagaWebhookService.handleExchangeTransaction',
            );
          }

          // Reconcile USD balance from provider after checking withdrawal status
          const reconcileResult = await this.fiatWalletService.reconcileUsdBalanceFromProvider(
            parentTransaction.user_id,
          );
          this.logger.log(
            `[PagaWebhookService] USD balance reconciliation result: ${JSON.stringify(reconcileResult)}`,
            'PagaWebhookService.handleExchangeTransaction',
          );
        }

        // Retry finding the child transaction with delays
        // This handles cases where ZeroHash hasn't created the child transaction yet
        // Using longer retries in production to account for ZeroHash's processing time before lock acquisition
        const maxRetries = EnvironmentService.isProduction() ? 3 : 1;
        const retryDelayMs = EnvironmentService.isProduction() ? 4000 : 100;
        let childTransaction: TransactionModel | null = null;

        for (let attempt = 1; attempt <= maxRetries; attempt++) {
          childTransaction = await this.transactionRepository.findOne(
            { parent_transaction_id: parentTransaction.id, asset: SUPPORTED_CURRENCIES.NGN.code },
            {},
            { graphFetch: '[fiatWalletTransaction]' },
          );

          if (childTransaction) {
            break;
          }

          if (attempt < maxRetries) {
            this.logger.log(
              `[PagaWebhookService] Child transaction not found, retrying in ${retryDelayMs}ms (attempt ${attempt}/${maxRetries})`,
              'PagaWebhookService.handleExchangeTransaction',
            );
            await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
          }
        }

        if (childTransaction) {
          // Check if already completed
          if (childTransaction.status?.toLowerCase() === TransactionStatus.COMPLETED.toLowerCase()) {
            this.logger.log(
              `[PagaWebhookService] Child transaction ${childTransaction.id} already completed`,
              'PagaWebhookService.handleExchangeTransaction',
            );
            return;
          }

          // Update the child transaction to COMPLETED
          await this.completeExchangeTransaction(childTransaction, parentTransaction as TransactionModel, payload);
        } else {
          // Create the child transaction with COMPLETED status if not found after retries
          this.logger.log(
            `[PagaWebhookService] Child transaction not found after ${maxRetries} attempts, creating completed transaction`,
            'PagaWebhookService.handleExchangeTransaction',
          );
          await this.createCompletedExchangeTransaction(parentTransaction as TransactionModel, payload);
        }
      },
      exchangeWebhookLockOptions,
    );
  }

  /**
   * Complete an existing exchange transaction
   */
  private async completeExchangeTransaction(
    childTransaction: TransactionModel,
    parentTransaction: TransactionModel,
    payload: PagaPersistentAccountWebhookPayload,
  ) {
    this.logger.log(
      `[PagaWebhookService] Completing exchange transaction ${childTransaction.id}`,
      'PagaWebhookService.completeExchangeTransaction',
    );

    // Convert webhook payload amount to smallest unit (kobo)
    const payloadAmount = CurrencyUtility.formatCurrencyAmountToSmallestUnit(
      Number(payload.amount),
      SUPPORTED_CURRENCIES.NGN.code,
    );

    const fiatWallet = await this.fiatWalletService.getUserWallet(
      parentTransaction.user_id,
      SUPPORTED_CURRENCIES.NGN.code,
    );

    // Calculate new balance_after based on payload amount
    const balanceBefore = Number(fiatWallet.balance);
    const balanceAfter = Number(add(balanceBefore, payloadAmount));

    await this.transactionRepository.transaction(async (trx) => {
      // Update transaction with new amount and store old amount in metadata
      await this.transactionRepository.update(
        childTransaction.id,
        {
          amount: payloadAmount,
          balance_before: balanceBefore,
          balance_after: balanceAfter,
          metadata: {
            ...childTransaction.metadata,
            old_amount: childTransaction.amount,
          },
        },
        { trx },
      );

      // get user main account number
      const ngnFiatWallet = (await this.fiatWalletRepository
        .query(trx)
        .where('user_id', parentTransaction.user_id)
        .andWhere('asset', SUPPORTED_CURRENCIES.NGN.code)
        .withGraphFetched('virtualAccounts')
        .first()) as FiatWalletModel;

      const mainAccountNumber = ngnFiatWallet.virtualAccounts.find(
        (virtualAccount) => virtualAccount.type === VirtualAccountType.MAIN_ACCOUNT,
      );

      if (!mainAccountNumber) {
        this.logger.warn(
          `[PagaWebhookService] Main account number not found for user ${parentTransaction.user_id}`,
          'PagaWebhookService.completeExchangeTransaction',
        );
        return;
      }

      // we will deposit the money to the user's paga ledger account.
      await this.pagaLedgerAccountService.depositMoney(
        {
          accountNumber: mainAccountNumber.account_number,
          amount: payloadAmount,
          referenceNumber: payload.transactionReference,
          fee: 0,
          currency: SUPPORTED_CURRENCIES.NGN.code,
          description: `Wallet top up of ${payload.amount} from ${payload.payerDetails.payerName}`,
        },
        trx,
      );

      // Update user's NGN balance using payload amount (must happen before transaction status update)
      await this.fiatWalletService.updateBalance(
        ngnFiatWallet.id,
        payloadAmount,
        childTransaction.id,
        FiatWalletTransactionType.EXCHANGE,
        TransactionStatus.COMPLETED,
        {
          description: `Exchange USD to NGN`,
          fiat_wallet_transaction_id: childTransaction.fiatWalletTransaction?.id,
        },
        trx,
      );

      // Update the transaction status to COMPLETED after balance update
      await this.transactionService.updateStatus(
        childTransaction.id,
        TransactionStatus.COMPLETED,
        {
          description: `Exchange USD to NGN`,
          source: `USD Wallet`,
          destination: `NGN Wallet`,
        },
        trx,
        {
          shouldSendEmail: true,
          shouldSendPushNotification: true,
          shouldSendInAppNotification: true,
        },
      );
    });

    this.logger.log(
      `[PagaWebhookService] Exchange transaction ${childTransaction.id} completed successfully`,
      'PagaWebhookService.completeExchangeTransaction',
    );

    // Send currency conversion success email
    await this.sendCurrencyConversionEmail({
      userId: parentTransaction.user_id,
      fromCurrency: SUPPORTED_CURRENCIES.USD.code,
      toCurrency: SUPPORTED_CURRENCIES.NGN.code,
      fromAmountInSmallestUnit: parentTransaction.amount,
      toAmountInSmallestUnit: payloadAmount,
      exchangeRate: Number(childTransaction.metadata?.rate || parentTransaction.metadata?.rate),
      transactionId: childTransaction.id,
      transactionDate: new Date(),
      orderNumber: childTransaction.external_reference,
    });
  }

  /**
   * Create a completed exchange transaction (NGN) when it doesn't exist
   */
  private async createCompletedExchangeTransaction(
    parentTransaction: TransactionModel,
    payload: PagaPersistentAccountWebhookPayload,
  ) {
    const logContext = 'PagaWebhookService.createCompletedExchangeTransaction';
    // payload ngn amount in smallest unit
    const payloadNgnAmountInSmallestUnit = Math.floor(
      CurrencyUtility.formatCurrencyAmountToSmallestUnit(Number(payload.amount), SUPPORTED_CURRENCIES.NGN.code),
    );
    this.logger.log(
      `[PagaWebhookService] Starting createCompletedExchangeTransaction - parentTransactionId: ${parentTransaction.id}, userId: ${parentTransaction.user_id}, payloadAmount: ${payload.amount}, payloadRef: ${payload.transactionReference}`,
      logContext,
    );

    this.logger.log(
      `[PagaWebhookService] Parent transaction details - id: ${parentTransaction.id}, amount: ${parentTransaction.amount}, asset: ${parentTransaction.asset}, status: ${parentTransaction.status}, metadata: ${JSON.stringify(parentTransaction.metadata)}`,
      logContext,
    );

    try {
      // Step 1: Validate rate_id in metadata
      if (!parentTransaction.metadata?.rate_id) {
        this.logger.warn(
          `[PagaWebhookService] STEP 1 FAILED - Parent transaction ${parentTransaction.id} has no rate_id in metadata. Metadata: ${JSON.stringify(parentTransaction.metadata)}`,
          logContext,
        );
        return;
      }

      this.logger.log(
        `[PagaWebhookService] STEP 1 PASSED - rate_id found: ${parentTransaction.metadata.rate_id}`,
        logContext,
      );

      // Step 2: Fetch exchange rate
      const exchangeRate = await this.rateRepository.findOne({
        id: parentTransaction.metadata.rate_id,
      });

      if (!exchangeRate) {
        this.logger.warn(
          `[PagaWebhookService] STEP 2 FAILED - Exchange rate not found for rate_id: ${parentTransaction.metadata.rate_id}`,
          logContext,
        );
        return;
      }

      this.logger.log(
        `[PagaWebhookService] STEP 2 PASSED - Exchange rate found - id: ${exchangeRate.id}, rate: ${exchangeRate.rate}, rateType: ${typeof exchangeRate.rate}, buyingCurrency: ${exchangeRate.buying_currency_code}, sellingCurrency: ${exchangeRate.selling_currency_code}`,
        logContext,
      );

      // Step 3: Fetch rate config
      const providerName = this.exchangeAdapter.getProviderName();
      const rateConfig = await this.rateConfigRepository.findOne({
        provider: providerName,
      });

      if (rateConfig && !rateConfig.isActive) {
        this.logger.warn(
          `[PagaWebhookService] STEP 3 FAILED - Rate config is inactive for provider: ${providerName}`,
          logContext,
        );
        return;
      }

      if (!rateConfig) {
        this.logger.warn(
          `[PagaWebhookService] STEP 3 FAILED - Rate config not found for provider: ${providerName}`,
          logContext,
        );
        return;
      }

      const disbursementFeeConfig = rateConfig.fiatExchange?.disbursement_fee;
      const partnerFeeConfig = rateConfig.fiatExchange?.partner_fee;

      this.logger.log(
        `[PagaWebhookService] STEP 3 PASSED - Rate config found - id: ${rateConfig.id}, provider: ${rateConfig.provider}, disbursementFee: ${disbursementFeeConfig?.value}, isDisbursementFeePercentage: ${disbursementFeeConfig?.is_percentage}`,
        logContext,
      );

      // Step 4: Calculate USD amount in main unit
      this.logger.log(
        `[PagaWebhookService] STEP 4 - Calculating USD amount. Parent amount (smallest unit): ${parentTransaction.amount}, amountType: ${typeof parentTransaction.amount}`,
        logContext,
      );

      const usdAmountInMainUnit = CurrencyUtility.formatCurrencyAmountToMainUnit(
        parentTransaction.amount,
        SUPPORTED_CURRENCIES.USD.code,
      );

      this.logger.log(
        `[PagaWebhookService] STEP 4 COMPLETED - USD amount in main unit: ${usdAmountInMainUnit}, type: ${typeof usdAmountInMainUnit}`,
        logContext,
      );

      // Step 5: Calculate gross NGN amount
      const rateAsNumber = Number(exchangeRate.rate);
      this.logger.log(
        `[PagaWebhookService] STEP 5 - Calculating gross NGN. Rate: ${exchangeRate.rate} -> ${rateAsNumber}, rateType: ${typeof rateAsNumber}, usdAmount: ${usdAmountInMainUnit}`,
        logContext,
      );

      const grossNgnAmount = multiply(rateAsNumber, usdAmountInMainUnit);

      this.logger.log(
        `[PagaWebhookService] STEP 5 COMPLETED - Gross NGN amount: ${grossNgnAmount}, type: ${typeof grossNgnAmount}`,
        logContext,
      );

      // Step 6: Calculate partner fee in USD first, then convert to NGN
      const partnerFeeInUsd = partnerFeeConfig?.is_percentage
        ? multiply(usdAmountInMainUnit, divide(partnerFeeConfig?.value || 0, 100))
        : partnerFeeConfig?.value || 0;
      const partnerFee = multiply(partnerFeeInUsd, rateAsNumber);

      this.logger.log(
        `[PagaWebhookService] STEP 6 - Partner fee calculation. isPercentage: ${partnerFeeConfig?.is_percentage}, rawFee: ${partnerFeeConfig?.value}, feeInUsd: ${partnerFeeInUsd}, feeInNgn: ${partnerFee}`,
        logContext,
      );

      // Step 7: Calculate disbursement fee in USD first, then convert to NGN
      // Percentage takes priority, if not percentage the fee is already in USD
      let disbursementFeeInUsd: number;
      if (disbursementFeeConfig?.is_percentage) {
        disbursementFeeInUsd = multiply(usdAmountInMainUnit, divide(disbursementFeeConfig?.value || 0, 100));
        this.logger.log(
          `[PagaWebhookService] STEP 7 - Percentage fee calculation. Raw fee: ${disbursementFeeConfig?.value}, usdAmount: ${usdAmountInMainUnit}, feeInUsd: ${disbursementFeeInUsd}`,
          logContext,
        );
      } else {
        disbursementFeeInUsd = disbursementFeeConfig?.value || 0;
        this.logger.log(`[PagaWebhookService] STEP 7 - Fixed USD fee: ${disbursementFeeInUsd}`, logContext);
      }
      const disbursementFee = multiply(disbursementFeeInUsd, rateAsNumber);

      this.logger.log(
        `[PagaWebhookService] STEP 7 COMPLETED - Disbursement fee in NGN: ${disbursementFee}`,
        logContext,
      );

      // Step 8: Calculate final NGN amount
      const koboAmount = floor(Number(subtract(grossNgnAmount, add(disbursementFee, partnerFee))));

      this.logger.log(
        `[PagaWebhookService] STEP 8 - Final NGN calculation. grossNgnAmount: ${grossNgnAmount}, disbursementFee: ${disbursementFee}, partnerFee: ${partnerFee}, koboAmount: ${koboAmount}, ngnAmountType: ${typeof koboAmount}, isFinite: ${Number.isFinite(koboAmount)}`,
        logContext,
      );

      // Step 9: Validate Kobo amount
      if (!Number.isFinite(koboAmount) || koboAmount < 0) {
        this.logger.error(
          `[PagaWebhookService] STEP 9 FAILED - Invalid koboAmount: ${koboAmount}. Debug data: { grossNgnAmount: ${grossNgnAmount}, disbursementFee: ${disbursementFee}, partnerFee: ${partnerFee}, rate: ${exchangeRate.rate}, rateAsNumber: ${rateAsNumber}, usdAmountInMainUnit: ${usdAmountInMainUnit}, parentAmount: ${parentTransaction.amount} }`,
          logContext,
        );
        return;
      }

      this.logger.log(`[PagaWebhookService] STEP 9 PASSED - NGN amount validated: ${koboAmount}`, logContext);

      // Step 10: Fetch user's fiat wallet
      this.logger.log(
        `[PagaWebhookService] STEP 10 - Fetching NGN wallet for user: ${parentTransaction.user_id}`,
        logContext,
      );

      const fiatWallet = await this.fiatWalletService.getUserWallet(
        parentTransaction.user_id,
        SUPPORTED_CURRENCIES.NGN.code,
      );

      this.logger.log(
        `[PagaWebhookService] STEP 10 COMPLETED - Fiat wallet found - id: ${fiatWallet.id}, balance: ${fiatWallet.balance}, balanceType: ${typeof fiatWallet.balance}, asset: ${fiatWallet.asset}`,
        logContext,
      );

      // Step 11: Calculate balance before and after
      const balanceBefore = Number(fiatWallet.balance);
      const balanceAfter = Number(add(balanceBefore, koboAmount));

      this.logger.log(
        `[PagaWebhookService] STEP 11 - Balance calculation. walletBalance: ${fiatWallet.balance}, balanceBefore: ${balanceBefore}, ngnAmount: ${koboAmount}, balanceAfter: ${balanceAfter}, balanceBeforeType: ${typeof balanceBefore}, balanceAfterType: ${typeof balanceAfter}`,
        logContext,
      );

      // Step 12: Validate balance values
      if (!Number.isFinite(balanceBefore) || !Number.isFinite(balanceAfter)) {
        this.logger.error(
          `[PagaWebhookService] STEP 12 FAILED - Invalid balance values. balanceBefore: ${balanceBefore}, balanceAfter: ${balanceAfter}, walletBalance: ${fiatWallet.balance}, ngnAmount: ${koboAmount}`,
          logContext,
        );
        return;
      }

      this.logger.log(
        `[PagaWebhookService] STEP 12 PASSED - Balance values validated. balanceBefore: ${balanceBefore}, balanceAfter: ${balanceAfter}`,
        logContext,
      );

      let childTransaction: TransactionModel;

      // Step 13: Start database transaction
      this.logger.log(`[PagaWebhookService] STEP 13 - Starting database transaction`, logContext);

      await this.transactionRepository.transaction(async (trx) => {
        // Check if child transaction already exists using forUpdate lock to prevent duplicates
        const existingChildTransaction = (await this.transactionRepository
          .query(trx)
          .withGraphFetched('[fiatWalletTransaction]')
          .where({
            parent_transaction_id: parentTransaction.id,
            asset: SUPPORTED_CURRENCIES.NGN.code,
          })
          .forUpdate()
          .first()) as TransactionModel;

        if (existingChildTransaction) {
          this.logger.log(
            `[PagaWebhookService] Child transaction already exists: ${existingChildTransaction.id}, completing instead of creating`,
            logContext,
          );

          childTransaction = existingChildTransaction;

          // Complete the existing transaction if not already completed
          if (existingChildTransaction.status?.toLowerCase() !== TransactionStatus.COMPLETED.toLowerCase()) {
            // Update transaction amount with payload amount
            await this.transactionRepository.update(
              existingChildTransaction.id,
              {
                amount: payloadNgnAmountInSmallestUnit,
                balance_before: balanceBefore,
                balance_after: Number(add(balanceBefore, payloadNgnAmountInSmallestUnit)),
                metadata: {
                  ...existingChildTransaction.metadata,
                  old_amount: existingChildTransaction.amount,
                },
              },
              { trx },
            );

            // Get main account number for ledger deposit
            const mainAccountNumber = await this.virtualAccountRepository.findOne({
              user_id: parentTransaction.user_id,
              type: VirtualAccountType.MAIN_ACCOUNT,
            });

            if (mainAccountNumber) {
              await this.pagaLedgerAccountService.depositMoney(
                {
                  accountNumber: mainAccountNumber.account_number,
                  amount: payloadNgnAmountInSmallestUnit,
                  referenceNumber: payload.transactionReference,
                  fee: 0,
                  currency: SUPPORTED_CURRENCIES.NGN.code,
                  description: `Wallet top up of ${payload.amount} from ${payload.payerDetails.payerName}`,
                },
                trx,
              );
            }

            // Update user's NGN balance
            await this.fiatWalletService.updateBalance(
              fiatWallet.id,
              payloadNgnAmountInSmallestUnit,
              existingChildTransaction.id,
              FiatWalletTransactionType.EXCHANGE,
              TransactionStatus.COMPLETED,
              {},
              trx,
            );

            // Update the transaction status to COMPLETED
            await this.transactionService.updateStatus(
              existingChildTransaction.id,
              TransactionStatus.COMPLETED,
              undefined,
              trx,
              {
                shouldSendInAppNotification: true,
                shouldSendPushNotification: true,
                shouldSendEmail: true,
              },
            );

            // Update fiat wallet transaction status if exists
            if (existingChildTransaction.fiatWalletTransaction) {
              await this.fiatWalletTransactionService.updateStatus(
                existingChildTransaction.fiatWalletTransaction.id,
                TransactionStatus.COMPLETED,
                undefined,
                trx,
              );
            }
          }

          return;
        }

        // Step 13a: Create NGN transaction
        this.logger.log(
          `[PagaWebhookService] STEP 13a - Creating NGN transaction. userId: ${parentTransaction.user_id}, amount: ${koboAmount}, balanceBefore: ${balanceBefore}, balanceAfter: ${balanceAfter}, parentId: ${parentTransaction.id}`,
          logContext,
        );

        childTransaction = await this.transactionService.create(
          parentTransaction.user_id,
          {
            transaction_type: TransactionType.EXCHANGE,
            category: TransactionCategory.FIAT,
            transaction_scope: TransactionScope.INTERNAL,
            status: TransactionStatus.PROCESSING,
            amount: payloadNgnAmountInSmallestUnit,
            asset: SUPPORTED_CURRENCIES.NGN.code,
            balance_before: balanceBefore,
            balance_after: balanceAfter,
            reference: UtilsService.generateTransactionReference(),
            metadata: {
              rate: exchangeRate.rate,
              rate_id: exchangeRate.id,
              shared_blockchain_transaction_ref: parentTransaction.metadata?.shared_blockchain_transaction_ref,
              actual_amount: koboAmount,
              created_by_provider: 'paga',
            },
            parent_transaction_id: parentTransaction.id,
            description: `Exchanged USD to NGN`,
            external_reference: payload.transactionReference,
          },
          trx,
        );

        this.logger.log(
          `[PagaWebhookService] STEP 13a COMPLETED - Child transaction created - id: ${childTransaction.id}, reference: ${childTransaction.reference}`,
          logContext,
        );

        // Step 13b: Create fiat wallet transaction
        this.logger.log(
          `[PagaWebhookService] STEP 13b - Creating fiat wallet transaction. transactionId: ${childTransaction.id}, walletId: ${fiatWallet.id}, amount: ${koboAmount}`,
          logContext,
        );

        const fiatWalletTransaction = await this.fiatWalletTransactionService.create(
          parentTransaction.user_id,
          {
            transaction_id: childTransaction.id,
            amount: payloadNgnAmountInSmallestUnit,
            currency: SUPPORTED_CURRENCIES.NGN.code,
            status: TransactionStatus.PROCESSING,
            fiat_wallet_id: fiatWallet.id,
            transaction_type: FiatWalletTransactionType.EXCHANGE,
            provider_reference: payload.transactionReference,
            balance_before: balanceBefore,
            balance_after: balanceAfter,
            provider_metadata: {
              source_currency: SUPPORTED_CURRENCIES.USD.code,
            },
            source: `USD Wallet`,
            destination: `NGN Wallet`,
            description: `OnRamp USD to NGN`,
            provider: this.exchangeAdapter.getProviderName(),
          },
          trx,
        );

        this.logger.log(
          `[PagaWebhookService] STEP 13b COMPLETED - Fiat wallet transaction created - id: ${fiatWalletTransaction.id}`,
          logContext,
        );

        // Step 13c: Fetch main account number
        this.logger.log(
          `[PagaWebhookService] STEP 13c - Fetching main account number for user: ${parentTransaction.user_id}`,
          logContext,
        );

        const mainAccountNumber = await this.virtualAccountRepository.findOne({
          user_id: parentTransaction.user_id,
          type: VirtualAccountType.MAIN_ACCOUNT,
        });

        if (!mainAccountNumber) {
          this.logger.warn(
            `[PagaWebhookService] STEP 13c FAILED - Main account number not found for user: ${parentTransaction.user_id}`,
            logContext,
          );
          return;
        }

        this.logger.log(
          `[PagaWebhookService] STEP 13c COMPLETED - Main account found - accountNumber: ${mainAccountNumber.account_number}`,
          logContext,
        );

        // Step 13d: Deposit money to ledger
        this.logger.log(
          `[PagaWebhookService] STEP 13d - Depositing to ledger. accountNumber: ${mainAccountNumber.account_number}, amount: ${koboAmount}, reference: ${payload.transactionReference}`,
          logContext,
        );

        await this.pagaLedgerAccountService.depositMoney(
          {
            accountNumber: mainAccountNumber.account_number,
            amount: payloadNgnAmountInSmallestUnit,
            referenceNumber: payload.transactionReference,
            fee: 0,
            currency: SUPPORTED_CURRENCIES.NGN.code,
            description: `Wallet top up of ${payload.amount} from ${payload.payerDetails.payerName}`,
          },
          trx,
        );

        this.logger.log(`[PagaWebhookService] STEP 13d COMPLETED - Ledger deposit successful`, logContext);

        // Step 13e: Update user's NGN balance
        this.logger.log(
          `[PagaWebhookService] STEP 13e - Updating fiat wallet balance. walletId: ${fiatWallet.id}, amount: ${koboAmount}, transactionId: ${childTransaction.id}`,
          logContext,
        );

        await this.fiatWalletService.updateBalance(
          fiatWallet.id,
          payloadNgnAmountInSmallestUnit,
          childTransaction.id,
          FiatWalletTransactionType.EXCHANGE,
          TransactionStatus.COMPLETED,
          {},
          trx,
        );

        this.logger.log(`[PagaWebhookService] STEP 13e COMPLETED - Wallet balance updated`, logContext);

        // Step 13f: Update transaction status to completed
        this.logger.log(
          `[PagaWebhookService] STEP 13f - Updating transaction status to COMPLETED. transactionId: ${childTransaction.id}`,
          logContext,
        );

        await this.transactionService.updateStatus(childTransaction.id, TransactionStatus.COMPLETED, undefined, trx, {
          shouldSendInAppNotification: true,
          shouldSendPushNotification: true,
          shouldSendEmail: true,
        });

        this.logger.log(`[PagaWebhookService] STEP 13f COMPLETED - Transaction status updated`, logContext);

        // Step 13g: Update fiat wallet transaction status
        this.logger.log(
          `[PagaWebhookService] STEP 13g - Updating fiat wallet transaction status to COMPLETED. fiatWalletTransactionId: ${fiatWalletTransaction.id}`,
          logContext,
        );

        await this.fiatWalletTransactionService.updateStatus(
          fiatWalletTransaction.id,
          TransactionStatus.COMPLETED,
          undefined,
          trx,
        );

        this.logger.log(`[PagaWebhookService] STEP 13g COMPLETED - Fiat wallet transaction status updated`, logContext);
      });

      this.logger.log(
        `[PagaWebhookService] SUCCESS - Exchange transaction completed. childTransactionId: ${childTransaction?.id}, parentTransactionId: ${parentTransaction.id}, ngnAmount: ${koboAmount}, usdAmount: ${usdAmountInMainUnit}, rate: ${exchangeRate.rate}`,
        logContext,
      );

      // Send currency conversion success email
      await this.sendCurrencyConversionEmail({
        userId: parentTransaction.user_id,
        fromCurrency: SUPPORTED_CURRENCIES.USD.code,
        toCurrency: SUPPORTED_CURRENCIES.NGN.code,
        fromAmountInSmallestUnit: parentTransaction.amount,
        toAmountInSmallestUnit: payloadNgnAmountInSmallestUnit,
        exchangeRate: Number(exchangeRate.rate),
        transactionId: childTransaction?.id,
        transactionDate: new Date(),
        orderNumber: childTransaction?.external_reference,
      });
    } catch (error) {
      this.logger.error(
        `[PagaWebhookService] EXCEPTION - createCompletedExchangeTransaction failed. parentTransactionId: ${parentTransaction.id}, error: ${error.message}, stack: ${error.stack}`,
        logContext,
      );
      throw error;
    }
  }

  private async handleSuccessfulTransaction(
    payload: PagaPersistentAccountWebhookPayload,
    transaction: TransactionModel,
    fiatWalletTransaction: FiatWalletTransactionModel,
  ) {
    const amount = CurrencyUtility.formatCurrencyAmountToSmallestUnit(
      Number(payload.amount),
      SUPPORTED_CURRENCIES.NGN.code,
    );

    await this.transactionRepository.transaction(async (trx) => {
      // we will deposit the money to the user's paga ledger account.
      await this.pagaLedgerAccountService.depositMoney(
        {
          accountNumber: payload.accountNumber,
          amount: amount,
          referenceNumber: payload.transactionReference,
          fee: 0,
          currency: SUPPORTED_CURRENCIES.NGN.code,
          description: `Wallet top up of ${payload.amount} from ${payload.payerDetails.payerName}`,
        },
        trx,
      );

      // update the user's balance
      await this.fiatWalletService.updateBalance(
        fiatWalletTransaction.fiat_wallet_id,
        amount,
        transaction.id,
        FiatWalletTransactionType.DEPOSIT,
        TransactionStatus.COMPLETED,
        {
          description: `Wallet top up of ${payload.amount} from ${payload.payerDetails.payerName}`,
          source: payload.payerDetails.payerName,
          destination: payload.accountNumber,
          fiat_wallet_transaction_id: fiatWalletTransaction.id,
        },
        trx,
      );

      await this.updateFiatWalletTransactionAndTransaction(
        transaction.id,
        fiatWalletTransaction.id,
        TransactionStatus.COMPLETED,
        trx,
      );
    });

    await this.updateTransactionBalanceAfter(amount, transaction);

    await this.sendDepositSuccessfulPushNotification(transaction.user_id, amount, transaction.transaction_type);

    await this.sendDepositSuccessfulEmail(transaction.user_id, amount, transaction);
  }

  private async updateTransactionBalanceAfter(amount: number, transaction: TransactionModel) {
    const balanceAfter = Number(transaction.balance_before) + Number(amount);
    await this.transactionRepository.update(transaction.id, { balance_after: balanceAfter });
  }

  private async getVirtualAccount(accountNumber: string) {
    const virtualAccount = await this.virtualAccountRepository.findOne({ account_number: accountNumber }, undefined, {
      graphFetch: 'user',
    });

    return virtualAccount;
  }

  private async sendDepositSuccessfulEmail(userId: string, amount: number, transaction: TransactionModel) {
    const user = await this.userService.findByUserId(userId);

    if (transaction.transaction_type?.toLowerCase() === TransactionType.EXCHANGE.toLowerCase()) {
      // get the parent transaction
      const parentTransaction = await this.transactionRepository.findOne({ id: transaction.parent_transaction_id });

      // get the sender
      const sender = await this.userService.findByUserId(parentTransaction.user_id);
      const senderName =
        sender?.first_name && sender?.last_name ? `${sender.first_name} ${sender.last_name}` : sender?.username;

      // get the transaction code for the local and foreign currencies
      const localCurrency =
        transaction.metadata?.to_currency || transaction.metadata?.local_currency || SUPPORTED_CURRENCIES.NGN.code;
      const foreignCurrency =
        parentTransaction.metadata?.from_currency ||
        parentTransaction.metadata?.source_currency ||
        SUPPORTED_CURRENCIES.USD.code;

      // CALCULATING THE AMOUNT FOR THE LOCAL CURRENCY
      const mainAmount = CurrencyUtility.formatCurrencyAmountToMainUnit(amount, localCurrency);
      const formattedAmount = CurrencyUtility.formatCurrencyAmountToLocaleString(mainAmount, localCurrency);

      const fee = transaction.metadata?.fee || 0;

      // CALCULATING THE AMOUNT FOR THE FOREIGN CURRENCY
      const foreignAmount = CurrencyUtility.formatCurrencyAmountToMainUnit(
        Number(parentTransaction?.amount),
        foreignCurrency,
      );
      const foreignFormattedAmount = CurrencyUtility.formatCurrencyAmountToLocaleString(foreignAmount, foreignCurrency);

      const foreignFee = CurrencyUtility.formatCurrencyAmountToMainUnit(fee, foreignCurrency);
      const foreignFormattedFee = CurrencyUtility.formatCurrencyAmountToLocaleString(foreignFee, foreignCurrency);

      const foreignTotalAmount = Number(foreignAmount) + Number(foreignFee);
      const formattedTotalAmount = CurrencyUtility.formatCurrencyAmountToLocaleString(
        foreignTotalAmount,
        foreignCurrency,
      );

      const exchangeRate = CurrencyUtility.formatCurrencyAmountToMainUnit(transaction.metadata?.rate, localCurrency);
      const formattedExchangeRate = CurrencyUtility.formatCurrencyAmountToLocaleString(exchangeRate, localCurrency);

      await this.mailerService.send(
        new WalletExchangeSuccessMail(user, {
          fromCurrency: foreignCurrency,
          toCurrency: localCurrency,
          formattedAmount: foreignFormattedAmount,
          formattedLocalAmount: formattedAmount,
          transactionId: transaction.id,
          transactionDate: DateTime.fromJSDate(new Date(transaction.created_at)).toLocaleString(DATE_TIME_FORMAT),
          description: transaction.description,
          accountId: parentTransaction.metadata?.participant_code,
          orderNumber: parentTransaction.metadata?.source_withdrawal_request_ref,
          walletAddress: parentTransaction.metadata?.destination_wallet_address,
          senderName,
          recipientName: user.first_name && user.last_name ? `${user.first_name} ${user.last_name}` : user.username,
          recipientLocation: user.country?.name,
          exchangeRate: formattedExchangeRate,
          formattedFee: foreignFormattedFee,
          formattedTotal: formattedTotalAmount,
          availableDate: DateTime.fromJSDate(new Date(transaction.created_at)).toLocaleString(DateTime.DATE_FULL),
        }),
      );
    } else {
      const transactionDate = transaction.created_at
        ? new Date(transaction.created_at).toISOString()
        : new Date().toISOString();
      await this.mailerService.send(
        new NgDepositMail(
          user,
          transaction.id,
          amount,
          transaction.description,
          transaction.metadata?.sender_bank,
          transactionDate,
        ),
      );
    }
  }

  private async sendDepositSuccessfulPushNotification(
    userId: string,
    amount: number,
    transactionType: TransactionType,
  ) {
    Logger.log(
      'Sending deposit successful push notification',
      'PagaWebhookService.sendDepositSuccessfulPushNotification',
    );

    const userProfile = await this.userProfileService.findByUserId(userId);

    const mainAmount = CurrencyUtility.formatCurrencyAmountToMainUnit(amount, SUPPORTED_CURRENCIES.NGN.code);
    const formattedAmount = CurrencyUtility.formatCurrencyAmountToLocaleString(
      mainAmount,
      SUPPORTED_CURRENCIES.NGN.code,
    );

    // Get push notification config using dynamic method
    const pushConfig = this.pushNotificationService.getTransactionPushNotificationConfig(
      transactionType,
      formattedAmount,
      SUPPORTED_CURRENCIES.NGN.code,
    );

    if (userProfile.notification_token) {
      await this.pushNotificationService.sendPushNotification([userProfile.notification_token], {
        title: pushConfig.title,
        body: pushConfig.body,
      });
    }

    Logger.log(
      `[PagaWebhookService] Sent deposit successful push notification to user ${userId}`,
      'PagaWebhookService.sendDepositSuccessfulPushNotification',
    );
  }

  private async createTransactionAndFiatWalletTransaction(
    userId: string,
    payload: PagaPersistentAccountWebhookPayload,
    fiatWallet: FiatWalletModel,
  ) {
    const amountInKobo = CurrencyUtility.formatCurrencyAmountToSmallestUnit(
      Number(payload.amount),
      SUPPORTED_CURRENCIES.NGN.code,
    );
    const fee = CurrencyUtility.formatCurrencyAmountToSmallestUnit(
      Number(payload.clearingFeeAmount),
      SUPPORTED_CURRENCIES.NGN.code,
    );

    const balanceBefore = Number(fiatWallet.balance);
    const balanceAfter = Number(fiatWallet.balance) + Number(amountInKobo);

    this.logger.log(
      `[PagaWebhookService] Creating transaction and fiat wallet transaction for user ${userId} with amount ${amountInKobo} and fee ${fee} and balance before ${balanceBefore} and balance after ${balanceAfter}`,
      'PagaWebhookService.createTransactionAndFiatWalletTransaction',
    );

    this.logger.log(
      JSON.stringify({
        reference: payload.transactionReference,
        external_reference: payload.transactionReference,
        asset: SUPPORTED_CURRENCIES.NGN.code,
        amountInKobo,
        balance_before: balanceBefore,
        balance_after: balanceAfter,
      }),
      'PagaWebhookService.createTransactionAndFiatWalletTransaction',
    );

    const transaction = await this.transactionService.create(userId, {
      reference: payload.transactionReference,
      external_reference: payload.transactionReference,
      asset: SUPPORTED_CURRENCIES.NGN.code,
      amount: amountInKobo,
      balance_before: balanceBefore,
      balance_after: balanceAfter,
      transaction_type: TransactionType.DEPOSIT,
      category: TransactionCategory.FIAT,
      transaction_scope: TransactionScope.EXTERNAL,
      status: TransactionStatus.PENDING,
      description: `Wallet top up of ${payload.amount} from ${payload.payerDetails.payerName}`,
      metadata: {
        source: payload.payerDetails.payerName,
        destination: payload.accountNumber,
        sender_name: payload.payerDetails.payerName,
        sender_account_number: payload.payerDetails.payerBankAccountNumber,
        sender_bank: payload.payerDetails.payerBankName,
      },
    });

    const fiatWalletTransaction = await this.fiatWalletTransactionService.create(userId, {
      transaction_id: transaction.id,
      status: TransactionStatus.PENDING,
      amount: amountInKobo,
      balance_before: balanceBefore,
      balance_after: balanceAfter,
      transaction_type: FiatWalletTransactionType.DEPOSIT,
      description: `Wallet top up of ${payload.amount} from ${payload.payerDetails.payerName}`,
      currency: SUPPORTED_CURRENCIES.NGN.code,
      provider: this.waasAdapter.getProviderName(),
      provider_reference: payload.transactionReference,
      source: payload.payerDetails.payerName,
      destination: payload.accountNumber,
      processed_at: DateTime.now().toSQL(),
      provider_metadata: {
        source: payload.payerDetails.payerName,
        destination: payload.accountNumber,
        sender_name: payload.payerDetails.payerName,
        sender_account_number: payload.payerDetails.payerBankAccountNumber,
        sender_bank: payload.payerDetails.payerBankName,
      },
      fiat_wallet_id: fiatWallet.id,
      provider_fee: Number(fee),
    });

    return { transaction, fiatWalletTransaction };
  }

  private async updateFiatWalletTransactionAndTransaction(
    transactionId: string,
    fiatWalletTransactionId: string,
    status: TransactionStatus,
    trx?: Transaction,
  ) {
    if (trx) {
      await this.transactionService.updateStatus(transactionId, status, {}, trx, {
        shouldSendEmail: false,
        shouldSendPushNotification: false,
        shouldSendInAppNotification: true,
      });
      await this.fiatWalletTransactionService.updateStatus(fiatWalletTransactionId, status, {}, trx);
      return;
    }

    await this.transactionRepository.transaction(async (trx) => {
      await this.transactionService.updateStatus(transactionId, status, {}, trx, {
        shouldSendEmail: false,
        shouldSendPushNotification: false,
        shouldSendInAppNotification: true,
      });
      await this.fiatWalletTransactionService.updateStatus(fiatWalletTransactionId, status, {}, trx);
    });
  }

  private transformToTransactionStatus(status: string): PagaWebhookTransactionStatusEnum {
    if (status?.toLowerCase() === PagaWebhookTransactionStatusEnum.SUCCESS.toLowerCase()) {
      return PagaWebhookTransactionStatusEnum.SUCCESS;
    }

    if (status?.toLowerCase() === PagaWebhookTransactionStatusEnum.FAILED.toLowerCase()) {
      return PagaWebhookTransactionStatusEnum.FAILED;
    }

    return PagaWebhookTransactionStatusEnum.PENDING;
  }

  /**
   * Send currency conversion success email notification
   */
  private async sendCurrencyConversionEmail(params: SendCurrencyConversionEmailParams) {
    const {
      userId,
      fromCurrency,
      toCurrency,
      fromAmountInSmallestUnit,
      toAmountInSmallestUnit,
      exchangeRate,
      transactionId,
      transactionDate,
      orderNumber,
      feeInSmallestUnit,
    } = params;

    const user = await this.userService.findByUserId(userId);
    if (!user?.email) {
      this.logger.warn(
        `[PagaWebhookService] Cannot send conversion email - user ${userId} has no email`,
        'PagaWebhookService.sendCurrencyConversionEmail',
      );
      return;
    }

    // Fetch external account to get participant_code
    const externalAccounts = await this.externalAccountRepository.findByUserId(userId);
    const externalAccount = externalAccounts.find((account) => account.participant_code && account.provider);

    // Convert amounts to main units for display
    const fromAmountMain = CurrencyUtility.formatCurrencyAmountToMainUnit(fromAmountInSmallestUnit, fromCurrency);
    const toAmountMain = CurrencyUtility.formatCurrencyAmountToMainUnit(toAmountInSmallestUnit, toCurrency);

    // Format amounts with currency symbols
    const formattedAmount = CurrencyUtility.formatCurrencyAmountToLocaleString(fromAmountMain, fromCurrency);
    const formattedLocalAmount = CurrencyUtility.formatCurrencyAmountToLocaleString(toAmountMain, toCurrency);

    // Format exchange rate (e.g., "$1 ~ ₦1,580.00")
    const exchangeRateInMainUnit = CurrencyUtility.formatCurrencyAmountToMainUnit(exchangeRate, toCurrency);
    const formattedExchangeRate = CurrencyUtility.formatCurrencyAmountToLocaleString(
      exchangeRateInMainUnit,
      toCurrency,
    );

    // Format fee (default to $0 if not provided)
    const feeMain =
      feeInSmallestUnit && feeInSmallestUnit > 0
        ? CurrencyUtility.formatCurrencyAmountToMainUnit(feeInSmallestUnit, fromCurrency)
        : 0;
    const formattedFee = CurrencyUtility.formatCurrencyAmountToLocaleString(feeMain, fromCurrency);

    // Calculate total (amount + fee) using mathjs for precision
    const totalMain = Number(add(fromAmountMain, feeMain));
    const formattedTotal = CurrencyUtility.formatCurrencyAmountToLocaleString(totalMain, fromCurrency);

    // Format transaction date
    const formattedDate = DateTime.fromJSDate(transactionDate).toLocaleString(DATE_TIME_FORMAT);

    const conversionData: CurrencyConversionSuccessData = {
      fromCurrency,
      toCurrency,
      formattedAmount,
      formattedLocalAmount,
      exchangeRate: `$1 ~ ${formattedExchangeRate}`,
      transactionId,
      transactionDate: formattedDate,
      accountId: externalAccount?.participant_code,
      orderNumber,
      formattedFee,
      formattedTotal,
      senderName: `${user.first_name} ${user.last_name}`.trim() || user.username,
      recipientName: `${user.first_name} ${user.last_name}`.trim() || user.username,
      recipientLocation: toCurrency === 'NGN' ? 'Nigeria' : 'United States',
    };

    await this.mailerService.send(new CurrencyConversionSuccessMail(user, conversionData));

    this.logger.log(
      `[PagaWebhookService] Sent currency conversion email to user ${userId}`,
      'PagaWebhookService.sendCurrencyConversionEmail',
    );
  }
}
