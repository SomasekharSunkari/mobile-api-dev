import { Injectable, Logger } from '@nestjs/common';
import { RedisCacheService } from '../../services/redis/redis-cache.service';
const CACHE_KEY_PREFIX = 'http_cache';

@Injectable()
export class HttpCacheService {
  private readonly logger = new Logger(HttpCacheService.name);

  constructor(private readonly redisCacheService: RedisCacheService) {}

  /**
   * Clear cache for a specific key prefix.
   * Useful for invalidating all cache entries for a specific route or resource.
   *
   * @param keyPrefix - The prefix to match (e.g., 'banks', 'users')
   * @returns Number of keys deleted
   *
   * @example
   * // Clear all bank-related cache
   * await httpCacheService.clearByPrefix('banks');
   */
  async clearByPrefix(keyPrefix: string): Promise<number> {
    const pattern = `${CACHE_KEY_PREFIX}:${keyPrefix}:*`;
    return this.clearByPattern(pattern);
  }

  /**
   * Clear cache for a specific path.
   *
   * @param path - The exact path to clear (e.g., '/banks', '/users/123')
   * @returns Number of keys deleted
   *
   * @example
   * // Clear cache for /banks endpoint
   * await httpCacheService.clearByPath('/banks');
   */
  async clearByPath(path: string): Promise<number> {
    const pattern = `${CACHE_KEY_PREFIX}:*:${path}*`;
    return this.clearByPattern(pattern);
  }

  /**
   * Clear all HTTP cache entries.
   *
   * @returns Number of keys deleted
   *
   * @example
   * await httpCacheService.clearAll();
   */
  async clearAll(): Promise<number> {
    const pattern = `${CACHE_KEY_PREFIX}:*`;
    return this.clearByPattern(pattern);
  }

  /**
   * Clear cache by a custom pattern.
   *
   * @param pattern - Redis key pattern (supports wildcards)
   * @returns Number of keys deleted
   *
   * @example
   * // Clear using custom pattern
   * await httpCacheService.clearByPattern('http_cache:banks:banks*');
   */
  async clearByPattern(pattern: string): Promise<number> {
    try {
      const redisService = this.redisCacheService.getRedisService();
      const keys = await redisService.keys(pattern);

      if (keys.length === 0) {
        this.logger.debug(`No cache keys found matching pattern: ${pattern}`);
        return 0;
      }

      // Keys returned already have the global prefix, so we need to delete them directly
      const client = redisService.getClient();
      const deletedCount = await client.del(...keys);

      this.logger.log(`Cleared ${deletedCount} cache entries matching pattern: ${pattern}`);
      return deletedCount;
    } catch (error) {
      this.logger.error(`Failed to clear cache for pattern ${pattern}:`, error);
      throw error;
    }
  }

  /**
   * Clear cache for a specific exact key.
   *
   * @param key - The exact cache key (without the http_cache prefix)
   * @returns true if deleted, false if key didn't exist
   *
   * @example
   * await httpCacheService.clearByKey('banks:/banks:{"country_id":"1"}');
   */
  async clearByKey(key: string): Promise<boolean> {
    const fullKey = `${CACHE_KEY_PREFIX}:${key}`;
    const deleted = await this.redisCacheService.del(fullKey);
    return deleted > 0;
  }
}
