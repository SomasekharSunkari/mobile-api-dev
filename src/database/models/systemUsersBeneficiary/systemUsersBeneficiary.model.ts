import { BaseModel } from '../../base';
import { DatabaseSchema } from '../../database.schema';
import { DatabaseTables } from '../../database.table';
import { UserModel } from '../user/user.model';
import { ISystemUsersBeneficiary } from './systemUsersBeneficiary.interface';
import { SystemUsersBeneficiaryValidationSchema } from './systemUsersBeneficiary.validation';

export class SystemUsersBeneficiaryModel extends BaseModel implements ISystemUsersBeneficiary {
  public sender_user_id: ISystemUsersBeneficiary['sender_user_id'];
  public beneficiary_user_id: ISystemUsersBeneficiary['beneficiary_user_id'];
  public alias_name?: ISystemUsersBeneficiary['alias_name'];
  public avatar_url?: ISystemUsersBeneficiary['avatar_url'];

  public senderUser?: ISystemUsersBeneficiary['senderUser'];
  public beneficiaryUser?: ISystemUsersBeneficiary['beneficiaryUser'];

  static get tableName() {
    return `${DatabaseSchema.apiService}.${DatabaseTables.system_users_beneficiaries}`;
  }

  static publicProperty(properties: (keyof ISystemUsersBeneficiary)[] = []): (keyof ISystemUsersBeneficiary)[] {
    return [
      'id',
      'sender_user_id',
      'beneficiary_user_id',
      'alias_name',
      'avatar_url',
      'created_at',
      'updated_at',
      ...properties,
    ];
  }

  static get jsonSchema() {
    return SystemUsersBeneficiaryValidationSchema;
  }

  static get relationMappings() {
    return {
      senderUser: {
        relation: BaseModel.BelongsToOneRelation,
        modelClass: UserModel,
        join: {
          from: `${DatabaseSchema.apiService}.${DatabaseTables.system_users_beneficiaries}.sender_user_id`,
          to: `${DatabaseSchema.apiService}.${DatabaseTables.users}.id`,
        },
      },
      beneficiaryUser: {
        relation: BaseModel.BelongsToOneRelation,
        modelClass: UserModel,
        join: {
          from: `${DatabaseSchema.apiService}.${DatabaseTables.system_users_beneficiaries}.beneficiary_user_id`,
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
