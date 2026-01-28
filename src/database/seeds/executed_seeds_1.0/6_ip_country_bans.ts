import { Knex } from 'knex';
import { DatabaseSchema } from '../../database.schema';
import { DatabaseTables } from '../../database.table';

export async function seed(knex: Knex): Promise<void> {
  // Deletes ALL existing entries
  await knex.withSchema(DatabaseSchema.apiService).table(DatabaseTables.ip_country_bans).del();

  // Inserts seed entries
  await knex
    .withSchema(DatabaseSchema.apiService)
    .table(DatabaseTables.ip_country_bans)
    .insert([
      /*
       * North Korea (KP):
       * - Complete ban due to international sanctions and OFAC restrictions
       * - High risk for regulatory compliance violations and money laundering
       * - No financial services allowed under current international law
       */
      {
        id: 'cm9ipban1000a0emikp001abc',
        type: 'country',
        value: 'KP',
        reason: 'OFAC sanctions - complete ban for regulatory compliance',
      },

      /*
       * Iran (IR):
       * - Restricted due to US/EU sanctions and FATF blacklist status
       * - High risk for sanctions violations and terrorist financing
       * - Enhanced monitoring required for any potential exemptions
       */
      {
        id: 'cm9ipban2000b0emir001def',
        type: 'country',
        value: 'IR',
        reason: 'US/EU sanctions compliance and FATF blacklist status',
      },

      /*
       * Syria (SY):
       * - Complete ban due to civil conflict and international sanctions
       * - High risk for money laundering and terrorist financing
       * - Unstable financial infrastructure and regulatory environment
       */
      {
        id: 'cm9ipban3000c0emisy001ghi',
        type: 'country',
        value: 'SY',
        reason: 'Civil conflict, international sanctions, and AML/CFT risks',
      },

      /*
       * Afghanistan (AF):
       * - Suspended services due to political instability and Taliban control
       * - Regulatory uncertainty and limited banking infrastructure
       * - High risk for compliance violations and operational challenges
       */
      {
        id: 'cm9ipban4000d0emiaf001jkl',
        type: 'country',
        value: 'AF',
        reason: 'Political instability, regulatory uncertainty, and operational risks',
      },

      /*
       * Russia (RU):
       * - Enhanced restrictions due to post-2022 sanctions
       * - High cybercrime activity and fraud rates
       * - Requires enhanced due diligence and monitoring
       */
      {
        id: 'cm9ipban5000e0emiru001mno',
        type: 'country',
        value: 'RU',
        reason: 'Enhanced sanctions compliance and elevated cybercrime risk',
      },
    ]);
}
