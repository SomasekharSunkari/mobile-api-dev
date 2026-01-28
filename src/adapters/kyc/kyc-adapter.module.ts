import { Module } from '@nestjs/common';
import { AdapterConfigProvider } from '../../config/adapter.config';
import { KYCAdapter } from './kyc-adapter';
import { SumsubAdapter } from './sumsub/sumsub.adapter';

@Module({
  providers: [KYCAdapter, AdapterConfigProvider, SumsubAdapter],
  exports: [KYCAdapter, AdapterConfigProvider, SumsubAdapter],
})
export class KYCAdapterModule {}
