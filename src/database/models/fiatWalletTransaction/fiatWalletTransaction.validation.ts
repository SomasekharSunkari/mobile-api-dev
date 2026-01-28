import { JSONSchema } from 'objection';
import { TransactionStatus } from '../transaction';
import { FiatWalletTransactionType } from './fiatWalletTransaction.interface';

export const FiatWalletTransactionValidationSchema: JSONSchema = {
  type: 'object',
  title: 'Fiat Wallet Transaction Validation Schema',
  required: [
    'transaction_id',
    'fiat_wallet_id',
    'user_id',
    'transaction_type',
    'amount',
    'balance_before',
    'balance_after',
    'currency',
    'status',
  ],
  properties: {
    transaction_id: { type: 'string' },
    fiat_wallet_id: { type: 'string' },
    user_id: { type: 'string' },
    transaction_type: {
      type: 'string',
      enum: Object.values(FiatWalletTransactionType),
    },
    amount: { type: 'number' },
    balance_before: { type: 'number' },
    balance_after: { type: 'number' },
    currency: { type: 'string' },
    status: {
      type: 'string',
      enum: Object.values(TransactionStatus),
      default: TransactionStatus.PENDING,
    },

    // Provider details
    provider: { type: ['string', 'null'] },
    provider_reference: { type: ['string', 'null'] },
    provider_quote_ref: { type: ['string', 'null'] },
    provider_request_ref: { type: ['string', 'null'] },
    provider_fee: { type: ['number', 'null'] },
    provider_metadata: { type: ['object', 'null'] },

    // Source/destination
    source: { type: ['string', 'null'] },
    destination: { type: ['string', 'null'] },

    // External account reference
    external_account_id: { type: ['string', 'null'] },

    // Additional info
    description: { type: ['string', 'null'] },
    failure_reason: { type: ['string', 'null'] },

    // Idempotency
    idempotency_key: { type: ['string', 'null'], maxLength: 40 },

    // Timestamps
    processed_at: { type: ['string', 'null'] },
    completed_at: { type: ['string', 'null'] },
    failed_at: { type: ['string', 'null'] },
    settled_at: { type: ['string', 'null'] },
  },
};
