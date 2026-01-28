import { JSONSchema } from 'objection';

export const TierConfigVerificationRequirementValidationSchema: JSONSchema = {
  type: 'object',
  title: 'Tier Config Verification Requirement Validation Schema',
  required: ['tier_config_id', 'verification_requirement_id'],
  properties: {
    tier_config_id: { type: 'string' },
    verification_requirement_id: { type: 'string' },
  },
};
