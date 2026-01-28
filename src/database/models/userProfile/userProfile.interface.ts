import { IBase } from '../../base';

export interface IUserProfile extends IBase {
  user_id: string;
  dob: Date | string;
  gender: string;

  address_line1: string;
  address_line2: string;
  city: string;
  state_or_province: string;
  postal_code: string;
  notification_token: string;
  avatar_url: string;
  image_key?: string;
}
