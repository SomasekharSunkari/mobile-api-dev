import { forwardRef, Module } from '@nestjs/common';
import { WaasModule } from '../../adapters/waas/waas.adapter.module';
import { LockerService } from '../../services/locker';
import { PagaLedgerTransactionModule } from '../pagaLedgerTransaction/pagaLedgerTransaction.module';
import { PagaLedgerAccountController } from './pagaLedgerAccount.controller';
import { PagaLedgerAccountRepository } from './pagaLedgerAccount.repository';
import { PagaLedgerAccountService } from './pagaLedgerAccount.service';

@Module({
  imports: [PagaLedgerTransactionModule, forwardRef(() => WaasModule)],
  providers: [PagaLedgerAccountService, PagaLedgerAccountRepository, LockerService],
  exports: [PagaLedgerAccountService, PagaLedgerAccountRepository],
  controllers: [PagaLedgerAccountController],
})
export class PagaLedgerAccountModule {}
