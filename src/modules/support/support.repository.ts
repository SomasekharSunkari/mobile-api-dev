import { Injectable } from '@nestjs/common';
import { BaseRepository } from '../../database';
import {
  ISupportTicketChannel,
  ISupportTicketStatus,
  SupportTicketModel,
  SupportTicketStatus,
} from '../../database/models/supportTicket';

interface CreateTicketData {
  user_id?: string;
  subject: string;
  description: string;
  content: string;
  status?: ISupportTicketStatus;
  channel: ISupportTicketChannel;
  ticket_number?: number;
}

@Injectable()
export class SupportTicketRepository extends BaseRepository<SupportTicketModel> {
  constructor() {
    super(SupportTicketModel);
  }

  async getNextTicketNumber(trx?: any): Promise<number> {
    const result = (await this.query(trx).max('ticket_number as max_ticket_number').first()) as any;

    const maxTicketNumber = result?.max_ticket_number;

    if (!maxTicketNumber) {
      return 1;
    }

    return maxTicketNumber + 1;
  }

  async createTicket(data: CreateTicketData): Promise<SupportTicketModel> {
    const maxRetries = 5;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const result = await this.transaction(async (trx) => {
          // Use provider ticket number if provided, otherwise generate one
          const ticketNumber = data.ticket_number || (await this.getNextTicketNumber(trx));

          return await this.create(
            {
              user_id: data.user_id,
              ticket_number: ticketNumber,
              subject: data.subject,
              description: data.description,
              content: data.content,
              status: data.status || SupportTicketStatus.OPEN,
              channel: data.channel,
            },
            trx,
          );
        });

        if (result) {
          return result;
        }
      } catch (error) {
        // Handle unique constraint violation (PostgreSQL error code 23505)
        if (error.code === '23505' && error.constraint?.includes('ticket_number')) {
          this.logger.warn(`Ticket number conflict on attempt ${attempt + 1}, retrying...`);
          if (attempt === maxRetries - 1) {
            throw new Error('Failed to generate unique ticket number after multiple attempts');
          }
          continue;
        }
        throw error;
      }
    }

    throw new Error('Failed to create ticket');
  }
}
