import { BaseModel } from '../../base';
import { DatabaseSchema } from '../../database.schema';
import { DatabaseTables } from '../../database.table';
import { DoshPointsAccountModel } from '../doshPointsAccount/doshPointsAccount.model';
import { DoshPointsEventModel } from '../doshPointsEvent/doshPointsEvent.model';
import { DoshPointsTransactionType } from '../doshPointsEvent/doshPointsEvent.interface';
import { UserModel } from '../user/user.model';
import { DoshPointsTransactionStatus } from './doshPointsTransaction.interface';
import { DoshPointsTransactionModel } from './doshPointsTransaction.model';
import { DoshPointsTransactionValidationSchema } from './doshPointsTransaction.validation';

describe('DoshPointsTransactionModel', () => {
  describe('tableName', () => {
    it('should return correct table name with schema', () => {
      expect(DoshPointsTransactionModel.tableName).toBe(
        `${DatabaseSchema.apiService}.${DatabaseTables.dosh_points_transactions}`,
      );
    });
  });

  describe('publicProperty', () => {
    it('should return default public properties when no argument provided', () => {
      const result = DoshPointsTransactionModel.publicProperty();
      expect(result).toEqual([
        'id',
        'dosh_points_account_id',
        'user_id',
        'event_code',
        'transaction_type',
        'amount',
        'balance_before',
        'balance_after',
        'source_reference',
        'description',
        'status',
        'processed_at',
        'created_at',
        'updated_at',
      ]);
    });

    it('should merge additional properties with default public properties', () => {
      const additionalProps = ['metadata', 'idempotency_key'];
      const result = DoshPointsTransactionModel.publicProperty(additionalProps as any);
      expect(result).toContain('id');
      expect(result).toContain('amount');
      expect(result).toContain('metadata');
      expect(result).toContain('idempotency_key');
    });

    it('should handle empty array of additional properties', () => {
      const result = DoshPointsTransactionModel.publicProperty([]);
      expect(result.length).toBe(14);
    });
  });

  describe('jsonSchema', () => {
    it('should return DoshPointsTransactionValidationSchema', () => {
      expect(DoshPointsTransactionModel.jsonSchema).toBe(DoshPointsTransactionValidationSchema);
    });
  });

  describe('relationMappings', () => {
    const relations = DoshPointsTransactionModel.relationMappings;

    it('should define doshPointsAccount as BelongsToOneRelation', () => {
      expect(relations.doshPointsAccount).toBeDefined();
      expect(relations.doshPointsAccount.relation).toBe(BaseModel.BelongsToOneRelation);
      expect(relations.doshPointsAccount.modelClass).toBe(DoshPointsAccountModel);
      expect(relations.doshPointsAccount.join.from).toBe(
        `${DatabaseSchema.apiService}.${DatabaseTables.dosh_points_transactions}.dosh_points_account_id`,
      );
      expect(relations.doshPointsAccount.join.to).toBe(
        `${DatabaseSchema.apiService}.${DatabaseTables.dosh_points_accounts}.id`,
      );
    });

    it('should define user as BelongsToOneRelation', () => {
      expect(relations.user).toBeDefined();
      expect(relations.user.relation).toBe(BaseModel.BelongsToOneRelation);
      expect(relations.user.modelClass).toBe(UserModel);
      expect(relations.user.join.from).toBe(
        `${DatabaseSchema.apiService}.${DatabaseTables.dosh_points_transactions}.user_id`,
      );
      expect(relations.user.join.to).toBe(`${DatabaseSchema.apiService}.${DatabaseTables.users}.id`);
    });

    it('should define event as BelongsToOneRelation', () => {
      expect(relations.event).toBeDefined();
      expect(relations.event.relation).toBe(BaseModel.BelongsToOneRelation);
      expect(relations.event.modelClass).toBe(DoshPointsEventModel);
      expect(relations.event.join.from).toBe(
        `${DatabaseSchema.apiService}.${DatabaseTables.dosh_points_transactions}.event_code`,
      );
      expect(relations.event.join.to).toBe(`${DatabaseSchema.apiService}.${DatabaseTables.dosh_points_events}.code`);
    });
  });

  describe('modifiers', () => {
    it('should define notDeleted modifier', () => {
      const modifiers = DoshPointsTransactionModel.modifiers;
      expect(modifiers.notDeleted).toBeDefined();
      expect(typeof modifiers.notDeleted).toBe('function');
    });

    it('should apply whereNull on deleted_at column in notDeleted modifier', () => {
      const mockQuery = { whereNull: jest.fn() };
      const modifiers = DoshPointsTransactionModel.modifiers;
      modifiers.notDeleted(mockQuery);
      expect(mockQuery.whereNull).toHaveBeenCalledWith('deleted_at');
    });

    it('should define completed modifier', () => {
      const modifiers = DoshPointsTransactionModel.modifiers;
      expect(modifiers.completed).toBeDefined();
      expect(typeof modifiers.completed).toBe('function');
    });

    it('should apply where status is completed in completed modifier', () => {
      const mockQuery = { where: jest.fn() };
      const modifiers = DoshPointsTransactionModel.modifiers;
      modifiers.completed(mockQuery);
      expect(mockQuery.where).toHaveBeenCalledWith('status', DoshPointsTransactionStatus.COMPLETED);
    });

    it('should define pending modifier', () => {
      const modifiers = DoshPointsTransactionModel.modifiers;
      expect(modifiers.pending).toBeDefined();
      expect(typeof modifiers.pending).toBe('function');
    });

    it('should apply where status is pending in pending modifier', () => {
      const mockQuery = { where: jest.fn() };
      const modifiers = DoshPointsTransactionModel.modifiers;
      modifiers.pending(mockQuery);
      expect(mockQuery.where).toHaveBeenCalledWith('status', DoshPointsTransactionStatus.PENDING);
    });
  });

  describe('model instantiation', () => {
    it('should create instance with all properties', () => {
      const transaction = new DoshPointsTransactionModel();
      transaction.dosh_points_account_id = 'account-123';
      transaction.user_id = 'user-123';
      transaction.event_code = 'ONBOARDING_BONUS';
      transaction.transaction_type = DoshPointsTransactionType.CREDIT;
      transaction.amount = 10;
      transaction.balance_before = 0;
      transaction.balance_after = 10;
      transaction.source_reference = 'tier-456';
      transaction.description = 'Onboarding Bonus';
      transaction.status = DoshPointsTransactionStatus.COMPLETED;
      transaction.idempotency_key = 'user-123_ONBOARDING_BONUS_tier-456';

      expect(transaction.dosh_points_account_id).toBe('account-123');
      expect(transaction.user_id).toBe('user-123');
      expect(transaction.event_code).toBe('ONBOARDING_BONUS');
      expect(transaction.transaction_type).toBe('credit');
      expect(transaction.amount).toBe(10);
      expect(transaction.balance_before).toBe(0);
      expect(transaction.balance_after).toBe(10);
      expect(transaction.source_reference).toBe('tier-456');
      expect(transaction.status).toBe('completed');
      expect(transaction.idempotency_key).toBe('user-123_ONBOARDING_BONUS_tier-456');
    });
  });
});

describe('DoshPointsTransactionValidationSchema', () => {
  describe('schema structure', () => {
    it('should have correct type and title', () => {
      expect(DoshPointsTransactionValidationSchema.type).toBe('object');
      expect(DoshPointsTransactionValidationSchema.title).toBe('Dosh Points Transaction Validation Schema');
    });

    it('should require essential fields', () => {
      const required = DoshPointsTransactionValidationSchema.required;
      expect(required).toContain('dosh_points_account_id');
      expect(required).toContain('user_id');
      expect(required).toContain('event_code');
      expect(required).toContain('transaction_type');
      expect(required).toContain('amount');
      expect(required).toContain('balance_before');
      expect(required).toContain('balance_after');
      expect(required).toContain('status');
    });
  });

  describe('properties', () => {
    const props = DoshPointsTransactionValidationSchema.properties;

    it('should define dosh_points_account_id as string', () => {
      expect(props.dosh_points_account_id).toEqual({ type: 'string' });
    });

    it('should define user_id as string', () => {
      expect(props.user_id).toEqual({ type: 'string' });
    });

    it('should define event_code as string', () => {
      expect(props.event_code).toEqual({ type: 'string' });
    });

    it('should define transaction_type with valid enum values', () => {
      const typeProp = props.transaction_type as { type: string; enum: string[] };
      expect(typeProp.type).toBe('string');
      expect(typeProp.enum).toContain(DoshPointsTransactionType.CREDIT);
      expect(typeProp.enum).toContain(DoshPointsTransactionType.DEBIT);
    });

    it('should define amount as integer with minimum 0', () => {
      expect(props.amount).toEqual({ type: 'integer', minimum: 0 });
    });

    it('should define balance_before as integer with minimum 0', () => {
      expect(props.balance_before).toEqual({ type: 'integer', minimum: 0 });
    });

    it('should define balance_after as integer with minimum 0', () => {
      expect(props.balance_after).toEqual({ type: 'integer', minimum: 0 });
    });

    it('should define source_reference as nullable string', () => {
      expect(props.source_reference).toEqual({ type: ['string', 'null'] });
    });

    it('should define description as nullable string', () => {
      expect(props.description).toEqual({ type: ['string', 'null'] });
    });

    it('should define metadata as nullable object', () => {
      expect(props.metadata).toEqual({ type: ['object', 'null'] });
    });

    it('should define status with valid enum values', () => {
      const statusProp = props.status as { type: string; enum: string[] };
      expect(statusProp.type).toBe('string');
      expect(statusProp.enum).toContain(DoshPointsTransactionStatus.PENDING);
      expect(statusProp.enum).toContain(DoshPointsTransactionStatus.COMPLETED);
      expect(statusProp.enum).toContain(DoshPointsTransactionStatus.FAILED);
      expect(statusProp.enum).toContain(DoshPointsTransactionStatus.REVERSED);
    });

    it('should define idempotency_key as nullable string', () => {
      expect(props.idempotency_key).toEqual({ type: ['string', 'null'] });
    });
  });
});

describe('DoshPointsTransactionStatus', () => {
  it('should have PENDING status', () => {
    expect(DoshPointsTransactionStatus.PENDING).toBe('pending');
  });

  it('should have COMPLETED status', () => {
    expect(DoshPointsTransactionStatus.COMPLETED).toBe('completed');
  });

  it('should have FAILED status', () => {
    expect(DoshPointsTransactionStatus.FAILED).toBe('failed');
  });

  it('should have REVERSED status', () => {
    expect(DoshPointsTransactionStatus.REVERSED).toBe('reversed');
  });
});
