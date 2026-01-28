import { IBase } from '../../base';

export interface IDoshPointsEvent extends IBase {
  code: DoshPointsEventCode | string;
  name: string;
  description?: string;
  transaction_type: DoshPointsTransactionType;
  default_points: number;
  is_active: boolean;
  is_one_time_per_user: boolean;
  metadata?: Record<string, any>;
  start_date?: Date | string;
  end_date?: Date | string;
}

export const DoshPointsTransactionType = {
  CREDIT: 'credit',
  DEBIT: 'debit',
} as const;

export type DoshPointsTransactionType = (typeof DoshPointsTransactionType)[keyof typeof DoshPointsTransactionType];

export enum DoshPointsEventCode {
  ONBOARDING_BONUS = 'ONBOARDING_BONUS',
  REGISTRATION_BONUS = 'REGISTRATION_BONUS',
  FIRST_DEPOSIT_USD = 'FIRST_DEPOSIT_USD',
  FIRST_DEPOSIT_USD_MATCH = 'FIRST_DEPOSIT_USD_MATCH',
}
