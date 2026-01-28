import { Module, forwardRef } from '@nestjs/common';
import { TransactionMonitoringAdapterModule } from '../../adapters/transaction-monitoring/transaction-monitoring-adapter.module';
import { TransactionMonitoringService } from './transaction-monitoring.service';
import { UserModule } from '../auth/user/user.module';
import { UserProfileModule } from '../auth/userProfile/userProfile.module';
import { LoginEventModule } from '../auth/loginEvent/loginEvent.module';
import { LoginDeviceModule } from '../auth/loginDevice/loginDevice.module';
import { FiatWalletTransactionModule } from '../fiatWalletTransactions/fiatWalletTransactions.module';
import { FiatWalletModule } from '../fiatWallet/fiatWallet.module';
import { TransactionModule } from '../transaction/transaction.module';
import { ExternalAccountRepository } from '../externalAccount/external-account.repository';

@Module({
  imports: [
    TransactionMonitoringAdapterModule,
    UserModule,
    UserProfileModule,
    LoginEventModule,
    LoginDeviceModule,
    forwardRef(() => FiatWalletTransactionModule),
    forwardRef(() => FiatWalletModule),
    forwardRef(() => TransactionModule),
  ],
  controllers: [],
  providers: [TransactionMonitoringService, ExternalAccountRepository],
  exports: [TransactionMonitoringService],
})
export class TransactionMonitoringModule {}
