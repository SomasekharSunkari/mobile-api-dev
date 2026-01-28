import { DatabaseSchema } from '../../database.schema';
import { DatabaseTables } from '../../database.table';
import { FeatureFlagOverrideModel } from './featureFlagOverride.model';
import { FeatureFlagOverrideValidationSchema } from './featureFlagOverride.validation';

describe('FeatureFlagOverrideModel', () => {
  describe('tableName', () => {
    it('should return the correct table name', () => {
      expect(FeatureFlagOverrideModel.tableName).toBe(
        `${DatabaseSchema.apiService}.${DatabaseTables.feature_flag_overrides}`,
      );
    });
  });

  describe('publicProperty', () => {
    it('should return all public properties', () => {
      const properties = FeatureFlagOverrideModel.publicProperty();
      expect(properties).toContain('id');
      expect(properties).toContain('feature_flag_id');
      expect(properties).toContain('user_id');
      expect(properties).toContain('enabled');
      expect(properties).toContain('reason');
      expect(properties).toContain('created_at');
      expect(properties).toContain('updated_at');
    });

    it('should accept additional properties', () => {
      const properties = FeatureFlagOverrideModel.publicProperty(['deleted_at']);
      expect(properties).toContain('deleted_at');
    });
  });

  describe('jsonSchema', () => {
    it('should return the feature flag override validation schema', () => {
      expect(FeatureFlagOverrideModel.jsonSchema).toBe(FeatureFlagOverrideValidationSchema);
    });

    it('should have required fields', () => {
      const schema = FeatureFlagOverrideModel.jsonSchema;
      expect(schema.required).toContain('feature_flag_id');
      expect(schema.required).toContain('user_id');
      expect(schema.required).toContain('enabled');
    });

    it('should have correct property types', () => {
      const schema = FeatureFlagOverrideModel.jsonSchema;
      expect((schema.properties.feature_flag_id as any).type).toBe('string');
      expect((schema.properties.user_id as any).type).toBe('string');
      expect((schema.properties.enabled as any).type).toBe('boolean');
    });

    it('should allow nullable reason', () => {
      const schema = FeatureFlagOverrideModel.jsonSchema;
      expect((schema.properties.reason as any).type).toContain('string');
      expect((schema.properties.reason as any).type).toContain('null');
    });
  });

  describe('relationMappings', () => {
    it('should have feature relation', () => {
      const relations = FeatureFlagOverrideModel.relationMappings;
      expect(relations.feature).toBeDefined();
      expect(relations.feature.relation).toBeDefined();
    });

    it('should have user relation', () => {
      const relations = FeatureFlagOverrideModel.relationMappings;
      expect(relations.user).toBeDefined();
      expect(relations.user.relation).toBeDefined();
    });

    it('should define the feature relation correctly', () => {
      const relations = FeatureFlagOverrideModel.relationMappings;
      expect(relations.feature.join).toEqual({
        from: `${DatabaseSchema.apiService}.${DatabaseTables.feature_flag_overrides}.feature_flag_id`,
        to: `${DatabaseSchema.apiService}.${DatabaseTables.feature_flags}.id`,
      });
    });

    it('should define the user relation correctly', () => {
      const relations = FeatureFlagOverrideModel.relationMappings;
      expect(relations.user.join).toEqual({
        from: `${DatabaseSchema.apiService}.${DatabaseTables.feature_flag_overrides}.user_id`,
        to: `${DatabaseSchema.apiService}.${DatabaseTables.users}.id`,
      });
    });
  });

  describe('model instance', () => {
    it('should create a valid instance', () => {
      const override = new FeatureFlagOverrideModel();
      override.feature_flag_id = 'new_feature_x';
      override.user_id = 'user-123';
      override.enabled = true;
      override.reason = 'Beta tester';

      expect(override.feature_flag_id).toBe('new_feature_x');
      expect(override.user_id).toBe('user-123');
      expect(override.enabled).toBe(true);
      expect(override.reason).toBe('Beta tester');
    });

    it('should allow reason to be undefined', () => {
      const override = new FeatureFlagOverrideModel();
      override.feature_flag_id = 'feature_y';
      override.user_id = 'user-456';
      override.enabled = false;

      expect(override.reason).toBeUndefined();
    });

    it('should handle boolean enabled state', () => {
      const override = new FeatureFlagOverrideModel();
      override.feature_flag_id = 'feature_z';
      override.user_id = 'user-789';

      override.enabled = true;
      expect(override.enabled).toBe(true);

      override.enabled = false;
      expect(override.enabled).toBe(false);
    });

    it('should store relations', () => {
      const override = new FeatureFlagOverrideModel();
      override.feature_flag_id = 'feature_a';
      override.user_id = 'user-001';
      override.enabled = true;

      override.feature = {
        id: 'flag-id-1',
        key: 'feature_a',
        enabled: true,
      } as any;

      override.user = {
        id: 'user-001',
        username: 'testuser',
        email: 'test@example.com',
      } as any;

      expect(override.feature).toBeDefined();
      expect(override.feature?.key).toBe('feature_a');
      expect(override.user).toBeDefined();
      expect(override.user?.username).toBe('testuser');
    });
  });
});
