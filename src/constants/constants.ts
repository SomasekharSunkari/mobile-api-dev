import { IsStrongPasswordOptions } from 'class-validator';

export const PASSWORD_CONSTRAINT: IsStrongPasswordOptions = {
  minLength: 8,
  minNumbers: 1,
  minLowercase: 1,
  minSymbols: 1,
  minUppercase: 1,
};

export const NO_OF_LIMITED_QUERIES = 10;

export const SUPPORTED_KYC_COUNTRIES = ['US', 'NG'];

export const PROVIDERS = {
  ZEROHASH: 'zerohash',
  PLAID: 'plaid',
} as const;

export const ThrottleGroups = {
  // Generic usage
  DEFAULT: { limit: 100, ttl: 60 },

  // Sensitive endpoints
  STRICT: { limit: 2, ttl: 10 },

  // Moderate auth rate limits
  AUTH: { limit: 5, ttl: 30 },
};

export const NUMBER_PRECISION = 10;

export const ONE_HUNDRED_KILOBYTES = 100000;

export const FAKE_ACCOUNT_NUMBER = '1100056479';
export const FAKE_BANK_CODE = '120001';
export const FAKE_ACCOUNT_NAME = 'ONEDOSH/John Mock-Doe';

export const ONE_DAY_IN_SECONDS = 24 * 60 * 60;

export const YELLOWCARD_COLLECTION_SUCCESS_WALLET_ADDRESS = '0xde0B295669a9FD93d5F28D9Ec85E40f4cb697BAe';
export const YELLOWCARD_COLLECTION_SUCCESS_CRYPTO_CURRENCY = 'USDT';
export const YELLOWCARD_COLLECTION_SUCCESS_CRYPTO_NETWORK = 'ERC20';

export enum TransferDirection {
  FROM = 'from',
  TO = 'to',
}

export const DATE_TIME_FORMAT: Intl.DateTimeFormatOptions = {
  weekday: 'short',
  month: 'short',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  year: 'numeric',
};

export const FIREBLOCKS_VAULT_ID = '368';
export const FIREBLOCKS_ASSET_ID = 'USDC_ETH_TEST5_0GER';

export const FIREBLOCKS_MASTER_VAULT_ID = '17';

export const PAGA_DEVELOPMENT_BANK_ACCOUNT_NUMBER = '0361222682';

export const EXCHANGE_EXPIRATION_TIME_IN_MINUTES = 10;

export const ZEROHASH_SERVICE_UNAVAILABLE_MESSAGE = 'This service is currently unavailable, please try again later';
