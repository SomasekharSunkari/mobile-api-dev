import { JSONSchema } from 'objection';

export const BlockchainBeneficiaryValidationSchema: JSONSchema = {
  type: 'object',
  title: 'Blockchain Beneficiary Validation Schema',
  required: ['user_id', 'beneficiary_user_id'],
  properties: {
    user_id: { type: 'string' },
    beneficiary_user_id: { type: 'string' },
    alias_name: { type: ['string', 'null'] },
    asset: { type: 'string' },
    address: { type: 'string' },
    network: { type: 'string' },
    avatar_url: { type: ['string', 'null'] },
  },
};
