import { Test, TestingModule } from '@nestjs/testing';
import { SupportTicketChannel, SupportTicketStatus } from '../../database/models/supportTicket/supportTicket.interface';
import { SupportTicketModel } from '../../database/models/supportTicket/supportTicket.model';
import { SupportTicketRepository } from './support.repository';

describe('SupportTicketRepository', () => {
  let repository: SupportTicketRepository;

  const mockQueryBuilder = {
    max: jest.fn().mockReturnThis(),
    first: jest.fn(),
  };

  const mockTransaction = jest.fn();

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [SupportTicketRepository],
    }).compile();

    repository = module.get<SupportTicketRepository>(SupportTicketRepository);

    jest.spyOn(repository, 'query').mockReturnValue(mockQueryBuilder as any);
    jest.spyOn(repository, 'transaction').mockImplementation(mockTransaction);
    jest.spyOn(repository, 'create').mockResolvedValue({} as SupportTicketModel);

    jest.clearAllMocks();
  });

  describe('getNextTicketNumber', () => {
    it('should return 1 when no tickets exist', async () => {
      mockQueryBuilder.first.mockResolvedValue(null);

      const result = await repository.getNextTicketNumber();

      expect(repository.query).toHaveBeenCalled();
      expect(mockQueryBuilder.max).toHaveBeenCalledWith('ticket_number as max_ticket_number');
      expect(mockQueryBuilder.first).toHaveBeenCalled();
      expect(result).toBe(1);
    });

    it('should return 1 when result is undefined', async () => {
      mockQueryBuilder.first.mockResolvedValue(undefined);

      const result = await repository.getNextTicketNumber();

      expect(result).toBe(1);
    });

    it('should return 1 when max_ticket_number is undefined', async () => {
      mockQueryBuilder.first.mockResolvedValue({ max_ticket_number: undefined });

      const result = await repository.getNextTicketNumber();

      expect(result).toBe(1);
    });

    it('should return 1 when max_ticket_number is null', async () => {
      mockQueryBuilder.first.mockResolvedValue({ max_ticket_number: null });

      const result = await repository.getNextTicketNumber();

      expect(result).toBe(1);
    });

    it('should return 1 when max_ticket_number is 0', async () => {
      mockQueryBuilder.first.mockResolvedValue({ max_ticket_number: 0 });

      const result = await repository.getNextTicketNumber();

      expect(result).toBe(1);
    });

    it('should return max ticket number + 1 when tickets exist', async () => {
      mockQueryBuilder.first.mockResolvedValue({ max_ticket_number: 5 });

      const result = await repository.getNextTicketNumber();

      expect(result).toBe(6);
    });

    it('should work with transaction', async () => {
      const mockTrx = {};
      mockQueryBuilder.first.mockResolvedValue({ max_ticket_number: 10 });

      const result = await repository.getNextTicketNumber(mockTrx);

      expect(repository.query).toHaveBeenCalledWith(mockTrx);
      expect(result).toBe(11);
    });
  });

  describe('createTicket', () => {
    const mockTicketData = {
      user_id: 'user-123',
      subject: 'Test Subject',
      description: 'Test Description',
      content: 'Test Content',
      channel: SupportTicketChannel.TICKET,
    };

    it('should create ticket successfully on first attempt', async () => {
      mockQueryBuilder.first.mockResolvedValue({ max_ticket_number: 1 });
      const mockCreatedTicket = {
        id: 'ticket-123',
        ticket_number: 2,
        ...mockTicketData,
        status: SupportTicketStatus.OPEN,
      } as SupportTicketModel;

      mockTransaction.mockImplementation(async (callback) => {
        const mockTrx = {};
        jest.spyOn(repository, 'getNextTicketNumber').mockResolvedValue(2);
        jest.spyOn(repository, 'create').mockResolvedValue(mockCreatedTicket);
        return await callback(mockTrx);
      });

      const result = await repository.createTicket(mockTicketData);

      expect(repository.transaction).toHaveBeenCalled();
      expect(result.ticket_number).toBe(2);
      expect(result.status).toBe(SupportTicketStatus.OPEN);
    });

    it('should use provided status when given', async () => {
      mockQueryBuilder.first.mockResolvedValue({ max_ticket_number: 1 });
      const mockCreatedTicket = {
        id: 'ticket-123',
        ticket_number: 2,
        ...mockTicketData,
        status: SupportTicketStatus.IN_PROGRESS,
      } as SupportTicketModel;

      mockTransaction.mockImplementation(async (callback) => {
        const mockTrx = {};
        jest.spyOn(repository, 'getNextTicketNumber').mockResolvedValue(2);
        jest.spyOn(repository, 'create').mockResolvedValue(mockCreatedTicket);
        return await callback(mockTrx);
      });

      const result = await repository.createTicket({
        ...mockTicketData,
        status: SupportTicketStatus.IN_PROGRESS,
      });

      expect(result.status).toBe(SupportTicketStatus.IN_PROGRESS);
    });

    it('should retry on unique constraint violation and succeed', async () => {
      let attemptCount = 0;
      mockQueryBuilder.first
        .mockResolvedValueOnce({ max_ticket_number: 1 })
        .mockResolvedValueOnce({ max_ticket_number: 2 });

      const uniqueConstraintError = {
        code: '23505',
        constraint: 'support_tickets_ticket_number_unique',
      };

      const mockCreatedTicket = {
        id: 'ticket-123',
        ticket_number: 3,
        ...mockTicketData,
        status: SupportTicketStatus.OPEN,
      } as SupportTicketModel;

      mockTransaction.mockImplementation(async (callback) => {
        attemptCount++;
        if (attemptCount === 1) {
          throw uniqueConstraintError;
        }
        const mockTrx = {};
        jest.spyOn(repository, 'getNextTicketNumber').mockResolvedValue(3);
        jest.spyOn(repository, 'create').mockResolvedValue(mockCreatedTicket);
        return await callback(mockTrx);
      });

      const result = await repository.createTicket(mockTicketData);

      expect(repository.transaction).toHaveBeenCalledTimes(2);
      expect(result.ticket_number).toBe(3);
    });

    it('should throw error after max retries on unique constraint violation', async () => {
      const uniqueConstraintError = {
        code: '23505',
        constraint: 'support_tickets_ticket_number_unique',
      };

      mockTransaction.mockRejectedValue(uniqueConstraintError);

      await expect(repository.createTicket(mockTicketData)).rejects.toThrow(
        'Failed to generate unique ticket number after multiple attempts',
      );

      expect(repository.transaction).toHaveBeenCalledTimes(5);
    });

    it('should throw error immediately for non-unique constraint errors', async () => {
      const otherError = new Error('Database connection failed');

      mockTransaction.mockRejectedValue(otherError);

      await expect(repository.createTicket(mockTicketData)).rejects.toThrow('Database connection failed');

      expect(repository.transaction).toHaveBeenCalledTimes(1);
    });

    it('should throw error immediately when constraint property is missing', async () => {
      const uniqueConstraintError = {
        code: '23505',
      };

      mockTransaction.mockRejectedValue(uniqueConstraintError);

      await expect(repository.createTicket(mockTicketData)).rejects.toEqual(uniqueConstraintError);

      expect(repository.transaction).toHaveBeenCalledTimes(1);
    });

    it('should create ticket with CONTACT channel', async () => {
      mockQueryBuilder.first.mockResolvedValue({ max_ticket_number: 1 });
      const mockCreatedTicket = {
        id: 'ticket-123',
        ticket_number: 2,
        ...mockTicketData,
        channel: SupportTicketChannel.CONTACT,
        status: SupportTicketStatus.OPEN,
      } as SupportTicketModel;

      mockTransaction.mockImplementation(async (callback) => {
        const mockTrx = {};
        jest.spyOn(repository, 'getNextTicketNumber').mockResolvedValue(2);
        jest.spyOn(repository, 'create').mockResolvedValue(mockCreatedTicket);
        return await callback(mockTrx);
      });

      const result = await repository.createTicket({
        ...mockTicketData,
        channel: SupportTicketChannel.CONTACT,
      });

      expect(result.channel).toBe(SupportTicketChannel.CONTACT);
    });

    it('should throw error when transaction returns falsy value after all retries', async () => {
      let attemptCount = 0;
      const uniqueError = {
        code: '23505',
        constraint: 'support_tickets_ticket_number_unique',
      };

      mockTransaction.mockImplementation(async (callback) => {
        attemptCount++;
        const mockTrx = {};
        jest.spyOn(repository, 'getNextTicketNumber').mockResolvedValue(1);

        if (attemptCount < 5) {
          jest.spyOn(repository, 'create').mockRejectedValue(uniqueError);
        } else {
          jest.spyOn(repository, 'create').mockResolvedValue(null as any);
        }

        return await callback(mockTrx);
      });

      await expect(repository.createTicket(mockTicketData)).rejects.toThrow('Failed to create ticket');

      expect(repository.transaction).toHaveBeenCalledTimes(5);
    });

    it('should use provided ticket_number when given', async () => {
      mockQueryBuilder.first.mockResolvedValue({ max_ticket_number: 1 });
      const mockCreatedTicket = {
        id: 'ticket-123',
        ticket_number: 999,
        ...mockTicketData,
        status: SupportTicketStatus.OPEN,
      } as SupportTicketModel;

      mockTransaction.mockImplementation(async (callback) => {
        const mockTrx = {};
        jest.spyOn(repository, 'create').mockResolvedValue(mockCreatedTicket);
        return await callback(mockTrx);
      });

      const result = await repository.createTicket({
        ...mockTicketData,
        ticket_number: 999,
      });

      expect(repository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          ticket_number: 999,
        }),
        expect.anything(),
      );
      expect(result.ticket_number).toBe(999);
    });

    it('should generate ticket_number when not provided', async () => {
      mockQueryBuilder.first.mockResolvedValue({ max_ticket_number: 5 });
      const mockCreatedTicket = {
        id: 'ticket-123',
        ticket_number: 6,
        ...mockTicketData,
        status: SupportTicketStatus.OPEN,
      } as SupportTicketModel;

      mockTransaction.mockImplementation(async (callback) => {
        const mockTrx = {};
        jest.spyOn(repository, 'getNextTicketNumber').mockResolvedValue(6);
        jest.spyOn(repository, 'create').mockResolvedValue(mockCreatedTicket);
        return await callback(mockTrx);
      });

      const result = await repository.createTicket(mockTicketData);

      expect(repository.getNextTicketNumber).toHaveBeenCalled();
      expect(result.ticket_number).toBe(6);
    });
  });
});
