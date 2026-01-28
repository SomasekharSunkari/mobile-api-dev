import { JSONSchema } from 'objection';

export const SystemConfigValidationSchema: JSONSchema = {
  type: 'object',
  title: 'System Config Validation Schema',
  required: ['key', 'type', 'is_enabled'],
  properties: {
    key: { type: 'string' },
    type: { type: 'string' },
    is_enabled: { type: 'boolean' },
    description: { type: ['string', 'null'] },
    value: { type: ['string', 'null'] },
  },
};
