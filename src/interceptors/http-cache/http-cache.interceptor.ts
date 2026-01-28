import { CallHandler, ExecutionContext, Injectable, Logger, NestInterceptor } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { Observable, of, tap } from 'rxjs';
import { RedisCacheService } from '../../services/redis/redis-cache.service';
import { HTTP_CACHE_KEY, HttpCacheOptions } from './http-cache.decorator';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const ms = require('ms');

const DEFAULT_TTL = '1m';
const CACHE_KEY_PREFIX = 'http_cache';

@Injectable()
export class HttpCacheInterceptor implements NestInterceptor {
  private readonly logger = new Logger(HttpCacheInterceptor.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly redisCacheService: RedisCacheService,
  ) {}

  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<any>> {
    const request = context.switchToHttp().getRequest<Request>();

    // Only cache GET requests
    if (request.method !== 'GET') {
      return next.handle();
    }

    const options = this.getCacheOptions(context);
    const ttlSeconds = this.parseTtl(options.ttl);
    const cacheKey = this.generateCacheKey(request, options, ttlSeconds);

    try {
      // Check if cached response exists
      const cachedResponse = await this.redisCacheService.get(cacheKey);

      if (cachedResponse !== null) {
        this.logger.debug(`Cache hit for key: ${cacheKey}`);
        return of(cachedResponse);
      }
    } catch (error) {
      this.logger.error(`Cache read error for key ${cacheKey}:`, error);
    }

    // Cache miss - proceed with handler and cache the response
    return next.handle().pipe(
      tap(async (response) => {
        // Only cache successful responses (those with statusCode < 300)
        if (this.isSuccessfulResponse(response)) {
          try {
            await this.redisCacheService.set(cacheKey, response, ttlSeconds);
            this.logger.debug(`Cached response for key: ${cacheKey} with TTL: ${ttlSeconds}s`);
          } catch (error) {
            this.logger.error(`Cache write error for key ${cacheKey}:`, error);
          }
        }
      }),
    );
  }

  /**
   * Parse TTL value to seconds.
   * Supports human-readable strings (e.g., '1h', '30m', '2d') or numbers (seconds).
   */
  private parseTtl(ttl: string | number | undefined): number {
    if (ttl === undefined) {
      return this.parseTtl(DEFAULT_TTL);
    }

    if (typeof ttl === 'number') {
      return ttl;
    }

    // Use ms package to parse human-readable string, then convert to seconds
    const milliseconds = ms(ttl);

    if (milliseconds === undefined) {
      this.logger.warn(`Invalid TTL format: ${ttl}, using default: ${DEFAULT_TTL}`);
      return this.parseTtl(DEFAULT_TTL);
    }

    return Math.floor(milliseconds / 1000);
  }

  private getCacheOptions(context: ExecutionContext): HttpCacheOptions {
    // Check method-level metadata first, then class-level
    const methodOptions = this.reflector.get<HttpCacheOptions>(HTTP_CACHE_KEY, context.getHandler());
    const classOptions = this.reflector.get<HttpCacheOptions>(HTTP_CACHE_KEY, context.getClass());

    return {
      ttl: DEFAULT_TTL,
      includeQuery: true,
      ...classOptions,
      ...methodOptions,
    };
  }

  private generateCacheKey(request: Request, options: HttpCacheOptions, ttlSeconds: number): string {
    const parts: string[] = [CACHE_KEY_PREFIX];

    // Add custom prefix or route path
    if (options.keyPrefix) {
      parts.push(options.keyPrefix);
    }

    // Add the base path
    parts.push(request.path);

    // Include TTL in cache key so changing TTL invalidates old cache
    parts.push(`ttl:${ttlSeconds}`);

    // Include query parameters if enabled
    if (options.includeQuery !== false && Object.keys(request.query).length > 0) {
      const sortedQuery = this.sortObject(request.query as Record<string, string>);
      parts.push(JSON.stringify(sortedQuery));
    }

    // Include specified headers if configured
    if (options.includeHeaders?.length) {
      const headerValues = options.includeHeaders
        .map((header) => `${header}:${request.headers[header.toLowerCase()] || ''}`)
        .join('|');
      parts.push(headerValues);
    }

    return parts.join(':');
  }

  private sortObject(obj: Record<string, string>): Record<string, string> {
    return Object.keys(obj)
      .sort((a, b) => a.localeCompare(b))
      .reduce(
        (sorted, key) => {
          sorted[key] = obj[key];
          return sorted;
        },
        {} as Record<string, string>,
      );
  }

  private isSuccessfulResponse(response: any): boolean {
    // Check if response follows the IResponse format with statusCode
    if (response && typeof response === 'object') {
      if ('statusCode' in response) {
        return response.statusCode >= 200 && response.statusCode < 300;
      }
      // If no statusCode, assume successful response
      return true;
    }
    return true;
  }
}
