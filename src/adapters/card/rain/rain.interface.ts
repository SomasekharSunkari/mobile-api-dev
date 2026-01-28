export enum RainApplicationStatus {
  APPROVED = 'approved',
  PENDING = 'pending',
  MANUAL_REVIEW = 'manualReview',
  DENIED = 'denied',
  CANCELLED = 'canceled',
  LOCKED = 'locked',
  NEEDS_VERIFICATION = 'needsVerification',
  NEEDS_INFORMATION = 'needsInformation',
  NOT_STARTED = 'notStarted',
}

export enum RainDocumentType {
  ID_CARD = 'idCard',
  PASSPORT = 'passport',
  DRIVERS = 'drivers',
  RESIDENCE_PERMIT = 'residencePermit',
  UTILITY_BILL = 'utilityBill',
  SELFIE = 'selfie',
  VIDEO_SELFIE = 'videoSelfie',
  PROFILE_IMAGE = 'profileImage',
  ID_DOC_PHOTO = 'idDocPhoto',
  AGREEMENT = 'agreement',
  CONTRACT = 'contract',
  DRIVERS_TRANSLATION = 'driversTranslation',
  INVESTOR_DOC = 'investorDoc',
  VEHICLE_REGISTRATION_CERTIFICATE = 'vehicleRegistrationCertificate',
  INCOME_SOURCE = 'incomeSource',
  PAYMENT_METHOD = 'paymentMethod',
  BANK_CARD = 'bankCard',
  COVID_VACCINATION_FORM = 'covidVaccinationForm',
  OTHER = 'other',
}

export enum RainDocumentSide {
  FRONT = 'front',
  BACK = 'back',
}

export interface RainCreateCardUserRequest {
  sumsubShareToken: string;
  walletAddress?: string;
  solanaAddress?: string;
  tronAddress?: string;
  stellarAddress?: string;
  chainId?: string;
  contractAddress?: string;
  sourceKey: string;
  ipAddress: string;
  email: string;
  phoneNumber: string;
  occupation: string;
  annualSalary: string;
  accountPurpose: string;
  expectedMonthlyVolume: string;
  isTermsOfServiceAccepted: boolean;
  hasExistingDocuments: boolean;
}
export interface RainCreatedCardUserResponse {
  id: string;
  companyId: string;
  firstName: string;
  lastName: string;
  email: string;
  isActive: boolean;
  isTermsOfServiceAccepted: boolean;
  address: RainCardUserAddress;
  phoneCountryCode: string;
  phoneNumber: string;
  applicationStatus: string;
  applicationCompletionLink: RainApplicationCompletionLink;
  applicationReason: string;
}

export interface RainCardUserAddress {
  line1: string;
  line2: string;
  city: string;
  region: string;
  postalCode: string;
  countryCode: string;
  country: string;
}

export interface RainApplicationCompletionLink {
  url: string;
  params: RainParams;
}

export interface RainParams {
  userId: string;
}

export interface RainUpdateCardUserRequest {
  firstName?: string;
  lastName?: string;
  birthDate?: string;
  nationalId?: string;
  countryOfIssue?: string;
  address?: RainCardUserAddress;
  ipAddress?: string;
  occupation?: string;
  annualSalary?: string;
  accountPurpose?: string;
  expectedMonthlyVolume?: string;
  isTermsOfServiceAccepted?: boolean;
  hasExistingDocuments?: boolean;
}

export interface RainDocumentUploadRequest {
  name: string;
  type: RainDocumentType;
  side: RainDocumentSide;
  country: string;
  document: Buffer | File;
}

export interface RainApplicationStatusResponse {
  id: string;
  applicationStatus: string;
  applicationCompletionLink: {
    url: string;
    params: {
      userId: string;
    };
  };
  applicationReason: string;
}

export interface RainUserBalanceResponse {
  creditLimit: number;
  pendingCharges: number;
  postedCharges: number;
  balanceDue: number;
  spendingPower: number;
}

export interface RainCreateCardRequest {
  type: string;
  limit: RainCardLimit;
  configuration?: RainCardConfiguration;
  billing: RainCardAddress;
  shipping?: RainCardShipping;
  status: string;
  bulkShippingGroupId?: string;
}

export interface RainCardLimit {
  frequency: string;
  amount: number;
}

export interface RainCardConfiguration {
  displayName: string;
  productId?: string;
  productRef?: string;
  virtualCardArt?: string;
}

export interface RainCardAddress {
  line1: string;
  line2?: string;
  city: string;
  region: string;
  postalCode: string;
  countryCode: string;
  country: string;
}

export interface RainCardShipping extends RainCardAddress {
  phoneNumber: string;
  method: string;
}

export interface RainCardResponse {
  id: string;
  companyId: string;
  userId: string;
  type: string;
  status: string;
  limit: RainCardLimit;
  last4: string;
  expirationMonth: string;
  expirationYear: string;
  tokenWallets: string[];
}

export interface RainUpdateCardRequest {
  limit?: RainCardLimit;
  billing?: RainCardAddress;
  configuration?: Pick<RainCardConfiguration, 'virtualCardArt'>;
  status?: string;
}

export interface RainUpdateCardPinRequest {
  encryptedPin: RainEncryptedPin;
}

export interface RainEncryptedPin {
  iv: string;
  data: string;
}

export interface RainEncryptedData {
  iv: string;
  data: string;
}

export interface RainCardSecretsResponse {
  encryptedPan: RainEncryptedData;
  encryptedCvc: RainEncryptedData;
}

export interface RainCardPinResponse {
  encryptedPin: RainEncryptedData;
}

export interface RainProcessorDetailsResponse {
  processorCardId: string;
  timeBasedSecret: string;
}

export interface RainListCardsRequest {
  userId: string;
  status?: string;
  cursor?: string;
  limit?: number;
}

export interface RainListCardsResponse {
  data: RainCardResponse[];
  nextCursor?: string;
  hasMore?: boolean;
}

export interface RainCreateContractRequest {
  chainId: number;
}

export interface RainContractToken {
  address: string;
  balance: string;
  exchangeRate: number;
  advanceRate: number;
}

export interface RainContractOnrampAch {
  beneficiaryName: string;
  beneficiaryAddress: string;
  beneficiaryBankName: string;
  beneficiaryBankAddress: string;
  accountNumber: string;
  routingNumber: string;
}

export interface RainContractOnrampRtp {
  beneficiaryName: string;
  beneficiaryAddress: string;
  beneficiaryBankName: string;
  beneficiaryBankAddress: string;
  accountNumber: string;
  routingNumber: string;
}

export interface RainContractOnrampWire {
  beneficiaryName: string;
  beneficiaryAddress: string;
  beneficiaryBankName: string;
  beneficiaryBankAddress: string;
  accountNumber: string;
  routingNumber: string;
}

export interface RainContractOnramp {
  ach?: RainContractOnrampAch;
  rtp?: RainContractOnrampRtp;
  wire?: RainContractOnrampWire;
}

export interface RainContractResponse {
  id: string;
  chainId: number;
  programAddress: string;
  controllerAddress: string;
  proxyAddress: string;
  depositAddress: string;
  tokens: RainContractToken[];
  contractVersion: number;
  onramp?: RainContractOnramp;
}

export interface RainCreateChargeRequest {
  amount: number;
  description: string;
}

export interface RainChargeResponse {
  id: string;
  createdAt: string;
  amount: number;
  description: string;
}

export interface RainCreateDisputeRequest {
  textEvidence?: string;
}

export interface RainDisputeResponse {
  id: string;
  transactionId: string;
  status: string;
  createdAt: string;
  textEvidence?: string;
  resolvedAt?: string;
}

/**
 * Rain API Response Interface
 * Generic interface for all Rain API responses
 */
export interface IRainResponse<T = any> {
  data: T;
  status: number;
  statusText: string;
  headers?: any;
}

/**
 * Rain API Error Interface
 * Standardized error structure for Rain API responses
 */
export interface IRainError {
  message: string;
  code?: string;
  statusCode?: number;
  details?: any;
}

/**
 * Country name to ISO2 code mapping for address normalization.
 */
export const COUNTRY_NAME_TO_ISO2: Record<string, string> = {
  'United States': 'US',
  'United States of America': 'US',
  USA: 'US',
  Canada: 'CA',
  'United Kingdom': 'GB',
  UK: 'GB',
  'Great Britain': 'GB',
  Germany: 'DE',
  France: 'FR',
  Spain: 'ES',
  Italy: 'IT',
  Netherlands: 'NL',
  Belgium: 'BE',
  Switzerland: 'CH',
  Austria: 'AT',
  Sweden: 'SE',
  Norway: 'NO',
  Denmark: 'DK',
  Finland: 'FI',
  Australia: 'AU',
  'New Zealand': 'NZ',
  Japan: 'JP',
  'South Korea': 'KR',
  Singapore: 'SG',
  'Hong Kong': 'HK',
  Brazil: 'BR',
  Mexico: 'MX',
  Argentina: 'AR',
  Chile: 'CL',
  Colombia: 'CO',
  Peru: 'PE',
  India: 'IN',
  China: 'CN',
  Thailand: 'TH',
  Malaysia: 'MY',
  Philippines: 'PH',
  Indonesia: 'ID',
  Vietnam: 'VN',
  'South Africa': 'ZA',
  Nigeria: 'NG',
  Kenya: 'KE',
  Ghana: 'GH',
  Egypt: 'EG',
  Morocco: 'MA',
  Tunisia: 'TN',
  Algeria: 'DZ',
  Israel: 'IL',
  Turkey: 'TR',
  Russia: 'RU',
  Ukraine: 'UA',
  Poland: 'PL',
  'Czech Republic': 'CZ',
  Hungary: 'HU',
  Romania: 'RO',
  Bulgaria: 'BG',
  Croatia: 'HR',
  Slovenia: 'SI',
  Slovakia: 'SK',
  Estonia: 'EE',
  Latvia: 'LV',
  Lithuania: 'LT',
  Ireland: 'IE',
  Portugal: 'PT',
  Greece: 'GR',
  Cyprus: 'CY',
  Malta: 'MT',
  Luxembourg: 'LU',
  Iceland: 'IS',
  Liechtenstein: 'LI',
  Monaco: 'MC',
  'San Marino': 'SM',
  'Vatican City': 'VA',
  Andorra: 'AD',
};

export interface IInsufficientFundsDeclineResult {
  feeCharged: boolean;
  cardBlocked: boolean;
  newDeclineCount: number;
  feeCardTransactionId?: string;
  feeMainTransactionId?: string;
}
