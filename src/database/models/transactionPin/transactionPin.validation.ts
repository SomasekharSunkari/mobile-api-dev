import { JSONSchema } from 'objection';

export const TransactionPinValidationSchema: JSONSchema = {
  type: 'object',
  required: ['user_id', 'pin'],
  properties: {
    user_id: { type: 'string' },
    pin: { type: ['string', 'null'] },
  },
};
