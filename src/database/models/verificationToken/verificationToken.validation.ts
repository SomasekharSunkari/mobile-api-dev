import { JSONSchema } from 'objection';

export const VerificationTokenValidationSchema: JSONSchema = {
  type: 'object',
  title: 'Verification Token Validation Schema',
  required: ['user_id', 'token_identifier', 'verification_type', 'expires_at'],
  properties: {
    user_id: { type: 'string' },
    token_identifier: { type: 'string' },
    verification_type: { type: 'string' },
    is_used: { type: 'boolean', default: false },
    used_at: { type: ['string', 'null'] },
  },
};
