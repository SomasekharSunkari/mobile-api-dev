import { Module } from '@nestjs/common';
import { LockerModule } from '../../services/locker/locker.module';
import { ProviderLimitModule } from '../providerLimit/providerLimit.module';
import { TransactionAggregateRepository } from './transactionAggregate.repository';
import { TransactionAggregateService } from './transactionAggregate.service';

@Module({
  imports: [LockerModule, ProviderLimitModule],
  providers: [TransactionAggregateRepository, TransactionAggregateService],
  exports: [TransactionAggregateService, TransactionAggregateRepository],
})
export class TransactionAggregateModule {}
