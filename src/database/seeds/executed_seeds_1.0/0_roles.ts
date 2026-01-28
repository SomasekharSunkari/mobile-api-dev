import { Knex } from 'knex';
import { EnvironmentService } from '../../../config';
import { ROLES } from '../../../modules/auth/guard/roles.enum';
import { DatabaseSchema } from '../../database.schema';
import { DatabaseTables } from '../../database.table';

export async function seed(knex: Knex): Promise<void> {
  // Drop foreign key constraint
  // Remove foreign key constraint on 'role_id' if it exists

  if (!EnvironmentService.isProduction()) {
    await knex.schema.withSchema(DatabaseSchema.apiService).table(DatabaseTables.users_roles, (table) => {
      table.dropForeign(['role_id']);
    });
  }

  // Deletes ALL existing entries
  await knex.withSchema('api_service').table(DatabaseTables.roles).del();

  // Inserts seed entries
  await knex
    .withSchema('api_service')
    .table(DatabaseTables.roles)
    .insert([
      /*
       * Super Admin Role:
       * - Highest privilege level in the system with unrestricted access to all features and functionalities
       * - Can create, modify, and delete any user accounts including other administrators
       * - Has full control over system configurations, security settings, and global parameters
       * - Can view and modify all financial transactions and sensitive data
       * - Responsible for assigning role-based permissions to other users
       * - Has access to audit logs and can monitor all system activities
       * - Can enable/disable system features and manage integrations with external services
       * - Usually limited to founding members or highest-level IT personnel
       */
      {
        id: 'cm9gwyuu50000gsmibj0u0v1k',
        name: 'Super Admin',
        slug: ROLES.SUPER_ADMIN,
        desc: 'Super Admin',
      },
      /*
       * Admin Role:
       * - Second highest privilege level with extensive access to system features and functionalities
       * - Can perform most administrative tasks except managing other admins
       * (cannot create, modify, or delete admin accounts)
       * - Has control over system configurations, security settings, and global parameters
       * - Can view and modify all financial transactions and sensitive data
       * - Can assign permissions to regular users (non-admin roles)
       * - Has access to audit logs and can monitor system activities
       * - Can enable/disable system features and manage integrations with external services
       * - Typically assigned to department heads or senior management personnel
       */
      {
        id: 'cm9gwyuu50000gsmibj0u0v1l',
        name: 'Admin',
        slug: ROLES.ADMIN,
        desc: 'Admin',
      },
      /*
       * User Role:
       * - Default role automatically assigned to all newly created accounts in the system
       * - Represents users who have registered but have not yet completed account activation
       * - Has limited access to system features until account is activated
       * - Account activation requires verification through email or mobile phone confirmation
       * - Can access basic profile management and account settings
       * - Cannot perform any sensitive operations or access protected data
       * - May have view-only access to certain public information
       * - Serves as the foundation role that all users possess regardless of any additional roles
       * - Will not be upgraded to Active User role upon successful account
       * verification as it serves as the foundation role that all users possess regardless of any additional roles
       */
      {
        id: 'cm9gx0mks00020emi1iezda0w',
        name: 'User',
        slug: ROLES.USER,
        desc: 'User',
      },
      /*
       * Active User Role:
       * - Assigned to users who have successfully completed account verification and activation process
       * - Exists alongside the foundational User role (users retain both roles)
       * - Grants access to the full suite of standard user features and functionalities
       * - Can perform regular transactions and operations within the system
       * - Has permission to access personalized data and services
       * - Account activation requires verification through email or mobile phone confirmation
       * - Can interact with other users through system-provided communication channels
       * - Subject to normal usage limits and security policies
       * - May be eligible for additional specialized roles based on user requirements or business needs
       */
      {
        id: 'cm9gx0iej00000emi2eaj6qud',
        name: 'Active User',
        slug: ROLES.ACTIVE_USER,
        desc: 'Active User',
      },
      /*
       * Compliance Role:
       * - Designed specifically for the legal and compliance team members
       * - Provides read-only access to necessary data required for regulatory compliance purposes
       * - Cannot create or edit general records in the system
       * - Can create compliance-specific records to document and track compliance checks
       * - Cannot modify compliance records created by other team members
       * - Has access to audit trails and transaction histories for compliance verification
       * - Can generate compliance reports and documentation
       * - Access is limited to specific modules and data relevant to regulatory requirements
       * - Role is isolated to maintain separation of duties and regulatory integrity
       */
      {
        id: 'cm9gx4p8n00060emihgmp35hk',
        name: 'Compliance',
        slug: ROLES.COMPLIANCE,
        desc: 'Compliance',
      },
      /*
       * Accountant Role:
       * - Specialized role for financial accounting personnel within the system
       * - Has extensive read access to all transaction details, income, and expenses
       * - Can review and audit financial transactions across the entire system
       * - Able to generate and export financial reports, statements, and tax documents
       * - Can access historical financial data and perform financial analysis
       * - Cannot create new transaction records on behalf of users
       * - Cannot delete or modify existing transaction records
       * - May have access to pending transactions for verification purposes
       * - Typically used for internal accounting staff, external auditors, or financial consultants
       */
      {
        id: 'cm9gy6x4g000c0emidw226c28',
        name: 'Accountant',
        slug: ROLES.ACCOUNTANT,
        desc: 'Accountant',
      },

      /*
       * Customer Support Role:
       * - Designed for personnel who provide direct assistance to users/customers
       * - Has access to most user data necessary for troubleshooting and issue resolution
       * - Cannot access confidential or sensitive financial information
       * - Can view user profiles, transaction histories, and account statuses
       * - Able to assist with general account management and technical issues
       * - Can create support tickets and document customer interactions
       * - May have limited ability to perform certain actions on behalf of users with proper authorization
       * - Can escalate issues to appropriate teams when necessary
       * - Access is typically logged and monitored for quality assurance and security purposes
       */
      {
        id: 'cm9gy6s2i000a0emi5u2e9qxs',
        name: 'Customer Support',
        slug: ROLES.CUSTOMER_SUPPORT,
        desc: 'Customer Support',
      },

      /*
       * Auditor Role:
       * - Specialized role for internal or external auditing personnel
       * - Has comprehensive read-only access to all financial transactions and records
       * - Can access historical data across all time periods for audit purposes
       * - Able to generate detailed audit reports and compliance documentation
       * - Cannot modify, create, or delete any records within the system
       * - Has access to system logs, user activity records, and administrative actions
       * - Can view configuration changes and security settings for compliance verification
       * - Access is typically time-limited and may be restricted to specific audit periods
       * - All auditor activities are logged in a separate audit trail for accountability
       * - Role is designed to maintain independence and integrity of the auditing process
       */
      {
        id: 'cm9gx4ryt00080emi1glse40t',
        name: 'Auditor',
        slug: ROLES.AUDITOR,
        desc: 'Auditor',
      },
    ]);

  // enable constraints
  if (!EnvironmentService.isProduction()) {
    await knex.schema.withSchema(DatabaseSchema.apiService).table(DatabaseTables.users_roles, (table) => {
      table.foreign('role_id').references('id').inTable(`${DatabaseSchema.apiService}.${DatabaseTables.roles}`);
    });
  }
}
