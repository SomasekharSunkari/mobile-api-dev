import { Module } from '@nestjs/common';
import { LinkBankAccountAdapter } from './link-bank-account.adapter';
import { ZerohashAdapter } from './zerohash/zerohash.adapter';
import { PlaidAdapter } from './plaid/plaid.adapter';

@Module({
  providers: [LinkBankAccountAdapter, ZerohashAdapter, PlaidAdapter],
  exports: [LinkBankAccountAdapter],
})
export class LinkBankAccountAdapterModule {}
