import { TransactionAggregateModel } from './transactionAggregate.model';

describe('TransactionAggregateModel', () => {
  describe('tableName', () => {
    it('should return the correct table name', () => {
      expect(TransactionAggregateModel.tableName).toBe('api_service.transaction_aggregates');
    });
  });

  describe('publicProperty', () => {
    it('should return all public properties', () => {
      const properties = TransactionAggregateModel.publicProperty();
      expect(properties).toContain('id');
      expect(properties).toContain('date');
      expect(properties).toContain('transaction_type');
      expect(properties).toContain('provider');
      expect(properties).toContain('amount');
      expect(properties).toContain('created_at');
      expect(properties).toContain('updated_at');
    });

    it('should accept additional properties', () => {
      const properties = TransactionAggregateModel.publicProperty(['deleted_at']);
      expect(properties).toContain('deleted_at');
    });

    it('should return correct number of default properties', () => {
      const properties = TransactionAggregateModel.publicProperty();
      expect(properties.length).toBe(7);
    });

    it('should merge additional properties with default properties', () => {
      const additionalProps = ['custom_field', 'another_field'] as any;
      const properties = TransactionAggregateModel.publicProperty(additionalProps);
      expect(properties.length).toBe(9);
      expect(properties).toContain('custom_field');
      expect(properties).toContain('another_field');
    });
  });

  describe('jsonSchema', () => {
    it('should have required fields', () => {
      const schema = TransactionAggregateModel.jsonSchema;
      expect(schema.required).toContain('date');
      expect(schema.required).toContain('transaction_type');
      expect(schema.required).toContain('provider');
      expect(schema.required).toContain('amount');
    });

    it('should have correct property types', () => {
      const schema = TransactionAggregateModel.jsonSchema;
      expect((schema.properties.date as any).type).toBe('string');
      expect((schema.properties.date as any).format).toBe('date');
      expect((schema.properties.transaction_type as any).type).toBe('string');
      expect((schema.properties.provider as any).type).toBe('string');
      expect((schema.properties.amount as any).type).toBe('number');
    });

    it('should have correct schema type', () => {
      const schema = TransactionAggregateModel.jsonSchema;
      expect(schema.type).toBe('object');
    });

    it('should have schema title', () => {
      const schema = TransactionAggregateModel.jsonSchema;
      expect(schema.title).toBe('Transaction Aggregate Validation Schema');
    });
  });

  describe('model instance', () => {
    it('should create a valid instance', () => {
      const aggregate = new TransactionAggregateModel();
      aggregate.date = '2025-12-30';
      aggregate.transaction_type = 'deposit';
      aggregate.provider = 'zerohash';
      aggregate.amount = 1000.5;

      expect(aggregate.date).toBe('2025-12-30');
      expect(aggregate.transaction_type).toBe('deposit');
      expect(aggregate.provider).toBe('zerohash');
      expect(aggregate.amount).toBe(1000.5);
    });

    it('should handle Date object for date field', () => {
      const aggregate = new TransactionAggregateModel();
      const testDate = new Date('2025-12-30');
      aggregate.date = testDate;
      aggregate.transaction_type = 'withdrawal';
      aggregate.provider = 'zerohash';
      aggregate.amount = 500.25;

      expect(aggregate.date).toBeInstanceOf(Date);
      expect(aggregate.transaction_type).toBe('withdrawal');
    });

    it('should handle different providers', () => {
      const aggregate = new TransactionAggregateModel();
      aggregate.date = '2025-12-30';
      aggregate.transaction_type = 'deposit';
      aggregate.provider = 'plaid';
      aggregate.amount = 2500.0;

      expect(aggregate.provider).toBe('plaid');
    });

    it('should handle different transaction types', () => {
      const aggregate = new TransactionAggregateModel();
      aggregate.date = '2025-12-30';
      aggregate.transaction_type = 'exchange';
      aggregate.provider = 'zerohash';
      aggregate.amount = 750.75;

      expect(aggregate.transaction_type).toBe('exchange');
    });

    it('should handle decimal amounts', () => {
      const aggregate = new TransactionAggregateModel();
      aggregate.date = '2025-12-30';
      aggregate.transaction_type = 'deposit';
      aggregate.provider = 'zerohash';
      aggregate.amount = 123.456789;

      expect(aggregate.amount).toBe(123.456789);
    });

    it('should handle large amounts', () => {
      const aggregate = new TransactionAggregateModel();
      aggregate.date = '2025-12-30';
      aggregate.transaction_type = 'deposit';
      aggregate.provider = 'zerohash';
      aggregate.amount = 1000000.0;

      expect(aggregate.amount).toBe(1000000.0);
    });

    it('should be instance of TransactionAggregateModel', () => {
      const aggregate = new TransactionAggregateModel();
      expect(aggregate).toBeInstanceOf(TransactionAggregateModel);
    });
  });
});
