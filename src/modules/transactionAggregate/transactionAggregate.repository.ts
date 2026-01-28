import { Injectable } from '@nestjs/common';
import { BaseRepository } from '../../database/base';
import { TransactionAggregateModel } from '../../database/models/transactionAggregate/transactionAggregate.model';

@Injectable()
export class TransactionAggregateRepository extends BaseRepository<TransactionAggregateModel> {
  constructor() {
    super(TransactionAggregateModel);
  }

  async findByDateAndProviderAndType(
    date: string,
    provider: string,
    transactionType: string,
  ): Promise<TransactionAggregateModel | undefined> {
    return (await this.query().findOne({
      date,
      provider,
      transaction_type: transactionType,
    })) as TransactionAggregateModel;
  }
}
