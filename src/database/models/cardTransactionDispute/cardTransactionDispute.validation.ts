import type { JSONSchema } from 'objection';

export const CardTransactionDisputeValidationSchema: JSONSchema = {
  type: 'object',
  title: 'Card Transaction Dispute Validation Schema',
  required: ['transaction_id', 'provider_dispute_ref', 'transaction_ref', 'status'],
  properties: {
    transaction_id: { type: 'string' },
    provider_dispute_ref: { type: 'string' },
    transaction_ref: { type: 'string' },
    status: {
      type: 'string',
      enum: ['pending', 'inReview', 'accepted', 'rejected', 'canceled'],
      default: 'pending',
    },
    text_evidence: { type: ['string', 'null'] },
    resolved_at: { type: ['string', 'null'], format: 'date-time' },
  },
};
