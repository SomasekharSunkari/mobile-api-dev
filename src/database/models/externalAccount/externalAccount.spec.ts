import { BaseModel } from '../../base/base.model';
import { DatabaseSchema } from '../../database.schema';
import { DatabaseTables } from '../../database.table';
import { ExternalAccountStatus } from './externalAccount.interface';
import { ExternalAccountModel } from './externalAccount.model';
import { ExternalAccountValidationSchema } from './externalAccount.validation';

jest.mock('../../../base');

describe('ExternalAccountModel', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // Validation Schema
  describe('Validation Schema', () => {
    it('should have the correct title', () => {
      expect(ExternalAccountValidationSchema.title).toBe('External Account Validation Schema');
    });

    it('should be of type object', () => {
      expect(ExternalAccountValidationSchema.type).toBe('object');
    });

    it('should require specific fields', () => {
      const requiredFields = ExternalAccountValidationSchema.required as string[];
      expect(requiredFields).toContain('user_id');
      expect(requiredFields).toContain('provider');
    });

    it('should define expected properties', () => {
      const props = ExternalAccountValidationSchema.properties!;
      expect(props).toHaveProperty('external_account_ref');
      expect(props).toHaveProperty('provider_kyc_status');
      expect(props).toHaveProperty('status');
      expect(props).toHaveProperty('participant_code');
      expect(props).toHaveProperty('provider');
      expect(props).toHaveProperty('linked_provider');
      expect(props).toHaveProperty('linked_item_ref');
      expect(props).toHaveProperty('linked_account_ref');
      expect(props).toHaveProperty('linked_access_token');
      expect(props).toHaveProperty('linked_processor_token');
      expect(props).toHaveProperty('bank_ref');
      expect(props).toHaveProperty('bank_name');
      expect(props).toHaveProperty('account_number');
      expect(props).toHaveProperty('routing_number');
      expect(props).toHaveProperty('nuban');
      expect(props).toHaveProperty('swift_code');
      expect(props).toHaveProperty('expiration_date');
      expect(props).toHaveProperty('capabilities');
      expect(props).toHaveProperty('account_name');
      expect(props).toHaveProperty('account_type');
    });
  });

  // Metadata
  describe('Metadata', () => {
    it('should return correct table name', () => {
      expect(ExternalAccountModel.tableName).toBe(`${DatabaseSchema.apiService}.${DatabaseTables.external_accounts}`);
    });

    it('should return correct json schema', () => {
      expect(ExternalAccountModel.jsonSchema).toBe(ExternalAccountValidationSchema);
    });

    it('should inherit from BaseModel', () => {
      const instance = new ExternalAccountModel();
      expect(instance).toBeInstanceOf(BaseModel);
    });
  });

  // publicProperty
  describe('publicProperty()', () => {
    it('should return default public properties', () => {
      const props = ExternalAccountModel.publicProperty();

      expect(props).toEqual(
        expect.arrayContaining([
          'id',
          'user_id',
          'fiat_wallet_id',
          'status',
          'bank_name',
          'account_name',
          'account_type',
          'expiration_date',
          'created_at',
          'updated_at',
        ]),
      );
    });
  });

  // relationMappings
  describe('relationMappings', () => {
    it('should define user relation mapping', () => {
      BaseModel.BelongsToOneRelation = 'BelongsToOneRelation' as any;
      const mappings = ExternalAccountModel.relationMappings;
      expect(mappings.user).toBeDefined();
      expect(mappings.user.relation).toBe('BelongsToOneRelation');
      expect(mappings.user.join.from).toContain('.user_id');
      expect(mappings.user.join.to).toContain('.id');
    });
  });

  // modifiers
  describe('modifiers', () => {
    it('should add notDeleted modifier', () => {
      const mockQuery = { whereNull: jest.fn() };
      ExternalAccountModel.modifiers.notDeleted(mockQuery as any);
      expect(mockQuery.whereNull).toHaveBeenCalledWith('deleted_at');
    });
  });

  // instance properties
  describe('instance properties', () => {
    it('should instantiate with given values', () => {
      const model = new ExternalAccountModel();
      model.user_id = 'user_1';
      model.provider = 'Plaid';
      model.provider_kyc_status = 'submitted';
      model.status = ExternalAccountStatus.APPROVED;
      expect(model.user_id).toBe('user_1');
      expect(model.provider).toBe('Plaid');
      expect(model.provider_kyc_status).toBe('submitted');
      expect(model.status).toBe(ExternalAccountStatus.APPROVED);
    });
  });
});
