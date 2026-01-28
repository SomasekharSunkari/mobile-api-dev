import { HttpStatus } from '@nestjs/common';

/**
 * Error types for external account provider KYC status restrictions
 */
export enum ExternalAccountKycErrorType {
  ERR_KYC_SUBMITTED = 'ERR_KYC_SUBMITTED',
  ERR_KYC_PENDING_APPROVAL = 'ERR_KYC_PENDING_APPROVAL',
  ERR_KYC_REJECTED = 'ERR_KYC_REJECTED',
  ERR_KYC_LOCKED = 'ERR_KYC_LOCKED',
  ERR_KYC_PENDING_UNLOCK = 'ERR_KYC_PENDING_UNLOCK',
  ERR_KYC_PENDING_DISABLE = 'ERR_KYC_PENDING_DISABLE',
  ERR_KYC_DISABLED = 'ERR_KYC_DISABLED',
  ERR_KYC_CLOSED = 'ERR_KYC_CLOSED',
  ERR_KYC_DIVESTED = 'ERR_KYC_DIVESTED',
  ERR_KYC_UNKNOWN = 'ERR_KYC_UNKNOWN',
}

/**
 * Mapping of provider KYC statuses to error types
 */
const PROVIDER_STATUS_TO_ERROR_TYPE: Record<string, ExternalAccountKycErrorType> = {
  submitted: ExternalAccountKycErrorType.ERR_KYC_SUBMITTED,
  pending_approval: ExternalAccountKycErrorType.ERR_KYC_PENDING_APPROVAL,
  rejected: ExternalAccountKycErrorType.ERR_KYC_REJECTED,
  locked: ExternalAccountKycErrorType.ERR_KYC_LOCKED,
  pending_unlock: ExternalAccountKycErrorType.ERR_KYC_PENDING_UNLOCK,
  pending_disable: ExternalAccountKycErrorType.ERR_KYC_PENDING_DISABLE,
  disabled: ExternalAccountKycErrorType.ERR_KYC_DISABLED,
  closed: ExternalAccountKycErrorType.ERR_KYC_CLOSED,
  divested: ExternalAccountKycErrorType.ERR_KYC_DIVESTED,
};

/**
 * User-friendly messages for each error type
 */
const DEFAULT_MESSAGES: Record<ExternalAccountKycErrorType, string> = {
  [ExternalAccountKycErrorType.ERR_KYC_SUBMITTED]: 'Your account verification is being processed.',
  [ExternalAccountKycErrorType.ERR_KYC_PENDING_APPROVAL]: 'Your account verification is under review.',
  [ExternalAccountKycErrorType.ERR_KYC_REJECTED]: 'Your account verification was declined.',
  [ExternalAccountKycErrorType.ERR_KYC_LOCKED]: 'Your account is temporarily restricted.',
  [ExternalAccountKycErrorType.ERR_KYC_PENDING_UNLOCK]: 'Your account is temporarily restricted.',
  [ExternalAccountKycErrorType.ERR_KYC_PENDING_DISABLE]: 'Your account access is being reviewed.',
  [ExternalAccountKycErrorType.ERR_KYC_DISABLED]: 'Your account is not available for transactions.',
  [ExternalAccountKycErrorType.ERR_KYC_CLOSED]: 'Your account has been closed.',
  [ExternalAccountKycErrorType.ERR_KYC_DIVESTED]: 'Your account has been closed.',
  [ExternalAccountKycErrorType.ERR_KYC_UNKNOWN]: 'Your account is not fully verified.',
};

/**
 * ExternalAccountKycException - Exception for provider KYC status restrictions
 * Thrown when external account provider_kyc_status prevents transactions
 */
export class ExternalAccountKycException {
  public readonly type: ExternalAccountKycErrorType;
  public readonly statusCode: number = HttpStatus.FORBIDDEN;
  public readonly message: string;
  public readonly providerKycStatus: string;

  constructor(providerKycStatus: string, customMessage?: string) {
    this.providerKycStatus = providerKycStatus;
    const normalizedStatus = providerKycStatus?.toLowerCase();
    this.type = PROVIDER_STATUS_TO_ERROR_TYPE[normalizedStatus] || ExternalAccountKycErrorType.ERR_KYC_UNKNOWN;
    this.message = customMessage || DEFAULT_MESSAGES[this.type];
  }

  /**
   * Helper to check if a provider KYC status allows transactions
   */
  static isApproved(providerKycStatus: string | null | undefined): boolean {
    return providerKycStatus?.toLowerCase() === 'approved';
  }

  /**
   * Helper to create exception from provider KYC status if not approved
   * Returns null if status is approved
   */
  static checkStatus(providerKycStatus: string | null | undefined): ExternalAccountKycException | null {
    if (this.isApproved(providerKycStatus)) {
      return null;
    }
    return new ExternalAccountKycException(providerKycStatus || 'unknown');
  }
}
