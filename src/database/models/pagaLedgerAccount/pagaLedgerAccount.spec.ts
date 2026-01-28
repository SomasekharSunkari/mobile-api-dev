import { BaseModel } from '../../base';
import { DatabaseSchema } from '../../database.schema';
import { DatabaseTables } from '../../database.table';
import { PagaLedgerAccountModel } from './pagaLedgerAccount.model';
import { PagaLedgerAccountValidationSchema } from './pagaLedgerAccount.validation';

jest.mock('../../base');

describe('PagaLedgerAccountModel', () => {
  describe('tableName', () => {
    it('should return the correct table name', () => {
      expect(PagaLedgerAccountModel.tableName).toBe(
        `${DatabaseSchema.apiService}.${DatabaseTables.paga_ledger_accounts}`,
      );
    });
  });

  describe('jsonSchema', () => {
    it('should return the paga ledger account validation schema', () => {
      expect(PagaLedgerAccountModel.jsonSchema).toBe(PagaLedgerAccountValidationSchema);
    });
  });

  describe('instance properties', () => {
    let pagaLedgerAccountModel: PagaLedgerAccountModel;
    beforeEach(() => {
      pagaLedgerAccountModel = new PagaLedgerAccountModel();
      pagaLedgerAccountModel.email = 'test@example.com';
      pagaLedgerAccountModel.phone_number = '1234567890';
      pagaLedgerAccountModel.account_number = '1234567890';
      pagaLedgerAccountModel.account_name = 'John Doe';
      pagaLedgerAccountModel.available_balance = 1000;
    });
    it('should properly store the instance properties', () => {
      expect(pagaLedgerAccountModel.email).toBe('test@example.com');
      expect(pagaLedgerAccountModel.phone_number).toBe('1234567890');
      expect(pagaLedgerAccountModel.account_number).toBe('1234567890');
      expect(pagaLedgerAccountModel.account_name).toBe('John Doe');
      expect(pagaLedgerAccountModel.available_balance).toBe(1000);
    });
    it('should inherit from BaseModel', () => {
      expect(pagaLedgerAccountModel).toBeInstanceOf(BaseModel);
    });
  });
});
