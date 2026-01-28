import { BaseModel } from '../../base';
import { DatabaseSchema } from '../../database.schema';
import { DatabaseTables } from '../../database.table';
import { AccountDeactivationStatus } from './accountDeactivationLog.interface';
import { AccountDeactivationLogModel } from './accountDeactivationLog.model';
import { AccountDeactivationLogValidation } from './accountDeactivationLog.validation';

jest.mock('../../base');

describe('AccountDeactivationLogModel', () => {
  describe('tableName', () => {
    it('should return the correct table name', () => {
      expect(AccountDeactivationLogModel.tableName).toBe(
        `${DatabaseSchema.apiService}.${DatabaseTables.account_deactivation_logs}`,
      );
    });
  });

  describe('jsonSchema', () => {
    it('should return the account deactivation log validation schema', () => {
      expect(AccountDeactivationLogModel.jsonSchema).toBe(AccountDeactivationLogValidation);
    });
  });

  describe('relationMappings', () => {
    beforeEach(() => {
      BaseModel.BelongsToOneRelation = 'BelongsToOneRelation' as any;
    });
    it('should define the user relation correctly', () => {
      const relations = AccountDeactivationLogModel.relationMappings;
      expect(relations.user).toBeDefined();
      expect(relations.user.relation).toBe('BelongsToOneRelation');
      expect(relations.user.modelClass).toBeDefined();
      expect(relations.user.join).toEqual({
        from: `${DatabaseSchema.apiService}.${DatabaseTables.users}.id`,
        to: `${DatabaseSchema.apiService}.${DatabaseTables.account_deactivation_logs}.user_id`,
      });
    });
    it('should define the deactivatedBy relation correctly', () => {
      const relations = AccountDeactivationLogModel.relationMappings;
      expect(relations.deactivatedBy).toBeDefined();
      expect(relations.deactivatedBy.relation).toBe('BelongsToOneRelation');
      expect(relations.deactivatedBy.modelClass).toBeDefined();
      expect(relations.deactivatedBy.join).toEqual({
        from: `${DatabaseSchema.apiService}.${DatabaseTables.users}.id`,
        to: `${DatabaseSchema.apiService}.${DatabaseTables.account_deactivation_logs}.deactivated_by_user_id`,
      });
    });
  });

  describe('instance properties', () => {
    let model: AccountDeactivationLogModel;
    beforeEach(() => {
      model = new AccountDeactivationLogModel();
      model.id = 'req-1';
      model.user_id = 'user-1';
      model.reasons = ['User requested account deletion'];
      model.status = AccountDeactivationStatus.DEACTIVATED;
      model.deactivated_on = '2025-05-26T00:00:00Z';
      model.deactivated_by_user_id = 'user-2';
      model.is_active_log = true;
      model.created_at = new Date('2025-05-25T00:00:00Z');
      model.updated_at = new Date('2025-05-25T12:00:00Z');
      model.deleted_at = undefined;
    });
    it('should properly store the instance properties', () => {
      expect(model.id).toBe('req-1');
      expect(model.user_id).toBe('user-1');
      expect(model.reasons).toEqual(['User requested account deletion']);
      expect(model.status).toBe(AccountDeactivationStatus.DEACTIVATED);
      expect(model.deactivated_on).toBe('2025-05-26T00:00:00Z');
      expect(model.deactivated_by_user_id).toBe('user-2');
      expect(model.is_active_log).toBe(true);
      expect(model.created_at).toEqual(new Date('2025-05-25T00:00:00Z'));
      expect(model.updated_at).toEqual(new Date('2025-05-25T12:00:00Z'));
      expect(model.deleted_at).toBeUndefined();
    });
    it('should inherit from BaseModel', () => {
      expect(model).toBeInstanceOf(BaseModel);
    });
  });

  describe('reactivation properties', () => {
    let model: AccountDeactivationLogModel;
    beforeEach(() => {
      model = new AccountDeactivationLogModel();
      model.id = 'activation-1';
      model.user_id = 'user-1';
      model.reasons = [];
      model.status = AccountDeactivationStatus.ACTIVATED;
      model.is_active_log = true;
      model.reactivated_on = '2025-05-27T00:00:00Z';
      model.reactivated_by_user_id = 'admin-1';
      model.reactivation_description = 'User requested to reactivate their account';
      model.reactivation_support_document_url = 'https://s3.amazonaws.com/bucket/support-doc.pdf';
      model.created_at = new Date('2025-05-27T00:00:00Z');
      model.updated_at = new Date('2025-05-27T00:00:00Z');
    });

    it('should properly store the reactivation properties', () => {
      expect(model.id).toBe('activation-1');
      expect(model.user_id).toBe('user-1');
      expect(model.status).toBe(AccountDeactivationStatus.ACTIVATED);
      expect(model.reactivated_on).toBe('2025-05-27T00:00:00Z');
      expect(model.reactivated_by_user_id).toBe('admin-1');
      expect(model.reactivation_description).toBe('User requested to reactivate their account');
      expect(model.reactivation_support_document_url).toBe('https://s3.amazonaws.com/bucket/support-doc.pdf');
    });

    it('should allow null/undefined reactivation properties', () => {
      const emptyModel = new AccountDeactivationLogModel();
      emptyModel.reactivation_description = undefined;
      emptyModel.reactivation_support_document_url = undefined;

      expect(emptyModel.reactivation_description).toBeUndefined();
      expect(emptyModel.reactivation_support_document_url).toBeUndefined();
    });
  });
});
