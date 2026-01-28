import { BaseModel } from '../../base';
import { DatabaseSchema } from '../../database.schema';
import { DatabaseTables } from '../../database.table';
import { AccountDeleteRequestModel } from './accountDeleteRequest.model';
import { AccountDeleteRequestValidation } from './accountDeleteRequest.validation';

jest.mock('../../base');

describe('AccountDeleteRequestModel', () => {
  describe('tableName', () => {
    it('should return the correct table name', () => {
      expect(AccountDeleteRequestModel.tableName).toBe(
        `${DatabaseSchema.apiService}.${DatabaseTables.account_delete_requests}`,
      );
    });
  });

  describe('jsonSchema', () => {
    it('should return the account delete request validation schema', () => {
      expect(AccountDeleteRequestModel.jsonSchema).toBe(AccountDeleteRequestValidation);
    });
  });

  describe('relationMappings', () => {
    beforeEach(() => {
      BaseModel.BelongsToOneRelation = 'BelongsToOneRelation' as any;
    });
    it('should define the users relation correctly', () => {
      const relations = AccountDeleteRequestModel.relationMappings;
      expect(relations.users).toBeDefined();
      expect(relations.users.relation).toBe('BelongsToOneRelation');
      expect(relations.users.modelClass).toBe(`../models/user`);
      expect(relations.users.join).toEqual({
        from: `${DatabaseSchema.apiService}.${DatabaseTables.users}.id`,
        to: `${DatabaseSchema.apiService}.${DatabaseTables.account_delete_requests}.user_id`,
      });
    });
  });

  describe('instance properties', () => {
    let model: AccountDeleteRequestModel;
    beforeEach(() => {
      model = new AccountDeleteRequestModel();
      model.id = 'req-1';
      model.user_id = 'user-1';
      model.reasons = ['User requested account deletion'];
      model.deleted_on = '2025-05-26T00:00:00Z';
      model.created_at = new Date('2025-05-25T00:00:00Z');
      model.updated_at = new Date('2025-05-25T12:00:00Z');
      model.deleted_at = undefined;
    });
    it('should properly store the instance properties', () => {
      expect(model.id).toBe('req-1');
      expect(model.user_id).toBe('user-1');
      expect(model.reasons).toEqual(['User requested account deletion']);
      expect(model.deleted_on).toBe('2025-05-26T00:00:00Z');
      expect(model.created_at).toEqual(new Date('2025-05-25T00:00:00Z'));
      expect(model.updated_at).toEqual(new Date('2025-05-25T12:00:00Z'));
      expect(model.deleted_at).toBeUndefined();
    });
    it('should inherit from BaseModel', () => {
      expect(model).toBeInstanceOf(BaseModel);
    });
  });
});
