import { SmsManager } from '../../services/queue/processors/sms/sms.interface';

export class VerifyAccountSms implements SmsManager {
  public readonly to: string;
  public readonly code: string;
  public readonly from: string;
  public readonly delay: number;

  constructor(phone: string, code: string) {
    this.to = phone;
    this.code = code;
  }

  public async prepare(): Promise<string> {
    return `Your verification code is ${this.code}`;
  }
}
