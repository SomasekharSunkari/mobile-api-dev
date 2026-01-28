import { JSONSchema } from 'objection';
import {
  CardTransactionDisputeEventType,
  CardTransactionDisputeTriggeredBy,
} from './cardTransactionDisputeEvent.interface';
import { CardTransactionDisputeStatus } from '../cardTransactionDispute/cardTransactionDispute.interface';

export const CardTransactionDisputeEventValidationSchema: JSONSchema = {
  type: 'object',
  required: ['dispute_id', 'new_status', 'event_type', 'triggered_by'],
  properties: {
    id: { type: 'string' },
    dispute_id: { type: 'string' },
    previous_status: {
      type: ['string', 'null'],
      enum: [null, ...Object.values(CardTransactionDisputeStatus)],
    },
    new_status: {
      type: 'string',
      enum: Object.values(CardTransactionDisputeStatus),
    },
    event_type: {
      type: 'string',
      enum: Object.values(CardTransactionDisputeEventType),
    },
    triggered_by: {
      type: 'string',
      enum: Object.values(CardTransactionDisputeTriggeredBy),
    },
    user_id: { type: ['string', 'null'] },
    reason: { type: ['string', 'null'] },
    created_at: { type: 'string', format: 'date-time' },
    updated_at: { type: 'string', format: 'date-time' },
    deleted_at: { type: ['string', 'null'], format: 'date-time' },
  },
};
