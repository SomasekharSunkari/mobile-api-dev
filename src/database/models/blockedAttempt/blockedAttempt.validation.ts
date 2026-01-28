import { JSONSchema } from 'objection';

export const BlockedAttemptValidationSchema: JSONSchema = {
  type: 'object',
  required: ['ip_address', 'reason', 'path'],
  properties: {
    ip_address: { type: 'string' },
    country_code: { type: 'string' },
    reason: { type: 'string' },
    path: { type: 'string' },
  },
};
