import { JSONSchema } from 'objection';

export const PlatformStatusLogValidationSchema: JSONSchema = {
  type: 'object',
  required: ['platform_status_id', 'new_status', 'triggered_by'],
  properties: {
    id: { type: 'string' },
    platform_status_id: { type: 'string' },
    previous_status: {
      type: ['string', 'null'],
      enum: ['operational', 'degraded', 'down', null],
    },
    new_status: {
      type: 'string',
      enum: ['operational', 'degraded', 'down'],
    },
    reason: { type: ['string', 'null'] },
    triggered_by: {
      type: 'string',
      enum: ['system', 'admin'],
    },
    admin_user_id: { type: ['string', 'null'] },
    created_at: { type: 'string', format: 'date-time' },
    updated_at: { type: 'string', format: 'date-time' },
  },
};
