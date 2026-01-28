import { HttpStatus } from '@nestjs/common';

/**
 * Restriction category - determines whether the restriction is compliance-driven or user-driven
 */
export enum RestrictionCategory {
  COMPLIANCE = 'COMPLIANCE',
  USER = 'USER',
}

/**
 * Specific error types for restrictions
 * Format: ERR_{CATEGORY}_{SPECIFIC_ERROR}
 */
export enum RestrictionErrorType {
  // Compliance errors (regulatory/external)
  ERR_COMPLIANCE_COUNTRY_BANNED = 'ERR_COMPLIANCE_COUNTRY_BANNED',
  ERR_COMPLIANCE_REGION_RESTRICTED = 'ERR_COMPLIANCE_REGION_RESTRICTED',
  ERR_COMPLIANCE_ACCOUNT_BLOCKED = 'ERR_COMPLIANCE_ACCOUNT_BLOCKED',
  ERR_COMPLIANCE_KYC_REJECTED = 'ERR_COMPLIANCE_KYC_REJECTED',
  ERR_COMPLIANCE_SANCTIONS_MATCH = 'ERR_COMPLIANCE_SANCTIONS_MATCH',

  // User errors (user-initiated/security)
  ERR_USER_ACCOUNT_SELF_RESTRICTED = 'ERR_USER_ACCOUNT_SELF_RESTRICTED',
  ERR_USER_ACCOUNT_LOCKED = 'ERR_USER_ACCOUNT_LOCKED',
  ERR_USER_SESSION_EXPIRED = 'ERR_USER_SESSION_EXPIRED',
  ERR_USER_PIN_LOCKED = 'ERR_USER_PIN_LOCKED',
  ERR_USER_PENDING_DELETION = 'ERR_USER_PENDING_DELETION',
}

/**
 * Data payload for restriction exceptions
 */
export interface RestrictionData {
  canSelfResolve: boolean;
  contactSupport: boolean;
  [key: string]: any;
}

/**
 * Mapping of error types to their category
 */
const ERROR_TYPE_TO_CATEGORY: Record<RestrictionErrorType, RestrictionCategory> = {
  [RestrictionErrorType.ERR_COMPLIANCE_COUNTRY_BANNED]: RestrictionCategory.COMPLIANCE,
  [RestrictionErrorType.ERR_COMPLIANCE_REGION_RESTRICTED]: RestrictionCategory.COMPLIANCE,
  [RestrictionErrorType.ERR_COMPLIANCE_ACCOUNT_BLOCKED]: RestrictionCategory.COMPLIANCE,
  [RestrictionErrorType.ERR_COMPLIANCE_KYC_REJECTED]: RestrictionCategory.COMPLIANCE,
  [RestrictionErrorType.ERR_COMPLIANCE_SANCTIONS_MATCH]: RestrictionCategory.COMPLIANCE,
  [RestrictionErrorType.ERR_USER_ACCOUNT_SELF_RESTRICTED]: RestrictionCategory.USER,
  [RestrictionErrorType.ERR_USER_ACCOUNT_LOCKED]: RestrictionCategory.USER,
  [RestrictionErrorType.ERR_USER_SESSION_EXPIRED]: RestrictionCategory.USER,
  [RestrictionErrorType.ERR_USER_PIN_LOCKED]: RestrictionCategory.USER,
  [RestrictionErrorType.ERR_USER_PENDING_DELETION]: RestrictionCategory.USER,
};

/**
 * Default messages for each error type
 */
const DEFAULT_MESSAGES: Record<RestrictionErrorType, string> = {
  [RestrictionErrorType.ERR_COMPLIANCE_COUNTRY_BANNED]:
    'Access denied: This location is not permitted due to regulatory requirements.',
  [RestrictionErrorType.ERR_COMPLIANCE_REGION_RESTRICTED]:
    'This service is restricted in your region due to regulatory requirements.',
  [RestrictionErrorType.ERR_COMPLIANCE_ACCOUNT_BLOCKED]:
    'Your account is currently restricted. Please contact support to request account unrestriction.',
  [RestrictionErrorType.ERR_COMPLIANCE_KYC_REJECTED]:
    'Your identity verification was not approved. Please contact support for assistance.',
  [RestrictionErrorType.ERR_COMPLIANCE_SANCTIONS_MATCH]:
    'Your account has been restricted due to compliance requirements. Please contact support.',
  [RestrictionErrorType.ERR_USER_ACCOUNT_SELF_RESTRICTED]:
    'Your account is currently restricted. You can unrestrict your account through the app.',
  [RestrictionErrorType.ERR_USER_ACCOUNT_LOCKED]: 'Account temporarily locked due to too many failed attempts.',
  [RestrictionErrorType.ERR_USER_SESSION_EXPIRED]: 'Session expired. Please login again.',
  [RestrictionErrorType.ERR_USER_PIN_LOCKED]:
    'Too many failed attempts. Your account has been locked. Reset your transaction pin to continue.',
  [RestrictionErrorType.ERR_USER_PENDING_DELETION]:
    'Your account is scheduled for deletion, kindly contact support to cancel the request.',
};

/**
 * Default data for each error type
 */
const DEFAULT_DATA: Record<RestrictionErrorType, RestrictionData> = {
  [RestrictionErrorType.ERR_COMPLIANCE_COUNTRY_BANNED]: {
    canSelfResolve: false,
    contactSupport: true,
  },
  [RestrictionErrorType.ERR_COMPLIANCE_REGION_RESTRICTED]: {
    canSelfResolve: false,
    contactSupport: true,
  },
  [RestrictionErrorType.ERR_COMPLIANCE_ACCOUNT_BLOCKED]: {
    canSelfResolve: false,
    contactSupport: true,
  },
  [RestrictionErrorType.ERR_COMPLIANCE_KYC_REJECTED]: {
    canSelfResolve: false,
    contactSupport: true,
  },
  [RestrictionErrorType.ERR_COMPLIANCE_SANCTIONS_MATCH]: {
    canSelfResolve: false,
    contactSupport: true,
  },
  [RestrictionErrorType.ERR_USER_ACCOUNT_SELF_RESTRICTED]: {
    canSelfResolve: true,
    contactSupport: false,
  },
  [RestrictionErrorType.ERR_USER_ACCOUNT_LOCKED]: {
    canSelfResolve: true,
    contactSupport: false,
  },
  [RestrictionErrorType.ERR_USER_SESSION_EXPIRED]: {
    canSelfResolve: true,
    contactSupport: false,
  },
  [RestrictionErrorType.ERR_USER_PIN_LOCKED]: {
    canSelfResolve: true,
    contactSupport: false,
  },
  [RestrictionErrorType.ERR_USER_PENDING_DELETION]: {
    canSelfResolve: false,
    contactSupport: true,
  },
};

/**
 * RestrictionException - Unified exception class for all access restrictions
 * Provides clear classification between compliance-driven and user-driven restrictions
 */
export class RestrictionException {
  public readonly type: RestrictionErrorType;
  public readonly restrictionCategory: RestrictionCategory;
  public readonly statusCode: number = HttpStatus.FORBIDDEN;
  public readonly message: string;
  public readonly data: RestrictionData;

  constructor(errorType: RestrictionErrorType, customMessage?: string, additionalData?: Partial<RestrictionData>) {
    this.type = errorType;
    this.restrictionCategory = ERROR_TYPE_TO_CATEGORY[errorType];
    this.message = customMessage || DEFAULT_MESSAGES[errorType];
    this.data = {
      ...DEFAULT_DATA[errorType],
      ...additionalData,
    };
  }
}
