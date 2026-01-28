import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import Redis from 'ioredis';
import { RedisService } from '../redis/redis.service';
import { LockBuilder } from './locker_builder';

@Injectable()
export class LockerService implements OnModuleInit {
  private readonly logger: Logger;
  private redisClient: Redis;

  @Inject(RedisService)
  private readonly redisService: RedisService;

  constructor() {
    this.logger = new Logger(LockerService.name);
  }

  onModuleInit() {
    this.redisClient = this.redisService.getClient();
  }

  /**
   * Create a lock with the given key
   * @param key The unique key for the lock
   * @param options Optional lock options
   */
  createLock(key: string, options?: { ttl?: number; retryCount?: number; retryDelay?: number }) {
    return new LockBuilder(key, this.redisClient, this.logger, undefined, options?.ttl);
  }

  /**
   * Execute a function with a lock
   * @param key The unique key for the lock
   * @param callback The function to execute while holding the lock
   * @param options Optional lock options
   */
  async withLock<T>(
    key: string,
    callback: () => Promise<T>,
    options?: { ttl?: number; retryCount?: number; retryDelay?: number },
  ): Promise<T> {
    const lock = this.createLock(key, options);

    try {
      const acquired = await lock.acquire({
        retryCount: options?.retryCount,
        retryDelay: options?.retryDelay,
      });

      if (!acquired) {
        throw new Error(`Could not acquire lock for key: ${key}`);
      }

      this.logger.debug(`Lock acquired for key: ${key}`);

      try {
        const result = await callback();
        return result;
      } finally {
        await lock.release();
        this.logger.debug(`Lock released for key: ${key}`);
      }
    } catch (error) {
      this.logger.error(`Error while executing locked operation for key: ${key}`, error);
      throw error;
    }
  }

  /**
   * Execute a function with a lock using the run method
   * @param key The unique key for the lock
   * @param callback The function to execute while holding the lock
   * @param options Optional lock options
   */
  async runWithLock<T>(
    key: string,
    callback: () => Promise<T>,
    options?: { ttl?: number; retryCount?: number; retryDelay?: number },
  ): Promise<T> {
    const lock = this.createLock(key, options);

    try {
      const result = await lock.run<T>(callback);
      if (result === null) {
        throw new Error(`Could not acquire lock for key: ${key}`);
      }
      return result;
    } catch (error) {
      this.logger.error(`Error while executing locked operation for key: ${key}`, error);
      throw error;
    }
  }

  /**
   * Check if a lock exists
   * @param key The lock key to check
   */
  async isLocked(key: string): Promise<boolean> {
    const lock = this.createLock(key);
    return lock.exists();
  }

  /**
   * Force release a lock
   * @param key The lock key to release
   */
  async forceRelease(key: string): Promise<void> {
    const lock = this.createLock(key);
    await lock.forceRelease();
    this.logger.debug(`Lock force released for key: ${key}`);
  }
}
