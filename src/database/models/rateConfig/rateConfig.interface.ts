import { IBase } from '../../base';

/**
 * Fee configuration structure for individual fee types
 */
export interface IRateConfigFeeConfig {
  value: number;
  currency?: string;
  is_percentage: boolean;
}

/**
 * NGN withdrawal fee configuration with cap support
 */
export interface IRateConfigNgnWithdrawalFee {
  value: number;
  is_percentage: boolean;
  cap: number;
}

/**
 * Fiat exchange configuration containing all exchange-related fees
 */
export interface IRateConfigFiatExchange {
  service_fee: IRateConfigFeeConfig;
  partner_fee: IRateConfigFeeConfig;
  disbursement_fee: IRateConfigFeeConfig;
  ngn_withdrawal_fee: IRateConfigNgnWithdrawalFee;
}

/**
 * Main config structure for rate configuration
 * Supports multiple use case categories (fiat_exchange, future use cases)
 */
export interface IRateConfigConfig {
  fiat_exchange?: IRateConfigFiatExchange;
  is_active: boolean;
}

export interface IRateConfig extends IBase {
  provider: string;
  config: IRateConfigConfig;
  description?: string;
}
