import { BaseModel } from '../../base';
import { DatabaseSchema } from '../../database.schema';
import { DatabaseTables } from '../../database.table';
import { CardTransactionModel } from '../cardTransaction/cardTransaction.model';
import { ICardTransactionDispute } from './cardTransactionDispute.interface';
import { CardTransactionDisputeValidationSchema } from './cardTransactionDispute.validation';

export class CardTransactionDisputeModel extends BaseModel implements ICardTransactionDispute {
  public transaction_id: ICardTransactionDispute['transaction_id'];
  public provider_dispute_ref: ICardTransactionDispute['provider_dispute_ref'];
  public transaction_ref: ICardTransactionDispute['transaction_ref'];
  public status: ICardTransactionDispute['status'];
  public text_evidence: ICardTransactionDispute['text_evidence'];
  public resolved_at: ICardTransactionDispute['resolved_at'];

  public cardTransaction?: ICardTransactionDispute['cardTransaction'];

  static get tableName() {
    return `${DatabaseSchema.apiService}.${DatabaseTables.card_transaction_disputes}`;
  }

  static publicProperty(properties: (keyof ICardTransactionDispute)[] = []): (keyof ICardTransactionDispute)[] {
    return [
      'id',
      'transaction_id',
      'provider_dispute_ref',
      'transaction_ref',
      'status',
      'text_evidence',
      'resolved_at',
      'created_at',
      'updated_at',
      ...properties,
    ];
  }

  static get jsonSchema() {
    return CardTransactionDisputeValidationSchema;
  }

  static get relationMappings() {
    return {
      cardTransaction: {
        relation: BaseModel.BelongsToOneRelation,
        modelClass: CardTransactionModel,
        join: {
          from: `${DatabaseSchema.apiService}.${DatabaseTables.card_transaction_disputes}.transaction_id`,
          to: `${DatabaseSchema.apiService}.${DatabaseTables.card_transactions}.id`,
        },
      },
    };
  }

  static get modifiers() {
    return {
      notDeleted(query) {
        query.whereNull('deleted_at');
      },
    };
  }
}
