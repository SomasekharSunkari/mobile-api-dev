import { JSONSchema } from 'objection';
import { DoshPointsTransactionType } from '../doshPointsEvent/doshPointsEvent.interface';
import { DoshPointsTransactionStatus } from './doshPointsTransaction.interface';

export const DoshPointsTransactionValidationSchema: JSONSchema = {
  type: 'object',
  title: 'Dosh Points Transaction Validation Schema',
  required: [
    'dosh_points_account_id',
    'user_id',
    'event_code',
    'transaction_type',
    'amount',
    'balance_before',
    'balance_after',
    'status',
  ],
  properties: {
    dosh_points_account_id: { type: 'string' },
    user_id: { type: 'string' },
    event_code: { type: 'string' },
    transaction_type: {
      type: 'string',
      enum: Object.values(DoshPointsTransactionType),
    },
    amount: { type: 'integer', minimum: 0 },
    balance_before: { type: 'integer', minimum: 0 },
    balance_after: { type: 'integer', minimum: 0 },
    source_reference: { type: ['string', 'null'] },
    description: { type: ['string', 'null'] },
    metadata: { type: ['object', 'null'] },
    status: {
      type: 'string',
      enum: Object.values(DoshPointsTransactionStatus),
    },
    idempotency_key: { type: ['string', 'null'] },
    processed_at: { type: ['string', 'null'], format: 'date-time' },
  },
};
