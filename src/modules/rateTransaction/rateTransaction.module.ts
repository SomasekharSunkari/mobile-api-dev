import { Module } from '@nestjs/common';
import { ExchangeAdapterModule } from '../../adapters/exchange/exchange.adapter.module';
import { LockerModule } from '../../services/locker';
import { RateTransactionRepository } from './rateTransaction.repository';
import { RateTransactionService } from './rateTransaction.service';

@Module({
  controllers: [],
  providers: [RateTransactionService, RateTransactionRepository],
  exports: [RateTransactionService, RateTransactionRepository],
  imports: [LockerModule, ExchangeAdapterModule],
})
export class RateTransactionModule {}
