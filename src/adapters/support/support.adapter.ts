import { Inject, Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { SupportConfig, SupportConfigProvider } from '../../config/support.config';
import {
  AddCommentRequest,
  CommentResponse,
  CreateTicketRequest,
  CreatedTicketResponse,
  SupportManagementInterface,
  SupportProvider,
  TicketResponse,
  UpdateTicketRequest,
} from './support.adapter.interface';
import { ZendeskAdapter } from './zendesk/zendesk.adapter';

@Injectable()
export class SupportAdapter implements SupportManagementInterface {
  @Inject(ZendeskAdapter)
  private readonly zendeskAdapter: ZendeskAdapter;

  private readonly logger = new Logger(SupportAdapter.name);
  private readonly supportConfig: SupportConfig;

  constructor() {
    this.supportConfig = new SupportConfigProvider().getConfig();
  }

  async createTicket(ticketRequest: CreateTicketRequest): Promise<CreatedTicketResponse> {
    return await this.getProvider().createTicket(ticketRequest);
  }

  async getTicket(ticketId: string): Promise<TicketResponse> {
    return await this.getProvider().getTicket(ticketId);
  }

  async updateTicket(ticketId: string, updateRequest: UpdateTicketRequest): Promise<TicketResponse> {
    return await this.getProvider().updateTicket(ticketId, updateRequest);
  }

  async addComment(ticketId: string, comment: AddCommentRequest): Promise<CommentResponse> {
    return await this.getProvider().addComment(ticketId, comment);
  }

  async generateJwtToken(
    externalId: string,
    email?: string,
    name?: string,
    emailVerified: boolean = true,
    expiresInSeconds: number = 3600,
  ): Promise<string> {
    const provider = this.getProvider();
    if (provider instanceof ZendeskAdapter) {
      return provider.generateJwtToken(externalId, email, name, emailVerified, expiresInSeconds);
    }

    throw new InternalServerErrorException('JWT token generation is only supported for Zendesk provider');
  }

  getProvider() {
    const provider = this.supportConfig.default_support_provider;
    this.logger.debug(`Selected support provider: ${provider}`);

    if (provider === SupportProvider.ZENDESK) {
      this.logger.log('Using Zendesk support provider');
      return this.zendeskAdapter;
    }

    this.logger.error(`Unsupported support provider: ${provider}`);
    throw new InternalServerErrorException(`Unsupported support provider: ${provider}`);
  }
}
