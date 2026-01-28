import { JSONSchema } from 'objection';

export const AccountDeleteRequestValidation: JSONSchema = {
  type: 'object',
  title: 'AccountDeleteRequest Schema Validation',
  required: ['reasons', 'user_id', 'deleted_on'],
  properties: {
    user_id: { type: 'string' },
    reasons: { type: 'array', items: { type: 'string' } },
    deleted_on: { type: 'string' },
  },
};
