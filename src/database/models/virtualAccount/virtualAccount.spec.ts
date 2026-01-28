import { BaseModel } from '../../base';
import { DatabaseSchema } from '../../database.schema';
import { DatabaseTables } from '../../database.table';
import { VirtualAccountModel } from './virtualAccount.model';
import { VirtualAccountValidationSchema } from './virtualAccount.validation';

jest.mock('../../base');

describe('VirtualAccount', () => {
  // Reset mocks before each test
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // Validation Schema Tests
  describe('VirtualAccountValidationSchema', () => {
    it('should be of type object', () => {
      expect(VirtualAccountValidationSchema.type).toBe('object');
    });

    it('should require specific fields', () => {
      const requiredFields = VirtualAccountValidationSchema.required as string[];

      expect(requiredFields).toContain('user_id');
      expect(requiredFields).toContain('account_name');
      expect(requiredFields).toContain('account_number');
      expect(requiredFields).toContain('bank_name');
      expect(requiredFields).toContain('type');
      expect(requiredFields).not.toContain('fiat_wallet_id');
    });

    describe('properties', () => {
      const properties = VirtualAccountValidationSchema.properties as Record<string, any>;

      it('should have user_id as string', () => {
        expect(properties.user_id.type).toBe('string');
      });

      it('should have account_name as string', () => {
        expect(properties.account_name.type).toBe('string');
      });

      it('should have account_number as string', () => {
        expect(properties.account_number.type).toBe('string');
      });

      it('should have bank_name as string', () => {
        expect(properties.bank_name.type).toBe('string');
      });

      it('should have fiat_wallet_id as string or null', () => {
        expect(properties.fiat_wallet_id.type).toEqual(['string', 'null']);
      });

      it('should have type as string or null with enum values', () => {
        expect(properties.type.type).toEqual(['string', 'null']);
        expect(properties.type.enum).toBeDefined();
      });
    });
  });

  // Model Tests
  describe('VirtualAccountModel', () => {
    describe('tableName', () => {
      it('should return the correct table name', () => {
        expect(VirtualAccountModel.tableName).toBe(`${DatabaseSchema.apiService}.${DatabaseTables.virtual_accounts}`);
      });
    });

    describe('jsonSchema', () => {
      it('should return the virtual account validation schema', () => {
        expect(VirtualAccountModel.jsonSchema).toBe(VirtualAccountValidationSchema);
      });
    });

    describe('relationMappings', () => {
      beforeEach(() => {
        // Mock BelongsToOneRelation as a string instead of a function
        BaseModel.BelongsToOneRelation = 'BelongsToOneRelation' as any;
      });

      it('should define the user relation correctly', () => {
        const relations = VirtualAccountModel.relationMappings;

        expect(relations.user).toBeDefined();
        expect(relations.user.relation).toBe('BelongsToOneRelation');
        expect(relations.user.join).toEqual({
          from: `${DatabaseSchema.apiService}.${DatabaseTables.virtual_accounts}.user_id`,
          to: `${DatabaseSchema.apiService}.${DatabaseTables.users}.id`,
        });
      });

      it('should define the fiatWallet relation correctly', () => {
        const relations = VirtualAccountModel.relationMappings;

        expect(relations.fiatWallet).toBeDefined();
        expect(relations.fiatWallet.relation).toBe('BelongsToOneRelation');
        expect(relations.fiatWallet.join).toEqual({
          from: `${DatabaseSchema.apiService}.${DatabaseTables.virtual_accounts}.fiat_wallet_id`,
          to: `${DatabaseSchema.apiService}.${DatabaseTables.fiat_wallets}.id`,
        });
      });
    });

    describe('instance properties', () => {
      let virtualAccountModel: VirtualAccountModel;

      beforeEach(() => {
        virtualAccountModel = new VirtualAccountModel();
        virtualAccountModel.user_id = 'user123';
        virtualAccountModel.account_name = 'John Doe';
        virtualAccountModel.account_number = '1234567890';
        virtualAccountModel.bank_name = 'Test Bank';
        virtualAccountModel.fiat_wallet_id = 'wallet123';
      });

      it('should properly store the instance properties', () => {
        expect(virtualAccountModel.user_id).toBe('user123');
        expect(virtualAccountModel.account_name).toBe('John Doe');
        expect(virtualAccountModel.account_number).toBe('1234567890');
        expect(virtualAccountModel.bank_name).toBe('Test Bank');
        expect(virtualAccountModel.fiat_wallet_id).toBe('wallet123');
      });

      it('should inherit from BaseModel', () => {
        expect(virtualAccountModel).toBeInstanceOf(BaseModel);
      });
    });
  });
});
