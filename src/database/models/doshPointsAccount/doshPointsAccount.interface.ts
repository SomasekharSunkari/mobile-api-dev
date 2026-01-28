import { IBase } from '../../base';
import { IUser } from '../user';

export interface IDoshPointsAccount extends IBase {
  user_id: string;
  balance: number;
  status: DoshPointsAccountStatus;
  usd_fiat_rewards_enabled: boolean | null;

  user?: IUser;
}

export const DoshPointsAccountStatus = {
  ACTIVE: 'active',
  FROZEN: 'frozen',
  CLOSED: 'closed',
} as const;

export type DoshPointsAccountStatus = (typeof DoshPointsAccountStatus)[keyof typeof DoshPointsAccountStatus];
