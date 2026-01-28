import { BaseModel } from '../../base';
import { DatabaseSchema } from '../../database.schema';
import { DatabaseTables } from '../../database.table';
import { AccountActionCodeModel } from './accountActionCode.model';
import { AccountActionCodeValidation } from './accountActionCode.validation';

jest.mock('../../base');

describe('AccountActionCodeModel', () => {
  describe('tableName', () => {
    it('should return the correct table name', () => {
      expect(AccountActionCodeModel.tableName).toBe(
        `${DatabaseSchema.apiService}.${DatabaseTables.account_action_codes}`,
      );
    });
  });

  describe('jsonSchema', () => {
    it('should return the account action code validation schema', () => {
      expect(AccountActionCodeModel.jsonSchema).toBe(AccountActionCodeValidation);
    });
  });

  describe('relationMappings', () => {
    beforeEach(() => {
      BaseModel.BelongsToOneRelation = 'BelongsToOneRelation' as any;
    });
    it('should define the user relation correctly', () => {
      const relations = AccountActionCodeModel.relationMappings;
      expect(relations.user).toBeDefined();
      expect(relations.user.relation).toBe('BelongsToOneRelation');
      expect(relations.user.modelClass).toBeDefined();
      expect(relations.user.join).toEqual({
        from: `${DatabaseSchema.apiService}.${DatabaseTables.users}.id`,
        to: `${DatabaseSchema.apiService}.${DatabaseTables.account_action_codes}.user_id`,
      });
    });
  });

  describe('instance properties', () => {
    let model: AccountActionCodeModel;
    beforeEach(() => {
      model = new AccountActionCodeModel();
      model.id = 'code-1';
      model.user_id = 'user-1';
      model.code = 'ABC123';
      model.email = 'test@test.com';
      model.type = 'deactivation';
      model.expires_at = '2025-05-26T00:00:00Z';
      model.is_used = false;
      model.used_at = undefined;
      model.created_at = new Date('2025-05-25T00:00:00Z');
      model.updated_at = new Date('2025-05-25T12:00:00Z');
      model.deleted_at = undefined;
    });
    it('should properly store the instance properties', () => {
      expect(model.id).toBe('code-1');
      expect(model.user_id).toBe('user-1');
      expect(model.code).toBe('ABC123');
      expect(model.email).toBe('test@test.com');
      expect(model.type).toBe('deactivation');
      expect(model.expires_at).toBe('2025-05-26T00:00:00Z');
      expect(model.is_used).toBe(false);
      expect(model.used_at).toBeUndefined();
      expect(model.created_at).toEqual(new Date('2025-05-25T00:00:00Z'));
      expect(model.updated_at).toEqual(new Date('2025-05-25T12:00:00Z'));
      expect(model.deleted_at).toBeUndefined();
    });
    it('should inherit from BaseModel', () => {
      expect(model).toBeInstanceOf(BaseModel);
    });
  });
});
