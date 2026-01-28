import { Test } from '@nestjs/testing';
import { SupportTicketChannel, SupportTicketStatus } from '../../database/models/supportTicket/supportTicket.interface';
import { SupportTicketModel } from '../../database/models/supportTicket/supportTicket.model';
import { UserModel } from '../../database/models/user/user.model';
import { SupportTicketAckMail } from '../../notifications/mails/support_ticket_ack_mail';
import { MailerService } from '../../services/queue/processors/mailer/mailer.service';
import { SupportAdapter } from '../../adapters/support/support.adapter';
import { CreatedTicketResponse, TicketStatus } from '../../adapters/support/support.adapter.interface';
import { SupportTicketRepository } from './support.repository';
import { SupportService } from './support.service';

describe('SupportService', () => {
  let service: SupportService;
  const sendMock = jest.fn();
  const createTicketMock = jest.fn();
  const createTicketAdapterMock = jest.fn();

  const mockUser: Partial<UserModel> = {
    id: 'user-123',
    email: 'user@example.com',
    first_name: 'John',
    last_name: 'Doe',
  };

  const mockTicket: Partial<SupportTicketModel> = {
    id: 'ticket-123',
    ticket_number: 1,
    subject: 'S',
    description: 'D',
    content: 'C',
    status: SupportTicketStatus.OPEN,
    channel: SupportTicketChannel.TICKET,
  };

  const mockAdapterResponse: CreatedTicketResponse = {
    ticketId: 'zendesk-123',
    ticketNumber: '123',
    status: TicketStatus.NEW,
    subject: 'S',
    createdAt: '2024-01-01T00:00:00Z',
  };

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        SupportService,
        {
          provide: MailerService,
          useValue: {
            send: sendMock,
          },
        },
        {
          provide: SupportTicketRepository,
          useValue: {
            createTicket: createTicketMock,
          },
        },
        {
          provide: SupportAdapter,
          useValue: {
            createTicket: createTicketAdapterMock,
          },
        },
      ],
    }).compile();

    service = moduleRef.get<SupportService>(SupportService);
    sendMock.mockReset();
    createTicketMock.mockReset();
    createTicketAdapterMock.mockReset();
    createTicketMock.mockResolvedValue(mockTicket);
    createTicketAdapterMock.mockResolvedValue(mockAdapterResponse);
  });

  it('should create support ticket with adapter and acknowledge user', async () => {
    await service.createSupportTicket(
      { subject: 'S', description: 'D', content: 'C' } as any,
      'user@example.com',
      'ticket',
      mockUser as UserModel,
    );

    expect(createTicketAdapterMock).toHaveBeenCalledWith({
      subject: 'S',
      description: 'D',
      content: 'C',
      userEmail: 'user@example.com',
      userId: 'user-123',
      requesterName: 'John Doe',
      resourceId: undefined,
    });

    expect(createTicketMock).toHaveBeenCalledWith({
      user_id: 'user-123',
      subject: 'S',
      description: 'D',
      content: 'C',
      channel: SupportTicketChannel.TICKET,
      ticket_number: 123,
    });

    expect(sendMock).toHaveBeenCalledTimes(1);
    const ackMail = sendMock.mock.calls[0][0] as SupportTicketAckMail;
    expect(ackMail).toBeInstanceOf(SupportTicketAckMail);
    expect(ackMail.ticketData.ticketNumber).toBe(1);
  });

  it('should create contact ticket with adapter', async () => {
    await service.createSupportTicket(
      { subject: 'S', description: 'D', content: 'C' } as any,
      'user@example.com',
      'contact',
    );

    expect(createTicketAdapterMock).toHaveBeenCalledWith({
      subject: 'S',
      description: 'D',
      content: 'C',
      userEmail: 'user@example.com',
      userId: undefined,
      requesterName: 'user',
      resourceId: undefined,
    });

    expect(createTicketMock).toHaveBeenCalledWith({
      user_id: undefined,
      subject: 'S',
      description: 'D',
      content: 'C',
      channel: SupportTicketChannel.CONTACT,
      ticket_number: 123,
    });
  });

  it('should skip acknowledgement when user email is not provided', async () => {
    await service.createSupportTicket({ subject: 'S', description: 'D', content: 'C' } as any, undefined, 'contact');

    expect(createTicketAdapterMock).toHaveBeenCalledWith({
      subject: 'S',
      description: 'D',
      content: 'C',
      userEmail: 'Not provided',
      userId: undefined,
      requesterName: 'User',
      resourceId: undefined,
    });

    expect(createTicketMock).toHaveBeenCalled();
    expect(sendMock).not.toHaveBeenCalled();
  });

  it('should use user_email from DTO when userEmail is not provided', async () => {
    await service.createSupportTicket(
      { subject: 'S', description: 'D', content: 'C', user_email: 'dto@example.com' } as any,
      undefined,
      'contact',
    );

    expect(createTicketAdapterMock).toHaveBeenCalledWith({
      subject: 'S',
      description: 'D',
      content: 'C',
      userEmail: 'dto@example.com',
      userId: undefined,
      requesterName: 'dto',
      resourceId: undefined,
    });

    expect(sendMock).toHaveBeenCalledTimes(1);
  });

  it('should use userEmail parameter over DTO user_email', async () => {
    await service.createSupportTicket(
      { subject: 'S', description: 'D', content: 'C', user_email: 'dto@example.com' } as any,
      'param@example.com',
      'contact',
    );

    expect(createTicketAdapterMock).toHaveBeenCalledWith({
      subject: 'S',
      description: 'D',
      content: 'C',
      userEmail: 'param@example.com',
      userId: undefined,
      requesterName: 'param',
      resourceId: undefined,
    });
  });

  it('should format requester name with first and last name', async () => {
    await service.createSupportTicket(
      { subject: 'S', description: 'D', content: 'C' } as any,
      'user@example.com',
      'ticket',
      mockUser as UserModel,
    );

    expect(createTicketAdapterMock).toHaveBeenCalledWith(
      expect.objectContaining({
        requesterName: 'John Doe',
      }),
    );
  });

  it('should format requester name with only first name when last name is missing', async () => {
    const userWithoutLastName = {
      ...mockUser,
      last_name: undefined,
    };

    await service.createSupportTicket(
      { subject: 'S', description: 'D', content: 'C' } as any,
      'user@example.com',
      'ticket',
      userWithoutLastName as UserModel,
    );

    expect(createTicketAdapterMock).toHaveBeenCalledWith(
      expect.objectContaining({
        requesterName: 'John',
      }),
    );
  });

  it('should use email prefix when user has no first_name', async () => {
    const userWithoutFirstName = {
      ...mockUser,
      first_name: undefined,
    };

    await service.createSupportTicket(
      { subject: 'S', description: 'D', content: 'C' } as any,
      'user@example.com',
      'ticket',
      userWithoutFirstName as UserModel,
    );

    expect(createTicketAdapterMock).toHaveBeenCalledWith(
      expect.objectContaining({
        requesterName: 'user',
      }),
    );
  });

  it('should use "User" when no user info and email is "Not provided"', async () => {
    await service.createSupportTicket({ subject: 'S', description: 'D', content: 'C' } as any, undefined, 'contact');

    expect(createTicketAdapterMock).toHaveBeenCalledWith(
      expect.objectContaining({
        requesterName: 'User',
      }),
    );
  });

  it('should include resource_id when provided', async () => {
    await service.createSupportTicket(
      { subject: 'S', description: 'D', content: 'C', resource_id: 'card_123' } as any,
      'user@example.com',
      'ticket',
    );

    expect(createTicketAdapterMock).toHaveBeenCalledWith(
      expect.objectContaining({
        resourceId: 'card_123',
      }),
    );
  });

  it('should handle invalid ticket number from provider', async () => {
    createTicketAdapterMock.mockResolvedValueOnce({
      ...mockAdapterResponse,
      ticketNumber: 'invalid',
    });

    const warnSpy = jest.spyOn(service['logger'], 'warn');

    await service.createSupportTicket(
      { subject: 'S', description: 'D', content: 'C' } as any,
      'user@example.com',
      'ticket',
    );

    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('Invalid ticket number from provider: invalid'));
    expect(createTicketMock).toHaveBeenCalledWith(
      expect.objectContaining({
        ticket_number: undefined,
      }),
    );
  });

  it('should handle adapter errors', async () => {
    createTicketAdapterMock.mockRejectedValueOnce(new Error('Adapter error'));

    await expect(
      service.createSupportTicket(
        { subject: 'S', description: 'D', content: 'C' } as any,
        'user@example.com',
        'ticket',
      ),
    ).rejects.toThrow('Adapter error');

    expect(createTicketMock).not.toHaveBeenCalled();
  });

  it('should handle repository errors', async () => {
    createTicketMock.mockRejectedValueOnce(new Error('Repository error'));

    await expect(
      service.createSupportTicket(
        { subject: 'S', description: 'D', content: 'C' } as any,
        'user@example.com',
        'ticket',
      ),
    ).rejects.toThrow('Repository error');
  });

  it('should handle email sending errors', async () => {
    sendMock.mockRejectedValueOnce(new Error('Email service unavailable'));

    await expect(
      service.createSupportTicket(
        { subject: 'S', description: 'D', content: 'C' } as any,
        'user@example.com',
        'ticket',
      ),
    ).rejects.toThrow('Email service unavailable');
  });

  it('should log ticket creation with ticket number and provider ticket ID', async () => {
    const logSpy = jest.spyOn(service['logger'], 'log');

    await service.createSupportTicket(
      { subject: 'S', description: 'D', content: 'C' } as any,
      'user@example.com',
      'ticket',
    );

    expect(logSpy).toHaveBeenCalledWith(
      'Support ticket created: #1 (Provider Ticket ID: zendesk-123) - S from user@example.com',
    );
  });

  it('should format username with first and last name in acknowledgement email', async () => {
    await service.createSupportTicket(
      { subject: 'S', description: 'D', content: 'C' } as any,
      'user@example.com',
      'ticket',
      mockUser as UserModel,
    );

    const ackMail = sendMock.mock.calls[0][0] as SupportTicketAckMail;
    expect(ackMail.ticketData.username).toBe('JOHN DOE');
  });

  it('should format username with only first name when last name is missing in acknowledgement email', async () => {
    const userWithoutLastName = {
      ...mockUser,
      last_name: undefined,
    };

    await service.createSupportTicket(
      { subject: 'S', description: 'D', content: 'C' } as any,
      'user@example.com',
      'ticket',
      userWithoutLastName as UserModel,
    );

    const ackMail = sendMock.mock.calls[0][0] as SupportTicketAckMail;
    expect(ackMail.ticketData.username).toBe('JOHN');
  });

  it('should not include username when user has no first_name in acknowledgement email', async () => {
    const userWithoutFirstName = {
      ...mockUser,
      first_name: undefined,
    };

    await service.createSupportTicket(
      { subject: 'S', description: 'D', content: 'C' } as any,
      'user@example.com',
      'ticket',
      userWithoutFirstName as UserModel,
    );

    const ackMail = sendMock.mock.calls[0][0] as SupportTicketAckMail;
    expect(ackMail.ticketData.username).toBeUndefined();
  });

  it('should not send acknowledgement when email is "Not provided"', async () => {
    await service.createSupportTicket({ subject: 'S', description: 'D', content: 'C' } as any, undefined, 'contact');

    expect(sendMock).not.toHaveBeenCalled();
  });
});

describe('generateZendeskJwtToken', () => {
  let service: SupportService;
  const generateJwtTokenMock = jest.fn();

  const mockUser: Partial<UserModel> = {
    id: 'user-123',
    email: 'user@example.com',
    first_name: 'John',
    last_name: 'Doe',
    is_email_verified: true,
  };

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        SupportService,
        {
          provide: MailerService,
          useValue: {
            send: jest.fn(),
          },
        },
        {
          provide: SupportTicketRepository,
          useValue: {
            createTicket: jest.fn(),
          },
        },
        {
          provide: SupportAdapter,
          useValue: {
            createTicket: jest.fn(),
            generateJwtToken: generateJwtTokenMock,
          },
        },
      ],
    }).compile();

    service = moduleRef.get<SupportService>(SupportService);
    generateJwtTokenMock.mockReset();
  });

  it('should generate JWT token with user details', async () => {
    process.env.ZENDESK_JWT_KEY_ID = 'test-key-id';
    process.env.ZENDESK_JWT_SHARED_SECRET = 'test-shared-secret';
    generateJwtTokenMock.mockResolvedValue('mock-jwt-token');

    const result = await service.generateZendeskJwtToken(mockUser as UserModel);

    expect(generateJwtTokenMock).toHaveBeenCalledWith('user-123', 'user@example.com', 'John Doe', true);
    expect(result).toBe('mock-jwt-token');
  });

  it('should generate JWT token with only first name when last name is missing', async () => {
    process.env.ZENDESK_JWT_KEY_ID = 'test-key-id';
    process.env.ZENDESK_JWT_SHARED_SECRET = 'test-shared-secret';
    generateJwtTokenMock.mockResolvedValue('mock-jwt-token');

    const userWithoutLastName = {
      ...mockUser,
      last_name: undefined,
    };

    const result = await service.generateZendeskJwtToken(userWithoutLastName as UserModel);

    expect(generateJwtTokenMock).toHaveBeenCalledWith('user-123', 'user@example.com', 'John', true);
    expect(result).toBe('mock-jwt-token');
  });

  it('should generate JWT token with email prefix when first name is missing', async () => {
    process.env.ZENDESK_JWT_KEY_ID = 'test-key-id';
    process.env.ZENDESK_JWT_SHARED_SECRET = 'test-shared-secret';
    generateJwtTokenMock.mockResolvedValue('mock-jwt-token');

    const userWithoutFirstName = {
      ...mockUser,
      first_name: undefined,
      last_name: undefined,
    };

    const result = await service.generateZendeskJwtToken(userWithoutFirstName as UserModel);

    expect(generateJwtTokenMock).toHaveBeenCalledWith('user-123', 'user@example.com', 'user', true);
    expect(result).toBe('mock-jwt-token');
  });

  it('should generate JWT token with "User" when no name or email', async () => {
    process.env.ZENDESK_JWT_KEY_ID = 'test-key-id';
    process.env.ZENDESK_JWT_SHARED_SECRET = 'test-shared-secret';
    generateJwtTokenMock.mockResolvedValue('mock-jwt-token');

    const userWithoutNameOrEmail = {
      id: 'user-123',
      email: undefined,
      first_name: undefined,
      last_name: undefined,
      is_email_verified: false,
    };

    const result = await service.generateZendeskJwtToken(userWithoutNameOrEmail as UserModel);

    expect(generateJwtTokenMock).toHaveBeenCalledWith('user-123', undefined, 'User', false);
    expect(result).toBe('mock-jwt-token');
  });

  it('should use email verified status from user', async () => {
    process.env.ZENDESK_JWT_KEY_ID = 'test-key-id';
    process.env.ZENDESK_JWT_SHARED_SECRET = 'test-shared-secret';
    generateJwtTokenMock.mockResolvedValue('mock-jwt-token');

    const unverifiedUser = {
      ...mockUser,
      is_email_verified: false,
    };

    const result = await service.generateZendeskJwtToken(unverifiedUser as UserModel);

    expect(generateJwtTokenMock).toHaveBeenCalledWith('user-123', 'user@example.com', 'John Doe', false);
    expect(result).toBe('mock-jwt-token');
  });
});
