import { DatabaseSchema } from '../../database.schema';
import { DatabaseTables } from '../../database.table';
import { FeatureFlagModel } from './featureFlag.model';
import { FeatureFlagValidationSchema } from './featureFlag.validation';

describe('FeatureFlagModel', () => {
  describe('tableName', () => {
    it('should return the correct table name', () => {
      expect(FeatureFlagModel.tableName).toBe(`${DatabaseSchema.apiService}.${DatabaseTables.feature_flags}`);
    });
  });

  describe('publicProperty', () => {
    it('should return all public properties', () => {
      const properties = FeatureFlagModel.publicProperty();
      expect(properties).toContain('id');
      expect(properties).toContain('key');
      expect(properties).toContain('description');
      expect(properties).toContain('enabled');
      expect(properties).toContain('expires_at');
      expect(properties).toContain('created_at');
      expect(properties).toContain('updated_at');
    });

    it('should accept additional properties', () => {
      const properties = FeatureFlagModel.publicProperty(['deleted_at']);
      expect(properties).toContain('deleted_at');
    });
  });

  describe('jsonSchema', () => {
    it('should return the feature flag validation schema', () => {
      expect(FeatureFlagModel.jsonSchema).toBe(FeatureFlagValidationSchema);
    });

    it('should have required fields', () => {
      const schema = FeatureFlagModel.jsonSchema;
      expect(schema.required).toContain('key');
    });

    it('should have correct property types', () => {
      const schema = FeatureFlagModel.jsonSchema;
      expect((schema.properties.key as any).type).toBe('string');
      expect((schema.properties.enabled as any).type).toBe('boolean');
    });

    it('should have default value for enabled', () => {
      const schema = FeatureFlagModel.jsonSchema;
      expect((schema.properties.enabled as any).default).toBe(false);
    });

    it('should allow nullable description', () => {
      const schema = FeatureFlagModel.jsonSchema;
      expect((schema.properties.description as any).type).toContain('string');
      expect((schema.properties.description as any).type).toContain('null');
    });

    it('should allow nullable expires_at', () => {
      const schema = FeatureFlagModel.jsonSchema;
      expect((schema.properties.expires_at as any).type).toContain('string');
      expect((schema.properties.expires_at as any).type).toContain('null');
    });

    it('should validate key length', () => {
      const schema = FeatureFlagModel.jsonSchema;
      expect((schema.properties.key as any).minLength).toBe(1);
      expect((schema.properties.key as any).maxLength).toBe(255);
    });
  });

  describe('relationMappings', () => {
    it('should have overrides relation', () => {
      const relations = FeatureFlagModel.relationMappings;
      expect(relations.overrides).toBeDefined();
      expect(typeof relations.overrides.relation).toBe('function');
    });
  });

  describe('model instance', () => {
    it('should create a valid instance', () => {
      const featureFlag = new FeatureFlagModel();
      featureFlag.key = 'new_feature_x';
      featureFlag.description = 'Test feature flag';
      featureFlag.enabled = true;

      expect(featureFlag.key).toBe('new_feature_x');
      expect(featureFlag.description).toBe('Test feature flag');
      expect(featureFlag.enabled).toBe(true);
    });

    it('should allow description to be undefined', () => {
      const featureFlag = new FeatureFlagModel();
      featureFlag.key = 'minimal_feature';
      featureFlag.enabled = false;

      expect(featureFlag.description).toBeUndefined();
    });

    it('should allow expires_at to be undefined', () => {
      const featureFlag = new FeatureFlagModel();
      featureFlag.key = 'permanent_feature';
      featureFlag.enabled = true;

      expect(featureFlag.expires_at).toBeUndefined();
    });

    it('should set expires_at as Date', () => {
      const featureFlag = new FeatureFlagModel();
      const expirationDate = new Date('2025-12-31');
      featureFlag.key = 'temporary_feature';
      featureFlag.enabled = true;
      featureFlag.expires_at = expirationDate;

      expect(featureFlag.expires_at).toEqual(expirationDate);
    });

    it('should handle boolean enabled state', () => {
      const featureFlag = new FeatureFlagModel();
      featureFlag.key = 'toggle_feature';

      featureFlag.enabled = true;
      expect(featureFlag.enabled).toBe(true);

      featureFlag.enabled = false;
      expect(featureFlag.enabled).toBe(false);
    });
  });
});
