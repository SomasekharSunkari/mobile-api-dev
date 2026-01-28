import { JSONSchema } from 'objection';

export const InAppNotificationValidationSchema: JSONSchema = {
  type: 'object',
  title: 'InAppNotification Validation Schema',
  required: ['user_id', 'type', 'title', 'message'],
  properties: {
    user_id: { type: 'string' },
    type: { type: 'string' },
    title: { type: 'string' },
    message: { type: 'string' },
    is_read: { type: 'boolean', default: false },
    metadata: { type: 'object' },
  },
};
