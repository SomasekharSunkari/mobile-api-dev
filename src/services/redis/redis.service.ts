import { Injectable, Logger } from '@nestjs/common';
import Redis from 'ioredis';
import { EnvironmentService } from '../../config';
import { RedisConfigProvider } from '../../config/redis.config';

@Injectable()
export class RedisService {
  private readonly client: Redis;
  private readonly configProvider: RedisConfigProvider;
  private readonly logger: Logger;
  private readonly keyPrefix: string;

  constructor() {
    this.logger = new Logger(RedisService.name);
    this.configProvider = new RedisConfigProvider();
    const config = this.configProvider.getConfig();

    this.keyPrefix = config.keyPrefix || '';

    const redisConfig = {
      host: config.host,
      port: config.port,
      password: config.password,
      db: config.db,
      connectTimeout: config.connectTimeout,
      maxRetriesPerRequest: config.maxRetriesPerRequest,
      enableReadyCheck: config.enableReadyCheck,
      ...(EnvironmentService.getValue('REDIS_ENABLE_TLS') && { tls: {} }),
    };

    this.client = new Redis(redisConfig);

    this.client.on('error', (error) => {
      this.logger.error('Redis connection error:', error);
    });

    this.client.on('connect', () => {
      this.logger.log('Connected to Redis server');
    });
  }

  /**
   * Prepend the configured prefix to a key
   */
  private prefixKey(key: string): string {
    return `${this.keyPrefix}:${key}`;
  }

  /**
   * Get the Redis client instance
   */
  getClient(): Redis {
    return this.client;
  }

  /**
   * Set a value with optional expiry
   */
  async set(key: string, value: string | number | Buffer, ttl?: number): Promise<'OK'> {
    const prefixedKey = this.prefixKey(key);
    if (ttl) {
      return this.client.set(prefixedKey, value, 'EX', ttl);
    }
    return this.client.set(prefixedKey, value);
  }

  /**
   * Get a value by key
   */
  async get(key: string): Promise<string | null> {
    return this.client.get(this.prefixKey(key));
  }

  /**
   * Delete one or more keys
   */
  async del(...keys: string[]): Promise<number> {
    const prefixedKeys = keys.map((key) => this.prefixKey(key));
    return this.client.del(...prefixedKeys);
  }

  /**
   * Check if a key exists
   */
  async exists(key: string): Promise<number> {
    return this.client.exists(this.prefixKey(key));
  }

  /**
   * Set expiry on a key
   */
  async expire(key: string, seconds: number): Promise<number> {
    return this.client.expire(this.prefixKey(key), seconds);
  }

  /**
   * Set a hash field
   */
  async hset(key: string, field: string, value: string | number): Promise<number> {
    return this.client.hset(this.prefixKey(key), field, value);
  }

  /**
   * Get a hash field
   */
  async hget(key: string, field: string): Promise<string | null> {
    return this.client.hget(this.prefixKey(key), field);
  }

  /**
   * Get all fields and values in a hash
   */
  async hgetall(key: string): Promise<Record<string, string>> {
    return this.client.hgetall(this.prefixKey(key));
  }

  /**
   * Delete a hash field
   */
  async hdel(key: string, ...fields: string[]): Promise<number> {
    return this.client.hdel(this.prefixKey(key), ...fields);
  }

  /**
   * Add a member to a set
   */
  async sadd(key: string, ...members: string[]): Promise<number> {
    return this.client.sadd(this.prefixKey(key), ...members);
  }

  /**
   * Get all members in a set
   */
  async smembers(key: string): Promise<string[]> {
    return this.client.smembers(this.prefixKey(key));
  }

  /**
   * Add members to a list
   */
  async lpush(key: string, ...values: string[]): Promise<number> {
    return this.client.lpush(this.prefixKey(key), ...values);
  }

  /**
   * Get a range of elements from a list
   */
  async lrange(key: string, start: number, stop: number): Promise<string[]> {
    return this.client.lrange(this.prefixKey(key), start, stop);
  }

  /**
   * Get the length of a list
   */
  async llen(key: string): Promise<number> {
    return this.client.llen(this.prefixKey(key));
  }

  /**
   * Publish a message to a channel
   */
  async publish(channel: string, message: string): Promise<number> {
    return this.client.publish(channel, message);
  }

  /**
   * Subscribe to a channel or channels
   */
  async subscribe(...channels: string[]): Promise<void> {
    await this.client.subscribe(...channels);
  }

  /**
   * Find all keys matching a pattern
   */
  async keys(pattern: string): Promise<string[]> {
    return this.client.keys(this.prefixKey(pattern));
  }

  /**
   * Execute a pipeline of commands
   */
  pipeline() {
    return this.client.pipeline();
  }

  /**
   * Execute a transaction (multi/exec)
   */
  multi() {
    return this.client.multi();
  }

  /**
   * Close the Redis connection
   */
  async close(): Promise<void> {
    await this.client.quit();
  }
}
