import { BaseModel } from '../../base';
import { DatabaseSchema } from '../../database.schema';
import { DatabaseTables } from '../../database.table';
import { SystemUsersBeneficiaryModel } from './systemUsersBeneficiary.model';
import { SystemUsersBeneficiaryValidationSchema } from './systemUsersBeneficiary.validation';

jest.mock('../../base');

describe('SystemUsersBeneficiary', () => {
  // Reset mocks before each test
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // Validation Schema Tests
  describe('SystemUsersBeneficiaryValidationSchema', () => {
    it('should have the correct title', () => {
      expect(SystemUsersBeneficiaryValidationSchema.title).toBe('System Users Beneficiary Validation Schema');
    });

    it('should be of type object', () => {
      expect(SystemUsersBeneficiaryValidationSchema.type).toBe('object');
    });

    it('should require specific fields', () => {
      const requiredFields = SystemUsersBeneficiaryValidationSchema.required as string[];

      expect(requiredFields).toContain('sender_user_id');
      expect(requiredFields).toContain('beneficiary_user_id');
    });

    describe('properties', () => {
      const properties = SystemUsersBeneficiaryValidationSchema.properties as Record<string, any>;

      it('should have sender_user_id as string', () => {
        expect(properties.sender_user_id.type).toBe('string');
      });

      it('should have beneficiary_user_id as string', () => {
        expect(properties.beneficiary_user_id.type).toBe('string');
      });

      it('should have alias_name as string or null', () => {
        expect(properties.alias_name.type).toEqual(['string', 'null']);
      });
    });
  });

  // Model Tests
  describe('SystemUsersBeneficiaryModel', () => {
    describe('tableName', () => {
      it('should return the correct table name', () => {
        expect(SystemUsersBeneficiaryModel.tableName).toBe(
          `${DatabaseSchema.apiService}.${DatabaseTables.system_users_beneficiaries}`,
        );
      });
    });

    describe('jsonSchema', () => {
      it('should return the system users beneficiary validation schema', () => {
        expect(SystemUsersBeneficiaryModel.jsonSchema).toBe(SystemUsersBeneficiaryValidationSchema);
      });
    });

    describe('publicProperty', () => {
      it('should return the default public properties', () => {
        const properties = SystemUsersBeneficiaryModel.publicProperty();

        expect(properties).toContain('id');
        expect(properties).toContain('sender_user_id');
        expect(properties).toContain('beneficiary_user_id');
        expect(properties).toContain('alias_name');
        expect(properties).toContain('created_at');
        expect(properties).toContain('updated_at');
      });

      it('should include additional properties when provided', () => {
        const additionalProps = ['some_prop', 'another_prop'] as any[];
        const properties = SystemUsersBeneficiaryModel.publicProperty(additionalProps);

        expect(properties).toContain('id');
        expect(properties).toContain('some_prop');
        expect(properties).toContain('another_prop');
      });
    });

    describe('relationMappings', () => {
      beforeEach(() => {
        // Mock BelongsToOneRelation as a string instead of a function
        BaseModel.BelongsToOneRelation = 'BelongsToOneRelation' as any;
      });

      it('should define the senderUser relation correctly', () => {
        const relations = SystemUsersBeneficiaryModel.relationMappings;

        expect(relations.senderUser).toBeDefined();
        expect(relations.senderUser.relation).toBe('BelongsToOneRelation');
        expect(relations.senderUser.join).toEqual({
          from: `${DatabaseSchema.apiService}.${DatabaseTables.system_users_beneficiaries}.sender_user_id`,
          to: `${DatabaseSchema.apiService}.${DatabaseTables.users}.id`,
        });
      });

      it('should define the beneficiaryUser relation correctly', () => {
        const relations = SystemUsersBeneficiaryModel.relationMappings;

        expect(relations.beneficiaryUser).toBeDefined();
        expect(relations.beneficiaryUser.relation).toBe('BelongsToOneRelation');
        expect(relations.beneficiaryUser.join).toEqual({
          from: `${DatabaseSchema.apiService}.${DatabaseTables.system_users_beneficiaries}.beneficiary_user_id`,
          to: `${DatabaseSchema.apiService}.${DatabaseTables.users}.id`,
        });
      });
    });

    describe('modifiers', () => {
      it('should have a notDeleted modifier', () => {
        const modifiers = SystemUsersBeneficiaryModel.modifiers;

        expect(modifiers.notDeleted).toBeDefined();
        expect(typeof modifiers.notDeleted).toBe('function');

        const mockQuery = { whereNull: jest.fn() };
        modifiers.notDeleted(mockQuery as any);

        expect(mockQuery.whereNull).toHaveBeenCalledWith('deleted_at');
      });
    });

    describe('instance properties', () => {
      let beneficiaryModel: SystemUsersBeneficiaryModel;

      beforeEach(() => {
        beneficiaryModel = new SystemUsersBeneficiaryModel();
        beneficiaryModel.sender_user_id = 'sender123';
        beneficiaryModel.beneficiary_user_id = 'beneficiary456';
        beneficiaryModel.alias_name = 'John Doe';
      });

      it('should properly store the instance properties', () => {
        expect(beneficiaryModel.sender_user_id).toBe('sender123');
        expect(beneficiaryModel.beneficiary_user_id).toBe('beneficiary456');
        expect(beneficiaryModel.alias_name).toBe('John Doe');
      });

      it('should allow alias_name to be null', () => {
        beneficiaryModel.alias_name = null;
        expect(beneficiaryModel.alias_name).toBeNull();
      });

      it('should inherit from BaseModel', () => {
        expect(beneficiaryModel).toBeInstanceOf(BaseModel);
      });
    });
  });
});
