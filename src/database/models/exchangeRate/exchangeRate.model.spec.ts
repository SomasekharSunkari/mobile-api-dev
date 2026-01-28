import { ExchangeRateModel } from './exchangeRate.model';

describe('ExchangeRateModel', () => {
  describe('tableName', () => {
    it('should return the correct table name', () => {
      expect(ExchangeRateModel.tableName).toBe('api_service.exchange_rates');
    });
  });

  describe('publicProperty', () => {
    it('should return all public properties', () => {
      const properties = ExchangeRateModel.publicProperty();
      expect(properties).toContain('id');
      expect(properties).toContain('provider');
      expect(properties).toContain('buying_currency_code');
      expect(properties).toContain('selling_currency_code');
      expect(properties).toContain('rate');
      expect(properties).toContain('provider_rate_ref');
      expect(properties).toContain('expires_at');
      expect(properties).toContain('provider_rate');
      expect(properties).toContain('created_at');
      expect(properties).toContain('updated_at');
    });

    it('should accept additional properties', () => {
      const properties = ExchangeRateModel.publicProperty(['deleted_at']);
      expect(properties).toContain('deleted_at');
    });

    it('should return correct number of default properties', () => {
      const properties = ExchangeRateModel.publicProperty();
      expect(properties.length).toBe(10);
    });

    it('should merge additional properties with default properties', () => {
      const additionalProps = ['custom_field', 'another_field'] as any;
      const properties = ExchangeRateModel.publicProperty(additionalProps);
      expect(properties.length).toBe(12);
      expect(properties).toContain('custom_field');
      expect(properties).toContain('another_field');
    });
  });

  describe('jsonSchema', () => {
    it('should have required fields', () => {
      const schema = ExchangeRateModel.jsonSchema;
      expect(schema.required).toContain('provider');
      expect(schema.required).toContain('buying_currency_code');
      expect(schema.required).toContain('selling_currency_code');
      expect(schema.required).toContain('rate');
      expect(schema.required).toContain('provider_rate_ref');
      expect(schema.required).toContain('provider_rate');
    });

    it('should have correct property types', () => {
      const schema = ExchangeRateModel.jsonSchema;
      expect((schema.properties.provider as any).type).toBe('string');
      expect((schema.properties.buying_currency_code as any).type).toBe('string');
      expect((schema.properties.selling_currency_code as any).type).toBe('string');
      expect((schema.properties.rate as any).type).toBe('number');
      expect((schema.properties.provider_rate_ref as any).type).toBe('string');
    });

    it('should allow nullable expires_at', () => {
      const schema = ExchangeRateModel.jsonSchema;
      expect((schema.properties.expires_at as any).type).toContain('string');
      expect((schema.properties.expires_at as any).type).toContain('null');
    });

    it('should allow nullable provider_rate', () => {
      const schema = ExchangeRateModel.jsonSchema;
      expect((schema.properties.provider_rate as any).type).toContain('number');
      expect((schema.properties.provider_rate as any).type).toContain('null');
    });

    it('should have date-time format for expires_at', () => {
      const schema = ExchangeRateModel.jsonSchema;
      expect((schema.properties.expires_at as any).format).toBe('date-time');
    });

    it('should have correct schema type', () => {
      const schema = ExchangeRateModel.jsonSchema;
      expect(schema.type).toBe('object');
    });

    it('should have schema title', () => {
      const schema = ExchangeRateModel.jsonSchema;
      expect(schema.title).toBe('Exchange Rate Validation Schema');
    });
  });

  describe('model instance', () => {
    it('should create a valid instance', () => {
      const exchangeRate = new ExchangeRateModel();
      exchangeRate.provider = 'test-provider';
      exchangeRate.buying_currency_code = 'USD';
      exchangeRate.selling_currency_code = 'NGN';
      exchangeRate.rate = 1500;
      exchangeRate.provider_rate_ref = 'ref-123';
      exchangeRate.expires_at = new Date();
      exchangeRate.provider_rate = 1500;
      expect(exchangeRate.provider).toBe('test-provider');
      expect(exchangeRate.buying_currency_code).toBe('USD');
      expect(exchangeRate.selling_currency_code).toBe('NGN');
      expect(exchangeRate.rate).toBe(1500);
      expect(exchangeRate.provider_rate_ref).toBe('ref-123');
      expect(exchangeRate.expires_at).toBeInstanceOf(Date);
      expect(exchangeRate.provider_rate).toBe(1500);
    });

    it('should allow expires_at to be undefined', () => {
      const exchangeRate = new ExchangeRateModel();
      exchangeRate.provider = 'test-provider';
      exchangeRate.buying_currency_code = 'USD';
      exchangeRate.selling_currency_code = 'NGN';
      exchangeRate.rate = 1500;
      exchangeRate.provider_rate_ref = 'ref-123';
      exchangeRate.provider_rate = 1500;
      expect(exchangeRate.expires_at).toBeUndefined();
    });

    it('should allow provider_rate to be different from rate', () => {
      const exchangeRate = new ExchangeRateModel();
      exchangeRate.provider = 'yellowcard';
      exchangeRate.buying_currency_code = 'NGN';
      exchangeRate.selling_currency_code = 'USD';
      exchangeRate.rate = 163200;
      exchangeRate.provider_rate = 160000;
      exchangeRate.provider_rate_ref = 'ref-456';
      expect(exchangeRate.rate).not.toBe(exchangeRate.provider_rate);
      expect(exchangeRate.rate).toBeGreaterThan(exchangeRate.provider_rate);
    });

    it('should handle decimal rate values', () => {
      const exchangeRate = new ExchangeRateModel();
      exchangeRate.provider = 'test-provider';
      exchangeRate.buying_currency_code = 'USD';
      exchangeRate.selling_currency_code = 'NGN';
      exchangeRate.rate = 1650.75;
      exchangeRate.provider_rate = 1600.5;
      exchangeRate.provider_rate_ref = 'ref-789';
      expect(exchangeRate.rate).toBe(1650.75);
      expect(exchangeRate.provider_rate).toBe(1600.5);
    });

    it('should handle large rate values', () => {
      const exchangeRate = new ExchangeRateModel();
      exchangeRate.provider = 'test-provider';
      exchangeRate.buying_currency_code = 'USD';
      exchangeRate.selling_currency_code = 'NGN';
      exchangeRate.rate = 1650000000;
      exchangeRate.provider_rate = 1600000000;
      exchangeRate.provider_rate_ref = 'ref-large';
      expect(exchangeRate.rate).toBe(1650000000);
      expect(exchangeRate.provider_rate).toBe(1600000000);
    });

    it('should be instance of ExchangeRateModel', () => {
      const exchangeRate = new ExchangeRateModel();
      expect(exchangeRate).toBeInstanceOf(ExchangeRateModel);
    });
  });
});
