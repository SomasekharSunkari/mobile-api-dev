import { Inject, Injectable, Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { min } from 'mathjs';
import { RewardsAdapter } from '../../../../adapters/rewards/rewards.adapter';
import { EnvironmentService } from '../../../../config';
import { CurrencyCode, CurrencyUtility } from '../../../../currencies/currencies';
import { DoshPointsEventCode } from '../../../../database/models/doshPointsEvent/doshPointsEvent.interface';
import { FiatWalletTransactionType } from '../../../../database/models/fiatWalletTransaction/fiatWalletTransaction.interface';
import {
  TransactionCategory,
  TransactionScope,
  TransactionStatus,
  TransactionType,
} from '../../../../database/models/transaction/transaction.interface';
import { DoshPointsAccountService } from '../../../../modules/doshPoints/doshPointsAccount/doshPointsAccount.service';
import { DoshPointsEventService } from '../../../../modules/doshPoints/doshPointsEvent/doshPointsEvent.service';
import { DoshPointsTransactionService } from '../../../../modules/doshPoints/doshPointsTransaction/doshPointsTransaction.service';
import { FiatWalletService } from '../../../../modules/fiatWallet/fiatWallet.service';
import { FiatWalletTransactionService } from '../../../../modules/fiatWalletTransactions/fiatWalletTransactions.service';
import { TransactionService } from '../../../../modules/transaction/transaction.service';
import { QueueService } from '../../queue.service';

export interface UsdFiatRewardsJobData {
  userId: string;
  participantCode: string;
  depositAmount: number;
  fiatWalletId: string;
  externalAccountId: string;
}

@Injectable()
export class UsdFiatRewardsProcessor {
  private readonly logger = new Logger(UsdFiatRewardsProcessor.name);
  private readonly queueName = 'usd-fiat-rewards';
  private processorsRegistered = false;

  @Inject(QueueService)
  private readonly queueService: QueueService;

  @Inject(RewardsAdapter)
  private readonly rewardsAdapter: RewardsAdapter;

  @Inject(DoshPointsAccountService)
  private readonly doshPointsAccountService: DoshPointsAccountService;

  @Inject(DoshPointsTransactionService)
  private readonly doshPointsTransactionService: DoshPointsTransactionService;

  @Inject(TransactionService)
  private readonly transactionService: TransactionService;

  @Inject(FiatWalletTransactionService)
  private readonly fiatWalletTransactionService: FiatWalletTransactionService;

  @Inject(FiatWalletService)
  private readonly fiatWalletService: FiatWalletService;

  @Inject(DoshPointsEventService)
  private readonly doshPointsEventService: DoshPointsEventService;

  /**
   * Register queue processors (called when first job is queued)
   */
  private registerProcessors() {
    if (this.processorsRegistered) return;

    this.queueService.processJobs<UsdFiatRewardsJobData>(
      this.queueName,
      'credit-first-deposit-reward',
      this.processCreditFirstDepositReward.bind(this),
      2,
    );

    this.processorsRegistered = true;
    this.logger.log('USD fiat rewards processors registered');
  }

  /**
   * Process the credit first deposit reward job
   */
  private async processCreditFirstDepositReward(job: Job<UsdFiatRewardsJobData>): Promise<any> {
    const { userId, participantCode, depositAmount, fiatWalletId, externalAccountId } = job.data;

    this.logger.log(`Processing first deposit USD fiat reward for user ${userId}`);

    // Track created transaction IDs for error handling
    let transactionId = null;
    let fiatWalletTransactionId = null;

    try {
      // Check if user is enrolled in USD fiat rewards
      const doshPointsAccount = await this.doshPointsAccountService.findOrCreate(userId);

      if (doshPointsAccount.usd_fiat_rewards_enabled !== true) {
        this.logger.log(`User ${userId} is not enrolled in USD fiat rewards, skipping`);
        return { status: 'skipped', reason: 'not_enrolled' };
      }

      await job.updateProgress(10);

      // Find the FIRST_DEPOSIT_USD_MATCH transaction to check if reward was already processed
      const provider = EnvironmentService.getValue('DEFAULT_USD_FIAT_WALLET_PROVIDER');
      const doshPointsTransaction = await this.doshPointsTransactionService.findOne({
        user_id: userId,
        event_code: DoshPointsEventCode.FIRST_DEPOSIT_USD_MATCH,
        source_reference: provider,
      });

      if (!doshPointsTransaction) {
        this.logger.warn(`No FIRST_DEPOSIT_USD_MATCH transaction found for user ${userId}, skipping USD fiat reward`);
        return { status: 'skipped', reason: 'no_dosh_points_transaction' };
      }

      // Check if reward was already processed by looking at dosh points metadata
      type RewardMetadata = { reward?: { transaction_id?: string } };
      const existingMetadata = doshPointsTransaction.metadata as RewardMetadata | null;
      if (existingMetadata?.reward?.transaction_id) {
        this.logger.log(`Reward already processed for dosh points transaction ${doshPointsTransaction.id}, skipping`);
        return { status: 'skipped', reason: 'already_processed' };
      }

      await job.updateProgress(20);

      // Get reward cap from event metadata
      const event = await this.doshPointsEventService.findByCode(DoshPointsEventCode.FIRST_DEPOSIT_USD_MATCH);
      const rewardCapUsd = Number(event.metadata?.usd_reward_cap);

      if (!rewardCapUsd || rewardCapUsd <= 0) {
        this.logger.warn(`Invalid reward cap for FIRST_DEPOSIT_USD_MATCH event, skipping reward`);
        return { status: 'skipped', reason: 'no_reward_cap_configured' };
      }

      // Calculate reward amount (capped at configured amount)
      const depositAmountUsd = CurrencyUtility.formatCurrencyAmountToMainUnit(depositAmount, CurrencyCode.USD);
      const rewardAmountUsd = Number(min(depositAmountUsd, rewardCapUsd));

      this.logger.log(
        `Calculated reward: deposit=${depositAmountUsd} USD, reward=${rewardAmountUsd} USD (cap=${rewardCapUsd})`,
      );

      await job.updateProgress(30);

      // Get underlying asset from environment
      const asset = EnvironmentService.getValue('DEFAULT_UNDERLYING_CURRENCY');

      // Call rewards API
      const rewardResponse = await this.rewardsAdapter.createReward(
        {
          userRef: participantCode,
          amount: rewardAmountUsd.toString(),
          asset,
          currency: CurrencyCode.USD,
        },
        provider,
      );

      this.logger.log(
        `Reward created: providerReference=${rewardResponse.providerReference}, status=${rewardResponse.status}`,
      );

      await job.updateProgress(50);

      // Get current fiat wallet balance
      const fiatWallet = await this.fiatWalletService.findById(fiatWalletId);
      const currentBalance = Number(fiatWallet.balance);

      // Create transaction record for the reward
      const rewardAmountInSmallestUnit = CurrencyUtility.formatCurrencyAmountToSmallestUnit(
        rewardAmountUsd,
        CurrencyCode.USD,
      );

      const transaction = await this.transactionService.create(userId, {
        reference: doshPointsTransaction.id,
        external_reference: rewardResponse.providerReference,
        asset: CurrencyCode.USD,
        amount: rewardAmountInSmallestUnit,
        balance_before: currentBalance,
        balance_after: currentBalance,
        transaction_type: TransactionType.REWARD,
        category: TransactionCategory.FIAT,
        transaction_scope: TransactionScope.INTERNAL,
        status: TransactionStatus.PENDING,
        metadata: {
          reward_type: 'first_deposit_match',
          dosh_points_transaction_id: doshPointsTransaction.id,
          deposit_amount_usd: depositAmountUsd,
          reward_amount_usd: rewardAmountUsd,
          asset,
          provider,
          provider_request_ref: rewardResponse.providerRequestRef,
          provider_quote_ref: rewardResponse.providerQuoteRef,
        },
        description: 'First deposit match reward',
      });

      transactionId = transaction.id;
      this.logger.log(`Reward transaction created: ${transaction.id}`);

      await job.updateProgress(70);

      // Create fiat wallet transaction for the reward
      const fiatWalletTransaction = await this.fiatWalletTransactionService.create(userId, {
        transaction_id: transaction.id,
        fiat_wallet_id: fiatWalletId,
        transaction_type: FiatWalletTransactionType.REWARD,
        amount: rewardAmountInSmallestUnit,
        balance_before: currentBalance,
        balance_after: currentBalance,
        currency: CurrencyCode.USD,
        status: TransactionStatus.PENDING,
        provider,
        provider_reference: rewardResponse.providerReference,
        provider_quote_ref: rewardResponse.providerQuoteRef,
        source: 'Rewards',
        destination: 'US Wallet',
        description: 'First deposit match reward',
        external_account_id: externalAccountId,
      });

      fiatWalletTransactionId = fiatWalletTransaction.id;
      this.logger.log(`Reward fiat wallet transaction created: ${fiatWalletTransaction.id}`);

      await job.updateProgress(90);

      // Update dosh points transaction metadata with reward transaction IDs
      const currentMetadata = (doshPointsTransaction.metadata || {}) as Record<string, unknown>;
      await this.doshPointsTransactionService.update(doshPointsTransaction.id, {
        metadata: {
          ...currentMetadata,
          reward: {
            transaction_id: transaction.id,
            fiat_wallet_transaction_id: fiatWalletTransaction.id,
          },
        },
      });

      await job.updateProgress(100);

      this.logger.log(`USD fiat reward processed for user ${userId}`);

      return {
        status: 'completed',
        transactionId,
        fiatWalletTransactionId,
        rewardAmountUsd,
      };
    } catch (error) {
      this.logger.error(`Failed to process USD fiat reward for user ${userId}:`, error);

      // Mark any created transactions as failed
      try {
        if (transactionId) {
          await this.transactionService.updateStatus(transactionId, TransactionStatus.FAILED, {
            failure_reason: `USD fiat reward failed: ${error.message}`,
          });
        }

        if (fiatWalletTransactionId) {
          await this.fiatWalletTransactionService.updateStatus(fiatWalletTransactionId, TransactionStatus.FAILED, {
            failure_reason: `USD fiat reward failed: ${error.message}`,
          });
        }
      } catch (updateError) {
        this.logger.warn(`Could not update transaction status to FAILED: ${updateError.message}`);
      }

      throw error;
    }
  }

  /**
   * Queue a credit first deposit reward job
   */
  async queueCreditFirstDepositReward(data: UsdFiatRewardsJobData): Promise<Job<UsdFiatRewardsJobData>> {
    // Register processors on first use
    this.registerProcessors();

    return this.queueService.addJob(this.queueName, 'credit-first-deposit-reward', data, {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 2000,
      },
    });
  }
}
