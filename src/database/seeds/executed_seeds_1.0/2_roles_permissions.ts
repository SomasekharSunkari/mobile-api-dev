import { createId } from '@paralleldrive/cuid2';
import { Knex } from 'knex';
import { DatabaseTables } from '../../database.table';

export async function seed(knex: Knex): Promise<void> {
  // fetch all roles
  const role = await knex.withSchema('api_service').table(DatabaseTables.roles).select('id', 'slug').first();
  // fetch all permissions
  const permissions = await knex.withSchema('api_service').table(DatabaseTables.permissions).select('id', 'slug');
  // Deletes ALL existing entries
  await knex.withSchema('api_service').table(DatabaseTables.roles_permissions).del();

  for (const permission of permissions) {
    await knex.withSchema('api_service').table(DatabaseTables.roles_permissions).insert({
      id: createId(),
      role_id: role.id,
      permission_id: permission.id,
    });
  }
}
