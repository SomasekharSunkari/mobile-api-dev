import { JSONSchema } from 'objection';

export const LoginEventValidationSchema: JSONSchema = {
  type: 'object',
  title: 'Login Event Validation Schema',
  required: ['user_id'],
  properties: {
    user_id: { type: 'string' },
    device_id: { type: 'string' },
    ip_address: { type: 'string' },
    login_time: {
      type: ['string', 'object'],
      format: 'date-time',
      description: 'The timestamp of the login event (ISO 8601 string or Date object)',
    },

    city: { type: 'string' },
    region: { type: 'string' },
    country: { type: 'string' },
    is_vpn: { type: 'boolean' },
    risk_score: {
      type: 'number',
      minimum: 0,
      maximum: 100,
      description: 'Risk score based on login security analysis',
    },

    created_at: {
      type: ['string', 'object'],
      format: 'date-time',
    },
    updated_at: {
      type: ['string', 'object'],
      format: 'date-time',
    },
  },
};
