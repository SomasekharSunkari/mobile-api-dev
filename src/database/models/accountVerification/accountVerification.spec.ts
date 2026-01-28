import { BaseModel } from '../../base';
import { DatabaseSchema } from '../../database.schema';
import { DatabaseTables } from '../../database.table';
import { AccountVerificationModel } from './accountVerification.model';
import { AccountVerificationValidation } from './accountVerification.validation';

jest.mock('../../base');

describe('AccountVerificationModel', () => {
  describe('tableName', () => {
    it('should return the correct table name', () => {
      expect(AccountVerificationModel.tableName).toBe(
        `${DatabaseSchema.apiService}.${DatabaseTables.account_verifications}`,
      );
    });
  });

  describe('jsonSchema', () => {
    it('should return the account verification validation schema', () => {
      expect(AccountVerificationModel.jsonSchema).toBe(AccountVerificationValidation);
    });
  });

  describe('relationMappings', () => {
    beforeEach(() => {
      BaseModel.BelongsToOneRelation = 'BelongsToOneRelation' as any;
    });
    it('should define the users relation correctly', () => {
      const relations = AccountVerificationModel.relationMappings;
      expect(relations.users).toBeDefined();
      expect(relations.users.relation).toBe('BelongsToOneRelation');
      expect(relations.users.modelClass).toBe(`../models/user`);
      expect(relations.users.join).toEqual({
        from: `${DatabaseSchema.apiService}.${DatabaseTables.users}.id`,
        to: `${DatabaseSchema.apiService}.${DatabaseTables.account_verifications}.user_id`,
      });
    });
  });

  describe('instance properties', () => {
    let model: AccountVerificationModel;
    beforeEach(() => {
      model = new AccountVerificationModel();
      model.id = 'verif-1';
      model.user_id = 'user-1';
      model.code = '123456';
      model.is_used = false;
      model.expiration_time = '2025-06-01T00:00:00Z';
      model.created_at = new Date('2025-05-25T00:00:00Z');
      model.updated_at = new Date('2025-05-25T12:00:00Z');
      model.deleted_at = undefined;
      model.email = 'test@example.com';
    });
    it('should properly store the instance properties', () => {
      expect(model.id).toBe('verif-1');
      expect(model.user_id).toBe('user-1');
      expect(model.code).toBe('123456');
      expect(model.is_used).toBe(false);
      expect(model.expiration_time).toBe('2025-06-01T00:00:00Z');
      expect(model.created_at).toEqual(new Date('2025-05-25T00:00:00Z'));
      expect(model.updated_at).toEqual(new Date('2025-05-25T12:00:00Z'));
      expect(model.deleted_at).toBeUndefined();
      expect(model.email).toBe('test@example.com');
    });
    it('should inherit from BaseModel', () => {
      expect(model).toBeInstanceOf(BaseModel);
    });
  });
});
