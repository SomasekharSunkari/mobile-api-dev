import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import * as jwt from 'jsonwebtoken';
import { ZendeskConfigProvider } from '../../../config/zendesk.config';
import {
  AddCommentRequest,
  CommentResponse,
  CreateTicketRequest,
  CreatedTicketResponse,
  SupportManagementInterface,
  TicketPriority,
  TicketResponse,
  TicketStatus,
  TicketType,
  UpdateTicketRequest,
} from '../support.adapter.interface';
import { ZendeskAxiosHelper } from './zendesk.axios-helper';
import {
  ZendeskAddCommentRequest,
  ZendeskAddCommentResponse,
  ZendeskCreateTicketRequest,
  ZendeskCreateTicketResponse,
  ZendeskGetTicketResponse,
  ZendeskJwtPayload,
  ZendeskUpdateTicketRequest,
  ZendeskUpdateTicketResponse,
} from './zendesk.interface';

@Injectable()
export class ZendeskAdapter extends ZendeskAxiosHelper implements SupportManagementInterface {
  private readonly logger = new Logger(ZendeskAdapter.name);

  /**
   * Maps Zendesk priority to standardized TicketPriority
   */
  private mapZendeskPriorityToStandard(zendeskPriority?: string): TicketPriority {
    if (!zendeskPriority) {
      return TicketPriority.NORMAL;
    }

    const priorityMap: Record<string, TicketPriority> = {
      low: TicketPriority.LOW,
      normal: TicketPriority.NORMAL,
      high: TicketPriority.HIGH,
      urgent: TicketPriority.URGENT,
    };

    return priorityMap[zendeskPriority.toLowerCase()] || TicketPriority.NORMAL;
  }

  /**
   * Maps standardized TicketPriority to Zendesk priority
   */
  private mapStandardPriorityToZendesk(priority: TicketPriority): string {
    const priorityMap: Record<TicketPriority, string> = {
      [TicketPriority.LOW]: 'low',
      [TicketPriority.NORMAL]: 'normal',
      [TicketPriority.HIGH]: 'high',
      [TicketPriority.URGENT]: 'urgent',
    };

    return priorityMap[priority] || 'normal';
  }

  /**
   * Maps Zendesk status to standardized TicketStatus
   */
  private mapZendeskStatusToStandard(zendeskStatus: string): TicketStatus {
    const statusMap: Record<string, TicketStatus> = {
      new: TicketStatus.NEW,
      open: TicketStatus.OPEN,
      pending: TicketStatus.PENDING,
      solved: TicketStatus.SOLVED,
      closed: TicketStatus.CLOSED,
    };

    return statusMap[zendeskStatus.toLowerCase()] || TicketStatus.NEW;
  }

  /**
   * Maps standardized TicketStatus to Zendesk status
   */
  private mapStandardStatusToZendesk(status: TicketStatus): string {
    const statusMap: Record<TicketStatus, string> = {
      [TicketStatus.NEW]: 'new',
      [TicketStatus.OPEN]: 'open',
      [TicketStatus.PENDING]: 'pending',
      [TicketStatus.SOLVED]: 'solved',
      [TicketStatus.CLOSED]: 'closed',
    };

    return statusMap[status] || 'new';
  }

  /**
   * Maps Zendesk type to standardized TicketType
   */
  private mapZendeskTypeToStandard(zendeskType?: string): TicketType {
    if (!zendeskType) {
      return TicketType.QUESTION;
    }

    const typeMap: Record<string, TicketType> = {
      question: TicketType.QUESTION,
      incident: TicketType.INCIDENT,
      problem: TicketType.PROBLEM,
      task: TicketType.TASK,
    };

    return typeMap[zendeskType.toLowerCase()] || TicketType.QUESTION;
  }

  /**
   * Maps standardized TicketType to Zendesk type
   */
  private mapStandardTypeToZendesk(type: TicketType): string {
    const typeMap: Record<TicketType, string> = {
      [TicketType.QUESTION]: 'question',
      [TicketType.INCIDENT]: 'incident',
      [TicketType.PROBLEM]: 'problem',
      [TicketType.TASK]: 'task',
    };

    return typeMap[type] || 'question';
  }

  /**
   * Transforms Zendesk ticket to standardized TicketResponse
   */
  private transformZendeskTicketToStandard(zendeskTicket: any): TicketResponse {
    return {
      ticketId: zendeskTicket.id.toString(),
      ticketNumber: zendeskTicket.id.toString(),
      status: this.mapZendeskStatusToStandard(zendeskTicket.status),
      priority: this.mapZendeskPriorityToStandard(zendeskTicket.priority),
      type: this.mapZendeskTypeToStandard(zendeskTicket.type),
      subject: zendeskTicket.subject,
      description: zendeskTicket.description || '',
      content: zendeskTicket.description || '',
      userEmail: zendeskTicket.recipient || '',
      createdAt: zendeskTicket.created_at,
      updatedAt: zendeskTicket.updated_at,
      providerMetadata: {
        url: zendeskTicket.url,
        requesterId: zendeskTicket.requester_id,
        assigneeId: zendeskTicket.assignee_id,
        organizationId: zendeskTicket.organization_id,
        tags: zendeskTicket.tags,
        customFields: zendeskTicket.custom_fields,
      },
    };
  }

  /**
   * Formats the ticket body with resource ID information
   */
  private formatTicketBody(ticketRequest: CreateTicketRequest): string {
    const baseParts = [`Subject: ${ticketRequest.subject}`, `\nDescription:\n${ticketRequest.description}`];
    const resourceSection = ticketRequest.resourceId ? [`\nResource ID: ${ticketRequest.resourceId}`] : [];
    const contentPart = [`\nContent:\n${ticketRequest.content || ticketRequest.description}`];
    const parts = [...baseParts, ...resourceSection, ...contentPart];
    return parts.join('\n');
  }

  /**
   * Creates a new support ticket with Zendesk
   */
  async createTicket(ticketRequest: CreateTicketRequest): Promise<CreatedTicketResponse> {
    this.logger.log(`Creating support ticket: ${ticketRequest.subject}`);

    try {
      const formattedBody = this.formatTicketBody(ticketRequest);

      const requestPayload: ZendeskCreateTicketRequest = {
        ticket: {
          subject: ticketRequest.subject,
          comment: {
            body: formattedBody,
            public: true,
          },
          requester: {
            email: ticketRequest.userEmail,
            name: ticketRequest.requesterName,
          },
          priority: ticketRequest.priority ? this.mapStandardPriorityToZendesk(ticketRequest.priority) : undefined,
          type: ticketRequest.type ? this.mapStandardTypeToZendesk(ticketRequest.type) : undefined,
          tags: ['auto-routing', ...(ticketRequest.tags || [])],
          custom_fields: ticketRequest.customFields
            ? Object.entries(ticketRequest.customFields).map(([id, value]) => ({
                id: Number.parseInt(id, 10),
                value,
              }))
            : undefined,
        },
      };

      const response = await this.post<ZendeskCreateTicketRequest, ZendeskCreateTicketResponse>(
        '/tickets.json',
        requestPayload,
      );

      if (response.status !== 200 && response.status !== 201) {
        throw new BadRequestException(`Failed to create support ticket: ${JSON.stringify(response.data)}`);
      }

      const zendeskTicket = response.data.ticket;
      const createdTicket: CreatedTicketResponse = {
        ticketId: zendeskTicket.id.toString(),
        ticketNumber: zendeskTicket.id.toString(),
        status: this.mapZendeskStatusToStandard(zendeskTicket.status),
        subject: zendeskTicket.subject,
        createdAt: zendeskTicket.created_at,
        providerMetadata: {
          url: zendeskTicket.url,
          requesterId: zendeskTicket.requester_id,
        },
      };

      this.logger.log(`Support ticket created successfully: ${createdTicket.ticketId}`);
      return createdTicket;
    } catch (error) {
      this.logger.error('Error creating support ticket', error);
      throw new BadRequestException(error.response?.data?.error || error.message || 'Failed to create support ticket');
    }
  }

  /**
   * Retrieves ticket details from Zendesk
   */
  async getTicket(ticketId: string): Promise<TicketResponse> {
    this.logger.log(`Retrieving ticket: ${ticketId}`);

    try {
      const response = await this.get<ZendeskGetTicketResponse>(`/tickets/${ticketId}.json`);

      if (response.status !== 200) {
        throw new NotFoundException(`Ticket not found: ${ticketId}`);
      }

      const zendeskTicket = response.data.ticket;
      return this.transformZendeskTicketToStandard(zendeskTicket);
    } catch (error) {
      this.logger.error(`Error retrieving ticket ${ticketId}`, error);
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException(
        error.response?.data?.error || error.message || `Failed to retrieve ticket: ${ticketId}`,
      );
    }
  }

  /**
   * Updates an existing ticket with Zendesk
   */
  async updateTicket(ticketId: string, updateRequest: UpdateTicketRequest): Promise<TicketResponse> {
    this.logger.log(`Updating ticket: ${ticketId}`);

    try {
      const requestPayload: ZendeskUpdateTicketRequest = {
        ticket: {
          subject: updateRequest.subject,
          comment: updateRequest.content
            ? {
                body: updateRequest.content,
                public: true,
              }
            : undefined,
          priority: updateRequest.priority ? this.mapStandardPriorityToZendesk(updateRequest.priority) : undefined,
          type: updateRequest.type ? this.mapStandardTypeToZendesk(updateRequest.type) : undefined,
          status: updateRequest.status ? this.mapStandardStatusToZendesk(updateRequest.status) : undefined,
          tags: updateRequest.tags,
          custom_fields: updateRequest.customFields
            ? Object.entries(updateRequest.customFields).map(([id, value]) => ({
                id: Number.parseInt(id, 10),
                value,
              }))
            : undefined,
        },
      };

      const response = await this.put<ZendeskUpdateTicketRequest, ZendeskUpdateTicketResponse>(
        `/tickets/${ticketId}.json`,
        requestPayload,
      );

      if (response.status !== 200) {
        throw new BadRequestException(`Failed to update ticket: ${JSON.stringify(response.data)}`);
      }

      const zendeskTicket = response.data.ticket;
      return this.transformZendeskTicketToStandard(zendeskTicket);
    } catch (error) {
      this.logger.error(`Error updating ticket ${ticketId}`, error);
      throw new BadRequestException(
        error.response?.data?.error || error.message || `Failed to update ticket: ${ticketId}`,
      );
    }
  }

  /**
   * Adds a comment to an existing ticket
   */
  async addComment(ticketId: string, comment: AddCommentRequest): Promise<CommentResponse> {
    this.logger.log(`Adding comment to ticket: ${ticketId}`);

    try {
      const requestPayload: ZendeskAddCommentRequest = {
        ticket: {
          comment: {
            body: comment.body,
            public: comment.public ?? true,
          },
        },
      };

      const response = await this.put<ZendeskAddCommentRequest, ZendeskAddCommentResponse>(
        `/tickets/${ticketId}.json`,
        requestPayload,
      );

      if (response.status !== 200) {
        throw new BadRequestException(`Failed to add comment: ${JSON.stringify(response.data)}`);
      }

      const zendeskTicket = response.data.ticket;
      const audit = response.data.audit;
      const commentEvent = audit?.events?.find((event) => event.type === 'Comment');

      const commentResponse: CommentResponse = {
        commentId: commentEvent?.id?.toString() || audit.id.toString(),
        body: comment.body,
        public: comment.public ?? true,
        authorEmail: comment.authorEmail || '',
        createdAt: audit.created_at,
        providerMetadata: {
          ticketId: zendeskTicket.id,
          auditId: audit.id,
        },
      };

      this.logger.log(`Comment added successfully to ticket: ${ticketId}`);
      return commentResponse;
    } catch (error) {
      this.logger.error(`Error adding comment to ticket ${ticketId}`, error);
      throw new BadRequestException(
        error.response?.data?.error || error.message || `Failed to add comment to ticket: ${ticketId}`,
      );
    }
  }

  /**
   * Generates a JWT token for Zendesk messaging authentication
   *
   * @param externalId - The external id assigned to the user (required, max 255 characters)
   * @param email - Email of the user (optional)
   * @param name - Full name of the user (optional)
   * @param emailVerified - Whether the email is verified (optional, default: true)
   * @param expiresInSeconds - Token expiration time in seconds (optional, default: 3600)
   * @returns JWT token string
   */
  generateJwtToken(
    externalId: string,
    email?: string,
    name?: string,
    emailVerified: boolean = true,
    expiresInSeconds: number = 3600,
  ): string {
    const zendeskConfig = new ZendeskConfigProvider().getConfig();

    if (!zendeskConfig.jwtKeyId || !zendeskConfig.jwtSharedSecret) {
      throw new BadRequestException('Zendesk JWT signing keys are not configured');
    }

    if (!externalId || externalId.length > 255) {
      throw new BadRequestException('External ID is required and must be 255 characters or less');
    }

    const payload: ZendeskJwtPayload = {
      scope: 'user',
      external_id: externalId,
    };

    if (email) {
      payload.email = email;
      payload.email_verified = emailVerified;
    }

    if (name) {
      payload.name = name;
    }

    try {
      const token = jwt.sign(payload, zendeskConfig.jwtSharedSecret, {
        algorithm: 'HS256',
        keyid: zendeskConfig.jwtKeyId,
        expiresIn: expiresInSeconds,
      });

      this.logger.log(`Generated Zendesk JWT token for external_id: ${externalId}`);
      return token;
    } catch (error) {
      this.logger.error('Error generating Zendesk JWT token', error);
      throw new BadRequestException('Failed to generate Zendesk JWT token');
    }
  }
}
