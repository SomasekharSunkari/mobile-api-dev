import { Module } from '@nestjs/common';
import { FiatWalletAdapter } from './fiat-wallet.adapter';
import { ZerohashFiatWalletAdapter } from './zerohash/zerohash.adapter';

@Module({
  providers: [FiatWalletAdapter, ZerohashFiatWalletAdapter],
  exports: [FiatWalletAdapter],
})
export class FiatWalletAdapterModule {}
