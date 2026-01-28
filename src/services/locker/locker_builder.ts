import { Logger } from '@nestjs/common';
import { randomBytes } from 'crypto';
import Redis from 'ioredis';
import { LockNotOwnedError } from './lock.error';

/**
 * Represents a distributed lock using Redis
 */
export class LockBuilder {
  private key: string;
  private owner: string;
  private ttl: number | null;
  private expirationTime: number | null = null;
  private logger: Logger;
  private redisClient: Redis;

  constructor(
    key: string,
    redisClient: Redis,
    logger: Logger,
    owner?: string,
    ttl?: number | null,
    expirationTime?: number | null,
  ) {
    this.key = key;
    this.ttl = ttl ?? 30000; // Default 30 seconds
    this.redisClient = redisClient;
    this.owner = owner ?? this.generateOwner();
    this.expirationTime = expirationTime ?? null;
    this.logger = logger;
  }

  /**
   * Generate a random owner ID for this lock
   */
  private generateOwner(): string {
    return randomBytes(16).toString('hex');
  }

  /**
   * Returns the owner ID of this lock
   */
  getOwner(): string {
    return this.owner;
  }

  /**
   * Attempts to acquire the lock
   * @param options Optional configuration for retry behavior
   */
  async acquire(options: { retryCount?: number; retryDelay?: number; timeout?: number } = {}): Promise<boolean> {
    this.expirationTime = null;

    const retryCount = options.retryCount ?? Number.POSITIVE_INFINITY;
    const retryDelay = options.retryDelay ?? 250;
    const timeout = options.timeout;

    let attemptsDone = 0;
    const start = Date.now();

    while (attemptsDone++ < retryCount) {
      const now = Date.now();

      // Try to acquire the lock
      const result = await this.save();
      if (result) {
        this.expirationTime = this.ttl ? now + this.ttl : null;
        this.logger.debug(`Lock acquired for key: ${this.key}`);
        return true;
      }

      // Check if we reached the maximum number of attempts
      if (attemptsDone === retryCount) return false;

      // Or check if we reached the timeout
      const elapsed = Date.now() - start;
      if (timeout && elapsed > timeout) return false;

      // Wait before retrying
      await new Promise((resolve) => setTimeout(resolve, retryDelay));
    }

    return false;
  }

  /**
   * Try to acquire the lock immediately without retries
   */
  async acquireImmediately(): Promise<boolean> {
    const result = await this.save();
    if (!result) return false;

    this.expirationTime = this.ttl ? Date.now() + this.ttl : null;
    this.logger.debug(`Lock acquired immediately for key: ${this.key}`);
    return true;
  }

  /**
   * Save the lock to Redis
   */
  private async save(): Promise<boolean> {
    if (this.ttl) {
      const result = await this.redisClient.set(this.key, this.owner, 'PX', this.ttl, 'NX');
      return result === 'OK';
    }

    const result = await this.redisClient.setnx(this.key, this.owner);
    return result === 1;
  }

  /**
   * Run a callback while holding the lock, releasing automatically after
   */
  async run<T>(callback: () => Promise<T>): Promise<T | null> {
    const acquired = await this.acquire();
    if (!acquired) return null;

    try {
      return await callback();
    } finally {
      await this.release();
    }
  }

  /**
   * Delete the lock if owned by this instance
   */
  async release(): Promise<void> {
    const lua = `
      if redis.call("get", KEYS[1]) == ARGV[1] then
        return redis.call("del", KEYS[1])
      else
        return 0
      end
    `;

    const result = await this.redisClient.eval(lua, 1, this.key, this.owner);
    if (result === 0) throw new LockNotOwnedError();

    this.logger.debug(`Lock released for key: ${this.key}`);
  }

  /**
   * Force release the lock regardless of ownership
   */
  async forceRelease(): Promise<void> {
    await this.redisClient.del(this.key);
    this.logger.debug(`Lock force released for key: ${this.key}`);
  }

  /**
   * Check if a lock exists in Redis
   */
  async exists(): Promise<boolean> {
    const result = await this.redisClient.get(this.key);
    return !!result;
  }

  /**
   * Check if the lock is expired
   */
  isExpired(): boolean {
    if (this.expirationTime === null) return false;
    return this.expirationTime < Date.now();
  }

  /**
   * Get remaining milliseconds before expiration
   */
  getRemainingTime(): number | null {
    if (this.expirationTime === null) return null;
    return this.expirationTime - Date.now();
  }

  /**
   * Extend the lock's TTL
   */
  async extend(duration?: number): Promise<void> {
    const ttl = duration || this.ttl;
    if (!ttl) throw new Error('Cannot extend a lock without TTL');

    const lua = `
      if redis.call("get", KEYS[1]) == ARGV[1] then
        return redis.call("pexpire", KEYS[1], ARGV[2])
      else
        return 0
      end
    `;

    const result = await this.redisClient.eval(lua, 1, this.key, this.owner, ttl);
    if (result === 0) throw new LockNotOwnedError();

    const now = Date.now();
    this.expirationTime = now + ttl;
    this.logger.debug(`Lock extended for key: ${this.key}, new expiration: ${this.expirationTime}`);
  }
}
