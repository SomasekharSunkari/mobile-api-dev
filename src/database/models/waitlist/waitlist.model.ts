import { BaseModel } from '../../base';
import { DatabaseSchema } from '../../database.schema';
import { DatabaseTables } from '../../database.table';
import { UserModel } from '../user/user.model';
import { IWaitlist } from './waitlist.interface';
import { WaitlistValidationSchema } from './waitlist.validation';

export class WaitlistModel extends BaseModel implements IWaitlist {
  public user_id: IWaitlist['user_id'];
  public user_email: IWaitlist['user_email'];
  public reason: IWaitlist['reason'];
  public feature: IWaitlist['feature'];

  static get tableName() {
    return `${DatabaseSchema.apiService}.${DatabaseTables.waitlist}`;
  }

  static publicProperty(properties: (keyof IWaitlist)[] = []): (keyof IWaitlist)[] {
    return ['id', 'user_id', 'user_email', 'reason', 'feature', ...properties];
  }

  static get jsonSchema() {
    return WaitlistValidationSchema;
  }

  static get relationMappings() {
    return {
      user: {
        relation: BaseModel.BelongsToOneRelation,
        modelClass: UserModel,
        join: {
          from: `${DatabaseSchema.apiService}.${DatabaseTables.waitlist}.user_id`,
          to: `${DatabaseSchema.apiService}.${DatabaseTables.users}.id`,
        },
      },
    };
  }
}
