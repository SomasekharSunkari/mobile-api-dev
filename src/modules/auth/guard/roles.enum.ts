export enum ROLES {
  SUPER_ADMIN = 'super-admin',
  ADMIN = 'admin',
  USER = 'user',
  ACTIVE_USER = 'active-user',
  COMPLIANCE = 'compliance',
  ACCOUNTANT = 'accountant',
  CUSTOMER_SUPPORT = 'customer-support',
  AUDITOR = 'auditor',
  READ_ONLY = 'read-only',
}

export type RoleSlug = (typeof ROLES)[keyof typeof ROLES];
