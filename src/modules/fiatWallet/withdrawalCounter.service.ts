import { BadRequestException, Inject, Injectable, Logger } from '@nestjs/common';
import { DateTime } from 'luxon';
import { RedisService } from '../../services/redis/redis.service';

/**
 * Service for tracking and limiting withdrawal attempts per user per day
 * This prevents attackers from testing limits with many small withdrawals
 * and helps detect suspicious behavior patterns
 */
@Injectable()
export class WithdrawalCounterService {
  private readonly logger = new Logger(WithdrawalCounterService.name);

  @Inject(RedisService)
  private readonly redisService: RedisService;

  /**
   * Increment the daily withdrawal attempt counter for a user
   * Counter automatically resets at midnight UTC based on TTL
   *
   * @param userId - The user's unique identifier
   * @returns The new count of withdrawal attempts for today
   */
  async incrementDailyAttempts(userId: string): Promise<number> {
    const key = this.getDailyAttemptsKey(userId);
    const attempts = await this.redisService.getClient().incr(key);

    // Set expiry to end of day (midnight UTC) on first increment
    if (attempts === 1) {
      const now = DateTime.now().toUTC();
      const endOfDay = now.endOf('day');
      const secondsUntilMidnight = Math.floor(endOfDay.diff(now, 'seconds').seconds);

      // Set TTL to expire at midnight UTC
      await this.redisService.expire(key, secondsUntilMidnight);

      this.logger.log(`Started daily withdrawal counter for user ${userId}. Expires in ${secondsUntilMidnight}s`);
    }

    this.logger.log(`User ${userId} has made ${attempts} withdrawal attempt(s) today`);
    return attempts;
  }

  /**
   * Get the current daily withdrawal attempt count for a user
   *
   * @param userId - The user's unique identifier
   * @returns The current count of withdrawal attempts for today (0 if none)
   */
  async getDailyAttempts(userId: string): Promise<number> {
    const key = this.getDailyAttemptsKey(userId);
    const attempts = await this.redisService.get(key);
    return attempts ? Number.parseInt(attempts) : 0;
  }

  /**
   * Check if user has exceeded their daily withdrawal attempt limit
   * Throws BadRequestException if limit is exceeded
   * This check happens before the withdrawal is processed to prevent spam
   *
   * @param userId - The user's unique identifier
   * @param maxAttempts - Maximum allowed withdrawal attempts per day from tier config
   * @throws BadRequestException if daily limit is exceeded
   */
  async checkDailyLimit(userId: string, maxAttempts: number): Promise<void> {
    const currentAttempts = await this.getDailyAttempts(userId);

    if (currentAttempts >= maxAttempts) {
      this.logger.warn(
        `User ${userId} has exceeded daily withdrawal limit: ${currentAttempts}/${maxAttempts} attempts`,
      );

      // Calculate time until reset (midnight UTC)
      const now = DateTime.now().toUTC();
      const endOfDay = now.endOf('day');
      const hoursUntilReset = Math.ceil(endOfDay.diff(now, 'hours').hours);

      throw new BadRequestException(
        `You have reached your daily withdrawal attempt limit of ${maxAttempts}. Please try again in ${hoursUntilReset} hour(s).`,
      );
    }

    this.logger.log(`User ${userId} daily attempt check passed: ${currentAttempts}/${maxAttempts}`);
  }

  /**
   * Reset the daily attempt counter for a user
   * Typically used for administrative purposes or testing
   *
   * @param userId - The user's unique identifier
   */
  async resetDailyAttempts(userId: string): Promise<void> {
    const key = this.getDailyAttemptsKey(userId);
    await this.redisService.del(key);
    this.logger.log(`Reset daily withdrawal attempts for user ${userId}`);
  }

  /**
   * Generate the Redis key for daily withdrawal attempts
   * Format: withdrawal-attempts:daily:{userId}
   * Key automatically expires at midnight UTC
   *
   * @param userId - The user's unique identifier
   * @returns The Redis key string
   */
  private getDailyAttemptsKey(userId: string): string {
    return `withdrawal-attempts:daily:${userId}`;
  }
}
