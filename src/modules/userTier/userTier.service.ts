import {
  BadRequestException,
  Inject,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { abs, add, larger, largerEq, max } from 'mathjs';
import { PROVIDERS } from '../../constants/constants';
import { CurrencyUtility, SUPPORTED_CURRENCIES, SUPPORTED_CURRENCY_CODES } from '../../currencies';
import { FiatWalletTransactionType } from '../../database/models/fiatWalletTransaction/fiatWalletTransaction.interface';
import { ITier } from '../../database/models/tier/tier.interface';
import { TierModel } from '../../database/models/tier/tier.model';
import { ITierConfig } from '../../database/models/tierConfig/tierConfig.interface';
import { TierConfigModel } from '../../database/models/tierConfig/tierConfig.model';
import { TransactionStatus } from '../../database/models/transaction';
import { IVerificationRequirement } from '../../database/models/verificationRequirement';
import { LimitExceededException, LimitExceededExceptionType } from '../../exceptions/limit_exceeded_exception';
import { LockerService } from '../../services/locker/locker.service';
import { KycVerificationRepository } from '../auth/kycVerification/kycVerification.repository';
import { CountryRepository } from '../country/country.repository';
import { FiatWalletTransactionRepository } from '../fiatWalletTransactions/fiatWalletTransactions.repository';
import { TierRepository } from '../tier/tier.repository';
import { TierConfigRepository } from '../tierConfig/tierConfig.repository';
import { TransactionAggregateService } from '../transactionAggregate/transactionAggregate.service';
import { TransactionSumService } from '../transaction-sum/transaction-sum.service';
import { CreateUserTierDto } from './dtos/createUserTier.dto';
import { CurrencyLimitsDto, UserTransactionLimitsResponseDto } from './dtos/transactionLimitsResponse.dto';
import { UserTierRepository } from './userTier.repository';

@Injectable()
export class UserTierService {
  @Inject(UserTierRepository)
  private readonly userTierRepository: UserTierRepository;

  @Inject(TierRepository)
  private readonly tierRepository: TierRepository;

  @Inject(TierConfigRepository)
  private readonly tierConfigRepository: TierConfigRepository;

  @Inject(KycVerificationRepository)
  private readonly kycVerificationRepository: KycVerificationRepository;

  @Inject(CountryRepository)
  private readonly countryRepository: CountryRepository;

  @Inject(TransactionSumService)
  private readonly transactionSumService: TransactionSumService;

  @Inject(LockerService)
  private readonly lockerService: LockerService;

  @Inject(FiatWalletTransactionRepository)
  private readonly fiatWalletTransactionRepository: FiatWalletTransactionRepository;

  @Inject(TransactionAggregateService)
  private readonly transactionAggregateService: TransactionAggregateService;

  private readonly logger = new Logger(UserTierService.name);

  async create(userId: string, data: CreateUserTierDto) {
    this.logger.log('create', 'UserTierService');

    try {
      const userTier = await this.userTierRepository.create({ ...data, user_id: userId });

      return userTier;
    } catch (error) {
      this.logger.error(error.message, 'UserTierService.create');
      throw new InternalServerErrorException('Error while creating UserTier');
    }
  }

  async findOrCreate(userId: string, tierId: string) {
    this.logger.log('finding or creating user tier', 'UserTierService');
    try {
      const userTier = await this.userTierRepository.findOne({ user_id: userId, tier_id: tierId });
      if (!userTier) {
        return await this.create(userId, { tier_id: tierId });
      }
      return userTier;
    } catch (error) {
      this.logger.error(error.message, 'UserTierService.findOrCreate');
      throw new InternalServerErrorException('Error while finding or creating UserTier');
    }
  }

  /**
   * Get user's current highest completed tier
   * Returns only the tier with the highest level where ALL verification requirements are approved
   */
  async getUserCurrentTier(userId: string): Promise<ITier | undefined> {
    this.logger.log(`Getting current tier for user ${userId}`, 'UserTierService.getUserCurrentTier');

    try {
      const userTiers = await this.userTierRepository.findByUserWithTierDetails(userId);

      if (!userTiers || userTiers.length === 0) {
        return undefined;
      }

      let highestTier: ITier | undefined;

      for (const userTier of userTiers) {
        if (!userTier.tier?.tierConfigs) {
          continue;
        }

        for (const tierConfig of userTier.tier.tierConfigs) {
          if (!tierConfig.country?.id) {
            continue;
          }

          const verificationRequirements = tierConfig.tierConfigVerificationRequirements || [];

          if (verificationRequirements.length === 0) {
            continue;
          }

          const requirementIds = verificationRequirements.map((req) => req.id);
          const approvedVerifications = await this.kycVerificationRepository.findUserApprovedVerifications(
            userId,
            requirementIds,
          );

          const allRequirementsApproved =
            approvedVerifications.length === verificationRequirements.length &&
            verificationRequirements.every((req) =>
              approvedVerifications.some((ver) => ver.tier_config_verification_requirement_id === req.id),
            );

          if (allRequirementsApproved) {
            if (!highestTier || userTier.tier.level > highestTier.level) {
              highestTier = userTier.tier;
            }
          }
        }
      }

      return highestTier;
    } catch (error) {
      this.logger.error(error.message, 'UserTierService.getUserCurrentTier');
      throw new InternalServerErrorException('Error while getting user current tier');
    }
  }

  /**
   * Get pending KYC verifications for a user in a specific tier and country
   * Returns verifications that are not yet approved
   */
  async getUserPendingKYCInTier(
    userId: string,
    tierId: string,
    countryId: string,
  ): Promise<IVerificationRequirement[]> {
    this.logger.log(
      `Getting pending KYC for user ${userId} in tier ${tierId} and country ${countryId}`,
      'UserTierService.getUserPendingKYCInTier',
    );

    try {
      const tier = (await this.tierRepository
        .query()
        .findById(tierId)
        .withGraphFetched('tierConfigs.[tierConfigVerificationRequirements.verificationRequirement]')) as TierModel;

      if (!tier) {
        throw new NotFoundException('Tier not found');
      }

      const tierConfig = tier.tierConfigs?.find((config) => config.country_id === countryId);

      if (!tierConfig) {
        throw new NotFoundException(`Tier configuration not found for country ${countryId}`);
      }

      const verificationRequirements = tierConfig.tierConfigVerificationRequirements || [];

      if (verificationRequirements.length === 0) {
        return [];
      }

      const requirementIds = verificationRequirements.map((req) => req.id);
      const approvedVerifications = await this.kycVerificationRepository.findUserApprovedVerifications(
        userId,
        requirementIds,
      );

      const approvedRequirementIds = new Set(
        approvedVerifications.map((ver) => ver.tier_config_verification_requirement_id),
      );

      const pendingRequirements = verificationRequirements
        .filter((req) => !approvedRequirementIds.has(req.id))
        .map((req) => req.verificationRequirement)
        .filter((req): req is IVerificationRequirement => req !== undefined);

      return pendingRequirements;
    } catch (error) {
      this.logger.error(error.message, 'UserTierService.getUserPendingKYCInTier');
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException('Error while getting user pending KYC in tier');
    }
  }

  /**
   * Get all verification requirements for a tier, grouped by country
   */
  async getTierVerifications(tierId: string): Promise<Record<string, IVerificationRequirement[]>> {
    this.logger.log(`Getting tier verifications for tier ${tierId}`, 'UserTierService.getTierVerifications');

    try {
      const tier = (await this.tierRepository
        .query()
        .findById(tierId)
        .withGraphFetched(
          'tierConfigs.[country, tierConfigVerificationRequirements.verificationRequirement]',
        )) as TierModel;

      if (!tier) {
        throw new NotFoundException('Tier not found');
      }

      const verificationsByCountry: Record<string, IVerificationRequirement[]> = {};

      if (!tier.tierConfigs) {
        return verificationsByCountry;
      }

      for (const tierConfig of tier.tierConfigs) {
        if (!tierConfig.country?.id) {
          continue;
        }

        const countryId = tierConfig.country.id;
        const verificationRequirements = tierConfig.tierConfigVerificationRequirements || [];

        const requirements = verificationRequirements
          .map((req) => req.verificationRequirement)
          .filter((req): req is IVerificationRequirement => req !== undefined);

        if (requirements.length > 0) {
          verificationsByCountry[countryId] = requirements;
        }
      }

      return verificationsByCountry;
    } catch (error) {
      this.logger.error(error.message, 'UserTierService.getTierVerifications');
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException('Error while getting tier verifications');
    }
  }

  /**
   * Check if a user has completed all verifications for a specific tier and country
   */
  async isTierCompleted(userId: string, tierId: string, countryId: string): Promise<boolean> {
    this.logger.log(
      `Checking if tier ${tierId} is completed for user ${userId} in country ${countryId}`,
      'UserTierService.isTierCompleted',
    );

    try {
      const tierConfig = (await this.tierConfigRepository
        .query()
        .findOne({ tier_id: tierId, country_id: countryId })
        .withGraphFetched('tierConfigVerificationRequirements')) as TierConfigModel;

      if (!tierConfig) {
        return false;
      }

      const verificationRequirements = tierConfig.tierConfigVerificationRequirements || [];

      if (verificationRequirements.length === 0) {
        return false;
      }

      const requirementIds = verificationRequirements.map((req) => req.id);
      const approvedVerifications = await this.kycVerificationRepository.findUserApprovedVerifications(
        userId,
        requirementIds,
      );

      const allRequirementsApproved =
        approvedVerifications.length === verificationRequirements.length &&
        verificationRequirements.every((req) =>
          approvedVerifications.some((ver) => ver.tier_config_verification_requirement_id === req.id),
        );

      return allRequirementsApproved;
    } catch (error) {
      this.logger.error(error.message, 'UserTierService.isTierCompleted');
      throw new InternalServerErrorException('Error while checking tier completion');
    }
  }

  /**
   * Get asset limits for a user based on their tier configuration
   * Maps the asset to a country and returns the tier config limits
   */
  async getAssetLimits(userId: string, asset: string): Promise<ITierConfig | null> {
    this.logger.log(`Getting asset limits for user ${userId} and asset ${asset}`, 'UserTierService.getAssetLimits');

    try {
      const normalizedAsset = asset.toUpperCase().trim();
      let countryCode: string | undefined;

      // Map fiat currencies to country codes
      if (CurrencyUtility.isSupportedCurrency(normalizedAsset)) {
        countryCode = CurrencyUtility.getCurrencyCountryCode(normalizedAsset);
      } else {
        // For crypto assets (USDT, USDC, etc.), default to USD country (US)
        // This can be enhanced to check user's preferred country or account rail
        return null;
      }

      if (!countryCode) {
        throw new NotFoundException(`Unable to determine country for asset ${asset}`);
      }

      const country = await this.countryRepository.findOne({ code: countryCode });

      if (!country) {
        throw new NotFoundException(`Country not found for asset ${asset}`);
      }

      const tier = await this.getUserCurrentTier(userId);

      if (!tier) {
        return null;
      }

      const tierConfig = (await this.tierConfigRepository
        .query()
        .findOne({ tier_id: tier.id, country_id: country.id })) as TierConfigModel;

      if (!tierConfig) {
        return null;
      }

      return tierConfig;
    } catch (error) {
      this.logger.error(error.message, 'UserTierService.getAssetLimits');
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException('Error while getting asset limits');
    }
  }

  /**
   * Validate transaction limits for a user
   * Checks single transaction, daily, weekly, and monthly limits
   * Uses Redis locks to prevent TOCTOU (Time-Of-Check-Time-Of-Use) race conditions
   */
  async validateLimit(
    userId: string,
    amountInSmallestUnit: number,
    currency: string,
    transactionType: FiatWalletTransactionType,
  ): Promise<void> {
    const lockKey = `user-limit-validation:${userId}:${currency}:${transactionType}`;

    return this.lockerService.withLock(lockKey, async () => {
      this.logger.debug(
        `Validating ${transactionType} limits for user ${userId}, amount: ${amountInSmallestUnit} ${currency}`,
      );

      // Use existing getAssetLimits method to get tier configuration
      const tierConfig = await this.getAssetLimits(userId, currency);
      if (!tierConfig) {
        throw new BadRequestException('User tier configuration not found');
      }

      // Get appropriate limits based on transaction type
      let singleTransactionLimit: number;
      let dailyLimit: number;
      let weeklyLimit: number;
      let monthlyLimit: number;

      switch (transactionType) {
        case FiatWalletTransactionType.DEPOSIT:
          singleTransactionLimit = tierConfig.maximum_per_deposit;
          dailyLimit = tierConfig.maximum_daily_deposit;
          weeklyLimit = tierConfig.maximum_weekly_deposit;
          monthlyLimit = tierConfig.maximum_monthly_deposit;
          break;
        case FiatWalletTransactionType.WITHDRAWAL:
          singleTransactionLimit = tierConfig.maximum_per_withdrawal;
          dailyLimit = tierConfig.maximum_daily_withdrawal;
          weeklyLimit = tierConfig.maximum_weekly_withdrawal;
          monthlyLimit = tierConfig.maximum_monthly_withdrawal;
          break;
        case FiatWalletTransactionType.TRANSFER_IN:
        case FiatWalletTransactionType.TRANSFER_OUT:
          singleTransactionLimit = tierConfig.maximum_transaction_amount;
          dailyLimit = tierConfig.maximum_daily_transaction;
          weeklyLimit = tierConfig.maximum_weekly_transaction;
          monthlyLimit = tierConfig.maximum_monthly_transaction;
          break;
        case FiatWalletTransactionType.EXCHANGE:
          singleTransactionLimit = tierConfig.maximum_transaction_amount;
          dailyLimit = tierConfig.maximum_daily_transaction;
          weeklyLimit = tierConfig.maximum_weekly_transaction;
          monthlyLimit = tierConfig.maximum_monthly_transaction;
          break;
        default:
          this.logger.warn(`Unknown transaction type: ${transactionType}. Skipping limit validation.`);
          return;
      }

      // Check single transaction limit
      if (larger(amountInSmallestUnit, singleTransactionLimit)) {
        throw new LimitExceededException(
          `${transactionType} transaction`,
          amountInSmallestUnit,
          singleTransactionLimit,
          currency,
          LimitExceededExceptionType.TRANSACTION_LIMIT_EXCEEDED_EXCEPTION,
        );
      }

      // Check pending transaction count limits (US users only - deposits and withdrawals)
      await this.validatePendingTransactionCountLimit(userId, transactionType, currency, tierConfig);

      // Check weekly transaction count limits (US users only - deposits and withdrawals)
      await this.validateWeeklyTransactionCountLimit(userId, transactionType, currency, tierConfig);

      // Check ZeroHash platform weekly limits (deposits and withdrawals only)
      await this.validatePlatformWeeklyLimit(userId, amountInSmallestUnit, currency, transactionType);

      // Get transaction sums for limit checking (include both COMPLETED and PENDING)
      // Use asset-based approach to sum across all providers for the given currency
      // Redis locks ensure consistency, no need for database transaction
      const [
        dailySumCompleted,
        weeklySumCompleted,
        monthlySumCompleted,
        dailySumPending,
        weeklySumPending,
        monthlySumPending,
      ] = await Promise.all([
        this.transactionSumService.getPastOneDayTransactionSum(currency, TransactionStatus.COMPLETED, userId),
        this.transactionSumService.getPastOneWeekTransactionSum(currency, TransactionStatus.COMPLETED, userId),
        this.transactionSumService.getPastOneMonthTransactionSum(currency, TransactionStatus.COMPLETED, userId),
        this.transactionSumService.getPastOneDayTransactionSum(currency, TransactionStatus.PENDING, userId),
        this.transactionSumService.getPastOneWeekTransactionSum(currency, TransactionStatus.PENDING, userId),
        this.transactionSumService.getPastOneMonthTransactionSum(currency, TransactionStatus.PENDING, userId),
      ]);

      // Get current sums for the specific transaction type (combine COMPLETED and PENDING)
      const transactionTypeKey =
        transactionType === FiatWalletTransactionType.DEPOSIT
          ? 'deposit'
          : transactionType === FiatWalletTransactionType.EXCHANGE
            ? 'exchange'
            : 'withdrawal';
      let currentDailySum = add(
        dailySumCompleted.transactionTypeTotals[transactionTypeKey]?.totalSum || 0,
        dailySumPending.transactionTypeTotals[transactionTypeKey]?.totalSum || 0,
      );
      let currentWeeklySum = add(
        weeklySumCompleted.transactionTypeTotals[transactionTypeKey]?.totalSum || 0,
        weeklySumPending.transactionTypeTotals[transactionTypeKey]?.totalSum || 0,
      );
      let currentMonthlySum = add(
        monthlySumCompleted.transactionTypeTotals[transactionTypeKey]?.totalSum || 0,
        monthlySumPending.transactionTypeTotals[transactionTypeKey]?.totalSum || 0,
      );

      // For withdrawals and exchanges, amounts are stored as negative values,
      // so we need absolute values for limit checking
      if (
        transactionType === FiatWalletTransactionType.WITHDRAWAL ||
        transactionType === FiatWalletTransactionType.EXCHANGE
      ) {
        currentDailySum = abs(currentDailySum);
        currentWeeklySum = abs(currentWeeklySum);
        currentMonthlySum = abs(currentMonthlySum);
      }

      // Log detailed limit checking information
      this.logger.debug(`Limit Check Details for ${transactionType} - User: ${userId}
        Transaction Amount: ${CurrencyUtility.formatCurrencyAmountToMainUnit(amountInSmallestUnit, currency)} ${currency}
        Current Totals: Daily=${CurrencyUtility.formatCurrencyAmountToMainUnit(currentDailySum, currency)}, Weekly=${CurrencyUtility.formatCurrencyAmountToMainUnit(currentWeeklySum, currency)}, Monthly=${CurrencyUtility.formatCurrencyAmountToMainUnit(currentMonthlySum, currency)} ${currency}
        Tier Config Limits: Single=${CurrencyUtility.formatCurrencyAmountToMainUnit(singleTransactionLimit, currency)}, Daily=${CurrencyUtility.formatCurrencyAmountToMainUnit(dailyLimit, currency)}, Weekly=${CurrencyUtility.formatCurrencyAmountToMainUnit(weeklyLimit, currency)}, Monthly=${CurrencyUtility.formatCurrencyAmountToMainUnit(monthlyLimit, currency)} ${currency}`);

      // Check daily limit
      if (larger(add(currentDailySum, amountInSmallestUnit), dailyLimit)) {
        throw new LimitExceededException(
          transactionType,
          currentDailySum,
          dailyLimit,
          currency,
          LimitExceededExceptionType.DAILY_LIMIT_EXCEEDED_EXCEPTION,
        );
      }

      // Check weekly limit
      if (larger(add(currentWeeklySum, amountInSmallestUnit), weeklyLimit)) {
        throw new LimitExceededException(
          transactionType,
          currentWeeklySum,
          weeklyLimit,
          currency,
          LimitExceededExceptionType.WEEKLY_LIMIT_EXCEEDED_EXCEPTION,
        );
      }

      // Check monthly limit
      if (larger(add(currentMonthlySum, amountInSmallestUnit), monthlyLimit)) {
        throw new LimitExceededException(
          transactionType,
          currentMonthlySum,
          monthlyLimit,
          currency,
          LimitExceededExceptionType.MONTHLY_LIMIT_EXCEEDED_EXCEPTION,
        );
      }

      this.logger.debug(`All ${transactionType} limits passed for user ${userId}`);
    });
  }

  /**
   * Validate pending transaction count limits for deposits and withdrawals
   * Only applies when tier config has maximum_pending_deposits_count or maximum_pending_withdrawals_count set
   * Limits are per currency to ensure USD and NGN deposits/withdrawals are counted separately
   */
  private async validatePendingTransactionCountLimit(
    userId: string,
    transactionType: FiatWalletTransactionType,
    currency: string,
    tierConfig: ITierConfig,
  ): Promise<void> {
    if (transactionType === FiatWalletTransactionType.DEPOSIT && tierConfig.maximum_pending_deposits_count != null) {
      const pendingCount = await this.fiatWalletTransactionRepository.countPendingByUserAndType(
        userId,
        transactionType,
        currency,
      );

      if (largerEq(pendingCount, tierConfig.maximum_pending_deposits_count)) {
        this.logger.warn(
          `User ${userId} has ${pendingCount} pending deposits, max allowed: ${tierConfig.maximum_pending_deposits_count}`,
        );
        throw new LimitExceededException(
          FiatWalletTransactionType.DEPOSIT,
          pendingCount,
          tierConfig.maximum_pending_deposits_count,
          'count',
          LimitExceededExceptionType.PENDING_LIMIT_EXCEEDED_EXCEPTION,
        );
      }
    }

    if (
      transactionType === FiatWalletTransactionType.WITHDRAWAL &&
      tierConfig.maximum_pending_withdrawals_count != null
    ) {
      const pendingCount = await this.fiatWalletTransactionRepository.countPendingByUserAndType(
        userId,
        transactionType,
        currency,
      );

      if (largerEq(pendingCount, tierConfig.maximum_pending_withdrawals_count)) {
        this.logger.warn(
          `User ${userId} has ${pendingCount} pending withdrawals, max allowed: ${tierConfig.maximum_pending_withdrawals_count}`,
        );
        throw new LimitExceededException(
          FiatWalletTransactionType.WITHDRAWAL,
          pendingCount,
          tierConfig.maximum_pending_withdrawals_count,
          'count',
          LimitExceededExceptionType.PENDING_LIMIT_EXCEEDED_EXCEPTION,
        );
      }
    }
  }

  /**
   * Validate weekly transaction count limits for deposits and withdrawals
   * Only applies when tier config has maximum_weekly_deposit_count or maximum_weekly_withdrawal_count set
   * Counts transactions in rolling 7-day window
   * Limits are per currency to ensure USD and NGN deposits/withdrawals are counted separately
   */
  private async validateWeeklyTransactionCountLimit(
    userId: string,
    transactionType: FiatWalletTransactionType,
    currency: string,
    tierConfig: ITierConfig,
  ): Promise<void> {
    if (transactionType === FiatWalletTransactionType.DEPOSIT && tierConfig.maximum_weekly_deposit_count != null) {
      const weeklyCount = await this.fiatWalletTransactionRepository.countTransactionsByTypeInPastWeek(
        userId,
        transactionType,
        currency,
      );

      if (largerEq(weeklyCount, tierConfig.maximum_weekly_deposit_count)) {
        this.logger.warn(
          `User ${userId} has ${weeklyCount} deposits in the past week, max allowed: ${tierConfig.maximum_weekly_deposit_count}`,
        );
        throw new LimitExceededException(
          FiatWalletTransactionType.DEPOSIT,
          weeklyCount,
          tierConfig.maximum_weekly_deposit_count,
          'count',
          LimitExceededExceptionType.WEEKLY_COUNT_LIMIT_EXCEEDED_EXCEPTION,
        );
      }
    }

    if (
      transactionType === FiatWalletTransactionType.WITHDRAWAL &&
      tierConfig.maximum_weekly_withdrawal_count != null
    ) {
      const weeklyCount = await this.fiatWalletTransactionRepository.countTransactionsByTypeInPastWeek(
        userId,
        transactionType,
        currency,
      );

      if (largerEq(weeklyCount, tierConfig.maximum_weekly_withdrawal_count)) {
        this.logger.warn(
          `User ${userId} has ${weeklyCount} withdrawals in the past week, max allowed: ${tierConfig.maximum_weekly_withdrawal_count}`,
        );
        throw new LimitExceededException(
          FiatWalletTransactionType.WITHDRAWAL,
          weeklyCount,
          tierConfig.maximum_weekly_withdrawal_count,
          'count',
          LimitExceededExceptionType.WEEKLY_COUNT_LIMIT_EXCEEDED_EXCEPTION,
        );
      }
    }
  }

  /**
   * Validate provider platform weekly limits for deposits and withdrawals
   * Currently only applies to ZeroHash (USD transactions), but designed to support other providers
   * Delegates to TransactionAggregateService for all business logic
   */
  private async validatePlatformWeeklyLimit(
    userId: string,
    amountInSmallestUnit: number,
    currency: string,
    transactionType: FiatWalletTransactionType,
  ): Promise<void> {
    // Only check for deposits and withdrawals
    if (
      transactionType !== FiatWalletTransactionType.DEPOSIT &&
      transactionType !== FiatWalletTransactionType.WITHDRAWAL
    ) {
      return;
    }

    // Only check for USD transactions (ZeroHash is the USD provider)
    if (currency !== SUPPORTED_CURRENCIES.USD.code) {
      return;
    }

    // Delegate to TransactionAggregateService which owns all provider platform limit logic
    await this.transactionAggregateService.validateProviderPlatformWeeklyLimit(
      PROVIDERS.ZEROHASH,
      userId,
      transactionType,
      amountInSmallestUnit,
      currency,
    );
  }

  /**
   * Get user transaction limits with spent amounts for all supported currencies
   * Returns send (withdrawal) and receive (deposit) limits with daily, weekly, and monthly breakdowns
   */
  async getUserTransactionLimits(userId: string): Promise<UserTransactionLimitsResponseDto> {
    this.logger.log(`Getting transaction limits for user ${userId}`, 'UserTierService.getUserTransactionLimits');

    try {
      const limitsPromises = SUPPORTED_CURRENCY_CODES.map((currency) => this.getCurrencyLimits(userId, currency));

      const limitsResults = await Promise.all(limitsPromises);
      const limits = limitsResults.filter((limit): limit is CurrencyLimitsDto => limit !== null);

      return { limits };
    } catch (error) {
      this.logger.error(error.message, 'UserTierService.getUserTransactionLimits');
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException('Error while getting user transaction limits');
    }
  }

  /**
   * Get transaction limits for a specific currency
   */
  private async getCurrencyLimits(userId: string, currency: string): Promise<CurrencyLimitsDto | null> {
    const tierConfig = await this.getAssetLimits(userId, currency);

    if (!tierConfig) {
      return null;
    }

    // Ensure tier config limits have default values if null/undefined
    const maxPerWithdrawal = tierConfig.maximum_per_withdrawal ?? 0;
    const maxDailyWithdrawal = tierConfig.maximum_daily_withdrawal ?? 0;
    const maxWeeklyWithdrawal = tierConfig.maximum_weekly_withdrawal ?? 0;
    const maxMonthlyWithdrawal = tierConfig.maximum_monthly_withdrawal ?? 0;
    const maxPerDeposit = tierConfig.maximum_per_deposit ?? 0;
    const maxDailyDeposit = tierConfig.maximum_daily_deposit ?? 0;
    const maxWeeklyDeposit = tierConfig.maximum_weekly_deposit ?? 0;
    const maxMonthlyDeposit = tierConfig.maximum_monthly_deposit ?? 0;

    // Get transaction sums for limit checking (include both COMPLETED and PENDING)
    const [
      dailySumCompleted,
      weeklySumCompleted,
      monthlySumCompleted,
      dailySumPending,
      weeklySumPending,
      monthlySumPending,
      pendingDepositCount,
      pendingWithdrawalCount,
      weeklyDepositCount,
      weeklyWithdrawalCount,
    ] = await Promise.all([
      this.transactionSumService.getPastOneDayTransactionSum(currency, TransactionStatus.COMPLETED, userId),
      this.transactionSumService.getPastOneWeekTransactionSum(currency, TransactionStatus.COMPLETED, userId),
      this.transactionSumService.getPastOneMonthTransactionSum(currency, TransactionStatus.COMPLETED, userId),
      this.transactionSumService.getPastOneDayTransactionSum(currency, TransactionStatus.PENDING, userId),
      this.transactionSumService.getPastOneWeekTransactionSum(currency, TransactionStatus.PENDING, userId),
      this.transactionSumService.getPastOneMonthTransactionSum(currency, TransactionStatus.PENDING, userId),
      // Count limits (queries DB if limit configured in tier, returns 0 without querying if not)
      tierConfig.maximum_pending_deposits_count
        ? this.fiatWalletTransactionRepository.countPendingByUserAndType(
            userId,
            FiatWalletTransactionType.DEPOSIT,
            currency,
          )
        : Promise.resolve(0),
      tierConfig.maximum_pending_withdrawals_count
        ? this.fiatWalletTransactionRepository.countPendingByUserAndType(
            userId,
            FiatWalletTransactionType.WITHDRAWAL,
            currency,
          )
        : Promise.resolve(0),
      tierConfig.maximum_weekly_deposit_count
        ? this.fiatWalletTransactionRepository.countTransactionsByTypeInPastWeek(
            userId,
            FiatWalletTransactionType.DEPOSIT,
            currency,
          )
        : Promise.resolve(0),
      tierConfig.maximum_weekly_withdrawal_count
        ? this.fiatWalletTransactionRepository.countTransactionsByTypeInPastWeek(
            userId,
            FiatWalletTransactionType.WITHDRAWAL,
            currency,
          )
        : Promise.resolve(0),
    ]);

    // Calculate withdrawal (send) spent amounts - use abs() since withdrawals are stored as negative
    const withdrawalDailySpent = Number(
      abs(
        add(
          dailySumCompleted.transactionTypeTotals['withdrawal']?.totalSum ?? 0,
          dailySumPending.transactionTypeTotals['withdrawal']?.totalSum ?? 0,
        ),
      ),
    );
    const withdrawalWeeklySpent = Number(
      abs(
        add(
          weeklySumCompleted.transactionTypeTotals['withdrawal']?.totalSum ?? 0,
          weeklySumPending.transactionTypeTotals['withdrawal']?.totalSum ?? 0,
        ),
      ),
    );
    const withdrawalMonthlySpent = Number(
      abs(
        add(
          monthlySumCompleted.transactionTypeTotals['withdrawal']?.totalSum ?? 0,
          monthlySumPending.transactionTypeTotals['withdrawal']?.totalSum ?? 0,
        ),
      ),
    );

    // Calculate deposit (receive) spent amounts
    const depositDailySpent = Number(
      add(
        dailySumCompleted.transactionTypeTotals['deposit']?.totalSum ?? 0,
        dailySumPending.transactionTypeTotals['deposit']?.totalSum ?? 0,
      ),
    );
    const depositWeeklySpent = Number(
      add(
        weeklySumCompleted.transactionTypeTotals['deposit']?.totalSum ?? 0,
        weeklySumPending.transactionTypeTotals['deposit']?.totalSum ?? 0,
      ),
    );
    const depositMonthlySpent = Number(
      add(
        monthlySumCompleted.transactionTypeTotals['deposit']?.totalSum ?? 0,
        monthlySumPending.transactionTypeTotals['deposit']?.totalSum ?? 0,
      ),
    );

    const response: CurrencyLimitsDto = {
      currency: currency.toUpperCase(),
      send: {
        single_transaction_limit: maxPerWithdrawal,
        daily: {
          limit: maxDailyWithdrawal,
          spent: withdrawalDailySpent,
          remaining: Number(max(0, maxDailyWithdrawal - withdrawalDailySpent)),
        },
        weekly: {
          limit: maxWeeklyWithdrawal,
          spent: withdrawalWeeklySpent,
          remaining: Number(max(0, maxWeeklyWithdrawal - withdrawalWeeklySpent)),
        },
        monthly: {
          limit: maxMonthlyWithdrawal,
          spent: withdrawalMonthlySpent,
          remaining: Number(max(0, maxMonthlyWithdrawal - withdrawalMonthlySpent)),
        },
      },
      receive: {
        single_transaction_limit: maxPerDeposit,
        daily: {
          limit: maxDailyDeposit,
          spent: depositDailySpent,
          remaining: Number(max(0, maxDailyDeposit - depositDailySpent)),
        },
        weekly: {
          limit: maxWeeklyDeposit,
          spent: depositWeeklySpent,
          remaining: Number(max(0, maxWeeklyDeposit - depositWeeklySpent)),
        },
        monthly: {
          limit: maxMonthlyDeposit,
          spent: depositMonthlySpent,
          remaining: Number(max(0, maxMonthlyDeposit - depositMonthlySpent)),
        },
      },
    };

    // Add pending count limits to response if configured in tier
    if (tierConfig.maximum_pending_withdrawals_count) {
      response.send.pending_count = {
        limit: tierConfig.maximum_pending_withdrawals_count,
        current: pendingWithdrawalCount,
        remaining: Number(max(0, tierConfig.maximum_pending_withdrawals_count - pendingWithdrawalCount)),
      };
    }
    if (tierConfig.maximum_pending_deposits_count) {
      response.receive.pending_count = {
        limit: tierConfig.maximum_pending_deposits_count,
        current: pendingDepositCount,
        remaining: Number(max(0, tierConfig.maximum_pending_deposits_count - pendingDepositCount)),
      };
    }

    // Add weekly count limits to response if configured in tier
    if (tierConfig.maximum_weekly_withdrawal_count) {
      response.send.weekly_count = {
        limit: tierConfig.maximum_weekly_withdrawal_count,
        current: weeklyWithdrawalCount,
        remaining: Number(max(0, tierConfig.maximum_weekly_withdrawal_count - weeklyWithdrawalCount)),
      };
    }
    if (tierConfig.maximum_weekly_deposit_count) {
      response.receive.weekly_count = {
        limit: tierConfig.maximum_weekly_deposit_count,
        current: weeklyDepositCount,
        remaining: Number(max(0, tierConfig.maximum_weekly_deposit_count - weeklyDepositCount)),
      };
    }

    return response;
  }
}
