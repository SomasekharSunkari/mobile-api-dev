import { BaseModel } from '../../base';
import { DatabaseSchema } from '../../database.schema';
import { DatabaseTables } from '../../database.table';
import { TransactionStatus } from '../transaction';
import { BlockchainGasFundTransactionModel } from './blockchain_gas_fund_transaction.model';
import { IBlockchainGasFundTransaction } from './blockchain_gas_fund_transaction.interface';
import { BlockchainGasFundTransactionValidationSchema } from './blockchain_gas_fund_transaction.validation';

jest.mock('../../base');

describe('BlockchainGasFundTransactionModel', () => {
  // Reset mocks before each test
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // Static Properties Tests
  describe('tableName', () => {
    it('should return the correct table name', () => {
      expect(BlockchainGasFundTransactionModel.tableName).toBe(
        `${DatabaseSchema.apiService}.${DatabaseTables.blockchain_gas_fund_transactions}`,
      );
    });
  });

  describe('jsonSchema', () => {
    it('should return the gas fund transaction validation schema', () => {
      expect(BlockchainGasFundTransactionModel.jsonSchema).toBe(BlockchainGasFundTransactionValidationSchema);
    });
  });

  describe('publicProperty', () => {
    it('should return default public properties when no additional properties provided', () => {
      const publicProps = BlockchainGasFundTransactionModel.publicProperty();

      expect(publicProps).toContain('id');
      expect(publicProps).toContain('user_id');
      expect(publicProps).toContain('blockchain_wallet_id');
      expect(publicProps).toContain('native_asset_id');
      expect(publicProps).toContain('amount');
      expect(publicProps).toContain('status');
      expect(publicProps).toContain('provider_reference');
      expect(publicProps).toContain('tx_hash');
      expect(publicProps).toContain('failure_reason');
      expect(publicProps).toContain('network_fee');
      expect(publicProps).toContain('idempotency_key');
      expect(publicProps).toContain('metadata');
      expect(publicProps).toContain('created_at');
      expect(publicProps).toContain('updated_at');
    });

    it('should include additional properties when provided', () => {
      const additionalProps: (keyof IBlockchainGasFundTransaction)[] = ['provider_reference', 'tx_hash'];
      const publicProps = BlockchainGasFundTransactionModel.publicProperty(additionalProps);

      expect(publicProps).toContain('id');
      expect(publicProps).toContain('user_id');
      expect(publicProps).toContain('provider_reference');
      expect(publicProps).toContain('tx_hash');
    });
  });

  describe('relationMappings', () => {
    it('should define user relationship mapping', () => {
      const relationMappings = BlockchainGasFundTransactionModel.relationMappings;

      expect(relationMappings.user).toBeDefined();
      expect(relationMappings.user.relation).toBe(BaseModel.BelongsToOneRelation);
      expect(relationMappings.user.join.from).toBe(
        `${DatabaseSchema.apiService}.${DatabaseTables.blockchain_gas_fund_transactions}.user_id`,
      );
      expect(relationMappings.user.join.to).toBe(`${DatabaseSchema.apiService}.${DatabaseTables.users}.id`);
    });

    it('should define blockchain_wallet relationship mapping', () => {
      const relationMappings = BlockchainGasFundTransactionModel.relationMappings;

      expect(relationMappings.blockchain_wallet).toBeDefined();
      expect(relationMappings.blockchain_wallet.relation).toBe(BaseModel.BelongsToOneRelation);
      expect(relationMappings.blockchain_wallet.join.from).toBe(
        `${DatabaseSchema.apiService}.${DatabaseTables.blockchain_gas_fund_transactions}.blockchain_wallet_id`,
      );
      expect(relationMappings.blockchain_wallet.join.to).toBe(
        `${DatabaseSchema.apiService}.${DatabaseTables.blockchain_wallets}.id`,
      );
    });
  });

  describe('modifiers', () => {
    it('should define notDeleted modifier', () => {
      const modifiers = BlockchainGasFundTransactionModel.modifiers;

      expect(modifiers.notDeleted).toBeDefined();
      expect(typeof modifiers.notDeleted).toBe('function');
    });

    it('should define pending modifier', () => {
      const modifiers = BlockchainGasFundTransactionModel.modifiers;

      expect(modifiers.pending).toBeDefined();
      expect(typeof modifiers.pending).toBe('function');
    });

    it('should define completed modifier', () => {
      const modifiers = BlockchainGasFundTransactionModel.modifiers;

      expect(modifiers.completed).toBeDefined();
      expect(typeof modifiers.completed).toBe('function');
    });

    it('should define failed modifier', () => {
      const modifiers = BlockchainGasFundTransactionModel.modifiers;

      expect(modifiers.failed).toBeDefined();
      expect(typeof modifiers.failed).toBe('function');
    });

    it('should define forUser modifier', () => {
      const modifiers = BlockchainGasFundTransactionModel.modifiers;

      expect(modifiers.forUser).toBeDefined();
      expect(typeof modifiers.forUser).toBe('function');
    });

    it('should define forWallet modifier', () => {
      const modifiers = BlockchainGasFundTransactionModel.modifiers;

      expect(modifiers.forWallet).toBeDefined();
      expect(typeof modifiers.forWallet).toBe('function');
    });
  });

  // Instance Properties Tests
  describe('instance properties', () => {
    let gasFundTransactionModel: BlockchainGasFundTransactionModel;

    beforeEach(() => {
      gasFundTransactionModel = new BlockchainGasFundTransactionModel();
      gasFundTransactionModel.id = 'gas-fund-tx-123';
      gasFundTransactionModel.user_id = 'user-123';
      gasFundTransactionModel.blockchain_wallet_id = 'wallet-123';
      gasFundTransactionModel.native_asset_id = 'ETH_TEST5';
      gasFundTransactionModel.amount = '0.02';
      gasFundTransactionModel.status = TransactionStatus.PENDING;
      gasFundTransactionModel.provider_reference = 'provider-ref-123';
      gasFundTransactionModel.tx_hash = '0x123456789';
      gasFundTransactionModel.failure_reason = null;
      gasFundTransactionModel.network_fee = '0.001';
      gasFundTransactionModel.idempotency_key = 'idempotency-key-123';
      gasFundTransactionModel.metadata = { source: 'gas_station', network: 'ethereum' };
      gasFundTransactionModel.created_at = new Date('2024-01-15T10:30:00Z');
      gasFundTransactionModel.updated_at = new Date('2024-01-15T10:30:00Z');
    });

    it('should properly store the required instance properties', () => {
      expect(gasFundTransactionModel.id).toBe('gas-fund-tx-123');
      expect(gasFundTransactionModel.user_id).toBe('user-123');
      expect(gasFundTransactionModel.blockchain_wallet_id).toBe('wallet-123');
      expect(gasFundTransactionModel.native_asset_id).toBe('ETH_TEST5');
      expect(gasFundTransactionModel.amount).toBe('0.02');
      expect(gasFundTransactionModel.status).toBe(TransactionStatus.PENDING);
    });

    it('should properly store the optional instance properties', () => {
      expect(gasFundTransactionModel.provider_reference).toBe('provider-ref-123');
      expect(gasFundTransactionModel.tx_hash).toBe('0x123456789');
      expect(gasFundTransactionModel.failure_reason).toBeNull();
      expect(gasFundTransactionModel.network_fee).toBe('0.001');
      expect(gasFundTransactionModel.idempotency_key).toBe('idempotency-key-123');
      expect(gasFundTransactionModel.metadata).toEqual({ source: 'gas_station', network: 'ethereum' });
    });

    it('should properly store timestamp properties', () => {
      expect(gasFundTransactionModel.created_at).toEqual(new Date('2024-01-15T10:30:00Z'));
      expect(gasFundTransactionModel.updated_at).toEqual(new Date('2024-01-15T10:30:00Z'));
    });

    it('should inherit from BaseModel', () => {
      expect(gasFundTransactionModel).toBeInstanceOf(BaseModel);
    });

    it('should handle null optional properties', () => {
      const modelWithNulls = new BlockchainGasFundTransactionModel();
      modelWithNulls.id = 'gas-fund-tx-456';
      modelWithNulls.user_id = 'user-456';
      modelWithNulls.blockchain_wallet_id = 'wallet-456';
      modelWithNulls.native_asset_id = 'ETH_TEST5';
      modelWithNulls.amount = '0.01';
      modelWithNulls.status = TransactionStatus.COMPLETED;
      modelWithNulls.provider_reference = null;
      modelWithNulls.tx_hash = null;
      modelWithNulls.failure_reason = null;
      modelWithNulls.network_fee = null;
      modelWithNulls.idempotency_key = null;
      modelWithNulls.metadata = null;

      expect(modelWithNulls.provider_reference).toBeNull();
      expect(modelWithNulls.tx_hash).toBeNull();
      expect(modelWithNulls.failure_reason).toBeNull();
      expect(modelWithNulls.network_fee).toBeNull();
      expect(modelWithNulls.idempotency_key).toBeNull();
      expect(modelWithNulls.metadata).toBeNull();
    });
  });

  // Status Values Tests
  describe('TransactionStatus integration', () => {
    it('should work with all TransactionStatus values', () => {
      const model = new BlockchainGasFundTransactionModel();

      model.status = TransactionStatus.PENDING;
      expect(model.status).toBe(TransactionStatus.PENDING);

      model.status = TransactionStatus.INITIATED;
      expect(model.status).toBe(TransactionStatus.INITIATED);

      model.status = TransactionStatus.PROCESSING;
      expect(model.status).toBe(TransactionStatus.PROCESSING);

      model.status = TransactionStatus.COMPLETED;
      expect(model.status).toBe(TransactionStatus.COMPLETED);

      model.status = TransactionStatus.FAILED;
      expect(model.status).toBe(TransactionStatus.FAILED);

      model.status = TransactionStatus.CANCELLED;
      expect(model.status).toBe(TransactionStatus.CANCELLED);
    });
  });

  // Model Interface Compliance
  describe('IBlockchainGasFundTransaction interface compliance', () => {
    it('should implement all required interface properties', () => {
      const model = new BlockchainGasFundTransactionModel();

      // Required properties should be assignable
      model.user_id = 'user-123';
      model.blockchain_wallet_id = 'wallet-123';
      model.native_asset_id = 'ETH_TEST5';
      model.amount = '0.02';
      model.status = TransactionStatus.PENDING;

      // Optional properties should be assignable
      model.provider_reference = 'provider-ref-123';
      model.tx_hash = '0x123456789';
      model.failure_reason = 'Insufficient gas';
      model.network_fee = '0.001';
      model.idempotency_key = 'idempotency-key-123';
      model.metadata = { source: 'gas_station' };

      expect(model.user_id).toBe('user-123');
      expect(model.blockchain_wallet_id).toBe('wallet-123');
      expect(model.native_asset_id).toBe('ETH_TEST5');
      expect(model.amount).toBe('0.02');
      expect(model.status).toBe(TransactionStatus.PENDING);
      expect(model.provider_reference).toBe('provider-ref-123');
      expect(model.tx_hash).toBe('0x123456789');
      expect(model.failure_reason).toBe('Insufficient gas');
      expect(model.network_fee).toBe('0.001');
      expect(model.idempotency_key).toBe('idempotency-key-123');
      expect(model.metadata).toEqual({ source: 'gas_station' });
    });
  });
});
