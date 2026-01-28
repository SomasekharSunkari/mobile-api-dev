import { Injectable } from '@nestjs/common';
import { BaseRepository } from '../../../database/base/base.repository';
import { CardTransactionDisputeEventModel } from '../../../database/models/cardTransactionDisputeEvent/cardTransactionDisputeEvent.model';

@Injectable()
export class CardTransactionDisputeEventRepository extends BaseRepository<CardTransactionDisputeEventModel> {
  constructor() {
    super(CardTransactionDisputeEventModel);
  }
}
