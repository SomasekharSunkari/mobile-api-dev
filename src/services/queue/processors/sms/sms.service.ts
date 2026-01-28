import { Injectable } from '@nestjs/common';
import { SmsProcessor } from '../sms.processor';
import { SmsManager } from './sms.interface';

@Injectable()
export class SmsService extends SmsProcessor {
  public async send(senderClass: SmsManager) {
    const body = await senderClass.prepare();
    await this.sendSms(senderClass.to, body, senderClass.from, senderClass.delay);
  }
}
