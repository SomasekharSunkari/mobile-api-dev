import { JSONSchema } from 'objection';

export const AccountActionCodeValidation: JSONSchema = {
  type: 'object',
  title: 'AccountActionCode Schema Validation',
  required: ['user_id', 'code', 'email', 'expires_at', 'type'],
  properties: {
    user_id: { type: 'string' },
    code: { type: 'string', minLength: 6 },
    email: { type: 'string', format: 'email' },
    type: { type: 'string' },
    expires_at: { type: 'string' },
    is_used: { type: 'boolean', default: false },
    used_at: { type: 'string' },
  },
};
