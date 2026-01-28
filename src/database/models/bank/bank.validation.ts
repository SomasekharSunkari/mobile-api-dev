import { JSONSchema } from 'objection';

export const BankValidationSchema: JSONSchema = {
  type: 'object',
  required: ['name', 'code', 'country_id'],
  properties: {
    name: { type: 'string' },
    code: { type: 'string' },
    country_id: { type: 'string' },
    logo: { type: ['string', 'null'] },
    status: { type: ['string', 'null'] },
    short_name: { type: ['string', 'null'] },
  },
};
