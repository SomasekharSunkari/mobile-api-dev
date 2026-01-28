import { BadRequestException, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { KYCAdapter } from '../../../adapters/kyc/kyc-adapter';
import { WidgetKYCInitiateResponse } from '../../../adapters/kyc/kyc-adapter.interface';
import { SumsubAdapter } from '../../../adapters/kyc/sumsub/sumsub.adapter';
import { EnvironmentService } from '../../../config';
import { KycVerificationEnum } from '../../../database/models/kycVerification/kycVerification.interface';
import { KycVerificationModel } from '../../../database/models/kycVerification/kycVerification.model';
import { UserModel } from '../../../database/models/user/user.model';
import { AppLoggerService } from '../../../services/logger/logger.service';
import { TierRepository } from '../../tier/tier.repository';
import { TierConfigService } from '../../tierConfig/tierConfig.service';
import { UserTierRepository } from '../../userTier/userTier.repository';
import { KycStatusLogService } from '../kycStatusLog/kycStatusLog.service';
import { UserRepository } from '../user/user.repository';
import { InitiateWidgetKycDto, SumSubVerificationType } from './dto/generateSumsubAccessToken.dto';
import { RestartKycVerificationDto } from './dto/restartKycVerification.dto';
import { KycVerificationController } from './kycVerification.controller';
import { KycVerificationRepository } from './kycVerification.repository';
import { KycVerificationService } from './kycVerification.service';

describe('KycVerificationController', () => {
  let controller: KycVerificationController;
  let service: KycVerificationService;

  const mockKycVerificationService = {
    findByUserId: jest.fn(),
    initiateWidgetKyc: jest.fn(),
    restartWidgetKyc: jest.fn(),
    moveMetadataAddressToSumsubInfoAddress: jest.fn(),
  };

  const mockAppLoggerService = {
    logInfo: jest.fn(),
    logError: jest.fn(),
    logWarn: jest.fn(),
    logDebug: jest.fn(),
    logUserAction: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [KycVerificationController],
      providers: [
        {
          provide: KycVerificationService,
          useValue: mockKycVerificationService,
        },
        {
          provide: AppLoggerService,
          useValue: mockAppLoggerService,
        },
      ],
    }).compile();

    controller = module.get<KycVerificationController>(KycVerificationController);
    service = module.get<KycVerificationService>(KycVerificationService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getKycStatus', () => {
    const mockRequest = {
      user: { id: 'user-123' },
    };

    const mockKycRecord = {
      id: 'kyc-123',
      user_id: 'user-123',
      status: KycVerificationEnum.APPROVED,
      provider: 'sumsub',
      provider_level: 'id-and-liveness',
      attempt: 1,
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
    };

    it('should return KYC status successfully', async () => {
      mockKycVerificationService.findByUserId.mockResolvedValue(mockKycRecord);

      const result = await controller.getKycStatus(mockRequest as any);

      expect(service.findByUserId).toHaveBeenCalledWith('user-123');
      expect(result).toEqual({
        message: 'KYC status fetched',
        data: mockKycRecord,
        statusCode: 200,
        timestamp: expect.any(String),
      });
    });

    it('should throw BadRequestException when user context is invalid', async () => {
      const invalidRequest = { user: null };

      await expect(controller.getKycStatus(invalidRequest as any)).rejects.toThrow(
        new BadRequestException('Invalid user context'),
      );
    });

    it('should throw BadRequestException when user ID is missing', async () => {
      const invalidRequest = { user: {} };

      await expect(controller.getKycStatus(invalidRequest as any)).rejects.toThrow(
        new BadRequestException('Invalid user context'),
      );
    });

    it('should throw BadRequestException when no KYC record is found', async () => {
      mockKycVerificationService.findByUserId.mockResolvedValue(null);

      await expect(controller.getKycStatus(mockRequest as any)).rejects.toThrow(
        new BadRequestException('No KYC record found for user'),
      );
    });
  });

  describe('generateSumsubAccessToken', () => {
    const mockUser: UserModel = {
      id: 'user-123',
      email: 'test@example.com',
      phone_number: '+1234567890',
      country: { id: 'country-123', code: 'US' },
    } as UserModel;

    const mockDto: InitiateWidgetKycDto = {
      verification_type: SumSubVerificationType.ID_AND_LIVENESS,
    };

    const mockTokenResponse: WidgetKYCInitiateResponse = {
      token: 'mock-access-token',
      userId: 'user-123',
      kycVerificationType: 'id-and-liveness',
    };

    it('should generate Sumsub access token successfully', async () => {
      mockKycVerificationService.initiateWidgetKyc.mockResolvedValue(mockTokenResponse);

      const result = await controller.generateSumsubAccessToken(mockUser, mockDto);

      expect(service.initiateWidgetKyc).toHaveBeenCalledWith('user-123', mockDto);
      expect(result).toEqual({
        message: 'Sumsub access token generated',
        data: mockTokenResponse,
        statusCode: 201,
        timestamp: expect.any(String),
      });
    });
  });

  describe('restartKycVerification', () => {
    const mockUser: UserModel = {
      id: 'user-123',
      email: 'test@example.com',
      phone_number: '+1234567890',
      country: { id: 'country-123', code: 'US' },
    } as UserModel;

    const mockDto = {
      verification_type: SumSubVerificationType.ID_AND_LIVENESS,
    };

    const mockTokenResponse = {
      token: 'mock-access-token',
      userId: 'user-123',
      kycVerificationType: 'id-and-liveness',
    };

    it('should restart KYC verification successfully', async () => {
      mockKycVerificationService.restartWidgetKyc.mockResolvedValue(mockTokenResponse);

      const result = await controller.restartKycVerification(mockUser, mockDto);

      expect(service.restartWidgetKyc).toHaveBeenCalledWith('user-123', mockDto);
      expect(result).toEqual({
        message: 'Sumsub access token generated',
        data: mockTokenResponse,
        statusCode: 201,
        timestamp: expect.any(String),
      });
    });
  });

  describe('moveMetadataAddressToSumsubInfoAddress', () => {
    const mockResult = {
      noOfUsersAffected: 5,
      noOfUsersResolved: 5,
    };

    it('should move metadata address to sumsub info address successfully', async () => {
      mockKycVerificationService.moveMetadataAddressToSumsubInfoAddress.mockResolvedValue(mockResult);

      const result = await controller.moveMetadataAddressToSumsubInfoAddress();

      expect(service.moveMetadataAddressToSumsubInfoAddress).toHaveBeenCalled();
      expect(result).toEqual({
        message: 'Metadata address moved to sumsub info address',
        data: mockResult,
        statusCode: 200,
        timestamp: expect.any(String),
      });
    });
  });
});

describe('KycVerificationService', () => {
  let service: KycVerificationService;
  let kycVerificationRepository: KycVerificationRepository;
  let kycAdapter: KYCAdapter;
  let kycStatusLogService: KycStatusLogService;
  let userRepository: UserRepository;

  const mockKycVerificationRepository = {
    findByUserId: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    transaction: jest.fn(),
    query: jest.fn().mockReturnValue({
      findOne: jest.fn(),
    }),
  } as any;

  const mockKycAdapter = {
    initiateWidgetKyc: jest.fn(),
    getProviderName: jest.fn(),
    resetApplicant: jest.fn(),
    updateApplicantTaxInfo: jest.fn(),
  };

  const mockSumsubAdapter = {
    getKycDetailsByUserIdWithTransform: jest.fn(),
    updateApplicantFixedInfo: jest.fn(),
  };

  const mockKycStatusLogService = {
    logStatusChange: jest.fn(),
  };

  const mockUserRepository = {
    findById: jest.fn(),
  };

  const mockTierConfigService = {
    findOne: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    mapSumsubVerificationTypeToTierLevel: jest.fn().mockReturnValue(1),
    isTierOneVerification: jest.fn().mockReturnValue(true),
    getTierConfigsByVerificationType: jest.fn().mockResolvedValue({
      tier_configs: [
        {
          id: 'TIER_CFG_1',
          country_id: 'country-123',
          level: 1,
          name: 'Basic',
          status: 'active',
        },
      ],
      pagination: {
        current_page: 1,
        next_page: 0,
        previous_page: 0,
        page_count: 1,
        total: 1,
      },
    }),
  } as any;

  const mockTierRepository = {
    query: jest.fn(),
  } as any;

  const mockUserTierRepository = {
    createIfNotExists: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  } as any;

  beforeEach(async () => {
    jest.spyOn(EnvironmentService, 'isDevelopment').mockReturnValue(false);
    jest.spyOn(EnvironmentService, 'getValue').mockReturnValue('3000');
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        KycVerificationService,
        {
          provide: KycVerificationRepository,
          useValue: mockKycVerificationRepository,
        },
        {
          provide: KYCAdapter,
          useValue: mockKycAdapter,
        },
        {
          provide: KycStatusLogService,
          useValue: mockKycStatusLogService,
        },
        {
          provide: UserRepository,
          useValue: mockUserRepository,
        },
        {
          provide: TierConfigService,
          useValue: mockTierConfigService,
        },
        {
          provide: TierRepository,
          useValue: mockTierRepository,
        },
        {
          provide: UserTierRepository,
          useValue: mockUserTierRepository,
        },
        {
          provide: SumsubAdapter,
          useValue: mockSumsubAdapter,
        },
      ],
    }).compile();

    service = module.get<KycVerificationService>(KycVerificationService);
    kycVerificationRepository = module.get<KycVerificationRepository>(KycVerificationRepository);
    kycAdapter = module.get<KYCAdapter>(KYCAdapter);
    kycStatusLogService = module.get<KycStatusLogService>(KycStatusLogService);
    userRepository = module.get<UserRepository>(UserRepository);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('findByUserId', () => {
    it('should return KYC verification record by user ID', async () => {
      const mockKycRecord = {
        id: 'kyc-123',
        user_id: 'user-123',
        status: KycVerificationEnum.APPROVED,
      } as KycVerificationModel;

      mockKycVerificationRepository.findByUserId.mockResolvedValue(mockKycRecord);

      const result = await service.findByUserId('user-123');

      expect(kycVerificationRepository.findByUserId).toHaveBeenCalledWith('user-123');
      expect(result).toEqual(mockKycRecord);
    });

    it('should return undefined when no KYC record is found', async () => {
      mockKycVerificationRepository.findByUserId.mockResolvedValue(undefined);

      const result = await service.findByUserId('user-123');

      expect(result).toBeUndefined();
    });
  });

  describe('updateKycStatus', () => {
    it('should update KYC status successfully', async () => {
      const updates = { status: KycVerificationEnum.APPROVED };
      const mockTransaction = {};

      await service.updateKycStatus('kyc-123', updates, mockTransaction as any);

      expect(kycVerificationRepository.update).toHaveBeenCalledWith('kyc-123', updates, {
        trx: mockTransaction,
      });
    });
  });

  describe('initiateWidgetKyc', () => {
    const userId = 'user-123';
    const dto: InitiateWidgetKycDto = {
      verification_type: SumSubVerificationType.ID_AND_LIVENESS,
    };

    const mockUser: UserModel = {
      id: 'user-123',
      email: 'test@example.com',
      phone_number: '+1234567890',
      country_id: 'country-123',
      country: { id: 'country-123', code: 'US' },
    } as unknown as UserModel;

    const mockWidgetResponse: WidgetKYCInitiateResponse = {
      token: 'mock-access-token',
      userId: 'user-123',
      kycVerificationType: 'id-and-liveness',
    };

    const mockKycRecord = {
      id: 'kyc-123',
      user_id: 'user-123',
      status: KycVerificationEnum.PENDING,
      attempt: 1,
    } as KycVerificationModel;

    beforeEach(() => {
      mockUserRepository.findById.mockResolvedValue(mockUser);
      mockKycAdapter.getProviderName.mockReturnValue('sumsub');
      mockKycVerificationRepository.findOne.mockReset();
      mockKycVerificationRepository.create.mockReset();
      mockKycVerificationRepository.update.mockReset();
      mockKycVerificationRepository.transaction.mockReset();
      mockKycVerificationRepository.query.mockImplementation(() => ({
        findOne: jest.fn().mockResolvedValue(undefined),
      }));

      // Setup tier repository query chain
      const mockTierOne = {
        id: 'tier-1',
        level: 1,
        name: 'Basic Tier',
        tierConfigs: [
          {
            id: 'config-1',
            tier_id: 'tier-1',
            country_id: 'country-123',
            name: 'Basic Config',
            status: 'active',
            tierConfigVerificationRequirements: [
              {
                id: 'req-1',
                tier_config_id: 'config-1',
                verification_requirement_id: 'vr-1',
                is_required: true,
              },
            ],
          },
        ],
      };

      const mockTierTwo = {
        id: 'tier-2',
        level: 2,
        name: 'Advanced Tier',
        tierConfigs: [
          {
            id: 'config-2',
            tier_id: 'tier-2',
            country_id: 'country-123',
            name: 'Advanced Config',
            status: 'active',
            tierConfigVerificationRequirements: [
              {
                id: 'req-2',
                tier_config_id: 'config-2',
                verification_requirement_id: 'vr-2',
                is_required: true,
              },
            ],
          },
        ],
      };

      mockTierRepository.query.mockImplementation(() => ({
        findOne: jest.fn().mockImplementation((criteria: any) => {
          let tierData = mockTierOne;
          if (criteria.level === 2) {
            tierData = mockTierTwo;
          }
          return {
            withGraphFetched: jest.fn().mockResolvedValue(tierData),
          };
        }),
      }));
    });

    it('should initiate widget KYC for new user successfully', async () => {
      mockKycAdapter.initiateWidgetKyc.mockResolvedValue(mockWidgetResponse);
      mockKycVerificationRepository.query.mockImplementation(() => ({
        findOne: jest.fn().mockResolvedValue(undefined),
      }));
      mockKycVerificationRepository.create.mockResolvedValue(mockKycRecord);
      mockKycVerificationRepository.transaction.mockImplementation(async (callback: any) => {
        const trx = {};
        return await callback(trx);
      });

      const result = await service.initiateWidgetKyc(userId, dto);

      expect(userRepository.findById).toHaveBeenCalledWith(userId, '[country]');
      expect(kycAdapter.initiateWidgetKyc).toHaveBeenCalledWith({
        userId,
        email: mockUser.email,
        phoneNumber: mockUser.phone_number,
        kycVerificationType: dto.verification_type,
      });
      expect(kycVerificationRepository.query).toHaveBeenCalled();
      expect(kycVerificationRepository.create).toHaveBeenCalled();
      expect(kycVerificationRepository.transaction).toHaveBeenCalled();
      expect(result).toEqual({
        token: mockWidgetResponse.token,
        userId: mockWidgetResponse.userId,
        kycVerificationType: mockWidgetResponse.kycVerificationType,
        verificationUrl: undefined,
      });
    });

    it('should update existing KYC record when user already has one', async () => {
      const existingKycRecord = {
        id: 'kyc-123',
        user_id: 'user-123',
        status: KycVerificationEnum.REJECTED,
        attempt: 2,
      } as KycVerificationModel;

      const updatedKycRecord = {
        ...existingKycRecord,
        status: KycVerificationEnum.PENDING,
        attempt: 3,
      };

      mockKycAdapter.initiateWidgetKyc.mockResolvedValue(mockWidgetResponse);
      mockKycVerificationRepository.query.mockImplementation(() => ({
        findOne: jest.fn().mockResolvedValue(existingKycRecord),
      }));
      mockKycVerificationRepository.update.mockResolvedValue(updatedKycRecord);
      mockKycVerificationRepository.transaction.mockImplementation(async (callback: any) => {
        const trx = {};
        return await callback(trx);
      });

      const result = await service.initiateWidgetKyc(userId, dto);

      expect(userRepository.findById).toHaveBeenCalledWith(userId, '[country]');

      expect(kycVerificationRepository.update).toHaveBeenCalledWith(
        existingKycRecord.id,
        {
          status: KycVerificationEnum.PENDING,
          provider_verification_type: mockWidgetResponse.kycVerificationType,
          attempt: 3,
        },
        { trx: expect.any(Object) },
      );
      expect(kycStatusLogService.logStatusChange).toHaveBeenCalledWith(
        existingKycRecord.id,
        existingKycRecord.status,
        KycVerificationEnum.PENDING,
        'User restarted KYC process.',
        expect.any(Object),
      );
      expect(result).toEqual({
        token: mockWidgetResponse.token,
        userId: mockWidgetResponse.userId,
        kycVerificationType: mockWidgetResponse.kycVerificationType,
        verificationUrl: undefined,
      });
    });

    it('should throw InternalServerErrorException when repository operations fail', async () => {
      const error = new Error('Database error');
      mockKycAdapter.initiateWidgetKyc.mockResolvedValue(mockWidgetResponse);
      mockKycVerificationRepository.findOne.mockResolvedValue(undefined);
      mockKycVerificationRepository.transaction.mockRejectedValue(error);

      await expect(service.initiateWidgetKyc(userId, dto)).rejects.toThrow(
        new InternalServerErrorException('Database error'),
      );
    });

    it('should throw NotFoundException when user is not found', async () => {
      mockUserRepository.findById.mockResolvedValue(null);

      await expect(service.initiateWidgetKyc(userId, dto)).rejects.toThrow(NotFoundException);
      await expect(service.initiateWidgetKyc(userId, dto)).rejects.toThrow('User not found');
    });

    it('should throw BadRequestException when widget KYC returns no token', async () => {
      mockKycAdapter.initiateWidgetKyc.mockResolvedValue({ ...mockWidgetResponse, token: null });

      await expect(service.initiateWidgetKyc(userId, dto)).rejects.toThrow(BadRequestException);
      await expect(service.initiateWidgetKyc(userId, dto)).rejects.toThrow(
        'Failed to initiate KYC Process: Invalid token',
      );
    });

    it('should throw NotFoundException when tier configuration is not found', async () => {
      mockTierRepository.query.mockImplementation(() => ({
        findOne: jest.fn().mockImplementation(() => ({
          withGraphFetched: jest.fn().mockResolvedValue(null),
        })),
      }));

      await expect(service.initiateWidgetKyc(userId, dto)).rejects.toThrow(NotFoundException);
      await expect(service.initiateWidgetKyc(userId, dto)).rejects.toThrow('Tier configuration not found');
    });

    it('should skip tier configs that do not match user country', async () => {
      const mockTierOne = {
        id: 'tier-1',
        level: 1,
        name: 'Basic Tier',
        tierConfigs: [
          {
            id: 'config-1',
            tier_id: 'tier-1',
            country_id: 'different-country',
            name: 'Basic Config',
            status: 'active',
            tierConfigVerificationRequirements: [
              {
                id: 'req-1',
                tier_config_id: 'config-1',
                verification_requirement_id: 'vr-1',
                is_required: true,
              },
            ],
          },
        ],
      };

      mockTierRepository.query.mockImplementation(() => ({
        findOne: jest.fn().mockImplementation(() => ({
          withGraphFetched: jest.fn().mockResolvedValue(mockTierOne),
        })),
      }));

      mockKycAdapter.initiateWidgetKyc.mockResolvedValue(mockWidgetResponse);
      mockKycVerificationRepository.transaction.mockImplementation(async (callback: any) => {
        const trx = {};
        return await callback(trx);
      });

      const result = await service.initiateWidgetKyc(userId, dto);

      expect(result.token).toBe(mockWidgetResponse.token);
      expect(kycVerificationRepository.create).not.toHaveBeenCalled();
    });

    it('should handle tier configs with no verification requirements', async () => {
      const mockTierOne = {
        id: 'tier-1',
        level: 1,
        name: 'Basic Tier',
        tierConfigs: [
          {
            id: 'config-1',
            tier_id: 'tier-1',
            country_id: 'country-123',
            name: 'Basic Config',
            status: 'active',
            tierConfigVerificationRequirements: [],
          },
        ],
      };

      mockTierRepository.query.mockImplementation(() => ({
        findOne: jest.fn().mockImplementation(() => ({
          withGraphFetched: jest.fn().mockResolvedValue(mockTierOne),
        })),
      }));

      mockKycAdapter.initiateWidgetKyc.mockResolvedValue(mockWidgetResponse);
      mockKycVerificationRepository.transaction.mockImplementation(async (callback: any) => {
        const trx = {};
        return await callback(trx);
      });

      const result = await service.initiateWidgetKyc(userId, dto);

      expect(result.token).toBe(mockWidgetResponse.token);
      expect(kycVerificationRepository.create).not.toHaveBeenCalled();
    });

    it('should skip creating KYC verification records for tier-two-verification', async () => {
      const tierTwoDto: InitiateWidgetKycDto = {
        verification_type: 'tier-two-verification' as SumSubVerificationType,
      };

      const mockTierTwoResponse: WidgetKYCInitiateResponse = {
        token: 'mock-tier-two-token',
        userId: 'user-123',
        kycVerificationType: 'tier-two-verification',
      };

      const mockTierTwo = {
        id: 'tier-2',
        level: 2,
        name: 'Advanced Tier',
        tierConfigs: [
          {
            id: 'config-2',
            tier_id: 'tier-2',
            country_id: 'country-123',
            name: 'Advanced Config',
            status: 'active',
            tierConfigVerificationRequirements: [
              {
                id: 'req-2',
                tier_config_id: 'config-2',
                verification_requirement_id: 'vr-2',
                is_required: true,
              },
            ],
          },
        ],
      };

      mockTierRepository.query.mockImplementation(() => ({
        findOne: jest.fn().mockImplementation(() => ({
          withGraphFetched: jest.fn().mockResolvedValue(mockTierTwo),
        })),
      }));

      mockKycAdapter.initiateWidgetKyc.mockResolvedValue(mockTierTwoResponse);

      const result = await service.initiateWidgetKyc(userId, tierTwoDto);

      expect(userRepository.findById).toHaveBeenCalledWith(userId, '[country]');
      expect(kycAdapter.initiateWidgetKyc).toHaveBeenCalledWith({
        userId,
        email: mockUser.email,
        phoneNumber: mockUser.phone_number,
        kycVerificationType: tierTwoDto.verification_type,
      });
      expect(kycVerificationRepository.transaction).not.toHaveBeenCalled();
      expect(kycVerificationRepository.create).not.toHaveBeenCalled();
      expect(result).toEqual({
        token: mockTierTwoResponse.token,
        userId: mockTierTwoResponse.userId,
        kycVerificationType: mockTierTwoResponse.kycVerificationType,
        verificationUrl: undefined,
      });
    });

    it('should include verificationUrl when isDevelopment is true', async () => {
      jest.spyOn(EnvironmentService, 'isDevelopment').mockReturnValue(true);
      jest.spyOn(EnvironmentService, 'getValue').mockReturnValue('3000');

      mockKycAdapter.initiateWidgetKyc.mockResolvedValue(mockWidgetResponse);
      mockKycVerificationRepository.create.mockResolvedValue(mockKycRecord);
      mockKycVerificationRepository.transaction.mockImplementation(async (callback: any) => {
        const trx = {};
        return await callback(trx);
      });

      const result = await service.initiateWidgetKyc(userId, dto);

      expect(result.verificationUrl).toBe(
        `http://localhost:3000/views/sumsub/verification?accessToken=${mockWidgetResponse.token}`,
      );
    });
  });

  describe('findUserKycVerifications', () => {
    it('should return paginated KYC verifications for a user', async () => {
      const mockKycRecords = {
        kyc_verifications: [
          {
            id: 'kyc-1',
            user_id: 'user-123',
            status: KycVerificationEnum.APPROVED,
          },
          {
            id: 'kyc-2',
            user_id: 'user-123',
            status: KycVerificationEnum.PENDING,
          },
        ],
        pagination: {
          current_page: 1,
          next_page: 0,
          previous_page: 0,
          limit: 10,
          page_count: 1,
          total: 2,
        },
      };

      mockKycVerificationRepository.findAll = jest.fn().mockResolvedValue(mockKycRecords);

      const result = await service.findUserKycVerifications('user-123');

      expect(kycVerificationRepository.findAll).toHaveBeenCalledWith({ user_id: 'user-123' });
      expect(result).toEqual(mockKycRecords);
    });
  });

  describe('ensureUserTierRecord', () => {
    const mockKycVerification = {
      id: 'kyc-123',
      user_id: 'user-123',
      tier_config_id: 'tier-config-1',
      status: KycVerificationEnum.APPROVED,
    } as KycVerificationModel;

    it('should create user tier record when tier config is found', async () => {
      const mockTierConfig = {
        id: 'tier-config-1',
        tier_id: 'tier-1',
      };

      mockTierConfigService.findOne.mockResolvedValue(mockTierConfig);
      mockUserTierRepository.createIfNotExists.mockResolvedValue({});

      await service.ensureUserTierRecord(mockKycVerification);

      expect(mockTierConfigService.findOne).toHaveBeenCalledWith('tier-config-1');
      expect(mockUserTierRepository.createIfNotExists).toHaveBeenCalledWith('user-123', 'tier-1');
    });

    it('should skip when KYC verification has no tier_config_id', async () => {
      const kycWithoutTierConfig = {
        ...mockKycVerification,
        tier_config_id: null,
      } as KycVerificationModel;

      await service.ensureUserTierRecord(kycWithoutTierConfig);

      expect(mockTierConfigService.findOne).not.toHaveBeenCalled();
      expect(mockUserTierRepository.createIfNotExists).not.toHaveBeenCalled();
    });

    it('should skip when tier config is not found', async () => {
      mockTierConfigService.findOne.mockResolvedValue(null);

      await service.ensureUserTierRecord(mockKycVerification);

      expect(mockTierConfigService.findOne).toHaveBeenCalledWith('tier-config-1');
      expect(mockUserTierRepository.createIfNotExists).not.toHaveBeenCalled();
    });

    it('should handle errors gracefully and not throw', async () => {
      mockTierConfigService.findOne.mockRejectedValue(new Error('Database error'));

      await expect(service.ensureUserTierRecord(mockKycVerification)).resolves.not.toThrow();
    });
  });

  describe('getRecentKycStatus', () => {
    it('should return the most recent KYC status with highest tier level', async () => {
      const mockKycRecords = [
        {
          tier_config_id: 'tier-config-1',
          status: KycVerificationEnum.APPROVED,
          latest_created_at: '2024-01-15',
          tierConfig: {
            id: 'tier-config-1',
            tier_id: 'tier-1',
            tier: {
              id: 'tier-1',
              level: 1,
              name: 'Basic',
            },
          },
        },
        {
          tier_config_id: 'tier-config-2',
          status: KycVerificationEnum.PENDING,
          latest_created_at: '2024-01-20',
          tierConfig: {
            id: 'tier-config-2',
            tier_id: 'tier-2',
            tier: {
              id: 'tier-2',
              level: 2,
              name: 'Advanced',
            },
          },
        },
      ];

      mockKycVerificationRepository.query.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        max: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        groupBy: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        withGraphFetched: jest.fn().mockResolvedValue(mockKycRecords),
      });

      const result = await service.getRecentKycStatus('user-123');

      expect(result).toEqual({
        tier_level: 2,
        status: KycVerificationEnum.PENDING,
      });
    });

    it('should handle single KYC record', async () => {
      const mockKycRecords = [
        {
          tier_config_id: 'tier-config-1',
          status: KycVerificationEnum.APPROVED,
          latest_created_at: '2024-01-15',
          tierConfig: {
            id: 'tier-config-1',
            tier_id: 'tier-1',
            tier: {
              id: 'tier-1',
              level: 1,
              name: 'Basic',
            },
          },
        },
      ];

      mockKycVerificationRepository.query.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        max: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        groupBy: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        withGraphFetched: jest.fn().mockResolvedValue(mockKycRecords),
      });

      const result = await service.getRecentKycStatus('user-123');

      expect(result).toEqual({
        tier_level: 1,
        status: KycVerificationEnum.APPROVED,
      });
    });

    it('should return default tier level 1 and NOT_STARTED status when no KYC records exist', async () => {
      mockKycVerificationRepository.query.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        max: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        groupBy: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        withGraphFetched: jest.fn().mockResolvedValue([]),
      });

      const result = await service.getRecentKycStatus('user-123');

      expect(result).toEqual({
        tier_level: 1,
        status: KycVerificationEnum.NOT_STARTED,
      });
    });

    it('should handle KYC records with missing tier config data', async () => {
      const mockKycRecords = [
        {
          tier_config_id: 'tier-config-1',
          status: KycVerificationEnum.APPROVED,
          latest_created_at: '2024-01-15',
          tierConfig: null,
        },
      ];

      mockKycVerificationRepository.query.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        max: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        groupBy: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        withGraphFetched: jest.fn().mockResolvedValue(mockKycRecords),
      });

      const result = await service.getRecentKycStatus('user-123');

      expect(result).toEqual({
        tier_level: undefined,
        status: KycVerificationEnum.APPROVED,
      });
    });

    it('should sort by highest tier level when multiple tiers exist', async () => {
      const mockKycRecords = [
        {
          tier_config_id: 'tier-config-3',
          status: KycVerificationEnum.REJECTED,
          latest_created_at: '2024-01-10',
          tierConfig: {
            id: 'tier-config-3',
            tier_id: 'tier-3',
            tier: {
              id: 'tier-3',
              level: 3,
              name: 'Premium',
            },
          },
        },
        {
          tier_config_id: 'tier-config-1',
          status: KycVerificationEnum.APPROVED,
          latest_created_at: '2024-01-15',
          tierConfig: {
            id: 'tier-config-1',
            tier_id: 'tier-1',
            tier: {
              id: 'tier-1',
              level: 1,
              name: 'Basic',
            },
          },
        },
        {
          tier_config_id: 'tier-config-2',
          status: KycVerificationEnum.PENDING,
          latest_created_at: '2024-01-20',
          tierConfig: {
            id: 'tier-config-2',
            tier_id: 'tier-2',
            tier: {
              id: 'tier-2',
              level: 2,
              name: 'Advanced',
            },
          },
        },
      ];

      mockKycVerificationRepository.query.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        max: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        groupBy: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        withGraphFetched: jest.fn().mockResolvedValue(mockKycRecords),
      });

      const result = await service.getRecentKycStatus('user-123');

      expect(result).toEqual({
        tier_level: 3,
        status: KycVerificationEnum.REJECTED,
      });
    });
  });

  describe('restartWidgetKyc', () => {
    const userId = 'user-123';
    const dto: RestartKycVerificationDto = {
      verification_type: SumSubVerificationType.ID_AND_LIVENESS,
    };

    const mockUser: UserModel = {
      id: 'user-123',
      email: 'test@example.com',
      phone_number: '+1234567890',
      country_id: 'country-123',
      country: { id: 'country-123', code: 'US' },
    } as unknown as UserModel;

    const mockWidgetResponse = {
      token: 'mock-access-token',
      userId: 'user-123',
      kycVerificationType: 'id-and-liveness',
    };

    const mockKycRecord = {
      id: 'kyc-123',
      user_id: 'user-123',
      status: KycVerificationEnum.PENDING,
      provider_ref: 'applicant-123',
      attempt: 1,
    } as KycVerificationModel;

    beforeEach(() => {
      jest.spyOn(EnvironmentService, 'isDevelopment').mockReturnValue(false);
      mockUserRepository.findById.mockResolvedValue(mockUser);
      mockKycAdapter.resetApplicant.mockResolvedValue(undefined);
      mockKycAdapter.updateApplicantTaxInfo.mockResolvedValue(undefined);
    });

    it('should restart widget KYC successfully', async () => {
      mockKycVerificationRepository.query.mockReturnValue({
        where: jest.fn().mockResolvedValue([mockKycRecord]),
      });
      mockKycAdapter.initiateWidgetKyc.mockResolvedValue(mockWidgetResponse);

      const result = await service.restartWidgetKyc(userId, dto);

      expect(userRepository.findById).toHaveBeenCalledWith(userId, '[country]');
      expect(kycVerificationRepository.query).toHaveBeenCalled();
      expect(mockKycAdapter.resetApplicant).toHaveBeenCalledWith({ applicantId: 'applicant-123' });
      expect(mockKycAdapter.updateApplicantTaxInfo).toHaveBeenCalledWith({
        applicantId: 'applicant-123',
        tin: '',
      });
      expect(kycAdapter.initiateWidgetKyc).toHaveBeenCalledWith({
        userId,
        email: mockUser.email,
        phoneNumber: mockUser.phone_number,
        kycVerificationType: dto.verification_type,
      });
      expect(result).toEqual({
        token: mockWidgetResponse.token,
        userId: mockWidgetResponse.userId,
        kycVerificationType: mockWidgetResponse.kycVerificationType,
        verificationUrl: undefined,
      });
    });

    it('should throw NotFoundException when user is not found', async () => {
      mockUserRepository.findById.mockResolvedValue(null);

      await expect(service.restartWidgetKyc(userId, dto)).rejects.toThrow(NotFoundException);
      await expect(service.restartWidgetKyc(userId, dto)).rejects.toThrow('User not found');
    });

    it('should throw NotFoundException when no KYC verification records found', async () => {
      mockKycVerificationRepository.query.mockReturnValue({
        where: jest.fn().mockResolvedValue([]),
      });

      await expect(service.restartWidgetKyc(userId, dto)).rejects.toThrow(NotFoundException);
      await expect(service.restartWidgetKyc(userId, dto)).rejects.toThrow('No KYC verification records found for user');
    });

    it('should throw BadRequestException when user has approved KYC verification', async () => {
      const approvedKycRecord = {
        ...mockKycRecord,
        status: KycVerificationEnum.APPROVED,
      };

      mockKycVerificationRepository.query.mockReturnValue({
        where: jest.fn().mockResolvedValue([approvedKycRecord]),
      });

      await expect(service.restartWidgetKyc(userId, dto)).rejects.toThrow(BadRequestException);
      await expect(service.restartWidgetKyc(userId, dto)).rejects.toThrow(
        'Cannot restart KYC process: User has approved KYC verification',
      );
    });

    it('should throw BadRequestException when no provider reference found', async () => {
      const kycRecordWithoutRef = {
        ...mockKycRecord,
        provider_ref: null,
      };

      mockKycVerificationRepository.query.mockReturnValue({
        where: jest.fn().mockResolvedValue([kycRecordWithoutRef]),
      });

      await expect(service.restartWidgetKyc(userId, dto)).rejects.toThrow(BadRequestException);
      await expect(service.restartWidgetKyc(userId, dto)).rejects.toThrow(
        'No provider reference found for KYC verification',
      );
    });

    it('should throw BadRequestException when widget KYC returns no token', async () => {
      mockKycVerificationRepository.query.mockReturnValue({
        where: jest.fn().mockResolvedValue([mockKycRecord]),
      });
      mockKycAdapter.initiateWidgetKyc.mockResolvedValue({ ...mockWidgetResponse, token: null });

      await expect(service.restartWidgetKyc(userId, dto)).rejects.toThrow(BadRequestException);
      await expect(service.restartWidgetKyc(userId, dto)).rejects.toThrow(
        'Failed to restart KYC Process: Invalid token',
      );
    });

    it('should throw InternalServerErrorException for system errors', async () => {
      const error = new Error('Database error');
      mockKycVerificationRepository.query.mockReturnValue({
        where: jest.fn().mockRejectedValue(error),
      });

      await expect(service.restartWidgetKyc(userId, dto)).rejects.toThrow(InternalServerErrorException);
      await expect(service.restartWidgetKyc(userId, dto)).rejects.toThrow('Database error');
    });

    it('should allow restart when user has multiple KYC records with none approved', async () => {
      const rejectedKycRecord = { ...mockKycRecord, status: KycVerificationEnum.REJECTED };
      const pendingKycRecord = { ...mockKycRecord, status: KycVerificationEnum.PENDING };

      mockKycVerificationRepository.query.mockReturnValue({
        where: jest.fn().mockResolvedValue([rejectedKycRecord, pendingKycRecord]),
      });
      mockKycAdapter.initiateWidgetKyc.mockResolvedValue(mockWidgetResponse);

      const result = await service.restartWidgetKyc(userId, dto);

      expect(result.token).toBe(mockWidgetResponse.token);
    });

    it('should preserve HTTP exceptions and not convert to InternalServerError', async () => {
      mockUserRepository.findById.mockResolvedValue(null);

      try {
        await service.restartWidgetKyc(userId, dto);
      } catch (error) {
        expect(error).toBeInstanceOf(NotFoundException);
        expect(error).not.toBeInstanceOf(InternalServerErrorException);
      }
    });

    it('should include verificationUrl when isDevelopment is true', async () => {
      jest.spyOn(EnvironmentService, 'isDevelopment').mockReturnValue(true);
      jest.spyOn(EnvironmentService, 'getValue').mockReturnValue('3000');

      mockKycVerificationRepository.query.mockReturnValue({
        where: jest.fn().mockResolvedValue([mockKycRecord]),
      });
      mockKycAdapter.initiateWidgetKyc.mockResolvedValue(mockWidgetResponse);

      const result = await service.restartWidgetKyc(userId, dto);

      expect(result.verificationUrl).toBe(
        `http://localhost:3000/views/sumsub/verification?accessToken=${mockWidgetResponse.token}`,
      );
    });
  });

  describe('moveMetadataAddressToSumsubInfoAddress', () => {
    const mockKycVerifications = [
      {
        id: 'kyc-1',
        user_id: 'user-1',
        provider: 'sumsub',
        status: 'approved',
        created_at: '2025-12-25',
      },
      {
        id: 'kyc-2',
        user_id: 'user-2',
        provider: 'sumsub',
        status: 'approved',
        created_at: '2025-12-30',
      },
    ] as KycVerificationModel[];

    beforeEach(() => {
      mockSumsubAdapter.getKycDetailsByUserIdWithTransform.mockReset();
      mockSumsubAdapter.updateApplicantFixedInfo.mockReset();
    });

    it('should process users with metadata and no postal code', async () => {
      mockKycVerificationRepository.query.mockReturnValue({
        where: jest.fn().mockReturnValue({
          andWhere: jest.fn().mockResolvedValue(mockKycVerifications),
        }),
      });

      mockSumsubAdapter.getKycDetailsByUserIdWithTransform
        .mockResolvedValueOnce({
          id: 'applicant-1',
          fixedInfo: {
            country: 'NGA',
            addresses: [{ postCode: '' }],
          },
          metadata: [
            { key: 'Street', value: '123 Main St' },
            { key: 'City', value: 'Lagos' },
            { key: 'State', value: 'Lagos' },
            { key: 'Postcode', value: '100001' },
          ],
        })
        .mockResolvedValueOnce({
          id: 'applicant-2',
          fixedInfo: {
            country: 'NGA',
            addresses: [{ postCode: '200001' }],
          },
          metadata: [],
        });

      mockSumsubAdapter.updateApplicantFixedInfo.mockResolvedValue(true);

      const result = await service.moveMetadataAddressToSumsubInfoAddress();

      expect(mockSumsubAdapter.getKycDetailsByUserIdWithTransform).toHaveBeenCalledTimes(2);
      expect(mockSumsubAdapter.updateApplicantFixedInfo).toHaveBeenCalledTimes(1);
      expect(result).toEqual({
        noOfUsersAffected: 1,
        noOfUsersResolved: 1,
      });
    });

    it('should skip users with existing postal code', async () => {
      const singleKycVerification = [mockKycVerifications[0]];

      mockKycVerificationRepository.query.mockReturnValue({
        where: jest.fn().mockReturnValue({
          andWhere: jest.fn().mockResolvedValue(singleKycVerification),
        }),
      });

      mockSumsubAdapter.getKycDetailsByUserIdWithTransform.mockResolvedValue({
        id: 'applicant-1',
        fixedInfo: {
          country: 'NGA',
          addresses: [{ postCode: '100001' }],
        },
        metadata: [
          { key: 'Street', value: '123 Main St' },
          { key: 'City', value: 'Lagos' },
        ],
      });

      const result = await service.moveMetadataAddressToSumsubInfoAddress();

      expect(mockSumsubAdapter.getKycDetailsByUserIdWithTransform).toHaveBeenCalledTimes(1);
      expect(mockSumsubAdapter.updateApplicantFixedInfo).not.toHaveBeenCalled();
      expect(result).toEqual({
        noOfUsersAffected: 0,
        noOfUsersResolved: 0,
      });
    });

    it('should skip users with no metadata', async () => {
      const singleKycVerification = [mockKycVerifications[0]];

      mockKycVerificationRepository.query.mockReturnValue({
        where: jest.fn().mockReturnValue({
          andWhere: jest.fn().mockResolvedValue(singleKycVerification),
        }),
      });

      mockSumsubAdapter.getKycDetailsByUserIdWithTransform.mockResolvedValue({
        id: 'applicant-1',
        fixedInfo: {
          country: 'NGA',
          addresses: [],
        },
        metadata: [],
      });

      const result = await service.moveMetadataAddressToSumsubInfoAddress();

      expect(mockSumsubAdapter.getKycDetailsByUserIdWithTransform).toHaveBeenCalledTimes(1);
      expect(mockSumsubAdapter.updateApplicantFixedInfo).not.toHaveBeenCalled();
      expect(result).toEqual({
        noOfUsersAffected: 0,
        noOfUsersResolved: 0,
      });
    });

    it('should handle empty KYC verifications', async () => {
      mockKycVerificationRepository.query.mockReturnValue({
        where: jest.fn().mockReturnValue({
          andWhere: jest.fn().mockResolvedValue([]),
        }),
      });

      const result = await service.moveMetadataAddressToSumsubInfoAddress();

      expect(mockSumsubAdapter.getKycDetailsByUserIdWithTransform).not.toHaveBeenCalled();
      expect(mockSumsubAdapter.updateApplicantFixedInfo).not.toHaveBeenCalled();
      expect(result).toEqual({
        noOfUsersAffected: 0,
        noOfUsersResolved: 0,
      });
    });

    it('should handle failed update and not count as resolved', async () => {
      const singleKycVerification = [mockKycVerifications[0]];

      mockKycVerificationRepository.query.mockReturnValue({
        where: jest.fn().mockReturnValue({
          andWhere: jest.fn().mockResolvedValue(singleKycVerification),
        }),
      });

      mockSumsubAdapter.getKycDetailsByUserIdWithTransform.mockResolvedValue({
        id: 'applicant-1',
        fixedInfo: {
          country: 'NGA',
          addresses: [{ postCode: '' }],
        },
        metadata: [
          { key: 'Street', value: '123 Main St' },
          { key: 'City', value: 'Lagos' },
          { key: 'Postcode', value: '100001' },
        ],
      });

      mockSumsubAdapter.updateApplicantFixedInfo.mockResolvedValue(null);

      const result = await service.moveMetadataAddressToSumsubInfoAddress();

      expect(mockSumsubAdapter.updateApplicantFixedInfo).toHaveBeenCalledWith('applicant-1', {
        addresses: [
          {
            street: '123 Main St',
            streetEn: '123 Main St',
            town: 'Lagos',
            townEn: 'Lagos',
            state: '',
            stateEn: '',
            postCode: '100001',
            country: 'NGA',
          },
        ],
      });
      expect(result).toEqual({
        noOfUsersAffected: 1,
        noOfUsersResolved: 0,
      });
    });

    it('should deduplicate user IDs when same user has multiple KYC records', async () => {
      const duplicateUserKycVerifications = [
        { ...mockKycVerifications[0], user_id: 'user-1' },
        { ...mockKycVerifications[1], user_id: 'user-1' },
      ] as KycVerificationModel[];

      mockKycVerificationRepository.query.mockReturnValue({
        where: jest.fn().mockReturnValue({
          andWhere: jest.fn().mockResolvedValue(duplicateUserKycVerifications),
        }),
      });

      mockSumsubAdapter.getKycDetailsByUserIdWithTransform.mockResolvedValue({
        id: 'applicant-1',
        fixedInfo: {
          country: 'NGA',
          addresses: [{ postCode: '' }],
        },
        metadata: [
          { key: 'Street', value: '123 Main St' },
          { key: 'City', value: 'Lagos' },
          { key: 'Postcode', value: '100001' },
        ],
      });

      mockSumsubAdapter.updateApplicantFixedInfo.mockResolvedValue(true);

      const result = await service.moveMetadataAddressToSumsubInfoAddress();

      expect(mockSumsubAdapter.getKycDetailsByUserIdWithTransform).toHaveBeenCalledTimes(1);
      expect(result).toEqual({
        noOfUsersAffected: 1,
        noOfUsersResolved: 1,
      });
    });

    it('should transform metadata correctly with all address fields', async () => {
      const singleKycVerification = [mockKycVerifications[0]];

      mockKycVerificationRepository.query.mockReturnValue({
        where: jest.fn().mockReturnValue({
          andWhere: jest.fn().mockResolvedValue(singleKycVerification),
        }),
      });

      mockSumsubAdapter.getKycDetailsByUserIdWithTransform.mockResolvedValue({
        id: 'applicant-1',
        fixedInfo: {
          country: 'USA',
          addresses: [],
        },
        metadata: [
          { key: 'Street', value: '456 Oak Ave' },
          { key: 'City', value: 'New York' },
          { key: 'State', value: 'NY' },
          { key: 'Postcode', value: '10001' },
          { key: 'Country', value: 'USA' },
        ],
      });

      mockSumsubAdapter.updateApplicantFixedInfo.mockResolvedValue(true);

      await service.moveMetadataAddressToSumsubInfoAddress();

      expect(mockSumsubAdapter.updateApplicantFixedInfo).toHaveBeenCalledWith('applicant-1', {
        addresses: [
          {
            street: '456 Oak Ave',
            streetEn: '456 Oak Ave',
            town: 'New York',
            townEn: 'New York',
            state: 'NY',
            stateEn: 'NY',
            postCode: '10001',
            country: 'USA',
          },
        ],
      });
    });
  });
});
