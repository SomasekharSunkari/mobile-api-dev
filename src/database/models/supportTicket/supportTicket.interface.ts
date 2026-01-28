import { IBase } from '../../base';
import { IUser } from '../user';

export const SupportTicketStatus = {
  OPEN: 'open',
  IN_PROGRESS: 'in_progress',
  RESOLVED: 'resolved',
  CLOSED: 'closed',
} as const;

export type ISupportTicketStatus = (typeof SupportTicketStatus)[keyof typeof SupportTicketStatus];

export const SupportTicketChannel = {
  TICKET: 'ticket',
  CONTACT: 'contact',
} as const;

export type ISupportTicketChannel = (typeof SupportTicketChannel)[keyof typeof SupportTicketChannel];

export interface ISupportTicket extends IBase {
  user_id?: string;
  ticket_number: number;
  subject: string;
  description: string;
  content: string;
  status: ISupportTicketStatus;
  channel: ISupportTicketChannel;
  resolved_at?: Date | string;

  user?: IUser;
}
