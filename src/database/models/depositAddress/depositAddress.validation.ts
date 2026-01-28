import { JSONSchema } from 'objection';

export const DepositAddressValidationSchema: JSONSchema = {
  type: 'object',
  title: 'Deposit Address Validation Schema',
  required: ['user_id', 'provider', 'asset', 'address'],
  properties: {
    user_id: { type: 'string' },
    provider: { type: 'string' },
    asset: { type: 'string' },
    address: { type: 'string' },
  },
};
