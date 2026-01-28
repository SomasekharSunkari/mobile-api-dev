import { JSONSchema } from 'objection';

export const UserRoleValidation: JSONSchema = {
  type: 'object',
  title: 'UserRole Schema Validation',
  required: ['role_id', 'user_id'],
  properties: {
    role_id: { type: 'string' },
    user_id: { type: 'string' },
  },
};
