import { IBase } from '../../base';

export interface ICountry extends IBase {
  name: string;
  code: string;
  phone_code: string;
  is_supported: boolean;
  currency_code: string;
  currency_denominator_code: string;
}
