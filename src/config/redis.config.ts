import { ConfigProvider } from './core/define-config';

export interface RedisConfig {
  host: string;
  port: number;
  password?: string;
  db?: number;
  keyPrefix?: string;
  ttl?: number;
  connectTimeout?: number;
  maxRetriesPerRequest?: number;
  enableReadyCheck?: boolean;
}

export class RedisConfigProvider extends ConfigProvider<RedisConfig> {
  getConfig(): RedisConfig {
    return {
      host: process.env.REDIS_HOST || 'localhost',
      port: Number(process.env.REDIS_PORT) || 6379,
      password: process.env.REDIS_PASSWORD || undefined,
      db: Number(process.env.REDIS_DB || 0),
      keyPrefix: process.env.REDIS_KEY_PREFIX || 'onedosh:',
      ttl: 86400, // 24 hours
      connectTimeout: 10000,
      maxRetriesPerRequest: 1,
      enableReadyCheck: true,
    };
  }
}
