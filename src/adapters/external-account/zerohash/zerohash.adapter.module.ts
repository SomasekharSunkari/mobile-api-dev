import { Module } from '@nestjs/common';
import { ZerohashExternalAccountAdapter } from './zerohash.adapter';

@Module({
  providers: [ZerohashExternalAccountAdapter],
  exports: [ZerohashExternalAccountAdapter],
})
export class ZerohashExternalAccountAdapterModule {}
