import type { JSONSchema } from 'objection';

export const CardTransactionValidationSchema: JSONSchema = {
  type: 'object',
  title: 'Card Transaction Validation Schema',
  required: ['user_id', 'card_user_id', 'amount', 'currency', 'merchant_name', 'status', 'transaction_type', 'type'],
  properties: {
    user_id: { type: 'string' },
    card_user_id: { type: 'string' },
    card_id: { type: ['string', 'null'] },

    amount: { type: 'number' },
    provider_reference: { type: ['string', 'null'] },
    currency: { type: 'string' },
    transactionhash: { type: ['string', 'null'] },
    authorized_amount: { type: ['number', 'null'] },
    authorization_method: { type: ['string', 'null'] },
    merchant_name: { type: 'string' },
    merchant_id: { type: ['string', 'null'] },
    merchant_city: { type: ['string', 'null'] },
    merchant_country: { type: ['string', 'null'] },
    merchant_category: { type: ['string', 'null'] },
    merchant_category_code: { type: ['string', 'null'] },
    status: { type: 'string', enum: ['pending', 'declined', 'successful'], default: 'pending' },
    declined_reason: { type: ['string', 'null'] },
    authorized_at: { type: ['string', 'null'], format: 'date-time' },

    balance_before: { type: ['number', 'null'] },
    balance_after: { type: ['number', 'null'] },
    transaction_type: { type: 'string', enum: ['reversal', 'spend', 'refund', 'deposit', 'fee', 'transfer'] },
    type: { type: 'string', enum: ['credit', 'debit'] },
    description: { type: ['string', 'null'] },
    fee: { type: ['number', 'null'] },
    provider_fee_reference: { type: ['string', 'null'] },
    is_fee_settled: { type: ['boolean', 'null'] },
    parent_exchange_transaction_id: { type: ['string', 'null'] },
  },
};
