import { BaseModel } from '../../base';
import { DatabaseSchema } from '../../database.schema';
import { DatabaseTables } from '../../database.table';
import { UserModel } from '../user/user.model';
import { BlockchainBeneficiaryModel } from './blockchainBeneficiary.model';
import { BlockchainBeneficiaryValidationSchema } from './blockchainBeneficiary.validation';

jest.mock('../../base');

describe('BlockchainBeneficiaryModel', () => {
  describe('tableName', () => {
    it('should return the correct table name', () => {
      expect(BlockchainBeneficiaryModel.tableName).toBe(
        `${DatabaseSchema.apiService}.${DatabaseTables.blockchain_beneficiaries}`,
      );
    });
  });

  describe('jsonSchema', () => {
    it('should return the blockchain beneficiary validation schema', () => {
      expect(BlockchainBeneficiaryModel.jsonSchema).toBe(BlockchainBeneficiaryValidationSchema);
    });
  });

  describe('publicProperty', () => {
    it('should return the default public properties', () => {
      const properties = BlockchainBeneficiaryModel.publicProperty();
      expect(properties).toContain('id');
      expect(properties).toContain('user_id');
      expect(properties).toContain('beneficiary_user_id');
      expect(properties).toContain('alias_name');
      expect(properties).toContain('asset');
      expect(properties).toContain('address');
      expect(properties).toContain('network');
      expect(properties).toContain('avatar_url');
      expect(properties).toContain('created_at');
      expect(properties).toContain('updated_at');
    });
  });

  describe('relationMappings', () => {
    beforeEach(() => {
      BaseModel.BelongsToOneRelation = 'BelongsToOneRelation' as any;
    });

    it('should define the user relation correctly', () => {
      const relations = BlockchainBeneficiaryModel.relationMappings;

      expect(relations.user).toBeDefined();
      expect(relations.user.relation).toBe('BelongsToOneRelation');
      expect(relations.user.modelClass).toBe(UserModel);
      expect(relations.user.join).toEqual({
        from: `${DatabaseSchema.apiService}.${DatabaseTables.blockchain_beneficiaries}.user_id`,
        to: `${DatabaseSchema.apiService}.${DatabaseTables.users}.id`,
      });
    });

    it('should define the beneficiaryUser relation correctly', () => {
      const relations = BlockchainBeneficiaryModel.relationMappings;

      expect(relations.beneficiaryUser).toBeDefined();
      expect(relations.beneficiaryUser.relation).toBe('BelongsToOneRelation');
      expect(relations.beneficiaryUser.modelClass).toBe(UserModel);
      expect(relations.beneficiaryUser.join).toEqual({
        from: `${DatabaseSchema.apiService}.${DatabaseTables.blockchain_beneficiaries}.beneficiary_user_id`,
        to: `${DatabaseSchema.apiService}.${DatabaseTables.users}.id`,
      });
    });
  });

  describe('modifiers', () => {
    it('should have a notDeleted modifier', () => {
      const modifiers = BlockchainBeneficiaryModel.modifiers;

      expect(modifiers.notDeleted).toBeDefined();
      expect(typeof modifiers.notDeleted).toBe('function');

      const mockQuery = { whereNull: jest.fn() };
      modifiers.notDeleted(mockQuery as any);

      expect(mockQuery.whereNull).toHaveBeenCalledWith('deleted_at');
    });
  });

  describe('instance properties', () => {
    let model: BlockchainBeneficiaryModel;

    beforeEach(() => {
      model = new BlockchainBeneficiaryModel();
      model.user_id = 'user-123';
      model.beneficiary_user_id = 'beneficiary-user-456';
      model.alias_name = 'My Wallet';
      model.asset = 'USDT';
      model.address = '0x1234567890abcdef1234567890abcdef12345678';
      model.network = 'ethereum';
      model.avatar_url = 'https://example.com/avatar.png';
      model.user = { id: 'user-123', email: 'test@example.com' } as any;
    });

    it('should properly store the instance properties', () => {
      expect(model.user_id).toBe('user-123');
      expect(model.beneficiary_user_id).toBe('beneficiary-user-456');
      expect(model.alias_name).toBe('My Wallet');
      expect(model.asset).toBe('USDT');
      expect(model.address).toBe('0x1234567890abcdef1234567890abcdef12345678');
      expect(model.network).toBe('ethereum');
      expect(model.avatar_url).toBe('https://example.com/avatar.png');
      expect(model.user).toEqual({ id: 'user-123', email: 'test@example.com' });
    });

    it('should inherit from BaseModel', () => {
      expect(model).toBeInstanceOf(BaseModel);
    });

    it('should handle optional fields', () => {
      const modelWithoutOptionals = new BlockchainBeneficiaryModel();
      modelWithoutOptionals.user_id = 'user-456';
      modelWithoutOptionals.beneficiary_user_id = 'beneficiary-user-789';
      modelWithoutOptionals.asset = 'BTC';
      modelWithoutOptionals.address = '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa';
      modelWithoutOptionals.network = 'bitcoin';

      expect(modelWithoutOptionals.user_id).toBe('user-456');
      expect(modelWithoutOptionals.beneficiary_user_id).toBe('beneficiary-user-789');
      expect(modelWithoutOptionals.asset).toBe('BTC');
      expect(modelWithoutOptionals.address).toBe('1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa');
      expect(modelWithoutOptionals.network).toBe('bitcoin');
      expect(modelWithoutOptionals.alias_name).toBeUndefined();
      expect(modelWithoutOptionals.avatar_url).toBeUndefined();
    });

    it('should handle beneficiary_user_id property', () => {
      const beneficiaryUserIds = ['ben-user-1', 'ben-user-2', 'ben-user-3', 'ben-user-4'];

      beneficiaryUserIds.forEach((beneficiaryUserId) => {
        const testModel = new BlockchainBeneficiaryModel();
        testModel.beneficiary_user_id = beneficiaryUserId;
        expect(testModel.beneficiary_user_id).toBe(beneficiaryUserId);
      });
    });

    it('should handle alias_name property', () => {
      const aliasNames = ['My Primary Wallet', 'Trading Account', 'Savings Wallet', 'DeFi Wallet'];

      aliasNames.forEach((aliasName) => {
        const testModel = new BlockchainBeneficiaryModel();
        testModel.alias_name = aliasName;
        expect(testModel.alias_name).toBe(aliasName);
      });
    });

    it('should handle different asset types', () => {
      const assets = ['USDT', 'USDC', 'BTC', 'ETH', 'MATIC'];

      assets.forEach((asset) => {
        const testModel = new BlockchainBeneficiaryModel();
        testModel.asset = asset;
        expect(testModel.asset).toBe(asset);
      });
    });

    it('should handle different network types', () => {
      const networks = ['ethereum', 'bitcoin', 'polygon', 'binance-smart-chain', 'tron'];

      networks.forEach((network) => {
        const testModel = new BlockchainBeneficiaryModel();
        testModel.network = network;
        expect(testModel.network).toBe(network);
      });
    });

    it('should handle different address formats', () => {
      const addressFormats = [
        { network: 'ethereum', address: '0x1234567890abcdef1234567890abcdef12345678' },
        { network: 'bitcoin', address: '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa' },
        { network: 'bitcoin', address: 'bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4' },
        { network: 'tron', address: 'TRX9K7z1x2z3y4w5v6u7t8s9r0q1p2o3n4m5' },
      ];

      addressFormats.forEach(({ network, address }) => {
        const testModel = new BlockchainBeneficiaryModel();
        testModel.network = network;
        testModel.address = address;
        expect(testModel.network).toBe(network);
        expect(testModel.address).toBe(address);
      });
    });
  });
});
