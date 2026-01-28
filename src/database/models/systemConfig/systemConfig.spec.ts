import { SystemConfigModel } from './systemConfig.model';

describe('SystemConfigModel', () => {
  it('should have correct table name', () => {
    expect(SystemConfigModel.tableName).toBe('api_service.system_configs');
  });

  it('should return public properties', () => {
    const publicProps = SystemConfigModel.publicProperty();
    expect(publicProps).toContain('id');
    expect(publicProps).toContain('key');
    expect(publicProps).toContain('type');
    expect(publicProps).toContain('is_enabled');
    expect(publicProps).toContain('description');
    expect(publicProps).toContain('created_at');
    expect(publicProps).toContain('updated_at');
  });

  it('should have validation schema', () => {
    expect(SystemConfigModel.jsonSchema).toBeDefined();
    expect(SystemConfigModel.jsonSchema.required).toContain('key');
    expect(SystemConfigModel.jsonSchema.required).toContain('type');
    expect(SystemConfigModel.jsonSchema.required).toContain('is_enabled');
  });
});
