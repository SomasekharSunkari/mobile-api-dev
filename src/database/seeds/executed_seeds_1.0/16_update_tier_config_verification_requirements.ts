import { Knex } from 'knex';
import { DatabaseSchema } from '../../database.schema';
import { DatabaseTables } from '../../database.table';

const ngTierConfigVerificationRequirements = [
  // Nigeria Tier 1
  {
    id: 'cmf2h9nz5000runmichplfdbq',
    tier_config_id: 'cmakvoh1k000008lae5kl7uyk',
    verification_requirement_id: 'cmf2f4aio0000unmi21ir29hf',
  },
  {
    id: 'cmh9b2kxt00072v6lbvn1ngr1',
    tier_config_id: 'cmakvoh1k000008lae5kl7uyk',
    verification_requirement_id: 'cmf2f4aio0001unmi0czo3wtu',
  },
  {
    id: 'cmf2h9nz5000uunmiga1r6aji',
    tier_config_id: 'cmakvoh1k000008lae5kl7uyk',
    verification_requirement_id: 'cmf2f4aio000dunmi5whj8tnk',
  },
  {
    id: 'cmf2h9nz5000yunmi9s0e4ajt',
    tier_config_id: 'cmakvoh1k000008lae5kl7uyk',
    verification_requirement_id: 'cmf2f4aio0008unmi2fg0hqs0',
  },
  {
    id: 'cmh97890400042v6lzeupjp8e',
    tier_config_id: 'cmakvoh1k000008lae5kl7uyk',
    verification_requirement_id: 'cmh96rpus00012v6lrl385w6v',
  },
  {
    id: 'cmh978dkd00052v6lpvi96dhy',
    tier_config_id: 'cmakvoh1k000008lae5kl7uyk',
    verification_requirement_id: 'cmh96rpus00022v6lrl385w6v',
  },
  {
    id: 'cmh978gsv00062v6lfyqx0fds',
    tier_config_id: 'cmakvoh1k000008lae5kl7uyk',
    verification_requirement_id: 'cmh96rpus00032v6lrl385w6v',
  },

  // Nigeria Tier 2
  {
    id: 'cmf2h9nz50010unmif7rnczmw',
    tier_config_id: 'cmakvozxc00002v6mqhvv2az7',
    verification_requirement_id: 'cmf2f4aio000gunmig8uj2jwm',
  },
  {
    id: 'cmf2h9nz50011unmi5eiqa6rv',
    tier_config_id: 'cmakvozxc00002v6mqhvv2az7',
    verification_requirement_id: 'cmf2f4aio000hunmibbmy7r27',
  },
  {
    id: 'cmf2h9nz50012unmiau4tcc3n',
    tier_config_id: 'cmakvozxc00002v6mqhvv2az7',
    verification_requirement_id: 'cmf2f4aio000iunmi6kcje9lh',
  },
];

const usaTierConfigVerificationRequirements = [
  // USA Tier 1
  {
    id: 'cmf2h9nz60016unmi2ryl778a',
    tier_config_id: 'cmakvvocg00012v6mzvfixlk8',
    verification_requirement_id: 'cmf2f4aio000dunmi5whj8tnk',
  },
  {
    id: 'cmf2h9nz60017unmi1k5v9j28',
    tier_config_id: 'cmakvvocg00012v6mzvfixlk8',
    verification_requirement_id: 'cmf2f4aio0002unmi9zumgob1',
  },
  {
    id: 'cmf2h9nz60018unmi4el418ga',
    tier_config_id: 'cmakvvocg00012v6mzvfixlk8',
    verification_requirement_id: 'cmf2f4aio0008unmi2fg0hqs0',
  },
  {
    id: 'cmh975fet00022v6lbfrp2e2d',
    tier_config_id: 'cmakvvocg00012v6mzvfixlk8',
    verification_requirement_id: 'cmh96rpus00012v6lrl385w6v',
  },
  {
    id: 'cmh975ixg00032v6lz43v9544',
    tier_config_id: 'cmakvvocg00012v6mzvfixlk8',
    verification_requirement_id: 'cmh96rpus00022v6lrl385w6v',
  },
  {
    id: 'cmh975j5e00042v6lrl385w6v',
    tier_config_id: 'cmakvvocg00012v6mzvfixlk8',
    verification_requirement_id: 'cmh96rpus00032v6lrl385w6v',
  },
  {
    id: 'cmh9c3phn00082v6lphone1us',
    tier_config_id: 'cmakvvocg00012v6mzvfixlk8',
    verification_requirement_id: 'cmf2f4aio0009unmi93zu5u6k',
  },
  {
    id: 'cmh9c3phn00092v6laddrs1us',
    tier_config_id: 'cmakvvocg00012v6mzvfixlk8',
    verification_requirement_id: 'cmf2f4aio0007unmi5mu2bp3e',
  },

  // USA Tier 2
  {
    id: 'cmf2h9nz60019unmib09yawkh',
    tier_config_id: 'cmakvvs5600032v6mhci3z3aw',
    verification_requirement_id: 'cmf2f4aio000gunmig8uj2jwm',
  },
  {
    id: 'cmf2h9nz6001aunmi33dn9r44',
    tier_config_id: 'cmakvvs5600032v6mhci3z3aw',
    verification_requirement_id: 'cmf2f4aio000hunmibbmy7r27',
  },
  {
    id: 'cmf2h9nz6001bunmiarbwbr4x',
    tier_config_id: 'cmakvvs5600032v6mhci3z3aw',
    verification_requirement_id: 'cmf2f4aio000iunmi6kcje9lh',
  },
];

/**
 * Seed to update tier_config_verification_requirements
 * - Deletes kyc_verifications referencing removed tier_config_verification_requirements
 * - Deletes tier_config_verification_requirements not in the valid list
 * - Upserts tier_config_verification_requirements from updated data
 */
export async function seed(knex: Knex): Promise<void> {
  const allVerificationRequirements = [
    ...ngTierConfigVerificationRequirements,
    ...usaTierConfigVerificationRequirements,
  ];
  const validIds = allVerificationRequirements.map((req) => req.id);

  await knex.transaction(async (trx) => {
    // Defer constraint checks until end of transaction
    await trx.raw('SET CONSTRAINTS ALL DEFERRED');

    // Delete kyc_verifications referencing removed tier_config_verification_requirements
    await trx
      .withSchema(DatabaseSchema.apiService)
      .table(DatabaseTables.kyc_verifications)
      .whereNotIn('tier_config_verification_requirement_id', validIds)
      .whereNotNull('tier_config_verification_requirement_id')
      .del();

    // Delete tier_config_verification_requirements not in the valid list
    await trx
      .withSchema(DatabaseSchema.apiService)
      .table(DatabaseTables.tier_config_verification_requirements)
      .whereNotIn('id', validIds)
      .del();

    // Upsert tier_config_verification_requirements
    for (const requirement of allVerificationRequirements) {
      await trx
        .withSchema(DatabaseSchema.apiService)
        .table(DatabaseTables.tier_config_verification_requirements)
        .insert(requirement)
        .onConflict('id')
        .merge();
    }
  });
}
