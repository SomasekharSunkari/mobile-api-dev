import { Inject, Injectable } from '@nestjs/common';
import { PushNotificationService } from '../../../services/pushNotification/pushNotification.service';
import { CreatePushNotificationDto } from './dto/createPushNotification.dto';

@Injectable()
export class PushNotificationTestService {
  @Inject(PushNotificationService)
  private readonly pushNotificationAdapter: PushNotificationService;

  sendPushNotification(tokens: string[], data: CreatePushNotificationDto) {
    return this.pushNotificationAdapter.sendPushNotification(tokens, data);
  }
}
