import { JSONSchema } from 'objection';

export const PagaLedgerTransactionValidationSchema: JSONSchema = {
  type: 'object',
  required: [
    'account_number',
    'amount',
    'status',
    'reference_number',
    'transaction_reference',
    'balance_before',
    'balance_after',
    'transaction_type',
    'currency',
  ],
  properties: {
    account_number: { type: 'string' },
    date_utc: { type: 'number' },
    description: { type: ['string', 'null'] },
    amount: { type: 'number' },
    status: { type: 'string' },
    reference_number: { type: 'string' },
    transaction_reference: { type: 'string' },
    balance_before: { type: 'number' },
    balance_after: { type: 'number' },
    transaction_type: { type: 'string' },
    currency: { type: 'string' },
    tax: { type: 'number' },
    fee: { type: 'number' },
    transaction_channel: { type: 'string' },
    reversal_id: { type: ['string', 'null'] },
  },
};
