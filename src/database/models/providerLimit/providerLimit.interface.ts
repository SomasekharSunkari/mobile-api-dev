import { IBase } from '../../base';

export enum ProviderLimitType {
  WEEKLY_DEPOSIT = 'weekly_deposit',
  WEEKLY_WITHDRAWAL = 'weekly_withdrawal',
}

export interface IProviderLimit extends IBase {
  provider: string;
  limit_type: string;
  limit_value: number;
  currency: string;
  is_active: boolean;
  description?: string;
}
