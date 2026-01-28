import { Knex } from 'knex';
import { ROLES } from '../../../modules/auth/guard/roles.enum';
import { DatabaseTables } from '../../database.table';

export async function seed(knex: Knex): Promise<void> {
  // Inserts seed entries
  await knex
    .withSchema('api_service')
    .table(DatabaseTables.roles)
    .insert([
      /*
       * Read Only Role:
       * - View-only access to all system features and data
       * - Cannot create, edit, or delete any records or configurations
       * - Can access reports, dashboards, and analytics in read-only mode
       * - Cannot modify user accounts, roles, or permissions
       * - Cannot perform any financial transactions or sensitive operations
       * - Can view audit logs but cannot modify or delete them
       * - Ideal for stakeholders, observers, or compliance personnel who need visibility without modification rights
       * - Suitable for generating reports and monitoring system activities
       */
      {
        id: 'cm9gwyuu50001gsmibj0u0v1l',
        name: 'Read Only',
        slug: ROLES.READ_ONLY,
        desc: 'Read only access - cannot create, edit, or delete anything',
      },
    ]);
}
