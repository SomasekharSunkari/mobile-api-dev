import { JSONSchema } from 'objection';

export const PermissionValidation: JSONSchema = {
  type: 'object',
  title: 'Permission Schema Validation',
  required: ['name', 'slug'],
  properties: {
    name: { type: 'string' },
    desc: { type: 'string' },
    slug: { type: 'string' },
  },
};
