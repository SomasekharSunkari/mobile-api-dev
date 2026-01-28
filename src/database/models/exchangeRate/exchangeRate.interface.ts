import { IBase } from '../../base';

export interface IExchangeRate extends IBase {
  provider: string;
  buying_currency_code: string;
  selling_currency_code: string;
  rate: number;
  provider_rate_ref: string;
  expires_at?: Date | string;
  provider_rate: number;
}
