export enum CardFeeType {
  DOMESTIC_PURCHASE = 'domestic_purchase',
  CROSS_BORDER_FX = 'cross_border_fx',
  INSUFFICIENT_FUNDS = 'insufficient_funds',
  FIAT_TOP_UP = 'fiat_top_up',
  STABLECOIN_TOP_UP = 'stablecoin_top_up',
  ATM_BALANCE_INQUIRY = 'atm_balance_inquiry',
  ATM_DECLINE = 'atm_decline',
  ATM_WITHDRAWAL = 'atm_withdrawal',
  PHYSICAL_CARD_FIRST_ISSUE = 'physical_card_first_issue',
  PHYSICAL_CARD_REPLACEMENT = 'physical_card_replacement',
  VIRTUAL_CARD_ISSUANCE = 'virtual_card_issuance',
  DISPUTE_CHARGEBACK = 'dispute_chargeback',
}

export enum CardFeeCalculationType {
  PERCENTAGE = 'percentage',
  FIXED = 'fixed',
  PERCENTAGE_PLUS_FIXED = 'percentage_plus_fixed',
  NONE = 'none',
}

/**
 * Maximum transaction amount limit (in cents)
 * Set to undefined to disable the cap
 */
export const MAX_TRANSACTION_AMOUNT: number | undefined = undefined;

/**
 * Maximum consecutive insufficient funds declines before blocking the card
 */
export const MAX_INSUFFICIENT_FUNDS_DECLINES = 3;

export interface CardFeeConfig {
  feeType: CardFeeType;
  calculationType: CardFeeCalculationType;
  percentage?: number;
  fixed?: number;
  description: string;
  comment: string;
  appliedBy: 'rain' | 'platform' | 'both';
  requiresChargeApi?: boolean;
}

/**
 * Minimum fee amount for charge API transactions (in dollars)
 */
export const MINIMUM_CHARGE_API_FEE = 0.01;

/**
 * Minimum card funding amounts (USD)
 */
export const CARD_INITIAL_FUNDING_MIN_USD = 5;
export const CARD_SUBSEQUENT_FUNDING_MIN_USD = 0;

const CardFeesConfiguration: CardFeeConfig[] = [
  {
    feeType: CardFeeType.DOMESTIC_PURCHASE,
    calculationType: CardFeeCalculationType.NONE,
    fixed: 0,
    description: 'Domestic purchases',
    comment: '$0 (+ variable network fees)',
    appliedBy: 'rain',
  },
  {
    feeType: CardFeeType.CROSS_BORDER_FX,
    calculationType: CardFeeCalculationType.PERCENTAGE,
    percentage: 2,
    description: 'Cross-border &/or FX (merchant country ≠ billing OR txn currency ≠ billing)',
    comment: '2% per txn (charge once per txn even if both cross-border & FX apply)',
    appliedBy: 'rain',
  },
  {
    feeType: CardFeeType.INSUFFICIENT_FUNDS,
    calculationType: CardFeeCalculationType.FIXED,
    fixed: 0.25,
    description: 'Insufficient funds / soft decline',
    comment: '$0.25 per transaction',
    appliedBy: 'platform',
    requiresChargeApi: true,
  },
  {
    feeType: CardFeeType.FIAT_TOP_UP,
    calculationType: CardFeeCalculationType.PERCENTAGE,
    percentage: 0.5,
    description: 'Fiat top-up',
    comment: '0.5%',
    appliedBy: 'platform',
    requiresChargeApi: true,
  },
  {
    feeType: CardFeeType.STABLECOIN_TOP_UP,
    calculationType: CardFeeCalculationType.PERCENTAGE,
    percentage: 0.5,
    description: 'Stablecoin top-up',
    comment: '0.5% platform + network gas (pass-through)',
    appliedBy: 'platform',
    requiresChargeApi: true,
  },
  {
    feeType: CardFeeType.ATM_BALANCE_INQUIRY,
    calculationType: CardFeeCalculationType.FIXED,
    fixed: 1,
    description: 'ATM balance inquiry',
    comment: '$1',
    appliedBy: 'rain',
  },
  {
    feeType: CardFeeType.ATM_DECLINE,
    calculationType: CardFeeCalculationType.FIXED,
    fixed: 1,
    description: 'ATM decline',
    comment: '$1',
    appliedBy: 'rain',
  },
  {
    feeType: CardFeeType.ATM_WITHDRAWAL,
    calculationType: CardFeeCalculationType.PERCENTAGE_PLUS_FIXED,
    percentage: 0.75,
    fixed: 2,
    description: 'ATM withdrawal',
    comment: '$2 + 0.75%',
    appliedBy: 'rain',
  },
  {
    feeType: CardFeeType.PHYSICAL_CARD_FIRST_ISSUE,
    calculationType: CardFeeCalculationType.FIXED,
    fixed: 0,
    description: 'Physical card – first issue',
    comment: '$X (TBD)',
    appliedBy: 'rain',
    requiresChargeApi: true,
  },
  {
    feeType: CardFeeType.PHYSICAL_CARD_REPLACEMENT,
    calculationType: CardFeeCalculationType.FIXED,
    fixed: 0,
    description: 'Physical card – replacement',
    comment: '$X (TBD)',
    appliedBy: 'rain',
    requiresChargeApi: true,
  },
  {
    feeType: CardFeeType.VIRTUAL_CARD_ISSUANCE,
    calculationType: CardFeeCalculationType.FIXED,
    fixed: 1,
    description: 'Virtual card issuance',
    comment: '$1',
    appliedBy: 'platform',
    requiresChargeApi: true,
  },
  {
    feeType: CardFeeType.DISPUTE_CHARGEBACK,
    calculationType: CardFeeCalculationType.FIXED,
    fixed: 30,
    description: 'Disputes / chargebacks',
    comment: '$30 (Rain cost)',
    appliedBy: 'rain',
    requiresChargeApi: true,
  },
];

export class CardFeesService {
  /**
   * Get fee configuration by fee type
   */
  static getFeeConfig(feeType: CardFeeType): CardFeeConfig | undefined {
    return CardFeesConfiguration.find((config) => config.feeType === feeType);
  }

  /**
   * Calculate fee amount based on transaction amount and fee type
   */
  static calculateFee(
    transactionAmount: number,
    feeType: CardFeeType,
  ): {
    fee: number;
    feePercentage?: number;
    feeFixed?: number;
    feeType: CardFeeCalculationType;
  } {
    const feeConfig = this.getFeeConfig(feeType);

    if (!feeConfig) {
      return {
        fee: 0,
        feeType: CardFeeCalculationType.NONE,
      };
    }

    let calculatedFee = 0;
    let feePercentage: number | undefined;
    let feeFixed: number | undefined;

    switch (feeConfig.calculationType) {
      case CardFeeCalculationType.PERCENTAGE:
        if (feeConfig.percentage) {
          calculatedFee = (transactionAmount * feeConfig.percentage) / 100;
          feePercentage = feeConfig.percentage;
        }
        break;

      case CardFeeCalculationType.FIXED:
        if (feeConfig.fixed) {
          calculatedFee = feeConfig.fixed;
          feeFixed = feeConfig.fixed;
        }
        break;

      case CardFeeCalculationType.PERCENTAGE_PLUS_FIXED: {
        let percentageAmount = 0;
        if (feeConfig.percentage) {
          percentageAmount = (transactionAmount * feeConfig.percentage) / 100;
          feePercentage = feeConfig.percentage;
        }
        if (feeConfig.fixed) {
          feeFixed = feeConfig.fixed;
        }
        calculatedFee = (feeConfig.fixed || 0) + percentageAmount;
        break;
      }

      case CardFeeCalculationType.NONE:
      default:
        break;
    }

    return {
      fee: calculatedFee,
      feePercentage,
      feeFixed,
      feeType: feeConfig.calculationType,
    };
  }

  /**
   * Get all fee configurations
   */
  static getAllFeeConfigs(): CardFeeConfig[] {
    return CardFeesConfiguration;
  }

  /**
   * Get fee configurations by applied by
   */
  static getFeeConfigsByAppliedBy(appliedBy: 'rain' | 'platform' | 'both'): CardFeeConfig[] {
    return CardFeesConfiguration.filter((config) => config.appliedBy === appliedBy);
  }

  /**
   * Check if fee requires charge API call
   */
  static requiresChargeApi(feeType: CardFeeType): boolean {
    const feeConfig = this.getFeeConfig(feeType);
    return feeConfig?.requiresChargeApi || false;
  }
}
