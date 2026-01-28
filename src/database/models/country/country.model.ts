import { BaseModel } from '../../base';
import { DatabaseSchema } from '../../database.schema';
import { DatabaseTables } from '../../database.table';

import { ICountry } from './country.interface';
import { CountryValidationSchema } from './country.validation';

export class CountryModel extends BaseModel implements ICountry {
  public id: string;
  public name: ICountry['name'];
  public code: ICountry['code'];
  public is_supported: ICountry['is_supported'];
  public phone_code: ICountry['phone_code'];
  public currency_code: ICountry['currency_code'];
  public currency_denominator_code: ICountry['currency_denominator_code'];

  static get tableName() {
    return `${DatabaseSchema.apiService}.${DatabaseTables.countries}`;
  }

  static publicProperty(): (keyof ICountry)[] {
    return [
      'id',
      'name',
      'code',
      'is_supported',
      'created_at',
      'updated_at',
      'currency_code',
      'currency_denominator_code',
    ];
  }

  static get jsonSchema() {
    return CountryValidationSchema;
  }
}
