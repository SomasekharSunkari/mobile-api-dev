import { JSONSchema } from 'objection';
import { BLOCKCHAIN_ACCOUNT_RAIL } from '../../../constants/blockchainAccountRails';
import { BlockchainAccountProvider, BlockchainAccountStatus } from './blockchain_account.interface';

export const BlockchainAccountValidationSchema: JSONSchema = {
  type: 'object',
  title: 'Blockchain Account Validation Schema',
  required: ['user_id', 'provider', 'provider_ref', 'status', 'rails', 'is_visible'],
  properties: {
    user_id: { type: 'string' },
    provider: {
      type: 'string',
      enum: Object.values(BlockchainAccountProvider),
    },
    provider_ref: { type: 'string' },
    status: {
      type: 'string',
      enum: Object.values(BlockchainAccountStatus),
    },
    rails: {
      type: 'string',
      enum: Object.values(BLOCKCHAIN_ACCOUNT_RAIL),
    },
    is_visible: { type: 'boolean' },
  },
};
