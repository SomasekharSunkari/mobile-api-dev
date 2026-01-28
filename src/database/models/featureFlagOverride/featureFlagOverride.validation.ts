import { JSONSchema } from 'objection';

export const FeatureFlagOverrideValidationSchema: JSONSchema = {
  type: 'object',
  title: 'Feature Flag Override Validation Schema',
  required: ['feature_flag_id', 'user_id', 'enabled'],
  properties: {
    feature_flag_id: { type: 'string' },
    user_id: { type: 'string' },
    enabled: { type: 'boolean' },
    reason: { type: ['string', 'null'] },
  },
};
