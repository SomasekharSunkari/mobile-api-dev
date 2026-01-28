import { BaseModel } from '../../base';
import { DatabaseSchema } from '../../database.schema';
import { DatabaseTables } from '../../database.table';
import { UserModel } from '../user/user.model';
import { DoshPointsAccountStatus, IDoshPointsAccount } from './doshPointsAccount.interface';
import { DoshPointsAccountValidationSchema } from './doshPointsAccount.validation';

export class DoshPointsAccountModel extends BaseModel implements IDoshPointsAccount {
  public user_id: IDoshPointsAccount['user_id'];
  public balance: IDoshPointsAccount['balance'];
  public status: IDoshPointsAccount['status'];
  public usd_fiat_rewards_enabled: IDoshPointsAccount['usd_fiat_rewards_enabled'];

  public user?: IDoshPointsAccount['user'];

  static get tableName() {
    return `${DatabaseSchema.apiService}.${DatabaseTables.dosh_points_accounts}`;
  }

  static publicProperty(properties: (keyof IDoshPointsAccount)[] = []): (keyof IDoshPointsAccount)[] {
    return [
      'id',
      'user_id',
      'balance',
      'status',
      'usd_fiat_rewards_enabled',
      'created_at',
      'updated_at',
      ...properties,
    ];
  }

  static get jsonSchema() {
    return DoshPointsAccountValidationSchema;
  }

  static get relationMappings() {
    return {
      user: {
        relation: BaseModel.BelongsToOneRelation,
        modelClass: UserModel,
        join: {
          from: `${DatabaseSchema.apiService}.${DatabaseTables.dosh_points_accounts}.user_id`,
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
      active(query) {
        query.where('status', DoshPointsAccountStatus.ACTIVE);
      },
    };
  }
}
