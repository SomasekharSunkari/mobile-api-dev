import { ConflictException, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Platform } from '../../constants/platform';
import { FeatureFlagOverrideRepository } from '../featureFlagOverride/featureFlagOverride.repository';
import { FeatureFlagRepository } from './featureFlag.repository';
import { FeatureFlagService } from './featureFlag.service';

describe('FeatureFlagService', () => {
  let service: FeatureFlagService;
  let featureFlagRepository: jest.Mocked<FeatureFlagRepository>;
  let featureFlagOverrideRepository: jest.Mocked<FeatureFlagOverrideRepository>;

  const mockFeatureFlag = {
    id: 'flag-123',
    key: 'test_feature',
    description: 'Test feature',
    enabled: true,
    enabled_ios: true,
    enabled_android: true,
    expires_at: null,
    created_at: new Date(),
    updated_at: new Date(),
  };

  const mockUser = {
    id: 'user-123',
    username: 'testuser',
    email: 'test@example.com',
  } as any;

  beforeEach(async () => {
    const mockFindSync = jest.fn().mockReturnValue({
      where: jest.fn().mockReturnThis(),
      whereIn: jest.fn().mockReturnThis(),
      then: jest.fn((resolve) => resolve([])),
    });

    const moduleRef = await Test.createTestingModule({
      providers: [
        FeatureFlagService,
        {
          provide: FeatureFlagRepository,
          useValue: {
            findOne: jest.fn(),
            create: jest.fn(),
            findSync: mockFindSync,
            update: jest.fn(),
            delete: jest.fn(),
          },
        },
        {
          provide: FeatureFlagOverrideRepository,
          useValue: {
            findOne: jest.fn(),
            findSync: mockFindSync,
          },
        },
      ],
    }).compile();

    service = moduleRef.get<FeatureFlagService>(FeatureFlagService);
    featureFlagRepository = moduleRef.get(FeatureFlagRepository);
    featureFlagOverrideRepository = moduleRef.get(FeatureFlagOverrideRepository);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createFeatureFlag', () => {
    const createDto = {
      key: 'new_feature',
      description: 'New feature',
      enabled: false,
    };

    it('should create a feature flag successfully', async () => {
      featureFlagRepository.findOne.mockResolvedValue(null);
      featureFlagRepository.create.mockResolvedValue(mockFeatureFlag as any);

      const result = await service.createFeatureFlag(createDto);

      expect(featureFlagRepository.findOne).toHaveBeenCalledWith({ key: createDto.key });
      expect(featureFlagRepository.create).toHaveBeenCalledWith({
        ...createDto,
        enabled_ios: true,
        enabled_android: true,
      });
      expect(result).toEqual(mockFeatureFlag);
    });

    it('should throw ConflictException if feature flag already exists', async () => {
      featureFlagRepository.findOne.mockResolvedValue(mockFeatureFlag as any);

      await expect(service.createFeatureFlag(createDto)).rejects.toThrow(ConflictException);
      expect(featureFlagRepository.create).not.toHaveBeenCalled();
    });

    it('should throw InternalServerErrorException on unexpected error', async () => {
      featureFlagRepository.findOne.mockRejectedValue(new Error('Database error'));

      await expect(service.createFeatureFlag(createDto)).rejects.toThrow(InternalServerErrorException);
    });
  });

  describe('getFeatureFlags', () => {
    const query = { enabled: true, search: 'test' };

    it('should return feature flags without overrides when user is not provided', async () => {
      const mockFlags = [mockFeatureFlag];
      const mockQueryBuilder: any = {
        where: jest.fn().mockReturnThis(),
        then: jest.fn((resolve) => resolve(mockFlags)),
      };

      featureFlagRepository.findSync = jest.fn().mockReturnValue(mockQueryBuilder);

      const result = await service.getFeatureFlags(mockUser, query);

      expect(result).toEqual(mockFlags);
      expect(mockQueryBuilder.where).toHaveBeenCalledWith('enabled', true);
      expect(mockQueryBuilder.where).toHaveBeenCalledWith('key', 'like', '%test%');
    });

    it('should return empty array when no feature flags exist', async () => {
      const mockQueryBuilder: any = {
        where: jest.fn().mockReturnThis(),
        then: jest.fn((resolve) => resolve([])),
      };

      featureFlagRepository.findSync = jest.fn().mockReturnValue(mockQueryBuilder);

      const result = await service.getFeatureFlags(mockUser, query);

      expect(result).toEqual([]);
      expect(featureFlagOverrideRepository.findSync).not.toHaveBeenCalled();
    });

    it('should apply user overrides to feature flags', async () => {
      const mockFlags = [
        { ...mockFeatureFlag, id: 'flag-1', key: 'feature1', enabled: true },
        { ...mockFeatureFlag, id: 'flag-2', key: 'feature2', enabled: false },
      ];
      const mockOverrides = [{ feature_flag_id: 'flag-1', user_id: 'user-123', enabled: false }];

      const mockFlagQueryBuilder: any = {
        where: jest.fn().mockReturnThis(),
        then: jest.fn((resolve) => resolve(mockFlags)),
      };

      const mockOverrideQueryBuilder: any = {
        whereIn: jest.fn().mockReturnThis(),
        then: jest.fn((resolve) => resolve(mockOverrides)),
      };

      featureFlagRepository.findSync = jest.fn().mockReturnValue(mockFlagQueryBuilder);
      featureFlagOverrideRepository.findSync = jest.fn().mockReturnValue(mockOverrideQueryBuilder);

      const result = await service.getFeatureFlags(mockUser, query);

      expect(result[0].enabled).toBe(false);
      expect(result[1].enabled).toBe(false);
      expect(mockOverrideQueryBuilder.whereIn).toHaveBeenCalledWith('feature_flag_id', ['flag-1', 'flag-2']);
    });

    it('should evaluate feature flags for iOS platform', async () => {
      const mockFlags = [
        { ...mockFeatureFlag, id: 'flag-1', enabled: true, enabled_ios: true, enabled_android: false },
        { ...mockFeatureFlag, id: 'flag-2', enabled: true, enabled_ios: false, enabled_android: true },
      ];

      const mockFlagQueryBuilder: any = {
        where: jest.fn().mockReturnThis(),
        then: jest.fn((resolve) => resolve(mockFlags)),
      };

      const mockOverrideQueryBuilder: any = {
        whereIn: jest.fn().mockReturnThis(),
        then: jest.fn((resolve) => resolve([])),
      };

      featureFlagRepository.findSync = jest.fn().mockReturnValue(mockFlagQueryBuilder);
      featureFlagOverrideRepository.findSync = jest.fn().mockReturnValue(mockOverrideQueryBuilder);

      const result = await service.getFeatureFlags(mockUser, query, Platform.IOS);

      expect(result[0].enabled).toBe(true);
      expect(result[1].enabled).toBe(false);
    });

    it('should evaluate feature flags for Android platform', async () => {
      const mockFlags = [
        { ...mockFeatureFlag, id: 'flag-1', enabled: true, enabled_ios: true, enabled_android: false },
        { ...mockFeatureFlag, id: 'flag-2', enabled: true, enabled_ios: false, enabled_android: true },
      ];

      const mockFlagQueryBuilder: any = {
        where: jest.fn().mockReturnThis(),
        then: jest.fn((resolve) => resolve(mockFlags)),
      };

      const mockOverrideQueryBuilder: any = {
        whereIn: jest.fn().mockReturnThis(),
        then: jest.fn((resolve) => resolve([])),
      };

      featureFlagRepository.findSync = jest.fn().mockReturnValue(mockFlagQueryBuilder);
      featureFlagOverrideRepository.findSync = jest.fn().mockReturnValue(mockOverrideQueryBuilder);

      const result = await service.getFeatureFlags(mockUser, query, Platform.ANDROID);

      expect(result[0].enabled).toBe(false);
      expect(result[1].enabled).toBe(true);
    });

    it('should prioritize user overrides over platform evaluation', async () => {
      const mockFlags = [{ ...mockFeatureFlag, id: 'flag-1', enabled: true, enabled_ios: true, enabled_android: true }];
      const mockOverrides = [{ feature_flag_id: 'flag-1', user_id: 'user-123', enabled: false }];

      const mockFlagQueryBuilder: any = {
        where: jest.fn().mockReturnThis(),
        then: jest.fn((resolve) => resolve(mockFlags)),
      };

      const mockOverrideQueryBuilder: any = {
        whereIn: jest.fn().mockReturnThis(),
        then: jest.fn((resolve) => resolve(mockOverrides)),
      };

      featureFlagRepository.findSync = jest.fn().mockReturnValue(mockFlagQueryBuilder);
      featureFlagOverrideRepository.findSync = jest.fn().mockReturnValue(mockOverrideQueryBuilder);

      const result = await service.getFeatureFlags(mockUser, query, Platform.IOS);

      expect(result[0].enabled).toBe(false);
    });

    it('should use platform from query if provided', async () => {
      const mockFlags = [
        { ...mockFeatureFlag, id: 'flag-1', enabled: true, enabled_ios: true, enabled_android: false },
      ];

      const mockFlagQueryBuilder: any = {
        where: jest.fn().mockReturnThis(),
        then: jest.fn((resolve) => resolve(mockFlags)),
      };

      const mockOverrideQueryBuilder: any = {
        whereIn: jest.fn().mockReturnThis(),
        then: jest.fn((resolve) => resolve([])),
      };

      featureFlagRepository.findSync = jest.fn().mockReturnValue(mockFlagQueryBuilder);
      featureFlagOverrideRepository.findSync = jest.fn().mockReturnValue(mockOverrideQueryBuilder);

      const result = await service.getFeatureFlags(mockUser, { ...query, platform: Platform.ANDROID });

      expect(result[0].enabled).toBe(false);
    });

    it('should handle query without filters', async () => {
      const mockFlags = [mockFeatureFlag];
      const mockQueryBuilder: any = {
        where: jest.fn().mockReturnThis(),
        then: jest.fn((resolve) => resolve(mockFlags)),
      };

      featureFlagRepository.findSync = jest.fn().mockReturnValue(mockQueryBuilder);

      const result = await service.getFeatureFlags(mockUser, {});

      expect(result).toEqual(mockFlags);
      expect(mockQueryBuilder.where).not.toHaveBeenCalled();
    });

    it('should throw InternalServerErrorException on error', async () => {
      const mockQueryBuilder: any = {
        where: jest.fn().mockReturnThis(),
        then: jest.fn((_, reject) => reject(new Error('Database error'))),
      };

      featureFlagRepository.findSync = jest.fn().mockReturnValue(mockQueryBuilder);

      await expect(service.getFeatureFlags(mockUser, query)).rejects.toThrow(InternalServerErrorException);
    });
  });

  describe('getFeatureFlagByKey', () => {
    it('should return feature flag when found', async () => {
      featureFlagRepository.findOne.mockResolvedValue(mockFeatureFlag as any);

      const result = await service.getFeatureFlagByKey('test_feature');

      expect(featureFlagRepository.findOne).toHaveBeenCalledWith({ key: 'test_feature' });
      expect(result).toEqual(mockFeatureFlag);
    });

    it('should evaluate feature flag for iOS platform', async () => {
      const flag = { ...mockFeatureFlag, enabled: true, enabled_ios: true, enabled_android: false };
      featureFlagRepository.findOne.mockResolvedValue(flag as any);

      const result = await service.getFeatureFlagByKey('test_feature', Platform.IOS);

      expect(result.enabled).toBe(true);
    });

    it('should evaluate feature flag for Android platform', async () => {
      const flag = { ...mockFeatureFlag, enabled: true, enabled_ios: true, enabled_android: false };
      featureFlagRepository.findOne.mockResolvedValue(flag as any);

      const result = await service.getFeatureFlagByKey('test_feature', Platform.ANDROID);

      expect(result.enabled).toBe(false);
    });

    it('should return original enabled value when platform not provided', async () => {
      const flag = { ...mockFeatureFlag, enabled: true, enabled_ios: false, enabled_android: true };
      featureFlagRepository.findOne.mockResolvedValue(flag as any);

      const result = await service.getFeatureFlagByKey('test_feature');

      expect(result.enabled).toBe(true);
    });

    it('should throw NotFoundException when feature flag not found', async () => {
      featureFlagRepository.findOne.mockResolvedValue(null);

      await expect(service.getFeatureFlagByKey('nonexistent')).rejects.toThrow(NotFoundException);
    });

    it('should throw InternalServerErrorException on unexpected error', async () => {
      featureFlagRepository.findOne.mockRejectedValue(new Error('Database error'));

      await expect(service.getFeatureFlagByKey('test_feature')).rejects.toThrow(InternalServerErrorException);
    });
  });

  describe('updateFeatureFlag', () => {
    const updateDto = {
      description: 'Updated description',
      enabled: false,
    };

    it('should update feature flag successfully', async () => {
      const updatedFlag = { ...mockFeatureFlag, ...updateDto };
      featureFlagRepository.findOne.mockResolvedValue(mockFeatureFlag as any);
      featureFlagRepository.update.mockResolvedValue(updatedFlag as any);

      const result = await service.updateFeatureFlag('test_feature', updateDto);

      expect(featureFlagRepository.findOne).toHaveBeenCalledWith({ key: 'test_feature' });
      expect(featureFlagRepository.update).toHaveBeenCalledWith(mockFeatureFlag.id, updateDto);
      expect(result).toEqual(updatedFlag);
    });

    it('should throw NotFoundException when feature flag not found', async () => {
      featureFlagRepository.findOne.mockResolvedValue(null);

      await expect(service.updateFeatureFlag('nonexistent', updateDto)).rejects.toThrow(NotFoundException);
      expect(featureFlagRepository.update).not.toHaveBeenCalled();
    });

    it('should throw InternalServerErrorException when update fails', async () => {
      featureFlagRepository.findOne.mockResolvedValue(mockFeatureFlag as any);
      featureFlagRepository.update.mockResolvedValue(null);

      await expect(service.updateFeatureFlag('test_feature', updateDto)).rejects.toThrow(InternalServerErrorException);
    });

    it('should throw InternalServerErrorException on unexpected error', async () => {
      featureFlagRepository.findOne.mockResolvedValue(mockFeatureFlag as any);
      featureFlagRepository.update.mockRejectedValue(new Error('Database error'));

      await expect(service.updateFeatureFlag('test_feature', updateDto)).rejects.toThrow(InternalServerErrorException);
    });
  });

  describe('deleteFeatureFlag', () => {
    it('should delete feature flag successfully', async () => {
      featureFlagRepository.findOne.mockResolvedValue(mockFeatureFlag as any);
      featureFlagRepository.delete.mockResolvedValue(undefined);

      await service.deleteFeatureFlag('test_feature');

      expect(featureFlagRepository.findOne).toHaveBeenCalledWith({ key: 'test_feature' });
      expect(featureFlagRepository.delete).toHaveBeenCalledWith(mockFeatureFlag.id);
    });

    it('should throw NotFoundException when feature flag not found', async () => {
      featureFlagRepository.findOne.mockResolvedValue(null);

      await expect(service.deleteFeatureFlag('nonexistent')).rejects.toThrow(NotFoundException);
      expect(featureFlagRepository.delete).not.toHaveBeenCalled();
    });

    it('should throw InternalServerErrorException on unexpected error', async () => {
      featureFlagRepository.findOne.mockResolvedValue(mockFeatureFlag as any);
      featureFlagRepository.delete.mockRejectedValue(new Error('Database error'));

      await expect(service.deleteFeatureFlag('test_feature')).rejects.toThrow(InternalServerErrorException);
    });
  });

  describe('evaluateFeatureFlagForPlatform', () => {
    it('should return false when base enabled is false', () => {
      const flag = { ...mockFeatureFlag, enabled: false, enabled_ios: true, enabled_android: true };

      expect(service.evaluateFeatureFlagForPlatform(flag as any, Platform.IOS)).toBe(false);
      expect(service.evaluateFeatureFlagForPlatform(flag as any, Platform.ANDROID)).toBe(false);
    });

    it('should return enabled_ios value for iOS platform', () => {
      const flag = { ...mockFeatureFlag, enabled: true, enabled_ios: true, enabled_android: false };

      expect(service.evaluateFeatureFlagForPlatform(flag as any, Platform.IOS)).toBe(true);
    });

    it('should return enabled_android value for Android platform', () => {
      const flag = { ...mockFeatureFlag, enabled: true, enabled_ios: false, enabled_android: true };

      expect(service.evaluateFeatureFlagForPlatform(flag as any, Platform.ANDROID)).toBe(true);
    });

    it('should return false for iOS when enabled_ios is false', () => {
      const flag = { ...mockFeatureFlag, enabled: true, enabled_ios: false, enabled_android: true };

      expect(service.evaluateFeatureFlagForPlatform(flag as any, Platform.IOS)).toBe(false);
    });

    it('should return false for Android when enabled_android is false', () => {
      const flag = { ...mockFeatureFlag, enabled: true, enabled_ios: true, enabled_android: false };

      expect(service.evaluateFeatureFlagForPlatform(flag as any, Platform.ANDROID)).toBe(false);
    });
  });

  describe('createFeatureFlag with platform fields', () => {
    it('should create feature flag with provided platform values', async () => {
      const createDto = {
        key: 'new_feature',
        description: 'New feature',
        enabled: true,
        enabled_ios: false,
        enabled_android: true,
      };

      featureFlagRepository.findOne.mockResolvedValue(null);
      featureFlagRepository.create.mockResolvedValue(mockFeatureFlag as any);

      await service.createFeatureFlag(createDto);

      expect(featureFlagRepository.create).toHaveBeenCalledWith(createDto);
    });

    it('should default platform values to true when not provided', async () => {
      const createDto = {
        key: 'new_feature',
        description: 'New feature',
        enabled: false,
      };

      featureFlagRepository.findOne.mockResolvedValue(null);
      featureFlagRepository.create.mockResolvedValue(mockFeatureFlag as any);

      await service.createFeatureFlag(createDto);

      expect(featureFlagRepository.create).toHaveBeenCalledWith({
        ...createDto,
        enabled_ios: true,
        enabled_android: true,
      });
    });
  });
});
