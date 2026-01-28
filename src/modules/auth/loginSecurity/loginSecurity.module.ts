import { Module } from '@nestjs/common';
import { RedisModule } from '../../../services/redis/redis.module';
import { LoginSecurityService } from './loginSecurity.service';
import { LoginDeviceModule } from '../loginDevice/loginDevice.module';
import { TransactionMonitoringAdapterModule } from '../../../adapters/transaction-monitoring/transaction-monitoring-adapter.module';
import { LoginEventModule } from '../loginEvent/loginEvent.module';
import { IpCountryBanModule } from '../ipCountryBan/ipCountryBan.module';
import { UserModule } from '../user/user.module';
import { LoginSecurityConfigProvider } from '../../../config/login-security.config';

@Module({
  imports: [
    RedisModule,
    LoginDeviceModule,
    TransactionMonitoringAdapterModule,
    LoginEventModule,
    IpCountryBanModule,
    UserModule,
  ],
  providers: [LoginSecurityService, LoginSecurityConfigProvider],
  exports: [LoginSecurityService],
})
export class LoginSecurityModule {}
