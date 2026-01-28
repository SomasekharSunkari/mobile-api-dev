import { BaseModel } from '../../base';
import { DatabaseSchema } from '../../database.schema';
import { DatabaseTables } from '../../database.table';
import { CountryModel } from '../country/country.model';
import { UserModel } from '../user/user.model';

import { ICardUser } from './cardUser.interface';
import { CardUserValidationSchema } from './cardUser.validation';

export class CardUserModel extends BaseModel implements ICardUser {
  public user_id: ICardUser['user_id'];
  public provider_ref: ICardUser['provider_ref'];
  public provider_status: ICardUser['provider_status'];
  public status: ICardUser['status'];
  public provider_application_status_reason: ICardUser['provider_application_status_reason'];
  public provider_application_completion_url: ICardUser['provider_application_completion_url'];
  public country_id: ICardUser['country_id'];
  public salary: ICardUser['salary'];
  public ip_address: ICardUser['ip_address'];
  public occupation: ICardUser['occupation'];
  public usage_reason: ICardUser['usage_reason'];
  public monthly_spend: ICardUser['monthly_spend'];
  public wallet_address: ICardUser['wallet_address'];
  public address_network_name: ICardUser['address_network_name'];
  public balance: ICardUser['balance'];

  public user?: ICardUser['user'];
  public country?: ICardUser['country'];

  static get tableName() {
    return `${DatabaseSchema.apiService}.${DatabaseTables.card_users}`;
  }

  static publicProperty(properties: (keyof ICardUser)[] = []): (keyof ICardUser)[] {
    return [
      'id',
      'user_id',
      'provider_ref',
      'provider_status',
      'status',
      'provider_application_status_reason',
      'provider_application_completion_url',
      'country_id',
      'salary',
      'ip_address',
      'occupation',
      'usage_reason',
      'monthly_spend',
      'wallet_address',
      'address_network_name',
      'balance',
      'created_at',
      'updated_at',
      ...properties,
    ];
  }

  static get jsonSchema() {
    return CardUserValidationSchema;
  }

  static get relationMappings() {
    return {
      user: {
        relation: BaseModel.BelongsToOneRelation,
        modelClass: UserModel,
        join: {
          from: `${DatabaseSchema.apiService}.${DatabaseTables.card_users}.user_id`,
          to: `${DatabaseSchema.apiService}.${DatabaseTables.users}.id`,
        },
      },
      country: {
        relation: BaseModel.BelongsToOneRelation,
        modelClass: CountryModel,
        join: {
          from: `${DatabaseSchema.apiService}.${DatabaseTables.card_users}.country_id`,
          to: `${DatabaseSchema.apiService}.${DatabaseTables.countries}.id`,
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
