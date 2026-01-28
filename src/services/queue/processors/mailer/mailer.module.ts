import { Global, Module } from '@nestjs/common';
import { QueueModule } from '../../queue.module';
import { MailerService } from './mailer.service';

@Global()
@Module({
  providers: [MailerService],
  exports: [MailerService],
  imports: [QueueModule],
})
export class MailerModule {}
