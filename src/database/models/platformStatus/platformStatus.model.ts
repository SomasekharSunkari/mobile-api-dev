import { BaseModel } from '../../base';
import { DatabaseSchema } from '../../database.schema';
import { DatabaseTables } from '../../database.table';
import { PlatformStatusLogModel } from '../platformStatusLog/platformStatusLog.model';
import { IPlatformStatus, PlatformStatusEnum } from './platformStatus.interface';
import { PlatformStatusValidationSchema } from './platformStatus.validation';

export class PlatformStatusModel extends BaseModel implements IPlatformStatus {
  public service_key: IPlatformStatus['service_key'];
  public service_name: IPlatformStatus['service_name'];
  public status: PlatformStatusEnum;
  public last_checked_at?: IPlatformStatus['last_checked_at'];
  public last_failure_at?: IPlatformStatus['last_failure_at'];
  public failure_reason?: IPlatformStatus['failure_reason'];
  public is_manually_set: IPlatformStatus['is_manually_set'];
  public custom_message?: IPlatformStatus['custom_message'];

  public statusLogs?: PlatformStatusLogModel[];

  static get tableName() {
    return `${DatabaseSchema.apiService}.${DatabaseTables.platform_statuses}`;
  }

  static publicProperty(properties: (keyof IPlatformStatus)[] = []): (keyof IPlatformStatus)[] {
    return [
      'id',
      'service_key',
      'service_name',
      'status',
      'last_checked_at',
      'last_failure_at',
      'failure_reason',
      'is_manually_set',
      'custom_message',
      'created_at',
      'updated_at',
      ...properties,
    ];
  }

  static get jsonSchema() {
    return PlatformStatusValidationSchema;
  }

  static get relationMappings() {
    return {
      statusLogs: {
        relation: BaseModel.HasManyRelation,
        modelClass: PlatformStatusLogModel,
        join: {
          from: `${DatabaseSchema.apiService}.${DatabaseTables.platform_statuses}.id`,
          to: `${DatabaseSchema.apiService}.${DatabaseTables.platform_status_logs}.platform_status_id`,
        },
      },
    };
  }

  static get modifiers() {
    return {
      notDeleted(query) {
        query.whereNull('deleted_at');
      },
    };
  }
}
