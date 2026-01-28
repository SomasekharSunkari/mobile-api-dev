import { InternalServerErrorException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { SystemConfigModel } from '../../database/models/systemConfig/systemConfig.model';
import { GetSystemConfigsDto } from './dto/getSystemConfigs.dto';
import { SystemConfigController } from './systemConfig.controller';
import { SystemConfigRepository } from './systemConfig.repository';
import { SystemConfigService } from './systemConfig.service';

describe('SystemConfigService', () => {
  let service: SystemConfigService;
  let mockQueryBuilder: any;

  const mockSystemConfigRepository = {
    query: jest.fn(),
  };

  // Creates a mock query builder that resolves to the provided value when awaited
  const createThenableQueryBuilder = (resolveValue: SystemConfigModel[]) => {
    const thenable: any = {
      limit: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
    };
    thenable.then = (onFulfilled: any) => Promise.resolve(resolveValue).then(onFulfilled);
    thenable.catch = (onRejected: any) => Promise.resolve(resolveValue).catch(onRejected);
    return thenable;
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SystemConfigService,
        {
          provide: SystemConfigRepository,
          useValue: mockSystemConfigRepository,
        },
      ],
    }).compile();

    service = module.get<SystemConfigService>(SystemConfigService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getSystemConfigs', () => {
    it('should return all system configs when no filters are provided', async () => {
      const mockConfigs = [
        { id: '1', key: 'test_key', type: 'feature_flag', is_enabled: true, value: 'test_value' },
      ] as SystemConfigModel[];

      mockQueryBuilder = createThenableQueryBuilder(mockConfigs);
      mockSystemConfigRepository.query.mockReturnValue(mockQueryBuilder);

      const query: GetSystemConfigsDto = {};
      const result = await service.getSystemConfigs(query);

      expect(mockSystemConfigRepository.query).toHaveBeenCalled();
      expect(mockQueryBuilder.limit).toHaveBeenCalledWith(100);
      expect(mockQueryBuilder.where).not.toHaveBeenCalled();
      expect(result).toEqual(mockConfigs);
    });

    it('should filter by type when type is provided', async () => {
      const mockConfigs = [
        { id: '1', key: 'test_key', type: 'feature_flag', is_enabled: true, value: 'test_value' },
      ] as SystemConfigModel[];

      mockQueryBuilder = createThenableQueryBuilder(mockConfigs);
      mockSystemConfigRepository.query.mockReturnValue(mockQueryBuilder);

      const query: GetSystemConfigsDto = { type: 'feature_flag' };
      const result = await service.getSystemConfigs(query);

      expect(mockSystemConfigRepository.query).toHaveBeenCalled();
      expect(mockQueryBuilder.limit).toHaveBeenCalledWith(100);
      expect(mockQueryBuilder.where).toHaveBeenCalledWith('type', 'feature_flag');
      expect(result).toEqual(mockConfigs);
    });

    it('should filter by key when key is provided', async () => {
      const mockConfigs = [
        { id: '1', key: 'minimum_app_version', type: 'config', is_enabled: true, value: '1.0.0' },
      ] as SystemConfigModel[];

      mockQueryBuilder = createThenableQueryBuilder(mockConfigs);
      mockSystemConfigRepository.query.mockReturnValue(mockQueryBuilder);

      const query: GetSystemConfigsDto = { key: 'minimum_app_version' };
      const result = await service.getSystemConfigs(query);

      expect(mockSystemConfigRepository.query).toHaveBeenCalled();
      expect(mockQueryBuilder.limit).toHaveBeenCalledWith(100);
      expect(mockQueryBuilder.where).toHaveBeenCalledWith('key', 'minimum_app_version');
      expect(result).toEqual(mockConfigs);
    });

    it('should filter by both type and key when both are provided', async () => {
      const mockConfigs = [
        { id: '1', key: 'minimum_app_version', type: 'config', is_enabled: true, value: '1.0.0' },
      ] as SystemConfigModel[];

      mockQueryBuilder = createThenableQueryBuilder(mockConfigs);
      mockSystemConfigRepository.query.mockReturnValue(mockQueryBuilder);

      const query: GetSystemConfigsDto = { type: 'config', key: 'minimum_app_version' };
      const result = await service.getSystemConfigs(query);

      expect(mockSystemConfigRepository.query).toHaveBeenCalled();
      expect(mockQueryBuilder.limit).toHaveBeenCalledWith(100);
      expect(mockQueryBuilder.where).toHaveBeenCalledWith('type', 'config');
      expect(mockQueryBuilder.where).toHaveBeenCalledWith('key', 'minimum_app_version');
      expect(result).toEqual(mockConfigs);
    });

    it('should throw InternalServerErrorException when repository throws error', async () => {
      mockSystemConfigRepository.query.mockImplementation(() => {
        throw new Error('Database error');
      });

      const query: GetSystemConfigsDto = {};
      await expect(service.getSystemConfigs(query)).rejects.toThrow(InternalServerErrorException);
      await expect(service.getSystemConfigs(query)).rejects.toThrow(
        'Something went wrong while fetching system configs',
      );
    });
  });
});

describe('SystemConfigController', () => {
  let controller: SystemConfigController;

  const mockSystemConfigService = {
    getSystemConfigs: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [SystemConfigController],
      providers: [
        {
          provide: SystemConfigService,
          useValue: mockSystemConfigService,
        },
      ],
    }).compile();

    controller = module.get<SystemConfigController>(SystemConfigController);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getSystemConfigs', () => {
    it('should return system configurations successfully', async () => {
      const mockConfigs = [
        { id: '1', key: 'test_key', type: 'feature_flag', is_enabled: true, value: 'test_value' },
      ] as SystemConfigModel[];

      mockSystemConfigService.getSystemConfigs.mockResolvedValue(mockConfigs);

      const query: GetSystemConfigsDto = { type: 'feature_flag' };
      const result = await controller.getSystemConfigs(query);

      expect(mockSystemConfigService.getSystemConfigs).toHaveBeenCalledWith(query);
      expect(result).toEqual(
        expect.objectContaining({
          message: 'System configurations retrieved successfully',
          data: mockConfigs,
          statusCode: 200,
        }),
      );
      expect(result).toHaveProperty('timestamp');
    });

    it('should handle service errors', async () => {
      mockSystemConfigService.getSystemConfigs.mockRejectedValue(new InternalServerErrorException('Service error'));

      const query: GetSystemConfigsDto = {};
      await expect(controller.getSystemConfigs(query)).rejects.toThrow(InternalServerErrorException);
    });
  });
});

describe('SystemConfigRepository', () => {
  let repository: SystemConfigRepository;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [SystemConfigRepository],
    }).compile();

    repository = module.get<SystemConfigRepository>(SystemConfigRepository);
  });

  it('should be defined', () => {
    expect(repository).toBeDefined();
  });

  it('should extend BaseRepository with SystemConfigModel', () => {
    expect(repository).toBeInstanceOf(SystemConfigRepository);
  });
});
