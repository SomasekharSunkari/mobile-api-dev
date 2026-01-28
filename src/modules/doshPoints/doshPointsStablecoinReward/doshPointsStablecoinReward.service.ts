import { BadRequestException, Inject, Injectable, Logger } from '@nestjs/common';
import { EnvironmentService } from '../../../config';
import { DoshPointsEventCode } from '../../../database/models/doshPointsEvent/doshPointsEvent.interface';
import { UsdFiatRewardsProcessor } from '../../../services/queue/processors/usd-fiat-rewards/usd-fiat-rewards.processor';
import { DoshPointsAccountService } from '../doshPointsAccount/doshPointsAccount.service';
import { DoshPointsTransactionService } from '../doshPointsTransaction/doshPointsTransaction.service';
import { DepositMetadata } from './doshPointsStablecoinReward.interface';

@Injectable()
export class DoshPointsStablecoinRewardService {
  private readonly logger = new Logger(DoshPointsStablecoinRewardService.name);

  @Inject(DoshPointsAccountService)
  private readonly doshPointsAccountService: DoshPointsAccountService;

  @Inject(DoshPointsTransactionService)
  private readonly doshPointsTransactionService: DoshPointsTransactionService;

  @Inject(UsdFiatRewardsProcessor)
  private readonly usdFiatRewardsProcessor: UsdFiatRewardsProcessor;

  /**
   * Handle user opt-in/opt-out for stablecoin rewards
   * First deposit match is ONLY awarded if this is their first time enabling (null -> true)
   * After that, they can toggle on/off but won't get the first deposit match again
   */
  async handleOptIn(userId: string, enabled: boolean) {
    this.logger.log(`Handling stablecoin rewards preference update for user ${userId}: ${enabled}`);

    // Check current opt-in status
    const account = await this.doshPointsAccountService.findOrCreate(userId);

    // Track if this is their first time making a choice (null means never chosen before)
    const isFirstTimeChoice = account.usd_fiat_rewards_enabled === null;

    // Update opt-in status
    const updatedAccount = await this.doshPointsAccountService.updateUsdFiatRewardsEnabled(userId, enabled);

    // First deposit match reward is ONLY available if:
    // 1. This is their first time making a choice (was null)
    // 2. AND they're opting in (enabled = true)
    const shouldProcessFirstDepositMatch = isFirstTimeChoice && enabled;

    if (!shouldProcessFirstDepositMatch) {
      this.logger.log(
        `User ${userId} updated preference to ${enabled}. First deposit match not applicable (isFirstTime: ${isFirstTimeChoice})`,
      );
      return {
        account: updatedAccount,
        rewardProcessed: false,
        message: enabled ? 'Successfully enabled stablecoin rewards' : 'Successfully disabled stablecoin rewards',
      };
    }

    // This is their first time opting in - check for first deposit and process reward
    this.logger.log(`User ${userId} opted in for the first time, checking for first deposit to match`);

    const provider = EnvironmentService.getValue('DEFAULT_USD_FIAT_WALLET_PROVIDER');

    // Find the FIRST_DEPOSIT_USD transaction (contains deposit metadata)
    const firstDepositTransaction = await this.doshPointsTransactionService.findOne({
      user_id: userId,
      event_code: DoshPointsEventCode.FIRST_DEPOSIT_USD,
      source_reference: provider,
    });

    if (!firstDepositTransaction) {
      this.logger.log(`No first deposit found for user ${userId}, match reward will be applied on first deposit`);
      return {
        account: updatedAccount,
        rewardProcessed: false,
        message:
          'Successfully opted in to stablecoin rewards. First deposit match will be applied when you make your first deposit.',
      };
    }

    // Extract deposit details from metadata
    const metadata = firstDepositTransaction.metadata as DepositMetadata | null;
    const depositInfo = metadata?.deposit;

    if (
      !depositInfo?.amount ||
      !depositInfo?.fiat_wallet_id ||
      !depositInfo?.external_account_id ||
      !depositInfo?.participant_code
    ) {
      this.logger.error(
        `First deposit transaction ${firstDepositTransaction.id} missing required deposit metadata for user ${userId}`,
      );
      throw new BadRequestException('First deposit data is incomplete. Please contact support.');
    }

    this.logger.log(`Found first deposit for user ${userId}, processing match reward`);

    // Create FIRST_DEPOSIT_USD_MATCH tracking transaction
    const matchResult = await this.doshPointsTransactionService.creditPoints({
      user_id: userId,
      event_code: DoshPointsEventCode.FIRST_DEPOSIT_USD_MATCH,
      source_reference: provider,
      description: 'First USD deposit match reward',
    });

    this.logger.log(`Created FIRST_DEPOSIT_USD_MATCH transaction for user ${userId}`);

    // Only queue reward if not a duplicate
    if (matchResult.is_duplicate) {
      this.logger.log(`FIRST_DEPOSIT_USD_MATCH already exists for user ${userId}, skipping reward queue`);
      return {
        account: updatedAccount,
        rewardProcessed: true,
        message: 'Successfully opted in to stablecoin rewards. Your first deposit match is being processed!',
      };
    }

    // Queue the stablecoin reward using data from metadata
    await this.usdFiatRewardsProcessor.queueCreditFirstDepositReward({
      userId,
      participantCode: depositInfo.participant_code,
      depositAmount: Number(depositInfo.amount),
      fiatWalletId: depositInfo.fiat_wallet_id,
      externalAccountId: depositInfo.external_account_id,
    });

    this.logger.log(`Queued stablecoin reward for user ${userId} based on first deposit`);

    return {
      account: updatedAccount,
      rewardProcessed: true,
      message: 'Successfully opted in to stablecoin rewards. Your first deposit match is being processed!',
    };
  }
}
