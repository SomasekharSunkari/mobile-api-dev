import { Injectable } from '@nestjs/common';
import { EmailProcessor } from '../email.processor';
import { MailerManager } from './mailer.interface';
@Injectable()
export class MailerService extends EmailProcessor {
  public async send(senderClass: MailerManager, delay?: number) {
    const data = await senderClass.prepare();
    if (!data) return;
    await this.sendTemplatedEmail(senderClass.to, senderClass.subject, senderClass.view, data, delay);
  }
}
