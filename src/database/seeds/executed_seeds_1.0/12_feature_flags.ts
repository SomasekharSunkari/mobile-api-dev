import { Knex } from 'knex';
import { DatabaseSchema } from '../../database.schema';
import { DatabaseTables } from '../../database.table';

export async function seed(knex: Knex): Promise<void> {
  // Deletes ALL existing entries
  await knex.withSchema(DatabaseSchema.apiService).table(DatabaseTables.feature_flags).del();

  // Inserts seed entries
  await knex
    .withSchema(DatabaseSchema.apiService)
    .table(DatabaseTables.feature_flags)
    .insert([
      {
        id: 'cm9ftflg1000a0emiff001abc',
        key: 'usd_fiat_wallet',
        enabled: true,
        description: 'Enable/disable USD fiat wallet functionality',
        expires_at: null,
      },
      {
        id: 'cm9ftflg2000b0emiff001def',
        key: 'ngn_fiat_wallet',
        enabled: true,
        description: 'Enable/disable NGN fiat wallet functionality',
        expires_at: null,
      },
      {
        id: 'cm9ftflg3000c0emiff001ghi',
        key: 'stablecoin_wallet',
        enabled: true,
        description: 'Enable/disable stablecoin wallet functionality',
        expires_at: null,
      },
      {
        id: 'cm9ftflg4000d0emiff001jkl',
        key: 'ngn_p2p',
        enabled: true,
        description: 'Enable/disable NGN peer-to-peer transfers',
        expires_at: null,
      },
      {
        id: 'cm9ftflg5000e0emiff001mno',
        key: 'usd_p2p',
        enabled: true,
        description: 'Enable/disable USD peer-to-peer transfers',
        expires_at: null,
      },
      {
        id: 'cm9ftflg6000f0emiff001pqr',
        key: 'card_creation',
        enabled: true,
        description: 'Enable/disable card creation functionality',
        expires_at: null,
      },
      {
        id: 'cm9ftflg7000g0emiff001stu',
        key: 'card_top_up',
        enabled: true,
        description: 'Enable/disable card top-up functionality',
        expires_at: null,
      },
      {
        id: 'cm9ftflg8000h0emiff001vwx',
        key: 'card_withdrawal',
        enabled: true,
        description: 'Enable/disable card withdrawal functionality',
        expires_at: null,
      },
      {
        id: 'cm9ftflg9000i0emiff001yza',
        key: 'ngn_withdrawal',
        enabled: true,
        description: 'Enable/disable NGN withdrawal functionality',
        expires_at: null,
      },
      {
        id: 'cm9ftflg0000j0emiff001bcd',
        key: 'usd_withdrawal',
        enabled: true,
        description: 'Enable/disable USD withdrawal functionality',
        expires_at: null,
      },
      {
        id: 'cm9ftflg1000k0emiff001efg',
        key: 'fiat_conversion',
        enabled: true,
        description: 'Enable/disable fiat currency conversion',
        expires_at: null,
      },
      {
        id: 'cm9ftflg2000l0emiff001hij',
        key: 'stablecoin_conversion',
        enabled: true,
        description: 'Enable/disable stablecoin conversion',
        expires_at: null,
      },
      {
        id: 'cm9ftflg3000m0emiff001klm',
        key: 'ngn_deposits',
        enabled: true,
        description: 'Enable/disable NGN deposit functionality',
        expires_at: null,
      },
      {
        id: 'cm9ftflg4000n0emiff001nop',
        key: 'usd_deposits',
        enabled: true,
        description: 'Enable/disable USD deposit functionality',
        expires_at: null,
      },
    ]);
}
