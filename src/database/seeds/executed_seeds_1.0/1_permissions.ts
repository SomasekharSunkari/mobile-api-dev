import { Knex } from 'knex';
import { PERMISSIONS } from '../../../modules/auth/guard/permissions.enum';
import { DatabaseTables } from '../../database.table';

export async function seed(knex: Knex): Promise<void> {
  // Deletes ALL existing entries
  await knex.withSchema('api_service').table(DatabaseTables.permissions).del();

  // Inserts seed entries
  await knex
    .withSchema('api_service')
    .table(DatabaseTables.permissions)
    .insert([
      {
        id: 'cm9h5sfhi000i0emi337mc9pv',
        name: 'Cross-border transactions',
        desc: 'Perform all cross-border transactions',
        slug: PERMISSIONS.CrossBorderTransactions,
      },
      {
        id: 'cm9h5scyu000g0emibjv71x74',
        name: 'Crypto transactions',
        desc: 'Perform all crypto transactions',
        slug: PERMISSIONS.CryptoTransactions,
      },
      {
        id: 'cm9h5sa6m000e0emici2bac0x',
        name: 'Virtual account transactions',
        desc: 'Perform all virtual account transactions',
        slug: PERMISSIONS.VirtualAccountTransactions,
      },
      {
        id: 'cm9h5scyu000g0emibjv71x72',
        name: 'Virtual card transactions',
        desc: 'Perform all virtual card transactions',
        slug: PERMISSIONS.VirtualCardTransactions,
      },
      {
        id: 'cm9h5scyu000g0emibjv71x79',
        name: 'Physical card transactions',
        desc: 'Perform all physical card transactions',
        slug: PERMISSIONS.PhysicalCardTransactions,
      },
    ]);
}
