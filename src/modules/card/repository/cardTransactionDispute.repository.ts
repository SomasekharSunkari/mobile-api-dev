import { Injectable } from '@nestjs/common';
import { BaseRepository } from '../../../database/base/base.repository';
import { CardTransactionDisputeModel } from '../../../database/models/cardTransactionDispute/cardTransactionDispute.model';

@Injectable()
export class CardTransactionDisputeRepository extends BaseRepository<CardTransactionDisputeModel> {
  constructor() {
    super(CardTransactionDisputeModel);
  }
}
