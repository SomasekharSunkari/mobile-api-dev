import { BaseModel } from '../../base';
import { DatabaseSchema } from '../../database.schema';
import { DatabaseTables } from '../../database.table';
import { CardTransactionModel } from '../cardTransaction/cardTransaction.model';
import { CardTransactionDisputeStatus } from './cardTransactionDispute.interface';
import { CardTransactionDisputeModel } from './cardTransactionDispute.model';
import { CardTransactionDisputeValidationSchema } from './cardTransactionDispute.validation';

jest.mock('../../base');

describe('CardTransactionDisputeModel', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('tableName', () => {
    it('returns the correct table name', () => {
      expect(CardTransactionDisputeModel.tableName).toBe(
        `${DatabaseSchema.apiService}.${DatabaseTables.card_transaction_disputes}`,
      );
    });
  });

  describe('jsonSchema', () => {
    it('returns the validation schema', () => {
      expect(CardTransactionDisputeModel.jsonSchema).toBe(CardTransactionDisputeValidationSchema);
    });
  });

  describe('publicProperty', () => {
    it('includes default properties', () => {
      const props = CardTransactionDisputeModel.publicProperty();

      expect(props).toEqual(
        expect.arrayContaining([
          'id',
          'transaction_id',
          'provider_dispute_ref',
          'transaction_ref',
          'status',
          'text_evidence',
          'resolved_at',
          'created_at',
          'updated_at',
        ]),
      );
    });

    it('includes additional properties when provided', () => {
      const props = CardTransactionDisputeModel.publicProperty(['extra'] as any);
      expect(props).toContain('extra');
    });
  });

  describe('relationMappings', () => {
    beforeEach(() => {
      BaseModel.BelongsToOneRelation = 'BelongsToOneRelation' as any;
    });

    it('defines cardTransaction relation', () => {
      const relations = CardTransactionDisputeModel.relationMappings as any;

      expect(relations.cardTransaction).toBeDefined();
      expect(relations.cardTransaction.relation).toBe('BelongsToOneRelation');
      expect(relations.cardTransaction.modelClass).toBe(CardTransactionModel);
      expect(relations.cardTransaction.join).toEqual({
        from: `${DatabaseSchema.apiService}.${DatabaseTables.card_transaction_disputes}.transaction_id`,
        to: `${DatabaseSchema.apiService}.${DatabaseTables.card_transactions}.id`,
      });
    });
  });

  describe('modifiers', () => {
    it('applies notDeleted modifier', () => {
      const whereNull = jest.fn();
      const query = { whereNull } as any;

      CardTransactionDisputeModel.modifiers.notDeleted(query);

      expect(whereNull).toHaveBeenCalledWith('deleted_at');
    });
  });

  describe('instance properties', () => {
    it('stores values on the model instance', () => {
      const model = new CardTransactionDisputeModel();
      model.transaction_id = 'txn-1';
      model.provider_dispute_ref = 'prov-1';
      model.transaction_ref = 'txn-ref-1';
      model.status = CardTransactionDisputeStatus.PENDING;
      model.text_evidence = 'Reason';

      expect(model.transaction_id).toBe('txn-1');
      expect(model.provider_dispute_ref).toBe('prov-1');
      expect(model.transaction_ref).toBe('txn-ref-1');
      expect(model.status).toBe(CardTransactionDisputeStatus.PENDING);
      expect(model.text_evidence).toBe('Reason');
    });
  });
});
