import { Test, TestingModule } from '@nestjs/testing';
import { InternalServerErrorException } from '@nestjs/common';
import { SupportAdapter } from './support.adapter';
import { ZendeskAdapter } from './zendesk/zendesk.adapter';
import {
  CreateTicketRequest,
  CreatedTicketResponse,
  TicketResponse,
  UpdateTicketRequest,
  AddCommentRequest,
  CommentResponse,
  SupportProvider,
  TicketStatus,
  TicketPriority,
  TicketType,
} from './support.adapter.interface';

describe('SupportAdapter', () => {
  let adapter: SupportAdapter;
  let zendeskAdapter: jest.Mocked<ZendeskAdapter>;

  const mockCreateTicketRequest: CreateTicketRequest = {
    subject: 'Test Subject',
    description: 'Test Description',
    content: 'Test Content',
    userEmail: 'user@example.com',
    userId: 'user-123',
    requesterName: 'John Doe',
  };

  const mockCreatedTicketResponse: CreatedTicketResponse = {
    ticketId: 'zendesk-123',
    ticketNumber: '123',
    status: TicketStatus.NEW,
    subject: 'Test Subject',
    createdAt: '2024-01-01T00:00:00Z',
  };

  const mockTicketResponse: TicketResponse = {
    ticketId: 'zendesk-123',
    ticketNumber: '123',
    status: TicketStatus.OPEN,
    priority: TicketPriority.NORMAL,
    type: TicketType.QUESTION,
    subject: 'Test Subject',
    description: 'Test Description',
    content: 'Test Content',
    userEmail: 'user@example.com',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  };

  const mockUpdateTicketRequest: UpdateTicketRequest = {
    status: TicketStatus.SOLVED,
    priority: TicketPriority.HIGH,
  };

  const mockAddCommentRequest: AddCommentRequest = {
    body: 'Test comment',
    public: true,
  };

  const mockCommentResponse: CommentResponse = {
    commentId: 'comment-123',
    body: 'Test comment',
    public: true,
    authorEmail: 'user@example.com',
    createdAt: '2024-01-01T00:00:00Z',
  };

  beforeEach(async () => {
    const mockZendeskAdapter = {
      createTicket: jest.fn(),
      getTicket: jest.fn(),
      updateTicket: jest.fn(),
      addComment: jest.fn(),
      generateJwtToken: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [SupportAdapter, { provide: ZendeskAdapter, useValue: mockZendeskAdapter }],
    }).compile();

    adapter = module.get<SupportAdapter>(SupportAdapter);
    zendeskAdapter = module.get(ZendeskAdapter);

    (adapter as any).supportConfig = {
      default_support_provider: SupportProvider.ZENDESK,
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createTicket', () => {
    it('should delegate to zendesk adapter when provider is zendesk', async () => {
      zendeskAdapter.createTicket.mockResolvedValue(mockCreatedTicketResponse);

      const result = await adapter.createTicket(mockCreateTicketRequest);

      expect(zendeskAdapter.createTicket).toHaveBeenCalledWith(mockCreateTicketRequest);
      expect(result).toEqual(mockCreatedTicketResponse);
    });

    it('should throw error for unsupported provider', async () => {
      (adapter as any).supportConfig = {
        default_support_provider: 'unsupported',
      };

      await expect(adapter.createTicket(mockCreateTicketRequest)).rejects.toThrow(InternalServerErrorException);
      await expect(adapter.createTicket(mockCreateTicketRequest)).rejects.toThrow(
        'Unsupported support provider: unsupported',
      );
    });
  });

  describe('getTicket', () => {
    it('should delegate to zendesk adapter when provider is zendesk', async () => {
      zendeskAdapter.getTicket.mockResolvedValue(mockTicketResponse);

      const result = await adapter.getTicket('zendesk-123');

      expect(zendeskAdapter.getTicket).toHaveBeenCalledWith('zendesk-123');
      expect(result).toEqual(mockTicketResponse);
    });

    it('should throw error for unsupported provider', async () => {
      (adapter as any).supportConfig = {
        default_support_provider: 'unsupported',
      };

      await expect(adapter.getTicket('ticket-123')).rejects.toThrow(InternalServerErrorException);
    });
  });

  describe('updateTicket', () => {
    it('should delegate to zendesk adapter when provider is zendesk', async () => {
      zendeskAdapter.updateTicket.mockResolvedValue(mockTicketResponse);

      const result = await adapter.updateTicket('zendesk-123', mockUpdateTicketRequest);

      expect(zendeskAdapter.updateTicket).toHaveBeenCalledWith('zendesk-123', mockUpdateTicketRequest);
      expect(result).toEqual(mockTicketResponse);
    });

    it('should throw error for unsupported provider', async () => {
      (adapter as any).supportConfig = {
        default_support_provider: 'unsupported',
      };

      await expect(adapter.updateTicket('ticket-123', mockUpdateTicketRequest)).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });

  describe('addComment', () => {
    it('should delegate to zendesk adapter when provider is zendesk', async () => {
      zendeskAdapter.addComment.mockResolvedValue(mockCommentResponse);

      const result = await adapter.addComment('zendesk-123', mockAddCommentRequest);

      expect(zendeskAdapter.addComment).toHaveBeenCalledWith('zendesk-123', mockAddCommentRequest);
      expect(result).toEqual(mockCommentResponse);
    });

    it('should throw error for unsupported provider', async () => {
      (adapter as any).supportConfig = {
        default_support_provider: 'unsupported',
      };

      await expect(adapter.addComment('ticket-123', mockAddCommentRequest)).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });

  describe('getProvider', () => {
    it('should return zendesk adapter when provider is zendesk', () => {
      (adapter as any).supportConfig = {
        default_support_provider: SupportProvider.ZENDESK,
      };

      const provider = adapter.getProvider();

      expect(provider).toBe(zendeskAdapter);
    });

    it('should log debug message when selecting provider', () => {
      const debugSpy = jest.spyOn(adapter['logger'], 'debug');
      (adapter as any).supportConfig = {
        default_support_provider: SupportProvider.ZENDESK,
      };

      adapter.getProvider();

      expect(debugSpy).toHaveBeenCalledWith(`Selected support provider: ${SupportProvider.ZENDESK}`);
    });

    it('should log info message when using zendesk', () => {
      const logSpy = jest.spyOn(adapter['logger'], 'log');
      (adapter as any).supportConfig = {
        default_support_provider: SupportProvider.ZENDESK,
      };

      adapter.getProvider();

      expect(logSpy).toHaveBeenCalledWith('Using Zendesk support provider');
    });

    it('should log error for unsupported provider', () => {
      const errorSpy = jest.spyOn(adapter['logger'], 'error');
      (adapter as any).supportConfig = {
        default_support_provider: 'unsupported',
      };

      expect(() => adapter.getProvider()).toThrow();

      expect(errorSpy).toHaveBeenCalledWith('Unsupported support provider: unsupported');
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

    it('should delegate to zendesk adapter when provider is zendesk', async () => {
      Object.setPrototypeOf(zendeskAdapter, ZendeskAdapter.prototype);
      zendeskAdapter.generateJwtToken = jest.fn().mockReturnValue('mock-jwt-token');

      const result = await adapter.generateJwtToken('user-123', 'user@example.com', 'John Doe', true, 3600);

      expect(zendeskAdapter.generateJwtToken).toHaveBeenCalledWith(
        'user-123',
        'user@example.com',
        'John Doe',
        true,
        3600,
      );
      expect(result).toBe('mock-jwt-token');
    });

    it('should throw error when provider is not zendesk', async () => {
      const mockNonZendeskAdapter = {
        createTicket: jest.fn(),
        getTicket: jest.fn(),
        updateTicket: jest.fn(),
        addComment: jest.fn(),
      };

      const originalGetProvider = adapter.getProvider.bind(adapter);
      adapter.getProvider = jest.fn().mockReturnValue(mockNonZendeskAdapter);

      await expect(adapter.generateJwtToken('user-123')).rejects.toThrow(InternalServerErrorException);
      await expect(adapter.generateJwtToken('user-123')).rejects.toThrow(
        'JWT token generation is only supported for Zendesk provider',
      );

      adapter.getProvider = originalGetProvider;
    });
  });
});
