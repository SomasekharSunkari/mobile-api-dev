import { Global, Module } from '@nestjs/common';
import { RedisCacheService } from './redis-cache.service';
import { RedisService } from './redis.service';

@Global()
@Module({
  providers: [RedisService, RedisCacheService],
  exports: [RedisService, RedisCacheService],
})
export class RedisModule {}
