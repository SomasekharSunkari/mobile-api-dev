import { Global, Module } from '@nestjs/common';
import { FirebaseModule } from './firebase/firebase.module';
import { PushNotificationService } from './pushNotification.service';

@Global()
@Module({
  imports: [FirebaseModule],
  providers: [PushNotificationService],
  exports: [PushNotificationService],
})
export class PushNotificationModule {}
