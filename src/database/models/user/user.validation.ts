import { JSONSchema } from 'objection';

export const UserValidationSchema: JSONSchema = {
  type: 'object',
  title: 'User Validation Schema',
  required: ['username', 'password'],
  properties: {
    username: { type: 'string' },
    first_name: { type: 'string' },
    middle_name: { type: 'string' },
    last_name: { type: 'string' },
    email: { type: 'string', format: 'email' },
    password: { type: 'string' },
    is_email_verified: { type: 'boolean', default: false },

    phone_number: { type: ['string', 'null'] },
    phone_number_country_code: { type: ['string', 'null'] },
    is_phone_verified: { type: 'boolean', default: false },
    status: {
      type: 'string',
      enum: ['active', 'inactive', 'blocked', 'pending_deactivation', 'pending_account_deletion', 'deleted'],
    },
    is_deactivated: { type: 'boolean', default: false },
    require_password_reset: { type: 'boolean', default: false },
    require_transaction_pin_reset: { type: 'boolean', default: false },
    disable_login_restrictions: { type: 'boolean', default: false },
  },
};
