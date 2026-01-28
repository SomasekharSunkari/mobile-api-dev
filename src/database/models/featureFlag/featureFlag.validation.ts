import { JSONSchema } from 'objection';

export const FeatureFlagValidationSchema: JSONSchema = {
  type: 'object',
  title: 'Feature Flag Validation Schema',
  required: ['key'],
  properties: {
    key: { type: 'string', minLength: 1, maxLength: 255 },
    description: { type: ['string', 'null'] },
    enabled: { type: 'boolean', default: false },
    enabled_ios: { type: 'boolean', default: true },
    enabled_android: { type: 'boolean', default: true },
    expires_at: { type: ['string', 'null'], format: 'date-time' },
  },
};
