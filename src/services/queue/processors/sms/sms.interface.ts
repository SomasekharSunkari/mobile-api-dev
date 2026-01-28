export interface SmsManager {
  to: string | string[];
  from?: string;
  delay?: number;

  /**
   * Prepare the sms data, must return a promise that resolves to a record of data
   */
  prepare(): Promise<string>;
}

export interface SendSmsResponse {
  id: string;
  to: string[];
  from: string;
  canceled: boolean;
  body: string;
  type: string;
  created_at: Date;
  modified_at: Date;
  delivery_report: string;
  expire_at: Date;
  flash_message: boolean;
}

export interface SendSmsData {
  to: string | string[];
  body: string;
  from?: string;
  scheduledTime?: Date;
}
