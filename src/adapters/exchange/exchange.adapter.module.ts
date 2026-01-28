import { Module } from '@nestjs/common';
import { ExchangeAdapter } from './exchange.adapter';
import { YellowCardAdapter } from './yellowcard/yellowcard.adapter';

@Module({
  providers: [ExchangeAdapter, YellowCardAdapter],
  exports: [ExchangeAdapter],
})
export class ExchangeAdapterModule {}
