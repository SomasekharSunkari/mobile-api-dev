import { BlockchainAccountModel } from './blockchain_account.model';
import { BlockchainAccountStatus, BlockchainAccountProvider } from './blockchain_account.interface';

describe('BlockchainAccountModel', () => {
  describe('tableName', () => {
    it('should return the correct table name', () => {
      expect(BlockchainAccountModel.tableName).toBe('api_service.blockchain_accounts');
    });
  });

  describe('publicProperty', () => {
    it('should return all public properties', () => {
      const properties = BlockchainAccountModel.publicProperty();
      expect(properties).toContain('id');
      expect(properties).toContain('user_id');
      expect(properties).toContain('provider');
      expect(properties).toContain('provider_ref');
      expect(properties).toContain('status');
      expect(properties).toContain('created_at');
      expect(properties).toContain('updated_at');
    });
  });

  describe('jsonSchema', () => {
    it('should have required fields', () => {
      const schema = BlockchainAccountModel.jsonSchema;
      expect(schema.required).toContain('user_id');
      expect(schema.required).toContain('provider');
      expect(schema.required).toContain('provider_ref');
      expect(schema.required).toContain('status');
    });

    it('should validate provider enum', () => {
      const schema = BlockchainAccountModel.jsonSchema;
      expect((schema.properties.provider as any).enum).toContain(BlockchainAccountProvider.FIREBLOCKS);
    });

    it('should validate status enum', () => {
      const schema = BlockchainAccountModel.jsonSchema;
      expect((schema.properties.status as any).enum).toContain(BlockchainAccountStatus.ACTIVE);
      expect((schema.properties.status as any).enum).toContain(BlockchainAccountStatus.INACTIVE);
      expect((schema.properties.status as any).enum).toContain(BlockchainAccountStatus.FROZEN);
      expect((schema.properties.status as any).enum).toContain(BlockchainAccountStatus.CLOSED);
    });
  });

  describe('relationMappings', () => {
    it('should have user relation', () => {
      const relations = BlockchainAccountModel.relationMappings;
      expect(relations.user).toBeDefined();
      expect(typeof relations.user.relation).toBe('function');
    });

    it('should have blockchain_wallets relation', () => {
      const relations = BlockchainAccountModel.relationMappings;
      expect(relations.blockchain_wallets).toBeDefined();
      expect(typeof relations.blockchain_wallets.relation).toBe('function');
    });
  });

  describe('modifiers', () => {
    it('should have notDeleted modifier', () => {
      const modifiers = BlockchainAccountModel.modifiers;
      expect(modifiers.notDeleted).toBeDefined();
    });

    it('should have active modifier', () => {
      const modifiers = BlockchainAccountModel.modifiers;
      expect(modifiers.active).toBeDefined();
    });

    it('should have forUser modifier', () => {
      const modifiers = BlockchainAccountModel.modifiers;
      expect(modifiers.forUser).toBeDefined();
    });

    it('should have forProvider modifier', () => {
      const modifiers = BlockchainAccountModel.modifiers;
      expect(modifiers.forProvider).toBeDefined();
    });
  });

  describe('model instance', () => {
    it('should create a valid instance', () => {
      const account = new BlockchainAccountModel();
      account.user_id = 'user-123';
      account.provider = BlockchainAccountProvider.FIREBLOCKS;
      account.provider_ref = 'acc-456';
      account.status = BlockchainAccountStatus.ACTIVE;

      expect(account.user_id).toBe('user-123');
      expect(account.provider).toBe(BlockchainAccountProvider.FIREBLOCKS);
      expect(account.provider_ref).toBe('acc-456');
      expect(account.status).toBe(BlockchainAccountStatus.ACTIVE);
    });
  });
});
