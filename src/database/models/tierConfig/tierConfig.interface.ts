import { IBase } from '../../base';
import { ICountry } from '../country/country.interface';
import { ITier } from '../tier/tier.interface';
import { ITierConfigVerificationRequirement } from '../tierConfigVerificationRequirement/tierConfigVerificationRequirement.interface';

export interface ITierConfig extends IBase {
  tier_id: string;
  country_id: string;
  minimum_balance: number;
  maximum_balance: number;
  minimum_per_deposit: number;
  maximum_per_deposit: number;
  maximum_daily_deposit: number;
  maximum_monthly_deposit: number;
  minimum_transaction_amount: number;
  maximum_transaction_amount: number;
  maximum_daily_transaction: number;

  maximum_weekly_deposit: number;
  maximum_weekly_transaction: number;
  minimum_per_withdrawal: number;
  maximum_per_withdrawal: number;
  maximum_daily_withdrawal: number;
  maximum_weekly_withdrawal: number;
  maximum_monthly_withdrawal: number;

  maximum_monthly_transaction: number;

  // remittance
  remittance_minimum_per_deposit?: number;
  remittance_maximum_per_deposit?: number;
  remittance_maximum_daily_deposit?: number;
  remittance_maximum_weekly_deposit?: number;
  remittance_maximum_weekly_transaction?: number;
  remittance_maximum_monthly_deposit?: number;
  remittance_minimum_transaction_amount?: number;
  remittance_maximum_transaction_amount?: number;
  remittance_maximum_daily_transaction?: number;
  remittance_maximum_monthly_transaction?: number;
  remittance_minimum_per_withdrawal?: number;
  remittance_maximum_per_withdrawal?: number;
  remittance_maximum_daily_withdrawal?: number;
  remittance_maximum_weekly_withdrawal?: number;
  remittance_maximum_monthly_withdrawal?: number;
  total_spendable?: number;
  total_receivable?: number;

  // pending transaction count limits (US users)
  maximum_pending_deposits_count?: number;
  maximum_pending_withdrawals_count?: number;

  // weekly transaction count limits (US users)
  maximum_weekly_deposit_count?: number;
  maximum_weekly_withdrawal_count?: number;

  // relations
  country?: ICountry;
  tier?: ITier;
  tierConfigVerificationRequirements?: ITierConfigVerificationRequirement[];
}
