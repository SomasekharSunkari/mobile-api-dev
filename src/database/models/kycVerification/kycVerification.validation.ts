import { JSONSchema } from 'objection';

export const KycVerificationValidationSchema: JSONSchema = {
  type: 'object',
  title: 'KYC Verification Validation Schema',
  required: ['user_id', 'status'],
  properties: {
    user_id: { type: 'string' },
    provider_ref: { type: 'string' },
    attempt: { type: 'integer', default: 0 },
    status: { type: 'string' },
    error_message: { type: ['string', 'null'] },
    submitted_at: { type: ['string', 'null'], format: 'date-time' },
    reviewed_at: { type: ['string', 'null'], format: 'date-time' },
    provider_verification_type: { type: ['string', 'null'] },
    metadata: {
      type: ['object', 'null'],
      properties: {
        dob: { type: ['string', 'null'], format: 'date' },
        pic_url: { type: ['string', 'null'] },
        created_date: { type: ['string', 'null'], format: 'date-time' },
        address: { type: ['string', 'null'] },
      },
    },
    provider_status: { type: ['string', 'null'] },
    provider_id: { type: ['string', 'null'] },
    tier_config_id: { type: ['string', 'null'] },
    tier_config_verification_requirement_id: { type: ['string', 'null'] },
  },
};
