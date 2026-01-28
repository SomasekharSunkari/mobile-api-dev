// Main interface that all participant adapters must implement
export interface ParticipantAdapterInterface {
  createParticipant(payload: ParticipantCreateRequest): Promise<ParticipantCreateResponse>;
  uploadKycDocument(payload: DocumentUploadRequest): Promise<void>;
  updateParticipant(payload: ParticipantUpdateRequest): Promise<void>;
  createDepositAddress(
    payload: DepositAddressCreateRequest,
    countryCode?: string,
  ): Promise<DepositAddressCreateResponse>;
  getDepositAddress(payload: DepositAddressFetchRequest, countryCode?: string): Promise<DepositAddressFetchResponse>;
  getParticipantRef(payload: GetParticipantRefRequest): Promise<GetParticipantRefResponse>;
  getKycStatus(payload: GetKycStatusRequest): Promise<GetKycStatusResponse>;
}

// Interface for document upload requests
export interface DocumentUploadRequest {
  documentType: string;
  document: string;
  mime: string;
  fileName: string;
  userRef: string;
  idFront: boolean;
  country: string;
}

// Interface for participant update requests
export interface ParticipantUpdateRequest {
  userRef: string;
  platformUpdatedAt: number;
  idNumber: string;
  idNumberType: string;
  livenessCheck: string;
  idv: string;
  taxIdNumber: string;
  citizenshipCode: string;
  // EDD fields
  employmentStatus?: string;
  sourceOfFunds?: string;
  industry?: string;
}

export interface ParticipantCreateRequest {
  firstName: string;
  lastName: string;
  email: string;
  address: string;
  city: string;
  state: string;
  country: string;
  zip?: string;
  dob: string;
  tin?: string; // Tax Identification Number (SSN for US, BVN for NG)
  passport?: string;
  document?: string;
  documentType?: string;
  fileType?: string;
  fileName?: string;
  idFront?: boolean;
  kyc: 'pass' | 'fail';
  kycTimestamp: number;
  compliance: 'pass' | 'fail';
  complianceTimestamp: number;
  signedTimestamp: number;
}

// Response from all participant adapters (provider field is required)
export interface ParticipantCreateResponse {
  firstName?: string;
  lastName?: string;
  email?: string;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  dob?: string;
  kyc?: 'pass' | 'fail';
  kycTimestamp?: number;
  compliance?: 'pass' | 'fail';
  complianceTimestamp?: number;
  signedTimestamp?: number;
  clientCode?: string;
  providerRef: string;
  provider: string;
}

// Interface for deposit address creation requests
export interface DepositAddressCreateRequest {
  userRef: string;
  asset?: string;
}

// Response from all deposit address adapters
export interface DepositAddressCreateResponse {
  address: string;
  asset: string;
  userRef: string;
  createdAt: number;
}

// Interface for fetching existing deposit addresses
export interface DepositAddressFetchRequest {
  participantCode: string;
  asset: string;
}

// Response from fetching deposit address
export interface DepositAddressFetchResponse {
  address?: string;
  asset?: string;
}

export interface GetParticipantRefRequest {
  email: string;
}

export interface GetParticipantRefResponse {
  ref: string;
  email: string;
  provider: string;
}

export interface GetKycStatusRequest {
  userRef: string;
}

export type KycVerificationStatus = 'unknown' | 'pass' | 'fail' | 'not_applicable';

export interface GetKycStatusResponse {
  userRef: string;
  identityVerification: KycVerificationStatus;
  livenessVerification: KycVerificationStatus;
  taxIdNumberProvided: boolean;
  isEnhancedDueDiligence: boolean;
  tags: string[];
  status: string;
  verificationAttempts: number;
  isEnhancedDueDiligenceRequired: boolean;
}
