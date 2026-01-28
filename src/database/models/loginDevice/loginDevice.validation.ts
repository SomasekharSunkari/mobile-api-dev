import { JSONSchema } from 'objection';

export const LoginDeviceValidationSchema: JSONSchema = {
  type: 'object',
  title: 'Login Device Validation Schema',
  required: ['user_id', 'device_fingerprint'],
  properties: {
    user_id: { type: 'string' },
    device_fingerprint: { type: 'string' },
    is_trusted: { type: 'boolean' },
    last_verified_at: {
      type: ['string', 'object'],
      format: 'date-time',
      description: 'The timestamp when device was last verified (ISO 8601 string or Date object)',
    },
    last_login: {
      type: ['string', 'object'],
      format: 'date-time',
      description: 'The timestamp of the last login (ISO 8601 string or Date object)',
    },

    created_at: {
      type: ['string', 'object'],
      format: 'date-time',
      description: 'Record creation timestamp',
    },
    updated_at: {
      type: ['string', 'object'],
      format: 'date-time',
      description: 'Record update timestamp',
    },
  },
};
