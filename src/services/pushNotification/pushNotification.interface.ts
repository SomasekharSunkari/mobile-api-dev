import { Notification } from '@notifee/react-native';

export interface PushNotification {
  sendPushNotification(
    token: string | string[],
    notification: PushNotificationContent,
    config?: PushNotificationConfig,
  ): Promise<void>;
}

export interface PushNotificationContent {
  title: string;
  body: string;
}

export interface PushNotificationConfig extends Notification {
  id?: string;
}
