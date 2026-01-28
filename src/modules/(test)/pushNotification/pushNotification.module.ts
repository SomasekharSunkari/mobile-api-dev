import { Module } from '@nestjs/common';
import { PushNotificationController } from './pushNotification.controller';
import { PushNotificationTestService } from './pushNotification.service';

@Module({
  controllers: [PushNotificationController],
  providers: [PushNotificationTestService],
  exports: [PushNotificationTestService],
})
export class PushNotificationTestModule {}
