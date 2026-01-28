import { Module } from '@nestjs/common';
import { PlaidAdapter } from './plaid.adapter';

@Module({
  providers: [PlaidAdapter],
  exports: [PlaidAdapter],
})
export class PlaidAdapterModule {}
