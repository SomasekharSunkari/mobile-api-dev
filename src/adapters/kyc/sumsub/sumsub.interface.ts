import { VerificationResult } from '../kyc-adapter.interface';

export interface SumsubBasePayload {
  applicantId: string;
  inspectionId: string;
  correlationId: string;
  levelName: string;
  externalUserId: string;
  createdAtMs: string;
  createdAt?: string; // Optional, present in some webhooks
}

export interface SumsubReviewResult {
  moderationComment?: string;
  clientComment?: string;
  reviewAnswer: 'RED' | 'GREEN';
  rejectLabels?: string[];
  reviewRejectType?: 'FINAL' | 'RETRY';
  buttonIds?: string[];
}

export interface SumsubApplicantCreatedPayload extends SumsubBasePayload {
  type: 'applicantCreated';
  sandboxMode: boolean;
  reviewStatus: 'init';
  clientId: string;
}

export interface SumsubApplicantReviewedPayload extends SumsubBasePayload {
  type: 'applicantReviewed';
  reviewResult?: SumsubReviewResult;
  reviewStatus: 'init' | 'completed' | 'onHold' | 'pending';
}

export interface SumsubApplicantPrecheckedPayload extends SumsubBasePayload {
  type: 'applicantPrechecked';
  applicantType: string;
  sandboxMode: boolean;
  reviewStatus: 'init' | 'completed' | 'onHold' | 'pending';
  clientId: string;
}

export interface SumsubApplicantLevelChangedPayload extends SumsubBasePayload {
  type: 'applicantLevelChanged';
  applicantType: string;
  sandboxMode: boolean;
  reviewStatus: 'init' | 'completed' | 'onHold' | 'pending';
  clientId: string;
}

export interface SumsubApplicantWorkflowCompletedPayload extends SumsubBasePayload {
  type: 'applicantWorkflowCompleted';
  applicantType: string;
  sandboxMode: boolean;
  reviewResult?: SumsubReviewResult;
  reviewStatus: 'init' | 'completed' | 'onHold' | 'pending';
  clientId: string;
}

export interface SumsubVideoIdentStatusChangedPayload extends SumsubBasePayload {
  type: 'videoIdentStatusChanged';
  applicantType?: string;
  sandboxMode: boolean;
  reviewStatus: 'init' | 'completed' | 'onHold' | 'pending';
  videoIdentReviewStatus?: string;
  reviewResult?: SumsubReviewResult;
  compositionMediaId?: string;
  clientId: string;
}

export interface SumsubApplicantVerificationResetPayload extends SumsubBasePayload {
  type: 'applicantVerificationReset';
  reason: string;
  clientId: string;
  sandboxMode: boolean;
  reviewStatus: 'init' | 'completed' | 'onHold' | 'pending';
}

export interface SumsubApplicantPendingPayload extends SumsubBasePayload {
  type: 'applicantPending';
  applicantType: string;
  sandboxMode: boolean;
  reviewStatus: 'init' | 'completed' | 'onHold' | 'pending';
  reviewMode?: string;
  clientId: string;
}

export interface SumsubApplicantOnHoldPayload extends SumsubBasePayload {
  type: 'applicantOnHold';
  applicantType: string;
  sandboxMode: boolean;
  reviewStatus: 'init' | 'completed' | 'onHold' | 'pending';
  reviewResult?: SumsubReviewResult;
  clientId: string;
}

export interface SumsubApplicantActionPendingPayload extends SumsubBasePayload {
  type: 'applicantActionPending';
  applicantActionId: string;
  externalApplicantActionId: string;
  applicantType: string;
  reviewStatus: 'init' | 'completed' | 'onHold' | 'pending';
}

export interface SumsubApplicantActionReviewedPayload extends SumsubBasePayload {
  type: 'applicantActionReviewed';
  applicantActionId: string;
  externalApplicantActionId: string;
  applicantType: string;
  reviewStatus: 'init' | 'completed' | 'onHold' | 'pending';
  reviewResult?: SumsubReviewResult;
}

export interface SumsubApplicantActionOnHoldPayload extends SumsubBasePayload {
  type: 'applicantActionOnHold';
  applicantActionId: string;
  externalApplicantActionId: string;
  applicantType: string;
  reviewStatus: 'init' | 'completed' | 'onHold' | 'pending';
  reviewResult?: SumsubReviewResult;
}

export interface SumsubApplicantPersonalInfoChangedPayload extends SumsubBasePayload {
  type: 'applicantPersonalInfoChanged';
  applicantType: string;
  sandboxMode: boolean;
  reviewResult: SumsubReviewResult;
  reviewStatus: 'init' | 'completed' | 'onHold' | 'pending';
  clientId: string;
}

export interface SumsubApplicantTagsChangedPayload extends SumsubBasePayload {
  type: 'applicantTagsChanged';
  applicantType: string;
  sandboxMode: boolean;
  clientId: string;
}

export interface SumsubApplicantActivatedPayload extends SumsubBasePayload {
  type: 'applicantActivated';
}

export interface SumsubApplicantDeactivatedPayload extends SumsubBasePayload {
  type: 'applicantDeactivated';
}

export interface SumsubApplicantDeletedPayload extends SumsubBasePayload {
  type: 'applicantDeleted';
}

export interface SumsubApplicantResetPayload extends SumsubBasePayload {
  type: 'applicantReset';
}

export interface SumsubApplicantWorkflowFailedPayload extends SumsubBasePayload {
  type: 'applicantWorkflowFailed';
  applicantType: string;
  sandboxMode: boolean;
  reviewResult?: SumsubReviewResult;
  reviewStatus: 'init' | 'completed' | 'onHold' | 'pending';
  clientId: string;
}

export interface SumsubVideoIdentCompositionCompletedPayload extends SumsubBasePayload {
  type: 'videoIdentCompositionCompleted';
  compositionMediaId: string;
  applicantType?: string;
  sandboxMode: boolean;
  reviewStatus: 'init' | 'completed' | 'onHold' | 'pending';
  clientId: string;
}

export interface SumsubApplicantKytTxnApprovedPayload extends SumsubBasePayload {
  type: 'applicantKytTxnApproved';
  reviewResult?: SumsubReviewResult;
  reviewStatus: 'init' | 'completed' | 'onHold' | 'pending';
  kytTxnId: string;
  kytDataTxnId: string;
  kytTxnType: string;
  sandboxMode: boolean;
  clientId: string;
}

export interface SumsubApplicantKytTxnRejectedPayload extends SumsubBasePayload {
  type: 'applicantKytTxnRejected';
  reviewResult?: SumsubReviewResult;
  reviewStatus: 'init' | 'completed' | 'onHold' | 'pending';
  kytTxnId: string;
  kytDataTxnId: string;
  kytTxnType: string;
  sandboxMode: boolean;
  clientId: string;
}

export interface SumsubApplicantKytOnHoldPayload extends SumsubBasePayload {
  type: 'applicantKytOnHold';
  reviewStatus: 'onHold';
  kytTxnId: string;
  kytDataTxnId: string;
  kytTxnType: string;
  sandboxMode: boolean;
  clientId: string;
}

export type SumsubWebhookPayload =
  | SumsubApplicantCreatedPayload
  | SumsubApplicantPendingPayload
  | SumsubApplicantReviewedPayload
  | SumsubApplicantOnHoldPayload
  | SumsubApplicantVerificationResetPayload
  | SumsubApplicantActionPendingPayload
  | SumsubApplicantActionReviewedPayload
  | SumsubApplicantActionOnHoldPayload
  | SumsubApplicantPersonalInfoChangedPayload
  | SumsubApplicantTagsChangedPayload
  | SumsubApplicantActivatedPayload
  | SumsubApplicantDeactivatedPayload
  | SumsubApplicantDeletedPayload
  | SumsubApplicantResetPayload
  | SumsubApplicantPrecheckedPayload
  | SumsubApplicantLevelChangedPayload
  | SumsubApplicantWorkflowCompletedPayload
  | SumsubApplicantWorkflowFailedPayload
  | SumsubVideoIdentStatusChangedPayload
  | SumsubVideoIdentCompositionCompletedPayload
  | SumsubApplicantKytTxnApprovedPayload
  | SumsubApplicantKytTxnRejectedPayload
  | SumsubApplicantKytOnHoldPayload;

interface ApplicantIdentifier {
  email: string;
  phone: string;
}
export interface SumsubGenerateAccessTokenPayload {
  userId: string;
  levelName: string;
  applicantIdentifier?: ApplicantIdentifier;
  shareToken?: string;
}

export interface SumsubGenerateAccessTokenResponse {
  token: string;
  userId: string;
}

export interface SumsubGenerateShareTokenPayload {
  applicantId: string;
  forClientId: string;
  ttlInSecs?: number;
}

export interface SumsubGenerateShareTokenResponse {
  token: string;
  forClientId: string;
}

export interface SumsubIdDoc {
  idDocType: string;
  country: string;
  firstName: string;
  firstNameEn: string;
  middleName: string;
  middleNameEn: string;
  lastName: string;
  lastNameEn: string;
  validUntil: string;
  number: string;
  dob: string;
}

export interface SumsubApplicantInfo {
  firstName: string;
  firstNameEn: string;
  middleName: string;
  middleNameEn: string;
  lastName: string;
  lastNameEn: string;
  dob: string;
  country: string;
  tin?: string;
  idDocs: SumsubIdDoc[];
  addresses?: SumsubInfoAddress[];
}

export interface SumsubFixedInfo {
  dob: string;
  country: string;
  residenceCountry: string;
  addresses: SumsubInfoAddress[];
  tin: string;
  age?: number;
}

export interface SumsubInfoAddress {
  subStreet: string;
  subStreetEn: string;
  street: string;
  streetEn: string;
  state: string;
  stateEn: string;
  stateCode: string | null;
  town: string;
  townEn: string;
  postCode: string;
  country: string;
  formattedAddress: string;
}

export interface SumsubAgreementItem {
  id: string;
  acceptedAt: string;
  source: string;
  type: string;
  recordIds: string[];
}

export interface SumsubAgreement {
  items: SumsubAgreementItem[];
  acceptedAt: string;
  source: string;
  recordIds: string[];
}

export interface SumsubDocSet {
  idDocSetType: string;
  types: string[];
  videoRequired: string;
}

export interface SumsubRequiredIdDocs {
  docSets: SumsubIdDoc[];
}

export interface SumsubReview {
  reviewId: string;
  attemptId: string;
  attemptCnt: number;
  elapsedSincePendingMs: number;
  elapsedSinceQueuedMs: number;
  reprocessing: boolean;
  levelName: string;
  levelAutoCheckMode: string | null;
  createDate: string;
  reviewDate: string;
  reviewResult: SumsubReviewResult;
  reviewStatus: 'init' | 'completed' | 'onHold' | 'pending';
  priority: number;
}

export interface SumsubQuestionnaireItem {
  value: string;
}

export interface SumsubQuestionnaireSection {
  score: number;
  items: { [key: string]: SumsubQuestionnaireItem };
}

export interface SumsubQuestionnaire {
  id: string;
  sections: { [key: string]: SumsubQuestionnaireSection };
  score: number;
}

export type SumsubAddressKeyValue = {
  key: 'Street' | 'City' | 'Postcode' | 'State' | 'Country';
  value: string;
};

export interface SumsubApplicant {
  id: string;
  createdAt: string;
  key: string;
  clientId: string;
  inspectionId: string;
  externalUserId: string;
  info: SumsubApplicantInfo;
  fixedInfo?: SumsubFixedInfo;
  email: string;
  phone: string;
  applicantPlatform: string;
  agreement: SumsubAgreement;
  requiredIdDocs: SumsubRequiredIdDocs;
  review: SumsubReview;
  lang: string;
  type: string;
  questionnaires?: SumsubQuestionnaire[];
  metadata?: SumsubAddressKeyValue[];
}

export interface GetSumsubApplicantPayload {
  applicantId?: string;
}

export interface SumsubAMLCheckPayload {
  applicantId: string;
}

export interface SumsubAMLCheckResponse {
  ok: number;
}

export interface SumsubIdDocDef {
  country: string;
  idDocType: string;
  idDocSubType?: string;
}

export interface SumsubFileMetadata {
  fileName: string;
  fileType: string;
  fileSize: number;
  resolutionWidth: number;
  resolutionHeight: number;
}

export interface SumsubDocumentReviewResult {
  reviewAnswer: VerificationResult;
}

export interface SumsubDocumentItem {
  id: string;
  previewId: string;
  addedDate: string;
  fileMetadata: SumsubFileMetadata;
  idDocDef: SumsubIdDocDef;
  reviewResult: SumsubDocumentReviewResult;
  deactivated: boolean;
  attemptId: string;
  source: string;
}

export interface SumsubDocumentMetadataResponse {
  items: SumsubDocumentItem[];
  totalItems: number;
}

export interface SumsubDocumentContentResponse {
  data: Buffer;
  headers: {
    'content-type': string;
    'content-length'?: string;
  };
}
