import { JSONSchema } from 'objection';

export const KycStatusLogValidationSchema: JSONSchema = {
  type: 'object',
  title: 'KYC Status Log Validation Schema',
  required: ['kyc_id', 'new_status'],
  properties: {
    kyc_id: { type: 'string' },
    old_status: { type: ['string', 'null'] },
    new_status: { type: 'string' },
    changed_at: { type: ['string', 'null'], format: 'date-time' },
    comment: { type: ['string', 'null'] },
  },
};
