import { JSONSchema } from 'objection';
import { BlockchainWalletStatus, BlockchainWalletProvider, BlockchainWalletRails } from './blockchain_wallet.interface';

export const BlockchainWalletValidationSchema: JSONSchema = {
  type: 'object',
  title: 'Blockchain Wallet Validation Schema',
  required: [
    'user_id',
    'provider_account_ref',
    'provider',
    'asset',
    'base_asset',
    'address',
    'status',
    'balance',
    'is_visible',
  ],
  properties: {
    user_id: { type: 'string' },
    provider_account_ref: { type: 'string' },
    balance: { type: 'string', pattern: '^-?\\d+(\\.\\d+)?$' },

    provider: {
      type: 'string',
      enum: Object.values(BlockchainWalletProvider),
    },
    asset: { type: 'string' },
    base_asset: { type: 'string' },
    address: { type: 'string' },
    status: {
      type: 'string',
      enum: Object.values(BlockchainWalletStatus),
    },
    name: { type: 'string', minLength: 1 },
    network: { type: ['string', 'null'] },
    rails: {
      type: ['string', 'null'],
      enum: Object.values(BlockchainWalletRails),
    },
    decimal: { type: ['number', 'null'] },
    is_visible: { type: 'boolean' },
  },
};
