import { Module } from '@nestjs/common';
import { NgnAccountRetryModule as NgnAccountRetryQueueModule } from '../../services/queue/processors/ngn-account-retry/ngn-account-retry.module';
import { NgnAccountRetryController } from './ngnAccountRetry.controller';
import { NgnAccountRetryService } from './ngnAccountRetry.service';

@Module({
  imports: [NgnAccountRetryQueueModule],
  controllers: [NgnAccountRetryController],
  providers: [NgnAccountRetryService],
  exports: [NgnAccountRetryService],
})
export class NgnAccountRetryModule {}
