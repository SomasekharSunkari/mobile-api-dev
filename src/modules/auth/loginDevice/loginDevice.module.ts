import { Module } from '@nestjs/common';
import { LoginDeviceService } from './loginDevice.service';
import { LoginDeviceRepository } from './loginDevice.repository';
import { LoginEventRepository } from '../loginEvent/loginEvent.repository';
import { TransactionMonitoringAdapterModule } from '../../../adapters/transaction-monitoring/transaction-monitoring-adapter.module';

@Module({
  imports: [TransactionMonitoringAdapterModule],
  providers: [LoginDeviceService, LoginDeviceRepository, LoginEventRepository],
  exports: [LoginDeviceService, LoginDeviceRepository, LoginEventRepository],
})
export class LoginDeviceModule {}
