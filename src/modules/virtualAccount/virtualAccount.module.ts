import { forwardRef, Module } from '@nestjs/common';
import { WaasModule } from '../../adapters/waas/waas.adapter.module';
import { LockerModule } from '../../services/locker';
import { UserModule } from '../auth/user/user.module';
import { FiatWalletModule } from '../fiatWallet';
import { TransactionModule } from '../transaction/transaction.module';
import { VirtualAccountController } from './virtualAccount.controller';
import { VirtualAccountRepository } from './virtualAccount.repository';
import { VirtualAccountService } from './virtualAccount.service';

@Module({
  providers: [VirtualAccountRepository, VirtualAccountService],
  exports: [VirtualAccountService, VirtualAccountRepository],
  imports: [UserModule, WaasModule, TransactionModule, forwardRef(() => FiatWalletModule), LockerModule],
  controllers: [VirtualAccountController],
})
export class VirtualAccountModule {}
