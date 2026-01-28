import { BaseModel } from '../../base';
import { DatabaseSchema } from '../../database.schema';
import { DatabaseTables } from '../../database.table';
import { TierConfigModel } from './tierConfig.model';
import { TierConfigValidationSchema } from './tierConfig.validation';

jest.mock('../../base');

describe('TierConfigModel', () => {
  describe('tableName', () => {
    it('should return the correct table name', () => {
      expect(TierConfigModel.tableName).toBe(`${DatabaseSchema.apiService}.${DatabaseTables.tier_configs}`);
    });
  });

  describe('jsonSchema', () => {
    it('should return the tier config validation schema', () => {
      expect(TierConfigModel.jsonSchema).toBe(TierConfigValidationSchema);
    });
  });

  describe('instance properties', () => {
    let model: TierConfigModel;
    beforeEach(() => {
      model = new TierConfigModel();
      model.id = 'tier-config-1';
      model.tier_id = 'tier-1';
      model.country_id = 'country-1';
      model.minimum_balance = 0;
      model.maximum_balance = 5_000_00;
      model.minimum_per_deposit = 5;
      model.maximum_per_deposit = 500_00;
      model.maximum_daily_deposit = 1_500_00;
      model.maximum_monthly_deposit = 5_000_00;
      model.minimum_transaction_amount = 2_000_00;
      model.maximum_transaction_amount = 100_00;
      model.maximum_daily_transaction = 500_00;
      model.maximum_monthly_transaction = 2_000_00;
      model.remittance_minimum_per_deposit = 500_00;
      model.remittance_maximum_per_deposit = 500_00;
      model.remittance_maximum_daily_deposit = 500_00;
      model.remittance_maximum_monthly_deposit = 500_00;
      model.remittance_minimum_transaction_amount = 500_00;
      model.remittance_maximum_transaction_amount = 500_00;
      model.remittance_maximum_daily_transaction = 500_00;
      model.remittance_maximum_monthly_transaction = 500_00;
      model.total_spendable = 500_00;
      model.total_receivable = 500_00;
      model.created_at = new Date('2025-06-01T00:00:00Z');
      model.updated_at = new Date('2025-06-01T12:00:00Z');
      model.deleted_at = undefined;
    });
    it('should properly store the instance properties', () => {
      expect(model.id).toBe('tier-config-1');
      expect(model.tier_id).toBe('tier-1');
      expect(model.country_id).toBe('country-1');
      expect(model.minimum_balance).toBe(0);
      expect(model.maximum_balance).toBe(5_000_00);
      expect(model.minimum_per_deposit).toBe(5);
      expect(model.maximum_per_deposit).toBe(500_00);
      expect(model.maximum_daily_deposit).toBe(1_500_00);
      expect(model.maximum_monthly_deposit).toBe(5_000_00);
      expect(model.minimum_transaction_amount).toBe(2_000_00);
      expect(model.maximum_transaction_amount).toBe(100_00);
      expect(model.maximum_daily_transaction).toBe(500_00);
      expect(model.maximum_monthly_transaction).toBe(2_000_00);
      expect(model.remittance_minimum_per_deposit).toBe(500_00);
      expect(model.remittance_maximum_per_deposit).toBe(500_00);
      expect(model.remittance_maximum_daily_deposit).toBe(500_00);
      expect(model.remittance_maximum_monthly_deposit).toBe(500_00);
      expect(model.remittance_minimum_transaction_amount).toBe(500_00);
      expect(model.remittance_maximum_transaction_amount).toBe(500_00);
      expect(model.remittance_maximum_daily_transaction).toBe(500_00);
      expect(model.remittance_maximum_monthly_transaction).toBe(500_00);
      expect(model.total_spendable).toBe(500_00);
      expect(model.total_receivable).toBe(500_00);
      expect(model.created_at).toEqual(new Date('2025-06-01T00:00:00Z'));
      expect(model.updated_at).toEqual(new Date('2025-06-01T12:00:00Z'));
      expect(model.deleted_at).toBeUndefined();
    });
    it('should inherit from BaseModel', () => {
      expect(model).toBeInstanceOf(BaseModel);
    });
  });
});
