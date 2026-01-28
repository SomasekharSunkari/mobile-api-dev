import { BaseModel } from '../../base';
import { DatabaseSchema } from '../../database.schema';
import { DatabaseTables } from '../../database.table';
import { ITransactionAggregate } from './transactionAggregate.interface';
import { TransactionAggregateValidationSchema } from './transactionAggregate.validation';

export class TransactionAggregateModel extends BaseModel implements ITransactionAggregate {
  public date: ITransactionAggregate['date'];
  public transaction_type: ITransactionAggregate['transaction_type'];
  public provider: ITransactionAggregate['provider'];
  public amount: ITransactionAggregate['amount'];

  static get tableName() {
    return `${DatabaseSchema.apiService}.${DatabaseTables.transaction_aggregates}`;
  }

  static publicProperty(properties: (keyof ITransactionAggregate)[] = []): (keyof ITransactionAggregate)[] {
    return ['id', 'date', 'transaction_type', 'provider', 'amount', 'created_at', 'updated_at', ...properties];
  }

  static get jsonSchema() {
    return TransactionAggregateValidationSchema;
  }
}
