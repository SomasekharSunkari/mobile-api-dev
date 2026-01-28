import { BaseModel } from '../../base';
import { DatabaseSchema } from '../../database.schema';
import { DatabaseTables } from '../../database.table';
import { AccountDeleteRequestModel } from '../accountDeleteRequest/accountDeleteRequest.model';
import { BlockchainWalletModel } from '../blockchain_wallet/blockchain_wallet.model';
import { CountryModel } from '../country/country.model';
import { RoleModel } from '../role';
import { TransactionPinModel } from '../transactionPin/transactionPin.model';

import { UserProfileModel } from '../userProfile/userProfile.model';
import { IUser } from './user.interface';
import { UserValidationSchema } from './user.validation';

export class UserModel extends BaseModel implements IUser {
  public first_name: IUser['first_name'];
  public last_name: IUser['last_name'];
  public middle_name?: IUser['middle_name'];
  public username: IUser['username'];
  public email: IUser['email'];
  public password: IUser['password'];
  public is_email_verified: IUser['is_email_verified'];
  public phone_number: IUser['phone_number'];
  public is_phone_verified: IUser['is_phone_verified'];
  public phone_number_country_code: IUser['phone_number_country_code'];
  public status: IUser['status'];
  public country: IUser['country'];
  public country_id: IUser['country_id'];
  public is_deactivated: IUser['is_deactivated'];
  public require_password_reset: IUser['require_password_reset'];
  public require_transaction_pin_reset: IUser['require_transaction_pin_reset'];
  public disable_login_restrictions: IUser['disable_login_restrictions'];
  public userProfile?: IUser['userProfile'];
  public userRoles: IUser['userRoles'];
  public accountDeactivationLog?: IUser['accountDeactivationLog'];

  static get tableName() {
    return `${DatabaseSchema.apiService}.${DatabaseTables.users}`;
  }

  static publicProperty(properties: (keyof IUser)[] = []): (keyof IUser)[] {
    return [
      'id',
      'first_name',
      'middle_name',
      'last_name',
      'username',
      'email',
      'is_email_verified',
      'phone_number',
      'is_phone_verified',
      'phone_number_country_code',
      'status',
      'is_deactivated',
      'country_id',
      'require_password_reset',
      'require_transaction_pin_reset',
      'disable_login_restrictions',
      ...properties,
    ];
  }

  static get jsonSchema() {
    return UserValidationSchema;
  }

  static get relationMappings() {
    return {
      userProfile: {
        relation: BaseModel.HasOneRelation,
        modelClass: UserProfileModel,
        join: {
          from: `${DatabaseSchema.apiService}.${DatabaseTables.users}.id`,
          to: `${DatabaseSchema.apiService}.${DatabaseTables.users_profiles}.user_id`,
        },
      },
      userRoles: {
        relation: BaseModel.ManyToManyRelation,
        modelClass: RoleModel,
        join: {
          from: `${DatabaseSchema.apiService}.${DatabaseTables.users}.id`,
          through: {
            from: `${DatabaseSchema.apiService}.${DatabaseTables.users_roles}.user_id`,
            to: `${DatabaseSchema.apiService}.${DatabaseTables.users_roles}.role_id`,
          },
          to: `${DatabaseSchema.apiService}.${DatabaseTables.roles}.id`,
        },
      },
      country: {
        relation: BaseModel.BelongsToOneRelation,
        modelClass: CountryModel,
        join: {
          from: `${DatabaseSchema.apiService}.${DatabaseTables.users}.country_id`,
          to: `${DatabaseSchema.apiService}.${DatabaseTables.countries}.id`,
        },
      },
      blockchainWallets: {
        relation: BaseModel.HasManyRelation,
        modelClass: BlockchainWalletModel,
        join: {
          from: `${DatabaseSchema.apiService}.${DatabaseTables.users}.id`,
          to: `${DatabaseSchema.apiService}.${DatabaseTables.blockchain_wallets}.user_id`,
        },
      },
      transactionPin: {
        relation: BaseModel.HasOneRelation,
        modelClass: TransactionPinModel,
        join: {
          from: `${DatabaseSchema.apiService}.${DatabaseTables.users}.id`,
          to: `${DatabaseSchema.apiService}.${DatabaseTables.transaction_pins}.user_id`,
        },
      },
      accountDeleteRequest: {
        relation: BaseModel.HasOneRelation,
        modelClass: AccountDeleteRequestModel,
        join: {
          from: `${DatabaseSchema.apiService}.${DatabaseTables.users}.id`,
          to: `${DatabaseSchema.apiService}.${DatabaseTables.account_delete_requests}.user_id`,
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
