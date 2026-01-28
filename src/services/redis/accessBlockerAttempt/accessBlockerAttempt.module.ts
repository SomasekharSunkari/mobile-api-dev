import { Global, Module } from '@nestjs/common';
import { RedisModule } from '../redis.module';
import { AccessBlockerAttemptService } from './accessBlockerAttempt.service';

@Global()
@Module({
  imports: [RedisModule],
  providers: [AccessBlockerAttemptService],
  exports: [AccessBlockerAttemptService],
})
export class AccessBlockerAttemptModule {}
