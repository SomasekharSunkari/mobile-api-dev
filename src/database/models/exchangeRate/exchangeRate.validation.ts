import { JSONSchema } from 'objection';

export const ExchangeRateValidationSchema: JSONSchema = {
  type: 'object',
  title: 'Exchange Rate Validation Schema',
  required: ['provider', 'buying_currency_code', 'selling_currency_code', 'rate', 'provider_rate_ref', 'provider_rate'],
  properties: {
    provider: { type: 'string' },
    buying_currency_code: { type: 'string' },
    selling_currency_code: { type: 'string' },
    rate: { type: 'number' },
    provider_rate_ref: { type: 'string' },
    expires_at: { type: ['string', 'null'], format: 'date-time' },
    provider_rate: { type: ['number', 'null'] },
  },
};
