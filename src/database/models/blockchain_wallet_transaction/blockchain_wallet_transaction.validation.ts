import { JSONSchema } from 'objection';
import { TransactionStatus, TransactionScope } from '../transaction';
import { BlockchainWalletTransactionType } from './blockchain_wallet_transaction.interface';

export const BlockchainWalletTransactionValidationSchema: JSONSchema = {
  type: 'object',
  title: 'Blockchain Wallet Transaction Validation Schema',
  required: [
    'blockchain_wallet_id',
    'asset',
    'amount',
    'balance_before',
    'balance_after',
    'transaction_type',
    'status',
    'transaction_scope',
    'type',
  ],
  properties: {
    blockchain_wallet_id: { type: 'string' },
    asset: { type: 'string' },
    amount: { type: 'string' },
    balance_before: { type: 'string' },
    balance_after: { type: 'string' },
    transaction_type: {
      type: 'string',
      enum: Object.values(BlockchainWalletTransactionType),
    },
    status: {
      type: 'string',
      enum: Object.values(TransactionStatus),
      default: TransactionStatus.PENDING,
    },
    transaction_scope: {
      type: 'string',
      enum: Object.values(TransactionScope),
      default: TransactionScope.INTERNAL,
    },
    type: { type: 'string', enum: ['debit', 'credit'] },

    // Optional fields
    provider_reference: { type: ['string', 'null'] },
    metadata: { type: ['object', 'null'] },
    description: { type: ['string', 'null'] },
    tx_hash: { type: ['string', 'null'] },
    failure_reason: { type: ['string', 'null'] },
    main_transaction_id: { type: ['string', 'null'] },
    peer_wallet_id: { type: ['string', 'null'] },
    peer_wallet_address: { type: ['string', 'null'] },
    intiated_by: { type: ['string', 'null'] },
    signed_by: { type: ['string', 'null'] },
    network_fee: { type: ['string', 'null'] },
    parent_id: { type: ['string', 'null'] },
    idempotency_key: { type: ['string', 'null'] },
  },
};
