import { Global, Module } from '@nestjs/common';
import { QueueModule } from '../../queue.module';
import { SmsService } from './sms.service';

@Global()
@Module({
  imports: [QueueModule],
  providers: [SmsService],
  exports: [SmsService],
})
export class SmsModule {}
