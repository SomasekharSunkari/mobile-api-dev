export interface ISenderTransactionMetadata {
  recipient_user_id: string;
  recipient_username: string;
  recipient_first_name: string;
  recipient_last_name: string;
}

export interface IRecipientTransactionMetadata {
  sender_user_id: string;
  sender_username: string;
  sender_first_name: string;
  sender_last_name: string;
}

export interface ITransactionNotificationOptions {
  shouldSendInAppNotification?: boolean;
  shouldSendEmail?: boolean;
  shouldSendPushNotification?: boolean;
}
