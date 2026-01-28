import { BaseModel } from '../../base';
import { DatabaseSchema } from '../../database.schema';
import { DatabaseTables } from '../../database.table';
import { PlatformStatusEnum } from '../platformStatus/platformStatus.interface';
import { PlatformStatusModel } from '../platformStatus/platformStatus.model';
import { UserModel } from '../user';
import { IPlatformStatusLog, PlatformStatusTriggeredBy } from './platformStatusLog.interface';
import { PlatformStatusLogValidationSchema } from './platformStatusLog.validation';

export class PlatformStatusLogModel extends BaseModel implements IPlatformStatusLog {
  public platform_status_id: IPlatformStatusLog['platform_status_id'];
  public previous_status?: PlatformStatusEnum;
  public new_status: PlatformStatusEnum;
  public reason?: IPlatformStatusLog['reason'];
  public triggered_by: PlatformStatusTriggeredBy;
  public admin_user_id?: IPlatformStatusLog['admin_user_id'];

  static get tableName() {
    return `${DatabaseSchema.apiService}.${DatabaseTables.platform_status_logs}`;
  }

  static publicProperty(properties: (keyof IPlatformStatusLog)[] = []): (keyof IPlatformStatusLog)[] {
    return [
      'id',
      'platform_status_id',
      'previous_status',
      'new_status',
      'reason',
      'triggered_by',
      'admin_user_id',
      'created_at',
      'updated_at',
      ...properties,
    ];
  }

  static get jsonSchema() {
    return PlatformStatusLogValidationSchema;
  }

  static get relationMappings() {
    return {
      platformStatus: {
        relation: BaseModel.BelongsToOneRelation,
        modelClass: PlatformStatusModel,
        join: {
          from: `${DatabaseSchema.apiService}.${DatabaseTables.platform_status_logs}.platform_status_id`,
          to: `${DatabaseSchema.apiService}.${DatabaseTables.platform_statuses}.id`,
        },
      },
      adminUser: {
        relation: BaseModel.BelongsToOneRelation,
        modelClass: UserModel,
        join: {
          from: `${DatabaseSchema.apiService}.${DatabaseTables.platform_status_logs}.admin_user_id`,
          to: `${DatabaseSchema.apiService}.${DatabaseTables.users}.id`,
        },
      },
    };
  }
}
