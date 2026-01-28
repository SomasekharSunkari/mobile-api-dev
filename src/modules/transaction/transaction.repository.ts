import { Injectable } from '@nestjs/common';
import { BaseRepository, TransactionModel } from '../../database';

@Injectable()
export class TransactionRepository extends BaseRepository<TransactionModel> {
  constructor() {
    super(TransactionModel);
  }
}
