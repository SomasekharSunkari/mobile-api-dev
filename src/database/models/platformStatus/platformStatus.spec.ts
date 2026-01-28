import { PlatformStatusModel } from './platformStatus.model';
import { PlatformStatusEnum } from './platformStatus.interface';

describe('PlatformStatusModel', () => {
  it('should have correct table name', () => {
    expect(PlatformStatusModel.tableName).toBe('api_service.platform_statuses');
  });

  it('should return public properties', () => {
    const publicProps = PlatformStatusModel.publicProperty();
    expect(publicProps).toContain('id');
    expect(publicProps).toContain('service_key');
    expect(publicProps).toContain('service_name');
    expect(publicProps).toContain('status');
    expect(publicProps).toContain('last_checked_at');
    expect(publicProps).toContain('last_failure_at');
    expect(publicProps).toContain('failure_reason');
    expect(publicProps).toContain('is_manually_set');
    expect(publicProps).toContain('custom_message');
    expect(publicProps).toContain('created_at');
    expect(publicProps).toContain('updated_at');
  });

  it('should allow adding additional public properties', () => {
    const publicProps = PlatformStatusModel.publicProperty(['statusLogs']);
    expect(publicProps).toContain('statusLogs');
  });

  it('should have validation schema', () => {
    expect(PlatformStatusModel.jsonSchema).toBeDefined();
    expect(PlatformStatusModel.jsonSchema.required).toContain('service_key');
    expect(PlatformStatusModel.jsonSchema.required).toContain('service_name');
    expect(PlatformStatusModel.jsonSchema.required).toContain('status');
    expect(PlatformStatusModel.jsonSchema.properties).toHaveProperty('is_manually_set');
  });

  it('should have relation mappings for statusLogs', () => {
    const relations = PlatformStatusModel.relationMappings;
    expect(relations).toBeDefined();
    expect(relations.statusLogs).toBeDefined();
    expect(relations.statusLogs.relation).toBeDefined();
  });

  it('should have modifiers defined', () => {
    const modifiers = PlatformStatusModel.modifiers;
    expect(modifiers).toBeDefined();
    expect(modifiers.notDeleted).toBeDefined();
    expect(typeof modifiers.notDeleted).toBe('function');
  });
});

describe('PlatformStatusEnum', () => {
  it('should have OPERATIONAL status', () => {
    expect(PlatformStatusEnum.OPERATIONAL).toBe('operational');
  });

  it('should have DEGRADED status', () => {
    expect(PlatformStatusEnum.DEGRADED).toBe('degraded');
  });

  it('should have DOWN status', () => {
    expect(PlatformStatusEnum.DOWN).toBe('down');
  });
});
