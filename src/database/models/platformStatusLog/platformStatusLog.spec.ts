import { PlatformStatusTriggeredBy } from './platformStatusLog.interface';
import { PlatformStatusLogModel } from './platformStatusLog.model';

describe('PlatformStatusLogModel', () => {
  it('should have correct table name', () => {
    expect(PlatformStatusLogModel.tableName).toBe('api_service.platform_status_logs');
  });

  it('should return public properties', () => {
    const publicProps = PlatformStatusLogModel.publicProperty();
    expect(publicProps).toContain('id');
    expect(publicProps).toContain('platform_status_id');
    expect(publicProps).toContain('previous_status');
    expect(publicProps).toContain('new_status');
    expect(publicProps).toContain('reason');
    expect(publicProps).toContain('triggered_by');
    expect(publicProps).toContain('admin_user_id');
    expect(publicProps).toContain('created_at');
    expect(publicProps).toContain('updated_at');
  });

  it('should allow adding additional public properties', () => {
    const publicProps = PlatformStatusLogModel.publicProperty(['platform_status_id']);
    expect(publicProps).toContain('platform_status_id');
  });

  it('should have validation schema', () => {
    expect(PlatformStatusLogModel.jsonSchema).toBeDefined();
    expect(PlatformStatusLogModel.jsonSchema.required).toContain('platform_status_id');
    expect(PlatformStatusLogModel.jsonSchema.required).toContain('new_status');
    expect(PlatformStatusLogModel.jsonSchema.required).toContain('triggered_by');
  });

  it('should have relation mappings', () => {
    const relations = PlatformStatusLogModel.relationMappings;
    expect(relations).toBeDefined();
    expect(relations.platformStatus).toBeDefined();
    expect(relations.adminUser).toBeDefined();
  });

  it('should have correct platformStatus relation mapping', () => {
    const relations = PlatformStatusLogModel.relationMappings;
    expect(relations.platformStatus.relation).toBeDefined();
    expect(relations.platformStatus.join).toBeDefined();
  });

  it('should have correct adminUser relation mapping', () => {
    const relations = PlatformStatusLogModel.relationMappings;
    expect(relations.adminUser.relation).toBeDefined();
    expect(relations.adminUser.join).toBeDefined();
  });
});

describe('PlatformStatusTriggeredBy', () => {
  it('should have SYSTEM trigger type', () => {
    expect(PlatformStatusTriggeredBy.SYSTEM).toBe('system');
  });

  it('should have ADMIN trigger type', () => {
    expect(PlatformStatusTriggeredBy.ADMIN).toBe('admin');
  });
});
