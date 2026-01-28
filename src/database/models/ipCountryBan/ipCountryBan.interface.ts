import { IBase } from '../../base';

export interface IIpCountryBan extends IBase {
  type: string;
  value: string;
  reason?: string;
}
