import { Module } from '@nestjs/common';
import { RedisModule } from '../redis/redis.module';
import { QueueService } from './queue.service';
@Module({
  providers: [QueueService],
  imports: [RedisModule],
  exports: [QueueService],
})
export class QueueModule {}
