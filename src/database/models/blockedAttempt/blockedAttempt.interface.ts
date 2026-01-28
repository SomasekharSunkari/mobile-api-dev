import { IBase } from '../../base';

export interface IBlockedAttempt extends IBase {
  ip_address: string;
  country_code?: string;
  reason: string;
  path: string;
}
