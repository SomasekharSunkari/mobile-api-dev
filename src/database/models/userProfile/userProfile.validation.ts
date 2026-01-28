import { JSONSchema } from 'objection';

export const UserProfileValidationSchema: JSONSchema = {
  type: 'object',
  title: 'User Profile Validation Schema',
  required: ['user_id'],
  properties: {
    user_id: { type: 'string' },

    dob: { type: 'string' },
    gender: { type: 'string' },

    address_line1: { type: 'string' },
    address_line2: { type: 'string' },
    city: { type: 'string' },
    state_or_province: { type: 'string' },
    postal_code: { type: 'string' },
    notification_token: { type: 'string' },
    avatar_url: { type: 'string' },
    image_key: { type: 'string' },

    country_id: { type: 'string' },
  },
};
