import { Module } from '@nestjs/common';
import { CardAdapter } from './card.adapter';
import { RainAdapter } from './rain/rain.adapter';
import { RainHelper } from './rain/rain.helper';
import { RainOccupationMapperService } from './rain/rain.occupation-mapper';

@Module({
  providers: [RainAdapter, CardAdapter, RainHelper, RainOccupationMapperService],
  exports: [CardAdapter],
})
export class CardAdapterModule {}
