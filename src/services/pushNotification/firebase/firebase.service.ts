import { Inject, Injectable, Logger } from '@nestjs/common';
import { Notification } from '@notifee/react-native';
import admin from 'firebase-admin';
import { App } from 'firebase-admin/app';
import { EnvironmentService } from '../../../config';
import { PlatformServiceKey } from '../../../database/models/platformStatus/platformStatus.interface';
import { EventEmitterEventsEnum } from '../../eventEmitter/eventEmitter.interface';
import { EventEmitterService } from '../../eventEmitter/eventEmitter.service';
import { PushNotification } from '../pushNotification.interface';

@Injectable()
export class FirebaseService implements PushNotification {
  public app: App;
  private readonly logger = new Logger(FirebaseService.name);

  @Inject(EventEmitterService)
  private readonly eventEmitterService: EventEmitterService;

  public constructor() {
    const firebaseSecretConfig = EnvironmentService.getValue('FIREBASE_SECRET_JSON');

    if (!firebaseSecretConfig) {
      this.logger.error('Firebase secret config is not set', 'FirebaseService');
      return;
    }

    const firebaseSecretJson = JSON.parse(firebaseSecretConfig);

    this.app = admin.initializeApp({
      credential: admin.credential.cert(firebaseSecretJson),
    });
  }

  public async sendPushNotification(tokens: string[], notification: Notification): Promise<any> {
    try {
      this.logger.log('Sending push notification using adapter', 'FirebaseAdapter.sendPushNotification');

      const notificationsResponse = await admin.messaging().sendEachForMulticast({
        tokens,
        data: {
          notification: JSON.stringify(notification),
        },
        notification: {
          title: notification.title,
          body: notification.body,
        },
        android: {
          notification: {
            channelId: Date.now().toString(30),
            visibility: 'public',
            priority: 'high',
            defaultSound: true,
          },
        },
      });

      const failedResponses = notificationsResponse.responses.filter((response) => !response.success);

      if (failedResponses.length === 0 || failedResponses.length < tokens.length) {
        this.eventEmitterService.emit(EventEmitterEventsEnum.SERVICE_STATUS_SUCCESS, {
          serviceKey: PlatformServiceKey.PUSH_NOTIFICATION,
        });
      }

      if (failedResponses.length === tokens.length) {
        this.eventEmitterService.emit(EventEmitterEventsEnum.SERVICE_STATUS_FAILURE, {
          serviceKey: PlatformServiceKey.PUSH_NOTIFICATION,
          reason: 'All push notifications failed to send',
        });
      }

      return failedResponses;
    } catch (e) {
      this.logger.error(e.message, 'FirebaseAdapter.sendPushNotification');

      this.eventEmitterService.emit(EventEmitterEventsEnum.SERVICE_STATUS_FAILURE, {
        serviceKey: PlatformServiceKey.PUSH_NOTIFICATION,
        reason: e.message,
      });
    }
  }
}
