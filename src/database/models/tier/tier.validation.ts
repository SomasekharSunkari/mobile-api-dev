import { JSONSchema } from 'objection';

export const TierValidationSchema: JSONSchema = {
  type: 'object',
  required: ['name', 'level', 'description', 'status'],
  properties: {
    name: { type: 'string' },
    level: { type: 'number' },
    description: { type: 'string' },
    status: { type: 'enum', enum: ['active', 'inactive'] },
  },
};
