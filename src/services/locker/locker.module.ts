import { Global, Module } from '@nestjs/common';
import { RedisModule } from '../redis/redis.module';
import { LockerService } from './locker.service';

@Global()
@Module({
  imports: [RedisModule],
  providers: [LockerService],
  exports: [LockerService],
})
export class LockerModule {}
