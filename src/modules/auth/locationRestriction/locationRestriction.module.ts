import { Module } from '@nestjs/common';
import { TransactionMonitoringAdapterModule } from '../../../adapters/transaction-monitoring/transaction-monitoring-adapter.module';
import { LocationRestrictionService } from './locationRestriction.service';

@Module({
  imports: [TransactionMonitoringAdapterModule],
  providers: [LocationRestrictionService],
  exports: [LocationRestrictionService],
})
export class LocationRestrictionModule {}
