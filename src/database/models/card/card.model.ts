import { BaseModel } from '../../base';
import { DatabaseSchema } from '../../database.schema';
import { DatabaseTables } from '../../database.table';
import { CardUserModel } from '../cardUser/cardUser.model';
import { CountryModel } from '../country/country.model';
import { UserModel } from '../user/user.model';

import { ICard } from './card.interface';
import { CardValidationSchema } from './card.validation';

export class CardModel extends BaseModel implements ICard {
  public user_id: ICard['user_id'];
  public card_user_id: ICard['card_user_id'];
  public provider_ref: ICard['provider_ref'];
  public status: ICard['status'];
  public card_type: ICard['card_type'];
  public limit: ICard['limit'];
  public limit_frequency: ICard['limit_frequency'];
  public display_name: ICard['display_name'];
  public provider_product_id: ICard['provider_product_id'];
  public provider_product_ref: ICard['provider_product_ref'];
  public art_id: ICard['art_id'];
  public last_four_digits: ICard['last_four_digits'];
  public address_line_1: ICard['address_line_1'];
  public address_line_2: ICard['address_line_2'];
  public city: ICard['city'];
  public region: ICard['region'];
  public postal_code: ICard['postal_code'];
  public country_id: ICard['country_id'];
  public is_freezed: ICard['is_freezed'];
  public expiration_month: ICard['expiration_month'];
  public expiration_year: ICard['expiration_year'];
  public balance: ICard['balance'];
  public insufficient_funds_decline_count: ICard['insufficient_funds_decline_count'];
  public issuance_fee_status: ICard['issuance_fee_status'];
  public token_wallets: ICard['token_wallets'];

  public user?: ICard['user'];
  public cardUser?: ICard['cardUser'];
  public country?: ICard['country'];

  static get tableName() {
    return `${DatabaseSchema.apiService}.${DatabaseTables.cards}`;
  }

  static publicProperty(properties: (keyof ICard)[] = []): (keyof ICard)[] {
    return [
      'id',
      'user_id',
      'card_user_id',
      'provider_ref',
      'status',
      'card_type',
      'limit',
      'limit_frequency',
      'display_name',
      'provider_product_id',
      'provider_product_ref',
      'art_id',
      'last_four_digits',
      'address_line_1',
      'address_line_2',
      'city',
      'region',
      'postal_code',
      'country_id',
      'is_freezed',
      'expiration_month',
      'expiration_year',
      'balance',
      'insufficient_funds_decline_count',
      'issuance_fee_status',
      'token_wallets',
      'created_at',
      'updated_at',
      ...properties,
    ];
  }

  static get jsonSchema() {
    return CardValidationSchema;
  }

  static get relationMappings() {
    return {
      user: {
        relation: BaseModel.BelongsToOneRelation,
        modelClass: UserModel,
        join: {
          from: `${DatabaseSchema.apiService}.${DatabaseTables.cards}.user_id`,
          to: `${DatabaseSchema.apiService}.${DatabaseTables.users}.id`,
        },
      },
      cardUser: {
        relation: BaseModel.BelongsToOneRelation,
        modelClass: CardUserModel,
        join: {
          from: `${DatabaseSchema.apiService}.${DatabaseTables.cards}.card_user_id`,
          to: `${DatabaseSchema.apiService}.${DatabaseTables.card_users}.id`,
        },
      },
      country: {
        relation: BaseModel.BelongsToOneRelation,
        modelClass: CountryModel,
        join: {
          from: `${DatabaseSchema.apiService}.${DatabaseTables.cards}.country_id`,
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
