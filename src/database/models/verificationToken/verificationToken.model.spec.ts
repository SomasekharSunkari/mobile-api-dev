import { VerificationType } from './verificationToken.interface';
import { VerificationTokenModel } from './verificationToken.model';

describe('VerificationTokenModel', () => {
  describe('tableName', () => {
    it('should return the correct table name', () => {
      expect(VerificationTokenModel.tableName).toBe('api_service.verification_tokens');
    });
  });

  describe('publicProperty', () => {
    it('should return all public properties', () => {
      const properties = VerificationTokenModel.publicProperty();
      expect(properties).toContain('id');
      expect(properties).toContain('user_id');
      expect(properties).toContain('token_identifier');
      expect(properties).toContain('verification_type');
      expect(properties).toContain('expires_at');
      expect(properties).toContain('is_used');
      expect(properties).toContain('used_at');
      expect(properties).toContain('created_at');
      expect(properties).toContain('updated_at');
    });

    it('should accept additional properties', () => {
      const properties = VerificationTokenModel.publicProperty(['deleted_at']);
      expect(properties).toContain('deleted_at');
    });
  });

  describe('jsonSchema', () => {
    it('should have required fields', () => {
      const schema = VerificationTokenModel.jsonSchema;
      expect(schema.required).toContain('user_id');
      expect(schema.required).toContain('token_identifier');
      expect(schema.required).toContain('verification_type');
      expect(schema.required).toContain('expires_at');
    });

    it('should have correct property types', () => {
      const schema = VerificationTokenModel.jsonSchema;
      expect((schema.properties.user_id as any).type).toBe('string');
      expect((schema.properties.token_identifier as any).type).toBe('string');
      expect((schema.properties.verification_type as any).type).toBe('string');
      expect((schema.properties.is_used as any).type).toBe('boolean');
    });

    it('should have default value for is_used', () => {
      const schema = VerificationTokenModel.jsonSchema;
      expect((schema.properties.is_used as any).default).toBe(false);
    });

    it('should allow nullable used_at', () => {
      const schema = VerificationTokenModel.jsonSchema;
      expect((schema.properties.used_at as any).type).toContain('string');
      expect((schema.properties.used_at as any).type).toContain('null');
    });
  });

  describe('relationMappings', () => {
    it('should have user relation', () => {
      const relations = VerificationTokenModel.relationMappings;
      expect(relations.user).toBeDefined();
      expect(typeof relations.user.relation).toBe('function');
    });
  });

  describe('modifiers', () => {
    it('should have notDeleted modifier', () => {
      const modifiers = VerificationTokenModel.modifiers;
      expect(modifiers.notDeleted).toBeDefined();
    });

    it('should have notUsed modifier', () => {
      const modifiers = VerificationTokenModel.modifiers;
      expect(modifiers.notUsed).toBeDefined();
    });

    it('should have notExpired modifier', () => {
      const modifiers = VerificationTokenModel.modifiers;
      expect(modifiers.notExpired).toBeDefined();
    });

    it('should have valid modifier', () => {
      const modifiers = VerificationTokenModel.modifiers;
      expect(modifiers.valid).toBeDefined();
    });
  });

  describe('model instance', () => {
    it('should create a valid instance', () => {
      const verificationToken = new VerificationTokenModel();
      verificationToken.user_id = 'user-123';
      verificationToken.token_identifier = 'token-identifier-abc';
      verificationToken.verification_type = VerificationType.CHANGE_PIN;
      verificationToken.expires_at = new Date();
      verificationToken.is_used = false;

      expect(verificationToken.user_id).toBe('user-123');
      expect(verificationToken.token_identifier).toBe('token-identifier-abc');
      expect(verificationToken.verification_type).toBe(VerificationType.CHANGE_PIN);
      expect(verificationToken.expires_at).toBeInstanceOf(Date);
      expect(verificationToken.is_used).toBe(false);
    });

    it('should allow used_at to be undefined', () => {
      const verificationToken = new VerificationTokenModel();
      verificationToken.user_id = 'user-123';
      verificationToken.token_identifier = 'token-identifier-abc';
      verificationToken.verification_type = VerificationType.RESET_PASSWORD;
      verificationToken.expires_at = new Date();
      verificationToken.is_used = false;

      expect(verificationToken.used_at).toBeUndefined();
    });

    it('should support different verification types', () => {
      const verificationToken = new VerificationTokenModel();

      verificationToken.verification_type = VerificationType.EMAIL_VERIFICATION;
      expect(verificationToken.verification_type).toBe('email_verification');

      verificationToken.verification_type = VerificationType.PHONE_VERIFICATION;
      expect(verificationToken.verification_type).toBe('phone_verification');

      verificationToken.verification_type = VerificationType.TWO_FACTOR_AUTH;
      expect(verificationToken.verification_type).toBe('two_factor_auth');

      verificationToken.verification_type = VerificationType.ACCOUNT_DEACTIVATION;
      expect(verificationToken.verification_type).toBe('account_deactivation');

      verificationToken.verification_type = VerificationType.WITHDRAW_FUNDS;
      expect(verificationToken.verification_type).toBe('withdraw_funds');
    });

    it('should set used_at when token is used', () => {
      const verificationToken = new VerificationTokenModel();
      verificationToken.user_id = 'user-123';
      verificationToken.token_identifier = 'token-identifier-abc';
      verificationToken.verification_type = VerificationType.CHANGE_PIN;
      verificationToken.expires_at = new Date();
      verificationToken.is_used = true;
      verificationToken.used_at = new Date();

      expect(verificationToken.is_used).toBe(true);
      expect(verificationToken.used_at).toBeInstanceOf(Date);
    });
  });
});
