import { Test } from '@nestjs/testing';
import { SupportController } from './support.controller';
import { SupportService } from './support.service';
import { UserModel } from '../../database';

describe('SupportController', () => {
  let controller: SupportController;
  const createSupportTicketMock = jest.fn();

  const mockUser: Partial<UserModel> = {
    id: 'user-123',
    email: 'user@example.com',
    first_name: 'John',
    last_name: 'Doe',
  };

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [SupportController],
      providers: [
        {
          provide: SupportService,
          useValue: {
            createSupportTicket: createSupportTicketMock,
          },
        },
      ],
    }).compile();

    controller = moduleRef.get<SupportController>(SupportController);
    createSupportTicketMock.mockReset();
  });

  it('createSupportTicket: calls service with ticket channel and user', async () => {
    const dto = { subject: 'S', description: 'D', content: 'C' };
    await controller.createSupportTicket(dto as any, mockUser as UserModel);

    expect(createSupportTicketMock).toHaveBeenCalledWith(dto, 'user@example.com', 'ticket', mockUser);
  });

  it('contactSupport: calls service with contact channel and submitted email', async () => {
    await controller.contactSupport({ subject: 'S', description: 'D', content: 'C', user_email: 'u@e.com' } as any);
    expect(createSupportTicketMock).toHaveBeenCalledWith(
      { subject: 'S', description: 'D', content: 'C', user_email: 'u@e.com' },
      'u@e.com',
      'contact',
    );
  });

  it('createSupportTicket: returns success response', async () => {
    const dto = { subject: 'S', description: 'D', content: 'C' };
    const result = await controller.createSupportTicket(dto as any, mockUser as UserModel);

    expect(result).toMatchObject({
      message: 'Support ticket submitted successfully',
      statusCode: 200,
    });
    expect(result).toHaveProperty('timestamp');
    expect(result).toHaveProperty('data');
  });

  it('contactSupport: returns success response', async () => {
    const result = await controller.contactSupport({
      subject: 'S',
      description: 'D',
      content: 'C',
      user_email: 'u@e.com',
    } as any);

    expect(result).toMatchObject({
      message: 'Support message submitted successfully',
      statusCode: 200,
    });
    expect(result).toHaveProperty('timestamp');
    expect(result).toHaveProperty('data');
  });
});

describe('getZendeskJwtToken', () => {
  let controller: SupportController;
  const generateZendeskJwtTokenMock = jest.fn();

  const mockUser: Partial<UserModel> = {
    id: 'user-123',
    email: 'user@example.com',
    first_name: 'John',
    last_name: 'Doe',
  };

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [SupportController],
      providers: [
        {
          provide: SupportService,
          useValue: {
            createSupportTicket: jest.fn(),
            generateZendeskJwtToken: generateZendeskJwtTokenMock,
          },
        },
      ],
    }).compile();

    controller = moduleRef.get<SupportController>(SupportController);
    generateZendeskJwtTokenMock.mockReset();
  });

  it('should generate and return JWT token', async () => {
    process.env.ZENDESK_JWT_KEY_ID = 'test-key-id';
    process.env.ZENDESK_JWT_SHARED_SECRET = 'test-shared-secret';
    generateZendeskJwtTokenMock.mockResolvedValue('mock-jwt-token');

    const result = await controller.getZendeskJwtToken(mockUser as UserModel);

    expect(generateZendeskJwtTokenMock).toHaveBeenCalledWith(mockUser);
    expect(result).toMatchObject({
      message: 'JWT token generated successfully',
      statusCode: 200,
    });
    expect(result.data).toEqual({ token: 'mock-jwt-token' });
    expect(result).toHaveProperty('timestamp');
  });
});
