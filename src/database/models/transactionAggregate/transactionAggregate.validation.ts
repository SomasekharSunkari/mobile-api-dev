import { JSONSchema } from 'objection';

export const TransactionAggregateValidationSchema: JSONSchema = {
  type: 'object',
  title: 'Transaction Aggregate Validation Schema',
  required: ['date', 'transaction_type', 'provider', 'amount'],
  properties: {
    date: { type: 'string', format: 'date' },
    transaction_type: { type: 'string' },
    provider: { type: 'string' },
    amount: { type: 'number' },
  },
};
