import { forwardRef, Module } from '@nestjs/common';
import { PagaLedgerAccountModule } from '../../modules/pagaLedgerAccount/pagaLedgerAccount.module';
import { PagaLedgerTransactionModule } from '../../modules/pagaLedgerTransaction/pagaLedgerTransaction.module';
import { PagaAdapter } from './paga/paga.adapter';
import { WaasAdapter } from './waas.adapter';

@Module({
  providers: [WaasAdapter, PagaAdapter],
  exports: [WaasAdapter, PagaAdapter],
  imports: [forwardRef(() => PagaLedgerAccountModule), PagaLedgerTransactionModule],
})
export class WaasModule {}
