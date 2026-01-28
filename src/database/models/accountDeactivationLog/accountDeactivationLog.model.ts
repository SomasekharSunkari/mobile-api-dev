import { JSONSchema } from 'objection';
import { BaseModel } from '../../base';
import { DatabaseTables } from '../../database.table';

import { DatabaseSchema } from '../../database.schema';
import { UserModel } from '../user';
import { IAccountDeactivationLog } from './accountDeactivationLog.interface';
import { AccountDeactivationLogValidation } from './accountDeactivationLog.validation';

export class AccountDeactivationLogModel extends BaseModel implements IAccountDeactivationLog {
  public id: IAccountDeactivationLog['id'];
  public user_id: IAccountDeactivationLog['user_id'];
  public reasons: IAccountDeactivationLog['reasons'];
  public status: IAccountDeactivationLog['status'];
  public deactivated_on: IAccountDeactivationLog['deactivated_on'];
  public deactivated_by_user_id: IAccountDeactivationLog['deactivated_by_user_id'];
  public is_active_log: IAccountDeactivationLog['is_active_log'];
  public reactivated_on: IAccountDeactivationLog['reactivated_on'];
  public reactivated_by_user_id: IAccountDeactivationLog['reactivated_by_user_id'];
  public reactivation_description: IAccountDeactivationLog['reactivation_description'];
  public reactivation_support_document_url: IAccountDeactivationLog['reactivation_support_document_url'];
  public created_at: IAccountDeactivationLog['created_at'];
  public updated_at: IAccountDeactivationLog['updated_at'];
  public deleted_at: IAccountDeactivationLog['deleted_at'];

  public user: IAccountDeactivationLog['user'];
  public deactivatedBy: IAccountDeactivationLog['deactivatedBy'];
  public reactivatedBy: IAccountDeactivationLog['reactivatedBy'];
  static get tableName() {
    return DatabaseSchema.apiService + '.' + DatabaseTables.account_deactivation_logs;
  }

  static get jsonSchema(): JSONSchema {
    return AccountDeactivationLogValidation;
  }

  static get relationMappings() {
    return {
      user: {
        relation: BaseModel.BelongsToOneRelation,
        modelClass: UserModel,
        join: {
          from: `${DatabaseSchema.apiService}.${DatabaseTables.users}.id`,
          to: `${DatabaseSchema.apiService}.${DatabaseTables.account_deactivation_logs}.user_id`,
        },
      },
      deactivatedBy: {
        relation: BaseModel.BelongsToOneRelation,
        modelClass: UserModel,
        join: {
          from: `${DatabaseSchema.apiService}.${DatabaseTables.users}.id`,
          to: `${DatabaseSchema.apiService}.${DatabaseTables.account_deactivation_logs}.deactivated_by_user_id`,
        },
      },
      reactivatedBy: {
        relation: BaseModel.BelongsToOneRelation,
        modelClass: UserModel,
        join: {
          from: `${DatabaseSchema.apiService}.${DatabaseTables.users}.id`,
          to: `${DatabaseSchema.apiService}.${DatabaseTables.account_deactivation_logs}.reactivated_by_user_id`,
        },
      },
    };
  }
}
