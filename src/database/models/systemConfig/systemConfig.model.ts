import { BaseModel } from '../../base';
import { DatabaseSchema } from '../../database.schema';
import { DatabaseTables } from '../../database.table';
import { ISystemConfig } from './systemConfig.interface';
import { SystemConfigValidationSchema } from './systemConfig.validation';

export class SystemConfigModel extends BaseModel implements ISystemConfig {
  public key: ISystemConfig['key'];
  public type: ISystemConfig['type'];
  public is_enabled: ISystemConfig['is_enabled'];
  public description?: ISystemConfig['description'];
  public value?: ISystemConfig['value'];

  static get tableName() {
    return `${DatabaseSchema.apiService}.${DatabaseTables.system_configs}`;
  }

  static publicProperty(properties: (keyof ISystemConfig)[] = []): (keyof ISystemConfig)[] {
    return ['id', 'key', 'type', 'is_enabled', 'description', 'value', 'created_at', 'updated_at', ...properties];
  }

  static get jsonSchema() {
    return SystemConfigValidationSchema;
  }

  static get modifiers() {
    return {
      notDeleted(query) {
        query.whereNull('deleted_at');
      },
    };
  }
}
