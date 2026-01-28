import { Injectable } from '@nestjs/common';
import { BaseRepository } from '../../../database/base/base.repository';
import { DoshPointsTransactionModel } from '../../../database/models/doshPointsTransaction/doshPointsTransaction.model';

@Injectable()
export class DoshPointsTransactionRepository extends BaseRepository<DoshPointsTransactionModel> {
  constructor() {
    super(DoshPointsTransactionModel);
  }
}
