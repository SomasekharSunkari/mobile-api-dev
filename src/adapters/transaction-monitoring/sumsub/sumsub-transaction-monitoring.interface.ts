// IP Check / KYT Transaction request interfaces
export interface SumsubRequestIpInfo {
  ip: string;
}

export interface SumsubRequestDeviceInfo {
  ipInfo: SumsubRequestIpInfo;
}

export interface SumsubRequestApplicant {
  externalUserId: string;
  device: SumsubRequestDeviceInfo;
}

export interface SumsubIpCheckRequest {
  txnId: string;
  type: 'userPlatformEvent';
  applicant: SumsubRequestApplicant;
}

export interface SumsubApplicantRequestInfo {
  device: SumsubRequestDeviceInfo;
}

export interface SumsubApplicantIpCheckRequest {
  txnId: string;
  applicantId: string;
  type: 'userPlatformEvent';
  applicant: SumsubApplicantRequestInfo;
}

// Simplified interfaces - only the fields we actually need
export interface SumsubIpInfo {
  city: string;
  state: string;
  countryCode2: string;
  vpn?: boolean;
}

export interface SumsubDeviceInfo {
  ipInfo: SumsubIpInfo;
}

export interface SumsubApplicantData {
  device: SumsubDeviceInfo;
}

export interface SumsubResponseData {
  applicant: SumsubApplicantData;
}

export interface SumsubIpCheckResponse {
  data: SumsubResponseData;
}

export interface SumsubTransactionRequest {
  txnId: string;
  txnDate?: string;
  zoneId?: string;
  type: 'finance' | 'kyc' | 'travelRule' | 'userPlatformEvent';
  info?: SumsubTransactionInfo;
  applicant?: SumsubTransactionApplicant;
  counterparty?: SumsubTransactionApplicant;
  userPlatformEventInfo?: SumsubUserPlatformEventInfo;
  paymentMethod?: SumsubPaymentMethod;
  institutionInfo?: SumsubInstitutionInfo;
}

export interface SumsubTransactionInfo {
  direction?: 'in' | 'out';
  amount?: number;
  currencyCode?: string;
  currencyType?: string;
  paymentDetails?: string;
}

export interface SumsubTransactionApplicant {
  type?: 'individual' | 'company';
  externalUserId?: string;
  fullName?: string;
  dob?: string;
  address?: SumsubAddress;
  device?: SumsubDevice;
}

export interface SumsubAddress {
  country?: string;
  postCode?: string;
  town?: string;
  state?: string;
  street?: string;
  subStreet?: string;
}

export interface SumsubDevice {
  ipInfo?: SumsubIpInformation;
  fingerprint?: string;
}

export interface SumsubIpInformation {
  ip?: string;
}

export interface SumsubCounterParty {
  externalUserId?: string;
  fullName?: string;
  address?: SumsubAddress;
}

export interface SumsubUserPlatformEventInfo {
  type?: 'general';
}

export interface SumsubPaymentMethod {
  type: string;
  accountId?: string;
  issuingCountry?: string;
}

export interface SumsubInstitutionInfo {
  name: string;
}

export interface SumsubTransactionResponse {
  data?: {
    txnId?: string;
    status?: string;
    score?: number;
    decision?: string;
    flags?: string[];
    [key: string]: any;
  };
  [key: string]: any;
}
