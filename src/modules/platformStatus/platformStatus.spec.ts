import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PlatformServiceKey, PlatformStatusEnum } from '../../database/models/platformStatus/platformStatus.interface';
import { PlatformStatusModel } from '../../database/models/platformStatus/platformStatus.model';
import { PlatformStatusTriggeredBy } from '../../database/models/platformStatusLog/platformStatusLog.interface';
import { PlatformStatusLogRepository } from '../platformStatusLog/platformStatusLog.repository';
import { UpdatePlatformStatusDto } from './dto/updatePlatformStatus.dto';
import { PlatformStatusListener } from './platformStatus.listener';
import { PlatformStatusRepository } from './platformStatus.repository';
import { PlatformStatusService } from './platformStatus.service';

describe('PlatformStatusService', () => {
  let service: PlatformStatusService;

  const mockPlatformStatusRepository = {
    findSync: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  };

  const mockPlatformStatusLogRepository = {
    create: jest.fn(),
  };

  const mockPlatformStatus: Partial<PlatformStatusModel> = {
    id: 'status-123',
    service_key: PlatformServiceKey.AUTHENTICATION,
    service_name: 'Authentication',
    status: PlatformStatusEnum.OPERATIONAL,
    is_manually_set: false,
    last_checked_at: new Date(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PlatformStatusService,
        {
          provide: PlatformStatusRepository,
          useValue: mockPlatformStatusRepository,
        },
        {
          provide: PlatformStatusLogRepository,
          useValue: mockPlatformStatusLogRepository,
        },
      ],
    }).compile();

    service = module.get<PlatformStatusService>(PlatformStatusService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getPlatformStatus', () => {
    it('should return all platform statuses when no filter is provided', async () => {
      const mockStatuses = [mockPlatformStatus] as PlatformStatusModel[];
      mockPlatformStatusRepository.findSync.mockResolvedValue(mockStatuses);

      const result = await service.getPlatformStatus({});

      expect(mockPlatformStatusRepository.findSync).toHaveBeenCalledWith(
        {},
        { limit: 100, orderBy: 'service_name', order: 'asc' },
      );
      expect(result.services).toEqual(mockStatuses);
      expect(result.overall_status).toBe(PlatformStatusEnum.OPERATIONAL);
    });

    it('should filter by service_key when provided', async () => {
      const mockStatuses = [mockPlatformStatus] as PlatformStatusModel[];
      mockPlatformStatusRepository.findSync.mockResolvedValue(mockStatuses);

      await service.getPlatformStatus({ service_key: PlatformServiceKey.AUTHENTICATION });

      expect(mockPlatformStatusRepository.findSync).toHaveBeenCalledWith(
        { service_key: PlatformServiceKey.AUTHENTICATION },
        { limit: 100, orderBy: 'service_name', order: 'asc' },
      );
    });

    it('should return DEGRADED overall status when any service is degraded', async () => {
      const mockStatuses = [
        { ...mockPlatformStatus, status: PlatformStatusEnum.OPERATIONAL },
        { ...mockPlatformStatus, id: 'status-456', status: PlatformStatusEnum.DEGRADED },
      ] as PlatformStatusModel[];
      mockPlatformStatusRepository.findSync.mockResolvedValue(mockStatuses);

      const result = await service.getPlatformStatus({});

      expect(result.overall_status).toBe(PlatformStatusEnum.DEGRADED);
    });

    it('should return DOWN overall status when any service is down', async () => {
      const mockStatuses = [
        { ...mockPlatformStatus, status: PlatformStatusEnum.OPERATIONAL },
        { ...mockPlatformStatus, id: 'status-456', status: PlatformStatusEnum.DOWN },
      ] as PlatformStatusModel[];
      mockPlatformStatusRepository.findSync.mockResolvedValue(mockStatuses);

      const result = await service.getPlatformStatus({});

      expect(result.overall_status).toBe(PlatformStatusEnum.DOWN);
    });

    it('should return OPERATIONAL overall status when no services exist', async () => {
      mockPlatformStatusRepository.findSync.mockResolvedValue([]);

      const result = await service.getPlatformStatus({});

      expect(result.overall_status).toBe(PlatformStatusEnum.OPERATIONAL);
    });
  });

  describe('updatePlatformStatus', () => {
    const updateDto: UpdatePlatformStatusDto = {
      status: PlatformStatusEnum.DOWN,
      custom_message: 'Service is under maintenance',
      reason: 'Planned maintenance',
    };

    it('should update platform status successfully', async () => {
      mockPlatformStatusRepository.findOne.mockResolvedValue(mockPlatformStatus);
      const updatedStatus = { ...mockPlatformStatus, status: PlatformStatusEnum.DOWN };
      mockPlatformStatusRepository.update.mockResolvedValue(updatedStatus);
      mockPlatformStatusLogRepository.create.mockResolvedValue({});

      const result = await service.updatePlatformStatus(PlatformServiceKey.AUTHENTICATION, updateDto, 'admin-123');

      expect(mockPlatformStatusRepository.findOne).toHaveBeenCalledWith({
        service_key: PlatformServiceKey.AUTHENTICATION,
      });
      expect(mockPlatformStatusRepository.update).toHaveBeenCalledWith(
        mockPlatformStatus.id,
        expect.objectContaining({
          status: PlatformStatusEnum.DOWN,
          custom_message: 'Service is under maintenance',
          is_manually_set: true,
        }),
      );
      expect(mockPlatformStatusLogRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          platform_status_id: mockPlatformStatus.id,
          previous_status: PlatformStatusEnum.OPERATIONAL,
          new_status: PlatformStatusEnum.DOWN,
          triggered_by: PlatformStatusTriggeredBy.ADMIN,
          admin_user_id: 'admin-123',
        }),
      );
      expect(result).toEqual(updatedStatus);
    });

    it('should throw NotFoundException when service not found', async () => {
      mockPlatformStatusRepository.findOne.mockResolvedValue(null);

      await expect(service.updatePlatformStatus('unknown_service', updateDto, 'admin-123')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should clear failure_reason when status is set to OPERATIONAL', async () => {
      mockPlatformStatusRepository.findOne.mockResolvedValue({
        ...mockPlatformStatus,
        status: PlatformStatusEnum.DOWN,
      });
      mockPlatformStatusRepository.update.mockResolvedValue({
        ...mockPlatformStatus,
        status: PlatformStatusEnum.OPERATIONAL,
      });
      mockPlatformStatusLogRepository.create.mockResolvedValue({});

      await service.updatePlatformStatus(
        PlatformServiceKey.AUTHENTICATION,
        { status: PlatformStatusEnum.OPERATIONAL },
        'admin-123',
      );

      expect(mockPlatformStatusRepository.update).toHaveBeenCalledWith(
        mockPlatformStatus.id,
        expect.objectContaining({
          failure_reason: null,
        }),
      );
    });
  });

  describe('updateServiceStatus', () => {
    it('should initialize service if not exists', async () => {
      mockPlatformStatusRepository.findOne.mockResolvedValue(null);
      mockPlatformStatusRepository.create.mockResolvedValue(mockPlatformStatus);
      mockPlatformStatusRepository.update.mockResolvedValue(mockPlatformStatus);
      mockPlatformStatusLogRepository.create.mockResolvedValue({});

      await service.updateServiceStatus(PlatformServiceKey.AUTHENTICATION, PlatformStatusEnum.OPERATIONAL);

      expect(mockPlatformStatusRepository.create).toHaveBeenCalled();
    });

    it('should skip update when manually set by admin and not recovering', async () => {
      const manuallySetStatus = { ...mockPlatformStatus, is_manually_set: true };
      mockPlatformStatusRepository.findOne.mockResolvedValue(manuallySetStatus);

      const result = await service.updateServiceStatus(
        PlatformServiceKey.AUTHENTICATION,
        PlatformStatusEnum.DOWN,
        'System error',
      );

      expect(mockPlatformStatusRepository.update).not.toHaveBeenCalled();
      expect(result).toEqual(manuallySetStatus);
    });

    it('should update when status is manually set but recovering to OPERATIONAL', async () => {
      const manuallySetDownStatus = {
        ...mockPlatformStatus,
        is_manually_set: true,
        status: PlatformStatusEnum.DOWN,
      };
      mockPlatformStatusRepository.findOne.mockResolvedValue(manuallySetDownStatus);
      mockPlatformStatusRepository.update.mockResolvedValue({
        ...mockPlatformStatus,
        status: PlatformStatusEnum.OPERATIONAL,
      });
      mockPlatformStatusLogRepository.create.mockResolvedValue({});

      await service.updateServiceStatus(PlatformServiceKey.AUTHENTICATION, PlatformStatusEnum.OPERATIONAL);

      expect(mockPlatformStatusRepository.update).toHaveBeenCalled();
    });

    it('should only update last_checked_at when status unchanged', async () => {
      mockPlatformStatusRepository.findOne.mockResolvedValue(mockPlatformStatus);
      mockPlatformStatusRepository.update.mockResolvedValue(mockPlatformStatus);

      await service.updateServiceStatus(PlatformServiceKey.AUTHENTICATION, PlatformStatusEnum.OPERATIONAL);

      expect(mockPlatformStatusRepository.update).toHaveBeenCalledWith(
        mockPlatformStatus.id,
        expect.objectContaining({
          last_checked_at: expect.any(Date),
        }),
      );
      expect(mockPlatformStatusLogRepository.create).not.toHaveBeenCalled();
    });

    it('should create log when status changes', async () => {
      mockPlatformStatusRepository.findOne.mockResolvedValue(mockPlatformStatus);
      mockPlatformStatusRepository.update.mockResolvedValue({
        ...mockPlatformStatus,
        status: PlatformStatusEnum.DOWN,
      });
      mockPlatformStatusLogRepository.create.mockResolvedValue({});

      await service.updateServiceStatus(PlatformServiceKey.AUTHENTICATION, PlatformStatusEnum.DOWN, 'Service error');

      expect(mockPlatformStatusLogRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          platform_status_id: mockPlatformStatus.id,
          previous_status: PlatformStatusEnum.OPERATIONAL,
          new_status: PlatformStatusEnum.DOWN,
          reason: 'Service error',
          triggered_by: PlatformStatusTriggeredBy.SYSTEM,
        }),
      );
    });
  });

  describe('reportServiceSuccess', () => {
    it('should call updateServiceStatus with OPERATIONAL status', async () => {
      mockPlatformStatusRepository.findOne.mockResolvedValue(mockPlatformStatus);
      mockPlatformStatusRepository.update.mockResolvedValue(mockPlatformStatus);

      await service.reportServiceSuccess(PlatformServiceKey.AUTHENTICATION);

      expect(mockPlatformStatusRepository.findOne).toHaveBeenCalledWith({
        service_key: PlatformServiceKey.AUTHENTICATION,
      });
    });
  });

  describe('reportServiceFailure', () => {
    it('should call updateServiceStatus with DOWN status and reason', async () => {
      mockPlatformStatusRepository.findOne.mockResolvedValue({
        ...mockPlatformStatus,
        status: PlatformStatusEnum.OPERATIONAL,
      });
      mockPlatformStatusRepository.update.mockResolvedValue({
        ...mockPlatformStatus,
        status: PlatformStatusEnum.DOWN,
      });
      mockPlatformStatusLogRepository.create.mockResolvedValue({});

      await service.reportServiceFailure(PlatformServiceKey.AUTHENTICATION, 'Connection failed');

      expect(mockPlatformStatusRepository.update).toHaveBeenCalledWith(
        mockPlatformStatus.id,
        expect.objectContaining({
          status: PlatformStatusEnum.DOWN,
          failure_reason: 'Connection failed',
        }),
      );
    });
  });

  describe('reportServiceDegraded', () => {
    it('should call updateServiceStatus with DEGRADED status', async () => {
      mockPlatformStatusRepository.findOne.mockResolvedValue({
        ...mockPlatformStatus,
        status: PlatformStatusEnum.OPERATIONAL,
      });
      mockPlatformStatusRepository.update.mockResolvedValue({
        ...mockPlatformStatus,
        status: PlatformStatusEnum.DEGRADED,
      });
      mockPlatformStatusLogRepository.create.mockResolvedValue({});

      await service.reportServiceDegraded(PlatformServiceKey.AUTHENTICATION, 'High latency');

      expect(mockPlatformStatusRepository.update).toHaveBeenCalledWith(
        mockPlatformStatus.id,
        expect.objectContaining({
          status: PlatformStatusEnum.DEGRADED,
          failure_reason: 'High latency',
        }),
      );
    });
  });

  describe('initializeAllServiceStatuses', () => {
    it('should initialize all service statuses that do not exist', async () => {
      mockPlatformStatusRepository.findOne.mockResolvedValue(null);
      mockPlatformStatusRepository.create.mockResolvedValue(mockPlatformStatus);

      await service.initializeAllServiceStatuses();

      const serviceKeyCount = Object.values(PlatformServiceKey).length;
      expect(mockPlatformStatusRepository.findOne).toHaveBeenCalledTimes(serviceKeyCount);
      expect(mockPlatformStatusRepository.create).toHaveBeenCalledTimes(serviceKeyCount);
    });

    it('should skip initialization for existing services', async () => {
      mockPlatformStatusRepository.findOne.mockResolvedValue(mockPlatformStatus);

      await service.initializeAllServiceStatuses();

      expect(mockPlatformStatusRepository.create).not.toHaveBeenCalled();
    });
  });
});

describe('PlatformStatusRepository', () => {
  let repository: PlatformStatusRepository;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PlatformStatusRepository],
    }).compile();

    repository = module.get<PlatformStatusRepository>(PlatformStatusRepository);
  });

  it('should be defined', () => {
    expect(repository).toBeDefined();
  });

  it('should extend BaseRepository with PlatformStatusModel', () => {
    expect(repository).toBeInstanceOf(PlatformStatusRepository);
  });
});

describe('PlatformStatusListener', () => {
  let listener: PlatformStatusListener;
  const mockPlatformStatusService = {
    reportServiceSuccess: jest.fn(),
    reportServiceFailure: jest.fn(),
    initializeAllServiceStatuses: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PlatformStatusListener,
        {
          provide: PlatformStatusService,
          useValue: mockPlatformStatusService,
        },
      ],
    }).compile();

    listener = module.get<PlatformStatusListener>(PlatformStatusListener);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('onModuleInit', () => {
    it('should log initialization message', () => {
      const logSpy = jest.spyOn(listener['logger'], 'log');
      listener.onModuleInit();
      expect(logSpy).toHaveBeenCalledWith('PlatformStatusListener initialized');
    });
  });

  describe('handleServiceSuccess', () => {
    it('should call reportServiceSuccess with payload serviceKey', async () => {
      const payload = { serviceKey: PlatformServiceKey.AUTHENTICATION };
      mockPlatformStatusService.reportServiceSuccess.mockResolvedValue(undefined);

      await listener.handleServiceSuccess(payload);

      expect(mockPlatformStatusService.reportServiceSuccess).toHaveBeenCalledWith(PlatformServiceKey.AUTHENTICATION);
    });

    it('should handle errors gracefully', async () => {
      const payload = { serviceKey: PlatformServiceKey.AUTHENTICATION };
      const error = new Error('Database error');
      mockPlatformStatusService.reportServiceSuccess.mockRejectedValue(error);

      const logSpy = jest.spyOn(listener['logger'], 'error');

      await listener.handleServiceSuccess(payload);

      expect(logSpy).toHaveBeenCalled();
    });
  });

  describe('handleServiceFailure', () => {
    it('should call reportServiceFailure with payload serviceKey and reason', async () => {
      const payload = { serviceKey: PlatformServiceKey.EMAIL_SERVICE, reason: 'SMTP error' };
      mockPlatformStatusService.reportServiceFailure.mockResolvedValue(undefined);

      await listener.handleServiceFailure(payload);

      expect(mockPlatformStatusService.reportServiceFailure).toHaveBeenCalledWith(
        PlatformServiceKey.EMAIL_SERVICE,
        'SMTP error',
      );
    });

    it('should use "Unknown error" when reason is not provided', async () => {
      const payload = { serviceKey: PlatformServiceKey.EMAIL_SERVICE };
      mockPlatformStatusService.reportServiceFailure.mockResolvedValue(undefined);

      await listener.handleServiceFailure(payload);

      expect(mockPlatformStatusService.reportServiceFailure).toHaveBeenCalledWith(
        PlatformServiceKey.EMAIL_SERVICE,
        'Unknown error',
      );
    });

    it('should handle errors gracefully', async () => {
      const payload = { serviceKey: PlatformServiceKey.EMAIL_SERVICE, reason: 'SMTP error' };
      const error = new Error('Database error');
      mockPlatformStatusService.reportServiceFailure.mockRejectedValue(error);

      const logSpy = jest.spyOn(listener['logger'], 'error');

      await listener.handleServiceFailure(payload);

      expect(logSpy).toHaveBeenCalled();
    });
  });
});
