import { BaseModel } from '../../base';
import { DatabaseSchema } from '../../database.schema';
import { DatabaseTables } from '../../database.table';
import {
  IRateConfig,
  IRateConfigConfig,
  IRateConfigFeeConfig,
  IRateConfigFiatExchange,
  IRateConfigNgnWithdrawalFee,
} from './rateConfig.interface';
import { RateConfigValidationSchema } from './rateConfig.validation';

export class RateConfigModel extends BaseModel implements IRateConfig {
  public provider: IRateConfig['provider'];
  public config: IRateConfig['config'];
  public description?: IRateConfig['description'];

  static get tableName() {
    return `${DatabaseSchema.apiService}.${DatabaseTables.rate_configs}`;
  }

  static publicProperty(properties: (keyof IRateConfig)[] = []): (keyof IRateConfig)[] {
    return ['id', 'provider', 'config', 'description', 'created_at', 'updated_at', ...properties];
  }

  static get jsonSchema() {
    return RateConfigValidationSchema;
  }

  static get modifiers() {
    return {
      notDeleted(query) {
        query.whereNull('deleted_at');
      },
      active(query) {
        query.whereRaw("(config->>'is_active')::boolean = true");
      },
    };
  }

  /**
   * Check if this rate config is active
   */
  get isActive(): boolean {
    return this.config?.is_active ?? false;
  }

  /**
   * Get the fiat exchange configuration
   */
  get fiatExchange(): IRateConfigFiatExchange | undefined {
    return this.config?.fiat_exchange;
  }

  /**
   * Get a specific fee config from fiat exchange
   */
  getFiatExchangeFee(
    feeType: keyof Omit<IRateConfigFiatExchange, 'ngn_withdrawal_fee'>,
  ): IRateConfigFeeConfig | undefined {
    return this.fiatExchange?.[feeType];
  }

  /**
   * Get NGN withdrawal fee configuration
   */
  get ngnWithdrawalFee(): IRateConfigNgnWithdrawalFee | undefined {
    return this.fiatExchange?.ngn_withdrawal_fee;
  }

  /**
   * Create a default config structure
   */
  static createDefaultConfig(overrides?: Partial<IRateConfigConfig>): IRateConfigConfig {
    return {
      fiat_exchange: {
        service_fee: { value: 0, is_percentage: false },
        partner_fee: { value: 0, is_percentage: false },
        disbursement_fee: { value: 0, is_percentage: false },
        ngn_withdrawal_fee: { value: 0, is_percentage: false, cap: 0 },
      },
      is_active: true,
      ...overrides,
    };
  }
}
