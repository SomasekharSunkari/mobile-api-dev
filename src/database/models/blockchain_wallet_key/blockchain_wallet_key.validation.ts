import { JSONSchema } from 'objection';

export const BlockchainWalletKeyValidationSchema: JSONSchema = {
  type: 'object',
  title: 'Blockchain Wallet Key Validation Schema',
  required: ['blockchain_wallet_id', 'encrypted_private_key', 'encryption_iv', 'network', 'key_index'],
  properties: {
    blockchain_wallet_id: { type: 'string' },
    encrypted_private_key: { type: 'string' },
    encryption_iv: { type: 'string' },
    network: { type: 'string' },
    public_key: { type: ['string', 'null'] },
    key_index: { type: 'number', minimum: 0 },
  },
};
