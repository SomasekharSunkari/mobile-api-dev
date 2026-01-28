import { JSONSchema } from 'objection';

export const PlatformStatusValidationSchema: JSONSchema = {
  type: 'object',
  required: ['service_key', 'service_name', 'status'],
  properties: {
    id: { type: 'string' },
    service_key: { type: 'string', minLength: 1, maxLength: 100 },
    service_name: { type: 'string', minLength: 1, maxLength: 255 },
    status: {
      type: 'string',
      enum: ['operational', 'degraded', 'down'],
    },
    last_checked_at: { type: ['string', 'null'], format: 'date-time' },
    last_failure_at: { type: ['string', 'null'], format: 'date-time' },
    failure_reason: { type: ['string', 'null'] },
    is_manually_set: { type: 'boolean' },
    custom_message: { type: ['string', 'null'] },
    created_at: { type: 'string', format: 'date-time' },
    updated_at: { type: 'string', format: 'date-time' },
    deleted_at: { type: ['string', 'null'], format: 'date-time' },
  },
};
