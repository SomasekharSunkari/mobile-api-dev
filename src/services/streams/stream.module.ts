import { Module, forwardRef } from '@nestjs/common';
import { EventEmitterModule } from '../eventEmitter/eventEmitter.module';
import { RedisModule } from '../redis/redis.module';
import { StreamService } from './stream.service';
import { InAppNotificationModule } from '../../modules/inAppNotification/inAppNotification.module';

@Module({
  imports: [EventEmitterModule, RedisModule, forwardRef(() => InAppNotificationModule)],
  providers: [StreamService],
  exports: [StreamService],
})
export class StreamModule {}
