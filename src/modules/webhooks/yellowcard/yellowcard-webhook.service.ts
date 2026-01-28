import { BadRequestException, forwardRef, Inject, Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import { add, divide, multiply, subtract } from 'mathjs';
import { createHmac } from 'node:crypto';
import { Transaction } from 'objection';
import { ITransferResponse } from '../../../adapters/blockchain-waas/blockchain-waas-adapter.interface';
import { FireblocksAdapter } from '../../../adapters/blockchain-waas/fireblocks/fireblocks_adapter';
import { ExchangeAdapter } from '../../../adapters/exchange/exchange.adapter';
import { ExchangePayInRequest, ExchangePayOutRequest } from '../../../adapters/exchange/exchange.interface';
import {
  YellowCardPaymentWebhookPayload,
  YellowCardWebhookCollectionPayload,
  YellowCardWebhookEventCategory,
  YellowCardWebhookEvents,
  YellowCardWebhookPayload,
  YellowCardWebhookProcessResponse,
  YellowCardWebhookSettlementPayload,
} from '../../../adapters/exchange/yellowcard/yellowcard.interface';
import { EnvironmentService } from '../../../config';
import { YellowCardConfigProvider } from '../../../config/yellowcard.config';
import { FAKE_ACCOUNT_NUMBER, FIREBLOCKS_ASSET_ID, FIREBLOCKS_VAULT_ID } from '../../../constants/constants';
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
} from '../../../database';
import { UserModel } from '../../../database/models/user';
import { VirtualAccountType } from '../../../database/models/virtualAccount';
import { LockerService } from '../../../services/locker/locker.service';
import { ExecuteNewNgUsdExchangeProcessor } from '../../../services/queue/processors/exchange/execute-new-ng-usd-exchange.processor';
import { UtilsService } from '../../../utils/utils.service';
import { UserService } from '../../auth/user/user.service';
import { NewNgToUsdExchangeService } from '../../exchange/fiat-exchange/ng-to-usd-exchange.service/new-ng-to-usd-exchange.service';
import { FiatWalletService } from '../../fiatWallet';
import { FiatWalletRepository } from '../../fiatWallet/fiatWallet.repository';
import { FiatWalletEscrowService } from '../../fiatWallet/fiatWalletEscrow.service';
import { FiatWalletTransactionRepository } from '../../fiatWalletTransactions/fiatWalletTransactions.repository';
import { FiatWalletTransactionService } from '../../fiatWalletTransactions/fiatWalletTransactions.service';
import { PagaLedgerAccountService } from '../../pagaLedgerAccount/pagaLedgerAccount.service';
import { RateRepository } from '../../rate/rate.repository';
import { RateConfigRepository } from '../../rateConfig/rateConfig.repository';
import { TransactionRepository } from '../../transaction/transaction.repository';
import { TransactionService } from '../../transaction/transaction.service';
import { VirtualAccountService } from '../../virtualAccount';
import { ZeroHashAccountBalanceChangedPayload } from '../zerohash/zerohash-webhook.interface';
import { ZerohashWebhookService } from '../zerohash/zerohash-webhook.service';

@Injectable()
export class YellowCardWebhookService {
  @Inject(TransactionService)
  private readonly transactionService: TransactionService;

  @Inject(FiatWalletTransactionService)
  private readonly fiatWalletTransactionService: FiatWalletTransactionService;

  @Inject(FiatWalletTransactionRepository)
  private readonly fiatWalletTransactionRepository: FiatWalletTransactionRepository;

  @Inject(TransactionRepository)
  private readonly transactionRepository: TransactionRepository;

  @Inject(ExchangeAdapter)
  private readonly exchangeAdapter: ExchangeAdapter;

  @Inject(VirtualAccountService)
  private readonly virtualAccountService: VirtualAccountService;

  @Inject(PagaLedgerAccountService)
  private readonly pagaLedgerAccountService: PagaLedgerAccountService;

  @Inject(FiatWalletRepository)
  private readonly fiatWalletRepository: FiatWalletRepository;

  @Inject(FiatWalletService)
  private readonly fiatWalletService: FiatWalletService;

  @Inject(RateRepository)
  private readonly rateRepository: RateRepository;

  @Inject(UserService)
  private readonly userService: UserService;

  @Inject(FireblocksAdapter)
  private readonly fireblocksAdapter: FireblocksAdapter;

  @Inject(RateConfigRepository)
  private readonly rateConfigRepository: RateConfigRepository;

  @Inject(ExecuteNewNgUsdExchangeProcessor)
  private readonly executeNewNgUsdExchangeProcessor: ExecuteNewNgUsdExchangeProcessor;

  @Inject(NewNgToUsdExchangeService)
  private readonly newNgToUsdExchangeService: NewNgToUsdExchangeService;

  @Inject(LockerService)
  private readonly lockerService: LockerService;

  @Inject(FiatWalletEscrowService)
  private readonly fiatWalletEscrowService: FiatWalletEscrowService;

  @Inject(forwardRef(() => ZerohashWebhookService))
  private readonly zerohashWebhookService: ZerohashWebhookService;

  private readonly logger = new Logger(YellowCardWebhookService.name);

  /**
   * Extracts the event category from the webhook event string
   */
  private getEventCategory(event: string): YellowCardWebhookEventCategory | null {
    const category = event?.toLowerCase().split('.')[0];
    const validCategories = Object.values(YellowCardWebhookEventCategory);

    return validCategories.includes(category as YellowCardWebhookEventCategory)
      ? (category as YellowCardWebhookEventCategory)
      : null;
  }

  async processWebhook(payload: YellowCardWebhookPayload): Promise<YellowCardWebhookProcessResponse> {
    this.logger.log(`Yellowcard webhook received: ${payload.event}`);
    this.logger.debug('Payload:\n' + JSON.stringify(payload, null, 2));

    const eventCategory = this.getEventCategory(payload.event);

    switch (eventCategory) {
      case YellowCardWebhookEventCategory.SETTLEMENT:
        await this.handleSettlement(payload as YellowCardWebhookSettlementPayload);
        return { success: true, message: 'Acknowledged' };

      case YellowCardWebhookEventCategory.PAYMENT:
        await this.handleExchangeWebhook(payload as YellowCardPaymentWebhookPayload);
        return { success: true, message: 'Acknowledged' };

      case YellowCardWebhookEventCategory.COLLECTION:
        await this.handleCollectionWebhook(payload as YellowCardWebhookCollectionPayload);
        return { success: true, message: 'Acknowledged' };

      default:
        this.logger.warn(`Unhandled webhook event category: ${payload.event}`);
        this.logger.debug('Payload:\n' + JSON.stringify(payload, null, 2));
        return { success: true, message: 'Acknowledged' };
    }
  }

  private async handleSettlement(payload: YellowCardWebhookSettlementPayload): Promise<void> {
    this.logger.log('Settlement webhook received');
    // check if the settlement type is topup
    const settlementType = payload.type;
    const event = payload.event;
    const isSuccessfulSettlement = event?.toLowerCase() === YellowCardWebhookEvents.SETTLEMENT_COMPLETE?.toLowerCase();

    if (settlementType?.toLowerCase() === 'topup') {
      //  check if the settlement is successful
      if (isSuccessfulSettlement) {
        return await this.handleSuccessfulSettlementTopUp(payload);
      }
    }
  }

  private async handleSuccessfulSettlementTopUp(payload: YellowCardWebhookSettlementPayload): Promise<void> {
    this.logger.log('Handling successful topup event');
    const transactionHash = payload.transactionHash;

    //  check if the transaction hash is already in the database
    const transaction = await this.transactionService.findOne({
      external_reference: transactionHash,
    });

    if (!transaction) {
      // if no transaction, then it's an external topup
      return await this.handleExternalTopUp(payload);
    }

    //  if the transaction is found, then it's an wallet withdrawal
    await this.handleWalletWithdrawal(payload, transaction);
  }

  private async handleExternalTopUp(payload: YellowCardWebhookSettlementPayload): Promise<void> {
    this.logger.log('Handling external topup', payload.transactionHash);
    //  get the transaction hash from the payload
  }

  /**
   * Updates existing incoming transaction created by ZeroHash webhook.
   * This method no longer creates new transactions - that responsibility has been moved
   * to ZeroHash webhook service (processWithdrawalPending).
   */
  private async updateIncomingTransaction(
    payload: YellowCardPaymentWebhookPayload,
    parentTransaction: TransactionModel,
  ): Promise<void> {
    try {
      this.logger.log('Updating incoming transaction', payload.sequenceId);

      // Retry finding the child transaction with delays
      // This handles cases where ZeroHash hasn't created the child transaction yet
      // Using longer retries in production to account for ZeroHash's processing time before lock acquisition
      const maxRetries = EnvironmentService.isProduction() ? 30 : 1;
      const retryDelayMs = EnvironmentService.isProduction() ? 4000 : 100;
      let childTransaction: TransactionModel | null = null;

      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        childTransaction = await this.transactionRepository.findOne(
          { parent_transaction_id: parentTransaction.id },
          {},
          { graphFetch: '[fiatWalletTransaction]' },
        );

        if (childTransaction) {
          break;
        }

        if (attempt < maxRetries) {
          this.logger.log(
            `Child transaction not found, retrying in ${retryDelayMs}ms (attempt ${attempt}/${maxRetries})`,
            { parentTransactionId: parentTransaction.id },
          );
          await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
        }
      }

      if (!childTransaction) {
        this.logger.warn(
          `No child transaction found for parent_transaction_id: ${parentTransaction.id}, sequenceId: ${payload.sequenceId} after ${maxRetries} attempts`,
        );
        return;
      }

      // Skip if already completed
      if (childTransaction.status?.toLowerCase() === TransactionStatus.COMPLETED.toLowerCase()) {
        this.logger.debug('Child transaction is already completed, skipping update', {
          transactionId: childTransaction.id,
        });
        return;
      }

      this.logger.log('Found child transaction to update', {
        transactionId: childTransaction.id,
        currentStatus: childTransaction.status,
      });

      // Update the transaction status to processing if not already
      await this.transactionService.updateStatus(childTransaction.id, TransactionStatus.PROCESSING, {});

      if (childTransaction.fiatWalletTransaction) {
        await this.fiatWalletTransactionService.updateStatus(
          childTransaction.fiatWalletTransaction.id,
          TransactionStatus.PROCESSING,
          {},
        );
      }

      this.logger.log('Updated incoming transaction to PROCESSING', { transactionId: childTransaction.id });

      // Mock Paga top-up in non-production environments
      if (!EnvironmentService.isProduction()) {
        try {
          // Use the parent transaction ID to find the correct exchange account
          const virtualAccount = await this.virtualAccountService.findOrCreateVirtualAccount(
            parentTransaction.user_id,
            { transaction_id: parentTransaction.id },
            VirtualAccountType.EXCHANGE_ACCOUNT,
          );

          this.logger.log('Transferring money to NGN wallet via Paga mock', {
            virtualAccount: virtualAccount.account_number,
            ngnAmount: childTransaction.amount,
            reference: childTransaction.reference,
          });

          await this.pagaLedgerAccountService.topUp({
            account_number: virtualAccount.account_number,
            amount: CurrencyUtility.formatCurrencyAmountToMainUnit(
              childTransaction.amount,
              SUPPORTED_CURRENCIES.NGN.code,
            ),
            source_account_number: FAKE_ACCOUNT_NUMBER,
            reference_number: childTransaction.reference,
            source_account_name: 'USDC Wallet',
            description: `OnRamp USD to NGN`,
          });
        } catch (error) {
          this.logger.error('Error transferring to NGN wallet via Paga mock', error);
        }
      }
    } catch (error) {
      this.logger.error('Error updating incoming transaction', error);
      throw new BadRequestException(error.message);
    }
  }

  private async handleWalletWithdrawal(
    payload: YellowCardWebhookSettlementPayload,
    transaction: TransactionModel,
  ): Promise<void> {
    this.logger.log('Handling wallet withdrawal', payload.transactionHash);

    // get the transaction_id  and also the parent transaction
    const parentTransactionId = transaction.id;
    const childTransaction = await this.getTransactionByParentTransactionIdOrThrow(parentTransactionId);

    const isTransactionCompleted = transaction?.status?.toLowerCase() === TransactionStatus.COMPLETED?.toLowerCase();
    const isChildTransactionProcessing =
      childTransaction?.status?.toLowerCase() === TransactionStatus.PROCESSING?.toLowerCase();

    if (isTransactionCompleted && isChildTransactionProcessing) {
      this.logger.debug('This Transaction is processing Already', { transactionId: transaction.id });
      throw new BadRequestException('This Transaction is processing Already');
    }

    // get the NGN fiat wallet transaction
    const localFiatWalletTransaction = await this.getFiatWalletTransactionByTransactionIdOrThrow(childTransaction.id);

    await this.updateTransactionAndFiatWalletTransactionStatusOrThrow(childTransaction.id, TransactionStatus.PENDING);

    const virtualAccount = await this.virtualAccountService.findOneByUserIdOrThrow(transaction.user_id);

    await this.pagaLedgerAccountService.topUp({
      account_number: virtualAccount.account_number,
      amount: CurrencyUtility.formatCurrencyAmountToMainUnit(
        localFiatWalletTransaction.amount,
        SUPPORTED_CURRENCIES.NGN.code,
      ),
      source_account_number: '0810130115',
      reference_number: localFiatWalletTransaction.provider_reference,
      source_account_name: 'Yellow Card Intl',
      description: `OnRamp USD to NGN`,
    });
  }

  private async updateTransactionAndFiatWalletTransactionStatusOrThrow(
    transaction_id: string,
    status: TransactionStatus,
    trx?: Transaction,
  ): Promise<void> {
    this.logger.debug(
      `Yellowcard webhook: updating transaction and fiat wallet transaction status to ${status} for transaction ${transaction_id}`,
    );
    const fiatWalletTransaction = await this.getFiatWalletTransactionByTransactionIdOrThrow(transaction_id);

    if (trx) {
      await this.transactionService.updateStatus(transaction_id, status, {}, trx, {
        shouldSendEmail: false,
        shouldSendPushNotification: false,
        shouldSendInAppNotification: false,
      });
      await this.fiatWalletTransactionService.updateStatus(fiatWalletTransaction.id, status, {}, trx);
      return;
    }
    await this.transactionRepository.transaction(async (trx) => {
      //  update the child transaction to pending
      await this.transactionService.updateStatus(transaction_id, status, {}, trx, {
        shouldSendEmail: false,
        shouldSendPushNotification: false,
        shouldSendInAppNotification: false,
      });
      //  update the local fiat wallet transaction to pending
      await this.fiatWalletTransactionService.updateStatus(fiatWalletTransaction.id, status, {}, trx);
    });
  }

  private async getTransactionByParentTransactionIdOrThrow(parentTransactionId: string): Promise<TransactionModel> {
    const childTransaction = await this.transactionService.findOne({ parent_transaction_id: parentTransactionId });

    if (!childTransaction) {
      this.logger.error('NGN transaction not found', { parentTransactionId });
      throw new BadRequestException('NGN transaction not found');
    }

    return childTransaction;
  }

  private async getFiatWalletTransactionByTransactionIdOrThrow(
    transactionId: string,
  ): Promise<FiatWalletTransactionModel> {
    const localFiatWalletTransaction = await this.fiatWalletTransactionService.findOne({
      transaction_id: transactionId,
    });

    if (!localFiatWalletTransaction) {
      this.logger.error('NGN fiat wallet transaction not found', { transactionId });
      throw new BadRequestException('NGN fiat wallet transaction not found');
    }

    return localFiatWalletTransaction;
  }

  private async getTransactionByReferenceOrThrow(reference: string): Promise<TransactionModel> {
    const transaction = await this.transactionService.findOne({ reference });

    if (!transaction) {
      this.logger.error('Transaction not found', { reference });
      throw new BadRequestException('Transaction not found');
    }

    return transaction;
  }

  private async getTransactionBySequenceRef(sequenceRef: string): Promise<TransactionModel> {
    const transaction = (await this.transactionRepository
      .query()
      .where({
        reference: sequenceRef,
      })
      .forUpdate()
      .first()) as TransactionModel;

    if (!transaction) {
      this.logger.error('Transaction not found', { sequenceRef });
      throw new BadRequestException('Transaction not found');
    }

    return transaction;
  }

  /**
   * Checks if the webhook event matches a specific event type (case-insensitive)
   */
  private isEventType(event: string, expectedEvent: string): boolean {
    if (!event || !expectedEvent) {
      return false;
    }
    return event.toLowerCase() === expectedEvent.toLowerCase();
  }

  private async handleExchangeWebhook(payload: YellowCardPaymentWebhookPayload): Promise<void> {
    try {
      this.logger.log(
        'Handling_payment_webhook',
        JSON.stringify(payload, null, 2),
        'YellowCardWebhookService.handleExchangeWebhook',
      );

      const yellowcardPayoutRequest = await this.getPaymentTransactionFromYellowCardBySequenceIdOrThrow(
        payload.sequenceId,
      );

      const event = payload.event;

      if (this.isEventType(event, YellowCardWebhookEvents.PAYMENT_CREATED)) {
        this.logger.log('Handling payment created event');
        await this.handlePaymentCreated(payload);
      }

      if (this.isEventType(event, YellowCardWebhookEvents.PAYMENT_PENDING)) {
        this.logger.log('Handling payment pending event');
      }

      if (this.isEventType(event, YellowCardWebhookEvents.PAYMENT_COMPLETE)) {
        this.logger.log('Handling payment complete event');
        await this.handlePaymentComplete(payload, yellowcardPayoutRequest);
      }

      if (this.isEventType(event, YellowCardWebhookEvents.PAYMENT_FAILED)) {
        await this.handlePaymentFailed(payload);
        this.logger.log('Handling payment failed event');
      }

      if (this.isEventType(event, YellowCardWebhookEvents.PAYMENT_CANCELLED)) {
        await this.handlePaymentCancelled(payload);
        this.logger.log('Handling payment cancelled event');
      }

      if (this.isEventType(event, YellowCardWebhookEvents.PAYMENT_PENDING_SETTLEMENT)) {
        await this.handlePaymentPendingSettlement(payload);
        this.logger.log('Handling payment pending settlement event');
      }

      if (this.isEventType(event, YellowCardWebhookEvents.PAYMENT_EXPIRED)) {
        await this.handlePaymentExpired(payload);
        this.logger.log('Handling payment expired event');
      }
    } catch (error) {
      this.logger.error('Error handling payment webhook', error);
      throw new BadRequestException('Error handling payment webhook');
    }
  }

  private async handlePaymentPendingSettlement(payload: YellowCardPaymentWebhookPayload): Promise<void> {
    this.logger.log('Handling payment pending settlement event');
    this.logger.debug('Payment pending settlement event payload:\n' + JSON.stringify(payload, null, 2));
  }

  private async getPaymentTransactionFromYellowCardBySequenceIdOrThrow(
    transactionRef: string,
  ): Promise<ExchangePayOutRequest> {
    const response = await this.exchangeAdapter.getPayOutRequestByTransactionRef(transactionRef);

    if (!response) {
      this.logger.error('Payment transaction not found', { transactionRef });
      throw new BadRequestException('Payment transaction not found');
    }

    return response;
  }

  private async handlePaymentExpired(payload: YellowCardPaymentWebhookPayload): Promise<void> {
    this.logger.log('Handling payment expired event', payload.id);
    //  update the transaction status to expired
    const transaction = await this.getTransactionByReferenceOrThrow(payload.sequenceId);
    await this.updateTransactionAndFiatWalletTransactionStatusOrThrow(transaction.id, TransactionStatus.FAILED);

    // Queue deletion of exchange virtual account on expiry
    await this.virtualAccountService.scheduleExchangeVirtualAccountDeletion(
      transaction.user_id,
      transaction.id,
      'Payment expired',
    );
  }

  private async handlePaymentCreated(payload: YellowCardPaymentWebhookPayload): Promise<void> {
    this.logger.log('Handling payment created event', payload.id);
  }

  private async handlePaymentComplete(
    payload: YellowCardPaymentWebhookPayload,
    yellowcardPayoutRequest: ExchangePayOutRequest,
  ): Promise<void> {
    this.logger.log('Handling payment complete event', payload.sequenceId, yellowcardPayoutRequest);
    this.logger.debug('Payment complete event payload:\n' + JSON.stringify(payload, null, 2));

    const parentTransaction = await this.getTransactionBySequenceRef(payload.sequenceId);

    await this.deductUserUSDCreditBalance(parentTransaction);

    // Use shared lock with ZeroHash and Paga webhooks to ensure sequential processing
    // This prevents race conditions where YellowCard webhook arrives before ZeroHash creates the child transaction
    const exchangeWebhookLockKey = `exchange_webhook_${parentTransaction.id}`;
    const exchangeWebhookLockOptions = { ttl: 240000, retryCount: 60, retryDelay: 4000 };

    try {
      await this.lockerService.runWithLock(
        exchangeWebhookLockKey,
        async () => {
          // Check if parent USD transaction is still in PROCESSING status
          // If so, call Zerohash API to check withdrawal status and complete if confirmed
          if (parentTransaction.status?.toLowerCase() !== TransactionStatus.COMPLETED.toLowerCase()) {
            this.logger.log(
              `[YellowCardWebhookService] Parent USD transaction ${parentTransaction.id} is not completed, checking Zerohash withdrawal status`,
            );

            const withdrawalCompleted = await this.zerohashWebhookService.checkAndCompleteUsdWithdrawal(
              parentTransaction.id,
              parentTransaction.user_id,
            );

            if (withdrawalCompleted) {
              this.logger.log(
                `[YellowCardWebhookService] USD withdrawal completed via inline check for parent transaction ${parentTransaction.id}`,
              );
            } else {
              this.logger.log(
                `[YellowCardWebhookService] USD withdrawal not yet confirmed, continuing with NGN processing for parent transaction ${parentTransaction.id}`,
              );
            }

            // Reconcile USD balance from provider after checking withdrawal status
            const reconcileResult = await this.fiatWalletService.reconcileUsdBalanceFromProvider(
              parentTransaction.user_id,
            );
            this.logger.log(
              `[YellowCardWebhookService] USD balance reconciliation result: ${JSON.stringify(reconcileResult)}`,
            );
          }

          // Update the incoming transaction (created by ZeroHash webhook)
          await this.updateIncomingTransaction(payload, parentTransaction);
        },
        exchangeWebhookLockOptions,
      );
    } catch (error) {
      this.logger.error('Error updating incoming transaction', error);
      throw new BadRequestException(error.message);
    }
  }

  private async deductUserUSDCreditBalance(parentTransaction: TransactionModel): Promise<void> {
    try {
      const fiatWalletTransaction = (await this.fiatWalletTransactionRepository.findOne(
        {
          transaction_id: parentTransaction.id,
        },
        {},
        { graphFetch: '[fiat_wallet]' },
      )) as FiatWalletTransactionModel & { fiat_wallet: FiatWalletModel };

      const fiatWallet = fiatWalletTransaction.fiat_wallet;
      const creditBalance = fiatWallet.credit_balance;

      await this.fiatWalletRepository.update(fiatWallet.id, {
        credit_balance: add(creditBalance, fiatWalletTransaction.amount),
      });
    } catch (error) {
      this.logger.error('Error deducting user USDC credit balance', error);
      throw new BadRequestException('Error deducting user USDC credit balance');
    }
  }

  private async handlePaymentFailed(payload: YellowCardPaymentWebhookPayload): Promise<void> {
    this.logger.log('Handling payment failed event', payload.sequenceId);
    const parentTransaction = await this.getTransactionBySequenceRef(payload.sequenceId);

    // Get the child transaction
    const childTransaction = await this.transactionService.findOne({
      parent_transaction_id: parentTransaction.id,
    });

    if (childTransaction) {
      const isChildTransactionCompleted =
        childTransaction?.status?.toLowerCase() === TransactionStatus.COMPLETED?.toLowerCase();

      if (isChildTransactionCompleted) {
        this.logger.debug('Child transaction is already completed, skipping update', {
          transactionId: childTransaction.id,
        });
        return;
      }

      await this.updateTransactionAndFiatWalletTransactionStatusOrThrow(childTransaction.id, TransactionStatus.FAILED);
    } else {
      // Child transaction not found, create one with failed status
      await this.createFailedIncomingTransaction(payload, parentTransaction);
    }

    // Queue deletion of exchange virtual account on failure
    await this.virtualAccountService.scheduleExchangeVirtualAccountDeletion(
      parentTransaction.user_id,
      parentTransaction.id,
      'Payment failed',
    );
  }

  private async createFailedIncomingTransaction(
    payload: YellowCardPaymentWebhookPayload,
    parentTransaction: TransactionModel,
  ): Promise<void> {
    this.logger.log('Creating failed incoming transaction', payload.sequenceId);

    if (!parentTransaction.metadata.rate_id) {
      throw new BadRequestException('Exchange rate not found');
    }

    const exchangeRate = await this.rateRepository.findOne({
      id: parentTransaction.metadata.rate_id,
    });

    if (!exchangeRate) {
      throw new BadRequestException('Exchange rate not found');
    }

    const usdAmountInSmallestUnit = CurrencyUtility.formatCurrencyAmountToMainUnit(
      parentTransaction.amount,
      SUPPORTED_CURRENCIES.USD.code,
    );

    const rateConfig = await this.rateConfigRepository.findOne({
      provider: this.exchangeAdapter.getProviderName(),
    });

    if (!rateConfig?.isActive) {
      throw new BadRequestException('Rate config not found or inactive');
    }

    const grossNgnAmount = multiply(exchangeRate.rate, usdAmountInSmallestUnit);
    const disbursementFeeConfig = rateConfig.fiatExchange?.disbursement_fee;
    const disbursementFee = disbursementFeeConfig?.is_percentage
      ? multiply(grossNgnAmount, divide(disbursementFeeConfig?.value || 0, 100))
      : disbursementFeeConfig?.value || 0;
    const ngnAmount = subtract(grossNgnAmount, disbursementFee);

    const fiatWallet = await this.fiatWalletService.getUserWallet(
      parentTransaction.user_id,
      SUPPORTED_CURRENCIES.NGN.code,
    );

    const balanceBefore = Number(fiatWallet.balance);

    await this.transactionRepository.transaction(async (trx) => {
      const transaction = await this.transactionService.create(
        parentTransaction.user_id,
        {
          transaction_type: TransactionType.EXCHANGE,
          category: TransactionCategory.FIAT,
          transaction_scope: TransactionScope.INTERNAL,
          status: TransactionStatus.FAILED,
          amount: ngnAmount,
          asset: SUPPORTED_CURRENCIES.NGN.code,
          balance_before: balanceBefore,
          balance_after: balanceBefore,
          reference: UtilsService.generateTransactionReference(),
          metadata: {
            rate: exchangeRate.rate,
            rate_id: exchangeRate.id,
          },
          parent_transaction_id: parentTransaction.id,
          description: `Exchanged USD to NGN`,
          external_reference: payload.sequenceId,
        },
        trx,
      );

      await this.fiatWalletTransactionService.create(
        parentTransaction.user_id,
        {
          transaction_id: transaction.id,
          amount: ngnAmount,
          currency: SUPPORTED_CURRENCIES.NGN.code,
          status: TransactionStatus.FAILED,
          fiat_wallet_id: fiatWallet.id,
          transaction_type: FiatWalletTransactionType.EXCHANGE,
          provider_reference: payload.sequenceId,
          balance_before: balanceBefore,
          balance_after: balanceBefore,
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
    });
  }

  private async handlePaymentCancelled(payload: YellowCardPaymentWebhookPayload): Promise<void> {
    this.logger.log('Handling payment cancelled event');
    const transaction = await this.getTransactionBySequenceRef(payload.sequenceId);

    await this.updateTransactionAndFiatWalletTransactionStatusOrThrow(transaction.id, TransactionStatus.CANCELLED);

    // Queue deletion of exchange virtual account on cancellation
    await this.virtualAccountService.scheduleExchangeVirtualAccountDeletion(
      transaction.user_id,
      transaction.id,
      'Payment cancelled',
    );
  }

  private async handleCollectionWebhook(payload: YellowCardWebhookCollectionPayload): Promise<void> {
    this.logger.log('Handling collection webhook', payload.sequenceId);
    const collection = await this.getCollectionFromYellowCardOrThrow(payload.sequenceId);
    const event = payload.event;

    if (this.isEventType(event, YellowCardWebhookEvents.COLLECTION_COMPLETE)) {
      this.logger.log('Handling collection complete event', payload.sequenceId);
      await this.handleCollectionCompleted(collection);
    }

    if (this.isEventType(event, YellowCardWebhookEvents.COLLECTION_FAILED)) {
      this.logger.log('Handling collection failed event', payload.sequenceId);
      await this.handleCollectionFailed(collection);
    }

    if (this.isEventType(event, YellowCardWebhookEvents.COLLECTION_SETTLEMENT_PENDING)) {
      this.logger.log('Handling collection settlement processing event', payload.sequenceId);
      await this.handleCollectionSettlementProcessing(collection);
    }

    if (this.isEventType(event, YellowCardWebhookEvents.COLLECTION_SETTLEMENT_COMPLETE)) {
      this.logger.log('Handling collection settlement completed event', payload.sequenceId);
      await this.handleCollectionSettlementCompleted(collection, payload);
    }

    if (
      this.isEventType(event, YellowCardWebhookEvents.COLLECTION_CANCELLED) ||
      this.isEventType(event, YellowCardWebhookEvents.COLLECTION_EXPIRED)
    ) {
      this.logger.log('Handling collection cancelled event', payload.sequenceId);
      await this.handleCollectionCancelled(collection);
    }

    if (this.isEventType(event, YellowCardWebhookEvents.COLLECTION_CREATED)) {
      this.logger.log('Handling collection created event', payload.sequenceId);
    }

    if (this.isEventType(event, YellowCardWebhookEvents.COLLECTION_PROCESSING)) {
      this.logger.log('Handling collection pending event', payload.sequenceId);
    }
  }

  /**
   * Reconciles a placeholder transaction created by Zero Hash webhook with Yellow Card data
   * Updates the placeholder with full transaction details and creates FiatWalletTransaction
   */
  private async reconcilePlaceholderTransaction(
    placeholderTransaction: TransactionModel,
    parentTransaction: TransactionModel,
    user: UserModel,
    collection: ExchangePayInRequest,
    usdFiatWallet: FiatWalletModel,
    fromCurrency: string,
    toCurrency: string,
  ): Promise<{ usdTransaction: TransactionModel; usdFiatTransaction: FiatWalletTransactionModel }> {
    this.logger.log(`Reconciling placeholder transaction ${placeholderTransaction.id} for user ${user.id}`);

    try {
      // Use the amount from placeholder (actual deposited amount)
      const depositedAmount = Number(placeholderTransaction.amount);
      const usdFiatWalletBalanceBefore = Number(usdFiatWallet.balance);
      const usdFiatWalletBalanceAfter = add(usdFiatWalletBalanceBefore, depositedAmount);

      const allRelatedSourceTransaction = await this.transactionRepository.transaction(async (trx) => {
        // Update placeholder transaction with full Yellow Card data
        const updatedTransaction = await this.transactionRepository.update(
          placeholderTransaction.id,
          {
            amount: depositedAmount,
            parent_transaction_id: parentTransaction.id,
            asset: toCurrency,
            status: TransactionStatus.PENDING,
            balance_before: usdFiatWalletBalanceBefore,
            balance_after: usdFiatWalletBalanceAfter,
            transaction_type: TransactionType.EXCHANGE,
            category: TransactionCategory.FIAT,
            transaction_scope: TransactionScope.INTERNAL,
            description: `Exchange from ${SUPPORTED_CURRENCIES[fromCurrency.toUpperCase()]?.walletName || fromCurrency + ' Wallet'}`,
            metadata: {
              ...placeholderTransaction.metadata,
              source_user_id: user.id,
              source_currency: fromCurrency,
              destination_user_id: user.id,
              destination_currency: toCurrency,
              destination_name: `${user.first_name} ${user.last_name}`,
              destination_wallet_address: parentTransaction.metadata.destination_wallet_address,
              rate_id: parentTransaction.metadata.rate_id,
              from: fromCurrency,
              to: toCurrency,
              rate: parentTransaction.metadata.rate,
              yellowcard_webhook_received_at: new Date().toISOString(),
              reconciled: true,
            },
          },
          { trx },
        );

        // Create the fiat wallet transaction
        const usdFiatTransaction = await this.fiatWalletTransactionService.create(
          user.id,
          {
            amount: depositedAmount,
            currency: toCurrency,
            status: TransactionStatus.INITIATED,
            fiat_wallet_id: usdFiatWallet.id,
            transaction_id: updatedTransaction.id,
            transaction_type: FiatWalletTransactionType.EXCHANGE,
            provider_reference: placeholderTransaction.external_reference,
            balance_before: usdFiatWalletBalanceBefore,
            balance_after: usdFiatWalletBalanceAfter,
            provider_metadata: {
              source_user_id: user.id,
              source_currency: fromCurrency,
              source_name: `${user.first_name} ${user.last_name}`,
              destination_user_id: user.id,
              destination_currency: toCurrency,
              destination_name: `${user.first_name} ${user.last_name}`,
              destination_wallet_address: parentTransaction.metadata.destination_wallet_address,
            },
            destination: `${user.first_name} ${user.last_name}`,
            source: `${user.first_name} ${user.last_name}`,
            description: `Exchange from ${SUPPORTED_CURRENCIES[fromCurrency.toUpperCase()]?.walletName || fromCurrency + ' Wallet'}`,
          },
          trx,
        );

        this.logger.log(
          `Reconciled placeholder transaction ${placeholderTransaction.id}, created FiatWalletTransaction ${usdFiatTransaction.id}`,
        );

        return {
          usdTransaction: updatedTransaction,
          usdFiatTransaction,
        };
      });

      // Now complete the transaction since the funds were already deposited
      await this.transactionService.completeExchangeTransaction(
        allRelatedSourceTransaction.usdTransaction,
        depositedAmount,
      );

      return allRelatedSourceTransaction;
    } catch (error) {
      this.logger.error(`Error reconciling placeholder transaction ${placeholderTransaction.id}:`, error);
      throw new BadRequestException('Error reconciling placeholder transaction');
    }
  }

  /**
   * Completes a reconciled transaction by updating wallet balance and transaction status
   */
  private async getCollectionFromYellowCardOrThrow(sequenceId: string): Promise<ExchangePayInRequest> {
    const response = await this.exchangeAdapter.getPayInRequestByTransactionRef(sequenceId);

    if (!response) {
      this.logger.error('Collection not found', { sequenceId });
      throw new BadRequestException('Collection not found');
    }

    return response;
  }

  private async handleCollectionSettlementCompleted(
    collection: ExchangePayInRequest,
    payload: YellowCardWebhookCollectionPayload,
  ): Promise<void> {
    this.logger.log('Handling collection settlement completed event', collection.ref);
    const parentTransaction = await this.transactionService.findOne({ external_reference: collection.ref });

    let blockchainTransfer: ITransferResponse;
    if (!EnvironmentService.isProduction()) {
      this.logger.debug('Performing external transfer to USD wallet for non-production environment', {
        assetId: FIREBLOCKS_ASSET_ID,
        sourceVaultId: FIREBLOCKS_VAULT_ID,
      });
      blockchainTransfer = await this.fireblocksAdapter.externalTransfer({
        amount: collection.receiverCryptoInfo.cryptoAmount?.toString() || '0',
        assetId: FIREBLOCKS_ASSET_ID,
        sourceVaultId: FIREBLOCKS_VAULT_ID,
        destinationAddress: parentTransaction.metadata?.destination_wallet_address,
      });

      this.logger.debug('Completed blockchain transfer to USD wallet for non-production environment', {
        blockchainTransfer,
      });
      payload.transactionHash = blockchainTransfer.transactionId;
    }

    // create the pending USD transaction in the NGN wallet
    await this.createPendingUSDTransaction(collection, parentTransaction, payload);
  }

  private async handleCollectionCompleted(collection: ExchangePayInRequest): Promise<void> {
    this.logger.debug('Handling collection completed event', collection.transactionRef);
    const parentTransaction = await this.transactionService.findOne({ reference: collection.transactionRef });
    const fiatTransaction = await this.fiatWalletTransactionRepository.findOne({
      transaction_id: parentTransaction.id,
    });

    await this.executeNewNgUsdExchangeProcessor.updateAllSourceTransactionsToSuccessful(
      parentTransaction,
      fiatTransaction,
    );

    // remove the money from the escrow
    await this.fiatWalletEscrowService.releaseMoneyFromEscrow(parentTransaction.id);
  }

  private async handleCollectionFailed(collection: ExchangePayInRequest): Promise<void> {
    this.logger.log('Handling collection failed event', collection.ref);
    const parentTransaction = await this.transactionService.findOne({ external_reference: collection.ref });

    await this.newNgToUsdExchangeService.updateSourceTransactionsToFailed(parentTransaction.id, 'Collection failed');
  }

  private async handleCollectionSettlementProcessing(collection: ExchangePayInRequest): Promise<void> {
    this.logger.log('Handling collection processing event', collection.ref);
    const parentTransaction = await this.transactionService.findOne({ external_reference: collection.ref });

    const receiverTransaction = await this.transactionService.findOne({ parent_transaction_id: parentTransaction.id });

    await this.updateTransactionAndFiatWalletTransactionStatusOrThrow(
      receiverTransaction.id,
      TransactionStatus.PROCESSING,
    );
  }

  private async handleCollectionCancelled(collection: ExchangePayInRequest): Promise<void> {
    this.logger.log('Handling collection cancelled event', collection.ref);
    const parentTransaction = await this.transactionService.findOne({ external_reference: collection.ref });

    await this.newNgToUsdExchangeService.updateSourceTransactionsToFailed(
      parentTransaction.id,
      'Collection cancelled or expired',
    );
  }

  async mockPaymentCompleteWebhook(
    payload: ZeroHashAccountBalanceChangedPayload,
    transaction: TransactionModel,
  ): Promise<void> {
    try {
      this.logger.log('Mocking payment complete webhook');
      const data: YellowCardPaymentWebhookPayload = {
        event: YellowCardWebhookEvents.PAYMENT_COMPLETE,
        id: payload.movements[0].movement_id,
        sequenceId: transaction.reference,
        status: 'completed',
        apiKey: 'test-key',
        executedAt: payload.timestamp,
        sessionId: transaction.id,
        settlementInfo: {
          id: payload.movements[0].movement_id,
          status: 'completed',
          type: 'payout',
          cryptoCurrency: payload.asset,
          network: 'test',
          cryptoNetwork: payload.asset,
          cryptoAmount: Number.parseFloat(payload.balance),
          fiatAmountUSD: Number.parseFloat(payload.balance),
          cryptoLocalRate: Number.parseFloat(transaction.metadata.rate),
          cryptoUSDRate: 1,
        },
      };

      const yellowCardConfig = new YellowCardConfigProvider().getConfig();
      const apiKey = yellowCardConfig.apiKey;
      data.apiKey = apiKey;
      const secretKey = yellowCardConfig.secretKey;

      const hash = createHmac('sha256', secretKey).update(JSON.stringify(data)).digest('base64');

      const headers = {
        'x-yc-signature': hash,
      };

      const webhookUrls = [`https://webhook-relay.onedosh.com/webhooks/yellowcard`];

      await axios.post(webhookUrls[0], data, { headers });
    } catch (error) {
      this.logger.error('Error mocking payment complete webhook', error);
      throw new BadRequestException('Error mocking payment complete webhook');
    }
  }

  private async createPendingUSDTransaction(
    collection: ExchangePayInRequest,
    parentTransaction: TransactionModel,
    payload: YellowCardWebhookCollectionPayload,
  ): Promise<{ usdTransaction: TransactionModel; usdFiatTransaction: FiatWalletTransactionModel }> {
    try {
      const user = await this.userService.findByUserId(parentTransaction.user_id);
      const fromCurrency = parentTransaction.metadata.from?.toUpperCase() || SUPPORTED_CURRENCIES.NGN.code;
      const toCurrency = parentTransaction.metadata.to?.toUpperCase() || SUPPORTED_CURRENCIES.USD.code;

      const amountInSmallestUnit = CurrencyUtility.formatCurrencyAmountToSmallestUnit(
        parentTransaction.metadata.usd_amount,
        toCurrency,
      );

      const usdFiatWallet = await this.fiatWalletService.getUserWallet(user.id, toCurrency);

      const usdFiatWalletBalanceBefore = Number(usdFiatWallet.balance);

      const usdFiatWalletBalanceAfter = add(usdFiatWalletBalanceBefore, amountInSmallestUnit);

      // Extract transaction hash from settlementInfo (production) or use existing (non-production)
      payload.transactionHash = payload.settlementInfo?.txHash || payload.transactionHash;

      // Check if Zero Hash webhook already created a placeholder transaction
      const existingPlaceholder = await this.transactionRepository.findOne({
        external_reference: payload.transactionHash,
        status: TransactionStatus.RECONCILE,
        transaction_type: TransactionType.EXCHANGE,
      });

      if (existingPlaceholder) {
        this.logger.log(
          `Found placeholder transaction ${existingPlaceholder.id} for hash ${payload.transactionHash}, reconciling...`,
        );
        return await this.reconcilePlaceholderTransaction(
          existingPlaceholder,
          parentTransaction,
          user as any,
          collection,
          usdFiatWallet,
          fromCurrency,
          toCurrency,
        );
      }

      const allRelatedSourceTransaction = await this.transactionRepository.transaction(async (trx) => {
        // create the transaction for the initiator
        const reference = UtilsService.generateTransactionReference();
        const usdTransaction = await this.transactionService.create(
          user.id,
          {
            amount: amountInSmallestUnit,
            parent_transaction_id: parentTransaction.id,
            asset: toCurrency,
            status: TransactionStatus.PENDING,
            balance_before: usdFiatWalletBalanceBefore,
            balance_after: usdFiatWalletBalanceAfter,
            reference: reference,
            transaction_type: TransactionType.EXCHANGE,
            category: TransactionCategory.FIAT,
            transaction_scope: TransactionScope.INTERNAL,
            description: `Exchange from ${SUPPORTED_CURRENCIES[fromCurrency.toUpperCase()]?.walletName || fromCurrency + ' Wallet'}`,
            external_reference: payload.transactionHash,
            metadata: {
              source_user_id: user.id,
              source_currency: fromCurrency,
              destination_user_id: user.id,
              destination_currency: toCurrency,
              destination_name: `${user.first_name} ${user.last_name}`,
              destination_wallet_address: parentTransaction.metadata.destination_wallet_address,
              rate_id: parentTransaction.metadata.rate_id,
              from: fromCurrency,
              to: toCurrency,
              rate: parentTransaction.metadata.rate,
            },
          },
          trx,
        );

        // create the fiat transaction for the user
        const usdFiatTransaction = await this.fiatWalletTransactionService.create(
          user.id,
          {
            amount: amountInSmallestUnit,
            currency: toCurrency,
            status: TransactionStatus.INITIATED,
            fiat_wallet_id: usdFiatWallet.id,
            transaction_id: usdTransaction.id,
            transaction_type: FiatWalletTransactionType.EXCHANGE,
            provider_reference: usdTransaction.reference,
            balance_before: usdFiatWalletBalanceBefore,
            balance_after: usdFiatWalletBalanceAfter,
            provider_metadata: {
              source_user_id: user.id,
              source_currency: fromCurrency,
              source_name: `${user.first_name} ${user.last_name}`,
              destination_user_id: user.id,
              destination_currency: toCurrency,
              destination_name: `${user.first_name} ${user.last_name}`,
              destination_wallet_address: parentTransaction.metadata.destination_wallet_address,
            },
            destination: `${user.first_name} ${user.last_name}`,
            source: `${user.first_name} ${user.last_name}`,
            description: `Exchange from ${SUPPORTED_CURRENCIES[fromCurrency.toUpperCase()]?.walletName || fromCurrency + ' Wallet'}`,
          },
          trx,
        );

        return {
          usdTransaction,
          usdFiatTransaction,
        };
      });

      return allRelatedSourceTransaction;
    } catch (error) {
      this.logger.error('Error creating pending USD transaction', error);
      throw new BadRequestException('Error creating pending USD transaction');
    }
  }
}
