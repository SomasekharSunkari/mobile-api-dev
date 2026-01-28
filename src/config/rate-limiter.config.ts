import { ConfigProvider } from './core/define-config';

export interface RateLimiterConfig {
  points: number;
  duration: number;
  blockDuration: number;
  keyPrefix: string;
  whitelistedIPs: string[];
  blacklistedIPs: string[];
  storeClient?: 'memory' | 'redis';
  redis?: {
    host: string;
    port: number;
    password?: string;
    db?: number;
  };
}

export class RateLimiterConfigProvider extends ConfigProvider<RateLimiterConfig> {
  getConfig(): RateLimiterConfig {
    return {
      points: Number(process.env.RATE_LIMIT_POINTS) || 100,
      duration: Number(process.env.RATE_LIMIT_DURATION) || 60,
      blockDuration: Number(process.env.RATE_LIMIT_BLOCK_DURATION) || 60,
      keyPrefix: process.env.RATE_LIMIT_KEY_PREFIX || 'rl:',
      whitelistedIPs: (process.env.RATE_LIMIT_WHITELIST || '').split(',').filter(Boolean),
      blacklistedIPs: (process.env.RATE_LIMIT_BLACKLIST || '').split(',').filter(Boolean),
      storeClient: (process.env.RATE_LIMIT_STORE || 'memory') as 'memory' | 'redis',
      redis: {
        host: process.env.REDIS_HOST || 'localhost',
        port: Number(process.env.REDIS_PORT) || 6379,
        password: process.env.REDIS_PASSWORD || undefined,
        db: Number(process.env.REDIS_DB || 0),
      },
    };
  }
}
