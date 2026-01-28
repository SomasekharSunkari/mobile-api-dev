import { BaseModel } from '../../base';
import { DatabaseSchema } from '../../database.schema';
import { DatabaseTables } from '../../database.table';
import { BankModel } from './bank.model';
import { BankValidationSchema } from './bank.validation';

jest.mock('../../base');

describe('Bank', () => {
  // Reset mocks before each test
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // Validation Schema Tests
  describe('BankValidationSchema', () => {
    it('should be of type object', () => {
      expect(BankValidationSchema.type).toBe('object');
    });

    it('should require specific fields', () => {
      const requiredFields = BankValidationSchema.required as string[];

      expect(requiredFields).toContain('name');
      expect(requiredFields).toContain('code');
      expect(requiredFields).toContain('country_id');
    });

    describe('properties', () => {
      const properties = BankValidationSchema.properties as Record<string, any>;

      it('should have name as string', () => {
        expect(properties.name.type).toBe('string');
      });

      it('should have code as string', () => {
        expect(properties.code.type).toBe('string');
      });

      it('should have country_id as string', () => {
        expect(properties.country_id.type).toBe('string');
      });

      it('should have logo as string or null', () => {
        expect(properties.logo.type).toEqual(['string', 'null']);
      });

      it('should have status as string or null', () => {
        expect(properties.status.type).toEqual(['string', 'null']);
      });

      it('should have short_name as string or null', () => {
        expect(properties.short_name.type).toEqual(['string', 'null']);
      });
    });
  });

  // Model Tests
  describe('BankModel', () => {
    describe('tableName', () => {
      it('should return the correct table name', () => {
        expect(BankModel.tableName).toBe(`${DatabaseSchema.apiService}.${DatabaseTables.banks}`);
      });
    });

    describe('jsonSchema', () => {
      it('should return the bank validation schema', () => {
        expect(BankModel.jsonSchema).toBe(BankValidationSchema);
      });
    });

    describe('relationMappings', () => {
      beforeEach(() => {
        // Mock BelongsToOneRelation as a string instead of a function
        BaseModel.BelongsToOneRelation = 'BelongsToOneRelation' as any;
      });

      it('should define the country relation correctly', () => {
        const relations = BankModel.relationMappings;

        expect(relations.country).toBeDefined();
        expect(relations.country.relation).toBe('BelongsToOneRelation');
        expect(relations.country.join).toEqual({
          from: `${DatabaseSchema.apiService}.${DatabaseTables.banks}.country_id`,
          to: `${DatabaseSchema.apiService}.${DatabaseTables.countries}.id`,
        });
      });
    });
    describe('instance properties', () => {
      let bankModel: BankModel;

      beforeEach(() => {
        bankModel = new BankModel();
        bankModel.name = 'Test Bank';
        bankModel.code = 'TEST';
        bankModel.country_id = '1';
        bankModel.status = 'active';
        bankModel.short_name = 'TEST';
        bankModel.logo = 'https://example.com/logo.png';
      });

      it('should properly store the instance properties', () => {
        expect(bankModel.name).toBe('Test Bank');
        expect(bankModel.code).toBe('TEST');
        expect(bankModel.logo).toBe('https://example.com/logo.png');
        expect(bankModel.country_id).toBe('1');
        expect(bankModel.status).toBe('active');
        expect(bankModel.short_name).toBe('TEST');
      });

      it('should inherit from BaseModel', () => {
        expect(bankModel).toBeInstanceOf(BaseModel);
      });
    });
  });
});
