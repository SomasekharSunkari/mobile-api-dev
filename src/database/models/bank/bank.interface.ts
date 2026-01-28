import { IBase } from '../../base';
import { CountryModel } from '../country';

export interface IBank extends IBase {
  name: string;
  code: string;
  country_id: string;
  status?: 'active' | 'inactive';
  short_name?: string;
  logo?: string;
  country?: CountryModel;
}
