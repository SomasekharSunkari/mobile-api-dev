import {
  BadRequestException,
  forwardRef,
  Inject,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { DateTime } from 'luxon';
import { abs, add, divide, floor, multiply, subtract } from 'mathjs';
import { ExchangeAdapter } from '../../../adapters/exchange/exchange.adapter';
import { FiatWalletAdapter } from '../../../adapters/fiat-wallet/fiat-wallet.adapter';
import { EnvironmentService } from '../../../config';
import { OneDoshConfiguration } from '../../../config/onedosh/onedosh.config';
import {
  OneDoshSupportedCryptoCurrencies,
  OneDoshSupportedCryptoNetworks,
} from '../../../config/onedosh/onedosh.config.interface';
import { CurrencyUtility, SUPPORTED_CURRENCIES } from '../../../currencies/currencies';
import { TransactionCategory, TransactionModel, TransactionScope, UserModel } from '../../../database';
import { DoshPointsEventCode } from '../../../database/models/doshPointsEvent/doshPointsEvent.interface';
import { ExternalAccountModel } from '../../../database/models/externalAccount';
import { ExternalAccountStatus } from '../../../database/models/externalAccount/externalAccount.interface';
import { FiatWalletTransactionType } from '../../../database/models/fiatWalletTransaction/fiatWalletTransaction.interface';
import { FiatWalletTransactionModel } from '../../../database/models/fiatWalletTransaction/fiatWalletTransaction.model';
import {
  ITransactionUpdateMetadata,
  TransactionStatus,
  TransactionType,
} from '../../../database/models/transaction/transaction.interface';
import { UserRepository } from '../../../modules/auth/user/user.repository';
import { ExternalAccountService } from '../../../modules/externalAccount/external-account.service';
import { FiatWalletRepository } from '../../../modules/fiatWallet/fiatWallet.repository';
import { FiatWalletService } from '../../../modules/fiatWallet/fiatWallet.service';
import { FiatWalletTransactionService } from '../../../modules/fiatWalletTransactions/fiatWalletTransactions.service';
import { TransactionService } from '../../../modules/transaction/transaction.service';
import { TransactionAggregateService } from '../../../modules/transactionAggregate/transactionAggregate.service';
import { VirtualAccountService } from '../../../modules/virtualAccount';
import { LockerService } from '../../../services/locker/locker.service';
import { MailerService } from '../../../services/queue/processors/mailer/mailer.service';
import { UsdFiatRewardsProcessor } from '../../../services/queue/processors/usd-fiat-rewards/usd-fiat-rewards.processor';
import { UtilsService } from '../../../utils/utils.service';
import { BlockchainWalletTransactionRepository } from '../../blockchainWalletTransaction/blockchainWalletTransaction.repository';
import { DoshPointsAccountService } from '../../doshPoints/doshPointsAccount/doshPointsAccount.service';
import { DoshPointsTransactionService } from '../../doshPoints/doshPointsTransaction/doshPointsTransaction.service';
import { FiatWalletTransactionRepository } from '../../fiatWalletTransactions/fiatWalletTransactions.repository';
import { RateRepository } from '../../rate/rate.repository';
import { RateConfigRepository } from '../../rateConfig/rateConfig.repository';
import { TransactionRepository } from '../../transaction';
import { YellowCardWebhookService } from '../yellowcard/yellowcard-webhook.service';
import {
  MetadataWithWebhookHistory,
  ZeroHashAccountBalanceChangedPayload,
  ZeroHashBalanceMovement,
  ZeroHashExternalAccountStatusChangedPayload,
  ZeroHashMovementType,
  ZeroHashParticipantStatusChangedPayload,
  ZeroHashParticipantUpdatedPayload,
  ZeroHashPaymentStatusChangedPayload,
  ZeroHashProviderMetadata,
  ZeroHashTradeState,
  ZeroHashTradeStatusChangedPayload,
  ZeroHashWebhookEventType,
  ZeroHashWebhookPayload,
} from './zerohash-webhook.interface';

@Injectable()
export class ZerohashWebhookService {
  private readonly logger = new Logger(ZerohashWebhookService.name);

  @Inject(ExternalAccountService)
  private readonly externalAccountService: ExternalAccountService;

  @Inject(LockerService)
  private readonly lockerService: LockerService;

  @Inject(TransactionService)
  private readonly transactionService: TransactionService;

  @Inject(TransactionRepository)
  private readonly transactionRepository: TransactionRepository;

  @Inject(UserRepository)
  private readonly userRepository: UserRepository;

  @Inject(FiatWalletTransactionService)
  private readonly fiatWalletTransactionService: FiatWalletTransactionService;

  @Inject(FiatWalletTransactionRepository)
  private readonly fiatWalletTransactionRepository: FiatWalletTransactionRepository;

  @Inject(FiatWalletService)
  private readonly fiatWalletService: FiatWalletService;

  @Inject(FiatWalletRepository)
  private readonly fiatWalletRepository: FiatWalletRepository;

  @Inject(FiatWalletAdapter)
  private readonly fiatWalletAdapter: FiatWalletAdapter;

  @Inject(forwardRef(() => YellowCardWebhookService))
  private readonly yellowCardWebhookService: YellowCardWebhookService;

  @Inject(BlockchainWalletTransactionRepository)
  private readonly blockchainWalletTransactionRepository: BlockchainWalletTransactionRepository;

  @Inject(MailerService)
  private readonly mailerService: MailerService;

  @Inject(DoshPointsAccountService)
  private readonly doshPointsAccountService: DoshPointsAccountService;

  @Inject(DoshPointsTransactionService)
  private readonly doshPointsTransactionService: DoshPointsTransactionService;

  @Inject(UsdFiatRewardsProcessor)
  private readonly usdFiatRewardsProcessor: UsdFiatRewardsProcessor;

  @Inject(RateRepository)
  private readonly rateRepository: RateRepository;

  @Inject(RateConfigRepository)
  private readonly rateConfigRepository: RateConfigRepository;

  @Inject(ExchangeAdapter)
  private readonly exchangeAdapter: ExchangeAdapter;

  @Inject(VirtualAccountService)
  private readonly virtualAccountService: VirtualAccountService;

  @Inject(TransactionAggregateService)
  private readonly transactionAggregateService: TransactionAggregateService;

  async processWebhook(payload: ZeroHashWebhookPayload, eventType: ZeroHashWebhookEventType): Promise<void> {
    this.logger.debug('Processing ZeroHash webhook', { eventType, payload });
    switch (eventType) {
      case ZeroHashWebhookEventType.PARTICIPANT_STATUS_CHANGED:
        await this.processParticipantStatusChanged(payload as ZeroHashParticipantStatusChangedPayload);
        break;

      case ZeroHashWebhookEventType.EXTERNAL_ACCOUNT_STATUS_CHANGED:
        await this.processExternalAccountStatusChanged(payload as ZeroHashExternalAccountStatusChangedPayload);
        break;

      case ZeroHashWebhookEventType.PARTICIPANT_UPDATED:
        await this.processParticipantUpdated(payload as ZeroHashParticipantUpdatedPayload);
        break;

      case ZeroHashWebhookEventType.ACCOUNT_BALANCE_CHANGED:
        await this.processAccountBalanceChanged(payload as ZeroHashAccountBalanceChangedPayload);
        break;

      case ZeroHashWebhookEventType.PAYMENT_STATUS_CHANGED:
        await this.processPaymentStatusChanged(payload as ZeroHashPaymentStatusChangedPayload);
        break;

      case ZeroHashWebhookEventType.TRADE_STATUS_CHANGED:
        await this.processTradeStatusChanged(payload as ZeroHashTradeStatusChangedPayload);
        break;

      default:
        this.logger.warn(`Unhandled Zerohash event type: ${eventType}`);
        break;
    }
  }

  /**
   * Checks Zerohash withdrawal status and completes the USD transaction if confirmed.
   * Called by Paga/YellowCard webhooks when they arrive before Zerohash's withdrawal_confirmed webhook.
   * @param parentTransactionId - The parent USD transaction ID
   * @param userId - The user ID
   * @returns boolean indicating if the USD withdrawal was completed
   */
  public async checkAndCompleteUsdWithdrawal(parentTransactionId: string, userId: string): Promise<boolean> {
    this.logger.log(
      `[checkAndCompleteUsdWithdrawal] Checking USD withdrawal status for parent transaction: ${parentTransactionId}, user: ${userId}`,
    );

    try {
      // Find the fiat wallet transaction by transaction_id to get provider_request_ref
      const fiatWalletTransaction = await this.fiatWalletTransactionService.findOneOrNull({
        transaction_id: parentTransactionId,
        user_id: userId,
      });

      if (!fiatWalletTransaction) {
        this.logger.warn(
          `[checkAndCompleteUsdWithdrawal] No fiat wallet transaction found for transaction_id: ${parentTransactionId}`,
        );
        return false;
      }

      const withdrawalRequestId = fiatWalletTransaction.provider_request_ref;
      if (!withdrawalRequestId) {
        this.logger.warn(
          `[checkAndCompleteUsdWithdrawal] No provider_request_ref found for fiat wallet transaction: ${fiatWalletTransaction.id}`,
        );
        return false;
      }

      this.logger.log(
        `[checkAndCompleteUsdWithdrawal] Checking Zerohash withdrawal status for withdrawal_request_id: ${withdrawalRequestId}`,
      );

      // Call Zerohash API to get withdrawal details
      const withdrawalDetails = await this.fiatWalletAdapter.getWithdrawalDetails(withdrawalRequestId, 'zerohash');

      this.logger.log(
        `[checkAndCompleteUsdWithdrawal] Withdrawal details: status=${withdrawalDetails.status}, externalReference=${withdrawalDetails.externalReference}`,
      );

      // Check if withdrawal is confirmed (on_chain_status is 'confirmed' or 'completed')
      const confirmedStatuses = ['confirmed', 'completed', 'settled', 'approved'];
      const isConfirmed = confirmedStatuses.includes(withdrawalDetails.status?.toLowerCase());

      if (!isConfirmed) {
        this.logger.log(
          `[checkAndCompleteUsdWithdrawal] Withdrawal not yet confirmed: status=${withdrawalDetails.status}`,
        );
        return false;
      }

      this.logger.log(
        `[checkAndCompleteUsdWithdrawal] Withdrawal confirmed, completing USD transaction: ${parentTransactionId}`,
      );

      // Get the parent transaction
      const transaction = await this.transactionService.findOne({ id: parentTransactionId });
      if (!transaction) {
        this.logger.warn(`[checkAndCompleteUsdWithdrawal] Transaction not found: ${parentTransactionId}`);
        return false;
      }

      // Get external account for participant_code
      const externalAccount = await this.externalAccountService.findOne({ user_id: userId });

      // Calculate balance changes using the transaction amount (negative for withdrawal)
      const changeAmountInSmallestUnit = fiatWalletTransaction.amount;
      const balanceBefore = Number(fiatWalletTransaction.balance_before);
      const balanceAfter = add(balanceBefore, changeAmountInSmallestUnit);

      // Use a lock to prevent race conditions with potentially late-arriving Zerohash webhook
      const lockKey = `withdrawal_${withdrawalRequestId}`;
      let completed = false;

      await this.lockerService.runWithLock(lockKey, async () => {
        // Re-check status inside lock to prevent double completion
        const currentFwt = await this.fiatWalletTransactionService.findOne({
          id: fiatWalletTransaction.id,
        });

        if (currentFwt.status?.toLowerCase() === TransactionStatus.COMPLETED.toLowerCase()) {
          this.logger.log(
            `[checkAndCompleteUsdWithdrawal] Transaction already completed inside lock: ${fiatWalletTransaction.id}`,
          );
          completed = true;
          return;
        }

        // Update the source fiat wallet balance
        const sourceWallet = await this.fiatWalletRepository.findById(fiatWalletTransaction.fiat_wallet_id);

        if (sourceWallet) {
          const currentBalance = Number(sourceWallet.balance);
          const currentCreditBalance = Number(sourceWallet.credit_balance);
          const absoluteChangeAmount = abs(changeAmountInSmallestUnit);

          await this.fiatWalletRepository.update(sourceWallet.id, {
            balance: subtract(currentBalance, absoluteChangeAmount),
            credit_balance: add(currentCreditBalance, absoluteChangeAmount),
          });

          this.logger.log(
            `[checkAndCompleteUsdWithdrawal] Updated source wallet balance: ${currentBalance} -> ${subtract(currentBalance, absoluteChangeAmount)}`,
          );
        }

        // Extract provider_fee
        let provider_fee: number | undefined = fiatWalletTransaction.provider_fee;
        if (provider_fee == null) {
          const metadata = (transaction.metadata ?? {}) as {
            fee?: unknown;
            provider_metadata?: { fee?: unknown };
          };
          const metadataFee = typeof metadata.fee === 'number' ? metadata.fee : undefined;
          const providerMetadataFee =
            typeof metadata.provider_metadata?.fee === 'number' ? metadata.provider_metadata.fee : undefined;
          provider_fee = metadataFee ?? providerMetadataFee;
        }

        // Update the main transaction using direct repository update
        const updatedMetadata = {
          ...transaction.metadata,
          balance_after: balanceAfter,
          completed_at: DateTime.now().toISO(),
          participant_code: externalAccount?.participant_code,
          description: transaction.description,
          source: fiatWalletTransaction.source,
          destination: fiatWalletTransaction.destination,
          provider_fee,
          completed_via_inline_check: true,
          ...(withdrawalDetails.externalReference && { transactionHash: withdrawalDetails.externalReference }),
        };

        await this.transactionRepository.update(parentTransactionId, {
          status: TransactionStatus.COMPLETED,
          metadata: updatedMetadata,
        });

        // Track transaction aggregate
        try {
          await this.transactionAggregateService.findAndUpdate(
            'zerohash',
            fiatWalletTransaction.transaction_type,
            Math.abs(Number(changeAmountInSmallestUnit)),
          );
        } catch (error) {
          this.logger.error(`[checkAndCompleteUsdWithdrawal] Failed to update transaction aggregate: ${error.message}`);
        }

        // Update fiat wallet transaction
        const existingMetadata = (fiatWalletTransaction.provider_metadata || {}) as MetadataWithWebhookHistory;
        const withdrawalMetadata: ZeroHashProviderMetadata = {
          withdrawal_status: withdrawalDetails.status,
          withdrawal_confirmed_at: Date.now(),
        };
        const mergedMetadata = {
          ...existingMetadata,
          ...withdrawalMetadata,
          completed_via_inline_check: true,
        };

        await this.fiatWalletTransactionRepository.update(fiatWalletTransaction.id, {
          status: TransactionStatus.COMPLETED,
          balance_after: balanceAfter,
          completed_at: DateTime.now().toISO(),
          provider_metadata: mergedMetadata,
        });

        this.logger.log(
          `[checkAndCompleteUsdWithdrawal] Successfully completed USD withdrawal for transaction: ${parentTransactionId}`,
        );

        // Create incoming NGN transaction
        await this.createIncomingNgnTransaction(transaction, withdrawalRequestId);

        completed = true;
      });

      return completed;
    } catch (error) {
      this.logger.error(
        `[checkAndCompleteUsdWithdrawal] Error checking/completing USD withdrawal for transaction ${parentTransactionId}: ${error.message}`,
        error.stack,
      );
      return false;
    }
  }

  private extractParticipantCode(payload: ZeroHashPaymentStatusChangedPayload): string {
    // Check for direct participant_code field first
    if (payload?.participant_code) {
      return payload.participant_code;
    }

    // Check for nested obo_participant.participant_code (used in multi-party transactions)
    if (payload?.obo_participant?.participant_code) {
      return payload.obo_participant.participant_code;
    }

    this.logger.error('Missing participant_code in webhook payload');
    throw new BadRequestException('Missing participant_code');
  }

  private async getExternalAccount(userRef: string): Promise<ExternalAccountModel | null> {
    try {
      const externalAccount = await this.externalAccountService.findOne({
        participant_code: userRef,
      });
      this.logger.log(`Found external account for participant_code: ${userRef}, user_id: ${externalAccount.user_id}`);
      return externalAccount;
    } catch (error) {
      if (error instanceof NotFoundException) {
        this.logger.warn(
          `No ExternalAccount found for participant_code: ${userRef}. This webhook cannot be processed without an existing external account.`,
        );
        return null;
      }
      throw new InternalServerErrorException('Failed to fetch external account for participant');
    }
  }

  private async processParticipantStatusChanged(payload: ZeroHashParticipantStatusChangedPayload): Promise<void> {
    const userRef = payload.participant_code;
    const externalAccount = await this.getExternalAccount(userRef);

    if (!externalAccount) {
      return;
    }

    const rawStatus = payload?.participant_status;
    const participantStatus = rawStatus?.toLowerCase();

    const lockKey = `external_account_participant_${userRef}`;
    await this.lockerService.runWithLock(lockKey, async () => {
      const currentStatus = externalAccount.provider_kyc_status?.toLowerCase();

      // If status is the same, skip
      if (currentStatus === participantStatus) {
        this.logger.debug(`Status already ${participantStatus}, skipping update`);
        return;
      }

      // Safety check: prevent downgrading from approved to submitted (out-of-order webhook)
      if (currentStatus === 'approved' && participantStatus === 'submitted') {
        this.logger.warn(
          `Preventing downgrade from approved to submitted (likely out-of-order webhook). Skipping update.`,
        );
        return;
      }

      // Otherwise, mirror whatever ZeroHash sends us
      await this.externalAccountService.update({ id: externalAccount.id }, { provider_kyc_status: participantStatus });

      this.logger.log(
        `ExternalAccount id=${externalAccount.id} provider_kyc_status: ${currentStatus || 'null'} → ${participantStatus}`,
      );
    });
  }

  private async processExternalAccountStatusChanged(
    payload: ZeroHashExternalAccountStatusChangedPayload,
  ): Promise<void> {
    const externalAccountId = payload.external_account_id;
    const externalStatus = payload.external_account_status?.toLowerCase();

    if (!externalAccountId || !externalStatus) {
      throw new BadRequestException('Missing external_account_id or status');
    }

    // Find external account by external_account_ref to ensure we update the correct record
    let externalAccount: ExternalAccountModel;
    try {
      externalAccount = await this.externalAccountService.findOne({
        external_account_ref: externalAccountId,
      });
    } catch (error) {
      if (error instanceof NotFoundException) {
        this.logger.warn(
          `No ExternalAccount found for external_account_id: ${externalAccountId}. Skipping status update.`,
        );
        return;
      }
      throw error;
    }

    const currentStatus = externalAccount.status?.toLowerCase();

    // Skip if status unchanged
    if (externalStatus === currentStatus) {
      return;
    }

    const lockKey = `external_account_status_${externalAccountId}`;
    await this.lockerService.runWithLock(lockKey, async () => {
      // Handle closed/revoked status - delegate to service for cleanup, duplication, and notifications
      if (externalStatus === ExternalAccountStatus.CLOSED || externalStatus === ExternalAccountStatus.REVOKED) {
        await this.externalAccountService.closeExternalAccount(externalAccount.id);
        return;
      }

      // Don't downgrade to pending - all accounts start as pending, never go back
      if (externalStatus === ExternalAccountStatus.PENDING && currentStatus !== ExternalAccountStatus.PENDING) {
        this.logger.debug(
          `Skipping downgrade from ${currentStatus} to pending for external account ${externalAccount.id}`,
        );
        return;
      }

      // Update status
      await this.externalAccountService.update(
        { id: externalAccount.id },
        { status: externalStatus as ExternalAccountStatus },
      );

      this.logger.log(
        `ExternalAccount id=${externalAccount.id} status: ${currentStatus || 'null'} → ${externalStatus}`,
      );
    });
  }

  private async processParticipantUpdated(payload: ZeroHashParticipantUpdatedPayload): Promise<void> {
    this.logger.debug('Participant updated payload:', JSON.stringify(payload, null, 2));
  }

  private async processAccountBalanceChanged(payload: ZeroHashAccountBalanceChangedPayload): Promise<void> {
    this.logger.debug('ACCOUNT_BALANCE_CHANGED payload:', JSON.stringify(payload, null, 2));
    if (!this.isValidBalanceChangePayload(payload)) {
      return;
    }

    const externalAccount = await this.getExternalAccount(payload.participant_code);
    if (!externalAccount) {
      this.logger.debug(
        `No external account found for participant_code: ${payload.participant_code}, skipping balance update`,
      );
      return;
    }

    const movements = payload.movements || [];
    for (const movement of movements) {
      await this.processMovement(movement, externalAccount, payload);
    }
  }

  private isValidBalanceChangePayload(payload: ZeroHashAccountBalanceChangedPayload): boolean {
    if (!payload.participant_code || !payload.asset) {
      this.logger.warn('Missing participant_code or asset in account_balance.changed webhook payload');
      return false;
    }

    // Check if this is a withdrawal_confirmed movement from collateral account
    const movements = payload.movements || [];
    const hasWithdrawalConfirmed = movements.some((movement) => movement.movement_type === 'withdrawal_confirmed');

    // Allow collateral account type only for withdrawal_confirmed movements
    if (payload.account_type === 'collateral') {
      if (hasWithdrawalConfirmed) {
        this.logger.debug(`Processing withdrawal_confirmed from collateral account for asset: ${payload.asset}`);
        return this.isSupportedStablecoin(payload.asset);
      } else {
        this.logger.debug(
          `Ignoring account_balance.changed for account_type: ${payload.account_type} (not withdrawal_confirmed)`,
        );
        return false;
      }
    }

    // Validate account_type is 'available' for other movement types
    if (payload.account_type !== 'available') {
      this.logger.debug(`Ignoring account_balance.changed for account_type: ${payload.account_type} (not 'available')`);
      return false;
    }

    if (!this.isSupportedStablecoin(payload.asset)) {
      this.logger.debug(`Ignoring account_balance.changed for asset: ${payload.asset} (not a supported stablecoin)`);
      return false;
    }

    return true;
  }

  /**
   * Checks if the given asset is a supported stablecoin in the format CURRENCY.NETWORK
   * Examples: USDC.SOL, USDT.ETH, USDC.TRON
   */
  private isSupportedStablecoin(asset: string): boolean {
    if (!asset?.includes('.')) {
      return false;
    }

    const [currency, network] = asset.split('.');

    // Check if currency is a supported stablecoin
    const supportedCurrencies = OneDoshConfiguration.getAllSupportedCryptoCurrencies();
    const isSupportedCurrency = supportedCurrencies.includes(currency as OneDoshSupportedCryptoCurrencies);

    // Check if network is supported
    const supportedNetworks = OneDoshConfiguration.getSupportedCryptoNetworks();
    const isSupportedNetwork = supportedNetworks.includes(network as OneDoshSupportedCryptoNetworks);

    return isSupportedCurrency && isSupportedNetwork;
  }

  private async processMovement(
    movement: ZeroHashBalanceMovement,
    externalAccount: ExternalAccountModel,
    payload: ZeroHashAccountBalanceChangedPayload,
  ): Promise<void> {
    const { trade_id, transfer_request_id, change } = movement;

    if (!this.isValidMovement(movement)) {
      return;
    }

    // Skip processing if change is zero
    if (Number(change) === 0) {
      this.logger.debug(`Ignoring zero change amount for reference_id: ${trade_id || transfer_request_id}`);
      return;
    }

    try {
      switch (movement.movement_type) {
        case ZeroHashMovementType.FINAL_SETTLEMENT:
        case ZeroHashMovementType.FINAL_SETTLEMENT_OUTSTANDING: {
          // Find the transaction by trade_id in provider_reference, with retry for race condition
          let fiatWalletTransaction = await this.findFiatWalletTransactionByTradeId(externalAccount, trade_id);

          // If not found, wait a short time and retry once (handles race condition)
          if (!fiatWalletTransaction) {
            this.logger.debug(
              `Transaction not found on first attempt for trade_id: ${trade_id}, retrying in 1 second...`,
            );
            await new Promise((resolve) => setTimeout(resolve, 1000));
            fiatWalletTransaction = await this.findFiatWalletTransactionByTradeId(externalAccount, trade_id);
          }

          if (!fiatWalletTransaction) {
            this.logger.warn(
              `No fiat wallet transaction found for trade_id: ${trade_id}, user: ${externalAccount.user_id}`,
            );
            return;
          }

          // Use the balance from payload to update wallet and transaction balances
          await this.updateWalletBalanceFromPayload(
            payload,
            trade_id,
            externalAccount,
            movement,
            fiatWalletTransaction,
          );
          break;
        }

        case ZeroHashMovementType.TRANSFER:
          await this.processTransferMovement(movement, externalAccount, payload);
          break;

        case ZeroHashMovementType.WITHDRAWAL_CONFIRMED:
          await this.processWithdrawalConfirmed(movement, externalAccount, payload);
          break;

        case ZeroHashMovementType.WITHDRAWAL_PENDING:
          await this.processWithdrawalPending(movement, externalAccount, payload);
          break;

        case ZeroHashMovementType.DEPOSIT:
          await this.processDepositMovement(movement, externalAccount, payload);
          break;

        default:
          this.logger.warn(`Unhandled movement type: ${movement.movement_type}`);
          break;
      }
    } catch (error) {
      this.logger.error(
        `Error processing ${payload.asset} balance change for reference_id=${trade_id || transfer_request_id}:`,
        error,
      );
    }
  }

  private isValidMovement(movement: ZeroHashBalanceMovement): boolean {
    if (!movement.change) {
      this.logger.warn('Missing change in movement', { movement });
      return false;
    }

    // For final_settlement and final_settlement_outstanding movements, we need a trade_id
    if (
      (movement.movement_type === ZeroHashMovementType.FINAL_SETTLEMENT ||
        movement.movement_type === ZeroHashMovementType.FINAL_SETTLEMENT_OUTSTANDING) &&
      !movement.trade_id
    ) {
      this.logger.warn('Missing trade_id for final_settlement movement', { movement });
      return false;
    }

    // For transfer movements, we need a transfer_request_id
    if (movement.movement_type === ZeroHashMovementType.TRANSFER && !movement.transfer_request_id) {
      this.logger.warn('Missing transfer_request_id for transfer movement', { movement });
      return false;
    }

    // For withdrawal_confirmed movements, we need a withdrawal_request_id
    if (movement.movement_type === 'withdrawal_confirmed' && !movement.withdrawal_request_id) {
      this.logger.warn('Missing withdrawal_request_id for withdrawal_confirmed movement', { movement });
      return false;
    }

    // For withdrawal_pending movements, we need a withdrawal_request_id
    if (movement.movement_type === 'withdrawal_pending' && !movement.withdrawal_request_id) {
      this.logger.warn('Missing withdrawal_request_id for withdrawal_pending movement', { movement });
      return false;
    }

    // For deposit movements, we need a deposit_reference_id
    if (movement.movement_type === 'deposit' && !movement.deposit_reference_id) {
      this.logger.warn('Missing deposit_reference_id for deposit movement', { movement });
      return false;
    }

    // Only handle supported movement types
    const supportedMovementTypes = [
      'final_settlement',
      'final_settlement_outstanding',
      'transfer',
      'withdrawal_confirmed',
      'withdrawal_pending',
      'deposit',
    ];
    if (!supportedMovementTypes.includes(movement.movement_type)) {
      this.logger.debug(
        `Ignoring movement type: ${movement.movement_type} (not in supported types: ${supportedMovementTypes.join(', ')})`,
      );
      return false;
    }

    return true;
  }

  /**
   * Find fiat wallet transaction by trade_id stored in provider_reference field
   */
  private async findFiatWalletTransactionByTradeId(externalAccount: ExternalAccountModel, tradeId: string) {
    try {
      this.logger.debug(
        `Looking for fiat wallet transaction with provider_reference: ${tradeId} for user: ${externalAccount.user_id}`,
      );

      const fiatWalletTransaction = await this.fiatWalletTransactionService.findOneOrNull({
        user_id: externalAccount.user_id,
        provider: externalAccount.provider,
        provider_reference: tradeId,
      });

      if (fiatWalletTransaction) {
        this.logger.debug(`Found fiat wallet transaction: ${fiatWalletTransaction.id} for trade_id: ${tradeId}`);
        return fiatWalletTransaction;
      }

      this.logger.debug(
        `No fiat wallet transaction found with provider_reference: ${tradeId} for user: ${externalAccount.user_id}`,
      );
      return null;
    } catch (error) {
      this.logger.error(`Error finding fiat wallet transaction by trade_id ${tradeId}:`, error);
      throw error;
    }
  }

  /**
   * Update wallet balance using the balance from the webhook payload
   */
  private async updateWalletBalanceFromPayload(
    payload: ZeroHashAccountBalanceChangedPayload,
    tradeId: string,
    externalAccount: ExternalAccountModel,
    movement: ZeroHashBalanceMovement,
    fiatWalletTransaction: FiatWalletTransactionModel,
  ): Promise<void> {
    this.logger.log(
      `Processing final_settlement with balance from payload: ${payload.balance} ${payload.asset} for trade_id: ${tradeId}`,
    );

    // Convert the balance from payload to smallest unit (cents)
    const newBalanceInMainUnit = Number(payload.balance);
    // Validate asset and use USD for all supported stablecoins
    if (!this.isSupportedStablecoin(payload.asset)) {
      throw new Error(`Unsupported crypto asset: ${payload.asset}`);
    }
    const newBalanceInSmallestUnit = CurrencyUtility.formatCurrencyAmountToSmallestUnit(newBalanceInMainUnit, 'USD');

    this.logger.log(`New balance: ${newBalanceInMainUnit} USD (${newBalanceInSmallestUnit} in smallest unit)`);

    // Handle existing transaction by client_transfer_id if present
    const handled = await this.handleClientTransferIdTransaction(
      payload.client_transfer_id,
      externalAccount.user_id,
      fiatWalletTransaction.id,
      tradeId,
    );
    if (handled) {
      return;
    }

    // Get the fiat wallet
    const fiatWallet = await this.fiatWalletService.getUserWallet(
      externalAccount.user_id,
      fiatWalletTransaction.currency,
    );

    const balanceBefore = fiatWallet.balance;
    const balanceAfter = newBalanceInSmallestUnit;
    const amount = subtract(balanceAfter, balanceBefore);

    // Prepare metadata
    const existingMetadata = (fiatWalletTransaction.provider_metadata || {}) as MetadataWithWebhookHistory;
    const settlementMetadata: ZeroHashProviderMetadata = {
      settlement_trade_id: tradeId,
      settlement_balance: payload.balance,
      settlement_asset: payload.asset,
      settlement_timestamp: payload.timestamp,
      movement_id: movement.movement_id,
    };
    const mergedMetadata = this.mergeMetadataWithWebhookPayload(
      existingMetadata,
      settlementMetadata,
      ZeroHashWebhookEventType.ACCOUNT_BALANCE_CHANGED,
      payload,
    );

    // Use a transaction to update wallet balance and emit event
    await this.fiatWalletRepository.transaction(async (trx) => {
      // Update wallet balance using the service method (emits event automatically)
      await this.fiatWalletService.updateBalanceWithTransaction(
        fiatWallet.id,
        amount,
        fiatWalletTransaction.transaction_id,
        TransactionStatus.COMPLETED,
        {
          fiat_wallet_transaction_id: fiatWalletTransaction.id,
        },
        fiatWallet,
        balanceBefore,
        balanceAfter,
        async () => fiatWalletTransaction, // Return existing transaction instead of creating new one
        trx,
      );

      // Update the fiat wallet transaction metadata
      await this.fiatWalletTransactionRepository.update(
        fiatWalletTransaction.id,
        {
          provider_metadata: mergedMetadata,
        },
        { trx },
      );

      // Update the main transaction if it exists
      if (fiatWalletTransaction.transaction_id) {
        // Extract provider_fee from fiat wallet transaction or main transaction metadata (if available)
        let provider_fee: number | undefined = fiatWalletTransaction.provider_fee;

        if (provider_fee == null) {
          const mainTransaction = await this.transactionRepository.findOne(
            { id: fiatWalletTransaction.transaction_id },
            undefined,
            { trx },
          );

          const metadata = (mainTransaction?.metadata ?? {}) as {
            fee?: unknown;
            provider_metadata?: { fee?: unknown };
          };

          const metadataFee = typeof metadata.fee === 'number' ? metadata.fee : undefined;
          const providerMetadataFee =
            typeof metadata.provider_metadata?.fee === 'number' ? metadata.provider_metadata.fee : undefined;

          provider_fee = metadataFee ?? providerMetadataFee;
        }

        const updateMetadata: ITransactionUpdateMetadata = {
          balance_after: newBalanceInSmallestUnit,
          completed_at: DateTime.now().toISO(),
          provider_metadata: mergedMetadata,
          participant_code: externalAccount.participant_code,
          description: fiatWalletTransaction.description,
          source: fiatWalletTransaction.source,
          destination: fiatWalletTransaction.destination,
          provider_fee,
          bank_name: externalAccount.bank_name,
          account_number: externalAccount.account_number,
        };

        // Update the main transaction using TransactionService to trigger notifications
        await this.transactionService.updateStatus(
          fiatWalletTransaction.transaction_id,
          TransactionStatus.COMPLETED,
          updateMetadata,
          trx,
        );

        // Track transaction aggregate for completed ACH deposit
        try {
          await this.transactionAggregateService.findAndUpdate(
            'zerohash',
            fiatWalletTransaction.transaction_type,
            Number(amount),
          );
        } catch (error) {
          this.logger.error(
            `Failed to update transaction aggregate for transaction ${fiatWalletTransaction.transaction_id}: ${error.message}`,
            error.stack,
          );
          // Don't throw - aggregate tracking is non-critical
        }

        this.logger.log(
          `Updated transaction ${fiatWalletTransaction.transaction_id} status to COMPLETED with balance_after: ${newBalanceInSmallestUnit}`,
        );
      }
    });

    this.logger.log(
      `Updated fiat wallet ${fiatWallet.id} balance to: ${newBalanceInSmallestUnit} (from payload balance: ${payload.balance})`,
    );

    this.logger.log(
      `Successfully processed final_settlement for trade ${tradeId}: wallet balance set to ${payload.balance} ${payload.asset}`,
    );

    await this.handlePostSettlementActions(fiatWalletTransaction, externalAccount, payload);
  }

  /**
   * Handle post-settlement actions like first deposit bonus and reward transaction settlement
   */
  private async handlePostSettlementActions(
    fiatWalletTransaction: FiatWalletTransactionModel,
    externalAccount: ExternalAccountModel,
    payload: ZeroHashAccountBalanceChangedPayload,
  ): Promise<void> {
    // Credit first deposit bonus points (only if this is the user's first completed USD deposit)
    if (fiatWalletTransaction.transaction_type === FiatWalletTransactionType.DEPOSIT) {
      await this.handleFirstDepositBonus(fiatWalletTransaction, externalAccount);
    }

    // Set settled_at for REWARD transactions (they don't get a separate settled webhook)
    if (fiatWalletTransaction.transaction_type === FiatWalletTransactionType.REWARD) {
      try {
        const settledAt = DateTime.fromMillis(payload.timestamp).toISO();
        await this.fiatWalletTransactionRepository.update(fiatWalletTransaction.id, {
          settled_at: settledAt,
        });
        this.logger.log(
          `Reward FiatWalletTransaction id=${fiatWalletTransaction.id} settled immediately at: ${settledAt}`,
        );
      } catch (error) {
        this.logger.error(
          `Error setting settled_at for reward transaction ${fiatWalletTransaction.transaction_id}: ${error.message}`,
          error,
        );
        // Don't rethrow - transaction should complete even if settled_at update fails
      }
    }
  }

  /**
   * Handle existing transaction lookup by client_transfer_id
   * @returns true if transaction was found and handled, false otherwise
   */
  private async handleClientTransferIdTransaction(
    clientTransferId: string | undefined,
    userId: string,
    fiatWalletTransactionId: string,
    tradeId: string,
  ): Promise<boolean> {
    if (!clientTransferId) {
      return false;
    }

    try {
      const transaction = await this.transactionRepository.findOne({
        reference: clientTransferId,
        user_id: userId,
      });

      if (transaction) {
        this.logger.log(`Found existing transaction for client_transfer_id: ${clientTransferId}`);
        await this.transactionService.updateStatus(transaction.id, TransactionStatus.COMPLETED);
        await this.fiatWalletTransactionService.updateStatus(fiatWalletTransactionId, TransactionStatus.COMPLETED, {
          provider_reference: tradeId,
        });
        return true;
      }
    } catch (error) {
      if (!(error instanceof NotFoundException)) {
        throw error;
      }
      this.logger.log(
        `No existing transaction found for client_transfer_id: ${clientTransferId}, proceeding with normal processing`,
      );
    }

    return false;
  }

  /**
   * Handle first deposit bonus points and stablecoin reward
   */
  private async handleFirstDepositBonus(
    fiatWalletTransaction: FiatWalletTransactionModel,
    externalAccount: ExternalAccountModel,
  ): Promise<void> {
    const lockKey = `first_deposit_bonus_${externalAccount.user_id}`;

    await this.lockerService.runWithLock(lockKey, async () => {
      try {
        // Limit 2 to distinguish "exactly 1" from "more than 1" without scanning entire table
        const completedDeposits = await this.fiatWalletTransactionRepository
          .query()
          .where({
            user_id: externalAccount.user_id,
            transaction_type: FiatWalletTransactionType.DEPOSIT,
            status: TransactionStatus.COMPLETED,
            currency: 'USD',
          })
          .limit(2)
          .select('id');

        if (completedDeposits.length !== 1) {
          this.logger.log(`Skipping first deposit bonus for user ${externalAccount.user_id}: not first USD deposit`);
          return;
        }

        const provider = EnvironmentService.getValue('DEFAULT_USD_FIAT_WALLET_PROVIDER');

        // Credit Dosh Points for first deposit (10 points)
        // Store all data needed for retroactive reward processing if user opts in
        const firstDepositResult = await this.doshPointsTransactionService.creditPoints({
          user_id: externalAccount.user_id,
          event_code: DoshPointsEventCode.FIRST_DEPOSIT_USD,
          source_reference: provider,
          description: 'First USD deposit bonus',
          metadata: {
            deposit: {
              amount: fiatWalletTransaction.amount,
              fiat_wallet_id: fiatWalletTransaction.fiat_wallet_id,
              external_account_id: externalAccount.id,
              participant_code: externalAccount.participant_code,
            },
          },
        });

        // If this is a duplicate (already processed), skip the rest
        if (firstDepositResult.is_duplicate) {
          this.logger.log(`First deposit bonus already processed for user ${externalAccount.user_id}, skipping`);
          return;
        }

        this.logger.log(`Successfully credited first deposit points for user ${externalAccount.user_id}`);

        // Check if user has already opted in to stablecoin rewards
        const doshPointsAccount = await this.doshPointsAccountService.findOrCreate(externalAccount.user_id);

        if (doshPointsAccount.usd_fiat_rewards_enabled === true) {
          this.logger.log(
            `User ${externalAccount.user_id} is already opted in to stablecoin rewards, processing first deposit match`,
          );

          // Create FIRST_DEPOSIT_USD_MATCH tracking transaction
          const matchResult = await this.doshPointsTransactionService.creditPoints({
            user_id: externalAccount.user_id,
            event_code: DoshPointsEventCode.FIRST_DEPOSIT_USD_MATCH,
            source_reference: provider,
            description: 'First USD deposit match reward',
          });

          // Queue reward if not a duplicate
          if (!matchResult.is_duplicate) {
            await this.usdFiatRewardsProcessor.queueCreditFirstDepositReward({
              userId: externalAccount.user_id,
              participantCode: externalAccount.participant_code,
              depositAmount: fiatWalletTransaction.amount,
              fiatWalletId: fiatWalletTransaction.fiat_wallet_id,
              externalAccountId: externalAccount.id,
            });
            this.logger.log(`Queued first deposit match reward for user ${externalAccount.user_id}`);
          }
        } else {
          this.logger.log(
            `User ${externalAccount.user_id} has not opted in yet. First deposit match will be processed if they opt in later.`,
          );
        }
      } catch (error) {
        this.logger.error(
          `Failed to credit first deposit points for user ${externalAccount.user_id}: ${error.message}`,
          error,
        );
        // Do not rethrow - deposit should complete even if points credit fails
      }
    });
  }

  private async processTransferMovement(
    movement: ZeroHashBalanceMovement,
    externalAccount: ExternalAccountModel,
    payload: ZeroHashAccountBalanceChangedPayload,
  ): Promise<void> {
    const { transfer_request_id } = movement;
    let { client_transfer_id } = movement;

    this.logger.log(
      `Processing transfer for participant_code: ${payload.participant_code}, transfer_request_id: ${transfer_request_id}`,
    );

    // Fetch client_transfer_id from ZeroHash API
    let transferDetails;
    try {
      this.logger.log(`Fetching transfer details from ZeroHash API for transfer_request_id: ${transfer_request_id}`);
      transferDetails = await this.fiatWalletAdapter.getTransferDetails(transfer_request_id, externalAccount.provider);
      client_transfer_id = transferDetails.providerReference;
      this.logger.log(`Fetched client_transfer_id: ${client_transfer_id} from ZeroHash API`);
    } catch (error) {
      this.logger.error(`Failed to fetch transfer details for transfer_request_id: ${transfer_request_id}`, error);
      return;
    }

    // Find both sender and receiver transactions
    const senderRef = `${client_transfer_id}-OUT`;
    const receiverRef = `${client_transfer_id}-IN`;

    try {
      // Find both transactions
      const [senderTransaction, receiverTransaction] = await Promise.all([
        this.transactionRepository.findOne({ reference: senderRef }),
        this.transactionRepository.findOne({ reference: receiverRef }),
      ]);

      // Check if both transactions exist
      if (!senderTransaction || !receiverTransaction) {
        this.logger.error(
          `Transaction not found for client_transfer_id: ${client_transfer_id}. Both sender and receiver transactions must exist.`,
        );
        return;
      }

      this.logger.log(
        `Found both transactions - Sender: ${senderTransaction.id} (user: ${senderTransaction.user_id}), Receiver: ${receiverTransaction.id} (user: ${receiverTransaction.user_id})`,
      );

      // Determine which transaction belongs to the current participant
      const currentTransaction = this.determineCurrentTransaction(
        senderTransaction,
        receiverTransaction,
        externalAccount.user_id,
      );
      if (!currentTransaction) return;

      // Find the fiat wallet transaction for the current user
      const fiatWalletTransaction = await this.fiatWalletTransactionService.findOne({
        transaction_id: currentTransaction.id,
      });

      // Get the fiat wallet for the current user
      const fiatWallet = await this.fiatWalletService.getUserWallet(
        externalAccount.user_id,
        fiatWalletTransaction.currency,
      );

      // Convert balance from payload to smallest unit (cents)
      const newBalanceInMainUnit = Number(payload.balance);
      const newBalanceInSmallestUnit = CurrencyUtility.formatCurrencyAmountToSmallestUnit(
        newBalanceInMainUnit,
        fiatWalletTransaction.currency,
      );

      this.logger.log(
        `Updating wallet balance from ${payload.balance} ${payload.asset} to ${newBalanceInSmallestUnit} in smallest unit`,
      );

      const balanceBefore = fiatWallet.balance;
      const balanceAfter = newBalanceInSmallestUnit;
      const amount = subtract(balanceAfter, balanceBefore);

      // Merge existing metadata with webhook payload
      const existingTransactionMetadata = (currentTransaction.metadata || {}) as MetadataWithWebhookHistory;
      const mergedTransactionMetadata = this.mergeMetadataWithWebhookPayload(
        existingTransactionMetadata,
        {},
        ZeroHashWebhookEventType.ACCOUNT_BALANCE_CHANGED,
        payload,
      );

      // Get both sender and recipient information
      const otherTransaction = currentTransaction.id === senderTransaction.id ? receiverTransaction : senderTransaction;
      const isSender = currentTransaction.id === senderTransaction.id;

      // Get both users with country information in a single optimized call each
      let currentUserName: string | undefined;
      let currentUserCountry: string | undefined;
      let otherUserName: string | undefined;
      let otherUserCountry: string | undefined;

      try {
        // Fetch both users with country information in parallel using the repository method that includes country
        const [currentUserWithCountry, otherUserWithCountry] = await Promise.all([
          this.userRepository.findActiveById(currentTransaction.user_id),
          this.userRepository.findActiveById(otherTransaction.user_id),
        ]);

        // Extract current user info
        if (currentUserWithCountry) {
          const fullName =
            `${currentUserWithCountry.first_name || ''} ${currentUserWithCountry.last_name || ''}`.trim();
          currentUserName = fullName;
          currentUserCountry = currentUserWithCountry.country?.name;
        }

        // Extract other user info
        if (otherUserWithCountry) {
          const fullName = `${otherUserWithCountry.first_name || ''} ${otherUserWithCountry.last_name || ''}`.trim();
          otherUserName = fullName;
          otherUserCountry = otherUserWithCountry.country?.name;
        }
      } catch (error) {
        this.logger.warn(`Could not fetch user details for transfer participants:`, error);
      }

      // Determine sender and recipient names based on current user's perspective
      const senderName = isSender ? currentUserName : otherUserName;
      const recipientName = isSender ? otherUserName : currentUserName;
      const recipientLocation = isSender ? otherUserCountry : currentUserCountry;

      // Merge existing fiat wallet transaction metadata with webhook payload
      const existingFwtMetadata = (fiatWalletTransaction.provider_metadata || {}) as MetadataWithWebhookHistory;
      const mergedFwtMetadata = this.mergeMetadataWithWebhookPayload(
        existingFwtMetadata,
        {},
        ZeroHashWebhookEventType.ACCOUNT_BALANCE_CHANGED,
        payload,
      );

      // Use a transaction to update wallet balance and emit event
      await this.fiatWalletRepository.transaction(async (trx) => {
        // Update wallet balance using the service method (emits event automatically)
        await this.fiatWalletService.updateBalanceWithTransaction(
          fiatWallet.id,
          amount,
          currentTransaction.id,
          TransactionStatus.COMPLETED,
          {
            fiat_wallet_transaction_id: fiatWalletTransaction.id,
          },
          fiatWallet,
          balanceBefore,
          balanceAfter,
          async () => fiatWalletTransaction, // Return existing transaction instead of creating new one
          trx,
        );

        // Update the fiat wallet transaction metadata and provider reference
        await this.fiatWalletTransactionRepository.update(
          fiatWalletTransaction.id,
          {
            provider_metadata: mergedFwtMetadata,
            provider_request_ref: transfer_request_id,
          },
          { trx },
        );

        // Update the main transaction using TransactionService to trigger notifications
        await this.transactionService.updateStatus(
          currentTransaction.id,
          TransactionStatus.COMPLETED,
          {
            balance_after: newBalanceInSmallestUnit,
            completed_at: DateTime.now().toISO(),
            provider_reference: client_transfer_id, // Store client_transfer_id as external_reference
            provider_metadata: mergedTransactionMetadata,
            description: fiatWalletTransaction.description,
            source: fiatWalletTransaction.source,
            destination: fiatWalletTransaction.destination,
            provider_fee: fiatWalletTransaction.provider_fee,
            recipient: recipientName,
            participant_code: payload.participant_code,
            sender_name: senderName,
            recipient_name: recipientName,
            recipient_location: recipientLocation,
          },
          trx,
        );

        // Track transaction aggregate for completed P2P transfer
        try {
          await this.transactionAggregateService.findAndUpdate(
            'zerohash',
            currentTransaction.transaction_type,
            Math.abs(Number(amount)),
          );
        } catch (error) {
          this.logger.error(
            `Failed to update transaction aggregate for transaction ${currentTransaction.id}: ${error.message}`,
            error.stack,
          );
          // Don't throw - aggregate tracking is non-critical
        }
      });

      this.logger.log(
        `Successfully processed transfer for participant ${payload.participant_code}: wallet balance set to ${payload.balance} ${payload.asset} (${newBalanceInSmallestUnit} in smallest unit)`,
      );
    } catch (error) {
      if (error instanceof NotFoundException) {
        this.logger.error(
          `Transaction not found for client_transfer_id: ${client_transfer_id}. Both sender and receiver transactions must exist.`,
        );
      } else {
        this.logger.error(`Error processing transfer movement:`, error);
        throw error;
      }
    }
  }

  private determineCurrentTransaction(
    senderTransaction: TransactionModel,
    receiverTransaction: TransactionModel,
    userId: string,
  ): TransactionModel | null {
    if (senderTransaction.user_id === userId) {
      this.logger.log(`Current participant is the sender`);
      return senderTransaction;
    } else if (receiverTransaction.user_id === userId) {
      this.logger.log(`Current participant is the receiver`);
      return receiverTransaction;
    } else {
      this.logger.error(`Neither transaction belongs to current participant user_id: ${userId}`);
      return null;
    }
  }

  private async processPaymentStatusChanged(payload: ZeroHashPaymentStatusChangedPayload): Promise<void> {
    const { transaction_id: transactionId, payment_status } = payload;
    const paymentStatus = payment_status?.toLowerCase();

    if (!transactionId || !paymentStatus) {
      this.logger.warn('Missing transaction_id or payment_status in webhook payload');
      return;
    }

    try {
      // Find transaction by external_reference
      const transaction = await this.transactionService.findOne({ external_reference: transactionId });

      // Map ZeroHash payment status to our transaction status
      const mappedStatus = this.mapPaymentStatusToTransactionStatus(paymentStatus);

      if (!mappedStatus) {
        this.logger.warn(`Unknown payment_status received: ${paymentStatus}. Skipping update.`);
        return;
      }

      const currentStatus = transaction.status;
      const failureReason =
        mappedStatus === TransactionStatus.FAILED
          ? this.buildFailureReason(
              payload.reason_code,
              payload.reason_description,
              payload.ach_failure_reason,
              payload.rejected_reason,
            )
          : undefined;

      const providerMetadata = this.buildProviderMetadata(payload);

      // Merge existing metadata with new webhook payload
      const existingMetadata = (transaction.metadata || {}) as MetadataWithWebhookHistory;
      const mergedMetadata = this.mergeMetadataWithWebhookPayload(
        existingMetadata,
        providerMetadata,
        ZeroHashWebhookEventType.PAYMENT_STATUS_CHANGED,
        payload,
      );

      // Get fiat wallet transaction for description and source/destination data
      let description = 'Transaction';
      let source = 'External Account';
      let destination = 'External Account';
      let provider_fee: number | undefined;

      try {
        const fiatWalletTransaction = await this.fiatWalletTransactionService.findOne({
          transaction_id: transaction.id,
        });

        if (fiatWalletTransaction) {
          description = fiatWalletTransaction.description || description;
          source = fiatWalletTransaction.source || source;
          destination = fiatWalletTransaction.destination || destination;
          provider_fee = fiatWalletTransaction.provider_fee;
        }
      } catch (error) {
        this.logger.warn(`Could not fetch fiat wallet transaction for transaction ${transaction.id}:`, error);
      }

      // Extract participant_code from payload
      const participantCode = this.extractParticipantCode(payload);

      // Handle settled status separately - only update fiat wallet transaction's settled_at
      if (mappedStatus === TransactionStatus.SETTLED) {
        await this.updateFiatWalletTransactionSettled(transaction, providerMetadata, payload);
        return;
      }

      // Prevent downgrading from completed status to any other status
      if (currentStatus === TransactionStatus.COMPLETED && mappedStatus !== TransactionStatus.COMPLETED) {
        this.logger.warn(
          `Ignoring status downgrade from completed to ${mappedStatus} for transaction ${transaction.id}. Current: ${currentStatus}, Attempted: ${mappedStatus}`,
        );
        return;
      }

      await this.transactionService.updateStatus(transaction.id, mappedStatus, {
        failure_reason: failureReason,
        provider_metadata: mergedMetadata,
        description,
        source,
        destination,
        provider_fee,
        participant_code: participantCode,
      });

      const failureReasonSuffix = failureReason ? ` (${failureReason})` : '';
      this.logger.log(
        `Transaction id=${transaction.id} status: ${currentStatus} → ${mappedStatus}${failureReasonSuffix}`,
      );

      await this.updateFiatWalletTransactionIfNeeded(
        transaction,
        mappedStatus,
        providerMetadata,
        payload,
        failureReason,
      );
    } catch (error) {
      this.logger.error(`Error processing payment status change for transaction_id=${transactionId}:`, error);
      throw error;
    }
  }

  private buildProviderMetadata(payload: ZeroHashPaymentStatusChangedPayload): ZeroHashProviderMetadata {
    return {
      zerohash_payment_status: payload.payment_status,
      reason_code: payload.reason_code,
      reason_description: payload.reason_description,
      ach_failure_reason: payload.ach_failure_reason,
      rejected_reason: payload.rejected_reason,
    };
  }

  /**
   * Merges existing metadata with new provider metadata and appends webhook payload
   */
  private mergeMetadataWithWebhookPayload(
    existingMetadata: MetadataWithWebhookHistory,
    newProviderMetadata: ZeroHashProviderMetadata,
    eventType: ZeroHashWebhookEventType,
    payload: ZeroHashWebhookPayload,
  ): MetadataWithWebhookHistory {
    const MAX_WEBHOOK_HISTORY = 5;
    const existingPayloads = existingMetadata.webhook_payloads || [];

    // Keep only the most recent webhooks to prevent unbounded memory growth
    const recentPayloads = existingPayloads.slice(-MAX_WEBHOOK_HISTORY + 1);

    return {
      ...existingMetadata,
      ...newProviderMetadata,
      webhook_payloads: [
        ...recentPayloads,
        {
          timestamp: DateTime.now().toISO(),
          event_type: eventType,
          payload: payload,
        },
      ],
    };
  }

  private async updateFiatWalletTransactionIfNeeded(
    transaction: TransactionModel,
    mappedStatus: TransactionStatus,
    providerMetadata: ZeroHashProviderMetadata,
    payload: ZeroHashPaymentStatusChangedPayload,
    failureReason?: string,
  ): Promise<void> {
    const isTerminalFailureState = [TransactionStatus.FAILED, TransactionStatus.CANCELLED].includes(mappedStatus);

    if (!isTerminalFailureState) {
      return;
    }

    try {
      const fiatWalletTransaction = await this.fiatWalletTransactionService.findOne({
        transaction_id: transaction.id,
      });

      // Merge existing metadata with new webhook payload
      const existingMetadata = (fiatWalletTransaction.provider_metadata || {}) as MetadataWithWebhookHistory;
      const mergedMetadata = this.mergeMetadataWithWebhookPayload(
        existingMetadata,
        providerMetadata,
        ZeroHashWebhookEventType.PAYMENT_STATUS_CHANGED,
        payload,
      );

      await this.fiatWalletTransactionService.updateStatus(fiatWalletTransaction.id, mappedStatus, {
        failure_reason: failureReason,
        provider_metadata: mergedMetadata,
      });

      const failureReasonSuffix = failureReason ? ` (${failureReason})` : '';
      this.logger.log(
        `FiatWalletTransaction id=${fiatWalletTransaction.id} status updated to: ${mappedStatus}${failureReasonSuffix}`,
      );

      // Queue deletion of exchange virtual account on failure
      if (transaction.transaction_type === TransactionType.EXCHANGE) {
        await this.virtualAccountService.scheduleExchangeVirtualAccountDeletion(
          transaction.user_id,
          transaction.id,
          failureReason || 'Transaction failed',
        );
      }
    } catch (error) {
      if (error instanceof NotFoundException) {
        this.logger.warn(`No fiat wallet transaction found for transaction ID: ${transaction.id}`);
      } else {
        this.logger.error(`Error updating fiat wallet transaction status: ${error.message}`);
      }
    }
  }

  /**
   * Updates fiat wallet transaction with settled_at timestamp and provider_metadata
   * Called when payment_status is 'settled' - does not change status or completed_at
   */
  private async updateFiatWalletTransactionSettled(
    transaction: TransactionModel,
    providerMetadata: ZeroHashProviderMetadata,
    payload: ZeroHashPaymentStatusChangedPayload,
  ): Promise<void> {
    try {
      const fiatWalletTransaction = await this.fiatWalletTransactionService.findOne({
        transaction_id: transaction.id,
      });

      // Merge existing metadata with new webhook payload
      const existingMetadata = (fiatWalletTransaction.provider_metadata || {}) as MetadataWithWebhookHistory;
      const mergedMetadata = this.mergeMetadataWithWebhookPayload(
        existingMetadata,
        providerMetadata,
        ZeroHashWebhookEventType.PAYMENT_STATUS_CHANGED,
        payload,
      );

      const settledAt = DateTime.fromMillis(payload.timestamp).toISO();
      await this.fiatWalletTransactionRepository.update(fiatWalletTransaction.id, {
        settled_at: settledAt,
        provider_metadata: mergedMetadata,
      });

      this.logger.log(`FiatWalletTransaction id=${fiatWalletTransaction.id} settled at: ${settledAt}`);
    } catch (error) {
      if (error instanceof NotFoundException) {
        this.logger.warn(`No fiat wallet transaction found for transaction ID: ${transaction.id}`);
      } else {
        this.logger.error(`Error updating fiat wallet transaction settled_at: ${error.message}`);
      }
    }
  }

  private mapPaymentStatusToTransactionStatus(paymentStatus: string): TransactionStatus | null {
    const statusMap: Record<string, TransactionStatus> = {
      submitted: TransactionStatus.PENDING,
      pending: TransactionStatus.PENDING,
      pending_trade: TransactionStatus.PENDING,
      posted: TransactionStatus.PROCESSING,
      settled: TransactionStatus.SETTLED,
      cancelled: TransactionStatus.CANCELLED,
      failed: TransactionStatus.FAILED,
      returned: TransactionStatus.FAILED,
      rejected: TransactionStatus.FAILED,
      retried: TransactionStatus.PROCESSING,
    };

    return statusMap[paymentStatus] || null;
  }

  private async processTradeStatusChanged(payload: ZeroHashTradeStatusChangedPayload): Promise<void> {
    const clientTradeId = payload.client_trade_id;
    const tradeState = payload.trade_state?.toLowerCase();
    const tradeId = payload.trade_id;
    const symbol = payload.symbol;
    const tradePrice = payload.trade_price;
    const tradeQuantity = payload.trade_quantity;
    const totalNotional = payload.total_notional;

    if (!clientTradeId || !tradeState) {
      this.logger.warn('Missing client_trade_id or trade_state in trade.status_changed webhook payload');
      return;
    }

    // Map ZeroHash trade state to our transaction status
    const mappedStatus = this.mapTradeStateToTransactionStatus(tradeState);

    if (!mappedStatus) {
      this.logger.warn(`Unknown trade_state received: ${tradeState}. Skipping update.`);
      return;
    }

    // Prepare additional metadata
    const providerMetadata: ZeroHashProviderMetadata = {
      zerohash_trade_state: tradeState,
      trade_id: tradeId,
      symbol: symbol,
      trade_price: tradePrice,
      trade_quantity: tradeQuantity,
      total_notional: totalNotional,
      parties: payload.parties,
      timestamp: payload.timestamp,
      transaction_timestamp: payload.transaction_timestamp,
    };

    try {
      // Find and update the fiat wallet transaction by provider_quote_ref
      const fiatWalletTransaction = await this.fiatWalletTransactionService.findOne({
        provider_quote_ref: clientTradeId,
      });

      const currentStatus = fiatWalletTransaction.status;

      // Merge existing metadata with new webhook payload
      const existingMetadata = (fiatWalletTransaction.provider_metadata || {}) as MetadataWithWebhookHistory;
      const mergedMetadata = this.mergeMetadataWithWebhookPayload(
        existingMetadata,
        providerMetadata,
        ZeroHashWebhookEventType.TRADE_STATUS_CHANGED,
        payload,
      );

      // Prepare update metadata object
      const updateMetadata: {
        provider_metadata: MetadataWithWebhookHistory;
        provider_reference?: string;
      } = {
        provider_metadata: mergedMetadata,
      };

      // Always update provider_reference with trade_id if we have one and it's not already set
      // This ensures the trade_id is stored regardless of webhook order
      if (tradeId && fiatWalletTransaction.provider_reference !== tradeId) {
        updateMetadata.provider_reference = tradeId;
        this.logger.log(
          `Updating provider_reference with trade_id ${tradeId} for fiat wallet transaction ${fiatWalletTransaction.id}`,
        );
      }

      await this.fiatWalletTransactionService.updateStatus(fiatWalletTransaction.id, mappedStatus, updateMetadata);

      this.logger.log(
        `FiatWalletTransaction id=${fiatWalletTransaction.id} status: ${currentStatus} → ${mappedStatus} (trade ${tradeId})`,
      );
    } catch (error) {
      if (error instanceof NotFoundException) {
        this.logger.warn(`No fiat wallet transaction found for provider_quote_ref: ${clientTradeId}`);
        return;
      }
      this.logger.error(`Error processing trade status change for client_trade_id=${clientTradeId}:`, error);
      throw error;
    }
  }

  private mapTradeStateToTransactionStatus(tradeState: string): TransactionStatus | null {
    const statusMap: Record<string, TransactionStatus> = {
      [ZeroHashTradeState.ACTIVE]: TransactionStatus.PENDING,
      [ZeroHashTradeState.PENDING]: TransactionStatus.PENDING,
      [ZeroHashTradeState.ACCEPTED]: TransactionStatus.PROCESSING,
      [ZeroHashTradeState.TERMINATED]: TransactionStatus.COMPLETED,
      [ZeroHashTradeState.REJECTED]: TransactionStatus.FAILED,
      [ZeroHashTradeState.CANCELLED]: TransactionStatus.CANCELLED,
      [ZeroHashTradeState.EXPIRED]: TransactionStatus.FAILED,
      [ZeroHashTradeState.SETTLED]: TransactionStatus.COMPLETED,
    };

    return statusMap[tradeState] || null;
  }

  private buildFailureReason(
    reasonCode?: string,
    reasonDescription?: string,
    achFailureReason?: string,
    rejectedReason?: string,
  ): string {
    const reasons: string[] = [];

    if (reasonCode) {
      reasons.push(`Code: ${reasonCode}`);
    }

    if (reasonDescription) {
      reasons.push(`Description: ${reasonDescription}`);
    }

    if (achFailureReason) {
      reasons.push(`ACH Failure: ${achFailureReason}`);
    }

    if (rejectedReason) {
      reasons.push(`Rejected: ${rejectedReason}`);
    }

    return reasons.length > 0 ? reasons.join(', ') : 'Payment failed';
  }

  private async processWithdrawalConfirmed(
    movement: ZeroHashBalanceMovement,
    externalAccount: ExternalAccountModel,
    payload: ZeroHashAccountBalanceChangedPayload,
  ): Promise<void> {
    const { withdrawal_request_id, change } = movement;

    this.logger.log(
      `Processing withdrawal_confirmed for withdrawal_request_id: ${withdrawal_request_id}, user_id: ${externalAccount.user_id}, change: ${change}`,
    );

    const lockKey = `withdrawal_${withdrawal_request_id}`;

    await this.lockerService.runWithLock(lockKey, async () => {
      try {
        // Find the fiat wallet transaction by provider_request_ref (withdrawal_request_id)
        const fiatWalletTransaction = await this.fiatWalletTransactionService.findOne({
          provider_request_ref: withdrawal_request_id,
          user_id: externalAccount.user_id,
        });

        if (!fiatWalletTransaction) {
          this.logger.warn(
            `No fiat wallet transaction found for withdrawal_request_id: ${withdrawal_request_id} (provider_request_ref), user_id: ${externalAccount.user_id}`,
          );
          return;
        }

        const transaction = await this.transactionService.findOne({ id: fiatWalletTransaction.transaction_id });

        if (!transaction) {
          this.logger.warn(
            `No transaction found for fiat wallet transaction: id=${fiatWalletTransaction.id}, transaction_id=${fiatWalletTransaction.transaction_id}`,
          );
          throw new NotFoundException(
            `No transaction found for fiat wallet transaction: id=${fiatWalletTransaction.id}, transaction_id=${fiatWalletTransaction.transaction_id}`,
          );
        }

        this.logger.debug('Processing withdrawal_confirmed', {
          withdrawal_request_id,
          fiatWalletTransactionId: fiatWalletTransaction.id,
        });

        // Skip if already completed
        if (fiatWalletTransaction.status?.toLowerCase() === TransactionStatus.COMPLETED.toLowerCase()) {
          this.logger.warn(
            `Fiat wallet transaction is already in COMPLETED status: id=${fiatWalletTransaction.id}, status=${fiatWalletTransaction.status}, SKIPPING...`,
          );
          return;
        }

        // Skip if not in processing state
        if (fiatWalletTransaction.status?.toLowerCase() !== TransactionStatus.PROCESSING.toLowerCase()) {
          this.logger.warn(
            `Fiat wallet transaction is not in PROCESSING status: id=${fiatWalletTransaction.id}, status=${fiatWalletTransaction.status}, SKIPPING...`,
          );
          return;
        }

        this.logger.log(
          `Found fiat wallet transaction: id=${fiatWalletTransaction.id}, transaction_id=${fiatWalletTransaction.transaction_id}`,
        );

        // Get withdrawal details from ZeroHash to fetch the transaction_id
        const withdrawalDetails = await this.fiatWalletAdapter.getWithdrawalDetails(withdrawal_request_id, 'zerohash');

        this.logger.log(
          `Withdrawal details fetched: transaction_id=${withdrawalDetails.externalReference}, status=${withdrawalDetails.status}`,
        );

        // Calculate balance_after using balance_before + change from webhook
        // Convert change to smallest unit (cents) and add to balance_before
        const changeAmountInMainUnit = Number(change);
        const changeAmountInSmallestUnit = CurrencyUtility.formatCurrencyAmountToSmallestUnit(
          changeAmountInMainUnit,
          fiatWalletTransaction.currency,
        );
        const balanceBefore = Number(fiatWalletTransaction.balance_before);
        const balanceAfter = add(balanceBefore, changeAmountInSmallestUnit);

        this.logger.log(
          `Calculating balance: balance_before=${balanceBefore}, change=${changeAmountInMainUnit} (${changeAmountInSmallestUnit} in smallest unit), balance_after=${balanceAfter}`,
        );

        // Update the source fiat wallet balance - deduct the change amount from balance and add to credit_balance
        const sourceWallet = await this.fiatWalletRepository.findById(fiatWalletTransaction.fiat_wallet_id);

        if (sourceWallet) {
          const currentBalance = Number(sourceWallet.balance);
          const currentCreditBalance = Number(sourceWallet.credit_balance);
          const absoluteChangeAmount = abs(changeAmountInSmallestUnit);

          await this.fiatWalletRepository.update(sourceWallet.id, {
            balance: subtract(currentBalance, absoluteChangeAmount),
            credit_balance: add(currentCreditBalance, absoluteChangeAmount),
          });

          this.logger.log(
            `Updated source wallet balance: ${currentBalance} -> ${subtract(currentBalance, absoluteChangeAmount)}, credit_balance: ${currentCreditBalance} -> ${add(currentCreditBalance, absoluteChangeAmount)}`,
          );
        }

        // Update the main transaction with the external_reference and completion status
        if (fiatWalletTransaction.transaction_id) {
          // Extract provider_fee from fiat wallet transaction or transaction metadata
          let provider_fee: number | undefined = fiatWalletTransaction.provider_fee;

          if (provider_fee == null) {
            const metadata = (transaction.metadata ?? {}) as {
              fee?: unknown;
              provider_metadata?: { fee?: unknown };
            };

            const metadataFee = typeof metadata.fee === 'number' ? metadata.fee : undefined;
            const providerMetadataFee =
              typeof metadata.provider_metadata?.fee === 'number' ? metadata.provider_metadata.fee : undefined;

            provider_fee = metadataFee ?? providerMetadataFee;
          }

          const updateMetadata: ITransactionUpdateMetadata = {
            balance_after: balanceAfter,
            completed_at: DateTime.now().toISO(),
            participant_code: externalAccount.participant_code,
            description: transaction.description,
            source: fiatWalletTransaction.source,
            destination: fiatWalletTransaction.destination,
            provider_fee,
          };

          if (withdrawalDetails.externalReference) {
            updateMetadata.provider_metadata = {
              ...transaction.metadata,
              transactionHash: withdrawalDetails.externalReference,
            };
          }

          await this.transactionService.updateStatus(
            fiatWalletTransaction.transaction_id,
            TransactionStatus.COMPLETED,
            updateMetadata,
            undefined,
            {
              shouldSendInAppNotification: false,
              shouldSendEmail: false,
              shouldSendPushNotification: false,
            },
          );

          // Track transaction aggregate for completed ACH withdrawal
          try {
            await this.transactionAggregateService.findAndUpdate(
              'zerohash',
              fiatWalletTransaction.transaction_type,
              Math.abs(Number(changeAmountInSmallestUnit)),
            );
          } catch (error) {
            this.logger.error(
              `Failed to update transaction aggregate for transaction ${fiatWalletTransaction.transaction_id}: ${error.message}`,
              error.stack,
            );
            // Don't throw - aggregate tracking is non-critical
          }

          this.logger.log(
            `Updated transaction to COMPLETED: transaction_id=${fiatWalletTransaction.transaction_id}, external_reference=${withdrawalDetails.externalReference}, balance_after=${balanceAfter}`,
          );
        }

        // Merge existing metadata with new webhook payload
        const existingMetadata = (fiatWalletTransaction.provider_metadata || {}) as MetadataWithWebhookHistory;
        const withdrawalMetadata: ZeroHashProviderMetadata = {
          withdrawal_status: withdrawalDetails.status,
          withdrawal_confirmed_at: payload.timestamp,
        };
        const mergedMetadata = this.mergeMetadataWithWebhookPayload(
          existingMetadata,
          withdrawalMetadata,
          ZeroHashWebhookEventType.ACCOUNT_BALANCE_CHANGED,
          payload,
        );

        await this.fiatWalletTransactionRepository.update(fiatWalletTransaction.id, {
          status: TransactionStatus.COMPLETED, // the funds have been withdrawn from the source wallet
          balance_after: balanceAfter,
          completed_at: DateTime.now().toISO(),
          provider_metadata: mergedMetadata,
        });

        this.logger.log(
          `Updated fiat wallet transaction to COMPLETED: id=${fiatWalletTransaction.id}, balance_after=${balanceAfter}`,
        );

        // Create incoming NGN transaction for exchange account with shared lock
        // This lock is shared with YellowCard and Paga webhooks to ensure sequential processing
        const exchangeWebhookLockKey = `exchange_webhook_${transaction.id}`;
        const exchangeWebhookLockOptions = { ttl: 240000, retryCount: 60, retryDelay: 4000 };

        await this.lockerService.runWithLock(
          exchangeWebhookLockKey,
          async () => {
            await this.createIncomingNgnTransaction(transaction, withdrawal_request_id);
          },
          exchangeWebhookLockOptions,
        );

        // YellowCard doesn't send payment complete webhooks in test environments,
        // so we mock the webhook to simulate the complete payment flow for testing purposes
        if (!EnvironmentService.isProduction()) {
          this.logger.log('Mocking payment complete webhook', payload);
          await this.yellowCardWebhookService.mockPaymentCompleteWebhook(payload, transaction);
        }
      } catch (error) {
        this.logger.error(
          `Error processing withdrawal_confirmed for withdrawal_request_id=${withdrawal_request_id}:`,
          error,
        );
      }
    });
  }

  private async processWithdrawalPending(
    movement: ZeroHashBalanceMovement,
    externalAccount: ExternalAccountModel,
    payload: ZeroHashAccountBalanceChangedPayload,
  ): Promise<void> {
    const { withdrawal_request_id } = movement;

    this.logger.log(
      `Processing withdrawal_pending for withdrawal_request_id: ${withdrawal_request_id}, user_id: ${externalAccount.user_id}`,
    );

    const lockKey = `withdrawal_${withdrawal_request_id}`;
    await this.lockerService.runWithLock(lockKey, async () => {
      try {
        // Find the fiat wallet transaction by provider_request_ref (withdrawal_request_id)
        const fiatWalletTransaction = await this.fiatWalletTransactionService.findOne({
          provider_request_ref: withdrawal_request_id,
          user_id: externalAccount.user_id,
        });

        if (!fiatWalletTransaction) {
          this.logger.warn(
            `No fiat wallet transaction found for withdrawal_request_id: ${withdrawal_request_id}, user_id: ${externalAccount.user_id}`,
          );
          return;
        }

        // Skip if already completed
        if (fiatWalletTransaction.status?.toLowerCase() === TransactionStatus.COMPLETED.toLowerCase()) {
          this.logger.warn(
            `Fiat wallet transaction is already in COMPLETED status: id=${fiatWalletTransaction.id}, status=${fiatWalletTransaction.status}, SKIPPING withdrawal_pending...`,
          );
          return;
        }

        this.logger.log(
          `Found fiat wallet transaction: id=${fiatWalletTransaction.id}, transaction_id=${fiatWalletTransaction.transaction_id}, current status=${fiatWalletTransaction.status}`,
        );

        // Update the main transaction to PROCESSING status only if not already completed
        if (fiatWalletTransaction.transaction_id) {
          const mainTransaction = (await this.transactionRepository.findById(
            fiatWalletTransaction.transaction_id,
          )) as TransactionModel;

          if (mainTransaction.status?.toLowerCase() === TransactionStatus.COMPLETED.toLowerCase()) {
            this.logger.warn(
              `Main transaction is already COMPLETED: transaction_id=${mainTransaction.id}, SKIPPING withdrawal_pending update...`,
            );
            return;
          }

          await this.transactionRepository.update(fiatWalletTransaction.transaction_id, {
            status: TransactionStatus.PROCESSING,
            processed_at: DateTime.now().toISO(),
          });

          this.logger.log(`Updated transaction to PROCESSING: transaction_id=${fiatWalletTransaction.transaction_id}`);
        }

        // Update the fiat wallet transaction to PROCESSING status only
        // Merge existing metadata with new webhook payload
        const existingMetadata = (fiatWalletTransaction.provider_metadata || {}) as MetadataWithWebhookHistory;
        const pendingMetadata: ZeroHashProviderMetadata = {
          withdrawal_status: 'pending',
          withdrawal_pending_at: payload.timestamp,
        };
        const mergedMetadata = this.mergeMetadataWithWebhookPayload(
          existingMetadata,
          pendingMetadata,
          ZeroHashWebhookEventType.ACCOUNT_BALANCE_CHANGED,
          payload,
        );

        await this.fiatWalletTransactionRepository.update(fiatWalletTransaction.id, {
          status: TransactionStatus.PROCESSING,
          processed_at: DateTime.now().toISO(),
          provider_metadata: mergedMetadata,
        });

        this.logger.log(`Updated fiat wallet transaction to PROCESSING: id=${fiatWalletTransaction.id}`);
      } catch (error) {
        this.logger.error(
          `Error processing withdrawal_pending for withdrawal_request_id=${withdrawal_request_id}:`,
          error,
        );
      }
    });
  }

  /**
   * Creates the incoming NGN transaction when USD is withdrawn from exchange account
   */
  private async createIncomingNgnTransaction(
    parentTransaction: TransactionModel,
    sequenceId: string,
  ): Promise<TransactionModel | null> {
    try {
      this.logger.log('Creating incoming NGN transaction', { sequenceId, parentTransactionId: parentTransaction.id });

      // check if there is an existing incoming transaction for this sequence id
      const existingIncomingTransaction = await this.transactionRepository.findOne({
        parent_transaction_id: parentTransaction.id,
        asset: SUPPORTED_CURRENCIES.NGN.code,
      });

      if (existingIncomingTransaction) {
        this.logger.log('Incoming transaction already exists, skipping creation', {
          transactionId: existingIncomingTransaction.id,
        });
        return existingIncomingTransaction;
      }

      if (!parentTransaction.metadata?.rate_id) {
        this.logger.warn('Exchange rate not found in parent transaction metadata');
        return null;
      }

      const exchangeRate = await this.rateRepository.findOne({
        id: parentTransaction.metadata.rate_id,
      });

      if (!exchangeRate) {
        this.logger.warn('Exchange rate not found');
        return null;
      }

      const usdAmountInSmallestUnit = CurrencyUtility.formatCurrencyAmountToMainUnit(
        parentTransaction.amount,
        SUPPORTED_CURRENCIES.USD.code,
      );

      const rateConfig = await this.rateConfigRepository.findOne({
        provider: this.exchangeAdapter.getProviderName(),
      });

      if (!rateConfig?.isActive) {
        this.logger.warn('Rate config not found or inactive');
        return null;
      }

      const grossNgnAmount = multiply(exchangeRate.rate, usdAmountInSmallestUnit);

      // calculate the partner fee in USD first, then convert to NGN
      const partnerFeeConfig = rateConfig.fiatExchange?.partner_fee;
      const partnerFeeInUsd = partnerFeeConfig?.is_percentage
        ? multiply(usdAmountInSmallestUnit, divide(partnerFeeConfig?.value || 0, 100))
        : partnerFeeConfig?.value || 0;
      const partnerFee = multiply(partnerFeeInUsd, exchangeRate.rate);

      // calculate the disbursement fee in USD first, then convert to NGN
      // Percentage takes priority, if not percentage the fee is already in USD
      const disbursementFeeConfig = rateConfig.fiatExchange?.disbursement_fee;
      let disbursementFeeInUsd: number;
      if (disbursementFeeConfig?.is_percentage) {
        disbursementFeeInUsd = multiply(usdAmountInSmallestUnit, divide(disbursementFeeConfig?.value || 0, 100));
      } else {
        disbursementFeeInUsd = disbursementFeeConfig?.value || 0;
      }
      const disbursementFee = multiply(disbursementFeeInUsd, exchangeRate.rate);

      // calculate the ngn amount (floor to 2 decimal places to avoid fractional kobo)
      const koboAmount = floor(Number(subtract(grossNgnAmount, add(disbursementFee, partnerFee))));

      const fiatWallet = await this.fiatWalletService.getUserWallet(
        parentTransaction.user_id,
        SUPPORTED_CURRENCIES.NGN.code,
      );

      const balanceBefore = Number(fiatWallet.balance);
      const balanceAfter = add(balanceBefore, koboAmount);

      const childTransaction = await this.transactionRepository.transaction(async (trx) => {
        // Check if incoming transaction already exists using parent_transaction_id and asset only
        // This ensures we find child transactions regardless of which webhook created them
        let existingIncomingTransaction = (await this.transactionRepository
          .query(trx)
          .withGraphFetched('[fiatWalletTransaction]')
          .where({
            asset: SUPPORTED_CURRENCIES.NGN.code,
            parent_transaction_id: parentTransaction.id,
          })
          .forUpdate()
          .first()) as TransactionModel;

        if (existingIncomingTransaction) {
          this.logger.log('Incoming transaction already exists, updating status to PROCESSING', {
            transactionId: existingIncomingTransaction.id,
          });

          existingIncomingTransaction = await this.transactionService.updateStatus(
            existingIncomingTransaction.id,
            TransactionStatus.PROCESSING,
            {},
            trx,
          );

          if (existingIncomingTransaction.fiatWalletTransaction) {
            await this.fiatWalletTransactionService.updateStatus(
              existingIncomingTransaction.fiatWalletTransaction.id,
              TransactionStatus.PROCESSING,
              {},
              trx,
            );
          }
          return existingIncomingTransaction;
        }

        // Create new transaction
        const transaction = await this.transactionService.create(
          parentTransaction.user_id,
          {
            transaction_type: TransactionType.EXCHANGE,
            category: TransactionCategory.FIAT,
            transaction_scope: TransactionScope.INTERNAL,
            status: TransactionStatus.INITIATED,
            amount: koboAmount,
            asset: SUPPORTED_CURRENCIES.NGN.code,
            balance_before: balanceBefore,
            balance_after: balanceAfter,
            reference: UtilsService.generateTransactionReference(),
            metadata: {
              rate: exchangeRate.rate,
              rate_id: exchangeRate.id,
              shared_blockchain_transaction_ref: parentTransaction.metadata?.shared_blockchain_transaction_ref,
              created_by_provider: 'zerohash',
            },
            parent_transaction_id: parentTransaction.id,
            description: `Exchanged USD to NGN`,
            external_reference: sequenceId,
          },
          trx,
        );

        await this.fiatWalletTransactionService.create(
          parentTransaction.user_id,
          {
            transaction_id: transaction.id,
            amount: koboAmount,
            currency: SUPPORTED_CURRENCIES.NGN.code,
            status: TransactionStatus.PROCESSING,
            fiat_wallet_id: fiatWallet.id,
            transaction_type: FiatWalletTransactionType.EXCHANGE,
            provider_reference: sequenceId,
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

        return transaction;
      });

      return childTransaction;
    } catch (error) {
      this.logger.error('Error creating incoming NGN transaction', error);
      return null;
    }
  }

  private async processDepositMovement(
    movement: ZeroHashBalanceMovement,
    externalAccount: ExternalAccountModel,
    payload: ZeroHashAccountBalanceChangedPayload,
  ): Promise<void> {
    const { deposit_reference_id, change } = movement;

    this.logger.log(
      `Processing deposit for deposit_reference_id: ${deposit_reference_id}, user_id: ${externalAccount.user_id}, change: ${change}`,
    );

    try {
      // Convert change to smallest unit (cents) for USD
      const changeAmountInMainUnit = Number(change);
      const changeAmountInSmallestUnit = CurrencyUtility.formatCurrencyAmountToSmallestUnit(
        changeAmountInMainUnit,
        'USD',
      );

      this.logger.log(`Deposit amount: ${changeAmountInMainUnit} USD (${changeAmountInSmallestUnit} in smallest unit)`);

      // Find the blockchain wallet transaction by tx_hash to get the main_transaction_id
      const blockchainWalletTransaction =
        await this.blockchainWalletTransactionRepository.findByTransactionHash(deposit_reference_id);

      if (!blockchainWalletTransaction) {
        this.logger.warn(
          `No blockchain wallet transaction found for tx_hash: ${deposit_reference_id}, user_id: ${externalAccount.user_id}`,
        );
      }

      if (blockchainWalletTransaction) {
        // Debug: Log what we actually got back
        this.logger.debug(
          `Blockchain wallet transaction object:`,
          JSON.stringify(blockchainWalletTransaction, null, 2),
        );
        this.logger.debug(`main_transaction_id value: "${blockchainWalletTransaction.main_transaction_id}"`);
        this.logger.debug(`main_transaction_id type: ${typeof blockchainWalletTransaction.main_transaction_id}`);

        if (!blockchainWalletTransaction.main_transaction_id) {
          this.logger.warn(
            `No main_transaction_id found in blockchain wallet transaction: ${blockchainWalletTransaction.id}`,
          );
          return;
        }

        this.logger.log(
          `Found blockchain wallet transaction: id=${blockchainWalletTransaction.id}, main_transaction_id=${blockchainWalletTransaction.main_transaction_id}`,
        );

        // Get the user's USD fiat wallet
        const fiatWallet = await this.fiatWalletService.getUserWallet(externalAccount.user_id, 'USD');

        if (!fiatWallet) {
          this.logger.warn(`No USD fiat wallet found for user: ${externalAccount.user_id}`);
          return;
        }

        // Update the fiat wallet balance using the reusable updateBalance method
        await this.fiatWalletService.updateBalance(
          fiatWallet.id,
          changeAmountInSmallestUnit,
          blockchainWalletTransaction.main_transaction_id,
          FiatWalletTransactionType.DEPOSIT,
          TransactionStatus.COMPLETED,
          {
            description: `Crypto deposit to USD wallet`,
            provider: 'zerohash',
            provider_reference: deposit_reference_id,
            source: undefined,
            destination: 'USD Fiat Wallet',
            provider_metadata: {
              deposit_reference_id,
              asset: payload.asset,
              account_group: payload.account_group,
              movement_type: 'deposit',
              webhook_timestamp: payload.timestamp,
              blockchain_wallet_transaction_id: blockchainWalletTransaction.id,
            },
          },
        );

        this.logger.log(
          `Successfully processed deposit: wallet_id=${fiatWallet.id}, amount=${changeAmountInSmallestUnit}, reference=${deposit_reference_id}`,
        );
      }

      // get the transaction by the transaction hash (this is for the NG=>USD conversion to work)
      const transaction = (await this.transactionRepository.findOne(
        {
          external_reference: deposit_reference_id,
        },
        undefined,
        {
          graphFetch: '[user, user.country]',
        },
      )) as TransactionModel & { user: UserModel };

      if (transaction && transaction?.transaction_type?.toLowerCase() === TransactionType.EXCHANGE.toLowerCase()) {
        await this.transactionService.completeExchangeTransaction(transaction, changeAmountInSmallestUnit);
      } else if (!transaction) {
        // No transaction found - create placeholder for Yellow Card webhook to reconcile later
        this.logger.log(
          `No transaction found for deposit_reference_id: ${deposit_reference_id}, creating placeholder for reconciliation`,
        );
        await this.createPlaceholderTransactionForReconciliation(
          externalAccount.user_id,
          deposit_reference_id,
          changeAmountInSmallestUnit,
        );
      }
    } catch (error) {
      this.logger.error(`Error processing deposit for deposit_reference_id=${deposit_reference_id}:`, error);
    }
  }

  /**
   * Creates a placeholder transaction when Zero Hash webhook arrives before Yellow Card webhook
   * This allows the Yellow Card webhook to find and update the transaction later
   */
  private async createPlaceholderTransactionForReconciliation(
    userId: string,
    depositReferenceId: string,
    amountInSmallestUnit: number,
  ): Promise<TransactionModel> {
    try {
      this.logger.log(
        `Creating placeholder transaction for reconciliation: user=${userId}, hash=${depositReferenceId}, amount=${amountInSmallestUnit}`,
      );

      const placeholderTransaction = await this.transactionService.create(userId, {
        amount: amountInSmallestUnit,
        asset: SUPPORTED_CURRENCIES.USD.code,
        status: TransactionStatus.RECONCILE,
        balance_before: 0,
        balance_after: 0,
        reference: UtilsService.generateTransactionReference(),
        transaction_type: TransactionType.EXCHANGE,
        category: TransactionCategory.FIAT,
        transaction_scope: TransactionScope.INTERNAL,
        description: `Exchange pending reconciliation`,
        external_reference: depositReferenceId,
        metadata: {
          zerohash_webhook_received_at: new Date().toISOString(),
        },
      });

      this.logger.log(
        `Created placeholder transaction ${placeholderTransaction.id} for deposit_reference_id: ${depositReferenceId}`,
      );

      return placeholderTransaction;
    } catch (error) {
      this.logger.error(
        `Error creating placeholder transaction for deposit_reference_id=${depositReferenceId}:`,
        error,
      );
      throw error;
    }
  }
}
