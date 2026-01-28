import { JSONSchema } from 'objection';

export const SystemUsersBeneficiaryValidationSchema: JSONSchema = {
  type: 'object',
  title: 'System Users Beneficiary Validation Schema',
  required: ['sender_user_id', 'beneficiary_user_id'],
  properties: {
    sender_user_id: { type: 'string' },
    beneficiary_user_id: { type: 'string' },
    alias_name: { type: ['string', 'null'] },
    avatar_url: { type: ['string', 'null'] },
  },
};
