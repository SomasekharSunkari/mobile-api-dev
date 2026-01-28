import { Module } from '@nestjs/common';
import { SupportAdapter } from './support.adapter';
import { ZendeskAdapter } from './zendesk/zendesk.adapter';

@Module({
  providers: [ZendeskAdapter, SupportAdapter],
  exports: [SupportAdapter],
})
export class SupportAdapterModule {}
