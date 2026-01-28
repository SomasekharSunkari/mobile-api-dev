interface TierConfig {
  minimum_balance: number;
  maximum_balance: number;
  minimum_per_deposit: number;
  maximum_per_deposit: number;
  maximum_daily_deposit: number;
  maximum_weekly_deposit: number;
  maximum_monthly_deposit: number;
  minimum_transaction_amount: number;
  maximum_transaction_amount: number;
  maximum_daily_transaction: number;
  maximum_weekly_transaction: number;
  maximum_monthly_transaction: number;
  minimum_per_withdrawal: number;
  maximum_per_withdrawal: number;
  maximum_daily_withdrawal: number;
  maximum_weekly_withdrawal: number;
  maximum_monthly_withdrawal: number;
  remittance_minimum_per_deposit: number;
  remittance_maximum_per_deposit: number;
  remittance_maximum_daily_deposit: number;
  remittance_maximum_weekly_deposit: number;
  remittance_maximum_monthly_deposit: number;
  remittance_minimum_transaction_amount: number;
  remittance_maximum_transaction_amount: number;
  remittance_maximum_daily_transaction: number;
  remittance_maximum_weekly_transaction: number;
  remittance_maximum_monthly_transaction: number;
  remittance_minimum_per_withdrawal: number;
  remittance_maximum_per_withdrawal: number;
  remittance_maximum_daily_withdrawal: number;
  remittance_maximum_weekly_withdrawal: number;
  remittance_maximum_monthly_withdrawal: number;
  total_spendable: number;
  total_receivable: number;
  // pending transaction count limits (US users only)
  maximum_pending_deposits_count?: number;
  maximum_pending_withdrawals_count?: number;
  // weekly transaction count limits (US users only)
  maximum_weekly_deposit_count?: number;
  maximum_weekly_withdrawal_count?: number;
}

const NGN_UNLIMITED = 10_000_000_000_00;

const NGN_TOTAL_SPENDABLE = 100_000_000_000_000_00;
const USA_TOTAL_SPENDABLE = 10_000_000_000_000_00;

export const NGN_TIER_CONFIG: Record<string, TierConfig> = {
  tier_1: {
    minimum_balance: 0,
    maximum_balance: NGN_UNLIMITED,
    minimum_per_deposit: 100,
    maximum_per_deposit: 1_000_000_00,
    maximum_daily_deposit: 3_000_000_00,
    maximum_weekly_deposit: 5_000_000_00,
    maximum_monthly_deposit: 10_000_000_00,
    minimum_transaction_amount: 100,
    maximum_transaction_amount: 1_000_000_00,
    maximum_daily_transaction: 3_000_000_00,
    maximum_weekly_transaction: 5_000_000_00,
    maximum_monthly_transaction: 10_000_000_00,
    minimum_per_withdrawal: 100,
    maximum_per_withdrawal: 1_000_000_00,
    maximum_daily_withdrawal: 3_000_000_00,
    maximum_weekly_withdrawal: 5_000_000_00,
    maximum_monthly_withdrawal: 10_000_000_00,

    // remittance
    remittance_minimum_per_deposit: 100,
    remittance_maximum_per_deposit: 1_000_000_00,
    remittance_maximum_daily_deposit: 3_000_000_00,
    remittance_maximum_weekly_deposit: 5_000_000_00,
    remittance_maximum_monthly_deposit: 10_000_000_00,
    remittance_minimum_transaction_amount: 100,
    remittance_maximum_transaction_amount: 1_000_000_00,
    remittance_maximum_daily_transaction: 3_000_000_00,
    remittance_maximum_weekly_transaction: 5_000_000_00,
    remittance_maximum_monthly_transaction: 10_000_000_00,
    remittance_minimum_per_withdrawal: 100,
    remittance_maximum_per_withdrawal: 1_000_000_00,
    remittance_maximum_daily_withdrawal: 3_000_000_00,
    remittance_maximum_weekly_withdrawal: 5_000_000_00,
    remittance_maximum_monthly_withdrawal: 10_000_000_00,
    total_spendable: NGN_TOTAL_SPENDABLE,
    total_receivable: NGN_UNLIMITED,
  },
  tier_2: {
    minimum_balance: 0,
    maximum_balance: NGN_UNLIMITED,
    minimum_per_deposit: 100,
    maximum_per_deposit: 2_000_000_00,
    maximum_daily_deposit: 5_000_000_00,
    maximum_weekly_deposit: 20_000_000_00,
    maximum_monthly_deposit: 50_000_000_00,
    minimum_transaction_amount: 100,
    maximum_transaction_amount: 2_000_000_00,
    maximum_daily_transaction: 5_000_000_00,
    maximum_weekly_transaction: 20_000_000_00,
    maximum_monthly_transaction: 50_000_000_00,
    minimum_per_withdrawal: 100,
    maximum_per_withdrawal: 2_000_000_00,
    maximum_daily_withdrawal: 5_000_000_00,
    maximum_weekly_withdrawal: 20_000_000_00,
    maximum_monthly_withdrawal: 50_000_000_00,

    // remittance
    remittance_minimum_per_deposit: 100,
    remittance_maximum_per_deposit: 2_000_000_00,
    remittance_maximum_daily_deposit: 5_000_000_00,
    remittance_maximum_weekly_deposit: 20_000_000_00,
    remittance_maximum_monthly_deposit: 50_000_000_00,
    remittance_minimum_transaction_amount: 100,
    remittance_maximum_transaction_amount: 2_000_000_00,
    remittance_maximum_daily_transaction: 5_000_000_00,
    remittance_maximum_weekly_transaction: 20_000_000_00,
    remittance_maximum_monthly_transaction: 50_000_000_00,
    remittance_minimum_per_withdrawal: 100,
    remittance_maximum_per_withdrawal: 2_000_000_00,
    remittance_maximum_daily_withdrawal: 5_000_000_00,
    remittance_maximum_weekly_withdrawal: 20_000_000_00,
    remittance_maximum_monthly_withdrawal: 50_000_000_00,
    total_spendable: NGN_TOTAL_SPENDABLE,
    total_receivable: NGN_UNLIMITED,
  },
} as const;

export const USA_TIER_CONFIG: Record<string, TierConfig> = {
  tier_1: {
    minimum_balance: 0,
    maximum_balance: 20_000_00,
    minimum_per_deposit: 1_00,
    maximum_per_deposit: 2_500_00,
    maximum_daily_deposit: 2_500_00,
    maximum_weekly_deposit: 7_500_00,
    maximum_monthly_deposit: 20_000_00,
    minimum_transaction_amount: 1_00,
    maximum_transaction_amount: 2_500_00,
    maximum_daily_transaction: 2_500_00,
    maximum_weekly_transaction: 7_500_00,
    maximum_monthly_transaction: 20_000_00,
    minimum_per_withdrawal: 1_00,
    maximum_per_withdrawal: 2_500_00,
    maximum_daily_withdrawal: 2_500_00,
    maximum_weekly_withdrawal: 7_500_00,
    maximum_monthly_withdrawal: 20_000_00,

    // remittance
    remittance_minimum_per_deposit: 1_00,
    remittance_maximum_per_deposit: 2_500_00,
    remittance_maximum_daily_deposit: 2_500_00,
    remittance_maximum_weekly_deposit: 7_500_00,
    remittance_maximum_monthly_deposit: 20_000_00,
    remittance_minimum_transaction_amount: 1_00,
    remittance_maximum_transaction_amount: 2_500_00,
    remittance_maximum_daily_transaction: 2_500_00,
    remittance_maximum_weekly_transaction: 7_500_00,
    remittance_maximum_monthly_transaction: 20_000_00,
    remittance_minimum_per_withdrawal: 1_00,
    remittance_maximum_per_withdrawal: 2_500_00,
    remittance_maximum_daily_withdrawal: 2_500_00,
    remittance_maximum_weekly_withdrawal: 7_500_00,
    remittance_maximum_monthly_withdrawal: 20_000_00,
    total_spendable: USA_TOTAL_SPENDABLE,
    total_receivable: 20_000_00,

    // pending transaction count limits
    maximum_pending_deposits_count: 3,
    maximum_pending_withdrawals_count: 2,

    // weekly transaction count limits
    maximum_weekly_deposit_count: 3,
    maximum_weekly_withdrawal_count: 5,
  },
  tier_2: {
    minimum_balance: 0,
    maximum_balance: 20_000_00,
    minimum_per_deposit: 1_00,
    maximum_per_deposit: 2_500_00,
    maximum_daily_deposit: 2_500_00,
    maximum_weekly_deposit: 7_500_00,
    maximum_monthly_deposit: 20_000_00,
    minimum_transaction_amount: 1_00,
    maximum_transaction_amount: 2_500_00,
    maximum_daily_transaction: 2_500_00,
    maximum_weekly_transaction: 7_500_00,
    maximum_monthly_transaction: 20_000_00,
    minimum_per_withdrawal: 1_00,
    maximum_per_withdrawal: 2_500_00,
    maximum_daily_withdrawal: 2_500_00,
    maximum_weekly_withdrawal: 7_500_00,
    maximum_monthly_withdrawal: 20_000_00,

    // remittance
    remittance_minimum_per_deposit: 1_00,
    remittance_maximum_per_deposit: 2_500_00,
    remittance_maximum_daily_deposit: 2_500_00,
    remittance_maximum_weekly_deposit: 7_500_00,
    remittance_maximum_monthly_deposit: 20_000_00,
    remittance_minimum_transaction_amount: 1_00,
    remittance_maximum_transaction_amount: 2_500_00,
    remittance_maximum_daily_transaction: 2_500_00,
    remittance_maximum_weekly_transaction: 7_500_00,
    remittance_maximum_monthly_transaction: 20_000_00,
    remittance_minimum_per_withdrawal: 1_00,
    remittance_maximum_per_withdrawal: 2_500_00,
    remittance_maximum_daily_withdrawal: 2_500_00,
    remittance_maximum_weekly_withdrawal: 7_500_00,
    remittance_maximum_monthly_withdrawal: 20_000_00,
    total_spendable: USA_TOTAL_SPENDABLE,
    total_receivable: 20_000_00,

    // pending transaction count limits
    maximum_pending_deposits_count: 3,
    maximum_pending_withdrawals_count: 2,

    // weekly transaction count limits
    maximum_weekly_deposit_count: 3,
    maximum_weekly_withdrawal_count: 5,
  },
} as const;

export type NGNTierLevel = keyof typeof NGN_TIER_CONFIG;
export type USATierLevel = keyof typeof USA_TIER_CONFIG;

export type NGNTierConfig = (typeof NGN_TIER_CONFIG)[NGNTierLevel];
export type USATierConfig = (typeof USA_TIER_CONFIG)[USATierLevel];
