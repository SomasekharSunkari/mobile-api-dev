import { Module } from '@nestjs/common';
import { TransactionMonitoringAdapter } from './transaction-monitoring-adapter';
import { SumsubTransactionMonitoringAdapter } from './sumsub/sumsub-transaction-monitoring.adapter';

@Module({
  providers: [TransactionMonitoringAdapter, SumsubTransactionMonitoringAdapter],
  exports: [TransactionMonitoringAdapter],
})
export class TransactionMonitoringAdapterModule {}
