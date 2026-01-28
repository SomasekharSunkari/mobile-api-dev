import { Module } from '@nestjs/common';
import { RateLimiterConfigProvider } from '../rate-limiter.config';
import { RedisConfigProvider } from '../redis.config';
import { ResendConfigProvider } from '../resend.config';
import { SinchConfigProvider } from '../sinch.config';
import { ConfigService } from './config.service';

@Module({
  providers: [
    ConfigService,
    {
      provide: 'CONFIG_INIT',
      useFactory: () => {
        // Register configuration providers
        ConfigService.register('redis', new RedisConfigProvider());
        ConfigService.register('ratelimiter', new RateLimiterConfigProvider());
        ConfigService.register('resend', new ResendConfigProvider());
        ConfigService.register('sinch', new SinchConfigProvider());
        return true;
      },
    },
  ],
  exports: [ConfigService],
})
export class ConfigModule {}
