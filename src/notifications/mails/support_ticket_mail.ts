import { MailerManager } from '../../services/queue/processors/mailer/mailer.interface';

export class SupportTicketMail implements MailerManager {
  public subject: string;
  public view = 'support_ticket';

  public to: string | string[];

  constructor(
    public readonly supportEmails: string[],
    public readonly ticketData: {
      subject: string;
      description: string;
      content: string;
      userEmail: string;
      submittedAt: string;
    },
  ) {
    this.to = supportEmails;
    this.subject = `New Support Ticket - ${ticketData.subject}`;
  }

  async prepare(): Promise<Record<string, any>> {
    const submittedDate = new Date(this.ticketData.submittedAt);
    const formattedDate = submittedDate.toLocaleString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      timeZoneName: 'short',
    });

    return {
      subject: this.ticketData.subject,
      description: this.ticketData.description,
      content: this.ticketData.content,
      userEmail: this.ticketData.userEmail,
      submittedAt: formattedDate,
    };
  }
}
