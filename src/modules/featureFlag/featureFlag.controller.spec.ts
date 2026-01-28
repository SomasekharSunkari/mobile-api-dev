import { Test } from '@nestjs/testing';
import { FeatureFlagController } from './featureFlag.controller';
import { FeatureFlagService } from './featureFlag.service';

describe('FeatureFlagController', () => {
  let controller: FeatureFlagController;
  let featureFlagService: jest.Mocked<FeatureFlagService>;

  const mockFeatureFlag = {
    id: 'flag-123',
    key: 'test_feature',
    description: 'Test feature',
    enabled: true,
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
    const moduleRef = await Test.createTestingModule({
      controllers: [FeatureFlagController],
      providers: [
        {
          provide: FeatureFlagService,
          useValue: {
            createFeatureFlag: jest.fn(),
            getFeatureFlags: jest.fn(),
            getFeatureFlagByKey: jest.fn(),
            updateFeatureFlag: jest.fn(),
            deleteFeatureFlag: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = moduleRef.get<FeatureFlagController>(FeatureFlagController);
    featureFlagService = moduleRef.get(FeatureFlagService);
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

    it('should create a feature flag and return success response', async () => {
      featureFlagService.createFeatureFlag.mockResolvedValue(mockFeatureFlag as any);

      const result = await controller.createFeatureFlag(createDto);

      expect(featureFlagService.createFeatureFlag).toHaveBeenCalledWith(createDto);
      expect(result).toEqual({
        statusCode: 201,
        message: 'Feature flag created successfully',
        data: mockFeatureFlag,
        timestamp: expect.any(String),
      });
    });
  });

  describe('getFeatureFlags', () => {
    const query = { enabled: true, search: 'test' };
    const mockRequest = {
      headers: {},
    } as any;

    it('should return all feature flags with user overrides', async () => {
      const mockFlags = [mockFeatureFlag];
      featureFlagService.getFeatureFlags.mockResolvedValue(mockFlags as any);

      const result = await controller.getFeatureFlags(mockUser, query, mockRequest);

      expect(featureFlagService.getFeatureFlags).toHaveBeenCalledWith(mockUser, query, expect.any(String));
      expect(result).toEqual({
        statusCode: 200,
        message: 'Feature flags retrieved successfully',
        data: mockFlags,
        timestamp: expect.any(String),
      });
    });

    it('should handle empty query parameters', async () => {
      const mockFlags = [mockFeatureFlag];
      featureFlagService.getFeatureFlags.mockResolvedValue(mockFlags as any);

      const result = await controller.getFeatureFlags(mockUser, {}, mockRequest);

      expect(featureFlagService.getFeatureFlags).toHaveBeenCalledWith(mockUser, {}, expect.any(String));
      expect(result).toEqual({
        statusCode: 200,
        message: 'Feature flags retrieved successfully',
        data: mockFlags,
        timestamp: expect.any(String),
      });
    });
  });

  describe('getFeatureFlagByKey', () => {
    it('should return a specific feature flag by key', async () => {
      const mockRequest = {
        headers: {},
      } as any;
      featureFlagService.getFeatureFlagByKey.mockResolvedValue(mockFeatureFlag as any);

      const result = await controller.getFeatureFlagByKey('test_feature', mockRequest);

      expect(featureFlagService.getFeatureFlagByKey).toHaveBeenCalledWith('test_feature', expect.any(String));
      expect(result).toEqual({
        statusCode: 200,
        message: 'Feature flag retrieved successfully',
        data: mockFeatureFlag,
        timestamp: expect.any(String),
      });
    });
  });

  describe('updateFeatureFlag', () => {
    const updateDto = {
      description: 'Updated description',
      enabled: false,
    };

    it('should update a feature flag and return success response', async () => {
      const updatedFlag = { ...mockFeatureFlag, ...updateDto };
      featureFlagService.updateFeatureFlag.mockResolvedValue(updatedFlag as any);

      const result = await controller.updateFeatureFlag('test_feature', updateDto);

      expect(featureFlagService.updateFeatureFlag).toHaveBeenCalledWith('test_feature', updateDto);
      expect(result).toEqual({
        statusCode: 200,
        message: 'Feature flag updated successfully',
        data: updatedFlag,
        timestamp: expect.any(String),
      });
    });
  });

  describe('deleteFeatureFlag', () => {
    it('should delete a feature flag and return success response', async () => {
      featureFlagService.deleteFeatureFlag.mockResolvedValue(undefined);

      const result = await controller.deleteFeatureFlag('test_feature');

      expect(featureFlagService.deleteFeatureFlag).toHaveBeenCalledWith('test_feature');
      expect(result).toEqual({
        statusCode: 200,
        message: 'Feature flag deleted successfully',
        data: undefined,
        timestamp: expect.any(String),
      });
    });
  });
});
