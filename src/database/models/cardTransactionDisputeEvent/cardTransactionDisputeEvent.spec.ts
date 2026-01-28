import { BaseModel } from '../../base';
import { DatabaseSchema } from '../../database.schema';
import { DatabaseTables } from '../../database.table';
import { CardTransactionDisputeModel } from '../cardTransactionDispute/cardTransactionDispute.model';
import { UserModel } from '../user/user.model';
import * as disputeEventExports from './index';
import { CardTransactionDisputeEventModel } from './cardTransactionDisputeEvent.model';
import { CardTransactionDisputeEventValidationSchema } from './cardTransactionDisputeEvent.validation';
import { CardTransactionDisputeEventRepository } from '../../../modules/card/repository/cardTransactionDisputeEvent.repository';

describe('CardTransactionDisputeEvent exports', () => {
  it('should export model, schema, and enums', () => {
    expect(disputeEventExports.CardTransactionDisputeEventModel).toBe(CardTransactionDisputeEventModel);
    expect(disputeEventExports.CardTransactionDisputeEventValidationSchema).toBe(
      CardTransactionDisputeEventValidationSchema,
    );
    expect(disputeEventExports.CardTransactionDisputeEventType).toBeDefined();
    expect(disputeEventExports.CardTransactionDisputeTriggeredBy).toBeDefined();
  });
});

describe('CardTransactionDisputeEventModel', () => {
  it('should use the correct table name', () => {
    expect(CardTransactionDisputeEventModel.tableName).toBe(
      `${DatabaseSchema.apiService}.${DatabaseTables.card_transaction_dispute_events}`,
    );
  });

  it('should include default and custom public properties', () => {
    const baseProps = CardTransactionDisputeEventModel.publicProperty();
    expect(baseProps).toEqual(
      expect.arrayContaining([
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
      ]),
    );

    const extendedProps = CardTransactionDisputeEventModel.publicProperty(['custom_field' as any]);
    expect(extendedProps).toContain('custom_field');
  });

  it('should expose the validation schema', () => {
    expect(CardTransactionDisputeEventModel.jsonSchema).toBe(CardTransactionDisputeEventValidationSchema);
  });

  it('should define relation mappings', () => {
    const mappings = CardTransactionDisputeEventModel.relationMappings;

    expect(mappings.dispute.relation).toBe(BaseModel.BelongsToOneRelation);
    expect(mappings.dispute.modelClass).toBe(CardTransactionDisputeModel);
    expect(mappings.dispute.join.from).toBe(
      `${DatabaseSchema.apiService}.${DatabaseTables.card_transaction_dispute_events}.dispute_id`,
    );
    expect(mappings.dispute.join.to).toBe(
      `${DatabaseSchema.apiService}.${DatabaseTables.card_transaction_disputes}.id`,
    );

    expect(mappings.user.relation).toBe(BaseModel.BelongsToOneRelation);
    expect(mappings.user.modelClass).toBe(UserModel);
    expect(mappings.user.join.from).toBe(
      `${DatabaseSchema.apiService}.${DatabaseTables.card_transaction_dispute_events}.user_id`,
    );
    expect(mappings.user.join.to).toBe(`${DatabaseSchema.apiService}.${DatabaseTables.users}.id`);
  });

  it('should apply the notDeleted modifier', () => {
    const query = { whereNull: jest.fn() };
    CardTransactionDisputeEventModel.modifiers.notDeleted(query as any);
    expect(query.whereNull).toHaveBeenCalledWith('deleted_at');
  });
});

describe('CardTransactionDisputeEventRepository', () => {
  it('should wire the model and schema table name', () => {
    const repository = new CardTransactionDisputeEventRepository();
    expect(repository.model).toBe(CardTransactionDisputeEventModel);
    expect((repository as any).tableName).toBe(DatabaseSchema.apiService);
  });
});
