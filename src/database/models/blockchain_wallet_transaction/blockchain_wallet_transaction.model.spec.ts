import { BlockchainWalletTransactionModel } from './blockchain_wallet_transaction.model';
import { BlockchainWalletTransactionType } from './blockchain_wallet_transaction.interface';
import { TransactionStatus } from '../transaction';

describe('BlockchainWalletTransactionModel', () => {
  describe('tableName', () => {
    it('should return the correct table name', () => {
      expect(BlockchainWalletTransactionModel.tableName).toBe('api_service.blockchain_wallet_transactions');
    });
  });

  describe('publicProperty', () => {
    it('should return all public properties', () => {
      const properties = BlockchainWalletTransactionModel.publicProperty();
      expect(properties).toContain('id');
      expect(properties).toContain('blockchain_wallet_id');
      expect(properties).toContain('provider_reference');
      expect(properties).toContain('asset');
      expect(properties).toContain('amount');
      expect(properties).toContain('balance_before');
      expect(properties).toContain('balance_after');
      expect(properties).toContain('transaction_type');
      expect(properties).toContain('status');
      expect(properties).toContain('metadata');
      expect(properties).toContain('description');
      expect(properties).toContain('tx_hash');
      expect(properties).toContain('failure_reason');
      expect(properties).toContain('main_transaction_id');
      expect(properties).toContain('peer_wallet_id');
      expect(properties).toContain('peer_wallet_address');
      expect(properties).toContain('intiated_by');
      expect(properties).toContain('signed_by');
      expect(properties).toContain('network_fee');
      expect(properties).toContain('parent_id');
      expect(properties).toContain('idempotency_key');
      expect(properties).toContain('type');
      expect(properties).toContain('created_at');
      expect(properties).toContain('updated_at');
    });
  });

  describe('jsonSchema', () => {
    it('should return the validation schema', () => {
      const schema = BlockchainWalletTransactionModel.jsonSchema;
      expect(schema).toBeDefined();
      expect(schema.type).toBe('object');
      expect(schema.title).toBe('Blockchain Wallet Transaction Validation Schema');
    });
  });

  describe('relationMappings', () => {
    it('should have transaction relation', () => {
      const relations = BlockchainWalletTransactionModel.relationMappings;
      expect(relations.transaction).toBeDefined();
      expect(relations.transaction.relation).toBeDefined();
    });

    it('should have blockchain_wallet relation', () => {
      const relations = BlockchainWalletTransactionModel.relationMappings;
      expect(relations.blockchain_wallet).toBeDefined();
      expect(relations.blockchain_wallet.relation).toBeDefined();
    });
  });

  describe('modifiers', () => {
    it('should have notDeleted modifier', () => {
      const modifiers = BlockchainWalletTransactionModel.modifiers;
      expect(modifiers.notDeleted).toBeDefined();
    });

    it('should have pending modifier', () => {
      const modifiers = BlockchainWalletTransactionModel.modifiers;
      expect(modifiers.pending).toBeDefined();
    });

    it('should have processing modifier', () => {
      const modifiers = BlockchainWalletTransactionModel.modifiers;
      expect(modifiers.processing).toBeDefined();
    });

    it('should have completed modifier', () => {
      const modifiers = BlockchainWalletTransactionModel.modifiers;
      expect(modifiers.completed).toBeDefined();
    });

    it('should have failed modifier', () => {
      const modifiers = BlockchainWalletTransactionModel.modifiers;
      expect(modifiers.failed).toBeDefined();
    });

    it('should have deposits modifier', () => {
      const modifiers = BlockchainWalletTransactionModel.modifiers;
      expect(modifiers.deposits).toBeDefined();
    });

    it('should have withdrawals modifier', () => {
      const modifiers = BlockchainWalletTransactionModel.modifiers;
      expect(modifiers.withdrawals).toBeDefined();
    });

    it('should have transfersIn modifier', () => {
      const modifiers = BlockchainWalletTransactionModel.modifiers;
      expect(modifiers.transfersIn).toBeDefined();
    });

    it('should have transfersOut modifier', () => {
      const modifiers = BlockchainWalletTransactionModel.modifiers;
      expect(modifiers.transfersOut).toBeDefined();
    });

    it('should have refunds modifier', () => {
      const modifiers = BlockchainWalletTransactionModel.modifiers;
      expect(modifiers.refunds).toBeDefined();
    });

    it('should have fees modifier', () => {
      const modifiers = BlockchainWalletTransactionModel.modifiers;
      expect(modifiers.fees).toBeDefined();
    });

    it('should have exchanges modifier', () => {
      const modifiers = BlockchainWalletTransactionModel.modifiers;
      expect(modifiers.exchanges).toBeDefined();
    });

    it('should have reversals modifier', () => {
      const modifiers = BlockchainWalletTransactionModel.modifiers;
      expect(modifiers.reversals).toBeDefined();
    });

    it('should have debit modifier', () => {
      const modifiers = BlockchainWalletTransactionModel.modifiers;
      expect(modifiers.debit).toBeDefined();
    });

    it('should have credit modifier', () => {
      const modifiers = BlockchainWalletTransactionModel.modifiers;
      expect(modifiers.credit).toBeDefined();
    });
  });

  describe('model instance', () => {
    it('should create a valid instance with required fields', () => {
      const transaction = new BlockchainWalletTransactionModel();
      transaction.blockchain_wallet_id = 'wallet-123';
      transaction.asset = 'USDC';
      transaction.amount = '100.00';
      transaction.balance_before = '500.00';
      transaction.balance_after = '600.00';
      transaction.transaction_type = BlockchainWalletTransactionType.DEPOSIT;
      transaction.status = TransactionStatus.PENDING;
      transaction.type = 'credit';

      expect(transaction.blockchain_wallet_id).toBe('wallet-123');
      expect(transaction.asset).toBe('USDC');
      expect(transaction.amount).toBe('100.00');
      expect(transaction.balance_before).toBe('500.00');
      expect(transaction.balance_after).toBe('600.00');
      expect(transaction.transaction_type).toBe(BlockchainWalletTransactionType.DEPOSIT);
      expect(transaction.status).toBe(TransactionStatus.PENDING);
      expect(transaction.type).toBe('credit');
    });

    it('should create a valid instance with optional fields', () => {
      const transaction = new BlockchainWalletTransactionModel();
      transaction.blockchain_wallet_id = 'wallet-456';
      transaction.asset = 'ETH';
      transaction.amount = '0.5';
      transaction.balance_before = '2.0';
      transaction.balance_after = '1.5';
      transaction.transaction_type = BlockchainWalletTransactionType.WITHDRAWAL;
      transaction.status = TransactionStatus.COMPLETED;
      transaction.type = 'debit';
      transaction.provider_reference = 'tx-ref-789';
      transaction.metadata = { gas_price: '20000000000', gas_used: '21000' };
      transaction.description = 'Withdrawal to external wallet';
      transaction.tx_hash = '0x1234567890abcdef';
      transaction.failure_reason = 'Insufficient funds';
      transaction.main_transaction_id = 'internal-tx-123';
      transaction.peer_wallet_id = 'wallet-123';
      transaction.peer_wallet_address = '0xabcdef1234567890';
      transaction.intiated_by = 'user-123';
      transaction.signed_by = 'user-123';
      transaction.network_fee = '0.001';
      transaction.parent_id = 'parent-tx-456';
      transaction.idempotency_key = 'idemp-789';

      expect(transaction.provider_reference).toBe('tx-ref-789');
      expect(transaction.metadata).toEqual({ gas_price: '20000000000', gas_used: '21000' });
      expect(transaction.description).toBe('Withdrawal to external wallet');
      expect(transaction.tx_hash).toBe('0x1234567890abcdef');
      expect(transaction.failure_reason).toBe('Insufficient funds');
      expect(transaction.main_transaction_id).toBe('internal-tx-123');
      expect(transaction.peer_wallet_id).toBe('wallet-123');
      expect(transaction.peer_wallet_address).toBe('0xabcdef1234567890');
      expect(transaction.intiated_by).toBe('user-123');
      expect(transaction.signed_by).toBe('user-123');
      expect(transaction.network_fee).toBe('0.001');
      expect(transaction.parent_id).toBe('parent-tx-456');
      expect(transaction.idempotency_key).toBe('idemp-789');
    });

    it('should handle all transaction types', () => {
      const transactionTypes = Object.values(BlockchainWalletTransactionType);
      const transaction = new BlockchainWalletTransactionModel();

      transactionTypes.forEach((type) => {
        transaction.transaction_type = type;
        expect(transaction.transaction_type).toBe(type);
      });
    });

    it('should handle all status types', () => {
      const statusTypes = Object.values(TransactionStatus);
      const transaction = new BlockchainWalletTransactionModel();

      statusTypes.forEach((status) => {
        transaction.status = status;
        expect(transaction.status).toBe(status);
      });
    });

    it('should handle type field correctly', () => {
      const transaction = new BlockchainWalletTransactionModel();

      transaction.type = 'debit';
      expect(transaction.type).toBe('debit');

      transaction.type = 'credit';
      expect(transaction.type).toBe('credit');
    });
  });

  describe('JSON parsing and formatting', () => {
    it('should parse database JSON correctly', () => {
      const transaction = new BlockchainWalletTransactionModel();
      const jsonData = {
        id: 'tx-123',
        type: 'debit',
        blockchain_wallet_id: 'wallet-123',
        asset: 'USDC',
        amount: '100.00',
        balance_before: '500.00',
        balance_after: '400.00',
        transaction_type: BlockchainWalletTransactionType.WITHDRAWAL,
        status: TransactionStatus.COMPLETED,
      };

      const parsed = transaction.$parseDatabaseJson(jsonData);
      expect(parsed.type).toBe('debit');
      expect(parsed.id).toBe('tx-123');
    });

    it('should format database JSON correctly', () => {
      const transaction = new BlockchainWalletTransactionModel();
      transaction.type = 'credit';
      transaction.blockchain_wallet_id = 'wallet-123';
      transaction.asset = 'USDC';
      transaction.amount = '100.00';
      transaction.balance_before = '400.00';
      transaction.balance_after = '500.00';
      transaction.transaction_type = BlockchainWalletTransactionType.DEPOSIT;
      transaction.status = TransactionStatus.COMPLETED;

      const formatted = transaction.$formatDatabaseJson(transaction);
      expect(formatted.type).toBe('credit');
    });

    it('should handle type field when not present', () => {
      const transaction = new BlockchainWalletTransactionModel();
      const jsonData = {
        id: 'tx-123',
        blockchain_wallet_id: 'wallet-123',
        asset: 'USDC',
        amount: '100.00',
        balance_before: '500.00',
        balance_after: '600.00',
        transaction_type: BlockchainWalletTransactionType.DEPOSIT,
        status: TransactionStatus.PENDING,
      };

      const parsed = transaction.$parseDatabaseJson(jsonData);
      expect(parsed.type).toBeUndefined();
    });
  });

  describe('model validation', () => {
    it('should validate required fields are present', () => {
      const schema = BlockchainWalletTransactionModel.jsonSchema;

      // This would typically be validated by Objection.js
      expect(schema.required).toContain('blockchain_wallet_id');
      expect(schema.required).toContain('asset');
      expect(schema.required).toContain('amount');
      expect(schema.required).toContain('balance_before');
      expect(schema.required).toContain('balance_after');
      expect(schema.required).toContain('transaction_type');
      expect(schema.required).toContain('status');
      expect(schema.required).toContain('type');
    });

    it('should validate enum values', () => {
      const schema = BlockchainWalletTransactionModel.jsonSchema;

      // Validate transaction_type enum
      const validTransactionTypes = Object.values(BlockchainWalletTransactionType);
      const schemaTransactionTypes = (schema.properties.transaction_type as any).enum;
      expect(schemaTransactionTypes).toEqual(expect.arrayContaining(validTransactionTypes));

      // Validate status enum
      const validStatuses = Object.values(TransactionStatus);
      const schemaStatuses = (schema.properties.status as any).enum;
      expect(schemaStatuses).toEqual(expect.arrayContaining(validStatuses));

      // Validate type enum
      const validTypes = ['debit', 'credit'];
      const schemaTypes = (schema.properties.type as any).enum;
      expect(schemaTypes).toEqual(expect.arrayContaining(validTypes));
    });
  });
});
