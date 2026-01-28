export interface IBankAccountLinkingAdapter {
  linkBankAccount(req: LinkAccountRequest, countryCode: string): Promise<LinkAccountResponse>;

  createLinkToken(req: CreateTokenRequest, countryCode: string): Promise<CreateTokenResponse>;

  exchangeToken(req: TokenExchangeRequest, countryCode: string): Promise<TokenExchangeResponse>;

  getAccounts(req: AccountsRequest, countryCode: string): Promise<AccountsResponse>;

  createProcessorToken(req: ProcessorTokenRequest, countryCode: string): Promise<ProcessorTokenResponse>;

  unlinkAccount(req: UnlinkAccountRequest, countryCode: string): Promise<UnlinkAccountResponse>;

  closeAccount(req: CloseAccountRequest, countryCode: string): Promise<CloseAccountResponse>;
}

export interface LinkAccountRequest {
  externalRef: string;
  alias: string;
  processorToken: string;
}

export interface LinkAccountResponse {
  requestRef: string;
  accountRef: string;
  customerCode: string;
  systemCode: string;
  alias: string;
  createdAt: string;
  status: string;
}

export interface TokenExchangeRequest {
  publicToken: string;
}

export interface TokenExchangeResponse {
  accessToken: string;
  itemId: string;
  requestRef: string;
}

export interface AccountsRequest {
  accessToken: string;
}

export interface Balances {
  available: number | null;
  current: number | null;
  currencyIso: string | null;
  limit: number | null;
  unofficialCurrencyIso: string | null;
}
export type HolderCategory = 'business' | 'personal' | 'unrecognized';

export interface AccountInfo {
  ref: string;
  balances: Balances;
  holderCategory?: HolderCategory;
  mask: string | null;
  name: string;
  officialName: string | null;
  persistentRef: string;
  subtype: string | null;
  type: string;
}

export interface ItemMetadata {
  authMethod?: string | null;
  availableProducts: LinkProduct[];
  billedProducts: LinkProduct[];
  consentExpirationTime?: string | null;
  error?: any;
  institutionRef?: string | null;
  institutionName?: string | null;
  itemId: string;
  products: LinkProduct[];
  updateType: string;
  webhook?: string | null;
}

export interface AccountsResponse {
  accounts: AccountInfo[];
  item: ItemMetadata;
  requestRef: string;
}

export interface UnlinkAccountRequest {
  accessToken: string;
}

export interface UnlinkAccountResponse {
  requestRef: string;
  removed: boolean;
}

export interface CloseAccountRequest {
  externalAccountRef: string;
  participantCode: string;
}

export interface CloseAccountResponse {
  requestRef: string;
  accountRef: string;
  status: string;
}

export interface ProcessorTokenRequest {
  accessToken: string;
  accountRef: string;
  provider: string;
}

export interface ProcessorTokenResponse {
  processorToken: string;
  requestRef?: string;
}

export interface UserAddress {
  street: string;
  street2?: string;
  city: string;
  region: string;
  postalCode: string;
  country: string;
}

export interface LinkUser {
  userRef: string;
  email?: string;
  phone?: string;
  fullName?: string;
  dob?: string; // YYYY-MM-DD
  address?: UserAddress;
}

export interface AccountFilters {
  depository?: {
    subtypes?: AccountSubtype[];
  };
}

export interface CreateTokenRequest {
  clientName: string;
  language: string;
  countryCodes?: CountryCode[];
  user: LinkUser;
  products?: LinkProduct[];
  webhook?: string;
  redirectUri?: string;
  customizationName?: string;
  androidPackageName?: string;
  accountFilters?: AccountFilters;
  accessToken?: string; // For update mode
}

export interface CreateTokenResponse {
  token: string;
  expiration: string;
  requestRef: string;
  link_access_url?: string;
}

export enum CountryCode {
  US = 'US',
  NG = 'NG',
}

export type AccountSubtype = 'checking';

export type LinkProduct = 'auth' | 'transfer' | 'identity' | 'signal';
