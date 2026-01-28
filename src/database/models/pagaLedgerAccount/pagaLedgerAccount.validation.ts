import { JSONSchema } from 'objection';

export const PagaLedgerAccountValidationSchema: JSONSchema = {
  type: 'object',
  required: ['email', 'account_number', 'account_name'],
  properties: {
    email: { type: 'string', format: 'email' },
    phone_number: { type: ['string', 'null'] },
    account_number: { type: 'string' },
    account_name: { type: 'string' },
    available_balance: { type: 'number' },
  },
};
