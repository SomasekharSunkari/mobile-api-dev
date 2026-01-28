import { JSONSchema } from 'objection';

export const ResetTransactionPinValidationSchema: JSONSchema = {
  type: 'object',
  required: ['code', 'user_id', 'expiration_time'],
  properties: {
    code: { type: 'string' },
    user_id: { type: 'string' },
    is_used: { type: 'boolean' },
    expiration_time: { type: 'string' },
  },
};
