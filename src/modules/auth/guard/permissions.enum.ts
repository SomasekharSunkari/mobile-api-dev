export enum PERMISSIONS {
  CrossBorderTransactions = 'cross-border-transactions',
  CryptoTransactions = 'crypto-transactions',
  VirtualAccountTransactions = 'virtual-account-transactions',
  VirtualCardTransactions = 'virtual-card-transactions',
  PhysicalCardTransactions = 'physical-card-transactions',
}

export type PermissionSlug = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];
