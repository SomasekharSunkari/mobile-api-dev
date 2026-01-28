import { Module } from '@nestjs/common';
import { ExchangeAdapterModule } from '../../adapters/exchange/exchange.adapter.module';
import { RateConfigModule } from '../rateConfig/rateConfig.module';
import { RateController } from './rate.controller';
import { RateRepository } from './rate.repository';
import { RateService } from './rate.service';

@Module({
  controllers: [RateController],
  providers: [RateService, RateRepository],
  exports: [RateService, RateRepository],
  imports: [ExchangeAdapterModule, RateConfigModule],
})
export class RateModule {}
