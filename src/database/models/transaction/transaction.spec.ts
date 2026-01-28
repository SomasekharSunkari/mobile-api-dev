import { BaseModel } from '../../base';
import { DatabaseSchema } from '../../database.schema';
import { DatabaseTables } from '../../database.table';
import { TransactionStatus, TransactionType } from './transaction.interface';
import { TransactionModel } from './transaction.model';
import { TransactionValidationSchema } from './transaction.validation';

jest.mock('../../base');

describe('Transaction', () => {
  // Reset mocks before each test
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // Interface Tests
  describe('TransactionType', () => {
    it('should define the correct transaction types', () => {
      expect(TransactionType.DEPOSIT).toBe('deposit');
      expect(TransactionType.WITHDRAWAL).toBe('withdrawal');
      expect(TransactionType.TRANSFER).toBe('transfer');
      expect(TransactionType.TRANSFER_OUT).toBe('transfer_out');
      expect(TransactionType.TRANSFER_IN).toBe('transfer_in');
      expect(TransactionType.EXCHANGE).toBe('exchange');
      expect(TransactionType.FEE).toBe('fee');
      expect(TransactionType.REFUND).toBe('refund');
      expect(TransactionType.PAYMENT).toBe('payment');
      expect(TransactionType.REWARD).toBe('reward');
    });

    it('should have exactly ten transaction types', () => {
      const typesCount = Object.keys(TransactionType).length;
      expect(typesCount).toBe(10);
    });
  });

  describe('TransactionStatus', () => {
    it('should define the correct status values', () => {
      expect(TransactionStatus.PENDING).toBe('pending');
      expect(TransactionStatus.INITIATED).toBe('initiated');
      expect(TransactionStatus.PROCESSING).toBe('processing');
      expect(TransactionStatus.COMPLETED).toBe('completed');
      expect(TransactionStatus.SETTLED).toBe('settled');
      expect(TransactionStatus.FAILED).toBe('failed');
      expect(TransactionStatus.CANCELLED).toBe('cancelled');
      expect(TransactionStatus.REVIEW).toBe('review');
    });

    it('should have exactly nine status types', () => {
      const statusCount = Object.keys(TransactionStatus).length;
      expect(statusCount).toBe(9);
    });
  });

  // Validation Schema Tests
  describe('TransactionValidationSchema', () => {
    it('should have the correct title', () => {
      expect(TransactionValidationSchema.title).toBe('Transaction Validation Schema');
    });

    it('should be of type object', () => {
      expect(TransactionValidationSchema.type).toBe('object');
    });

    it('should require specific fields', () => {
      const requiredFields = TransactionValidationSchema.required as string[];
      expect(requiredFields).toContain('reference');
      expect(requiredFields).toContain('asset');
      expect(requiredFields).toContain('amount');
      expect(requiredFields).toContain('balance_before');
      expect(requiredFields).toContain('balance_after');
      expect(requiredFields).toContain('transaction_type');
      expect(requiredFields).toContain('status');
    });

    describe('properties', () => {
      const properties = TransactionValidationSchema.properties as Record<string, any>;

      it('should have reference as string', () => {
        expect(properties.reference.type).toBe('string');
      });

      it('should have external_reference as string or null', () => {
        expect(properties.external_reference.type).toEqual(['string', 'null']);
      });

      it('should have asset as string', () => {
        expect(properties.asset.type).toBe('string');
      });

      it('should have amount as number', () => {
        expect(properties.amount.type).toBe('number');
      });

      it('should have balance_before as number', () => {
        expect(properties.balance_before.type).toBe('number');
      });

      it('should have balance_after as number', () => {
        expect(properties.balance_after.type).toBe('number');
      });

      it('should have transaction_type as string with enum values', () => {
        expect(properties.transaction_type.type).toBe('string');
        expect(properties.transaction_type.enum).toEqual(Object.values(TransactionType));
      });

      it('should have status as string with enum values', () => {
        expect(properties.status.type).toBe('string');
        expect(properties.status.enum).toEqual(Object.values(TransactionStatus));
      });

      it('should have metadata as object or null', () => {
        expect(properties.metadata.type).toEqual(['object', 'null']);
      });

      it('should have description as string or null', () => {
        expect(properties.description.type).toEqual(['string', 'null']);
      });

      it('should have ip_address as string or null', () => {
        expect(properties.ip_address.type).toEqual(['string', 'null']);
      });

      it('should have user_agent as string or null', () => {
        expect(properties.user_agent.type).toEqual(['string', 'null']);
      });

      it('should have completed_at as string or null', () => {
        expect(properties.completed_at.type).toEqual(['string', 'null']);
      });

      it('should have failed_at as string or null', () => {
        expect(properties.failed_at.type).toEqual(['string', 'null']);
      });

      it('should have processed_at as string', () => {
        expect(properties.processed_at.type).toBe('string');
      });

      it('should have failure_reason as string or null', () => {
        expect(properties.failure_reason.type).toEqual(['string', 'null']);
      });
    });
  });

  // Model Tests
  describe('TransactionModel', () => {
    describe('tableName', () => {
      it('should return the correct table name', () => {
        expect(TransactionModel.tableName).toBe(`${DatabaseSchema.apiService}.${DatabaseTables.transactions}`);
      });
    });

    describe('jsonSchema', () => {
      it('should return the transaction validation schema', () => {
        expect(TransactionModel.jsonSchema).toBe(TransactionValidationSchema);
      });
    });

    describe('publicProperty', () => {
      it('should return the default public properties', () => {
        const properties = TransactionModel.publicProperty();

        expect(properties).toContain('id');
        expect(properties).toContain('user_id');
        expect(properties).toContain('reference');
        expect(properties).toContain('external_reference');
        expect(properties).toContain('asset');
        expect(properties).toContain('amount');
        expect(properties).toContain('balance_before');
        expect(properties).toContain('balance_after');
        expect(properties).toContain('transaction_type');
        expect(properties).toContain('status');
        expect(properties).toContain('description');
        expect(properties).toContain('created_at');
        expect(properties).toContain('updated_at');
        expect(properties).toContain('completed_at');
        expect(properties).toContain('failed_at');
      });

      it('should include additional properties when provided', () => {
        const additionalProps = ['metadata', 'ip_address'] as any[];
        const properties = TransactionModel.publicProperty(additionalProps);

        expect(properties).toContain('id');
        expect(properties).toContain('metadata');
        expect(properties).toContain('ip_address');
      });
    });

    describe('relationMappings', () => {
      beforeEach(() => {
        // Mock BelongsToOneRelation as a string instead of a function
        BaseModel.BelongsToOneRelation = 'BelongsToOneRelation' as any;
      });

      it('should define the user relation correctly', () => {
        const relations = TransactionModel.relationMappings;

        expect(relations.user).toBeDefined();
        expect(relations.user.relation).toBe('BelongsToOneRelation');
        expect(relations.user.join).toEqual({
          from: `${DatabaseSchema.apiService}.${DatabaseTables.transactions}.user_id`,
          to: `${DatabaseSchema.apiService}.${DatabaseTables.users}.id`,
        });
      });
    });

    describe('modifiers', () => {
      it('should have a notDeleted modifier', () => {
        const modifiers = TransactionModel.modifiers;

        expect(modifiers.notDeleted).toBeDefined();
        expect(typeof modifiers.notDeleted).toBe('function');

        const mockQuery = { whereNull: jest.fn() };
        modifiers.notDeleted(mockQuery as any);

        expect(mockQuery.whereNull).toHaveBeenCalledWith('deleted_at');
      });

      it('should have status modifiers', () => {
        const modifiers = TransactionModel.modifiers;
        const mockQuery = { where: jest.fn() };

        expect(modifiers.pending).toBeDefined();
        modifiers.pending(mockQuery as any);
        expect(mockQuery.where).toHaveBeenCalledWith('status', TransactionStatus.PENDING);

        expect(modifiers.processing).toBeDefined();
        modifiers.processing(mockQuery as any);
        expect(mockQuery.where).toHaveBeenCalledWith('status', TransactionStatus.PROCESSING);

        expect(modifiers.completed).toBeDefined();
        modifiers.completed(mockQuery as any);
        expect(mockQuery.where).toHaveBeenCalledWith('status', TransactionStatus.COMPLETED);

        expect(modifiers.failed).toBeDefined();
        modifiers.failed(mockQuery as any);
        expect(mockQuery.where).toHaveBeenCalledWith('status', TransactionStatus.FAILED);

        expect(modifiers.cancelled).toBeDefined();
        modifiers.cancelled(mockQuery as any);
        expect(mockQuery.where).toHaveBeenCalledWith('status', TransactionStatus.CANCELLED);
      });
    });

    describe('instance properties', () => {
      let transactionModel: TransactionModel;

      beforeEach(() => {
        transactionModel = new TransactionModel();
        transactionModel.user_id = 'user123';
        transactionModel.reference = 'TX123456';
        transactionModel.external_reference = 'EXT123';
        transactionModel.asset = 'USD';
        transactionModel.amount = 1000;
        transactionModel.balance_before = 2000;
        transactionModel.balance_after = 3000;
        transactionModel.transaction_type = TransactionType.DEPOSIT;
        transactionModel.status = TransactionStatus.PENDING;
        transactionModel.metadata = { provider: 'test_provider' };
        transactionModel.description = 'Test transaction';
      });

      it('should properly store the instance properties', () => {
        expect(transactionModel.user_id).toBe('user123');
        expect(transactionModel.reference).toBe('TX123456');
        expect(transactionModel.external_reference).toBe('EXT123');
        expect(transactionModel.asset).toBe('USD');
        expect(transactionModel.amount).toBe(1000);
        expect(transactionModel.balance_before).toBe(2000);
        expect(transactionModel.balance_after).toBe(3000);
        expect(transactionModel.transaction_type).toBe(TransactionType.DEPOSIT);
        expect(transactionModel.status).toBe(TransactionStatus.PENDING);
        expect(transactionModel.metadata).toEqual({ provider: 'test_provider' });
        expect(transactionModel.description).toBe('Test transaction');
      });

      it('should inherit from BaseModel', () => {
        expect(transactionModel).toBeInstanceOf(BaseModel);
      });
    });
  });
});
