import { HttpStatus } from '@nestjs/common';
import { RestrictionCategory, RestrictionErrorType, RestrictionException } from './restriction_exception';

describe('RestrictionException', () => {
  describe('Compliance Errors', () => {
    it('should create ERR_COMPLIANCE_COUNTRY_BANNED with default message and data', () => {
      const exception = new RestrictionException(RestrictionErrorType.ERR_COMPLIANCE_COUNTRY_BANNED);

      expect(exception.type).toBe(RestrictionErrorType.ERR_COMPLIANCE_COUNTRY_BANNED);
      expect(exception.restrictionCategory).toBe(RestrictionCategory.COMPLIANCE);
      expect(exception.statusCode).toBe(HttpStatus.FORBIDDEN);
      expect(exception.message).toBe('Access denied: This location is not permitted due to regulatory requirements.');
      expect(exception.data.canSelfResolve).toBe(false);
      expect(exception.data.contactSupport).toBe(true);
    });

    it('should create ERR_COMPLIANCE_REGION_RESTRICTED with default message', () => {
      const exception = new RestrictionException(RestrictionErrorType.ERR_COMPLIANCE_REGION_RESTRICTED);

      expect(exception.type).toBe(RestrictionErrorType.ERR_COMPLIANCE_REGION_RESTRICTED);
      expect(exception.restrictionCategory).toBe(RestrictionCategory.COMPLIANCE);
      expect(exception.statusCode).toBe(HttpStatus.FORBIDDEN);
      expect(exception.message).toBe('This service is restricted in your region due to regulatory requirements.');
      expect(exception.data.canSelfResolve).toBe(false);
      expect(exception.data.contactSupport).toBe(true);
    });

    it('should create ERR_COMPLIANCE_ACCOUNT_BLOCKED with default message', () => {
      const exception = new RestrictionException(RestrictionErrorType.ERR_COMPLIANCE_ACCOUNT_BLOCKED);

      expect(exception.type).toBe(RestrictionErrorType.ERR_COMPLIANCE_ACCOUNT_BLOCKED);
      expect(exception.restrictionCategory).toBe(RestrictionCategory.COMPLIANCE);
      expect(exception.statusCode).toBe(HttpStatus.FORBIDDEN);
      expect(exception.message).toBe(
        'Your account is currently restricted. Please contact support to request account unrestriction.',
      );
      expect(exception.data.canSelfResolve).toBe(false);
      expect(exception.data.contactSupport).toBe(true);
    });

    it('should create ERR_COMPLIANCE_KYC_REJECTED with default message', () => {
      const exception = new RestrictionException(RestrictionErrorType.ERR_COMPLIANCE_KYC_REJECTED);

      expect(exception.type).toBe(RestrictionErrorType.ERR_COMPLIANCE_KYC_REJECTED);
      expect(exception.restrictionCategory).toBe(RestrictionCategory.COMPLIANCE);
      expect(exception.statusCode).toBe(HttpStatus.FORBIDDEN);
      expect(exception.message).toBe(
        'Your identity verification was not approved. Please contact support for assistance.',
      );
      expect(exception.data.canSelfResolve).toBe(false);
      expect(exception.data.contactSupport).toBe(true);
    });

    it('should create ERR_COMPLIANCE_SANCTIONS_MATCH with default message', () => {
      const exception = new RestrictionException(RestrictionErrorType.ERR_COMPLIANCE_SANCTIONS_MATCH);

      expect(exception.type).toBe(RestrictionErrorType.ERR_COMPLIANCE_SANCTIONS_MATCH);
      expect(exception.restrictionCategory).toBe(RestrictionCategory.COMPLIANCE);
      expect(exception.statusCode).toBe(HttpStatus.FORBIDDEN);
      expect(exception.message).toBe(
        'Your account has been restricted due to compliance requirements. Please contact support.',
      );
      expect(exception.data.canSelfResolve).toBe(false);
      expect(exception.data.contactSupport).toBe(true);
    });
  });

  describe('User Errors', () => {
    it('should create ERR_USER_ACCOUNT_SELF_RESTRICTED with default message and data', () => {
      const exception = new RestrictionException(RestrictionErrorType.ERR_USER_ACCOUNT_SELF_RESTRICTED);

      expect(exception.type).toBe(RestrictionErrorType.ERR_USER_ACCOUNT_SELF_RESTRICTED);
      expect(exception.restrictionCategory).toBe(RestrictionCategory.USER);
      expect(exception.statusCode).toBe(HttpStatus.FORBIDDEN);
      expect(exception.message).toBe(
        'Your account is currently restricted. You can unrestrict your account through the app.',
      );
      expect(exception.data.canSelfResolve).toBe(true);
      expect(exception.data.contactSupport).toBe(false);
    });

    it('should create ERR_USER_ACCOUNT_LOCKED with default message', () => {
      const exception = new RestrictionException(RestrictionErrorType.ERR_USER_ACCOUNT_LOCKED);

      expect(exception.type).toBe(RestrictionErrorType.ERR_USER_ACCOUNT_LOCKED);
      expect(exception.restrictionCategory).toBe(RestrictionCategory.USER);
      expect(exception.statusCode).toBe(HttpStatus.FORBIDDEN);
      expect(exception.message).toBe('Account temporarily locked due to too many failed attempts.');
      expect(exception.data.canSelfResolve).toBe(true);
      expect(exception.data.contactSupport).toBe(false);
    });

    it('should create ERR_USER_SESSION_EXPIRED with default message', () => {
      const exception = new RestrictionException(RestrictionErrorType.ERR_USER_SESSION_EXPIRED);

      expect(exception.type).toBe(RestrictionErrorType.ERR_USER_SESSION_EXPIRED);
      expect(exception.restrictionCategory).toBe(RestrictionCategory.USER);
      expect(exception.statusCode).toBe(HttpStatus.FORBIDDEN);
      expect(exception.message).toBe('Session expired. Please login again.');
      expect(exception.data.canSelfResolve).toBe(true);
      expect(exception.data.contactSupport).toBe(false);
    });

    it('should create ERR_USER_PIN_LOCKED with default message', () => {
      const exception = new RestrictionException(RestrictionErrorType.ERR_USER_PIN_LOCKED);

      expect(exception.type).toBe(RestrictionErrorType.ERR_USER_PIN_LOCKED);
      expect(exception.restrictionCategory).toBe(RestrictionCategory.USER);
      expect(exception.statusCode).toBe(HttpStatus.FORBIDDEN);
      expect(exception.message).toBe(
        'Too many failed attempts. Your account has been locked. Reset your transaction pin to continue.',
      );
      expect(exception.data.canSelfResolve).toBe(true);
      expect(exception.data.contactSupport).toBe(false);
    });

    it('should create ERR_USER_PENDING_DELETION with default message and contactSupport true', () => {
      const exception = new RestrictionException(RestrictionErrorType.ERR_USER_PENDING_DELETION);

      expect(exception.type).toBe(RestrictionErrorType.ERR_USER_PENDING_DELETION);
      expect(exception.restrictionCategory).toBe(RestrictionCategory.USER);
      expect(exception.statusCode).toBe(HttpStatus.FORBIDDEN);
      expect(exception.message).toBe(
        'Your account is scheduled for deletion, kindly contact support to cancel the request.',
      );
      expect(exception.data.canSelfResolve).toBe(false);
      expect(exception.data.contactSupport).toBe(true);
    });
  });

  describe('Custom Messages', () => {
    it('should allow custom message to override default', () => {
      const customMessage = 'Custom restriction message for testing';
      const exception = new RestrictionException(RestrictionErrorType.ERR_COMPLIANCE_COUNTRY_BANNED, customMessage);

      expect(exception.message).toBe(customMessage);
      expect(exception.type).toBe(RestrictionErrorType.ERR_COMPLIANCE_COUNTRY_BANNED);
      expect(exception.restrictionCategory).toBe(RestrictionCategory.COMPLIANCE);
    });

    it('should use default message when custom message is undefined', () => {
      const exception = new RestrictionException(RestrictionErrorType.ERR_USER_ACCOUNT_LOCKED, undefined);

      expect(exception.message).toBe('Account temporarily locked due to too many failed attempts.');
    });
  });

  describe('Additional Data', () => {
    it('should merge additional data with default data', () => {
      const exception = new RestrictionException(RestrictionErrorType.ERR_COMPLIANCE_COUNTRY_BANNED, undefined, {
        country: 'NK',
        ip: '1.2.3.4',
      });

      expect(exception.data.canSelfResolve).toBe(false);
      expect(exception.data.contactSupport).toBe(true);
      expect(exception.data.country).toBe('NK');
      expect(exception.data.ip).toBe('1.2.3.4');
    });

    it('should allow overriding default data values', () => {
      const exception = new RestrictionException(RestrictionErrorType.ERR_USER_ACCOUNT_SELF_RESTRICTED, undefined, {
        canSelfResolve: false,
        reason: 'admin override',
      });

      expect(exception.data.canSelfResolve).toBe(false);
      expect(exception.data.contactSupport).toBe(false);
      expect(exception.data.reason).toBe('admin override');
    });
  });

  describe('Status Code', () => {
    it('should always return FORBIDDEN status code', () => {
      const complianceException = new RestrictionException(RestrictionErrorType.ERR_COMPLIANCE_COUNTRY_BANNED);
      const userException = new RestrictionException(RestrictionErrorType.ERR_USER_ACCOUNT_LOCKED);

      expect(complianceException.statusCode).toBe(HttpStatus.FORBIDDEN);
      expect(userException.statusCode).toBe(HttpStatus.FORBIDDEN);
    });
  });

  describe('Restriction Category Mapping', () => {
    it('should correctly map all COMPLIANCE error types to COMPLIANCE category', () => {
      const complianceTypes = [
        RestrictionErrorType.ERR_COMPLIANCE_COUNTRY_BANNED,
        RestrictionErrorType.ERR_COMPLIANCE_REGION_RESTRICTED,
        RestrictionErrorType.ERR_COMPLIANCE_ACCOUNT_BLOCKED,
        RestrictionErrorType.ERR_COMPLIANCE_KYC_REJECTED,
        RestrictionErrorType.ERR_COMPLIANCE_SANCTIONS_MATCH,
      ];

      complianceTypes.forEach((type) => {
        const exception = new RestrictionException(type);
        expect(exception.restrictionCategory).toBe(RestrictionCategory.COMPLIANCE);
      });
    });

    it('should correctly map all USER error types to USER category', () => {
      const userTypes = [
        RestrictionErrorType.ERR_USER_ACCOUNT_SELF_RESTRICTED,
        RestrictionErrorType.ERR_USER_ACCOUNT_LOCKED,
        RestrictionErrorType.ERR_USER_SESSION_EXPIRED,
        RestrictionErrorType.ERR_USER_PIN_LOCKED,
        RestrictionErrorType.ERR_USER_PENDING_DELETION,
      ];

      userTypes.forEach((type) => {
        const exception = new RestrictionException(type);
        expect(exception.restrictionCategory).toBe(RestrictionCategory.USER);
      });
    });
  });
});
