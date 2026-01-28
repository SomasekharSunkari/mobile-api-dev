import { BaseModel } from '../../base';
import { DatabaseSchema } from '../../database.schema';
import { DatabaseTables } from '../../database.table';
import { FiatWalletStatus } from './fiatWallet.interface';
import { FiatWalletModel } from './fiatWallet.model';
import { FiatWalletValidationSchema } from './fiatWallet.validation';

jest.mock('../../base');

describe('FiatWallet', () => {
  // Reset mocks before each test
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // Interface Tests
  describe('FiatWalletStatus', () => {
    it('should define the correct status values', () => {
      expect(FiatWalletStatus.ACTIVE).toBe('active');
      expect(FiatWalletStatus.INACTIVE).toBe('inactive');
      expect(FiatWalletStatus.FROZEN).toBe('frozen');
      expect(FiatWalletStatus.CLOSED).toBe('closed');
    });

    it('should have exactly four status types', () => {
      const statusValues = Object.values(FiatWalletStatus);
      expect(statusValues.length).toBe(4);
      expect(statusValues).toEqual(['active', 'inactive', 'frozen', 'closed']);
    });
  });

  // Validation Schema Tests
  describe('FiatWalletValidationSchema', () => {
    it('should have the correct title', () => {
      expect(FiatWalletValidationSchema.title).toBe('Fiat Wallet Validation Schema');
    });

    it('should be of type object', () => {
      expect(FiatWalletValidationSchema.type).toBe('object');
    });

    it('should require specific fields', () => {
      const requiredFields = FiatWalletValidationSchema.required as string[];

      expect(requiredFields).toContain('user_id');
      expect(requiredFields).toContain('balance');
      expect(requiredFields).toContain('credit_balance');
      expect(requiredFields).toContain('asset');
      expect(requiredFields).toContain('status');
    });

    describe('properties', () => {
      const properties = FiatWalletValidationSchema.properties as Record<string, any>;

      it('should have user_id as string', () => {
        expect(properties.user_id.type).toBe('string');
      });

      it('should have balance as number with minimum 0', () => {
        expect(properties.balance.type).toBe('number');
        expect(properties.balance.minimum).toBe(0);
      });

      it('should have credit_balance as number with minimum 0', () => {
        expect(properties.credit_balance.type).toBe('number');
        expect(properties.credit_balance.minimum).toBe(0);
      });

      it('should have asset as string', () => {
        expect(properties.asset.type).toBe('string');
      });

      it('should have status as string with valid enum values', () => {
        expect(properties.status.type).toBe('string');
        expect(properties.status.enum).toEqual(Object.values(FiatWalletStatus));
      });
    });
  });

  // Model Tests
  describe('FiatWalletModel', () => {
    describe('tableName', () => {
      it('should return the correct table name', () => {
        expect(FiatWalletModel.tableName).toBe(`${DatabaseSchema.apiService}.${DatabaseTables.fiat_wallets}`);
      });
    });

    describe('jsonSchema', () => {
      it('should return the wallet validation schema', () => {
        expect(FiatWalletModel.jsonSchema).toBe(FiatWalletValidationSchema);
      });
    });

    describe('publicProperty', () => {
      it('should return the default public properties', () => {
        const properties = FiatWalletModel.publicProperty();

        expect(properties).toContain('id');
        expect(properties).toContain('user_id');
        expect(properties).toContain('balance');
        expect(properties).toContain('credit_balance');
        expect(properties).toContain('asset');
        expect(properties).toContain('status');
        expect(properties).toContain('created_at');
        expect(properties).toContain('updated_at');
      });

      it('should include additional properties when provided', () => {
        const additionalProps = ['some_prop', 'another_prop'] as any[];
        const properties = FiatWalletModel.publicProperty(additionalProps);

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

      it('should define the user relation correctly', () => {
        const relations = FiatWalletModel.relationMappings;

        expect(relations.user).toBeDefined();
        expect(relations.user.relation).toBe('BelongsToOneRelation');
        expect(relations.user.join).toEqual({
          from: `${DatabaseSchema.apiService}.${DatabaseTables.fiat_wallets}.user_id`,
          to: `${DatabaseSchema.apiService}.${DatabaseTables.users}.id`,
        });
      });
    });

    describe('modifiers', () => {
      it('should have a notDeleted modifier', () => {
        const modifiers = FiatWalletModel.modifiers;

        expect(modifiers.notDeleted).toBeDefined();
        expect(typeof modifiers.notDeleted).toBe('function');

        const mockQuery = { whereNull: jest.fn() };
        modifiers.notDeleted(mockQuery as any);

        expect(mockQuery.whereNull).toHaveBeenCalledWith('deleted_at');
      });
    });

    describe('instance properties', () => {
      let walletModel: FiatWalletModel;

      beforeEach(() => {
        walletModel = new FiatWalletModel();
        walletModel.user_id = 'user123';
        walletModel.balance = 1000;
        walletModel.credit_balance = 200;
        walletModel.asset = 'USD';
        walletModel.status = FiatWalletStatus.ACTIVE;
      });

      it('should properly store the instance properties', () => {
        expect(walletModel.user_id).toBe('user123');
        expect(walletModel.balance).toBe(1000);
        expect(walletModel.credit_balance).toBe(200);
        expect(walletModel.asset).toBe('USD');
        expect(walletModel.status).toBe(FiatWalletStatus.ACTIVE);
      });

      it('should inherit from BaseModel', () => {
        expect(walletModel).toBeInstanceOf(BaseModel);
      });
    });
  });
});
