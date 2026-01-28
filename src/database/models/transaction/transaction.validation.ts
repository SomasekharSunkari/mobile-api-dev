import { JSONSchema } from 'objection';
import { TransactionCategory, TransactionStatus, TransactionType, TransactionScope } from './transaction.interface';

export const TransactionValidationSchema: JSONSchema = {
  type: 'object',
  title: 'Transaction Validation Schema',
  required: [
    'reference',
    'asset',
    'amount',
    'balance_before',
    'balance_after',
    'transaction_type',
    'status',
    'category',
    'transaction_scope',
    'user_id',
  ],
  properties: {
    user_id: { type: ['string', 'null'] },
    parent_transaction_id: { type: ['string', 'null'] },
    reference: { type: 'string' },
    external_reference: { type: ['string', 'null'] },
    asset: { type: 'string' },
    amount: { type: 'number' },
    balance_before: { type: 'number' },
    balance_after: { type: 'number' },
    transaction_type: {
      type: 'string',
      enum: Object.values(TransactionType),
    },
    status: {
      type: 'string',
      enum: Object.values(TransactionStatus),
      default: TransactionStatus.PENDING,
    },
    category: {
      type: 'string',
      enum: Object.values(TransactionCategory),
    },
    transaction_scope: {
      type: 'string',
      enum: Object.values(TransactionScope),
    },
    metadata: { type: ['object', 'null'] },
    description: { type: ['string', 'null'] },
    ip_address: { type: ['string', 'null'] },
    user_agent: { type: ['string', 'null'] },
    completed_at: { type: ['string', 'null'] },
    failed_at: { type: ['string', 'null'] },
    processed_at: { type: 'string' },
    failure_reason: { type: ['string', 'null'] },
  },
};
