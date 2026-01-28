import { JSONSchema } from 'objection';
import { VirtualAccountType } from './virtualAccount.interface';

export const VirtualAccountValidationSchema: JSONSchema = {
  type: 'object',
  required: ['user_id', 'account_name', 'account_number', 'bank_name', 'type'],
  properties: {
    user_id: { type: 'string' },
    account_name: { type: 'string' },
    account_number: { type: 'string' },
    bank_name: { type: 'string' },
    bank_ref: { type: 'string' },
    routing_number: { type: 'string' },
    iban: { type: 'string' },
    provider: { type: 'string' },
    provider_ref: { type: 'string' },
    address: { type: ['string', 'null'] },
    state: { type: ['string', 'null'] },
    city: { type: ['string', 'null'] },
    postal_code: { type: ['string', 'null'] },
    provider_balance: { type: 'number' },
    fiat_wallet_id: { type: ['string', 'null'] },
    type: { type: ['string', 'null'], enum: Object.values(VirtualAccountType) },
    transaction_id: { type: ['string', 'null'] },
  },
};
