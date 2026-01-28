import { Test } from '@nestjs/testing';
import { FeatureFlagOverrideController } from './featureFlagOverride.controller';
import { FeatureFlagOverrideService } from './featureFlagOverride.service';

describe('FeatureFlagOverrideController', () => {
  let controller: FeatureFlagOverrideController;
  let featureFlagOverrideService: jest.Mocked<FeatureFlagOverrideService>;

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
      controllers: [FeatureFlagOverrideController],
      providers: [
        {
          provide: FeatureFlagOverrideService,
          useValue: {
            createFeatureFlagOverride: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = moduleRef.get<FeatureFlagOverrideController>(FeatureFlagOverrideController);
    featureFlagOverrideService = moduleRef.get(FeatureFlagOverrideService);
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

    it('should create a feature flag override and return success response', async () => {
      featureFlagOverrideService.createFeatureFlagOverride.mockResolvedValue(mockOverride as any);

      const result = await controller.createFeatureFlagOverride(createDto);

      expect(featureFlagOverrideService.createFeatureFlagOverride).toHaveBeenCalledWith(createDto);
      expect(result).toEqual({
        statusCode: 201,
        message: 'Feature flag override created successfully',
        data: mockOverride,
        timestamp: expect.any(String),
      });
    });

    it('should create override without reason when not provided', async () => {
      const dtoWithoutReason = {
        feature_flag_id: 'test_feature',
        user_id: 'user-123',
        enabled: true,
      };

      const overrideWithoutReason = { ...mockOverride, reason: undefined };
      featureFlagOverrideService.createFeatureFlagOverride.mockResolvedValue(overrideWithoutReason as any);

      const result = await controller.createFeatureFlagOverride(dtoWithoutReason);

      expect(featureFlagOverrideService.createFeatureFlagOverride).toHaveBeenCalledWith(dtoWithoutReason);
      expect(result).toEqual({
        statusCode: 201,
        message: 'Feature flag override created successfully',
        data: overrideWithoutReason,
        timestamp: expect.any(String),
      });
    });
  });
});
