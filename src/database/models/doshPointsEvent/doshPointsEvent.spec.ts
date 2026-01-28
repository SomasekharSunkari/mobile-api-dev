import { DatabaseSchema } from '../../database.schema';
import { DatabaseTables } from '../../database.table';
import { DoshPointsTransactionType } from './doshPointsEvent.interface';
import { DoshPointsEventModel } from './doshPointsEvent.model';
import { DoshPointsEventValidationSchema } from './doshPointsEvent.validation';

describe('DoshPointsEventModel', () => {
  describe('tableName', () => {
    it('should return correct table name with schema', () => {
      expect(DoshPointsEventModel.tableName).toBe(`${DatabaseSchema.apiService}.${DatabaseTables.dosh_points_events}`);
    });
  });

  describe('publicProperty', () => {
    it('should return default public properties when no argument provided', () => {
      const result = DoshPointsEventModel.publicProperty();
      expect(result).toEqual([
        'id',
        'code',
        'name',
        'description',
        'transaction_type',
        'default_points',
        'is_active',
        'is_one_time_per_user',
        'metadata',
        'start_date',
        'end_date',
        'created_at',
        'updated_at',
      ]);
    });

    it('should merge additional properties with default public properties', () => {
      const additionalProps = ['metadata'];
      const result = DoshPointsEventModel.publicProperty(additionalProps as any);
      expect(result).toContain('id');
      expect(result).toContain('code');
      expect(result).toContain('metadata');
    });

    it('should handle empty array of additional properties', () => {
      const result = DoshPointsEventModel.publicProperty([]);
      expect(result.length).toBe(13);
    });
  });

  describe('jsonSchema', () => {
    it('should return DoshPointsEventValidationSchema', () => {
      expect(DoshPointsEventModel.jsonSchema).toBe(DoshPointsEventValidationSchema);
    });
  });

  describe('modifiers', () => {
    it('should define notDeleted modifier', () => {
      const modifiers = DoshPointsEventModel.modifiers;
      expect(modifiers.notDeleted).toBeDefined();
      expect(typeof modifiers.notDeleted).toBe('function');
    });

    it('should apply whereNull on deleted_at column in notDeleted modifier', () => {
      const mockQuery = { whereNull: jest.fn() };
      const modifiers = DoshPointsEventModel.modifiers;
      modifiers.notDeleted(mockQuery);
      expect(mockQuery.whereNull).toHaveBeenCalledWith('deleted_at');
    });

    it('should define active modifier', () => {
      const modifiers = DoshPointsEventModel.modifiers;
      expect(modifiers.active).toBeDefined();
      expect(typeof modifiers.active).toBe('function');
    });

    it('should apply where is_active is true in active modifier', () => {
      const mockQuery = { where: jest.fn() };
      const modifiers = DoshPointsEventModel.modifiers;
      modifiers.active(mockQuery);
      expect(mockQuery.where).toHaveBeenCalledWith('is_active', true);
    });
  });

  describe('model instantiation', () => {
    it('should create instance with all properties', () => {
      const event = new DoshPointsEventModel();
      event.code = 'ONBOARDING_BONUS';
      event.name = 'Onboarding Bonus';
      event.description = 'Points for completing onboarding';
      event.transaction_type = DoshPointsTransactionType.CREDIT;
      event.default_points = 10;
      event.is_active = true;
      event.is_one_time_per_user = true;

      expect(event.code).toBe('ONBOARDING_BONUS');
      expect(event.name).toBe('Onboarding Bonus');
      expect(event.transaction_type).toBe('credit');
      expect(event.default_points).toBe(10);
      expect(event.is_active).toBe(true);
      expect(event.is_one_time_per_user).toBe(true);
    });
  });
});

describe('DoshPointsEventValidationSchema', () => {
  describe('schema structure', () => {
    it('should have correct type and title', () => {
      expect(DoshPointsEventValidationSchema.type).toBe('object');
      expect(DoshPointsEventValidationSchema.title).toBe('Dosh Points Event Validation Schema');
    });

    it('should require code, name, transaction_type, and is_active', () => {
      expect(DoshPointsEventValidationSchema.required).toContain('code');
      expect(DoshPointsEventValidationSchema.required).toContain('name');
      expect(DoshPointsEventValidationSchema.required).toContain('transaction_type');
      expect(DoshPointsEventValidationSchema.required).toContain('is_active');
    });
  });

  describe('properties', () => {
    const props = DoshPointsEventValidationSchema.properties;

    it('should define code as string', () => {
      expect(props.code).toEqual({ type: 'string' });
    });

    it('should define name as string', () => {
      expect(props.name).toEqual({ type: 'string' });
    });

    it('should define description as nullable string', () => {
      expect(props.description).toEqual({ type: ['string', 'null'] });
    });

    it('should define transaction_type with valid enum values', () => {
      const typeProp = props.transaction_type as { type: string; enum: string[] };
      expect(typeProp.type).toBe('string');
      expect(typeProp.enum).toContain(DoshPointsTransactionType.CREDIT);
      expect(typeProp.enum).toContain(DoshPointsTransactionType.DEBIT);
    });

    it('should define default_points as integer with minimum 0', () => {
      expect(props.default_points).toEqual({ type: 'integer', minimum: 0 });
    });

    it('should define is_active as boolean', () => {
      expect(props.is_active).toEqual({ type: 'boolean' });
    });

    it('should define is_one_time_per_user as boolean', () => {
      expect(props.is_one_time_per_user).toEqual({ type: 'boolean' });
    });
  });
});

describe('DoshPointsTransactionType', () => {
  it('should have CREDIT type', () => {
    expect(DoshPointsTransactionType.CREDIT).toBe('credit');
  });

  it('should have DEBIT type', () => {
    expect(DoshPointsTransactionType.DEBIT).toBe('debit');
  });
});
