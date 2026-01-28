import { JSONSchema } from 'objection';
import { TransactionStatus } from '../transaction';

export const BlockchainGasFundTransactionValidationSchema: JSONSchema = {
  type: 'object',
  title: 'Blockchain Gas Fund Transaction Validation Schema',
  required: ['user_id', 'blockchain_wallet_id', 'native_asset_id', 'amount', 'status'],
  properties: {
    user_id: { type: 'string' },
    blockchain_wallet_id: { type: 'string' },
    native_asset_id: { type: 'string' },
    amount: { type: 'string' },
    status: {
      type: 'string',
      enum: Object.values(TransactionStatus),
      default: TransactionStatus.PENDING,
    },

    // Optional fields
    provider_reference: { type: ['string', 'null'] },
    tx_hash: { type: ['string', 'null'] },
    failure_reason: { type: ['string', 'null'] },
    network_fee: { type: ['string', 'null'] },
    idempotency_key: { type: ['string', 'null'] },
    metadata: { type: ['object', 'null'] },
  },
};
