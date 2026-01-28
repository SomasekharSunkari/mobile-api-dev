import { ConflictException, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { FeatureFlagRepository } from '../featureFlag/featureFlag.repository';
import { FeatureFlagOverrideRepository } from './featureFlagOverride.repository';
import { FeatureFlagOverrideService } from './featureFlagOverride.service';

describe('FeatureFlagOverrideService', () => {
  let service: FeatureFlagOverrideService;
  let featureFlagOverrideRepository: jest.Mocked<FeatureFlagOverrideRepository>;
  let featureFlagRepository: jest.Mocked<FeatureFlagRepository>;

  const mockFeatureFlag = {
    id: 'flag-123',
    key: 'test_feature',
    description: 'Test feature',
    enabled: true,
    expires_at: null,
    created_at: new Date(),
    updated_at: new Date(),
  };

  const mockOverride = {
    id: 'override-123',
    feature_flag_id: 'test_feature',
    user_id: 'user-123',
    enabled: false,
    reason: 'Testing',
    created_at: new Date(),
    updated_at: new Date(),
  };

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        FeatureFlagOverrideService,
        {
          provide: FeatureFlagOverrideRepository,
          useValue: {
            findOne: jest.fn(),
            create: jest.fn(),
            findSync: jest.fn(),
            findById: jest.fn(),
            update: jest.fn(),
            delete: jest.fn(),
          },
        },
        {
          provide: FeatureFlagRepository,
          useValue: {
            findOne: jest.fn(),
          },
        },
      ],
    }).compile();

    service = moduleRef.get<FeatureFlagOverrideService>(FeatureFlagOverrideService);
    featureFlagOverrideRepository = moduleRef.get(FeatureFlagOverrideRepository);
    featureFlagRepository = moduleRef.get(FeatureFlagRepository);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createFeatureFlagOverride', () => {
    const createDto = {
      feature_flag_id: 'test_feature',
      user_id: 'user-123',
      enabled: false,
      reason: 'Testing',
    };

    it('should create a feature flag override successfully', async () => {
      featureFlagRepository.findOne.mockResolvedValue(mockFeatureFlag as any);
      featureFlagOverrideRepository.findOne.mockResolvedValue(null);
      featureFlagOverrideRepository.create.mockResolvedValue(mockOverride as any);

      const result = await service.createFeatureFlagOverride(createDto);

      expect(featureFlagRepository.findOne).toHaveBeenCalledWith({ key: createDto.feature_flag_id });
      expect(featureFlagOverrideRepository.findOne).toHaveBeenCalledWith({
        feature_flag_id: mockFeatureFlag.id,
        user_id: createDto.user_id,
      });
      expect(featureFlagOverrideRepository.create).toHaveBeenCalledWith({
        ...createDto,
        feature_flag_id: mockFeatureFlag.id,
      });
      expect(result).toEqual(mockOverride);
    });

    it('should throw NotFoundException when feature flag does not exist', async () => {
      featureFlagRepository.findOne.mockResolvedValue(null);

      await expect(service.createFeatureFlagOverride(createDto)).rejects.toThrow(NotFoundException);
      expect(featureFlagOverrideRepository.findOne).not.toHaveBeenCalled();
      expect(featureFlagOverrideRepository.create).not.toHaveBeenCalled();
    });

    it('should throw ConflictException when override already exists', async () => {
      featureFlagRepository.findOne.mockResolvedValue(mockFeatureFlag as any);
      featureFlagOverrideRepository.findOne.mockResolvedValue(mockOverride as any);

      await expect(service.createFeatureFlagOverride(createDto)).rejects.toThrow(ConflictException);
      expect(featureFlagOverrideRepository.create).not.toHaveBeenCalled();
    });

    it('should throw InternalServerErrorException on unexpected error', async () => {
      featureFlagRepository.findOne.mockRejectedValue(new Error('Database error'));

      await expect(service.createFeatureFlagOverride(createDto)).rejects.toThrow(InternalServerErrorException);
    });
  });
});
