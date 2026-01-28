import { Module } from '@nestjs/common';
import { PlaidExternalAccountAdapter } from './plaid.adapter';
import { RedisService } from '../../../services/redis/redis.service';

@Module({
  providers: [PlaidExternalAccountAdapter, RedisService],
  exports: [PlaidExternalAccountAdapter],
})
export class PlaidExternalAccountAdapterModule {}
