import { Module } from '@nestjs/common';
import { ExternalAccountAdapter } from './external-account.adapter';
import { PlaidExternalAccountAdapter } from './plaid/plaid.adapter';
import { ZerohashExternalAccountAdapter } from './zerohash/zerohash.adapter';

@Module({
  providers: [ExternalAccountAdapter, PlaidExternalAccountAdapter, ZerohashExternalAccountAdapter],
  exports: [ExternalAccountAdapter, PlaidExternalAccountAdapter, ZerohashExternalAccountAdapter],
})
export class ExternalAccountAdapterModule {}
