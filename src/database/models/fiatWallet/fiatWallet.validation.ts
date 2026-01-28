import { JSONSchema } from 'objection';
import { FiatWalletStatus } from './fiatWallet.interface';

export const FiatWalletValidationSchema: JSONSchema = {
  type: 'object',
  title: 'Fiat Wallet Validation Schema',
  required: ['user_id', 'balance', 'credit_balance', 'asset', 'status'],
  properties: {
    user_id: { type: 'string' },
    balance: { type: 'number', minimum: 0 },
    credit_balance: { type: 'number', minimum: 0 },
    asset: { type: 'string' },
    status: {
      type: 'string',
      enum: Object.values(FiatWalletStatus),
    },
  },
};
