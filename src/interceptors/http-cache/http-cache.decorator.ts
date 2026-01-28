import { applyDecorators, SetMetadata, UseInterceptors } from '@nestjs/common';
import { HttpCacheInterceptor } from './http-cache.interceptor';

export const HTTP_CACHE_KEY = 'http_cache_options';

export interface HttpCacheOptions {
  /**
   * Time to live for the cache.
   * Accepts human-readable strings (e.g., '1h', '30m', '2d') or seconds as number.
   * Defaults to '1m' (60 seconds).
   *
   * @example '30s' - 30 seconds
   * @example '5m' - 5 minutes
   * @example '1h' - 1 hour
   * @example '2d' - 2 days
   * @example 300 - 300 seconds (5 minutes)
   */
  ttl?: string | number;
  /** Custom cache key prefix, defaults to route path */
  keyPrefix?: string;
  /** Include query params in cache key, defaults to true */
  includeQuery?: boolean;
  /** Include specific headers in cache key */
  includeHeaders?: string[];
}

/**
 * Decorator that enables Redis caching for HTTP GET responses.
 * Can be applied to a single method or an entire controller class.
 *
 * @param options - Cache configuration options
 * @example
 * // Apply to a single method with 1 hour TTL
 * @HttpCache({ ttl: '1h' })
 * @Get()
 * async findAll() { ... }
 *
 * @example
 * // Apply with 30 minutes TTL
 * @HttpCache({ ttl: '30m', keyPrefix: 'banks' })
 * @Get()
 * async findAll() { ... }
 *
 * @example
 * // Apply with seconds as number (300 seconds = 5 minutes)
 * @HttpCache({ ttl: 300 })
 * @Get()
 * async findAll() { ... }
 */
export const HttpCache = (options: HttpCacheOptions = {}): ClassDecorator & MethodDecorator => {
  return applyDecorators(SetMetadata(HTTP_CACHE_KEY, options), UseInterceptors(HttpCacheInterceptor));
};
