import { Injectable } from '@nestjs/common';
import { BaseRepository } from '../../database';
import { RateTransactionModel } from '../../database/models/rateTransaction';

@Injectable()
export class RateTransactionRepository extends BaseRepository<RateTransactionModel> {
  constructor() {
    super(RateTransactionModel);
  }
}
