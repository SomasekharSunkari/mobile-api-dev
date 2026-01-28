import { Inject, Injectable, Logger } from '@nestjs/common';
import { DateTime } from 'luxon';
import { UserModel } from '../../database/models';
import { SupportTicketChannel } from '../../database/models/supportTicket';
import { SupportTicketAckMail } from '../../notifications/mails/support_ticket_ack_mail';
import { MailerService } from '../../services/queue/processors/mailer/mailer.service';
import { SupportAdapter } from '../../adapters/support/support.adapter';
import { CreateSupportTicketDto } from './dto/createSupportTicket.dto';
import { SupportTicketRepository } from './support.repository';

@Injectable()
export class SupportService {
  private readonly logger = new Logger(SupportService.name);

  @Inject(MailerService)
  private readonly mailerService: MailerService;

  @Inject(SupportTicketRepository)
  private readonly supportTicketRepository: SupportTicketRepository;

  @Inject(SupportAdapter)
  private readonly supportAdapter: SupportAdapter;

  async createSupportTicket(
    createSupportTicketDto: CreateSupportTicketDto,
    userEmail?: string,
    channel: 'ticket' | 'contact' = 'ticket',
    user?: UserModel,
  ): Promise<void> {
    const { subject, description, content, user_email, resource_id } = createSupportTicketDto;

    const finalUserEmail = userEmail || user_email || 'Not provided';

    try {
      const requesterName = this.getRequesterName(user, finalUserEmail);

      // Create ticket with support provider
      const ticketResponse = await this.supportAdapter.createTicket({
        subject,
        description,
        content,
        userEmail: finalUserEmail,
        userId: user?.id?.toString(),
        requesterName,
        resourceId: resource_id,
      });

      // Store ticket in database using provider's ticket number
      const providerTicketNumber = Number.parseInt(ticketResponse.ticketNumber, 10);
      if (Number.isNaN(providerTicketNumber)) {
        this.logger.warn(`Invalid ticket number from provider: ${ticketResponse.ticketNumber}, will generate one`);
      }

      const ticket = await this.supportTicketRepository.createTicket({
        user_id: user?.id,
        subject,
        description,
        content,
        channel: channel === 'contact' ? SupportTicketChannel.CONTACT : SupportTicketChannel.TICKET,
        ticket_number: Number.isNaN(providerTicketNumber) ? undefined : providerTicketNumber,
      });

      if (finalUserEmail && finalUserEmail !== 'Not provided') {
        await this.sendAcknowledgementEmail(finalUserEmail, user, ticket, {
          subject,
          description,
          content,
          submittedAt: DateTime.now().toISO(),
        });
      }

      this.logger.log(
        `Support ticket created: #${ticket.ticket_number} (Provider Ticket ID: ${ticketResponse.ticketId}) - ${subject} from ${finalUserEmail}`,
      );
    } catch (error) {
      this.logger.error('Failed to create support ticket:', error);
      throw error;
    }
  }

  private getRequesterName(user: UserModel | undefined, userEmail: string): string {
    if (user?.first_name) {
      if (user.last_name) {
        return `${user.first_name} ${user.last_name}`;
      }
      return user.first_name;
    }
    if (userEmail && userEmail !== 'Not provided') {
      return userEmail.split('@')[0];
    }
    return 'User';
  }

  private async sendAcknowledgementEmail(
    userEmail: string,
    user: UserModel | undefined,
    ticket: any,
    ticketData: { subject: string; description: string; content: string; submittedAt: string },
  ): Promise<void> {
    let username: string | undefined;
    if (user?.first_name) {
      const fullName = user.last_name ? `${user.first_name} ${user.last_name}` : user.first_name;
      username = fullName.toUpperCase();
    }

    await this.mailerService.send(
      new SupportTicketAckMail(userEmail, {
        subject: ticketData.subject,
        description: ticketData.description,
        content: ticketData.content,
        submittedAt: ticketData.submittedAt,
        ticketNumber: ticket.ticket_number,
        username,
      }),
      2000,
    );
  }

  async generateZendeskJwtToken(user: UserModel): Promise<string> {
    const externalId = user.id;
    const email = user.email;
    const name =
      user.first_name && user.last_name
        ? `${user.first_name} ${user.last_name}`
        : user.first_name || user.email?.split('@')[0] || 'User';
    const emailVerified = user.is_email_verified || false;

    return this.supportAdapter.generateJwtToken(externalId, email, name, emailVerified);
  }
}
