import { Module } from '@nestjs/common';
import { PagaLedgerTransactionRepository } from './pagaLedgerTransaction.repository';
import { PagaLedgerTransactionService } from './pagaLedgerTransaction.service';

@Module({
  providers: [PagaLedgerTransactionService, PagaLedgerTransactionRepository],
  exports: [PagaLedgerTransactionService, PagaLedgerTransactionRepository],
})
export class PagaLedgerTransactionModule {}
