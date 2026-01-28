import { JSONSchema } from 'objection';
import { RateTransactionStatus, RateTransactionType } from './rateTransaction.interface';

export const RateTransactionValidationSchema: JSONSchema = {
  type: 'object',
  title: 'RateTransaction Validation Schema',
  required: [
    'user_id',
    'transaction_id',
    'rate',
    'converted_currency',
    'base_currency',
    'amount',
    'converted_amount',
    'status',
    'type',
    'provider',
  ],
  properties: {
    user_id: { type: 'string' },
    transaction_id: { type: 'string' },
    rate: { type: 'number' },
    converted_currency: { type: 'string' },
    base_currency: { type: 'string' },
    amount: { type: 'number' },
    converted_amount: { type: 'number' },
    expires_at: { type: ['string', 'null'] },
    processed_at: { type: ['string', 'null'] },
    failed_at: { type: ['string', 'null'] },
    completed_at: { type: ['string', 'null'] },
    failure_reason: { type: ['string', 'null'] },
    status: {
      type: 'string',
      enum: Object.values(RateTransactionStatus),
      default: RateTransactionStatus.PENDING,
    },
    type: {
      type: 'string',
      enum: Object.values(RateTransactionType),
    },
    provider: { type: 'string' },
  },
};
