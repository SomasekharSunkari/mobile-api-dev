import { Test, TestingModule } from '@nestjs/testing';
import { AppService } from './app.service';
import { RedisService } from './services/redis/redis.service';
import { PlatformStatusService } from './modules/platformStatus/platformStatus.service';
import { PlatformStatusEnum } from './database/models/platformStatus/platformStatus.interface';
import { KnexDB } from './database';

jest.mock('./database', () => ({
  KnexDB: {
    connection: jest.fn(),
  },
}));

describe('AppService', () => {
  let service: AppService;

  const mockRedisClient = {
    ping: jest.fn(),
  };

  const mockRedisService = {
    getClient: jest.fn().mockReturnValue(mockRedisClient),
  };

  const mockPlatformStatusService = {
    getPlatformStatus: jest.fn(),
  };

  const mockKnexConnection = {
    raw: jest.fn(),
  };

  beforeEach(async () => {
    (KnexDB.connection as jest.Mock).mockReturnValue(mockKnexConnection);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AppService,
        {
          provide: RedisService,
          useValue: mockRedisService,
        },
        {
          provide: PlatformStatusService,
          useValue: mockPlatformStatusService,
        },
      ],
    }).compile();

    service = module.get<AppService>(AppService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getHealth', () => {
    it('should return ok status when all services are healthy', async () => {
      mockKnexConnection.raw.mockResolvedValue(true);
      mockRedisClient.ping.mockResolvedValue('PONG');
      mockPlatformStatusService.getPlatformStatus.mockResolvedValue({
        services: [],
        overall_status: PlatformStatusEnum.OPERATIONAL,
      });

      const result = await service.getHealth();

      expect(result.status).toBe('ok');
      expect(result.services.database.status).toBe('ok');
      expect(result.services.redis.status).toBe('ok');
      expect(result.platform_status).toBeDefined();
      expect(result.timestamp).toBeDefined();
    });

    it('should return degraded status when database is down', async () => {
      mockKnexConnection.raw.mockRejectedValue(new Error('Connection failed'));
      mockRedisClient.ping.mockResolvedValue('PONG');
      mockPlatformStatusService.getPlatformStatus.mockResolvedValue({
        services: [],
        overall_status: PlatformStatusEnum.OPERATIONAL,
      });

      const result = await service.getHealth();

      expect(result.status).toBe('degraded');
      expect(result.services.database.status).toBe('error');
      expect(result.services.database.error).toBe('Connection failed');
      expect(result.services.redis.status).toBe('ok');
    });

    it('should return degraded status when redis is down', async () => {
      mockKnexConnection.raw.mockResolvedValue(true);
      mockRedisClient.ping.mockRejectedValue(new Error('Redis connection failed'));
      mockPlatformStatusService.getPlatformStatus.mockResolvedValue({
        services: [],
        overall_status: PlatformStatusEnum.OPERATIONAL,
      });

      const result = await service.getHealth();

      expect(result.status).toBe('degraded');
      expect(result.services.database.status).toBe('ok');
      expect(result.services.redis.status).toBe('error');
      expect(result.services.redis.error).toBe('Redis connection failed');
    });

    it('should return degraded status when both services are down', async () => {
      mockKnexConnection.raw.mockRejectedValue(new Error('Database error'));
      mockRedisClient.ping.mockRejectedValue(new Error('Redis error'));
      mockPlatformStatusService.getPlatformStatus.mockResolvedValue({
        services: [],
        overall_status: PlatformStatusEnum.DOWN,
      });

      const result = await service.getHealth();

      expect(result.status).toBe('degraded');
      expect(result.services.database.status).toBe('error');
      expect(result.services.redis.status).toBe('error');
    });

    it('should include platform status from PlatformStatusService', async () => {
      mockKnexConnection.raw.mockResolvedValue(true);
      mockRedisClient.ping.mockResolvedValue('PONG');
      const mockPlatformStatus = {
        services: [
          {
            id: 'status-1',
            service_key: 'authentication',
            service_name: 'Authentication',
            status: PlatformStatusEnum.OPERATIONAL,
          },
          {
            id: 'status-2',
            service_key: 'email_service',
            service_name: 'Email Service',
            status: PlatformStatusEnum.DEGRADED,
          },
        ],
        overall_status: PlatformStatusEnum.DEGRADED,
      };
      mockPlatformStatusService.getPlatformStatus.mockResolvedValue(mockPlatformStatus);

      const result = await service.getHealth();

      expect(result.platform_status).toEqual(mockPlatformStatus);
      expect(mockPlatformStatusService.getPlatformStatus).toHaveBeenCalledWith({});
    });

    it('should include git metadata in health response', async () => {
      mockKnexConnection.raw.mockResolvedValue(true);
      mockRedisClient.ping.mockResolvedValue('PONG');
      mockPlatformStatusService.getPlatformStatus.mockResolvedValue({
        services: [],
        overall_status: PlatformStatusEnum.OPERATIONAL,
      });

      const result = await service.getHealth();

      expect(result).toHaveProperty('commit');
      expect(result).toHaveProperty('branch');
      expect(result).toHaveProperty('buildTime');
    });

    it('should handle database error without message', async () => {
      mockKnexConnection.raw.mockRejectedValue({});
      mockRedisClient.ping.mockResolvedValue('PONG');
      mockPlatformStatusService.getPlatformStatus.mockResolvedValue({
        services: [],
        overall_status: PlatformStatusEnum.OPERATIONAL,
      });

      const result = await service.getHealth();

      expect(result.services.database.status).toBe('error');
      expect(result.services.database.error).toBe('Database connection failed');
    });

    it('should handle redis error without message', async () => {
      mockKnexConnection.raw.mockResolvedValue(true);
      mockRedisClient.ping.mockRejectedValue({});
      mockPlatformStatusService.getPlatformStatus.mockResolvedValue({
        services: [],
        overall_status: PlatformStatusEnum.OPERATIONAL,
      });

      const result = await service.getHealth();

      expect(result.services.redis.status).toBe('error');
      expect(result.services.redis.error).toBe('Redis connection failed');
    });
  });

  describe('getHello', () => {
    it('should return welcome message', () => {
      const result = service.getHello();
      expect(result).toBe('OneDosh API Service Up and Running');
    });
  });
});
