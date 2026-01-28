import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule } from '@nestjs/throttler';
import { RateLimiterConfigProvider } from '../../config/rate-limiter.config';
import { RedisModule } from '../../services/redis/redis.module';
import { RedisService } from '../../services/redis/redis.service';
import { CustomThrottlerGuard } from './custom-throttler.guard';
import { RedisThrottlerStorage } from './rate-limiter.storage';

@Module({
  imports: [
    RedisModule,
    ThrottlerModule.forRootAsync({
      imports: [RedisModule],
      inject: [RedisService],
      useFactory: (redisService: RedisService) => {
        const config = new RateLimiterConfigProvider().getConfig();

        return {
          throttlers: [
            {
              name: 'default',
              ttl: config.duration,
              limit: config.points,
              blockDuration: config.blockDuration,
            },
          ],
          errorMessage: 'Too many requests.',
          storage: new RedisThrottlerStorage(redisService),
          generateKey: (ctx, tracker) => {
            const req = ctx.switchToHttp().getRequest();
            const id = req.user?.id || tracker;
            const prefix = 'rl:';
            const path = req.route?.path || req.originalUrl || req.url;
            const method = req.method;
            return `${prefix}${id}:${method}:${path}`;
          },
        };
      },
    }),
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: CustomThrottlerGuard,
    },
  ],
})
export class RateLimiterModule {}
