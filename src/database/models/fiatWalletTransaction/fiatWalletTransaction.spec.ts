import { BaseModel } from '../../base';
import { DatabaseSchema } from '../../database.schema';
import { DatabaseTables } from '../../database.table';
import { TransactionStatus } from '../transaction';
import { FiatWalletTransactionType } from './fiatWalletTransaction.interface';
import { FiatWalletTransactionModel } from './fiatWalletTransaction.model';
import { FiatWalletTransactionValidationSchema } from './fiatWalletTransaction.validation';

jest.mock('../../base');

describe('FiatWalletTransaction', () => {
  // Reset mocks before each test
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // Interface Tests
  describe('FiatWalletTransactionType', () => {
    it('should define the correct transaction types', () => {
      expect(FiatWalletTransactionType.DEPOSIT).toBe('deposit');
      expect(FiatWalletTransactionType.WITHDRAWAL).toBe('withdrawal');
      expect(FiatWalletTransactionType.TRANSFER_IN).toBe('transfer_in');
      expect(FiatWalletTransactionType.TRANSFER_OUT).toBe('transfer_out');
      expect(FiatWalletTransactionType.PAYMENT).toBe('payment');
      expect(FiatWalletTransactionType.REFUND).toBe('refund');
      expect(FiatWalletTransactionType.FEE).toBe('fee');
      expect(FiatWalletTransactionType.ADJUSTMENT).toBe('adjustment');
      expect(FiatWalletTransactionType.EXCHANGE).toBe('exchange');
      expect(FiatWalletTransactionType.REVERSAL).toBe('reversal');
      expect(FiatWalletTransactionType.REWARD).toBe('reward');
    });

    it('should have exactly eleven transaction types', () => {
      const typesCount = Object.keys(FiatWalletTransactionType).length;
      expect(typesCount).toBe(11);
    });
  });

  // Validation Schema Tests
  describe('FiatWalletTransactionValidationSchema', () => {
    it('should have the correct title', () => {
      expect(FiatWalletTransactionValidationSchema.title).toBe('Fiat Wallet Transaction Validation Schema');
    });

    it('should be of type object', () => {
      expect(FiatWalletTransactionValidationSchema.type).toBe('object');
    });

    it('should require specific fields', () => {
      const requiredFields = FiatWalletTransactionValidationSchema.required as string[];

      expect(requiredFields).toContain('transaction_id');
      expect(requiredFields).toContain('fiat_wallet_id');
      expect(requiredFields).toContain('user_id');
      expect(requiredFields).toContain('transaction_type');
      expect(requiredFields).toContain('amount');
      expect(requiredFields).toContain('balance_before');
      expect(requiredFields).toContain('balance_after');
      expect(requiredFields).toContain('currency');
      expect(requiredFields).toContain('status');
    });

    describe('properties', () => {
      const properties = FiatWalletTransactionValidationSchema.properties as Record<string, any>;

      it('should have transaction_id as string', () => {
        expect(properties.transaction_id.type).toBe('string');
      });

      it('should have fiat_wallet_id as string', () => {
        expect(properties.fiat_wallet_id.type).toBe('string');
      });

      it('should have user_id as string', () => {
        expect(properties.user_id.type).toBe('string');
      });

      it('should have transaction_type as string with valid enum values', () => {
        expect(properties.transaction_type.type).toBe('string');
        expect(properties.transaction_type.enum).toEqual(Object.values(FiatWalletTransactionType));
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

      it('should have currency as string', () => {
        expect(properties.currency.type).toBe('string');
      });

      it('should have status as string with valid enum values', () => {
        expect(properties.status.type).toBe('string');
        expect(properties.status.enum).toEqual(Object.values(TransactionStatus));
        expect(properties.status.default).toBe(TransactionStatus.PENDING);
      });
    });
  });

  // Model Tests
  describe('FiatWalletTransactionModel', () => {
    describe('tableName', () => {
      it('should return the correct table name', () => {
        expect(FiatWalletTransactionModel.tableName).toBe(
          `${DatabaseSchema.apiService}.${DatabaseTables.fiat_wallet_transactions}`,
        );
      });
    });

    describe('jsonSchema', () => {
      it('should return the transaction validation schema', () => {
        expect(FiatWalletTransactionModel.jsonSchema).toBe(FiatWalletTransactionValidationSchema);
      });
    });

    describe('publicProperty', () => {
      it('should return the default public properties', () => {
        const properties = FiatWalletTransactionModel.publicProperty();

        expect(properties).toContain('id');
        expect(properties).toContain('transaction_id');
        expect(properties).toContain('fiat_wallet_id');
        expect(properties).toContain('user_id');
        expect(properties).toContain('transaction_type');
        expect(properties).toContain('amount');
        expect(properties).toContain('balance_before');
        expect(properties).toContain('balance_after');
        expect(properties).toContain('currency');
        expect(properties).toContain('status');
        expect(properties).toContain('provider');
        expect(properties).toContain('provider_reference');
        expect(properties).toContain('provider_fee');
        expect(properties).toContain('source');
        expect(properties).toContain('destination');
        expect(properties).toContain('description');
        expect(properties).toContain('created_at');
        expect(properties).toContain('updated_at');
        expect(properties).toContain('processed_at');
        expect(properties).toContain('completed_at');
        expect(properties).toContain('failed_at');
      });

      it('should include additional properties when provided', () => {
        const additionalProps = ['some_prop', 'another_prop'] as any[];
        const properties = FiatWalletTransactionModel.publicProperty(additionalProps);

        expect(properties).toContain('id');
        expect(properties).toContain('some_prop');
        expect(properties).toContain('another_prop');
      });
    });

    describe('relationMappings', () => {
      beforeEach(() => {
        // Mock BelongsToOneRelation as a string instead of a function
        BaseModel.BelongsToOneRelation = 'BelongsToOneRelation' as any;
      });

      it('should define the transaction relation correctly', () => {
        const relations = FiatWalletTransactionModel.relationMappings;

        expect(relations.transaction).toBeDefined();
        expect(relations.transaction.relation).toBe('BelongsToOneRelation');
        expect(relations.transaction.join).toEqual({
          from: `${DatabaseSchema.apiService}.${DatabaseTables.fiat_wallet_transactions}.transaction_id`,
          to: `${DatabaseSchema.apiService}.${DatabaseTables.transactions}.id`,
        });
      });

      it('should define the fiat_wallet relation correctly', () => {
        const relations = FiatWalletTransactionModel.relationMappings;

        expect(relations.fiat_wallet).toBeDefined();
        expect(relations.fiat_wallet.relation).toBe('BelongsToOneRelation');
        expect(relations.fiat_wallet.join).toEqual({
          from: `${DatabaseSchema.apiService}.${DatabaseTables.fiat_wallet_transactions}.fiat_wallet_id`,
          to: `${DatabaseSchema.apiService}.${DatabaseTables.fiat_wallets}.id`,
        });
      });

      it('should define the user relation correctly', () => {
        const relations = FiatWalletTransactionModel.relationMappings;

        expect(relations.user).toBeDefined();
        expect(relations.user.relation).toBe('BelongsToOneRelation');
        expect(relations.user.join).toEqual({
          from: `${DatabaseSchema.apiService}.${DatabaseTables.fiat_wallet_transactions}.user_id`,
          to: `${DatabaseSchema.apiService}.${DatabaseTables.users}.id`,
        });
      });
    });

    describe('modifiers', () => {
      it('should have a notDeleted modifier', () => {
        const modifiers = FiatWalletTransactionModel.modifiers;

        expect(modifiers.notDeleted).toBeDefined();
        expect(typeof modifiers.notDeleted).toBe('function');

        const mockQuery = { whereNull: jest.fn() };
        modifiers.notDeleted(mockQuery as any);

        expect(mockQuery.whereNull).toHaveBeenCalledWith('deleted_at');
      });

      it('should have transaction type modifiers', () => {
        const modifiers = FiatWalletTransactionModel.modifiers;
        const mockQuery = { where: jest.fn() };

        expect(modifiers.deposits).toBeDefined();
        modifiers.deposits(mockQuery as any);
        expect(mockQuery.where).toHaveBeenCalledWith('transaction_type', FiatWalletTransactionType.DEPOSIT);

        expect(modifiers.withdrawals).toBeDefined();
        modifiers.withdrawals(mockQuery as any);
        expect(mockQuery.where).toHaveBeenCalledWith('transaction_type', FiatWalletTransactionType.WITHDRAWAL);

        expect(modifiers.transfersIn).toBeDefined();
        modifiers.transfersIn(mockQuery as any);
        expect(mockQuery.where).toHaveBeenCalledWith('transaction_type', FiatWalletTransactionType.TRANSFER_IN);

        expect(modifiers.transfersOut).toBeDefined();
        modifiers.transfersOut(mockQuery as any);
        expect(mockQuery.where).toHaveBeenCalledWith('transaction_type', FiatWalletTransactionType.TRANSFER_OUT);
      });

      it('should have status modifiers', () => {
        const modifiers = FiatWalletTransactionModel.modifiers;
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
      });
    });

    describe('instance properties', () => {
      let transactionModel: FiatWalletTransactionModel;

      beforeEach(() => {
        transactionModel = new FiatWalletTransactionModel();
        transactionModel.transaction_id = 'trans123';
        transactionModel.fiat_wallet_id = 'wallet123';
        transactionModel.user_id = 'user123';
        transactionModel.transaction_type = FiatWalletTransactionType.DEPOSIT;
        transactionModel.amount = 1000;
        transactionModel.balance_before = 2000;
        transactionModel.balance_after = 3000;
        transactionModel.currency = 'USD';
        transactionModel.status = TransactionStatus.PENDING;
      });

      it('should properly store the instance properties', () => {
        expect(transactionModel.transaction_id).toBe('trans123');
        expect(transactionModel.fiat_wallet_id).toBe('wallet123');
        expect(transactionModel.user_id).toBe('user123');
        expect(transactionModel.transaction_type).toBe(FiatWalletTransactionType.DEPOSIT);
        expect(transactionModel.amount).toBe(1000);
        expect(transactionModel.balance_before).toBe(2000);
        expect(transactionModel.balance_after).toBe(3000);
        expect(transactionModel.currency).toBe('USD');
        expect(transactionModel.status).toBe(TransactionStatus.PENDING);
      });

      it('should inherit from BaseModel', () => {
        expect(transactionModel).toBeInstanceOf(BaseModel);
      });
    });
  });
});
