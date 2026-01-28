import { Inject, Injectable, Logger } from '@nestjs/common';
import { RedisConfigProvider } from '../../config/redis.config';
import { RedisService } from './redis.service';

@Injectable()
export class RedisCacheService {
  private readonly logger = new Logger(RedisCacheService.name);
  @Inject(RedisService)
  private readonly redisService: RedisService;

  private readonly configProvider: RedisConfigProvider;
  private readonly defaultTTL: number;

  constructor() {
    this.configProvider = new RedisConfigProvider();

    this.defaultTTL = this.configProvider.getConfig().ttl || 86400;
  }

  /**
   * Set a value in the cache with optional TTL
   */
  async set(key: string, value: any, ttl?: number): Promise<'OK'> {
    const serializedValue = JSON.stringify(value);
    return this.redisService.set(key, serializedValue, ttl || this.defaultTTL);
  }

  /**
   * Get a value from the cache
   */
  async get<T>(key: string): Promise<T | null> {
    const value = await this.redisService.get(key);
    if (!value) return null;

    try {
      return JSON.parse(value) as T;
    } catch (error) {
      this.logger.error(`Failed to parse cached value for key ${key}:`, error);
      return null;
    }
  }

  /**
   * Delete cache entry
   */
  async del(key: string): Promise<number> {
    return this.redisService.del(key);
  }

  /**
   * Check if a key exists
   */
  async exists(key: string): Promise<boolean> {
    const result = await this.redisService.exists(key);
    return result === 1;
  }

  /**
   * Get or set cache value
   * If key exists, returns cached value
   * If key doesn't exist, calls factory function, caches and returns the result
   */
  async getOrSet<T>(key: string, factory: () => Promise<T>, ttl?: number): Promise<T> {
    const cached = await this.get<T>(key);

    if (cached !== null) {
      return cached;
    }

    const result = await factory();
    await this.set(key, result, ttl);
    return result;
  }

  /**
   * Set multiple hash fields
   */
  async hmset(key: string, data: Record<string, any>, ttl?: number): Promise<'OK'> {
    const pipeline = this.redisService.pipeline();

    Object.entries(data).forEach(([field, value]) => {
      pipeline.hset(key, field, typeof value === 'string' ? value : JSON.stringify(value));
    });

    if (ttl) {
      pipeline.expire(key, ttl);
    } else if (this.defaultTTL) {
      pipeline.expire(key, this.defaultTTL);
    }

    await pipeline.exec();
    return 'OK';
  }

  /**
   * Get a hash field with automatic deserialization
   */
  async hgetJson<T>(key: string, field: string): Promise<T | null> {
    const value = await this.redisService.hget(key, field);
    if (!value) return null;

    try {
      return JSON.parse(value) as T;
    } catch {
      return value as unknown as T;
    }
  }

  /**
   * Get all hash fields with automatic deserialization
   */
  async hgetallJson<T>(key: string): Promise<Record<string, T> | null> {
    const data = await this.redisService.hgetall(key);
    if (!data || Object.keys(data).length === 0) return null;

    const result: Record<string, any> = {};

    for (const [field, value] of Object.entries(data)) {
      try {
        result[field] = JSON.parse(value);
      } catch {
        result[field] = value;
      }
    }

    return result as Record<string, T>;
  }

  /**
   * Get underlying Redis service
   */
  getRedisService(): RedisService {
    return this.redisService;
  }
}
