import { Test, TestingModule } from '@nestjs/testing';
import { LoginEventService } from './loginEvent.service';
import { LoginEventRepository } from './loginEvent.repository';
import { LoginEventModel } from '../../../database/models/loginEvent/loginEvent.model';
import { LastKnownLocation } from './loginEvent.interface';

describe('LoginEventService', () => {
  let service: LoginEventService;
  let repository: jest.Mocked<LoginEventRepository>;

  const mockLoginEvent: Partial<LoginEventModel> = {
    id: 'event-id',
    user_id: 'user-id',
    device_id: 'device-id',
    ip_address: '192.168.1.1',
    country: 'US',
    region: 'CA',
    city: 'San Francisco',
    login_time: '2023-01-01T00:00:00.000Z',
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const mockRepository = {
      query: jest.fn().mockReturnValue({
        where: jest.fn().mockReturnThis(),
        whereNotNull: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        first: jest.fn(),
      }),
      create: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [LoginEventService, { provide: LoginEventRepository, useValue: mockRepository }],
    }).compile();

    service = module.get<LoginEventService>(LoginEventService);
    repository = module.get(LoginEventRepository);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getLastKnownLocation', () => {
    const userId = 'test-user-id';

    it('should return last known location when available', async () => {
      const expectedLocation: LastKnownLocation = {
        country: 'US',
        region: 'CA',
        city: 'San Francisco',
      };

      (repository.query().first as jest.Mock).mockResolvedValue(mockLoginEvent as LoginEventModel);

      const result = await service.getLastKnownLocation(userId);

      expect(result).toEqual(expectedLocation);
      expect(repository.query).toHaveBeenCalled();
      expect(repository.query().where).toHaveBeenCalledWith({ user_id: userId });
      expect(repository.query().whereNotNull).toHaveBeenCalledWith('country');
      expect(repository.query().orderBy).toHaveBeenCalledWith('login_time', 'desc');
    });

    it('should return null when no login events found', async () => {
      (repository.query().first as jest.Mock).mockResolvedValue(null);

      const result = await service.getLastKnownLocation(userId);

      expect(result).toBeNull();
    });

    it('should return null when login event has no location data', async () => {
      const eventWithoutLocation = {
        ...mockLoginEvent,
        country: null,
        region: null,
        city: null,
      };

      (repository.query().first as jest.Mock).mockResolvedValue(eventWithoutLocation as LoginEventModel);

      const result = await service.getLastKnownLocation(userId);

      expect(result).toBeNull();
    });

    it('should handle database errors gracefully', async () => {
      (repository.query().first as jest.Mock).mockRejectedValue(new Error('Database error'));

      const result = await service.getLastKnownLocation(userId);

      expect(result).toBeNull();
    });
  });

  describe('createLoginEvent', () => {
    const loginEventData: Partial<LoginEventModel> = {
      user_id: 'user-id',
      device_id: 'device-id',
      ip_address: '192.168.1.1',
      country: 'US',
      region: 'CA',
      city: 'San Francisco',
      login_time: '2023-01-01T00:00:00.000Z',
    };

    it('should create login event successfully', async () => {
      repository.create.mockResolvedValue(mockLoginEvent as LoginEventModel);

      const result = await service.createLoginEvent(loginEventData);

      expect(result).toEqual(mockLoginEvent);
      expect(repository.create).toHaveBeenCalledWith(loginEventData);
    });

    it('should handle creation errors and rethrow', async () => {
      const error = new Error('Database error');
      repository.create.mockRejectedValue(error);

      await expect(service.createLoginEvent(loginEventData)).rejects.toThrow(error);
      expect(repository.create).toHaveBeenCalledWith(loginEventData);
    });

    it('should create login event with minimal data', async () => {
      const minimalData = {
        user_id: 'user-id',
        ip_address: '192.168.1.1',
      };

      repository.create.mockResolvedValue({ ...minimalData, id: 'new-id' } as unknown as LoginEventModel);

      const result = await service.createLoginEvent(minimalData);

      expect((result as any).user_id).toBe(minimalData.user_id);
      expect((result as any).ip_address).toBe(minimalData.ip_address);
      expect(repository.create).toHaveBeenCalledWith(minimalData);
    });
  });
});
