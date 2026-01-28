import { Module } from '@nestjs/common';
import { ParticipantAdapter } from './participant.adapter';
import { ZerohashParticipantAdapter } from './zerohash/zerohash.adapter';

@Module({
  providers: [ParticipantAdapter, ZerohashParticipantAdapter],
  exports: [ParticipantAdapter, ZerohashParticipantAdapter],
})
export class ParticipantAdapterModule {}
