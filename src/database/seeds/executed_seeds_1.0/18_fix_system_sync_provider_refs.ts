import { Knex } from 'knex';
import { DatabaseSchema } from '../../database.schema';
import { DatabaseTables } from '../../database.table';

/**
 * Seed to fix kyc_verifications with system-sync provider_refs
 * - Find all kyc_verifications where provider_ref starts with or contains "system-sync"
 * - For each user, find an approved kyc_verification with a valid provider_ref (not containing system-sync)
 * - Update all system-sync provider_refs for that user to use the valid provider_ref
 */
export async function seed(knex: Knex): Promise<void> {
  await knex.transaction(async (trx) => {
    // Get all distinct user_ids that have kyc_verifications with system-sync provider_ref
    const usersWithSystemSync = await trx
      .withSchema(DatabaseSchema.apiService)
      .table(DatabaseTables.kyc_verifications)
      .where('provider_ref', 'like', '%system-sync%')
      .distinct('user_id')
      .select('user_id');

    console.log(`Found ${usersWithSystemSync.length} users with system-sync provider_refs`);

    let updatedCount = 0;
    let skippedCount = 0;

    for (const { user_id } of usersWithSystemSync) {
      // Find an approved kyc_verification for this user with a valid provider_ref
      const validKyc = await trx
        .withSchema(DatabaseSchema.apiService)
        .table(DatabaseTables.kyc_verifications)
        .where('user_id', user_id)
        .where('status', 'approved')
        .where('provider_ref', 'not like', '%system-sync%')
        .whereNotNull('provider_ref')
        .first('provider_ref');

      if (!validKyc?.provider_ref) {
        // No valid provider_ref found for this user, skip
        skippedCount++;
        console.log(
          `Skipped user ${user_id}: No valid approved kyc_verification with non-system-sync provider_ref found`,
        );
        continue;
      }

      // Update all kyc_verifications for this user where provider_ref contains system-sync
      const updateResult = await trx
        .withSchema(DatabaseSchema.apiService)
        .table(DatabaseTables.kyc_verifications)
        .where('user_id', user_id)
        .where('provider_ref', 'like', '%system-sync%')
        .update({
          provider_ref: validKyc.provider_ref,
          updated_at: new Date().toISOString(),
        });

      updatedCount += updateResult;
      console.log(
        `Updated ${updateResult} kyc_verifications for user ${user_id} with provider_ref: ${validKyc.provider_ref}`,
      );
    }

    console.log(`Seed completed: Updated ${updatedCount} records, Skipped ${skippedCount} users`);
  });
}
