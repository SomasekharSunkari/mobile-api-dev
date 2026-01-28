import { BaseModel } from '../../base';
import { BlockchainWalletStatus, BlockchainWalletProvider, BlockchainWalletRails } from './blockchain_wallet.interface';
import { BlockchainWalletModel } from './blockchain_wallet.model';
import { BlockchainWalletValidationSchema } from './blockchain_wallet.validation';

jest.mock('../../base');

describe('BlockchainWallet', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('BlockchainWalletStatus', () => {
    it('should define the correct status values', () => {
      expect(BlockchainWalletStatus.ACTIVE).toBe('active');
      expect(BlockchainWalletStatus.INACTIVE).toBe('inactive');
      expect(BlockchainWalletStatus.FROZEN).toBe('frozen');
      expect(BlockchainWalletStatus.CLOSED).toBe('closed');
    });
    it('should have exactly four status types', () => {
      const statusValues = Object.values(BlockchainWalletStatus);
      expect(statusValues.length).toBe(4);
      expect(statusValues).toEqual(['active', 'inactive', 'frozen', 'closed']);
    });
  });

  describe('BlockchainWalletProvider', () => {
    it('should define the correct provider values', () => {
      expect(BlockchainWalletProvider.FIREBLOCKS).toBe('fireblocks');
    });
    it('should have at least one provider type', () => {
      const providerValues = Object.values(BlockchainWalletProvider);
      expect(providerValues.length).toBeGreaterThanOrEqual(1);
      expect(providerValues).toContain('fireblocks');
    });
  });

  describe('BlockchainWalletValidationSchema', () => {
    it('should have the correct title', () => {
      expect(BlockchainWalletValidationSchema.title).toBe('Blockchain Wallet Validation Schema');
    });
    it('should be of type object', () => {
      expect(BlockchainWalletValidationSchema.type).toBe('object');
    });
    it('should require specific fields', () => {
      const requiredFields = BlockchainWalletValidationSchema.required as string[];
      expect(requiredFields).toContain('user_id');
      expect(requiredFields).toContain('provider_account_ref');
      expect(requiredFields).toContain('provider');
      expect(requiredFields).toContain('asset');
      expect(requiredFields).toContain('base_asset');
      expect(requiredFields).toContain('address');
      expect(requiredFields).toContain('status');
    });
    describe('properties', () => {
      const properties = BlockchainWalletValidationSchema.properties as Record<string, any>;
      it('should have user_id as string', () => {
        expect(properties.user_id.type).toBe('string');
      });
      it('should have provider_account_ref as string', () => {
        expect(properties.provider_account_ref.type).toBe('string');
      });
      it('should have provider as string with valid enum values', () => {
        expect(properties.provider.type).toBe('string');
        expect(properties.provider.enum).toEqual(Object.values(BlockchainWalletProvider));
      });
      it('should have asset as string', () => {
        expect(properties.asset.type).toBe('string');
      });
      it('should have base_asset as string', () => {
        expect(properties.base_asset.type).toBe('string');
      });
      it('should have address as string', () => {
        expect(properties.address.type).toBe('string');
      });
      it('should have balance as string', () => {
        expect(properties.balance.type).toBe('string');
      });
      it('should have status as string with valid enum values', () => {
        expect(properties.status.type).toBe('string');
        expect(properties.status.enum).toEqual(Object.values(BlockchainWalletStatus));
      });
    });
  });

  describe('BlockchainWalletModel', () => {
    describe('tableName', () => {
      it('should return the correct table name', () => {
        expect(BlockchainWalletModel.tableName).toBe('api_service.blockchain_wallets');
      });
    });

    describe('jsonSchema', () => {
      it('should return the validation schema', () => {
        const schema = BlockchainWalletModel.jsonSchema;
        expect(schema).toBeDefined();
        expect(schema.type).toBe('object');
        expect(schema.title).toBe('Blockchain Wallet Validation Schema');
      });
    });

    describe('publicProperty', () => {
      it('should return all public properties', () => {
        const properties = BlockchainWalletModel.publicProperty();
        expect(properties).toContain('id');
        expect(properties).toContain('user_id');
        expect(properties).toContain('provider_account_ref');
        expect(properties).toContain('provider');
        expect(properties).toContain('asset');
        expect(properties).toContain('base_asset');
        expect(properties).toContain('address');
        expect(properties).toContain('balance');
        expect(properties).toContain('name');
        expect(properties).toContain('status');
        expect(properties).toContain('network');
        expect(properties).toContain('rails');
        expect(properties).toContain('decimal');
        expect(properties).toContain('created_at');
        expect(properties).toContain('updated_at');
      });
    });
    describe('relationMappings', () => {
      beforeEach(() => {
        BaseModel.BelongsToOneRelation = 'BelongsToOneRelation' as any;
      });
      it('should have user relation', () => {
        const relations = BlockchainWalletModel.relationMappings;
        expect(relations.user).toBeDefined();
        expect(relations.user.relation).toBe('BelongsToOneRelation');
      });
    });
    describe('modifiers', () => {
      it('should have notDeleted modifier', () => {
        const modifiers = BlockchainWalletModel.modifiers;
        expect(modifiers.notDeleted).toBeDefined();
      });

      it('should have active modifier', () => {
        const modifiers = BlockchainWalletModel.modifiers;
        expect(modifiers.active).toBeDefined();
      });

      it('should have forUser modifier', () => {
        const modifiers = BlockchainWalletModel.modifiers;
        expect(modifiers.forUser).toBeDefined();
      });

      it('should have remittance modifier', () => {
        const modifiers = BlockchainWalletModel.modifiers;
        expect(modifiers.remittance).toBeDefined();
      });

      it('should have crypto modifier', () => {
        const modifiers = BlockchainWalletModel.modifiers;
        expect(modifiers.crypto).toBeDefined();
      });
    });
    describe('instance properties', () => {
      it('should have all required properties', () => {
        const wallet = new BlockchainWalletModel();
        wallet.user_id = 'user-123';
        wallet.provider_account_ref = 'account-ref-123';
        wallet.provider = BlockchainWalletProvider.FIREBLOCKS;
        wallet.asset = 'USDC';
        wallet.base_asset = 'USD';
        wallet.address = '0x1234567890abcdef';
        wallet.balance = '100.50';
        wallet.name = 'USDC Wallet';
        wallet.status = BlockchainWalletStatus.ACTIVE;
        wallet.network = 'ethereum';
        wallet.rails = BlockchainWalletRails.REMITTANCE;
        wallet.decimal = 6;

        expect(wallet.user_id).toBe('user-123');
        expect(wallet.provider_account_ref).toBe('account-ref-123');
        expect(wallet.provider).toBe(BlockchainWalletProvider.FIREBLOCKS);
        expect(wallet.asset).toBe('USDC');
        expect(wallet.base_asset).toBe('USD');
        expect(wallet.address).toBe('0x1234567890abcdef');
        expect(wallet.balance).toBe('100.50');
        expect(wallet.name).toBe('USDC Wallet');
        expect(wallet.status).toBe(BlockchainWalletStatus.ACTIVE);
        expect(wallet.network).toBe('ethereum');
        expect(wallet.rails).toBe(BlockchainWalletRails.REMITTANCE);
        expect(wallet.decimal).toBe(6);
      });
    });
  });
});
