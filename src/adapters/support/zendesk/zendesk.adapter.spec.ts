import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import * as jwt from 'jsonwebtoken';
import { ZendeskAdapter } from './zendesk.adapter';
import {
  CreateTicketRequest,
  UpdateTicketRequest,
  AddCommentRequest,
  TicketStatus,
  TicketPriority,
  TicketType,
} from '../support.adapter.interface';
import {
  ZendeskCreateTicketRequest,
  ZendeskCreateTicketResponse,
  ZendeskGetTicketResponse,
  ZendeskUpdateTicketRequest,
  ZendeskAddCommentRequest,
  ZendeskAddCommentResponse,
  ZendeskTicket,
  ZendeskAudit,
  ZendeskAuditEvent,
} from './zendesk.interface';

describe('ZendeskAdapter', () => {
  let adapter: ZendeskAdapter;

  const mockZendeskTicket: ZendeskTicket = {
    id: 123,
    url: 'https://example.zendesk.com/api/v2/tickets/123.json',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    type: 'question',
    subject: 'Test Subject',
    description: 'Test Description',
    priority: 'normal',
    status: 'open',
    recipient: 'user@example.com',
    requester_id: 456,
    assignee_id: 789,
    organization_id: 101,
    has_incidents: false,
    is_public: true,
    tags: ['auto-routing'],
    custom_fields: [],
    allow_channelback: false,
    allow_attachments: false,
  };

  const mockCreateTicketRequest: CreateTicketRequest = {
    subject: 'Test Subject',
    description: 'Test Description',
    content: 'Test Content',
    userEmail: 'user@example.com',
    userId: 'user-123',
    requesterName: 'John Doe',
    resourceId: 'card_123',
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ZendeskAdapter],
    }).compile();

    adapter = module.get<ZendeskAdapter>(ZendeskAdapter);

    jest.spyOn(adapter as any, 'post').mockResolvedValue({
      status: 201,
      data: {
        ticket: mockZendeskTicket,
      } as ZendeskCreateTicketResponse,
    });

    jest.spyOn(adapter as any, 'get').mockResolvedValue({
      status: 200,
      data: {
        ticket: mockZendeskTicket,
      } as ZendeskGetTicketResponse,
    });

    jest.spyOn(adapter as any, 'put').mockResolvedValue({
      status: 200,
      data: {
        ticket: mockZendeskTicket,
        audit: {
          id: 999,
          ticket_id: 123,
          created_at: '2024-01-01T00:00:00Z',
          author_id: 456,
          events: [
            {
              id: 888,
              type: 'Comment',
              public: true,
              body: 'Test comment',
            } as ZendeskAuditEvent,
          ],
        } as ZendeskAudit,
      } as ZendeskAddCommentResponse,
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createTicket', () => {
    it('should create ticket successfully', async () => {
      const result = await adapter.createTicket(mockCreateTicketRequest);

      expect(adapter['post']).toHaveBeenCalledWith(
        '/tickets.json',
        expect.objectContaining({
          ticket: expect.objectContaining({
            subject: 'Test Subject',
            comment: expect.objectContaining({
              body: expect.stringContaining('Test Subject'),
              public: true,
            }),
            requester: {
              email: 'user@example.com',
              name: 'John Doe',
            },
            tags: expect.arrayContaining(['auto-routing']),
          }),
        }),
      );

      expect(result).toEqual({
        ticketId: '123',
        ticketNumber: '123',
        status: TicketStatus.OPEN,
        subject: 'Test Subject',
        createdAt: '2024-01-01T00:00:00Z',
        providerMetadata: {
          url: mockZendeskTicket.url,
          requesterId: 456,
        },
      });
    });

    it('should format ticket body with resource ID', async () => {
      await adapter.createTicket(mockCreateTicketRequest);

      const callArgs = (adapter['post'] as jest.Mock).mock.calls[0];
      const requestPayload = callArgs[1] as ZendeskCreateTicketRequest;
      const body = requestPayload.ticket.comment.body;

      expect(body).toContain('Subject: Test Subject');
      expect(body).toContain('Description:\nTest Description');
      expect(body).toContain('Resource ID: card_123');
      expect(body).toContain('Content:\nTest Content');
    });

    it('should format ticket body without resource ID when not provided', async () => {
      const requestWithoutResource = {
        ...mockCreateTicketRequest,
        resourceId: undefined,
      };

      await adapter.createTicket(requestWithoutResource);

      const callArgs = (adapter['post'] as jest.Mock).mock.calls[0];
      const requestPayload = callArgs[1] as ZendeskCreateTicketRequest;
      const body = requestPayload.ticket.comment.body;

      expect(body).not.toContain('Resource ID:');
    });

    it('should include priority when provided', async () => {
      const requestWithPriority = {
        ...mockCreateTicketRequest,
        priority: TicketPriority.HIGH,
      };

      await adapter.createTicket(requestWithPriority);

      const callArgs = (adapter['post'] as jest.Mock).mock.calls[0];
      const requestPayload = callArgs[1] as ZendeskCreateTicketRequest;

      expect(requestPayload.ticket.priority).toBe('high');
    });

    it('should include type when provided', async () => {
      const requestWithType = {
        ...mockCreateTicketRequest,
        type: TicketType.INCIDENT,
      };

      await adapter.createTicket(requestWithType);

      const callArgs = (adapter['post'] as jest.Mock).mock.calls[0];
      const requestPayload = callArgs[1] as ZendeskCreateTicketRequest;

      expect(requestPayload.ticket.type).toBe('incident');
    });

    it('should include custom tags when provided', async () => {
      const requestWithTags = {
        ...mockCreateTicketRequest,
        tags: ['urgent', 'billing'],
      };

      await adapter.createTicket(requestWithTags);

      const callArgs = (adapter['post'] as jest.Mock).mock.calls[0];
      const requestPayload = callArgs[1] as ZendeskCreateTicketRequest;

      expect(requestPayload.ticket.tags).toEqual(expect.arrayContaining(['auto-routing', 'urgent', 'billing']));
    });

    it('should include custom fields when provided', async () => {
      const requestWithCustomFields = {
        ...mockCreateTicketRequest,
        customFields: {
          '123': 'value1',
          '456': 'value2',
        },
      };

      await adapter.createTicket(requestWithCustomFields);

      const callArgs = (adapter['post'] as jest.Mock).mock.calls[0];
      const requestPayload = callArgs[1] as ZendeskCreateTicketRequest;

      expect(requestPayload.ticket.custom_fields).toEqual([
        { id: 123, value: 'value1' },
        { id: 456, value: 'value2' },
      ]);
    });

    it('should throw BadRequestException when status is not 200 or 201', async () => {
      (adapter['post'] as jest.Mock).mockResolvedValueOnce({
        status: 400,
        data: { error: 'Invalid request' },
      });

      await expect(adapter.createTicket(mockCreateTicketRequest)).rejects.toThrow(BadRequestException);
    });

    it('should handle API errors', async () => {
      const error = new Error('Network error');
      (error as any).response = { data: { error: 'API error' } };
      (adapter['post'] as jest.Mock).mockRejectedValueOnce(error);

      await expect(adapter.createTicket(mockCreateTicketRequest)).rejects.toThrow(BadRequestException);
    });

    it('should log ticket creation', async () => {
      const logSpy = jest.spyOn(adapter['logger'], 'log');

      await adapter.createTicket(mockCreateTicketRequest);

      expect(logSpy).toHaveBeenCalledWith('Creating support ticket: Test Subject');
      expect(logSpy).toHaveBeenCalledWith('Support ticket created successfully: 123');
    });
  });

  describe('getTicket', () => {
    it('should retrieve ticket successfully', async () => {
      const result = await adapter.getTicket('123');

      expect(adapter['get']).toHaveBeenCalledWith('/tickets/123.json');
      expect(result).toEqual({
        ticketId: '123',
        ticketNumber: '123',
        status: TicketStatus.OPEN,
        priority: TicketPriority.NORMAL,
        type: TicketType.QUESTION,
        subject: 'Test Subject',
        description: 'Test Description',
        content: 'Test Description',
        userEmail: 'user@example.com',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
        providerMetadata: {
          url: mockZendeskTicket.url,
          requesterId: 456,
          assigneeId: 789,
          organizationId: 101,
          tags: ['auto-routing'],
          customFields: [],
        },
      });
    });

    it('should throw NotFoundException when status is not 200', async () => {
      (adapter['get'] as jest.Mock).mockResolvedValueOnce({
        status: 404,
        data: {},
      });

      await expect(adapter.getTicket('123')).rejects.toThrow(NotFoundException);
    });

    it('should handle API errors', async () => {
      const error = new Error('Network error');
      (error as any).response = { data: { error: 'API error' } };
      (adapter['get'] as jest.Mock).mockRejectedValueOnce(error);

      await expect(adapter.getTicket('123')).rejects.toThrow(BadRequestException);
    });

    it('should preserve NotFoundException', async () => {
      const notFoundError = new NotFoundException('Ticket not found');
      (adapter['get'] as jest.Mock).mockRejectedValueOnce(notFoundError);

      await expect(adapter.getTicket('123')).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateTicket', () => {
    const mockUpdateRequest: UpdateTicketRequest = {
      status: TicketStatus.SOLVED,
      priority: TicketPriority.HIGH,
      type: TicketType.INCIDENT,
      subject: 'Updated Subject',
      description: 'Updated Description',
      content: 'Updated Content',
    };

    it('should update ticket successfully', async () => {
      const result = await adapter.updateTicket('123', mockUpdateRequest);

      expect(adapter['put']).toHaveBeenCalledWith(
        '/tickets/123.json',
        expect.objectContaining({
          ticket: expect.objectContaining({
            subject: 'Updated Subject',
            comment: {
              body: 'Updated Content',
              public: true,
            },
            priority: 'high',
            type: 'incident',
            status: 'solved',
          }),
        }),
      );

      expect(result).toBeDefined();
    });

    it('should not include comment when content is not provided', async () => {
      const updateWithoutContent = {
        status: TicketStatus.SOLVED,
      };

      await adapter.updateTicket('123', updateWithoutContent);

      const callArgs = (adapter['put'] as jest.Mock).mock.calls[0];
      const requestPayload = callArgs[1] as ZendeskUpdateTicketRequest;

      expect(requestPayload.ticket.comment).toBeUndefined();
    });

    it('should include tags when provided', async () => {
      const updateWithTags = {
        tags: ['resolved', 'closed'],
      };

      await adapter.updateTicket('123', updateWithTags);

      const callArgs = (adapter['put'] as jest.Mock).mock.calls[0];
      const requestPayload = callArgs[1] as ZendeskUpdateTicketRequest;

      expect(requestPayload.ticket.tags).toEqual(['resolved', 'closed']);
    });

    it('should throw BadRequestException when status is not 200', async () => {
      (adapter['put'] as jest.Mock).mockResolvedValueOnce({
        status: 400,
        data: { error: 'Invalid request' },
      });

      await expect(adapter.updateTicket('123', mockUpdateRequest)).rejects.toThrow(BadRequestException);
    });
  });

  describe('addComment', () => {
    const mockAddCommentRequest: AddCommentRequest = {
      body: 'Test comment',
      public: true,
      authorEmail: 'agent@example.com',
    };

    it('should add comment successfully', async () => {
      const result = await adapter.addComment('123', mockAddCommentRequest);

      expect(adapter['put']).toHaveBeenCalledWith(
        '/tickets/123.json',
        expect.objectContaining({
          ticket: {
            comment: {
              body: 'Test comment',
              public: true,
            },
          },
        }),
      );

      expect(result).toEqual({
        commentId: '888',
        body: 'Test comment',
        public: true,
        authorEmail: 'agent@example.com',
        createdAt: '2024-01-01T00:00:00Z',
        providerMetadata: {
          ticketId: 123,
          auditId: 999,
        },
      });
    });

    it('should default public to true when not provided', async () => {
      const commentWithoutPublic = {
        body: 'Test comment',
      };

      await adapter.addComment('123', commentWithoutPublic);

      const callArgs = (adapter['put'] as jest.Mock).mock.calls[0];
      const requestPayload = callArgs[1] as ZendeskAddCommentRequest;

      expect(requestPayload.ticket.comment.public).toBe(true);
    });

    it('should use audit id when comment event is not found', async () => {
      (adapter['put'] as jest.Mock).mockResolvedValueOnce({
        status: 200,
        data: {
          ticket: mockZendeskTicket,
          audit: {
            id: 999,
            ticket_id: 123,
            created_at: '2024-01-01T00:00:00Z',
            author_id: 456,
            events: [],
          } as ZendeskAudit,
        } as ZendeskAddCommentResponse,
      });

      const result = await adapter.addComment('123', mockAddCommentRequest);

      expect(result.commentId).toBe('999');
    });

    it('should throw BadRequestException when status is not 200', async () => {
      (adapter['put'] as jest.Mock).mockResolvedValueOnce({
        status: 400,
        data: { error: 'Invalid request' },
      });

      await expect(adapter.addComment('123', mockAddCommentRequest)).rejects.toThrow(BadRequestException);
    });
  });

  describe('priority mapping', () => {
    it('should map zendesk priority to standard priority correctly', () => {
      expect(adapter['mapZendeskPriorityToStandard']('low')).toBe(TicketPriority.LOW);
      expect(adapter['mapZendeskPriorityToStandard']('normal')).toBe(TicketPriority.NORMAL);
      expect(adapter['mapZendeskPriorityToStandard']('high')).toBe(TicketPriority.HIGH);
      expect(adapter['mapZendeskPriorityToStandard']('urgent')).toBe(TicketPriority.URGENT);
      expect(adapter['mapZendeskPriorityToStandard']('UNKNOWN')).toBe(TicketPriority.NORMAL);
      expect(adapter['mapZendeskPriorityToStandard'](undefined)).toBe(TicketPriority.NORMAL);
    });

    it('should map standard priority to zendesk priority correctly', () => {
      expect(adapter['mapStandardPriorityToZendesk'](TicketPriority.LOW)).toBe('low');
      expect(adapter['mapStandardPriorityToZendesk'](TicketPriority.NORMAL)).toBe('normal');
      expect(adapter['mapStandardPriorityToZendesk'](TicketPriority.HIGH)).toBe('high');
      expect(adapter['mapStandardPriorityToZendesk'](TicketPriority.URGENT)).toBe('urgent');
    });
  });

  describe('status mapping', () => {
    it('should map zendesk status to standard status correctly', () => {
      expect(adapter['mapZendeskStatusToStandard']('new')).toBe(TicketStatus.NEW);
      expect(adapter['mapZendeskStatusToStandard']('open')).toBe(TicketStatus.OPEN);
      expect(adapter['mapZendeskStatusToStandard']('pending')).toBe(TicketStatus.PENDING);
      expect(adapter['mapZendeskStatusToStandard']('solved')).toBe(TicketStatus.SOLVED);
      expect(adapter['mapZendeskStatusToStandard']('closed')).toBe(TicketStatus.CLOSED);
      expect(adapter['mapZendeskStatusToStandard']('UNKNOWN')).toBe(TicketStatus.NEW);
    });

    it('should map standard status to zendesk status correctly', () => {
      expect(adapter['mapStandardStatusToZendesk'](TicketStatus.NEW)).toBe('new');
      expect(adapter['mapStandardStatusToZendesk'](TicketStatus.OPEN)).toBe('open');
      expect(adapter['mapStandardStatusToZendesk'](TicketStatus.PENDING)).toBe('pending');
      expect(adapter['mapStandardStatusToZendesk'](TicketStatus.SOLVED)).toBe('solved');
      expect(adapter['mapStandardStatusToZendesk'](TicketStatus.CLOSED)).toBe('closed');
    });
  });

  describe('type mapping', () => {
    it('should map zendesk type to standard type correctly', () => {
      expect(adapter['mapZendeskTypeToStandard']('question')).toBe(TicketType.QUESTION);
      expect(adapter['mapZendeskTypeToStandard']('incident')).toBe(TicketType.INCIDENT);
      expect(adapter['mapZendeskTypeToStandard']('problem')).toBe(TicketType.PROBLEM);
      expect(adapter['mapZendeskTypeToStandard']('task')).toBe(TicketType.TASK);
      expect(adapter['mapZendeskTypeToStandard']('UNKNOWN')).toBe(TicketType.QUESTION);
      expect(adapter['mapZendeskTypeToStandard'](undefined)).toBe(TicketType.QUESTION);
    });

    it('should map standard type to zendesk type correctly', () => {
      expect(adapter['mapStandardTypeToZendesk'](TicketType.QUESTION)).toBe('question');
      expect(adapter['mapStandardTypeToZendesk'](TicketType.INCIDENT)).toBe('incident');
      expect(adapter['mapStandardTypeToZendesk'](TicketType.PROBLEM)).toBe('problem');
      expect(adapter['mapStandardTypeToZendesk'](TicketType.TASK)).toBe('task');
    });
  });

  describe('generateJwtToken', () => {
    beforeEach(() => {
      process.env.ZENDESK_JWT_KEY_ID = 'test-key-id';
      process.env.ZENDESK_JWT_SHARED_SECRET = 'test-shared-secret';
    });

    afterEach(() => {
      delete process.env.ZENDESK_JWT_KEY_ID;
      delete process.env.ZENDESK_JWT_SHARED_SECRET;
    });

    it('should generate JWT token with external ID only', () => {
      const token = adapter.generateJwtToken('user-123');

      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
    });

    it('should generate JWT token with external ID and email', () => {
      const token = adapter.generateJwtToken('user-123', 'user@example.com');

      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
    });

    it('should generate JWT token with external ID, email, and name', () => {
      const token = adapter.generateJwtToken('user-123', 'user@example.com', 'John Doe');

      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
    });

    it('should generate JWT token with email verified flag', () => {
      const token = adapter.generateJwtToken('user-123', 'user@example.com', 'John Doe', true);

      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
    });

    it('should generate JWT token with custom expiration', () => {
      const token = adapter.generateJwtToken('user-123', 'user@example.com', 'John Doe', true, 7200);

      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
    });

    it('should throw BadRequestException when JWT key ID is not configured', () => {
      delete process.env.ZENDESK_JWT_KEY_ID;

      expect(() => adapter.generateJwtToken('user-123')).toThrow(BadRequestException);
      expect(() => adapter.generateJwtToken('user-123')).toThrow('Zendesk JWT signing keys are not configured');
    });

    it('should throw BadRequestException when JWT shared secret is not configured', () => {
      delete process.env.ZENDESK_JWT_SHARED_SECRET;

      expect(() => adapter.generateJwtToken('user-123')).toThrow(BadRequestException);
      expect(() => adapter.generateJwtToken('user-123')).toThrow('Zendesk JWT signing keys are not configured');
    });

    it('should throw BadRequestException when external ID is not provided', () => {
      expect(() => adapter.generateJwtToken('')).toThrow(BadRequestException);
      expect(() => adapter.generateJwtToken('')).toThrow('External ID is required and must be 255 characters or less');
    });

    it('should throw BadRequestException when external ID exceeds 255 characters', () => {
      const longExternalId = 'a'.repeat(256);

      expect(() => adapter.generateJwtToken(longExternalId)).toThrow(BadRequestException);
      expect(() => adapter.generateJwtToken(longExternalId)).toThrow(
        'External ID is required and must be 255 characters or less',
      );
    });

    it('should log token generation', () => {
      const logSpy = jest.spyOn(adapter['logger'], 'log');

      adapter.generateJwtToken('user-123');

      expect(logSpy).toHaveBeenCalledWith('Generated Zendesk JWT token for external_id: user-123');
    });

    it('should handle JWT signing errors', () => {
      const signSpy = jest.spyOn(jwt, 'sign');
      signSpy.mockImplementation(() => {
        throw new Error('JWT signing failed');
      });

      expect(() => adapter.generateJwtToken('user-123')).toThrow(BadRequestException);
      expect(() => adapter.generateJwtToken('user-123')).toThrow('Failed to generate Zendesk JWT token');

      signSpy.mockRestore();
    });
  });
});
