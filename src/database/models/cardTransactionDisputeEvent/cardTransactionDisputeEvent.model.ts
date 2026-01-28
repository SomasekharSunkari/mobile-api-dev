import { BaseModel } from '../../base';
import { DatabaseSchema } from '../../database.schema';
import { DatabaseTables } from '../../database.table';
import { CardTransactionDisputeModel } from '../cardTransactionDispute/cardTransactionDispute.model';
import { UserModel } from '../user';
import { ICardTransactionDisputeEvent } from './cardTransactionDisputeEvent.interface';
import { CardTransactionDisputeEventValidationSchema } from './cardTransactionDisputeEvent.validation';

export class CardTransactionDisputeEventModel extends BaseModel implements ICardTransactionDisputeEvent {
  public dispute_id: ICardTransactionDisputeEvent['dispute_id'];
  public previous_status?: ICardTransactionDisputeEvent['previous_status'];
  public new_status: ICardTransactionDisputeEvent['new_status'];
  public event_type: ICardTransactionDisputeEvent['event_type'];
  public triggered_by: ICardTransactionDisputeEvent['triggered_by'];
  public user_id?: ICardTransactionDisputeEvent['user_id'];
  public reason?: ICardTransactionDisputeEvent['reason'];

  public dispute?: ICardTransactionDisputeEvent['dispute'];
  public user?: ICardTransactionDisputeEvent['user'];

  static get tableName() {
    return `${DatabaseSchema.apiService}.${DatabaseTables.card_transaction_dispute_events}`;
  }

  static publicProperty(
    properties: (keyof ICardTransactionDisputeEvent)[] = [],
  ): (keyof ICardTransactionDisputeEvent)[] {
    return [
      'id',
      'dispute_id',
      'previous_status',
      'new_status',
      'event_type',
      'triggered_by',
      'user_id',
      'reason',
      'created_at',
      'updated_at',
      'deleted_at',
      ...properties,
    ];
  }

  static get jsonSchema() {
    return CardTransactionDisputeEventValidationSchema;
  }

  static get relationMappings() {
    return {
      dispute: {
        relation: BaseModel.BelongsToOneRelation,
        modelClass: CardTransactionDisputeModel,
        join: {
          from: `${DatabaseSchema.apiService}.${DatabaseTables.card_transaction_dispute_events}.dispute_id`,
          to: `${DatabaseSchema.apiService}.${DatabaseTables.card_transaction_disputes}.id`,
        },
      },
      user: {
        relation: BaseModel.BelongsToOneRelation,
        modelClass: UserModel,
        join: {
          from: `${DatabaseSchema.apiService}.${DatabaseTables.card_transaction_dispute_events}.user_id`,
          to: `${DatabaseSchema.apiService}.${DatabaseTables.users}.id`,
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
