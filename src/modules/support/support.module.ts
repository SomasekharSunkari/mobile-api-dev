import { Module } from '@nestjs/common';
import { SupportController } from './support.controller';
import { SupportService } from './support.service';
import { SupportTicketRepository } from './support.repository';
import { MailerModule } from '../../services/queue/processors/mailer/mailer.module';
import { SupportAdapterModule } from '../../adapters/support/support.adapter.module';

@Module({
  imports: [MailerModule, SupportAdapterModule],
  controllers: [SupportController],
  providers: [SupportService, SupportTicketRepository],
  exports: [SupportService],
})
export class SupportModule {}
