import { JSONSchema, RelationMappings } from 'objection';
import { BaseModel } from '../../base';
import { DatabaseSchema } from '../../database.schema';
import { DatabaseTables } from '../../database.table';
import { CountryModel } from '../country';
import { TierModel } from '../tier/tier.model';
import { TierConfigVerificationRequirementModel } from '../tierConfigVerificationRequirement';
import { ITierConfig } from './tierConfig.interface';
import { TierConfigValidationSchema } from './tierConfig.validation';

export class TierConfigModel extends BaseModel implements ITierConfig {
  public tier_id: ITierConfig['tier_id'];
  public country_id: ITierConfig['country_id'];
  public minimum_balance: ITierConfig['minimum_balance'];
  public maximum_balance: ITierConfig['maximum_balance'];
  public minimum_per_deposit: ITierConfig['minimum_per_deposit'];
  public maximum_per_deposit: ITierConfig['maximum_per_deposit'];
  public maximum_daily_deposit: ITierConfig['maximum_daily_deposit'];
  public maximum_monthly_deposit: ITierConfig['maximum_monthly_deposit'];
  public minimum_transaction_amount: ITierConfig['minimum_transaction_amount'];
  public maximum_transaction_amount: ITierConfig['maximum_transaction_amount'];
  public maximum_daily_transaction: ITierConfig['maximum_daily_transaction'];
  public maximum_monthly_transaction: ITierConfig['maximum_monthly_transaction'];
  public maximum_weekly_deposit: ITierConfig['maximum_weekly_deposit'];
  public remittance_minimum_per_deposit: ITierConfig['remittance_minimum_per_deposit'];
  public remittance_maximum_per_deposit: ITierConfig['remittance_maximum_per_deposit'];
  public remittance_maximum_daily_deposit: ITierConfig['remittance_maximum_daily_deposit'];
  public maximum_weekly_transaction: ITierConfig['maximum_weekly_transaction'];
  public remittance_maximum_monthly_deposit: ITierConfig['remittance_maximum_monthly_deposit'];
  public remittance_minimum_transaction_amount: ITierConfig['remittance_minimum_transaction_amount'];
  public minimum_per_withdrawal: ITierConfig['minimum_per_withdrawal'];
  public maximum_per_withdrawal: ITierConfig['maximum_per_withdrawal'];
  public maximum_daily_withdrawal: ITierConfig['maximum_daily_withdrawal'];
  public maximum_weekly_withdrawal: ITierConfig['maximum_weekly_withdrawal'];
  public maximum_monthly_withdrawal: ITierConfig['maximum_monthly_withdrawal'];
  public remittance_maximum_transaction_amount: ITierConfig['remittance_maximum_transaction_amount'];
  public remittance_maximum_daily_transaction: ITierConfig['remittance_maximum_daily_transaction'];
  public remittance_maximum_monthly_transaction: ITierConfig['remittance_maximum_monthly_transaction'];
  public remittance_maximum_weekly_deposit: ITierConfig['remittance_maximum_weekly_deposit'];
  public total_spendable: ITierConfig['total_spendable'];
  public total_receivable: ITierConfig['total_receivable'];

  public remittance_maximum_weekly_transaction: ITierConfig['remittance_maximum_weekly_transaction'];
  public remittance_minimum_per_withdrawal: ITierConfig['remittance_minimum_per_withdrawal'];
  public remittance_maximum_per_withdrawal: ITierConfig['remittance_maximum_per_withdrawal'];
  public remittance_maximum_daily_withdrawal: ITierConfig['remittance_maximum_daily_withdrawal'];
  public remittance_maximum_weekly_withdrawal: ITierConfig['remittance_maximum_weekly_withdrawal'];
  public remittance_maximum_monthly_withdrawal: ITierConfig['remittance_maximum_monthly_withdrawal'];

  // pending transaction count limits (US users)
  public maximum_pending_deposits_count: ITierConfig['maximum_pending_deposits_count'];
  public maximum_pending_withdrawals_count: ITierConfig['maximum_pending_withdrawals_count'];

  // weekly transaction count limits (US users)
  public maximum_weekly_deposit_count: ITierConfig['maximum_weekly_deposit_count'];
  public maximum_weekly_withdrawal_count: ITierConfig['maximum_weekly_withdrawal_count'];

  // relations
  public country?: ITierConfig['country'];
  public tier?: ITierConfig['tier'];
  public tierConfigVerificationRequirements?: ITierConfig['tierConfigVerificationRequirements'];

  public static get tableName(): string {
    return `${DatabaseSchema.apiService}.${DatabaseTables.tier_configs}`;
  }

  public static get jsonSchema(): JSONSchema {
    return TierConfigValidationSchema;
  }

  public static get relationMappings(): RelationMappings {
    return {
      tier: {
        relation: BaseModel.HasOneRelation,
        modelClass: TierModel,
        join: {
          from: `${DatabaseSchema.apiService}.${DatabaseTables.tier_configs}.tier_id`,
          to: `${DatabaseSchema.apiService}.${DatabaseTables.tiers}.id`,
        },
      },
      country: {
        relation: BaseModel.HasOneRelation,
        modelClass: CountryModel,
        join: {
          from: `${DatabaseSchema.apiService}.${DatabaseTables.tier_configs}.country_id`,
          to: `${DatabaseSchema.apiService}.${DatabaseTables.countries}.id`,
        },
      },
      tierConfigVerificationRequirements: {
        relation: BaseModel.HasManyRelation,
        modelClass: TierConfigVerificationRequirementModel,
        join: {
          from: `${DatabaseSchema.apiService}.${DatabaseTables.tier_configs}.id`,
          to: `${DatabaseSchema.apiService}.${DatabaseTables.tier_config_verification_requirements}.tier_config_id`,
        },
      },
    };
  }
}
