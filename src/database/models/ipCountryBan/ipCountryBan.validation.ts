import { JSONSchema } from 'objection';

export const IpCountryBanValidation: JSONSchema = {
  type: 'object',
  required: ['type', 'value'],
  properties: {
    id: { type: 'string' },
    type: { type: 'string' },
    value: { type: 'string' },
    reason: { type: ['string', 'null'] },
    created_at: { type: 'string' },
    updated_at: { type: 'string' },
    deleted_at: { type: ['string', 'null'] },
  },
};
