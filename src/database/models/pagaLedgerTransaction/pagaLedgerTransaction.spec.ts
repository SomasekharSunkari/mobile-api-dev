import { BaseModel } from '../../base';
import { DatabaseSchema } from '../../database.schema';
import { DatabaseTables } from '../../database.table';
import { PagaLedgerTransactionModel } from './pagaLedgerTransaction.model';
import { PagaLedgerTransactionValidationSchema } from './pagaLedgerTransaction.validation';

jest.mock('../../base');

describe('PagaLedgerTransactionModel', () => {
  describe('tableName', () => {
    it('should return the correct table name', () => {
      expect(PagaLedgerTransactionModel.tableName).toBe(
        `${DatabaseSchema.apiService}.${DatabaseTables.paga_ledger_transactions}`,
      );
    });
  });

  describe('jsonSchema', () => {
    it('should return the paga ledger transaction validation schema', () => {
      expect(PagaLedgerTransactionModel.jsonSchema).toBe(PagaLedgerTransactionValidationSchema);
    });
  });

  describe('instance properties', () => {
    let pagaLedgerTransactionModel: PagaLedgerTransactionModel;
    beforeEach(() => {
      pagaLedgerTransactionModel = new PagaLedgerTransactionModel();
      pagaLedgerTransactionModel.account_number = '1234567890';
      pagaLedgerTransactionModel.amount = 1000;
      pagaLedgerTransactionModel.status = 'SUCCESSFUL';
      pagaLedgerTransactionModel.reference_number = 'ref123';
      pagaLedgerTransactionModel.transaction_reference = 'txnref123';
      pagaLedgerTransactionModel.balance_before = 500;
      pagaLedgerTransactionModel.balance_after = 1500;
      pagaLedgerTransactionModel.transaction_type = 'CREDIT';
      pagaLedgerTransactionModel.currency = 'NGN';
      pagaLedgerTransactionModel.date_utc = 1710000000;
      pagaLedgerTransactionModel.description = 'Test transaction';
      pagaLedgerTransactionModel.transaction_id = 'txn123';
      pagaLedgerTransactionModel.source_account_name = 'John Doe';
      pagaLedgerTransactionModel.source_account_organization_name = 'Test Org';
      pagaLedgerTransactionModel.tax = 10;
      pagaLedgerTransactionModel.fee = 5;
      pagaLedgerTransactionModel.transaction_channel = 'WEB';
      pagaLedgerTransactionModel.reversal_id = null;
    });
    it('should properly store the instance properties', () => {
      expect(pagaLedgerTransactionModel.account_number).toBe('1234567890');
      expect(pagaLedgerTransactionModel.amount).toBe(1000);
      expect(pagaLedgerTransactionModel.status).toBe('SUCCESSFUL');
      expect(pagaLedgerTransactionModel.reference_number).toBe('ref123');
      expect(pagaLedgerTransactionModel.transaction_reference).toBe('txnref123');
      expect(pagaLedgerTransactionModel.balance_before).toBe(500);
      expect(pagaLedgerTransactionModel.balance_after).toBe(1500);
      expect(pagaLedgerTransactionModel.transaction_type).toBe('CREDIT');
      expect(pagaLedgerTransactionModel.currency).toBe('NGN');
      expect(pagaLedgerTransactionModel.date_utc).toBe(1710000000);
      expect(pagaLedgerTransactionModel.description).toBe('Test transaction');
      expect(pagaLedgerTransactionModel.transaction_id).toBe('txn123');
      expect(pagaLedgerTransactionModel.source_account_name).toBe('John Doe');
      expect(pagaLedgerTransactionModel.source_account_organization_name).toBe('Test Org');
      expect(pagaLedgerTransactionModel.tax).toBe(10);
      expect(pagaLedgerTransactionModel.fee).toBe(5);
      expect(pagaLedgerTransactionModel.transaction_channel).toBe('WEB');
      expect(pagaLedgerTransactionModel.reversal_id).toBeNull();
    });
    it('should inherit from BaseModel', () => {
      expect(pagaLedgerTransactionModel).toBeInstanceOf(BaseModel);
    });
  });
});
