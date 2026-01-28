import { JSONSchema } from 'objection';

export const UserTierValidationSchema: JSONSchema = {
  type: 'object',
  required: ['tier_id', 'user_id'],
  properties: {
    id: { type: 'string' },
    tier_id: { type: 'string' },
    user_id: { type: 'string' },
  },
};
