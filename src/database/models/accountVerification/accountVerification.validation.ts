import { JSONSchema } from 'objection';

export const AccountVerificationValidation: JSONSchema = {
  type: 'object',
  title: 'AccountVerification Schema Validation',
  required: ['code', 'email', 'expiration_time'],
  properties: {
    code: { type: 'string' },
    user_id: { type: 'string' },
    email: { type: 'string' },
    is_used: { type: 'boolean' },
    expiration_time: { type: 'string' },
  },
};
