import { Request } from 'express';
import { KycVerificationEnum } from '../../database/models/kycVerification/kycVerification.interface';

export enum IdentityDocType {
  DRIVERS = 'DRIVERS',
  PASSPORT = 'PASSPORT',
  SELFIE = 'SELFIE',
  RESIDENCE_PERMIT = 'RESIDENCE_PERMIT',
  BVN = 'BVN',
  NIN = 'NIN',
}

export enum IdentityDocSubType {
  FRONT_SIDE = 'FRONT_SIDE',
  BACK_SIDE = 'BACK_SIDE',
}

export interface KYCManagementInterface {
  initiateWidgetKyc(payload: InitiateWidgetKycPayload): Promise<WidgetKYCInitiateResponse>;
  initiateDirectKyc(payload: InitiateDirectKycPayload): Promise<DirectKYCInitiateResponse>;
  validateKyc(): Promise<ValidateKycResponse>;
  getKycDetails(payload: GetKycDetailsPayload): Promise<KycBaseResponse<GetKycDetailsResponse>>;
  getDocumentInfo(payload: GetDocumentInfoPayload): Promise<KycBaseResponse<GetDocumentInfoResponse>>;
  getDocumentContent(payload: GetDocumentContentPayload): Promise<KycBaseResponse<GetDocumentContentResponse>>;
  supportedCountries(): string[];
  processWebhook(
    payload: ProcessKycWebhookPayload,
    provider?: string,
  ): Promise<KycBaseResponse<ProcessKycWebhookResponse>>;
  getFullInfo(userRef: string, country?: string): Promise<KycBaseResponse<GetKycDetailsResponse>>;
  verifySignature(req: Request, country?: string): boolean;
  generateAccessToken(data: GenerateAccessTokenPayload): Promise<KycBaseResponse<GenerateAccessTokenResponse>>;
  generateShareToken(data: GenerateShareTokenPayload): Promise<KycBaseResponse<GenerateShareTokenResponse>>;
  performAMLCheck(payload: PerformAMLCheckPayload): Promise<KycBaseResponse<PerformAMLCheckResponse>>;
  getKycDetailsByUserId(userId: string): Promise<KycBaseResponse<GetKycDetailsResponse>>;
  resetApplicant(payload: ResetApplicantPayload): Promise<KycBaseResponse<ResetApplicantResponse>>;
  updateApplicantTaxInfo(
    payload: UpdateApplicantTaxInfoPayload,
  ): Promise<KycBaseResponse<UpdateApplicantTaxInfoResponse>>;
}

export interface ProcessKycWebhookPayload {
  applicantId: string;
  externalUserId?: string;
  type: string;
  kycStatus: KycVerificationEnum;
  createdAt?: string;
  timestamp?: string;
  country?: string;
}

export interface ProcessKycWebhookResponse {
  type?: string;
  kycStatus: KycVerificationEnum;
  rejectReason?: string;
  kycDetails: GetKycDetailsResponse;
}

export interface ApplicantIdentifier {
  email: string;
  phone: string;
}

export interface GenerateAccessTokenPayload {
  userId: string;
  verificationType: string;
  applicantIdentifier: ApplicantIdentifier;
  shareToken?: string;
}

export interface GenerateAccessTokenResponse {
  token: string;
  userId: string;
  kycVerificationType: string;
}

export interface GenerateShareTokenPayload {
  applicantId: string;
  forClientId: string;
  ttlInSecs?: number;
}

export interface GenerateShareTokenResponse {
  token: string;
  forClientId: string;
}

export interface GetKycDetailsPayload {
  applicantId: string;
  country?: string;
}

export interface GetKycDetailsIdDocument {
  type: string;
  number: string;
  validUntil: string;
}

export interface GetKycDetailsAddress {
  address: string;
  address2?: string;
  city: string;
  country: string;
  postalCode?: string;
  state: string;
}

export interface GetKycDetailsAdditionalIdDocument {
  country_code: string;
  type: IdentityDocType;
  number: string;
  validUntil?: string;
  issuedAt?: string;
}

export interface GetKycDetailsResponse {
  id: string;
  userId: string;
  referenceId?: string;
  firstName: string;
  lastName: string;
  middleName?: string;
  dob: string;
  country: string;
  email: string;
  phone: string;
  address?: GetKycDetailsAddress;
  idDocument?: GetKycDetailsIdDocument;
  idNumber?: string;
  additionalIdDocuments?: GetKycDetailsAdditionalIdDocument[];
  status?: KycVerificationEnum;
  errorMessage?: string;
  failureReason?: string;
  failureCorrection?: string;
  agreementAcceptedAt?: string;
  verifications?: string[];
  platform?: string;
  submittedAt?: string;
  reviewedAt?: string;
  completedAt?: string;
  approvedAt?: string;
  rejectedAt?: string;
  accountPurpose?: string;
  mostRecentOccupation?: string;
  employmentStatus?: string;
  sourceOfFunds?: string;
  expectedMonthlyPaymentsUsd?: string;
  expectedAnnualSalary?: string;
}

export interface PerformAMLCheckPayload {
  applicantId: string;
}

export interface PerformAMLCheckResponse {
  ok: number;
}

export interface KycBaseResponse<T> {
  data: T;
  message: string;
  status: string | number;
}

export interface InitiateWidgetKycPayload {
  userId: string;
  email?: string;
  phoneNumber?: string;
  kycVerificationType: string;
}

export interface InitiateDirectKycPayload {
  userId: string;
  firstName: string;
  lastName: string;
  email?: string;
  phoneNumber?: string;
}

export interface WidgetKYCInitiateResponse {
  token: string;
  userId: string;
  kycVerificationType: string;
}

export interface DirectKYCInitiateResponse {
  /**
   *
   * This is not supported currently
   */
}

export interface KycDetailsResponse {
  /**
   *
   * This is not supported
   */
}

export interface ValidateKycResponse {
  /**
   *
   * This is not supported currently
   */
}

export interface GetDocumentInfoPayload {
  applicantId: string;
}

export enum VerificationResult {
  GREEN = 'GREEN',
  RED = 'RED',
  YELLOW = 'YELLOW',
  UNKNOWN = 'UNKNOWN',
}

export interface DocumentResource {
  id: string;
  documentType: IdentityDocType;
  documentSubType?: IdentityDocSubType; // FRONT_SIDE, BACK_SIDE for DRIVERS
  country: string;
  uploadSource?: string; // fileupload, liveness, etc.
  verificationResult?: VerificationResult; // For liveness check logic
  referenceId?: string; // Needed for document content API call
  content?: string; // Base64 encoded document content
  mimeType?: string; // File type (jpeg, png, pdf, etc.)
  originalFileName?: string; // Original filename
  lastUpdatedAt?: number; // Timestamp
  documentNumber?: string; // Document number
  documentCategory?: string; // Document type classification
  livenessVerification?: string; // pass/fail
  taxIdentifier?: string; // Tax ID/SSN
  nationalityCode?: string; // Country code
}

export interface GetDocumentInfoResponse {
  applicantId: string;
  documents: DocumentResource[];
}

export interface GetDocumentContentPayload {
  referenceId: string;
  documentId: string;
}

export interface GetDocumentContentResponse {
  documentId: string;
  content: string; // Base64 encoded content
  mimeType: string;
  fileName: string;
}

export interface ParsedDocumentResponse {
  content: string;
  mimeType: string;
  fileName: string;
}

export interface ResetApplicantPayload {
  applicantId: string;
}

export interface ResetApplicantResponse {
  ok: number;
}

export interface UpdateApplicantTaxInfoPayload {
  applicantId: string;
  tin?: string;
}

export interface UpdateApplicantTaxInfoResponse {
  ok: number;
}
