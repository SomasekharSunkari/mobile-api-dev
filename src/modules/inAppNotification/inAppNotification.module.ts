import { Module, forwardRef } from '@nestjs/common';
import { StreamModule } from '../../services/streams';
import { NotificationsController } from './inAppNotification.controller';
import { InAppNotificationRepository } from './inAppNotification.repository';
import { InAppNotificationService } from './inAppNotification.service';

@Module({
  imports: [forwardRef(() => StreamModule)],
  providers: [InAppNotificationRepository, InAppNotificationService],
  controllers: [NotificationsController],
  exports: [InAppNotificationService, InAppNotificationRepository],
})
export class InAppNotificationModule {}
