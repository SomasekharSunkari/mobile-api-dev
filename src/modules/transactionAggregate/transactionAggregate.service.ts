import { Inject, Injectable, Logger } from '@nestjs/common';
import { abs, add, larger } from 'mathjs';
import { FiatWalletTransactionType } from '../../database/models/fiatWalletTransaction/fiatWalletTransaction.interface';
import { ProviderLimitType } from '../../database/models/providerLimit/providerLimit.interface';
import { TransactionAggregateModel } from '../../database/models/transactionAggregate/transactionAggregate.model';
import { LimitExceededException, LimitExceededExceptionType } from '../../exceptions/limit_exceeded_exception';
import { LockerService } from '../../services/locker/locker.service';
import { ProviderLimitService } from '../providerLimit/providerLimit.service';
import { TransactionAggregateRepository } from './transactionAggregate.repository';

@Injectable()
export class TransactionAggregateService {
  private readonly logger = new Logger(TransactionAggregateService.name);

  @Inject(TransactionAggregateRepository)
  private readonly transactionAggregateRepository: TransactionAggregateRepository;

  @Inject(LockerService)
  private readonly lockerService: LockerService;

  @Inject(ProviderLimitService)
  private readonly providerLimitService: ProviderLimitService;

  /**
   * Find today's aggregate for given provider and transaction type, and update amount.
   * If no record exists for today, create a new one.
   * Uses distributed locking to prevent race conditions and ensure ACID principles.
   */
  async findAndUpdate(provider: string, transactionType: string, amount: number): Promise<TransactionAggregateModel> {
    const today = new Date().toISOString().split('T')[0];
    const lockKey = `transaction-aggregate:${today}:${provider}:${transactionType}`;

    this.logger.log(
      `Finding and updating aggregate for date: ${today}, provider: ${provider}, type: ${transactionType}, amount: ${amount}`,
    );

    return await this.lockerService.withLock(
      lockKey,
      async () => {
        const existingAggregate = await this.transactionAggregateRepository.findByDateAndProviderAndType(
          today,
          provider,
          transactionType,
        );

        if (existingAggregate) {
          this.logger.log(`Existing aggregate found with ID: ${existingAggregate.id}, updating amount`);

          const newAmount = Number(add(existingAggregate.amount, amount));

          const updated = await this.transactionAggregateRepository.update(existingAggregate.id, {
            amount: newAmount,
          });

          this.logger.log(`Aggregate updated with new amount: ${newAmount}`);

          return updated;
        }

        this.logger.log(`No existing aggregate found for today, creating new record`);

        const newAggregate = await this.transactionAggregateRepository.create({
          date: today,
          provider,
          transaction_type: transactionType,
          amount,
        });

        this.logger.log(`New aggregate created with ID: ${newAggregate.id}`);

        return newAggregate;
      },
      { ttl: 30000, retryCount: 5, retryDelay: 500 },
    );
  }

  /**
   * Validate provider platform weekly limits for deposits and withdrawals
   * This checks if adding the new transaction would exceed the provider's rolling 7-day limits
   * @param provider The provider (e.g., 'zerohash')
   * @param userId The user ID (for logging purposes)
   * @param transactionType The transaction type ('deposit' or 'withdrawal')
   * @param amountInSmallestUnit The transaction amount in smallest unit (cents)
   * @param currency The currency code
   * @throws LimitExceededException if the limit would be exceeded
   */
  async validateProviderPlatformWeeklyLimit(
    provider: string,
    userId: string,
    transactionType: string,
    amountInSmallestUnit: number,
    currency: string,
  ): Promise<void> {
    // Get the rolling 7-day sum for the provider
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const sevenDaysAgoDateString = sevenDaysAgo.toISOString().split('T')[0];

    const aggregates = (await this.transactionAggregateRepository
      .query()
      .where('provider', provider)
      .where('transaction_type', transactionType)
      .where('date', '>=', sevenDaysAgoDateString)) as TransactionAggregateModel[];

    const currentRollingSum = aggregates.reduce((total, aggregate) => {
      return add(total, Number(aggregate.amount));
    }, 0);

    // Use absolute value for limit checking (withdrawals are stored as negative)
    const absoluteSum = Number(abs(currentRollingSum));

    this.logger.debug(
      `Rolling 7-day sum for provider=${provider}, type=${transactionType}: ${absoluteSum} (from ${aggregates.length} records)`,
    );

    // Get the appropriate limit from provider_limits table
    const limitType =
      transactionType === FiatWalletTransactionType.DEPOSIT
        ? ProviderLimitType.WEEKLY_DEPOSIT
        : ProviderLimitType.WEEKLY_WITHDRAWAL;

    let limit: number;
    try {
      limit = await this.providerLimitService.getProviderLimitValue(provider, limitType, currency);
    } catch (error) {
      this.logger.warn(
        `Platform weekly limit not configured for ${provider} ${transactionType} ${currency}, skipping validation`,
        error.message,
      );
      return;
    }

    // Check if adding this transaction would exceed the limit
    const newTotal = add(absoluteSum, amountInSmallestUnit);

    if (larger(newTotal, limit)) {
      this.logger.warn(
        `User ${userId} exceeds ${provider} weekly ${transactionType} limit: ${Number(newTotal)}/${limit} ${currency} (in cents)`,
      );

      throw new LimitExceededException(
        transactionType,
        absoluteSum,
        limit,
        currency,
        LimitExceededExceptionType.PLATFORM_WEEKLY_LIMIT_EXCEEDED_EXCEPTION,
      );
    }

    this.logger.debug(
      `${provider} weekly ${transactionType} check passed for user ${userId}: ${Number(newTotal)}/${limit} ${currency}`,
    );
  }
}
