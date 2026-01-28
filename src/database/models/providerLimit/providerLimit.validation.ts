export const ProviderLimitValidationSchema = {
  type: 'object',
  required: ['provider', 'limit_type', 'limit_value', 'currency', 'is_active'],
  properties: {
    provider: { type: 'string' },
    limit_type: { type: 'string' },
    limit_value: { type: 'number' },
    currency: { type: 'string' },
    is_active: { type: 'boolean' },
    description: { type: ['string', 'null'] },
  },
};
