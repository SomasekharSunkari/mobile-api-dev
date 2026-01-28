import { JSONSchema } from 'objection';

export const CountryValidationSchema: JSONSchema = {
  type: 'object',
  title: 'Country Validation Schema',
  required: ['name', 'code', 'phone_code', 'currency_code', 'currency_denominator_code'],
  properties: {
    name: { type: 'string' },
    code: { type: 'string' },
    is_supported: { type: 'boolean' },
    currency_code: { type: 'string' },
    currency_denominator_code: { type: 'string' },
  },
};
