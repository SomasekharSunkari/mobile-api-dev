import { JSONSchema } from 'objection';

export const SupportTicketValidationSchema: JSONSchema = {
  type: 'object',
  title: 'SupportTicket Schema Validation',
  required: ['ticket_number', 'subject', 'description', 'content', 'status', 'channel'],
  properties: {
    user_id: { type: ['string', 'null'] },
    ticket_number: { type: 'integer' },
    subject: { type: 'string' },
    description: { type: 'string' },
    content: { type: 'string' },
    status: { type: 'string', enum: ['open', 'in_progress', 'resolved', 'closed'] },
    channel: { type: 'string', enum: ['ticket', 'contact'] },
    resolved_at: { type: ['string', 'null'] },
  },
};
