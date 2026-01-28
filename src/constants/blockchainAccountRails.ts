/**
 * Blockchain Account Rails Constants
 *
 * This file contains the available rails types for blockchain accounts.
 * Adding new rails here will automatically make them available throughout the application
 * without requiring database migrations.
 */

export const BLOCKCHAIN_ACCOUNT_RAIL = {
  CRYPTO: 'crypto',
  FIAT: 'fiat',
  CARD: 'card',
} as const;

export type BlockchainAccountRail = (typeof BLOCKCHAIN_ACCOUNT_RAIL)[keyof typeof BLOCKCHAIN_ACCOUNT_RAIL];

/**
 * Get all available rails values
 */
export const getAvailableRails = (): string[] => {
  return Object.values(BLOCKCHAIN_ACCOUNT_RAIL);
};

/**
 * Check if a rails value is valid
 */
export const isValidRails = (rails: string): rails is BlockchainAccountRail => {
  return Object.values(BLOCKCHAIN_ACCOUNT_RAIL).includes(rails as BlockchainAccountRail);
};
