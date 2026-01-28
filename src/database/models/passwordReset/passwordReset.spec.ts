import { BaseModel } from '../../base';
import { DatabaseSchema } from '../../database.schema';
import { DatabaseTables } from '../../database.table';
import { PasswordResetModel } from './passwordReset.model';
import { PasswordResetValidation } from './passwordReset.validation';

jest.mock('../../base');

describe('PasswordResetModel', () => {
  describe('tableName', () => {
    it('should return the correct table name', () => {
      expect(PasswordResetModel.tableName).toBe(`${DatabaseSchema.apiService}.${DatabaseTables.password_resets}`);
    });
  });

  describe('jsonSchema', () => {
    it('should return the password reset validation schema', () => {
      expect(PasswordResetModel.jsonSchema).toBe(PasswordResetValidation);
    });
  });

  describe('relationMappings', () => {
    beforeEach(() => {
      BaseModel.HasOneRelation = 'HasOneRelation' as any;
    });
    it('should define the users relation correctly', () => {
      const relations = PasswordResetModel.relationMappings;
      expect(relations.user).toBeDefined();
      expect(relations.user.relation).toBe('HasOneRelation');
      expect(relations.user.modelClass).toBe(`../models/user`);
      expect(relations.user.join).toEqual({
        from: `${DatabaseSchema.apiService}.${DatabaseTables.password_resets}.user_id`,
        to: `${DatabaseSchema.apiService}.${DatabaseTables.users}.id`,
      });
    });
  });

  describe('instance properties', () => {
    let model: PasswordResetModel;
    beforeEach(() => {
      model = new PasswordResetModel();
      model.id = 'reset-1';
      model.user_id = 'user-1';
      model.code = 'resetcode';
      model.is_used = false;
      model.expiration_time = '2025-07-01T00:00:00Z';
      model.created_at = new Date('2025-06-01T00:00:00Z');
      model.updated_at = new Date('2025-06-01T12:00:00Z');
      model.deleted_at = undefined;
    });
    it('should properly store the instance properties', () => {
      expect(model.id).toBe('reset-1');
      expect(model.user_id).toBe('user-1');
      expect(model.code).toBe('resetcode');
      expect(model.is_used).toBe(false);
      expect(model.expiration_time).toBe('2025-07-01T00:00:00Z');
      expect(model.created_at).toEqual(new Date('2025-06-01T00:00:00Z'));
      expect(model.updated_at).toEqual(new Date('2025-06-01T12:00:00Z'));
      expect(model.deleted_at).toBeUndefined();
    });
    it('should inherit from BaseModel', () => {
      expect(model).toBeInstanceOf(BaseModel);
    });
  });
});
