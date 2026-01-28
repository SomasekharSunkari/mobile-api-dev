import { IBase } from '../../base';

/**
 * Full LoginDevice model interface used in code logic
 */
export interface ILoginDevice extends IBase {
  user_id: string;
  device_fingerprint: string;
  device_name: string;
  device_type: string;
  os: string;
  browser: string;
  is_trusted: boolean;
  last_verified_at: string;
  last_login: string;
}
