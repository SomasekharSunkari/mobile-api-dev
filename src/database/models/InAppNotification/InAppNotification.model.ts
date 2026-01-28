import { BaseModel } from '../../base';
import { DatabaseSchema } from '../../database.schema';
import { DatabaseTables } from '../../database.table';
import { UserModel } from '../user';

import { IInAppNotification } from './InAppNotification.interface';
import { InAppNotificationValidationSchema } from './InAppNotification.validation';

export class InAppNotificationModel extends BaseModel implements IInAppNotification {
  public id: string;
  public user_id: IInAppNotification['user_id'];
  public type: IInAppNotification['type'];
  public title: IInAppNotification['title'];
  public message: IInAppNotification['message'];
  public is_read: IInAppNotification['is_read'];
  public metadata?: IInAppNotification['metadata'];

  static get tableName() {
    return `${DatabaseSchema.apiService}.${DatabaseTables.in_app_notifications}`;
  }

  static publicProperty(): (keyof IInAppNotification)[] {
    return ['id', 'user_id', 'type', 'title', 'message', 'is_read', 'metadata', 'created_at', 'updated_at'];
  }
  static get jsonSchema() {
    return InAppNotificationValidationSchema;
  }

  static get relationMappings() {
    return {
      user: {
        relation: BaseModel.BelongsToOneRelation,
        modelClass: UserModel,
        join: {
          from: `${DatabaseSchema.apiService}.${DatabaseTables.in_app_notifications}.user_id`,
          to: `${DatabaseSchema.apiService}.${DatabaseTables.users}.id`,
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
