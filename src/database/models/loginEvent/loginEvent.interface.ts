import { IBase } from '../../base';

export interface ILoginEvent extends IBase {
  user_id: string;
  device_id: string;
  ip_address: string;
  login_time: string;
  city: string;
  region: string;
  country: string;
  is_vpn: boolean;
  risk_score: number;
}
