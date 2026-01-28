import { JSONSchema } from 'objection';

export const ExternalAccountValidationSchema: JSONSchema = {
  type: 'object',
  title: 'External Account Validation Schema',
  required: ['user_id', 'provider'],
  properties: {
    user_id: { type: 'string' },
    fiat_wallet_id: { type: ['string', 'null'] },
    external_account_ref: { type: ['string', 'null'] },
    provider_kyc_status: { type: 'string' },
    status: { type: 'string' },
    participant_code: { type: ['string', 'null'] },
    provider: { type: 'string' },

    linked_provider: { type: ['string', 'null'] },

    linked_item_ref: { type: ['string', 'null'] },
    linked_account_ref: { type: ['string', 'null'] },
    linked_access_token: { type: ['string', 'null'] },
    linked_processor_token: { type: ['string', 'null'] },

    bank_ref: { type: ['string', 'null'] },
    bank_name: { type: ['string', 'null'] },
    account_number: { type: ['string', 'null'] },
    routing_number: { type: ['string', 'null'] },
    nuban: { type: ['string', 'null'] },
    swift_code: { type: ['string', 'null'] },

    expiration_date: { type: ['string', 'null'], format: 'date-time' },
    capabilities: {
      type: ['array', 'null'],
      items: { type: 'string' },
    },

    account_name: { type: ['string', 'null'] },
    account_type: { type: ['string', 'null'] },
  },
};
