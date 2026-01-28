import { MailerManager } from '../../services/queue/processors/mailer/mailer.interface';

export class SupportTicketAckMail implements MailerManager {
  public subject: string;
  public view = 'support_ticket_ack';

  public to: string;

  constructor(
    public readonly recipientEmail: string,
    public readonly ticketData: {
      subject: string;
      description: string;
      content: string;
      submittedAt: string;
      ticketNumber: number;
      username?: string;
    },
  ) {
    this.to = recipientEmail;
    this.subject = `Ticket #${ticketData.ticketNumber} - We've Received Your Request`;
  }

  async prepare(): Promise<Record<string, any>> {
    return {
      ticketNumber: this.ticketData.ticketNumber,
      username: this.ticketData.username || 'there',
    };
  }
}
