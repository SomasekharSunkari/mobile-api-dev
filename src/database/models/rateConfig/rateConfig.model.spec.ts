import { DatabaseSchema } from '../../database.schema';
import { DatabaseTables } from '../../database.table';
import { IRateConfigConfig } from './rateConfig.interface';
import { RateConfigModel } from './rateConfig.model';
import { RateConfigValidationSchema } from './rateConfig.validation';

describe('RateConfigModel', () => {
  describe('tableName', () => {
    it('should return the correct table name with schema', () => {
      const expectedTableName = `${DatabaseSchema.apiService}.${DatabaseTables.rate_configs}`;
      expect(RateConfigModel.tableName).toBe(expectedTableName);
    });
  });

  describe('publicProperty', () => {
    it('should return default public properties when no additional properties provided', () => {
      const result = RateConfigModel.publicProperty();

      expect(result).toContain('id');
      expect(result).toContain('provider');
      expect(result).toContain('config');
      expect(result).toContain('description');
      expect(result).toContain('created_at');
      expect(result).toContain('updated_at');
    });

    it('should include additional properties when provided', () => {
      const additionalProperties = ['custom_field' as any];
      const result = RateConfigModel.publicProperty(additionalProperties);

      expect(result).toContain('id');
      expect(result).toContain('provider');
      expect(result).toContain('custom_field');
    });

    it('should return 6 default properties', () => {
      const result = RateConfigModel.publicProperty();
      expect(result.length).toBe(6);
    });

    it('should include additional properties at the end of the array', () => {
      const additionalProperties = ['new_property' as any];
      const result = RateConfigModel.publicProperty(additionalProperties);

      expect(result[result.length - 1]).toBe('new_property');
    });
  });

  describe('jsonSchema', () => {
    it('should return the RateConfigValidationSchema', () => {
      expect(RateConfigModel.jsonSchema).toBe(RateConfigValidationSchema);
    });

    it('should have provider and config as required fields', () => {
      const schema = RateConfigModel.jsonSchema;
      expect(schema.required).toContain('provider');
      expect(schema.required).toContain('config');
    });

    it('should have correct type for properties', () => {
      const schema = RateConfigModel.jsonSchema;
      const properties = schema.properties as any;
      expect(properties.provider.type).toBe('string');
      expect(properties.config.type).toBe('object');
      expect(properties.description.type).toContain('string');
    });

    it('should have correct config schema structure', () => {
      const schema = RateConfigModel.jsonSchema;
      const configSchema = (schema.properties as any).config;
      expect(configSchema.required).toContain('is_active');
      expect(configSchema.properties.fiat_exchange).toBeDefined();
      expect(configSchema.properties.is_active.type).toBe('boolean');
    });
  });

  describe('modifiers', () => {
    it('should have notDeleted modifier', () => {
      expect(RateConfigModel.modifiers.notDeleted).toBeDefined();
      expect(typeof RateConfigModel.modifiers.notDeleted).toBe('function');
    });

    it('should have active modifier', () => {
      expect(RateConfigModel.modifiers.active).toBeDefined();
      expect(typeof RateConfigModel.modifiers.active).toBe('function');
    });

    it('notDeleted modifier should add whereNull clause for deleted_at', () => {
      const mockQuery = {
        whereNull: jest.fn(),
      };

      RateConfigModel.modifiers.notDeleted(mockQuery);

      expect(mockQuery.whereNull).toHaveBeenCalledWith('deleted_at');
    });

    it('active modifier should add whereRaw clause for config is_active', () => {
      const mockQuery = {
        whereRaw: jest.fn(),
      };

      RateConfigModel.modifiers.active(mockQuery);

      expect(mockQuery.whereRaw).toHaveBeenCalledWith("(config->>'is_active')::boolean = true");
    });
  });

  describe('model properties', () => {
    it('should be able to set and get all required properties', () => {
      const model = new RateConfigModel();
      const config: IRateConfigConfig = {
        fiat_exchange: {
          service_fee: { value: 100, currency: 'USD', is_percentage: true },
          partner_fee: { value: 200, currency: 'USD', is_percentage: false },
          disbursement_fee: { value: 50, currency: 'USD', is_percentage: true },
          ngn_withdrawal_fee: { value: 150, is_percentage: true, cap: 500 },
        },
        is_active: true,
      };

      model.provider = 'yellowcard';
      model.config = config;
      model.description = 'Test config';

      expect(model.provider).toBe('yellowcard');
      expect(model.config).toEqual(config);
      expect(model.description).toBe('Test config');
    });

    it('should be instance of RateConfigModel', () => {
      const model = new RateConfigModel();
      expect(model).toBeInstanceOf(RateConfigModel);
    });
  });

  describe('helper getters', () => {
    let model: RateConfigModel;
    const mockConfig: IRateConfigConfig = {
      fiat_exchange: {
        service_fee: { value: 100, currency: 'USD', is_percentage: true },
        partner_fee: { value: 200, currency: 'NGN', is_percentage: false },
        disbursement_fee: { value: 50, currency: 'USD', is_percentage: true },
        ngn_withdrawal_fee: { value: 150, is_percentage: true, cap: 500 },
      },
      is_active: true,
    };

    beforeEach(() => {
      model = new RateConfigModel();
      model.config = mockConfig;
    });

    describe('isActive', () => {
      it('should return true when config.is_active is true', () => {
        expect(model.isActive).toBe(true);
      });

      it('should return false when config.is_active is false', () => {
        model.config = { ...mockConfig, is_active: false };
        expect(model.isActive).toBe(false);
      });

      it('should return false when config is undefined', () => {
        model.config = undefined as any;
        expect(model.isActive).toBe(false);
      });
    });

    describe('fiatExchange', () => {
      it('should return fiat_exchange config', () => {
        expect(model.fiatExchange).toEqual(mockConfig.fiat_exchange);
      });

      it('should return undefined when fiat_exchange is not set', () => {
        model.config = { is_active: true };
        expect(model.fiatExchange).toBeUndefined();
      });
    });

    describe('ngnWithdrawalFee', () => {
      it('should return ngn_withdrawal_fee config', () => {
        expect(model.ngnWithdrawalFee).toEqual(mockConfig.fiat_exchange?.ngn_withdrawal_fee);
      });

      it('should return undefined when fiat_exchange is not set', () => {
        model.config = { is_active: true };
        expect(model.ngnWithdrawalFee).toBeUndefined();
      });
    });

    describe('getFiatExchangeFee', () => {
      it('should return service_fee config', () => {
        const fee = model.getFiatExchangeFee('service_fee');
        expect(fee).toEqual(mockConfig.fiat_exchange?.service_fee);
      });

      it('should return partner_fee config', () => {
        const fee = model.getFiatExchangeFee('partner_fee');
        expect(fee).toEqual(mockConfig.fiat_exchange?.partner_fee);
      });

      it('should return disbursement_fee config', () => {
        const fee = model.getFiatExchangeFee('disbursement_fee');
        expect(fee).toEqual(mockConfig.fiat_exchange?.disbursement_fee);
      });

      it('should return undefined when fiat_exchange is not set', () => {
        model.config = { is_active: true };
        expect(model.getFiatExchangeFee('service_fee')).toBeUndefined();
      });
    });
  });

  describe('createDefaultConfig', () => {
    it('should create default config with all zero values', () => {
      const config = RateConfigModel.createDefaultConfig();

      expect(config.is_active).toBe(true);
      expect(config.fiat_exchange?.service_fee).toEqual({ value: 0, is_percentage: false });
      expect(config.fiat_exchange?.partner_fee).toEqual({ value: 0, is_percentage: false });
      expect(config.fiat_exchange?.disbursement_fee).toEqual({ value: 0, is_percentage: false });
      expect(config.fiat_exchange?.ngn_withdrawal_fee).toEqual({ value: 0, is_percentage: false, cap: 0 });
    });

    it('should allow overriding default values', () => {
      const config = RateConfigModel.createDefaultConfig({ is_active: false });

      expect(config.is_active).toBe(false);
      expect(config.fiat_exchange).toBeDefined();
    });
  });
});
