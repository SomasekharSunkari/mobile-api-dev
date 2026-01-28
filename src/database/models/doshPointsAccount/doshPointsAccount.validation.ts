import { JSONSchema } from 'objection';
import { DoshPointsAccountStatus } from './doshPointsAccount.interface';

export const DoshPointsAccountValidationSchema: JSONSchema = {
  type: 'object',
  title: 'Dosh Points Account Validation Schema',
  required: ['user_id', 'balance', 'status'],
  properties: {
    user_id: { type: 'string' },
    balance: { type: 'integer', minimum: 0 },
    status: {
      type: 'string',
      enum: Object.values(DoshPointsAccountStatus),
    },
    usd_fiat_rewards_enabled: { type: ['boolean', 'null'] },
  },
};
