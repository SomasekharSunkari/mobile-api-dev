import { Module } from '@nestjs/common';
import { ZerohashAdapter } from './zerohash.adapter';

@Module({
  providers: [ZerohashAdapter],
  exports: [ZerohashAdapter],
})
export class ZerohashAdapterModule {}
