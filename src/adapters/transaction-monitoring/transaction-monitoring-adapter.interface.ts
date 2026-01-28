export interface TransactionMonitoringInterface {
  ipCheck(payload: IpCheckPayload): Promise<IpCheckResponse>;
  ipCheckForApplicant(payload: IpCheckForApplicantPayload): Promise<IpCheckResponse>;
  submitTransaction(payload: SubmitTransactionPayload): Promise<SubmitTransactionResponse>;
}

export interface IpCheckPayload {
  ipAddress: string;
  userId: string;
}

export interface IpCheckResponse {
  city?: string;
  region?: string;
  country?: string;
  isVpn?: boolean;
}

export interface IpCheckForApplicantPayload {
  ipAddress: string;
  applicantId: string;
}

// Generic transaction monitoring interfaces
export interface SubmitTransactionPayload {
  applicantId: string;
  transactionId: string;
  transactionDate?: string;
  timeZone?: string;
  transactionType: TransactionType;
  direction?: TransactionDirection;
  amount?: number;
  currency?: string;
  description?: string;
  participant?: TransactionParticipant;
  device?: DeviceInfo;
  counterparty?: TransactionParticipant;
}

export interface SubmitTransactionResponse {
  transactionId: string;
  status: string;
  riskScore?: number;
  decision?: string;
  flaggedReasons?: string[];
  data?: Record<string, any>;
}

export interface TransactionParticipant {
  type?: 'individual' | 'company';
  externalUserId?: string;
  fullName: string;
  dateOfBirth?: string;
  address?: Address;
  bankAccount?: BankAccountInfo;
  bankInfo?: BankInfo;
}

export interface Address {
  countryCode?: string;
  postal?: string;
  city?: string;
  state?: string;
  addressLine1?: string;
  addressLine2?: string;
}

export interface DeviceInfo {
  deviceFingerprint?: string;
  ipInfo?: IpInfo;
  location?: Location;
}

export interface Location {
  countryCode?: string;
  postal?: string;
  city?: string;
  state?: string;
}

export interface IpInfo {
  ipAddress: string;
}

export interface BankAccountInfo {
  accountType: string;
  accountNumber?: string;
  countryCode?: string;
}

export interface BankInfo {
  bankName: string;
}

export enum TransactionType {
  FINANCE = 'finance',
  KYC = 'kyc',
  TRAVEL_RULE = 'travelRule',
  USER_PLATFORM_EVENT = 'userPlatformEvent',
}

export enum TransactionDirection {
  IN = 'in',
  OUT = 'out',
}
