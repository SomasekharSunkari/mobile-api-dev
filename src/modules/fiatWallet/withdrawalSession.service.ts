import { BadRequestException, Inject, Injectable, Logger } from '@nestjs/common';
import { RedisService } from '../../services/redis/redis.service';

/**
 * Service for tracking active withdrawal sessions to prevent concurrent withdrawals
 * Multiple simultaneous withdrawals from different sessions can bypass limits and cause race conditions
 * This service ensures only one withdrawal per user can be in progress at any time
 */
@Injectable()
export class WithdrawalSessionService {
  private readonly logger = new Logger(WithdrawalSessionService.name);

  @Inject(RedisService)
  private readonly redisService: RedisService;

  // TTL for sessions: 5 minutes (300 seconds)
  // Automatic cleanup for stale sessions if processing gets stuck
  private readonly SESSION_TTL = 300;

  /**
   * Start a withdrawal session for a user
   * Adds the withdrawal ID to the user's active withdrawal sessions set in Redis
   * Sessions automatically expire after 5 minutes to cleanup stale sessions
   *
   * @param userId - The user's unique identifier
   * @param withdrawalId - The withdrawal transaction ID
   */
  async startSession(userId: string, withdrawalId: string): Promise<void> {
    const key = this.getSessionKey(userId);

    // Add withdrawal ID to the set of active sessions
    await this.redisService.getClient().sadd(key, withdrawalId);

    // Set TTL to auto-expire stale sessions
    await this.redisService.expire(key, this.SESSION_TTL);

    this.logger.log(`Started withdrawal session ${withdrawalId} for user ${userId}`);
  }

  /**
   * End a withdrawal session for a user
   * Removes the withdrawal ID from the user's active withdrawal sessions set
   * This should be called in the finally block to ensure cleanup even on error
   *
   * @param userId - The user's unique identifier
   * @param withdrawalId - The withdrawal transaction ID
   */
  async endSession(userId: string, withdrawalId: string): Promise<void> {
    const key = this.getSessionKey(userId);

    // Remove withdrawal ID from the set
    await this.redisService.getClient().srem(key, withdrawalId);

    this.logger.log(`Ended withdrawal session ${withdrawalId} for user ${userId}`);

    // If set is now empty, delete the key to save memory
    const remainingSessions = await this.getActiveSessions(userId);
    if (remainingSessions.length === 0) {
      await this.redisService.del(key);
    }
  }

  /**
   * Get all active withdrawal session IDs for a user
   *
   * @param userId - The user's unique identifier
   * @returns Array of active withdrawal transaction IDs
   */
  async getActiveSessions(userId: string): Promise<string[]> {
    const key = this.getSessionKey(userId);

    // Get all members of the set
    const sessions = await this.redisService.getClient().smembers(key);

    return sessions || [];
  }

  /**
   * Check if a user has any active withdrawal sessions
   * Used to block concurrent withdrawal attempts
   *
   * @param userId - The user's unique identifier
   * @returns true if user has active withdrawal sessions, false otherwise
   */
  async hasActiveSession(userId: string): Promise<boolean> {
    const sessions = await this.getActiveSessions(userId);
    return sessions.length > 0;
  }

  /**
   * Check if a user has active sessions and throw error if they do
   * This is the main security check to prevent concurrent withdrawals
   *
   * @param userId - The user's unique identifier
   * @throws BadRequestException if user has active withdrawal in progress
   */
  async checkAndBlockConcurrent(userId: string): Promise<void> {
    const hasActive = await this.hasActiveSession(userId);

    if (hasActive) {
      const activeSessions = await this.getActiveSessions(userId);
      this.logger.warn(`User ${userId} attempted concurrent withdrawal. Active sessions: ${activeSessions.length}`);

      throw new BadRequestException(
        'Another withdrawal is currently in progress. Please wait for it to complete before initiating a new withdrawal.',
      );
    }
  }

  /**
   * Force clear all active sessions for a user
   * Typically used for administrative purposes or error recovery
   *
   * @param userId - The user's unique identifier
   */
  async clearAllSessions(userId: string): Promise<void> {
    const key = this.getSessionKey(userId);
    await this.redisService.del(key);
    this.logger.log(`Cleared all withdrawal sessions for user ${userId}`);
  }

  /**
   * Generate the Redis key for user's active withdrawal sessions
   * Format: withdrawal-session:active:{userId}
   * Value type: Redis Set (SADD/SREM operations)
   *
   * @param userId - The user's unique identifier
   * @returns The Redis key string
   */
  private getSessionKey(userId: string): string {
    return `withdrawal-session:active:${userId}`;
  }
}
