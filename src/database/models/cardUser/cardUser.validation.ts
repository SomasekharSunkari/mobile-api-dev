import { JSONSchema } from 'objection';

export const CardUserValidationSchema: JSONSchema = {
  type: 'object',
  title: 'Card User Validation Schema',
  required: ['user_id', 'country_id'],
  properties: {
    user_id: { type: 'string' },
    provider_ref: { type: ['string', 'null'] },
    provider_status: { type: ['string', 'null'] },
    status: {
      type: 'string',
      enum: ['pending', 'approved', 'rejected', 'active', 'inactive', 'suspended'],
      default: 'pending',
    },
    provider_application_status_reason: { type: ['string', 'null'] },
    provider_application_completion_url: { type: ['string', 'null'] },
    country_id: { type: 'string' },
    salary: { type: ['number', 'null'], minimum: 0 },
    ip_address: { type: ['string', 'null'] },
    occupation: { type: ['string', 'null'] },
    usage_reason: { type: ['string', 'null'] },
    monthly_spend: { type: ['number', 'null'], minimum: 0 },
    wallet_address: { type: ['string', 'null'] },
    address_network_name: { type: ['string', 'null'] },
    balance: { type: ['number', 'null'] },
  },
};
