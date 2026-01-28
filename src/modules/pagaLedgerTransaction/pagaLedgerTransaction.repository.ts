import { Injectable } from '@nestjs/common';
import { BaseRepository } from '../../database/base/base.repository';
import { PagaLedgerTransactionModel } from '../../database/models/pagaLedgerTransaction/pagaLedgerTransaction.model';

@Injectable()
export class PagaLedgerTransactionRepository extends BaseRepository<PagaLedgerTransactionModel> {
  constructor() {
    super(PagaLedgerTransactionModel);
  }
}
