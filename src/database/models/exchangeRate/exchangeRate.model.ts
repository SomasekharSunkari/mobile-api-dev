import { BaseModel } from '../../base';
import { DatabaseSchema } from '../../database.schema';
import { DatabaseTables } from '../../database.table';
import { IExchangeRate } from './exchangeRate.interface';
import { ExchangeRateValidationSchema } from './exchangeRate.validation';

export class ExchangeRateModel extends BaseModel implements IExchangeRate {
  public provider: IExchangeRate['provider'];
  public buying_currency_code: IExchangeRate['buying_currency_code'];
  public selling_currency_code: IExchangeRate['selling_currency_code'];
  public rate: IExchangeRate['rate'];
  public provider_rate_ref: IExchangeRate['provider_rate_ref'];
  public expires_at?: IExchangeRate['expires_at'];
  public provider_rate: IExchangeRate['provider_rate'];
  static get tableName() {
    return `${DatabaseSchema.apiService}.${DatabaseTables.exchange_rates}`;
  }

  static publicProperty(properties: (keyof IExchangeRate)[] = []): (keyof IExchangeRate)[] {
    return [
      'id',
      'provider',
      'buying_currency_code',
      'selling_currency_code',
      'rate',
      'provider_rate_ref',
      'expires_at',
      'provider_rate',
      'created_at',
      'updated_at',
      ...properties,
    ];
  }

  static get jsonSchema() {
    return ExchangeRateValidationSchema;
  }
}
