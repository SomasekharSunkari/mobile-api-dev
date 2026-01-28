import { BaseModel } from '../../base';
import { DatabaseSchema } from '../../database.schema';
import { DatabaseTables } from '../../database.table';
import { UserTierModel } from './userTier.model';
import { UserTierValidationSchema } from './userTier.validation';

jest.mock('../../base');

describe('TierConfigModel', () => {
  describe('tableName', () => {
    it('should return the correct table name', () => {
      expect(UserTierModel.tableName).toBe(`${DatabaseSchema.apiService}.${DatabaseTables.user_tiers}`);
    });
  });

  describe('jsonSchema', () => {
    it('should return the tier config validation schema', () => {
      expect(UserTierModel.jsonSchema).toBe(UserTierValidationSchema);
    });
  });

  describe('instance properties', () => {
    let model: UserTierModel;
    beforeEach(() => {
      model = new UserTierModel();
      model.id = 'tier-config-1';
      model.tier_id = 'tier-1';
      model.user_id = 'user-1';
      model.created_at = new Date('2025-06-01T00:00:00Z');
      model.updated_at = new Date('2025-06-01T12:00:00Z');
      model.deleted_at = undefined;
    });
    it('should properly store the instance properties', () => {
      expect(model.id).toBe('tier-config-1');
      expect(model.tier_id).toBe('tier-1');
      expect(model.user_id).toBe('user-1');
      expect(model.created_at).toEqual(new Date('2025-06-01T00:00:00Z'));
      expect(model.updated_at).toEqual(new Date('2025-06-01T12:00:00Z'));
      expect(model.deleted_at).toBeUndefined();
    });
    it('should inherit from BaseModel', () => {
      expect(model).toBeInstanceOf(BaseModel);
    });
  });
});
