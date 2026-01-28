import { BaseModel } from '../../base';
import { DatabaseSchema } from '../../database.schema';
import { DatabaseTables } from '../../database.table';
import { RateTransactionStatus, RateTransactionType } from './rateTransaction.interface';
import { RateTransactionModel } from './rateTransaction.model';
import { RateTransactionValidationSchema } from './rateTransaction.validation';

jest.mock('../../base');

describe('RateTransaction', () => {
  // Reset mocks before each test
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // Interface Tests
  describe('RateTransactionType', () => {
    it('should define the correct rate transaction types', () => {
      expect(RateTransactionType.BUY).toBe('buy');
      expect(RateTransactionType.SELL).toBe('sell');
    });

    it('should have exactly two rate transaction types', () => {
      const typesCount = Object.keys(RateTransactionType).length;
      expect(typesCount).toBe(2);
    });
  });

  describe('RateTransactionStatus', () => {
    it('should define the correct status values', () => {
      expect(RateTransactionStatus.PENDING).toBe('pending');
      expect(RateTransactionStatus.INITIATED).toBe('initiated');
      expect(RateTransactionStatus.PROCESSING).toBe('processing');
      expect(RateTransactionStatus.COMPLETED).toBe('completed');
      expect(RateTransactionStatus.FAILED).toBe('failed');
      expect(RateTransactionStatus.CANCELLED).toBe('cancelled');
    });

    it('should have exactly six status types', () => {
      const statusCount = Object.keys(RateTransactionStatus).length;
      expect(statusCount).toBe(6);
    });
  });

  // Validation Schema Tests
  describe('RateTransactionValidationSchema', () => {
    it('should have the correct title', () => {
      expect(RateTransactionValidationSchema.title).toBe('RateTransaction Validation Schema');
    });

    it('should be of type object', () => {
      expect(RateTransactionValidationSchema.type).toBe('object');
    });

    it('should require specific fields', () => {
      const requiredFields = RateTransactionValidationSchema.required as string[];
      expect(requiredFields).toContain('user_id');
      expect(requiredFields).toContain('transaction_id');
      expect(requiredFields).toContain('rate');
      expect(requiredFields).toContain('converted_currency');
      expect(requiredFields).toContain('base_currency');
      expect(requiredFields).toContain('amount');
      expect(requiredFields).toContain('converted_amount');
      expect(requiredFields).toContain('status');
      expect(requiredFields).toContain('type');
      expect(requiredFields).toContain('provider');
    });

    describe('properties', () => {
      const properties = RateTransactionValidationSchema.properties as Record<string, any>;

      it('should have user_id as string', () => {
        expect(properties.user_id.type).toBe('string');
      });

      it('should have transaction_id as string', () => {
        expect(properties.transaction_id.type).toBe('string');
      });

      it('should have rate as number', () => {
        expect(properties.rate.type).toBe('number');
      });

      it('should have converted_currency as string', () => {
        expect(properties.converted_currency.type).toBe('string');
      });

      it('should have base_currency as string', () => {
        expect(properties.base_currency.type).toBe('string');
      });

      it('should have amount as number', () => {
        expect(properties.amount.type).toBe('number');
      });

      it('should have converted_amount as number', () => {
        expect(properties.converted_amount.type).toBe('number');
      });

      it('should have expires_at as string or null', () => {
        expect(properties.expires_at.type).toEqual(['string', 'null']);
      });

      it('should have processed_at as string or null', () => {
        expect(properties.processed_at.type).toEqual(['string', 'null']);
      });

      it('should have failed_at as string or null', () => {
        expect(properties.failed_at.type).toEqual(['string', 'null']);
      });

      it('should have completed_at as string or null', () => {
        expect(properties.completed_at.type).toEqual(['string', 'null']);
      });

      it('should have failure_reason as string or null', () => {
        expect(properties.failure_reason.type).toEqual(['string', 'null']);
      });

      it('should have status as string with enum values and default', () => {
        expect(properties.status.type).toBe('string');
        expect(properties.status.enum).toEqual(Object.values(RateTransactionStatus));
        expect(properties.status.default).toBe(RateTransactionStatus.PENDING);
      });

      it('should have type as string with enum values', () => {
        expect(properties.type.type).toBe('string');
        expect(properties.type.enum).toEqual(Object.values(RateTransactionType));
      });

      it('should have provider as string', () => {
        expect(properties.provider.type).toBe('string');
      });
    });
  });

  // Model Tests
  describe('RateTransactionModel', () => {
    describe('tableName', () => {
      it('should return the correct table name', () => {
        expect(RateTransactionModel.tableName).toBe(`${DatabaseSchema.apiService}.${DatabaseTables.rate_transactions}`);
      });
    });

    describe('jsonSchema', () => {
      it('should return the rate transaction validation schema', () => {
        expect(RateTransactionModel.jsonSchema).toBe(RateTransactionValidationSchema);
      });
    });

    describe('publicProperty', () => {
      it('should return the default public properties', () => {
        const properties = RateTransactionModel.publicProperty();

        expect(properties).toContain('id');
        expect(properties).toContain('user_id');
        expect(properties).toContain('transaction_id');
        expect(properties).toContain('rate');
        expect(properties).toContain('converted_currency');
        expect(properties).toContain('base_currency');
        expect(properties).toContain('amount');
        expect(properties).toContain('converted_amount');
        expect(properties).toContain('expires_at');
        expect(properties).toContain('processed_at');
        expect(properties).toContain('failed_at');
        expect(properties).toContain('completed_at');
        expect(properties).toContain('failure_reason');
        expect(properties).toContain('status');
        expect(properties).toContain('type');
        expect(properties).toContain('provider');
        expect(properties).toContain('created_at');
        expect(properties).toContain('updated_at');
      });

      it('should include additional properties when provided', () => {
        const additionalProps = ['user', 'transaction'] as any[];
        const properties = RateTransactionModel.publicProperty(additionalProps);

        expect(properties).toContain('id');
        expect(properties).toContain('user');
        expect(properties).toContain('transaction');
      });
    });

    describe('relationMappings', () => {
      beforeEach(() => {
        // Mock BelongsToOneRelation as a string instead of a function
        BaseModel.BelongsToOneRelation = 'BelongsToOneRelation' as any;
      });

      it('should define the user relation correctly', () => {
        const relations = RateTransactionModel.relationMappings;

        expect(relations.user).toBeDefined();
        expect(relations.user.relation).toBe('BelongsToOneRelation');
        expect(relations.user.modelClass).toBe('../models/user');
        expect(relations.user.join).toEqual({
          from: `${DatabaseSchema.apiService}.${DatabaseTables.rate_transactions}.user_id`,
          to: `${DatabaseSchema.apiService}.${DatabaseTables.users}.id`,
        });
      });

      it('should define the transaction relation correctly', () => {
        const relations = RateTransactionModel.relationMappings;

        expect(relations.transaction).toBeDefined();
        expect(relations.transaction.relation).toBe('BelongsToOneRelation');
        expect(relations.transaction.modelClass).toBe('../models/transaction');
        expect(relations.transaction.join).toEqual({
          from: `${DatabaseSchema.apiService}.${DatabaseTables.rate_transactions}.transaction_id`,
          to: `${DatabaseSchema.apiService}.${DatabaseTables.transactions}.id`,
        });
      });
    });

    describe('modifiers', () => {
      it('should have a notDeleted modifier', () => {
        const modifiers = RateTransactionModel.modifiers;

        expect(modifiers.notDeleted).toBeDefined();
        expect(typeof modifiers.notDeleted).toBe('function');

        const mockQuery = { whereNull: jest.fn() };
        modifiers.notDeleted(mockQuery as any);

        expect(mockQuery.whereNull).toHaveBeenCalledWith('deleted_at');
      });

      it('should have status modifiers', () => {
        const modifiers = RateTransactionModel.modifiers;
        const mockQuery = { where: jest.fn() };

        expect(modifiers.pending).toBeDefined();
        modifiers.pending(mockQuery as any);
        expect(mockQuery.where).toHaveBeenCalledWith('status', RateTransactionStatus.PENDING);

        expect(modifiers.initiated).toBeDefined();
        modifiers.initiated(mockQuery as any);
        expect(mockQuery.where).toHaveBeenCalledWith('status', RateTransactionStatus.INITIATED);

        expect(modifiers.processing).toBeDefined();
        modifiers.processing(mockQuery as any);
        expect(mockQuery.where).toHaveBeenCalledWith('status', RateTransactionStatus.PROCESSING);

        expect(modifiers.completed).toBeDefined();
        modifiers.completed(mockQuery as any);
        expect(mockQuery.where).toHaveBeenCalledWith('status', RateTransactionStatus.COMPLETED);

        expect(modifiers.failed).toBeDefined();
        modifiers.failed(mockQuery as any);
        expect(mockQuery.where).toHaveBeenCalledWith('status', RateTransactionStatus.FAILED);

        expect(modifiers.cancelled).toBeDefined();
        modifiers.cancelled(mockQuery as any);
        expect(mockQuery.where).toHaveBeenCalledWith('status', RateTransactionStatus.CANCELLED);
      });

      it('should have type modifiers', () => {
        const modifiers = RateTransactionModel.modifiers;
        const mockQuery = { where: jest.fn() };

        expect(modifiers.buy).toBeDefined();
        modifiers.buy(mockQuery as any);
        expect(mockQuery.where).toHaveBeenCalledWith('type', RateTransactionType.BUY);

        expect(modifiers.sell).toBeDefined();
        modifiers.sell(mockQuery as any);
        expect(mockQuery.where).toHaveBeenCalledWith('type', RateTransactionType.SELL);
      });
    });

    describe('instance properties', () => {
      let rateTransactionModel: RateTransactionModel;

      beforeEach(() => {
        rateTransactionModel = new RateTransactionModel();
        rateTransactionModel.user_id = 'user123';
        rateTransactionModel.transaction_id = 'tx123';
        rateTransactionModel.rate = 1.25;
        rateTransactionModel.converted_currency = 'USD';
        rateTransactionModel.base_currency = 'NGN';
        rateTransactionModel.amount = 100000; // 1000 NGN in smallest unit
        rateTransactionModel.converted_amount = 800; // 8 USD in smallest unit
        rateTransactionModel.expires_at = '2024-01-01T00:00:00Z';
        rateTransactionModel.processed_at = null;
        rateTransactionModel.failed_at = null;
        rateTransactionModel.completed_at = null;
        rateTransactionModel.failure_reason = null;
        rateTransactionModel.type = RateTransactionType.BUY;
        rateTransactionModel.status = RateTransactionStatus.PENDING;
      });

      it('should properly store the instance properties', () => {
        expect(rateTransactionModel.user_id).toBe('user123');
        expect(rateTransactionModel.transaction_id).toBe('tx123');
        expect(rateTransactionModel.rate).toBe(1.25);
        expect(rateTransactionModel.converted_currency).toBe('USD');
        expect(rateTransactionModel.base_currency).toBe('NGN');
        expect(rateTransactionModel.amount).toBe(100000);
        expect(rateTransactionModel.converted_amount).toBe(800);
        expect(rateTransactionModel.expires_at).toBe('2024-01-01T00:00:00Z');
        expect(rateTransactionModel.processed_at).toBeNull();
        expect(rateTransactionModel.failed_at).toBeNull();
        expect(rateTransactionModel.completed_at).toBeNull();
        expect(rateTransactionModel.failure_reason).toBeNull();
        expect(rateTransactionModel.type).toBe(RateTransactionType.BUY);
        expect(rateTransactionModel.status).toBe(RateTransactionStatus.PENDING);
      });

      it('should inherit from BaseModel', () => {
        expect(rateTransactionModel).toBeInstanceOf(BaseModel);
      });

      it('should handle optional properties', () => {
        rateTransactionModel.processed_at = '2024-01-01T01:00:00Z';
        rateTransactionModel.completed_at = '2024-01-01T02:00:00Z';
        rateTransactionModel.failure_reason = 'Exchange rate expired';

        expect(rateTransactionModel.processed_at).toBe('2024-01-01T01:00:00Z');
        expect(rateTransactionModel.completed_at).toBe('2024-01-01T02:00:00Z');
        expect(rateTransactionModel.failure_reason).toBe('Exchange rate expired');
      });

      it('should handle SELL type transactions', () => {
        rateTransactionModel.type = RateTransactionType.SELL;
        rateTransactionModel.status = RateTransactionStatus.COMPLETED;

        expect(rateTransactionModel.type).toBe(RateTransactionType.SELL);
        expect(rateTransactionModel.status).toBe(RateTransactionStatus.COMPLETED);
      });
    });
  });
});
