import { BaseModel } from '../../base';
import { BlockchainWalletKeyModel } from './blockchain_wallet_key.model';
import { BlockchainWalletKeyValidationSchema } from './blockchain_wallet_key.validation';

jest.mock('../../base');

describe('BlockchainWalletKey', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('BlockchainWalletKeyValidationSchema', () => {
    it('should have the correct title', () => {
      expect(BlockchainWalletKeyValidationSchema.title).toBe('Blockchain Wallet Key Validation Schema');
    });

    it('should be of type object', () => {
      expect(BlockchainWalletKeyValidationSchema.type).toBe('object');
    });

    it('should require specific fields', () => {
      const requiredFields = BlockchainWalletKeyValidationSchema.required as string[];
      expect(requiredFields).toContain('blockchain_wallet_id');
      expect(requiredFields).toContain('encrypted_private_key');
      expect(requiredFields).toContain('encryption_iv');
      expect(requiredFields).toContain('network');
      expect(requiredFields).toContain('key_index');
    });

    describe('properties', () => {
      const properties = BlockchainWalletKeyValidationSchema.properties as Record<string, any>;

      it('should have blockchain_wallet_id as string', () => {
        expect(properties.blockchain_wallet_id.type).toBe('string');
      });

      it('should have encrypted_private_key as string', () => {
        expect(properties.encrypted_private_key.type).toBe('string');
      });

      it('should have encryption_iv as string', () => {
        expect(properties.encryption_iv.type).toBe('string');
      });

      it('should have network as string', () => {
        expect(properties.network.type).toBe('string');
      });

      it('should have public_key as string or null', () => {
        expect(properties.public_key.type).toEqual(['string', 'null']);
      });

      it('should have key_index as number with minimum 0', () => {
        expect(properties.key_index.type).toBe('number');
        expect(properties.key_index.minimum).toBe(0);
      });
    });
  });

  describe('BlockchainWalletKeyModel', () => {
    describe('tableName', () => {
      it('should return the correct table name', () => {
        expect(BlockchainWalletKeyModel.tableName).toBe('api_service.blockchain_wallet_keys');
      });
    });

    describe('jsonSchema', () => {
      it('should return the validation schema', () => {
        const schema = BlockchainWalletKeyModel.jsonSchema;
        expect(schema).toBeDefined();
        expect(schema.type).toBe('object');
        expect(schema.title).toBe('Blockchain Wallet Key Validation Schema');
      });
    });

    describe('publicProperty', () => {
      it('should return all public properties', () => {
        const properties = BlockchainWalletKeyModel.publicProperty();
        expect(properties).toContain('id');
        expect(properties).toContain('blockchain_wallet_id');
        expect(properties).toContain('network');
        expect(properties).toContain('public_key');
        expect(properties).toContain('key_index');
        expect(properties).toContain('created_at');
        expect(properties).toContain('updated_at');
      });
    });

    describe('relationMappings', () => {
      beforeEach(() => {
        BaseModel.BelongsToOneRelation = 'BelongsToOneRelation' as any;
      });

      it('should have blockchain_wallet relation', () => {
        const relations = BlockchainWalletKeyModel.relationMappings;
        expect(relations.blockchain_wallet).toBeDefined();
        expect(relations.blockchain_wallet.relation).toBe('BelongsToOneRelation');
      });
    });

    describe('modifiers', () => {
      it('should have notDeleted modifier', () => {
        const modifiers = BlockchainWalletKeyModel.modifiers;
        expect(modifiers.notDeleted).toBeDefined();
      });

      it('should have forWallet modifier', () => {
        const modifiers = BlockchainWalletKeyModel.modifiers;
        expect(modifiers.forWallet).toBeDefined();
      });

      it('should have forNetwork modifier', () => {
        const modifiers = BlockchainWalletKeyModel.modifiers;
        expect(modifiers.forNetwork).toBeDefined();
      });
    });

    describe('instance properties', () => {
      it('should have all required properties', () => {
        const walletKey = new BlockchainWalletKeyModel();
        walletKey.blockchain_wallet_id = 'wallet-123';
        walletKey.encrypted_private_key = 'encrypted-key';
        walletKey.encryption_iv = 'encryption-iv';
        walletKey.network = 'ethereum';
        walletKey.public_key = 'public-key';
        walletKey.key_index = 0;

        expect(walletKey.blockchain_wallet_id).toBe('wallet-123');
        expect(walletKey.encrypted_private_key).toBe('encrypted-key');
        expect(walletKey.encryption_iv).toBe('encryption-iv');
        expect(walletKey.network).toBe('ethereum');
        expect(walletKey.public_key).toBe('public-key');
        expect(walletKey.key_index).toBe(0);
      });
    });
  });
});
