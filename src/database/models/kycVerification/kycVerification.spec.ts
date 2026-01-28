import { BaseModel } from '../../base';
import { DatabaseSchema } from '../../database.schema';
import { DatabaseTables } from '../../database.table';
import { IKycVerification, KycVerificationEnum } from './kycVerification.interface';
import { KycVerificationModel } from './kycVerification.model';
import { KycVerificationValidationSchema } from './kycVerification.validation';

jest.mock('../../base');

describe('KycVerificationModel', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('KycVerificationEnum', () => {
    it('should define the correct status values', () => {
      expect(KycVerificationEnum.PENDING).toBe('pending');
      expect(KycVerificationEnum.IN_REVIEW).toBe('in_review');
      expect(KycVerificationEnum.REJECTED).toBe('rejected');
      expect(KycVerificationEnum.APPROVED).toBe('approved');
      expect(KycVerificationEnum.NOT_STARTED).toBe('not_started');
      expect(KycVerificationEnum.SUBMITTED).toBe('submitted');
      expect(KycVerificationEnum.RESTARTED).toBe('restarted');
      expect(KycVerificationEnum.RESUBMISSION_REQUESTED).toBe('resubmission_requested');
    });

    it('should have exactly eight status types', () => {
      const statusCount = Object.keys(KycVerificationEnum).length;
      expect(statusCount).toBe(8);
    });
  });

  describe('KycVerificationValidationSchema', () => {
    it('should have the correct title', () => {
      expect(KycVerificationValidationSchema.title).toBe('KYC Verification Validation Schema');
    });

    it('should be of type object', () => {
      expect(KycVerificationValidationSchema.type).toBe('object');
    });

    it('should require specific fields', () => {
      const requiredFields = KycVerificationValidationSchema.required;
      expect(requiredFields).toContain('user_id');
      expect(requiredFields).toContain('status');
      expect(requiredFields.length).toBe(2);
    });

    describe('properties', () => {
      const properties = KycVerificationValidationSchema.properties;

      it('should have user_id property', () => {
        expect(properties.user_id).toEqual({ type: 'string' });
      });

      it('should have provider_ref property', () => {
        expect(properties.provider_ref).toEqual({ type: 'string' });
      });

      it('should have attempt property with default', () => {
        expect(properties.attempt).toEqual({ type: 'integer', default: 0 });
      });

      it('should have status property', () => {
        expect(properties.status).toEqual({ type: 'string' });
      });

      it('should have error_message property as nullable string', () => {
        expect(properties.error_message).toEqual({ type: ['string', 'null'] });
      });

      it('should have submitted_at property as nullable date-time', () => {
        expect(properties.submitted_at).toEqual({ type: ['string', 'null'], format: 'date-time' });
      });

      it('should have reviewed_at property as nullable date-time', () => {
        expect(properties.reviewed_at).toEqual({ type: ['string', 'null'], format: 'date-time' });
      });

      it('should have provider_verification_type property as nullable string', () => {
        expect(properties.provider_verification_type).toEqual({ type: ['string', 'null'] });
      });

      it('should have metadata property as nullable object', () => {
        expect(properties.metadata).toEqual({
          type: ['object', 'null'],
          properties: {
            dob: { type: ['string', 'null'], format: 'date' },
            pic_url: { type: ['string', 'null'] },
            created_date: { type: ['string', 'null'], format: 'date-time' },
            address: { type: ['string', 'null'] },
          },
        });
      });

      it('should have provider_status property as nullable string', () => {
        expect(properties.provider_status).toEqual({ type: ['string', 'null'] });
      });

      it('should have provider_id property as nullable string', () => {
        expect(properties.provider_id).toEqual({ type: ['string', 'null'] });
      });

      it('should have tier_config_id property as nullable string', () => {
        expect(properties.tier_config_id).toEqual({ type: ['string', 'null'] });
      });

      it('should have tier_config_verification_requirement_id property as nullable string', () => {
        expect(properties.tier_config_verification_requirement_id).toEqual({ type: ['string', 'null'] });
      });
    });
  });

  describe('tableName', () => {
    it('should return the correct table name', () => {
      expect(KycVerificationModel.tableName).toBe(`${DatabaseSchema.apiService}.${DatabaseTables.kyc_verifications}`);
    });
  });

  describe('jsonSchema', () => {
    it('should return the kyc verification validation schema', () => {
      expect(KycVerificationModel.jsonSchema).toBe(KycVerificationValidationSchema);
    });
  });

  describe('publicProperty', () => {
    it('should return the default public properties', () => {
      const properties = KycVerificationModel.publicProperty();

      expect(properties).toContain('id');
      expect(properties).toContain('user_id');
      expect(properties).toContain('provider');
      expect(properties).toContain('provider_ref');
      expect(properties).toContain('attempt');
      expect(properties).toContain('status');
      expect(properties).toContain('error_message');
      expect(properties).toContain('submitted_at');
      expect(properties).toContain('tier_config_id');
      expect(properties).toContain('reviewed_at');
      expect(properties).toContain('metadata');
      expect(properties).toContain('provider_status');
      expect(properties).toContain('created_at');
      expect(properties).toContain('updated_at');
      expect(properties).toContain('deleted_at');
    });

    it('should include additional properties when provided', () => {
      const additionalProps: (keyof IKycVerification)[] = ['provider_verification_type'];
      const properties = KycVerificationModel.publicProperty(additionalProps);

      expect(properties).toContain('provider_verification_type');
      expect(properties.length).toBeGreaterThan(KycVerificationModel.publicProperty().length);
    });
  });

  describe('relationMappings', () => {
    it('should have user relation', () => {
      const relations = KycVerificationModel.relationMappings;
      expect(relations.user).toBeDefined();
      expect(relations.user.relation).toBe(BaseModel.BelongsToOneRelation);
      expect(relations.user.join.from).toBe(`${DatabaseSchema.apiService}.${DatabaseTables.kyc_verifications}.user_id`);
      expect(relations.user.join.to).toBe(`${DatabaseSchema.apiService}.${DatabaseTables.users}.id`);
    });

    it('should have tierConfig relation', () => {
      const relations = KycVerificationModel.relationMappings;
      expect(relations.tierConfig).toBeDefined();
      expect(relations.tierConfig.relation).toBe(BaseModel.BelongsToOneRelation);
      expect(relations.tierConfig.join.from).toBe(
        `${DatabaseSchema.apiService}.${DatabaseTables.kyc_verifications}.tier_config_id`,
      );
      expect(relations.tierConfig.join.to).toBe(`${DatabaseSchema.apiService}.${DatabaseTables.tier_configs}.id`);
    });
  });

  describe('modifiers', () => {
    it('should have notDeleted modifier', () => {
      const modifiers = KycVerificationModel.modifiers;
      expect(modifiers.notDeleted).toBeDefined();
      expect(typeof modifiers.notDeleted).toBe('function');
    });
  });

  describe('instance properties', () => {
    let model: KycVerificationModel;

    beforeEach(() => {
      model = new KycVerificationModel();
      model.user_id = 'user-123';
      model.provider = 'sumsub';
      model.provider_ref = 'provider-ref-456';
      model.attempt = 1;
      model.status = KycVerificationEnum.PENDING;
      model.error_message = 'Test error message';
      model.submitted_at = '2025-01-01T00:00:00Z';
      model.reviewed_at = '2025-01-02T00:00:00Z';
      model.metadata = {
        dob: '1990-01-01',
        pic_url: 'https://example.com/pic.jpg',
        created_date: '2025-01-01T00:00:00Z',
        address: '123 Main St',
      };
      model.provider_status = 'pending';
      model.tier_config_id = 'tier-config-123';
      model.tier_config_verification_requirement_id = 'requirement-456';
      model.provider_verification_type = 'identity_verification';
    });

    it('should properly store the instance properties', () => {
      expect(model.user_id).toBe('user-123');
      expect(model.provider).toBe('sumsub');
      expect(model.provider_ref).toBe('provider-ref-456');
      expect(model.attempt).toBe(1);
      expect(model.status).toBe(KycVerificationEnum.PENDING);
      expect(model.error_message).toBe('Test error message');
      expect(model.submitted_at).toBe('2025-01-01T00:00:00Z');
      expect(model.reviewed_at).toBe('2025-01-02T00:00:00Z');
      expect(model.metadata).toEqual({
        dob: '1990-01-01',
        pic_url: 'https://example.com/pic.jpg',
        created_date: '2025-01-01T00:00:00Z',
        address: '123 Main St',
      });
      expect(model.provider_status).toBe('pending');
      expect(model.tier_config_id).toBe('tier-config-123');
      expect(model.tier_config_verification_requirement_id).toBe('requirement-456');
      expect(model.provider_verification_type).toBe('identity_verification');
    });

    it('should allow optional properties to be undefined', () => {
      const minimalModel = new KycVerificationModel();
      minimalModel.user_id = 'user-123';
      minimalModel.provider = 'sumsub';
      minimalModel.provider_ref = 'provider-ref-456';
      minimalModel.attempt = 0;
      minimalModel.status = KycVerificationEnum.NOT_STARTED;
      minimalModel.tier_config_id = 'tier-config-123';
      minimalModel.tier_config_verification_requirement_id = 'requirement-456';

      expect(minimalModel.error_message).toBeUndefined();
      expect(minimalModel.submitted_at).toBeUndefined();
      expect(minimalModel.reviewed_at).toBeUndefined();
      expect(minimalModel.metadata).toBeUndefined();
      expect(minimalModel.provider_status).toBeUndefined();
      expect(minimalModel.provider_verification_type).toBeUndefined();
    });

    it('should inherit from BaseModel', () => {
      expect(model).toBeInstanceOf(BaseModel);
    });
  });
});
