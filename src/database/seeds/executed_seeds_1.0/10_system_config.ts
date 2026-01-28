import { Knex } from 'knex';
import { DatabaseSchema } from '../../database.schema';
import { DatabaseTables } from '../../database.table';

export async function seed(knex: Knex): Promise<void> {
  // Deletes ALL existing entries
  await knex.withSchema(DatabaseSchema.apiService).table(DatabaseTables.system_configs).del();

  // Inserts seed entries
  await knex
    .withSchema(DatabaseSchema.apiService)
    .table(DatabaseTables.system_configs)
    .insert([
      {
        id: 'cm9syscfg1000a0emisc001abc',
        key: 'usd_fiat_wallet',
        type: 'feature_flag',
        is_enabled: true,
        description: 'Enable/disable USD fiat wallet functionality',
      },
      {
        id: 'cm9syscfg2000b0emisc001def',
        key: 'ngn_fiat_wallet',
        type: 'feature_flag',
        is_enabled: true,
        description: 'Enable/disable NGN fiat wallet functionality',
      },
      {
        id: 'cm9syscfg3000c0emisc001ghi',
        key: 'stablecoin_wallet',
        type: 'feature_flag',
        is_enabled: true,
        description: 'Enable/disable stablecoin wallet functionality',
      },
      {
        id: 'cm9syscfg4000d0emisc001jkl',
        key: 'ngn_p2p',
        type: 'feature_flag',
        is_enabled: true,
        description: 'Enable/disable NGN peer-to-peer transfers',
      },
      {
        id: 'cm9syscfg5000e0emisc001mno',
        key: 'usd_p2p',
        type: 'feature_flag',
        is_enabled: true,
        description: 'Enable/disable USD peer-to-peer transfers',
      },
      {
        id: 'cm9syscfg6000f0emisc001pqr',
        key: 'card_creation',
        type: 'feature_flag',
        is_enabled: true,
        description: 'Enable/disable card creation functionality',
      },
      {
        id: 'cm9syscfg7000g0emisc001stu',
        key: 'card_top_up',
        type: 'feature_flag',
        is_enabled: true,
        description: 'Enable/disable card top-up functionality',
      },
      {
        id: 'cm9syscfg8000h0emisc001vwx',
        key: 'card_withdrawal',
        type: 'feature_flag',
        is_enabled: true,
        description: 'Enable/disable card withdrawal functionality',
      },
      {
        id: 'cm9syscfg9000i0emisc001yza',
        key: 'ngn_withdrawal',
        type: 'feature_flag',
        is_enabled: true,
        description: 'Enable/disable NGN withdrawal functionality',
      },
      {
        id: 'cm9syscfg0000j0emisc001bcd',
        key: 'usd_withdrawal',
        type: 'feature_flag',
        is_enabled: true,
        description: 'Enable/disable USD withdrawal functionality',
      },
      {
        id: 'cm9syscfg1000k0emisc001efg',
        key: 'fiat_conversion',
        type: 'feature_flag',
        is_enabled: true,
        description: 'Enable/disable fiat currency conversion',
      },
      {
        id: 'cm9syscfg2000l0emisc001hij',
        key: 'stablecoin_conversion',
        type: 'feature_flag',
        is_enabled: true,
        description: 'Enable/disable stablecoin conversion',
      },
      {
        id: 'cm9syscfg3000m0emisc001klm',
        key: 'ngn_deposits',
        type: 'feature_flag',
        is_enabled: true,
        description: 'Enable/disable NGN deposit functionality',
      },
      {
        id: 'cm9syscfg4000n0emisc001nop',
        key: 'usd_deposits',
        type: 'feature_flag',
        is_enabled: true,
        description: 'Enable/disable USD deposit functionality',
      },
    ]);
}
