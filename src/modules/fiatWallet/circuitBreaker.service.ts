import { Inject, Injectable, Logger } from '@nestjs/common';
import { EventEmitterEventsEnum } from '../../services/eventEmitter/eventEmitter.interface';
import { EventEmitterService } from '../../services/eventEmitter/eventEmitter.service';
import { RedisService } from '../../services/redis/redis.service';

/**
 * Circuit Breaker Pattern Implementation for External Provider Calls
 * Protects the system from cascading failures when external provider has issues
 *
 * States:
 * - CLOSED: Normal operation, requests pass through
 * - OPEN: Provider is failing, block all requests temporarily
 * - HALF_OPEN: Testing if provider recovered, allow limited requests
 *
 * This prevents:
 * - Wasting resources on failing provider calls
 * - User frustration from repeated failures
 * - System overload from retry storms
 */
@Injectable()
export class CircuitBreakerService {
  private readonly logger = new Logger(CircuitBreakerService.name);

  @Inject(RedisService)
  private readonly redisService: RedisService;

  @Inject(EventEmitterService)
  private readonly eventEmitterService: EventEmitterService;

  // Configuration
  private readonly config = {
    failureThreshold: 0.5, // 50% failure rate triggers circuit open
    windowSeconds: 900, // 15 minute window for calculating failure rate
    minAttempts: 10, // Minimum attempts before opening circuit
    openDurationSeconds: 300, // 5 minutes circuit stays open
    halfOpenMaxAttempts: 3, // Maximum test attempts in half-open state
  };

  /**
   * Record the result of a transaction attempt (success or failure)
   * Updates the rolling window of attempts and checks if circuit state should change
   *
   * @param provider - The provider name (e.g., 'ninepayment', 'waas')
   * @param success - Whether the attempt was successful
   */
  async recordAttempt(provider: string, success: boolean): Promise<void> {
    const now = Date.now();
    const key = success ? this.getSuccessesKey(provider) : this.getFailuresKey(provider);

    // Add to sorted set with timestamp as score
    await this.redisService.getClient().zadd(key, now, `${now}`);

    // Remove old entries outside the window
    const windowStart = now - this.config.windowSeconds * 1000;
    await this.redisService.getClient().zremrangebyscore(key, '-inf', windowStart);

    // Set TTL to auto-expire old data
    await this.redisService.expire(key, this.config.windowSeconds);

    this.logger.log(`Recorded ${success ? 'success' : 'failure'} for provider ${provider}`);

    // Check if circuit should change state based on new data
    await this.checkAndUpdateState(provider);
  }

  /**
   * Check if circuit allows requests to proceed
   * Returns decision on whether to allow the request and reason if blocked
   *
   * @param provider - The provider name
   * @returns Object with allowed flag and optional reason if blocked
   */
  async canProceed(provider: string): Promise<{ allowed: boolean; reason?: string }> {
    const state = await this.getState(provider);

    if (state === 'CLOSED') {
      return { allowed: true };
    }

    if (state === 'OPEN') {
      // Check if open duration has passed
      const openedAt = await this.getOpenedAt(provider);
      const now = Date.now();

      if (openedAt && now - openedAt > this.config.openDurationSeconds * 1000) {
        // Transition to HALF_OPEN to test recovery
        await this.setState(provider, 'HALF_OPEN');
        await this.resetHalfOpenAttempts(provider);
        this.logger.log(`Circuit breaker for ${provider} transitioned from OPEN to HALF_OPEN`);
        return { allowed: true };
      }

      const remainingSeconds = Math.ceil((this.config.openDurationSeconds * 1000 - (now - openedAt)) / 1000);
      return {
        allowed: false,
        reason: `Withdrawal service temporarily unavailable due to high provider failure rate. Please try again in ${remainingSeconds} second(s).`,
      };
    }

    if (state === 'HALF_OPEN') {
      // Allow limited test attempts
      const testAttempts = await this.getHalfOpenAttempts(provider);

      if (testAttempts < this.config.halfOpenMaxAttempts) {
        await this.incrementHalfOpenAttempts(provider);
        this.logger.log(`Allowing test attempt ${testAttempts + 1}/${this.config.halfOpenMaxAttempts} for ${provider}`);
        return { allowed: true };
      }

      return {
        allowed: false,
        reason: 'Service recovery testing in progress. Please try again shortly.',
      };
    }

    // Default to closed if unknown state
    return { allowed: true };
  }

  /**
   * Calculate failure rate and update circuit state if needed
   * This is called after every attempt is recorded
   *
   * @param provider - The provider name
   */
  private async checkAndUpdateState(provider: string): Promise<void> {
    const now = Date.now();
    const windowStart = now - this.config.windowSeconds * 1000;

    // Get counts from sorted sets
    const failures = await this.redisService.getClient().zcount(this.getFailuresKey(provider), windowStart, now);

    const successes = await this.redisService.getClient().zcount(this.getSuccessesKey(provider), windowStart, now);

    const total = failures + successes;

    // Need minimum attempts before making decision
    if (total < this.config.minAttempts) {
      return;
    }

    const failureRate = failures / total;
    const currentState = await this.getState(provider);

    if (failureRate >= this.config.failureThreshold) {
      // Failure rate exceeds threshold
      if (currentState === 'CLOSED' || currentState === 'HALF_OPEN') {
        // Open the circuit
        await this.setState(provider, 'OPEN');
        await this.setOpenedAt(provider, now);

        this.logger.error(
          `Circuit breaker OPENED for ${provider}. ` +
            `Failure rate: ${(failureRate * 100).toFixed(1)}% (${failures}/${total} failed)`,
        );

        // Alert operations team
        this.eventEmitterService.emit(EventEmitterEventsEnum.CIRCUIT_BREAKER_OPENED, {
          provider,
          failureRate,
          failures,
          total,
          timestamp: new Date().toISOString(),
        });
      }
    } else if (currentState === 'HALF_OPEN') {
      // Success rate improved in half-open state, close the circuit
      await this.setState(provider, 'CLOSED');
      await this.clearOpenedAt(provider);
      await this.resetHalfOpenAttempts(provider);

      this.logger.log(
        `Circuit breaker CLOSED for ${provider}. ` +
          `Service recovered. Failure rate: ${(failureRate * 100).toFixed(1)}%`,
      );

      // Alert operations team about recovery
      this.eventEmitterService.emit(EventEmitterEventsEnum.CIRCUIT_BREAKER_CLOSED, {
        provider,
        failureRate,
        failures,
        total,
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * Get current circuit state for a provider
   */
  private async getState(provider: string): Promise<'CLOSED' | 'OPEN' | 'HALF_OPEN'> {
    const state = await this.redisService.get(this.getStateKey(provider));
    return (state as 'CLOSED' | 'OPEN' | 'HALF_OPEN') || 'CLOSED';
  }

  /**
   * Set circuit state for a provider
   */
  private async setState(provider: string, state: 'CLOSED' | 'OPEN' | 'HALF_OPEN'): Promise<void> {
    await this.redisService.set(this.getStateKey(provider), state, this.config.windowSeconds * 2);
  }

  /**
   * Get timestamp when circuit was opened
   */
  private async getOpenedAt(provider: string): Promise<number | null> {
    const timestamp = await this.redisService.get(this.getOpenedAtKey(provider));
    return timestamp ? Number.parseInt(timestamp) : null;
  }

  /**
   * Set timestamp when circuit was opened
   */
  private async setOpenedAt(provider: string, timestamp: number): Promise<void> {
    await this.redisService.set(
      this.getOpenedAtKey(provider),
      timestamp.toString(),
      this.config.openDurationSeconds + 60,
    );
  }

  /**
   * Clear the opened timestamp
   */
  private async clearOpenedAt(provider: string): Promise<void> {
    await this.redisService.del(this.getOpenedAtKey(provider));
  }

  /**
   * Get number of test attempts in half-open state
   */
  private async getHalfOpenAttempts(provider: string): Promise<number> {
    const attempts = await this.redisService.get(this.getHalfOpenAttemptsKey(provider));
    return attempts ? Number.parseInt(attempts) : 0;
  }

  /**
   * Increment half-open test attempts counter
   */
  private async incrementHalfOpenAttempts(provider: string): Promise<void> {
    await this.redisService.getClient().incr(this.getHalfOpenAttemptsKey(provider));
    await this.redisService.expire(this.getHalfOpenAttemptsKey(provider), 60);
  }

  /**
   * Reset half-open test attempts counter
   */
  private async resetHalfOpenAttempts(provider: string): Promise<void> {
    await this.redisService.del(this.getHalfOpenAttemptsKey(provider));
  }

  /**
   * Force open the circuit (for testing or manual intervention)
   */
  async forceOpen(provider: string): Promise<void> {
    await this.setState(provider, 'OPEN');
    await this.setOpenedAt(provider, Date.now());
    this.logger.warn(`Circuit breaker manually forced OPEN for ${provider}`);
  }

  /**
   * Force close the circuit (for testing or manual intervention)
   */
  async forceClose(provider: string): Promise<void> {
    await this.setState(provider, 'CLOSED');
    await this.clearOpenedAt(provider);
    await this.resetHalfOpenAttempts(provider);
    this.logger.warn(`Circuit breaker manually forced CLOSED for ${provider}`);
  }

  /**
   * Get circuit breaker statistics for monitoring
   */
  async getStats(provider: string): Promise<{
    state: string;
    failures: number;
    successes: number;
    failureRate: number;
    openedAt: number | null;
  }> {
    const now = Date.now();
    const windowStart = now - this.config.windowSeconds * 1000;

    const failures = await this.redisService.getClient().zcount(this.getFailuresKey(provider), windowStart, now);

    const successes = await this.redisService.getClient().zcount(this.getSuccessesKey(provider), windowStart, now);

    const total = failures + successes;
    const failureRate = total > 0 ? failures / total : 0;

    return {
      state: await this.getState(provider),
      failures,
      successes,
      failureRate,
      openedAt: await this.getOpenedAt(provider),
    };
  }

  // Redis key generators
  private getStateKey(provider: string): string {
    return `circuit-breaker:${provider}:state`;
  }

  private getFailuresKey(provider: string): string {
    return `circuit-breaker:${provider}:failures`;
  }

  private getSuccessesKey(provider: string): string {
    return `circuit-breaker:${provider}:successes`;
  }

  private getOpenedAtKey(provider: string): string {
    return `circuit-breaker:${provider}:opened-at`;
  }

  private getHalfOpenAttemptsKey(provider: string): string {
    return `circuit-breaker:${provider}:half-open-attempts`;
  }
}
