import { ExecutionContext, InternalServerErrorException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { DateTime } from 'luxon';
import { createHmac } from 'node:crypto';
import { UniqueViolationError } from 'objection';
import { KYCAdapter } from '../../../adapters/kyc/kyc-adapter';
import { GetKycDetailsResponse } from '../../../adapters/kyc/kyc-adapter.interface';
import { SumsubWebhookPayload } from '../../../adapters/kyc/sumsub/sumsub.interface';
import { EnvironmentService } from '../../../config';
import { OneDoshConfiguration } from '../../../config/onedosh/onedosh.config';
import { SumSubVerificationType } from '../../auth/kycVerification/dto/generateSumsubAccessToken.dto';

import { SumsubConfigProvider } from '../../../config/sumsub.config';
import { KycVerificationEnum } from '../../../database/models/kycVerification/kycVerification.interface';
import { LockerService } from '../../../services/locker';
import { AppLoggerService } from '../../../services/logger/logger.service';
import { MailerService } from '../../../services/queue/processors/mailer/mailer.service';
import { QueueService } from '../../../services/queue/queue.service';
import { UtilsService } from '../../../utils/utils.service';
import { KycStatusLogService } from '../../auth/kycStatusLog/kycStatusLog.service';
import { KycVerificationRepository } from '../../auth/kycVerification/kycVerification.repository';
import { KycVerificationService } from '../../auth/kycVerification/kycVerification.service';
import { UserRepository } from '../../auth/user/user.repository';
import { UserProfileRepository } from '../../auth/userProfile';
import { BlockchainWalletService } from '../../blockchainWallet/blockchainWallet.service';
import { CountryRepository } from '../../country';
import { DoshPointsTransactionService } from '../../doshPoints/doshPointsTransaction/doshPointsTransaction.service';
import { ExternalAccountService } from '../../externalAccount/external-account.service';
import { FiatWalletService } from '../../fiatWallet';
import { InAppNotificationService } from '../../inAppNotification/inAppNotification.service';
import { ParticipantService } from '../../participant';
import { TierConfigRepository } from '../../tierConfig';
import { TierConfigService } from '../../tierConfig/tierConfig.service';
import { UserTierService } from '../../userTier';
import { VirtualAccountService } from '../../virtualAccount';
import { SumsubWebhookController } from './sumsub-webhook.controller';
import { SumsubWebhookAuthGuard } from './sumsub-webhook.guard';
import { SumsubWebhookService } from './sumsub-webhook.service';

describe('SumsubWebhook Module', () => {
  beforeAll(() => {
    // Mock OneDoshConfiguration.getSumsubKycLevelWorkflows
    jest.spyOn(OneDoshConfiguration, 'getSumsubKycLevelWorkflows').mockReturnValue([
      {
        level: SumSubVerificationType.TIER_ONE_VERIFICATION,
        workflows: [SumSubVerificationType.TIER_ONE_VERIFICATION, SumSubVerificationType.ID_AND_LIVENESS],
      },
    ]);
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  describe('SumsubWebhookService', () => {
    let service: SumsubWebhookService;
    let kycVerificationService: jest.Mocked<KycVerificationService>;
    let kycStatusLogService: jest.Mocked<KycStatusLogService>;
    let kycAdapter: jest.Mocked<KYCAdapter>;
    let participantService: jest.Mocked<ParticipantService>;
    let userProfileRepository: jest.Mocked<UserProfileRepository>;
    let userRepository: jest.Mocked<UserRepository>;
    let fiatWalletService: jest.Mocked<FiatWalletService>;
    let virtualAccountService: jest.Mocked<VirtualAccountService>;
    let mailerService: jest.Mocked<MailerService>;
    let inAppNotificationService: jest.Mocked<InAppNotificationService>;
    let externalAccountService: jest.Mocked<ExternalAccountService>;

    const mockKycVerificationService = {
      findByUserId: jest.fn().mockResolvedValue({
        id: 'KYC123',
        attempt: 0,
        user_id: 'USER123',
        status: 'pending',
      }),
      updateKycStatus: jest.fn().mockResolvedValue(undefined),
      initiateWidgetKyc: jest.fn(),
      ensureUserTierRecord: jest.fn().mockResolvedValue(undefined),
    };

    const mockKycStatusLogService = {
      logStatusChange: jest.fn(),
    };

    const mockKycAdapter = {
      getKycDetails: jest.fn(),
      getDocumentInfo: jest.fn(),
      getDocumentContent: jest.fn(),
    };

    const mockParticipantService = {
      createParticipant: jest.fn(),
      uploadDocumentsToProvider: jest.fn(),
      updateParticipantWithKycData: jest.fn(),
      normalizeCountryCode: jest.fn().mockImplementation((country: string) => {
        if (country === 'USA') return 'US';
        if (country === 'NGA') return 'NG';
        return country;
      }),
    };

    const mockUserProfileRepository = {
      update: jest.fn(),
      findByUserId: jest.fn(),
      create: jest.fn(),
    };

    const mockUserRepository = {
      findById: jest.fn(),
      findOne: jest.fn(),
      update: jest.fn(),
      transaction: jest.fn().mockImplementation(async (callback: any) => {
        const mockTrx = {};
        return await callback(mockTrx);
      }),
    };

    const mockFiatWalletService = {
      getUserWallet: jest.fn(),
    };

    const mockVirtualAccountService = {
      findOrCreateVirtualAccount: jest.fn(),
    };

    const mockBlockchainWalletService = {
      createAccount: jest.fn(),
      createWallet: jest.fn(),
      getUserAccount: jest.fn(),
      createInternalBlockchainAccount: jest.fn(),
    };

    const mockLockerService = {
      runWithLock: jest.fn().mockImplementation(async (_key, fn) => await fn()),
    };

    const mockMailerService = {
      send: jest.fn(),
    };

    const mockKycVerificationRepository = {
      findByUserId: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      findAll: jest.fn().mockResolvedValue({
        kyc_verifications: [
          {
            id: 'KYC123',
            user_id: 'USER123',
            provider_verification_type: SumSubVerificationType.TIER_ONE_VERIFICATION,
            status: KycVerificationEnum.PENDING,
            attempt: 0,
            tier_config_id: 'TIER_CONFIG_1',
            tierConfig: {
              id: 'TIER_CONFIG_1',
              tier_id: 'TIER_1',
              country_id: 'NG',
              level: 1,
              name: 'Basic',
              status: 'active',
              tier: {
                id: 'TIER_1',
                name: 'Basic Tier',
                level: 1,
              },
              tierConfigVerificationRequirements: [
                {
                  id: 'TIER_CONFIG_VR_1',
                  tier_config_id: 'TIER_CONFIG_1',
                  verification_requirement_id: 'VR_1',
                  is_required: true,
                  verificationRequirement: {
                    id: 'VR_1',
                    name: 'KYC Verification',
                    type: 'kyc',
                  },
                },
              ],
            },
          },
        ],
      }),
      transaction: jest.fn().mockImplementation(async (callback: any) => {
        const mockTrx = {};
        return await callback(mockTrx);
      }),
      query: jest.fn().mockReturnValue({
        where: jest.fn().mockReturnThis(),
        withGraphFetched: jest.fn().mockResolvedValue([
          {
            id: 'KYC123',
            user_id: 'USER123',
            provider_verification_type: SumSubVerificationType.TIER_ONE_VERIFICATION,
            status: KycVerificationEnum.PENDING,
            attempt: 0,
            tier_config_id: 'TIER_CONFIG_1',
            tier_config_verification_requirement_id: 'TIER_CONFIG_VR_1',
            tierConfig: {
              id: 'TIER_CONFIG_1',
              tier_id: 'TIER_1',
              country_id: 'NG',
              level: 1,
              name: 'Basic',
              status: 'active',
              tier: {
                id: 'TIER_1',
                name: 'Basic Tier',
                level: 1,
              },
              tierConfigVerificationRequirements: [
                {
                  id: 'TIER_CONFIG_VR_1',
                  tier_config_id: 'TIER_CONFIG_1',
                  verification_requirement_id: 'VR_1',
                  is_required: true,
                  verificationRequirement: {
                    id: 'VR_1',
                    name: 'KYC Verification',
                    type: 'kyc',
                  },
                },
              ],
            },
          },
        ]),
        findOne: jest.fn().mockResolvedValue({
          id: 'KYC123',
          user_id: 'USER123',
          status: KycVerificationEnum.PENDING,
          attempt: 0,
          tier_config_id: 'TIER_CONFIG_1',
          tier_config_verification_requirement_id: 'TIER_CONFIG_VR_1',
        }),
      }),
    };

    const mockUtilsService = {
      hashPassword: jest.fn().mockResolvedValue('hashedValue'),
    };

    const mockTierConfigService = {
      findOne: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      isTierOneVerification: jest.fn().mockReturnValue(true),
      getTierConfigsByVerificationType: jest.fn().mockResolvedValue({
        tier_configs: [
          {
            id: 'TIER_CONFIG_1',
            tier_id: 'TIER_1',
            country_id: 'NG',
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
    };

    const mockCountryRepository = {
      findOne: jest.fn().mockResolvedValue({ id: 'NG', code: 'NG', name: 'Nigeria' }),
    } as any;

    const mockTierConfigRepository = {
      findOne: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      findAll: jest.fn(),
      findById: jest.fn().mockResolvedValue({
        id: 'TIER_CONFIG_1',
        tier_id: 'TIER_1',
        tier: {
          id: 'TIER_1',
          name: 'Basic Tier',
          level: 1,
        },
        tierConfigVerificationRequirements: [
          {
            id: 'TIER_CONFIG_VR_1',
            tier_config_id: 'TIER_CONFIG_1',
            verification_requirement_id: 'VR_1',
            is_required: true,
          },
        ],
      }),
      query: jest.fn().mockReturnValue({
        findOne: jest.fn().mockResolvedValue(undefined),
      }),
    } as any;

    const mockUserTierService = {
      create: jest.fn(),
      findOrCreate: jest.fn().mockResolvedValue({
        id: 'USER_TIER_1',
        user_id: 'USER123',
        tier_id: 'TIER_1',
      }),
    } as any;

    const mockQueueService = {
      addJob: jest.fn(),
      processJobs: jest.fn(),
    } as any;

    const mockInAppNotificationService = {
      createNotification: jest.fn().mockResolvedValue(undefined),
    } as any;

    const mockExternalAccountService = {
      continueDepositFromWebhook: jest.fn().mockResolvedValue(undefined),
      failDepositFromWebhook: jest.fn().mockResolvedValue(undefined),
      holdDepositFromWebhook: jest.fn().mockResolvedValue(undefined),
    } as any;

    const mockDoshPointsTransactionService = {
      creditPoints: jest.fn().mockResolvedValue({ transaction: {}, account: {}, is_duplicate: false }),
    } as any;

    beforeEach(async () => {
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          SumsubWebhookService,
          {
            provide: KycVerificationService,
            useValue: mockKycVerificationService,
          },
          {
            provide: KycStatusLogService,
            useValue: mockKycStatusLogService,
          },
          {
            provide: KYCAdapter,
            useValue: mockKycAdapter,
          },
          {
            provide: ParticipantService,
            useValue: mockParticipantService,
          },
          {
            provide: UserProfileRepository,
            useValue: mockUserProfileRepository,
          },
          {
            provide: UserRepository,
            useValue: mockUserRepository,
          },
          {
            provide: FiatWalletService,
            useValue: mockFiatWalletService,
          },
          {
            provide: VirtualAccountService,
            useValue: mockVirtualAccountService,
          },
          {
            provide: BlockchainWalletService,
            useValue: mockBlockchainWalletService,
          },
          {
            provide: LockerService,
            useValue: mockLockerService,
          },
          {
            provide: MailerService,
            useValue: mockMailerService,
          },
          {
            provide: KycVerificationRepository,
            useValue: mockKycVerificationRepository,
          },
          {
            provide: UtilsService,
            useValue: mockUtilsService,
          },
          {
            provide: TierConfigService,
            useValue: mockTierConfigService,
          },
          {
            provide: CountryRepository,
            useValue: mockCountryRepository,
          },
          {
            provide: TierConfigRepository,
            useValue: mockTierConfigRepository,
          },
          {
            provide: UserTierService,
            useValue: mockUserTierService,
          },
          {
            provide: QueueService,
            useValue: mockQueueService,
          },
          {
            provide: InAppNotificationService,
            useValue: mockInAppNotificationService,
          },
          {
            provide: ExternalAccountService,
            useValue: mockExternalAccountService,
          },
          {
            provide: DoshPointsTransactionService,
            useValue: mockDoshPointsTransactionService,
          },
        ],
      }).compile();

      service = module.get<SumsubWebhookService>(SumsubWebhookService);
      kycVerificationService = module.get(KycVerificationService);
      kycStatusLogService = module.get(KycStatusLogService);
      kycAdapter = module.get(KYCAdapter);
      participantService = module.get(ParticipantService);
      userProfileRepository = module.get(UserProfileRepository);
      userRepository = module.get(UserRepository);
      fiatWalletService = module.get(FiatWalletService);
      virtualAccountService = module.get(VirtualAccountService);
      mailerService = module.get(MailerService);
      inAppNotificationService = module.get(InAppNotificationService);
      externalAccountService = module.get(ExternalAccountService);
    });

    afterEach(() => {
      jest.clearAllMocks();
      jest.restoreAllMocks();
    });

    describe('processWebhook', () => {
      it('should handle applicantCreated event', async () => {
        const payload: SumsubWebhookPayload = {
          applicantId: 'APP123',
          type: 'applicantCreated',
          externalUserId: 'USER123',
          inspectionId: 'INSP123',
          correlationId: 'CORR123',
          levelName: SumSubVerificationType.TIER_ONE_VERIFICATION,
          clientId: 'CLIENT123',
          createdAtMs: '2344324323',
          sandboxMode: false,
          reviewStatus: 'init',
        };

        await service.processWebhook(payload);

        expect(kycVerificationService.updateKycStatus).toHaveBeenCalledWith(
          'KYC123',
          {
            status: KycVerificationEnum.PENDING,
            provider_ref: 'APP123',
          },
          expect.any(Object),
        );
        expect(kycStatusLogService.logStatusChange).toHaveBeenCalled();
      });

      it('should handle applicantPending event', async () => {
        const payload: SumsubWebhookPayload = {
          applicantId: 'APP123',
          type: 'applicantPending',
          externalUserId: 'USER123',
          inspectionId: 'INSP123',
          correlationId: 'CORR123',
          levelName: SumSubVerificationType.TIER_ONE_VERIFICATION,
          createdAtMs: '2344324323',
          reviewStatus: 'pending',
          applicantType: 'INDIVIDUAL',
          sandboxMode: false,
          clientId: 'CLIENT123',
        };

        await service.processWebhook(payload);

        expect(kycVerificationService.updateKycStatus).toHaveBeenCalledWith(
          'KYC123',
          {
            status: KycVerificationEnum.PENDING,
            provider_ref: 'APP123',
          },
          expect.any(Object),
        );
        expect(kycStatusLogService.logStatusChange).toHaveBeenCalled();
      });

      it('should handle applicantPending event with LIVENESS_ONLY level', async () => {
        const payload: SumsubWebhookPayload = {
          applicantId: 'APP123',
          type: 'applicantPending',
          externalUserId: 'USER123',
          inspectionId: 'INSP123',
          correlationId: 'CORR123',
          levelName: SumSubVerificationType.LIVENESS_ONLY,
          createdAtMs: '2344324323',
          reviewStatus: 'pending',
          applicantType: 'INDIVIDUAL',
          sandboxMode: false,
          clientId: 'CLIENT123',
        };

        await service.processWebhook(payload);

        expect(kycVerificationService.updateKycStatus).toHaveBeenCalledWith(
          'KYC123',
          {
            status: KycVerificationEnum.SUBMITTED,
            provider_ref: 'APP123',
          },
          expect.any(Object),
        );
        expect(kycStatusLogService.logStatusChange).toHaveBeenCalled();
      });

      it('should handle applicantReset event', async () => {
        const payload: SumsubWebhookPayload = {
          applicantId: 'APP123',
          type: 'applicantReset',
          externalUserId: 'USER123',
          inspectionId: 'INSP123',
          correlationId: 'CORR123',
          levelName: SumSubVerificationType.TIER_ONE_VERIFICATION,
          createdAtMs: '2344324323',
        };

        await service.processWebhook(payload);

        expect(kycVerificationService.updateKycStatus).toHaveBeenCalledWith(
          'KYC123',
          {
            status: KycVerificationEnum.RESTARTED,
            provider_ref: 'APP123',
          },
          expect.any(Object),
        );
        expect(kycStatusLogService.logStatusChange).toHaveBeenCalledWith(
          'KYC123',
          KycVerificationEnum.PENDING,
          KycVerificationEnum.RESTARTED,
          null,
          expect.any(Object),
        );
      });

      it('should handle applicantReviewed with GREEN status', async () => {
        // Ensure the mock is set up for this test
        jest.spyOn(OneDoshConfiguration, 'getSumsubKycLevelWorkflows').mockReturnValue([
          {
            level: SumSubVerificationType.TIER_ONE_VERIFICATION,
            workflows: [SumSubVerificationType.TIER_ONE_VERIFICATION, SumSubVerificationType.ID_AND_LIVENESS],
          },
        ]);

        const payload: SumsubWebhookPayload = {
          applicantId: 'APP123',
          type: 'applicantReviewed',
          externalUserId: 'USER123',
          inspectionId: 'INSP123',
          correlationId: 'CORR123',
          levelName: SumSubVerificationType.ID_AND_LIVENESS,
          createdAtMs: '2024-03-20T10:00:00Z',
          reviewStatus: 'completed',
          reviewResult: {
            reviewAnswer: 'GREEN',
            moderationComment: 'Approved',
          },
        };

        const mockKycDetails = {
          data: {
            id: 'APP123',
            userId: 'USER123',
            inspectionId: 'INSP123',
            firstName: 'John',
            lastName: 'Doe',
            middleName: 'M',
            dob: '1990-01-01',
            country: 'Nigeria',
            email: 'john@example.com',
            phone: '+1234567890',
            status: KycVerificationEnum.APPROVED,
            errorMessage: 'Approved',
            failureReason: null,
            idNumber: 'A12345678',
            idDocument: {
              type: 'passport',
              number: 'A12345678',
              validUntil: '2030-01-01',
            },
            address: {
              address: '123 Main St',
              city: 'Lagos',
              country: 'Nigeria',
              postalCode: '100001',
              state: 'Lagos',
            },
            submittedAt: '2024-03-20',
            reviewedAt: '2024-03-20T10:30:00Z',
            completedAt: '2024-03-20T10:30:00Z',
            agreementAcceptedAt: '2024-03-20T09:00:00Z',
          },
        };

        kycAdapter.getKycDetails.mockResolvedValue(mockKycDetails as any);
        kycVerificationService.findByUserId.mockResolvedValue({
          id: 'KYC123',
          attempt: 1,
          status: KycVerificationEnum.PENDING,
        } as any);
        kycVerificationService.updateKycStatus.mockResolvedValue(undefined);
        kycStatusLogService.logStatusChange.mockResolvedValue(undefined);
        userRepository.findById.mockResolvedValue({
          id: 'USER123',
          first_name: 'John',
          last_name: 'Doe',
          email: 'john@example.com',
          phone_number: '08012345678',
          country: { id: 'NG', code: 'NG', name: 'Nigeria' },
        } as any);
        userRepository.update.mockResolvedValue(undefined);
        userProfileRepository.findByUserId.mockResolvedValue({ id: 'PROFILE123', user_id: 'USER123' } as any);
        userProfileRepository.update.mockResolvedValue(undefined);
        userProfileRepository.create.mockResolvedValue({ id: 'PROFILE123', user_id: 'USER123' } as any);
        participantService.createParticipant.mockResolvedValue({
          providerRef: 'PARTICIPANT123',
          provider: 'zerohash',
        } as any);

        // Mock document processing
        kycAdapter.getDocumentInfo.mockResolvedValue({
          data: {
            applicantId: 'APP123',
            documents: [
              {
                id: 'DOC123',
                idDocType: 'PASSPORT',
                country: 'Nigeria',
                reviewResult: { reviewAnswer: 'GREEN' },
                inspectionId: 'INSP123',
              },
            ],
          },
        } as any);

        kycAdapter.getDocumentContent.mockResolvedValue({
          data: {
            imageId: 'DOC123',
            content: 'base64content',
            mimeType: 'image/jpeg',
            fileName: 'passport.jpg',
          },
        } as any);

        // Mock participant service methods - note: upload/update methods now called internally by createParticipant
        fiatWalletService.getUserWallet.mockResolvedValue({ id: 'WALLET123' } as any);
        virtualAccountService.findOrCreateVirtualAccount.mockResolvedValue({
          id: 'VA123',
          account_number: '1234567890',
          account_name: 'John Doe',
          bank_name: '9 Payment Service Bank (9PSB)',
        } as any);
        mailerService.send.mockResolvedValue(undefined);

        // Mock the findOne method for createNGVirtualAccount
        userRepository.findOne.mockResolvedValue({
          id: 'USER123',
          first_name: 'John',
          last_name: 'Doe',
          email: 'john@example.com',
          phone_number: '08012345678',
          userProfile: {
            address_line1: '123 Main St',
            address_line2: null,
            gender: 'male',
            dob: '1990-01-01',
          },
        } as any);

        // Mock the transaction
        mockKycVerificationRepository.transaction.mockImplementation(async (callback: any) => {
          const mockTrx = {};
          return await callback(mockTrx);
        });

        // Mock UtilsService.hashPassword
        jest.spyOn(UtilsService, 'hashPassword').mockResolvedValue('hashed-password');

        // Mock query().findOne to return existing KYC record
        mockKycVerificationRepository.query.mockReturnValue({
          where: jest.fn().mockReturnThis(),
          withGraphFetched: jest.fn().mockResolvedValue([
            {
              id: 'KYC123',
              user_id: 'USER123',
              provider_verification_type: SumSubVerificationType.TIER_ONE_VERIFICATION,
              status: KycVerificationEnum.PENDING,
              attempt: 0,
              tier_config_id: 'TIER_CONFIG_1',
              tier_config_verification_requirement_id: 'TIER_CONFIG_VR_1',
              tierConfig: {
                id: 'TIER_CONFIG_1',
                tier_id: 'TIER_1',
                country_id: 'NG',
                level: 1,
                name: 'Basic',
                status: 'active',
                tier: {
                  id: 'TIER_1',
                  name: 'Basic Tier',
                  level: 1,
                },
                tierConfigVerificationRequirements: [
                  {
                    id: 'TIER_CONFIG_VR_1',
                    tier_config_id: 'TIER_CONFIG_1',
                    verification_requirement_id: 'VR_1',
                    is_required: true,
                    verificationRequirement: {
                      id: 'VR_1',
                      name: 'KYC Verification',
                      type: 'kyc',
                    },
                  },
                ],
              },
            },
          ]),
          findOne: jest.fn().mockResolvedValue({
            id: 'KYC123',
            user_id: 'USER123',
            status: KycVerificationEnum.PENDING,
            attempt: 0,
            tier_config_id: 'TIER_CONFIG_1',
            tier_config_verification_requirement_id: 'TIER_CONFIG_VR_1',
          }),
        });

        mockKycVerificationRepository.create.mockResolvedValue({
          id: 'KYC123',
          user_id: 'USER123',
          status: KycVerificationEnum.APPROVED,
          attempt: 1,
        } as any);

        mockBlockchainWalletService.createInternalBlockchainAccount.mockResolvedValue(undefined);

        await service.processWebhook(payload);

        // Wait for async operations to complete
        await new Promise((resolve) => setTimeout(resolve, 100));

        expect(kycAdapter.getKycDetails).toHaveBeenCalledWith({ applicantId: payload.applicantId });
        expect(kycVerificationService.updateKycStatus).toHaveBeenCalled();
        expect(kycStatusLogService.logStatusChange).toHaveBeenCalled();
        expect(inAppNotificationService.createNotification).toHaveBeenCalledWith({
          user_id: 'USER123',
          type: 'kyc_success',
          title: 'KYC Verification Successful',
          message: 'Your identity verification has been approved. You can now access all features.',
          metadata: { levelName: payload.levelName },
        });
        expect(mailerService.send).toHaveBeenCalled();
      });

      it('should handle applicantReviewed with RED status', async () => {
        const payload: SumsubWebhookPayload = {
          applicantId: 'APP123',
          type: 'applicantReviewed',
          externalUserId: 'USER123',
          inspectionId: 'INSP123',
          correlationId: 'CORR123',
          levelName: SumSubVerificationType.TIER_ONE_VERIFICATION,
          createdAtMs: '2024-03-20T10:00:00Z',
          reviewStatus: 'completed',
          reviewResult: {
            reviewAnswer: 'RED',
            moderationComment: 'Rejected',
            reviewRejectType: 'FINAL',
          },
        };

        const mockKycDetails = {
          data: {
            id: 'APP123',
            userId: 'USER123',
            inspectionId: 'INSP123',
            firstName: 'John',
            lastName: 'Doe',
            middleName: 'M',
            dob: '1990-01-01',
            country: 'Nigeria',
            email: 'john@example.com',
            phone: '+1234567890',
            status: KycVerificationEnum.REJECTED,
            errorMessage: 'Rejected',
            failureReason: 'Document verification failed',
            idNumber: 'A12345678',
            idDocument: {
              type: 'passport',
              number: 'A12345678',
              validUntil: '2030-01-01',
            },
            submittedAt: '2024-03-20',
            reviewedAt: '2024-03-20T10:30:00Z',
            address: {
              address: '123 Main St',
              city: 'Lagos',
              country: 'Nigeria',
              postalCode: '100001',
              state: 'Lagos',
            },
          },
        };

        kycAdapter.getKycDetails.mockResolvedValue(mockKycDetails as any);
        userRepository.findById.mockResolvedValue({
          id: 'USER123',
          first_name: 'John',
          last_name: 'Doe',
          email: 'john@example.com',
        } as any);
        kycVerificationService.updateKycStatus.mockResolvedValue(undefined);
        kycStatusLogService.logStatusChange.mockResolvedValue(undefined);
        mockKycVerificationRepository.create.mockResolvedValue({
          id: 'KYC123',
          user_id: 'USER123',
          status: KycVerificationEnum.REJECTED,
          attempt: 1,
        } as any);

        // Mock the transaction
        mockKycVerificationRepository.transaction.mockImplementation(async (callback: any) => {
          const mockTrx = {};
          return await callback(mockTrx);
        });

        // Mock query().findOne to return existing KYC record
        mockKycVerificationRepository.query.mockReturnValue({
          where: jest.fn().mockReturnThis(),
          withGraphFetched: jest.fn().mockResolvedValue([
            {
              id: 'KYC123',
              user_id: 'USER123',
              provider_verification_type: SumSubVerificationType.TIER_ONE_VERIFICATION,
              status: KycVerificationEnum.PENDING,
              attempt: 0,
              tier_config_id: 'TIER_CONFIG_1',
              tier_config_verification_requirement_id: 'TIER_CONFIG_VR_1',
              tierConfig: {
                id: 'TIER_CONFIG_1',
                tier_id: 'TIER_1',
                country_id: 'NG',
                level: 1,
                name: 'Basic',
                status: 'active',
                tier: {
                  id: 'TIER_1',
                  name: 'Basic Tier',
                  level: 1,
                },
                tierConfigVerificationRequirements: [
                  {
                    id: 'TIER_CONFIG_VR_1',
                    tier_config_id: 'TIER_CONFIG_1',
                    verification_requirement_id: 'VR_1',
                    is_required: true,
                    verificationRequirement: {
                      id: 'VR_1',
                      name: 'KYC Verification',
                      type: 'kyc',
                    },
                  },
                ],
              },
            },
          ]),
          findOne: jest.fn().mockResolvedValue({
            id: 'KYC123',
            user_id: 'USER123',
            status: KycVerificationEnum.PENDING,
            attempt: 0,
            tier_config_id: 'TIER_CONFIG_1',
            tier_config_verification_requirement_id: 'TIER_CONFIG_VR_1',
          }),
        });

        // Mock UtilsService.hashPassword
        jest.spyOn(UtilsService, 'hashPassword').mockResolvedValue('hashed-password');

        await service.processWebhook(payload);

        expect(kycAdapter.getKycDetails).toHaveBeenCalledWith({ applicantId: payload.applicantId });
        expect(userRepository.findById).toHaveBeenCalledWith('USER123');
        expect(kycVerificationService.updateKycStatus).toHaveBeenCalled();
        expect(kycStatusLogService.logStatusChange).toHaveBeenCalled();
        expect(inAppNotificationService.createNotification).toHaveBeenCalledWith({
          user_id: 'USER123',
          type: 'kyc_failed',
          title: 'KYC Verification Failed',
          message: `Your identity verification was not approved. Reason: ${mockKycDetails.data.failureReason}`,
          metadata: { levelName: payload.levelName, failureReason: mockKycDetails.data.failureReason },
        });
        expect(mailerService.send).toHaveBeenCalled();
      });

      it('should handle applicantReviewed with RED status and resubmission required', async () => {
        const payload: SumsubWebhookPayload = {
          applicantId: 'APP123',
          type: 'applicantReviewed',
          externalUserId: 'USER123',
          inspectionId: 'INSP123',
          correlationId: 'CORR123',
          levelName: SumSubVerificationType.TIER_ONE_VERIFICATION,
          createdAtMs: '2024-03-20T10:00:00Z',
          reviewStatus: 'completed',
          reviewResult: {
            reviewAnswer: 'RED',
            moderationComment: 'Rejected',
            reviewRejectType: 'RETRY',
          },
        };

        const mockKycDetails = {
          data: {
            id: 'APP123',
            userId: 'USER123',
            inspectionId: 'INSP123',
            firstName: 'John',
            lastName: 'Doe',
            middleName: 'M',
            dob: '1990-01-01',
            country: 'Nigeria',
            email: 'john@example.com',
            phone: '+1234567890',
            status: KycVerificationEnum.RESUBMISSION_REQUESTED,
            errorMessage: 'Rejected',
            failureReason: 'Document quality is poor, Please provide a clearer image',
            failureCorrection: 'Upload a clearer document image',
            idNumber: 'A12345678',
            idDocument: {
              type: 'passport',
              number: 'A12345678',
              validUntil: '2030-01-01',
            },
            submittedAt: '2024-03-20',
            reviewedAt: '2024-03-20T10:30:00Z',
            address: {
              address: '123 Main St',
              city: 'Lagos',
              country: 'Nigeria',
              postalCode: '100001',
              state: 'Lagos',
            },
          },
        };

        kycAdapter.getKycDetails.mockResolvedValue(mockKycDetails as any);
        userRepository.findById.mockResolvedValue({
          id: 'USER123',
          first_name: 'John',
          last_name: 'Doe',
          email: 'john@example.com',
        } as any);
        kycVerificationService.updateKycStatus.mockResolvedValue(undefined);
        kycStatusLogService.logStatusChange.mockResolvedValue(undefined);
        mockKycVerificationRepository.create.mockResolvedValue({
          id: 'KYC123',
          user_id: 'USER123',
          status: KycVerificationEnum.RESUBMISSION_REQUESTED,
          attempt: 1,
        } as any);

        // Mock the transaction
        mockKycVerificationRepository.transaction.mockImplementation(async (callback: any) => {
          const mockTrx = {};
          return await callback(mockTrx);
        });

        // Mock query().findOne to return existing KYC record
        mockKycVerificationRepository.query.mockReturnValue({
          where: jest.fn().mockReturnThis(),
          withGraphFetched: jest.fn().mockResolvedValue([
            {
              id: 'KYC123',
              user_id: 'USER123',
              provider_verification_type: SumSubVerificationType.TIER_ONE_VERIFICATION,
              status: KycVerificationEnum.PENDING,
              attempt: 0,
              tier_config_id: 'TIER_CONFIG_1',
              tier_config_verification_requirement_id: 'TIER_CONFIG_VR_1',
              tierConfig: {
                id: 'TIER_CONFIG_1',
                tier_id: 'TIER_1',
                country_id: 'NG',
                level: 1,
                name: 'Basic',
                status: 'active',
                tier: {
                  id: 'TIER_1',
                  name: 'Basic Tier',
                  level: 1,
                },
                tierConfigVerificationRequirements: [
                  {
                    id: 'TIER_CONFIG_VR_1',
                    tier_config_id: 'TIER_CONFIG_1',
                    verification_requirement_id: 'VR_1',
                    is_required: true,
                    verificationRequirement: {
                      id: 'VR_1',
                      name: 'KYC Verification',
                      type: 'kyc',
                    },
                  },
                ],
              },
            },
          ]),
          findOne: jest.fn().mockResolvedValue({
            id: 'KYC123',
            user_id: 'USER123',
            status: KycVerificationEnum.PENDING,
            attempt: 0,
            tier_config_id: 'TIER_CONFIG_1',
            tier_config_verification_requirement_id: 'TIER_CONFIG_VR_1',
          }),
        });

        // Mock UtilsService.hashPassword
        jest.spyOn(UtilsService, 'hashPassword').mockResolvedValue('hashed-password');

        await service.processWebhook(payload);

        expect(kycAdapter.getKycDetails).toHaveBeenCalledWith({ applicantId: payload.applicantId });
        expect(userRepository.findById).toHaveBeenCalledWith('USER123');
        expect(kycVerificationService.updateKycStatus).toHaveBeenCalled();
        expect(kycStatusLogService.logStatusChange).toHaveBeenCalled();
        expect(inAppNotificationService.createNotification).toHaveBeenCalledWith({
          user_id: 'USER123',
          type: 'kyc_failed',
          title: 'KYC Verification Failed',
          message: `Your identity verification was not approved. Reason: ${mockKycDetails.data.failureReason}, Check your email for more details.`,
          metadata: { levelName: payload.levelName, failureReason: mockKycDetails.data.failureReason },
        });
        expect(mailerService.send).toHaveBeenCalled();
      });

      it('should handle applicantOnHold event', async () => {
        const payload: SumsubWebhookPayload = {
          applicantId: 'APP123',
          type: 'applicantOnHold',
          externalUserId: 'USER123',
          inspectionId: 'INSP123',
          correlationId: 'CORR123',
          levelName: SumSubVerificationType.TIER_ONE_VERIFICATION,
          createdAtMs: '2024-03-20T10:00:00Z',
          reviewStatus: 'onHold',
          applicantType: 'INDIVIDUAL',
          sandboxMode: false,
          clientId: 'CLIENT123',
        };

        await service.processWebhook(payload);

        expect(kycVerificationService.updateKycStatus).toHaveBeenCalledWith(
          'KYC123',
          {
            status: KycVerificationEnum.IN_REVIEW,
            provider_ref: 'APP123',
          },
          expect.any(Object),
        );
        expect(kycStatusLogService.logStatusChange).toHaveBeenCalledWith(
          'KYC123',
          KycVerificationEnum.PENDING,
          KycVerificationEnum.IN_REVIEW,
          null,
          expect.any(Object),
        );
      });

      it('should handle applicantKytTxnApproved event', async () => {
        const payload: any = {
          applicantId: 'APP123',
          type: 'applicantKytTxnApproved',
          externalUserId: 'USER123',
          inspectionId: 'INSP123',
          correlationId: 'CORR123',
          levelName: SumSubVerificationType.TIER_ONE_VERIFICATION,
          createdAtMs: '2024-03-20T10:00:00Z',
          kytDataTxnId: 'KYT_TXN_123',
          kytTxnType: 'finance',
          reviewStatus: 'completed',
          sandboxMode: false,
          clientId: 'CLIENT123',
        };

        await service.processWebhook(payload);

        expect(externalAccountService.continueDepositFromWebhook).toHaveBeenCalledWith('KYT_TXN_123');
      });

      it('should skip non-finance transaction type in applicantKytTxnApproved', async () => {
        const payload: any = {
          applicantId: 'APP123',
          type: 'applicantKytTxnApproved',
          externalUserId: 'USER123',
          inspectionId: 'INSP123',
          correlationId: 'CORR123',
          levelName: SumSubVerificationType.TIER_ONE_VERIFICATION,
          createdAtMs: '2024-03-20T10:00:00Z',
          kytDataTxnId: 'KYT_TXN_123',
          kytTxnType: 'withdrawal',
          reviewStatus: 'completed',
          sandboxMode: false,
          clientId: 'CLIENT123',
        };

        await service.processWebhook(payload);

        expect(externalAccountService.continueDepositFromWebhook).not.toHaveBeenCalled();
      });

      it('should handle applicantKytTxnRejected event', async () => {
        const payload: any = {
          applicantId: 'APP123',
          type: 'applicantKytTxnRejected',
          externalUserId: 'USER123',
          inspectionId: 'INSP123',
          correlationId: 'CORR123',
          levelName: SumSubVerificationType.TIER_ONE_VERIFICATION,
          createdAtMs: '2024-03-20T10:00:00Z',
          kytDataTxnId: 'KYT_TXN_123',
          kytTxnType: 'finance',
          reviewStatus: 'completed',
          reviewResult: {
            reviewRejectType: 'FINAL',
          },
          sandboxMode: false,
          clientId: 'CLIENT123',
        };

        await service.processWebhook(payload);

        expect(externalAccountService.failDepositFromWebhook).toHaveBeenCalledWith('KYT_TXN_123', 'FINAL');
      });

      it('should handle applicantKytOnHold event', async () => {
        const payload: any = {
          applicantId: 'APP123',
          type: 'applicantKytOnHold',
          externalUserId: 'USER123',
          inspectionId: 'INSP123',
          correlationId: 'CORR123',
          levelName: SumSubVerificationType.TIER_ONE_VERIFICATION,
          createdAtMs: '2024-03-20T10:00:00Z',
          kytDataTxnId: 'KYT_TXN_123',
          kytTxnType: 'finance',
          reviewStatus: 'onHold',
          sandboxMode: false,
          clientId: 'CLIENT123',
        };

        await service.processWebhook(payload);

        expect(externalAccountService.holdDepositFromWebhook).toHaveBeenCalledWith('KYT_TXN_123');
      });

      it('should skip non-finance transaction type in applicantKytTxnRejected', async () => {
        const payload: any = {
          applicantId: 'APP123',
          type: 'applicantKytTxnRejected',
          externalUserId: 'USER123',
          inspectionId: 'INSP123',
          correlationId: 'CORR123',
          levelName: SumSubVerificationType.TIER_ONE_VERIFICATION,
          createdAtMs: '2024-03-20T10:00:00Z',
          kytDataTxnId: 'KYT_TXN_123',
          kytTxnType: 'withdrawal',
          reviewStatus: 'completed',
          reviewResult: {
            reviewRejectType: 'FINAL',
          },
          sandboxMode: false,
          clientId: 'CLIENT123',
        };

        await service.processWebhook(payload);

        expect(externalAccountService.failDepositFromWebhook).not.toHaveBeenCalled();
      });

      it('should skip non-finance transaction type in applicantKytOnHold', async () => {
        const payload: any = {
          applicantId: 'APP123',
          type: 'applicantKytOnHold',
          externalUserId: 'USER123',
          inspectionId: 'INSP123',
          correlationId: 'CORR123',
          levelName: SumSubVerificationType.TIER_ONE_VERIFICATION,
          createdAtMs: '2024-03-20T10:00:00Z',
          kytDataTxnId: 'KYT_TXN_123',
          kytTxnType: 'crypto',
          reviewStatus: 'onHold',
          sandboxMode: false,
          clientId: 'CLIENT123',
        };

        await service.processWebhook(payload);

        expect(externalAccountService.holdDepositFromWebhook).not.toHaveBeenCalled();
      });

      it('should use default rejection reason when reviewRejectType is missing', async () => {
        const payload: any = {
          applicantId: 'APP123',
          type: 'applicantKytTxnRejected',
          externalUserId: 'USER123',
          inspectionId: 'INSP123',
          correlationId: 'CORR123',
          levelName: SumSubVerificationType.TIER_ONE_VERIFICATION,
          createdAtMs: '2024-03-20T10:00:00Z',
          kytDataTxnId: 'KYT_TXN_123',
          kytTxnType: 'finance',
          reviewStatus: 'completed',
          reviewResult: {},
          sandboxMode: false,
          clientId: 'CLIENT123',
        };

        await service.processWebhook(payload);

        expect(externalAccountService.failDepositFromWebhook).toHaveBeenCalledWith(
          'KYT_TXN_123',
          'Transaction monitoring rejection',
        );
      });

      it('should handle errors in applicantKytTxnApproved gracefully', async () => {
        const payload: any = {
          applicantId: 'APP123',
          type: 'applicantKytTxnApproved',
          externalUserId: 'USER123',
          inspectionId: 'INSP123',
          correlationId: 'CORR123',
          levelName: SumSubVerificationType.TIER_ONE_VERIFICATION,
          createdAtMs: '2024-03-20T10:00:00Z',
          kytDataTxnId: 'KYT_TXN_123',
          kytTxnType: 'finance',
          reviewStatus: 'completed',
          sandboxMode: false,
          clientId: 'CLIENT123',
        };

        const error = new Error('External account service error');
        externalAccountService.continueDepositFromWebhook.mockRejectedValue(error);

        // Should not throw - errors are caught and logged
        await service.processWebhook(payload);

        expect(externalAccountService.continueDepositFromWebhook).toHaveBeenCalledWith('KYT_TXN_123');
      });

      it('should handle errors in applicantKytTxnRejected gracefully', async () => {
        const payload: any = {
          applicantId: 'APP123',
          type: 'applicantKytTxnRejected',
          externalUserId: 'USER123',
          inspectionId: 'INSP123',
          correlationId: 'CORR123',
          levelName: SumSubVerificationType.TIER_ONE_VERIFICATION,
          createdAtMs: '2024-03-20T10:00:00Z',
          kytDataTxnId: 'KYT_TXN_123',
          kytTxnType: 'finance',
          reviewStatus: 'completed',
          reviewResult: {
            reviewRejectType: 'FINAL',
          },
          sandboxMode: false,
          clientId: 'CLIENT123',
        };

        const error = new Error('External account service error');
        externalAccountService.failDepositFromWebhook.mockRejectedValue(error);

        // Should not throw - errors are caught and logged
        await service.processWebhook(payload);

        expect(externalAccountService.failDepositFromWebhook).toHaveBeenCalledWith('KYT_TXN_123', 'FINAL');
      });

      it('should handle errors in applicantKytOnHold gracefully', async () => {
        const payload: any = {
          applicantId: 'APP123',
          type: 'applicantKytOnHold',
          externalUserId: 'USER123',
          inspectionId: 'INSP123',
          correlationId: 'CORR123',
          levelName: SumSubVerificationType.TIER_ONE_VERIFICATION,
          createdAtMs: '2024-03-20T10:00:00Z',
          kytDataTxnId: 'KYT_TXN_123',
          kytTxnType: 'finance',
          reviewStatus: 'onHold',
          sandboxMode: false,
          clientId: 'CLIENT123',
        };

        const error = new Error('External account service error');
        externalAccountService.holdDepositFromWebhook.mockRejectedValue(error);

        // Should not throw - errors are caught and logged
        await service.processWebhook(payload);

        expect(externalAccountService.holdDepositFromWebhook).toHaveBeenCalledWith('KYT_TXN_123');
      });

      it('should use default rejection reason when reviewResult is undefined', async () => {
        const payload: any = {
          applicantId: 'APP123',
          type: 'applicantKytTxnRejected',
          externalUserId: 'USER123',
          inspectionId: 'INSP123',
          correlationId: 'CORR123',
          levelName: SumSubVerificationType.TIER_ONE_VERIFICATION,
          createdAtMs: '2024-03-20T10:00:00Z',
          kytDataTxnId: 'KYT_TXN_123',
          kytTxnType: 'finance',
          reviewStatus: 'completed',
          sandboxMode: false,
          clientId: 'CLIENT123',
        };

        await service.processWebhook(payload);

        expect(externalAccountService.failDepositFromWebhook).toHaveBeenCalledWith(
          'KYT_TXN_123',
          'Transaction monitoring rejection',
        );
      });

      it('should handle applicantKytTxnApproved with different transaction types', async () => {
        const transactionTypes = ['deposit', 'transfer', 'exchange'];

        for (const txnType of transactionTypes) {
          jest.clearAllMocks();

          const payload: any = {
            applicantId: 'APP123',
            type: 'applicantKytTxnApproved',
            externalUserId: 'USER123',
            inspectionId: 'INSP123',
            correlationId: 'CORR123',
            levelName: SumSubVerificationType.TIER_ONE_VERIFICATION,
            createdAtMs: '2024-03-20T10:00:00Z',
            kytDataTxnId: 'KYT_TXN_123',
            kytTxnType: txnType,
            reviewStatus: 'completed',
            sandboxMode: false,
            clientId: 'CLIENT123',
          };

          await service.processWebhook(payload);

          expect(externalAccountService.continueDepositFromWebhook).not.toHaveBeenCalled();
        }
      });

      it('should handle error in processWebhook', async () => {
        // Ensure the mock is set up for this test
        jest.spyOn(OneDoshConfiguration, 'getSumsubKycLevelWorkflows').mockReturnValue([
          {
            level: SumSubVerificationType.TIER_ONE_VERIFICATION,
            workflows: [SumSubVerificationType.TIER_ONE_VERIFICATION, SumSubVerificationType.ID_AND_LIVENESS],
          },
        ]);

        const payload: SumsubWebhookPayload = {
          applicantId: 'APP123',
          type: 'applicantReviewed',
          externalUserId: 'USER123',
          inspectionId: 'INSP123',
          correlationId: 'CORR123',
          levelName: SumSubVerificationType.ID_AND_LIVENESS,
          createdAtMs: '2024-03-20T10:00:00Z',
          reviewStatus: 'completed',
          reviewResult: {
            reviewAnswer: 'GREEN',
            moderationComment: 'Approved',
          },
        };

        kycAdapter.getKycDetails.mockRejectedValue(new InternalServerErrorException('KYC API Error'));

        await expect(service.processWebhook(payload)).rejects.toThrow(InternalServerErrorException);
      });
    });

    describe('updateUserDetails', () => {
      it('should successfully update user details in non-production environment', async () => {
        jest.spyOn(EnvironmentService, 'isProduction').mockReturnValue(false);

        const mockData: GetKycDetailsResponse = {
          id: 'APP123',
          userId: 'USER123',
          referenceId: 'INSP123',
          firstName: 'John',
          lastName: 'Doe',
          middleName: 'M',
          dob: '1990-01-01',
          country: 'Nigeria',
          email: 'john@example.com',
          phone: '+1234567890',
          address: {
            address: '123 Main St',
            city: 'Lagos',
            country: 'Nigeria',
            postalCode: '100001',
            state: 'Lagos',
          },
        };

        userRepository.findById.mockResolvedValue({
          id: 'USER123',
          first_name: 'John',
          last_name: 'Doe',
          email: 'john@example.com',
          country: { code: 'NG', name: 'Nigeria' },
        } as any);
        userRepository.update.mockResolvedValue(undefined);
        userProfileRepository.findByUserId.mockResolvedValue({ id: 'PROFILE123', user_id: 'USER123' } as any);
        userProfileRepository.update.mockResolvedValue(undefined);

        await service['updateUserDetails'](mockData);

        expect(userRepository.update).toHaveBeenCalledWith(
          'USER123',
          {
            phone_number: '+1234567890',
          },
          { trx: expect.any(Object) },
        );
        expect(userProfileRepository.update).toHaveBeenCalledWith(
          { user_id: 'USER123' },
          {
            dob: DateTime.fromFormat('1990-01-01', 'yyyy-MM-dd').toSQL(),
            address_line1: '123 Main St',
            city: 'Lagos',
            postal_code: '100001',
            state_or_province: 'Lagos',
          },
          { trx: expect.any(Object) },
        );
      });

      it('should successfully update user details including names in production environment', async () => {
        jest.spyOn(EnvironmentService, 'isProduction').mockReturnValue(true);

        const mockData: GetKycDetailsResponse = {
          id: 'APP123',
          userId: 'USER123',
          referenceId: 'INSP123',
          firstName: 'John',
          lastName: 'Doe',
          middleName: 'M',
          dob: '1990-01-01',
          country: 'Nigeria',
          email: 'john@example.com',
          phone: '+1234567890',
          address: {
            address: '123 Main St',
            city: 'Lagos',
            country: 'Nigeria',
            postalCode: '100001',
            state: 'Lagos',
          },
        };

        userRepository.findById.mockResolvedValue({
          id: 'USER123',
          first_name: 'John',
          last_name: 'Doe',
          email: 'john@example.com',
          country: { code: 'NG', name: 'Nigeria' },
        } as any);
        userRepository.update.mockResolvedValue(undefined);
        userProfileRepository.findByUserId.mockResolvedValue({ id: 'PROFILE123', user_id: 'USER123' } as any);
        userProfileRepository.update.mockResolvedValue(undefined);

        await service['updateUserDetails'](mockData);

        expect(userRepository.update).toHaveBeenCalledWith(
          'USER123',
          {
            phone_number: '+1234567890',
          },
          { trx: expect.any(Object) },
        );
        expect(userRepository.update).toHaveBeenCalledWith(
          'USER123',
          {
            first_name: 'John',
            last_name: 'Doe',
            middle_name: 'M',
          },
          { trx: expect.any(Object) },
        );
        expect(userProfileRepository.update).toHaveBeenCalledWith(
          { user_id: 'USER123' },
          {
            dob: DateTime.fromFormat('1990-01-01', 'yyyy-MM-dd').toSQL(),
            address_line1: '123 Main St',
            city: 'Lagos',
            postal_code: '100001',
            state_or_province: 'Lagos',
          },
          { trx: expect.any(Object) },
        );
      });

      it('should not update phone_number if user already has one', async () => {
        jest.spyOn(EnvironmentService, 'isProduction').mockReturnValue(false);

        const mockData: GetKycDetailsResponse = {
          id: 'APP123',
          userId: 'USER123',
          referenceId: 'INSP123',
          firstName: 'John',
          lastName: 'Doe',
          middleName: 'M',
          dob: '1990-01-01',
          country: 'Nigeria',
          email: 'john@example.com',
          phone: '+1234567890',
          address: {
            address: '123 Main St',
            city: 'Lagos',
            country: 'Nigeria',
            postalCode: '100001',
            state: 'Lagos',
          },
        };

        userRepository.findById.mockResolvedValue({
          id: 'USER123',
          first_name: 'John',
          last_name: 'Doe',
          email: 'john@example.com',
          phone_number: '+2348012345678',
          country: { code: 'NG', name: 'Nigeria' },
        } as any);
        userRepository.update.mockResolvedValue(undefined);
        userProfileRepository.findByUserId.mockResolvedValue({ id: 'PROFILE123', user_id: 'USER123' } as any);
        userProfileRepository.update.mockResolvedValue(undefined);

        await service['updateUserDetails'](mockData);

        expect(userRepository.update).toHaveBeenCalledWith('USER123', {}, { trx: expect.any(Object) });
      });

      it('should create user profile if not exists', async () => {
        jest.spyOn(EnvironmentService, 'isProduction').mockReturnValue(false);

        const mockData: GetKycDetailsResponse = {
          id: 'APP123',
          userId: 'USER123',
          referenceId: 'INSP123',
          firstName: 'John',
          lastName: 'Doe',
          middleName: 'M',
          dob: '1990-01-01',
          country: 'Nigeria',
          email: 'john@example.com',
          phone: '+1234567890',
          address: {
            address: '123 Main St',
            address2: 'Apt 4',
            city: 'Lagos',
            country: 'Nigeria',
            postalCode: '100001',
            state: 'Lagos',
          },
        };

        userRepository.findById.mockResolvedValue({
          id: 'USER123',
          first_name: 'John',
          last_name: 'Doe',
          email: 'john@example.com',
          country: { code: 'NG', name: 'Nigeria' },
        } as any);
        userRepository.update.mockResolvedValue(undefined);
        userProfileRepository.findByUserId.mockResolvedValue(null);
        userProfileRepository.create.mockResolvedValue({ id: 'PROFILE123', user_id: 'USER123' } as any);

        await service['updateUserDetails'](mockData);

        expect(userProfileRepository.create).toHaveBeenCalledWith(
          {
            user_id: 'USER123',
            dob: DateTime.fromFormat('1990-01-01', 'yyyy-MM-dd').toSQL(),
            address_line1: '123 Main St',
            address_line2: 'Apt 4',
            city: 'Lagos',
            postal_code: '100001',
            state_or_province: 'Lagos',
          },
          expect.any(Object),
        );
      });

      it('should handle user not found error', async () => {
        const mockData: GetKycDetailsResponse = {
          id: 'APP123',
          userId: 'USER123',
          referenceId: 'INSP123',
          firstName: 'John',
          lastName: 'Doe',
          middleName: 'M',
          dob: '1990-01-01',
          country: 'Nigeria',
          email: 'john@example.com',
          phone: '+1234567890',
        };

        userRepository.findById.mockResolvedValue(null);

        await expect(service['updateUserDetails'](mockData)).rejects.toThrow(InternalServerErrorException);
      });

      it('should handle duplicate phone number error and reject KYC verifications', async () => {
        jest.spyOn(EnvironmentService, 'isProduction').mockReturnValue(false);

        const mockData: GetKycDetailsResponse = {
          id: 'APP123',
          userId: 'USER123',
          referenceId: 'INSP123',
          firstName: 'John',
          lastName: 'Doe',
          middleName: 'M',
          dob: '1990-01-01',
          country: 'Nigeria',
          email: 'john@example.com',
          phone: '+1234567890',
          address: {
            address: '123 Main St',
            city: 'Lagos',
            country: 'Nigeria',
            postalCode: '100001',
            state: 'Lagos',
          },
        };

        const mockUser = {
          id: 'USER123',
          first_name: 'John',
          last_name: 'Doe',
          email: 'john@example.com',
          country: { code: 'NG', name: 'Nigeria' },
        };

        const mockKycVerifications = [
          {
            id: 'KYC123',
            user_id: 'USER123',
            status: KycVerificationEnum.PENDING,
          },
        ];

        userRepository.findById.mockResolvedValue(mockUser as any);

        // Simulate UniqueViolationError
        const uniqueViolationError = Object.create(UniqueViolationError.prototype);
        Object.assign(uniqueViolationError, {
          message: 'duplicate key value violates unique constraint',
          client: 'postgres',
          table: 'users',
          columns: ['phone_number'],
          constraint: 'users_phone_number_unique',
        });

        userRepository.update.mockRejectedValue(uniqueViolationError);

        // Mock for rejectKycVerificationsForUser method
        mockKycVerificationRepository.query.mockReturnValue({
          where: jest.fn().mockReturnThis(),
          whereNotIn: jest.fn().mockResolvedValue(mockKycVerifications),
        } as any);

        await expect(service['updateUserDetails'](mockData)).rejects.toThrow('Duplicate phone number detected');

        expect(mockKycVerificationService.updateKycStatus).toHaveBeenCalledWith(
          'KYC123',
          {
            status: KycVerificationEnum.REJECTED,
            error_message: 'duplicate phone number',
          },
          expect.any(Object),
        );

        expect(mockKycStatusLogService.logStatusChange).toHaveBeenCalledWith(
          'KYC123',
          KycVerificationEnum.PENDING,
          KycVerificationEnum.REJECTED,
          'duplicate phone number',
          expect.any(Object),
        );
      });
    });

    describe('createNGVirtualAccount', () => {
      it('should successfully create virtual account for Nigerian user', async () => {
        const mockUser = {
          id: 'USER123',
          first_name: 'John',
          last_name: 'Doe',
          email: 'john@example.com',
          phone_number: '08012345678',
          userProfile: {
            address_line1: '123 Main St',
            address_line2: null,
            gender: 'male',
            dob: '1990-01-01',
          },
        };

        const mockFiatWallet = { id: 'WALLET123' };

        userRepository.findOne.mockResolvedValue(mockUser as any);
        fiatWalletService.getUserWallet.mockResolvedValue(mockFiatWallet as any);
        virtualAccountService.findOrCreateVirtualAccount.mockResolvedValue({
          id: 'VA123',
          account_number: '1234567890',
          account_name: 'John Doe',
          bank_name: '9 Payment Service Bank (9PSB)',
        } as any);

        const result = await service['createNGVirtualAccount'](mockUser as any, {
          bvn: 'A12345678',
          dob: '1990-01-01',
          fiatWallet: mockFiatWallet as any,
        });

        expect(result).toBeDefined();
        expect(virtualAccountService.findOrCreateVirtualAccount).toHaveBeenCalledWith(
          'USER123',
          {
            bvn: 'A12345678',
            fiat_wallet_id: 'WALLET123',
          },
          'main_account',
          expect.any(Object),
        );
        expect(result).toBeDefined();
      });

      it('should return existing virtual account if found', async () => {
        const mockUser = {
          id: 'USER123',
          first_name: 'John',
          last_name: 'Doe',
          email: 'john@example.com',
          phone_number: '08012345678',
          userProfile: {
            address_line1: '123 Main St',
            address_line2: null,
            gender: 'male',
            dob: '1990-01-01',
          },
        };

        const mockFiatWallet = { id: 'WALLET123' };
        const existingVirtualAccount = {
          id: 'VA123',
          account_number: '1234567890',
        };

        userRepository.findOne.mockResolvedValue(mockUser as any);
        fiatWalletService.getUserWallet.mockResolvedValue(mockFiatWallet as any);
        virtualAccountService.findOrCreateVirtualAccount.mockResolvedValue(existingVirtualAccount as any);

        const result = await service['createNGVirtualAccount'](mockUser as any, {
          bvn: 'A12345678',
          dob: '1990-01-01',
          fiatWallet: mockFiatWallet as any,
        });

        expect(virtualAccountService.findOrCreateVirtualAccount).toHaveBeenCalledWith(
          'USER123',
          {
            bvn: 'A12345678',
            fiat_wallet_id: 'WALLET123',
          },
          'main_account',
          expect.any(Object),
        );
        expect(result).toEqual(existingVirtualAccount);
      });

      it('should throw error when user not found', async () => {
        await expect(
          service['createNGVirtualAccount'](null, {
            bvn: 'A12345678',
            dob: '1990-01-01',
            fiatWallet: null,
          }),
        ).rejects.toThrow(InternalServerErrorException);
      });

      it('should throw error when fiat wallet not found', async () => {
        const mockUser = {
          id: 'USER123',
          first_name: 'John',
          last_name: 'Doe',
          email: 'john@example.com',
          phone_number: '08012345678',
          userProfile: {
            address_line1: '123 Main St',
            address_line2: null,
            gender: 'male',
            dob: '1990-01-01',
          },
        };

        await expect(
          service['createNGVirtualAccount'](mockUser as any, {
            bvn: 'A12345678',
            dob: '1990-01-01',
            fiatWallet: null,
          }),
        ).rejects.toThrow(InternalServerErrorException);
      });

      it('should throw error when user address is missing', async () => {
        const mockUser = {
          id: 'USER123',
          first_name: 'John',
          last_name: 'Doe',
          email: 'john@example.com',
          phone_number: '08012345678',
          userProfile: {
            address_line1: null,
            address_line2: null,
            gender: 'male',
            dob: '1990-01-01',
          },
        };

        const mockFiatWallet = { id: 'WALLET123' };

        virtualAccountService.findOrCreateVirtualAccount.mockRejectedValue(new Error('Address required'));

        await expect(
          service['createNGVirtualAccount'](mockUser as any, {
            bvn: 'A12345678',
            dob: '1990-01-01',
            fiatWallet: mockFiatWallet as any,
          }),
        ).rejects.toThrow(InternalServerErrorException);
      });
    });
  });

  describe('SumsubWebhookAuthGuard', () => {
    let guard: SumsubWebhookAuthGuard;
    let mockExecutionContext: jest.Mocked<ExecutionContext>;
    const TEST_WEBHOOK_SECRET = 'test-webhook-secret-key-for-testing';

    beforeEach(async () => {
      // Mock the SumsubConfigProvider to use test secret
      jest.spyOn(SumsubConfigProvider.prototype, 'getConfig').mockReturnValue({
        appToken: 'test-app-token',
        secretKey: 'test-secret-key',
        apiUrl: 'https://test-api.sumsub.com',
        webhook_secret_key: TEST_WEBHOOK_SECRET,
      });

      const module: TestingModule = await Test.createTestingModule({
        providers: [SumsubWebhookAuthGuard],
      }).compile();

      guard = module.get<SumsubWebhookAuthGuard>(SumsubWebhookAuthGuard);
    });

    beforeEach(() => {
      mockExecutionContext = {
        switchToHttp: jest.fn().mockReturnValue({
          getRequest: jest.fn().mockReturnValue({
            headers: {},
            rawBody: Buffer.from('test payload'),
          }),
        }),
      } as any;
    });

    afterEach(() => {
      jest.clearAllMocks();
    });

    describe('canActivate', () => {
      it('should call validateRequest and return the result', async () => {
        const mockRequest = {
          headers: {
            'x-payload-digest-alg': 'HMAC_SHA256_HEX',
            'x-payload-digest': 'valid-digest',
          },
          rawBody: Buffer.from('test payload'),
        };

        mockExecutionContext.switchToHttp().getRequest = jest.fn().mockReturnValue(mockRequest);

        const validateRequestSpy = jest.spyOn(guard as any, 'validateRequest').mockResolvedValue(true);

        const result = await guard.canActivate(mockExecutionContext);

        expect(validateRequestSpy).toHaveBeenCalledWith(mockRequest);
        expect(result).toBe(true);
      });
    });

    describe('validateRequest', () => {
      it('should return true when webhook is valid', async () => {
        const mockRequest = {
          headers: {
            'x-payload-digest-alg': 'HMAC_SHA256_HEX',
            'x-payload-digest': 'valid-digest',
          },
          rawBody: Buffer.from('test payload'),
        };

        const verifyWebhookSenderSpy = jest.spyOn(guard as any, 'verifyWebhookSender').mockResolvedValue(true);

        const result = await guard['validateRequest'](mockRequest as any);

        expect(result).toBe(true);
        expect(verifyWebhookSenderSpy).toHaveBeenCalledWith(mockRequest);
      });

      it('should return false when webhook is invalid', async () => {
        const mockRequest = {
          headers: {
            'x-payload-digest-alg': 'HMAC_SHA256_HEX',
            'x-payload-digest': 'invalid-digest',
          },
          rawBody: Buffer.from('test payload'),
        };

        const verifyWebhookSenderSpy = jest.spyOn(guard as any, 'verifyWebhookSender').mockResolvedValue(false);

        const result = await guard['validateRequest'](mockRequest as any);

        expect(result).toBe(false);
        expect(verifyWebhookSenderSpy).toHaveBeenCalledWith(mockRequest);
      });
    });

    describe('verifyWebhookSender', () => {
      it('should return true for valid HMAC_SHA256_HEX signature', async () => {
        const testPayload = 'test webhook payload';
        const expectedDigest = createHmac('sha256', TEST_WEBHOOK_SECRET).update(testPayload).digest('hex');

        const mockRequest = {
          headers: {
            'x-payload-digest-alg': 'HMAC_SHA256_HEX',
            'x-payload-digest': expectedDigest,
          },
          rawBody: Buffer.from(testPayload),
        };

        const result = await guard['verifyWebhookSender'](mockRequest as any);

        expect(result).toBe(true);
      });

      it('should return true for valid HMAC_SHA1_HEX signature', async () => {
        const testPayload = 'test webhook payload';
        const expectedDigest = createHmac('sha1', TEST_WEBHOOK_SECRET).update(testPayload).digest('hex');

        const mockRequest = {
          headers: {
            'x-payload-digest-alg': 'HMAC_SHA1_HEX',
            'x-payload-digest': expectedDigest,
          },
          rawBody: Buffer.from(testPayload),
        };

        const result = await guard['verifyWebhookSender'](mockRequest as any);

        expect(result).toBe(true);
      });

      it('should return true for valid HMAC_SHA512_HEX signature', async () => {
        const testPayload = 'test webhook payload';
        const expectedDigest = createHmac('sha512', TEST_WEBHOOK_SECRET).update(testPayload).digest('hex');

        const mockRequest = {
          headers: {
            'x-payload-digest-alg': 'HMAC_SHA512_HEX',
            'x-payload-digest': expectedDigest,
          },
          rawBody: Buffer.from(testPayload),
        };

        const result = await guard['verifyWebhookSender'](mockRequest as any);

        expect(result).toBe(true);
      });

      it('should throw InternalServerErrorException for invalid signature', async () => {
        const mockRequest = {
          headers: {
            'x-payload-digest-alg': 'HMAC_SHA256_HEX',
            'x-payload-digest': 'invalid-digest-hash',
          },
          rawBody: Buffer.from('test webhook payload'),
        };

        await expect(guard['verifyWebhookSender'](mockRequest as any)).rejects.toThrow(InternalServerErrorException);
        await expect(guard['verifyWebhookSender'](mockRequest as any)).rejects.toThrow(
          'Webhook signature verification failed',
        );
      });

      it('should throw InternalServerErrorException for unsupported algorithm', async () => {
        const mockRequest = {
          headers: {
            'x-payload-digest-alg': 'UNSUPPORTED_ALGORITHM',
            'x-payload-digest': 'some-digest',
          },
          rawBody: Buffer.from('test webhook payload'),
        };

        await expect(guard['verifyWebhookSender'](mockRequest as any)).rejects.toThrow(InternalServerErrorException);
      });

      it('should throw InternalServerErrorException with correct message for unsupported algorithm', async () => {
        const mockRequest = {
          headers: {
            'x-payload-digest-alg': 'HMAC_MD5_HEX',
            'x-payload-digest': 'some-digest',
          },
          rawBody: Buffer.from('test webhook payload'),
        };

        await expect(guard['verifyWebhookSender'](mockRequest as any)).rejects.toThrow('Unsupported algorithm');
      });

      it('should throw InternalServerErrorException when algorithm header is missing', async () => {
        const mockRequest = {
          headers: {
            'x-payload-digest': 'some-digest',
          },
          rawBody: Buffer.from('test webhook payload'),
        };

        await expect(guard['verifyWebhookSender'](mockRequest as any)).rejects.toThrow(InternalServerErrorException);
      });

      it('should throw InternalServerErrorException when digest header is missing', async () => {
        const mockRequest = {
          headers: {
            'x-payload-digest-alg': 'HMAC_SHA256_HEX',
          },
          rawBody: Buffer.from('test webhook payload'),
        };

        await expect(guard['verifyWebhookSender'](mockRequest as any)).rejects.toThrow(InternalServerErrorException);
        await expect(guard['verifyWebhookSender'](mockRequest as any)).rejects.toThrow(
          'Missing x-payload-digest header',
        );
      });

      it('should throw InternalServerErrorException when rawBody is missing', async () => {
        const mockRequest = {
          headers: {
            'x-payload-digest-alg': 'HMAC_SHA256_HEX',
            'x-payload-digest': 'some-digest',
          },
          rawBody: undefined,
        };

        await expect(guard['verifyWebhookSender'](mockRequest as any)).rejects.toThrow(InternalServerErrorException);
        await expect(guard['verifyWebhookSender'](mockRequest as any)).rejects.toThrow('Request raw body is missing');
      });

      it('should throw InternalServerErrorException when webhook secret key is not configured', async () => {
        jest.spyOn(SumsubConfigProvider.prototype, 'getConfig').mockReturnValue({
          appToken: 'test-app-token',
          secretKey: 'test-secret-key',
          apiUrl: 'https://test-api.sumsub.com',
          webhook_secret_key: '',
        });

        const newGuard = new SumsubWebhookAuthGuard();

        const mockRequest = {
          headers: {
            'x-payload-digest-alg': 'HMAC_SHA256_HEX',
            'x-payload-digest': 'some-digest',
          },
          rawBody: Buffer.from('test payload'),
        };

        await expect(newGuard['verifyWebhookSender'](mockRequest as any)).rejects.toThrow(InternalServerErrorException);
        await expect(newGuard['verifyWebhookSender'](mockRequest as any)).rejects.toThrow(
          'Sumsub webhook secret key is not configured',
        );
      });

      it('should handle empty rawBody correctly', async () => {
        const testPayload = '';
        const expectedDigest = createHmac('sha256', TEST_WEBHOOK_SECRET).update(testPayload).digest('hex');

        const mockRequest = {
          headers: {
            'x-payload-digest-alg': 'HMAC_SHA256_HEX',
            'x-payload-digest': expectedDigest,
          },
          rawBody: Buffer.from(testPayload),
        };

        const result = await guard['verifyWebhookSender'](mockRequest as any);

        expect(result).toBe(true);
      });

      it('should verify signature with large payload', async () => {
        const testPayload = 'a'.repeat(10000);
        const expectedDigest = createHmac('sha256', TEST_WEBHOOK_SECRET).update(testPayload).digest('hex');

        const mockRequest = {
          headers: {
            'x-payload-digest-alg': 'HMAC_SHA256_HEX',
            'x-payload-digest': expectedDigest,
          },
          rawBody: Buffer.from(testPayload),
        };

        const result = await guard['verifyWebhookSender'](mockRequest as any);

        expect(result).toBe(true);
      });

      it('should throw InternalServerErrorException when digest case does not match', async () => {
        const testPayload = 'test webhook payload';
        const expectedDigest = createHmac('sha256', TEST_WEBHOOK_SECRET).update(testPayload).digest('hex');

        const mockRequest = {
          headers: {
            'x-payload-digest-alg': 'HMAC_SHA256_HEX',
            'x-payload-digest': expectedDigest.toUpperCase(),
          },
          rawBody: Buffer.from(testPayload),
        };

        await expect(guard['verifyWebhookSender'](mockRequest as any)).rejects.toThrow(InternalServerErrorException);
        await expect(guard['verifyWebhookSender'](mockRequest as any)).rejects.toThrow(
          'Webhook signature verification failed',
        );
      });
    });
  });

  describe('SumsubWebhookController', () => {
    let controller: SumsubWebhookController;
    let service: jest.Mocked<SumsubWebhookService>;

    const mockSumsubWebhookService = {
      processWebhook: jest.fn(),
    };

    const mockAppLoggerService = {
      logInfo: jest.fn(),
      logError: jest.fn(),
      logUserAction: jest.fn(),
      setContext: jest.fn(),
      createChild: jest.fn(),
    };

    beforeEach(async () => {
      const module: TestingModule = await Test.createTestingModule({
        controllers: [SumsubWebhookController],
        providers: [
          {
            provide: SumsubWebhookService,
            useValue: mockSumsubWebhookService,
          },
          {
            provide: AppLoggerService,
            useValue: mockAppLoggerService,
          },
        ],
      }).compile();

      controller = module.get<SumsubWebhookController>(SumsubWebhookController);
      service = module.get(SumsubWebhookService);
    });

    afterEach(() => {
      jest.clearAllMocks();
    });

    describe('processWebhook', () => {
      it('should successfully process webhook and return transformed response', async () => {
        const mockPayload: SumsubWebhookPayload = {
          applicantId: 'APP123',
          type: 'applicantReviewed',
          externalUserId: 'USER123',
          inspectionId: 'INSP123',
          correlationId: 'CORR123',
          levelName: 'basic-kyc-level',
          createdAtMs: '2024-03-20T10:00:00Z',
          reviewStatus: 'completed',
          reviewResult: {
            reviewAnswer: 'GREEN',
            moderationComment: 'Approved',
          },
        };

        const mockServiceResponse = {
          status: 'success',
          data: {
            applicantId: 'APP123',
            status: 'GREEN',
          },
        };

        service.processWebhook.mockResolvedValue(mockServiceResponse as any);

        const result = await controller.processWebhook(mockPayload);

        expect(service.processWebhook).toHaveBeenCalledWith(mockPayload);
        expect(result).toMatchObject({
          message: 'Successfully Processed Webhook',
          data: mockServiceResponse,
          statusCode: 200,
        });
        expect(result.timestamp).toBeDefined();
      });

      it('should handle applicantCreated webhook', async () => {
        const mockPayload: SumsubWebhookPayload = {
          applicantId: 'APP123',
          type: 'applicantCreated',
          externalUserId: 'USER123',
          inspectionId: 'INSP123',
          correlationId: 'CORR123',
          levelName: 'basic-kyc-level',
          createdAtMs: '2024-03-20T10:00:00Z',
          sandboxMode: false,
          reviewStatus: 'init',
          clientId: 'CLIENT123',
        };

        const mockServiceResponse = {
          status: 'success',
          data: {
            applicantId: 'APP123',
            action: 'created',
          },
        };

        service.processWebhook.mockResolvedValue(mockServiceResponse as any);

        const result = await controller.processWebhook(mockPayload);

        expect(service.processWebhook).toHaveBeenCalledWith(mockPayload);
        expect(result).toMatchObject({
          message: 'Successfully Processed Webhook',
          data: mockServiceResponse,
          statusCode: 200,
        });
        expect(result.timestamp).toBeDefined();
      });

      it('should handle applicantReset webhook', async () => {
        const mockPayload: SumsubWebhookPayload = {
          applicantId: 'APP123',
          type: 'applicantReset',
          externalUserId: 'USER123',
          inspectionId: 'INSP123',
          correlationId: 'CORR123',
          levelName: 'basic-kyc-level',
          createdAtMs: '2024-03-20T10:00:00Z',
        };

        const mockServiceResponse = {
          status: 'success',
          data: {
            applicantId: 'APP123',
            action: 'reset',
          },
        };

        service.processWebhook.mockResolvedValue(mockServiceResponse as any);

        const result = await controller.processWebhook(mockPayload);

        expect(service.processWebhook).toHaveBeenCalledWith(mockPayload);
        expect(result).toMatchObject({
          message: 'Successfully Processed Webhook',
          data: mockServiceResponse,
          statusCode: 200,
        });
        expect(result.timestamp).toBeDefined();
      });

      it('should handle applicantOnHold webhook', async () => {
        const mockPayload: SumsubWebhookPayload = {
          applicantId: 'APP123',
          type: 'applicantOnHold',
          externalUserId: 'USER123',
          inspectionId: 'INSP123',
          correlationId: 'CORR123',
          levelName: 'basic-kyc-level',
          createdAtMs: '2024-03-20T10:00:00Z',
          reviewStatus: 'onHold',
          applicantType: 'INDIVIDUAL',
          sandboxMode: false,
          clientId: 'CLIENT123',
        };

        const mockServiceResponse = {
          status: 'success',
          data: {
            applicantId: 'APP123',
            action: 'on_hold',
          },
        };

        service.processWebhook.mockResolvedValue(mockServiceResponse as any);

        const result = await controller.processWebhook(mockPayload);

        expect(service.processWebhook).toHaveBeenCalledWith(mockPayload);
        expect(result).toMatchObject({
          message: 'Successfully Processed Webhook',
          data: mockServiceResponse,
          statusCode: 200,
        });
        expect(result.timestamp).toBeDefined();
      });

      it('should handle webhook with RED review status', async () => {
        const mockPayload: SumsubWebhookPayload = {
          applicantId: 'APP123',
          type: 'applicantReviewed',
          externalUserId: 'USER123',
          inspectionId: 'INSP123',
          correlationId: 'CORR123',
          levelName: 'basic-kyc-level',
          createdAtMs: '2024-03-20T10:00:00Z',
          reviewStatus: 'completed',
          reviewResult: {
            reviewAnswer: 'RED',
            moderationComment: 'Rejected',
          },
        };

        const mockServiceResponse = {
          status: 'success',
          data: {
            applicantId: 'APP123',
            status: 'RED',
            reason: 'Rejected',
          },
        };

        service.processWebhook.mockResolvedValue(mockServiceResponse as any);

        const result = await controller.processWebhook(mockPayload);

        expect(service.processWebhook).toHaveBeenCalledWith(mockPayload);
        expect(result).toMatchObject({
          message: 'Successfully Processed Webhook',
          data: mockServiceResponse,
          statusCode: 200,
        });
        expect(result.timestamp).toBeDefined();
      });

      it('should handle service errors gracefully', async () => {
        const mockPayload: SumsubWebhookPayload = {
          applicantId: 'APP123',
          type: 'applicantReviewed',
          externalUserId: 'USER123',
          inspectionId: 'INSP123',
          correlationId: 'CORR123',
          levelName: 'basic-kyc-level',
          createdAtMs: '2024-03-20T10:00:00Z',
          reviewStatus: 'completed',
          reviewResult: {
            reviewAnswer: 'GREEN',
            moderationComment: 'Approved',
          },
        };

        const error = new Error('Service processing failed');
        service.processWebhook.mockRejectedValue(error);

        await expect(controller.processWebhook(mockPayload)).rejects.toThrow(error);
        expect(service.processWebhook).toHaveBeenCalledWith(mockPayload);
      });

      it('should verify controller extends BaseController', () => {
        expect(controller).toBeInstanceOf(SumsubWebhookController);
        expect(controller.transformResponse).toBeDefined();
      });

      it('should verify service injection', () => {
        expect(controller['sumsubWebhookService']).toBeDefined();
        expect(controller['sumsubWebhookService']).toBe(service);
      });
    });
  });

  describe('SumsubWebhookService - Additional Coverage', () => {
    let service: SumsubWebhookService;
    let mailerService: any;
    let inAppNotificationService: any;

    const mockKycVerificationService = {
      findByUserId: jest.fn(),
      updateKycStatus: jest.fn(),
      ensureUserTierRecord: jest.fn(),
    };

    const mockKycStatusLogService = {
      logStatusChange: jest.fn(),
    };

    const mockKycAdapter = {
      getKycDetails: jest.fn(),
    };

    const mockUserRepository = {
      findById: jest.fn(),
      findOne: jest.fn(),
      update: jest.fn(),
      transaction: jest.fn().mockImplementation(async (callback: any) => {
        const mockTrx = {};
        return await callback(mockTrx);
      }),
    };

    const mockFiatWalletService = {
      getUserWallet: jest.fn(),
    };

    const mockKycVerificationRepository = {
      query: jest.fn().mockReturnValue({
        where: jest.fn().mockReturnThis(),
        withGraphFetched: jest.fn().mockResolvedValue([]),
        findOne: jest.fn().mockResolvedValue(null),
      }),
      transaction: jest.fn().mockImplementation(async (callback: any) => {
        const mockTrx = {};
        return await callback(mockTrx);
      }),
      create: jest.fn(),
    };

    beforeEach(async () => {
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          SumsubWebhookService,
          { provide: KycVerificationService, useValue: mockKycVerificationService },
          { provide: KycStatusLogService, useValue: mockKycStatusLogService },
          { provide: KYCAdapter, useValue: mockKycAdapter },
          { provide: ParticipantService, useValue: { createParticipant: jest.fn() } },
          {
            provide: UserProfileRepository,
            useValue: { update: jest.fn(), findByUserId: jest.fn(), create: jest.fn() },
          },
          { provide: UserRepository, useValue: mockUserRepository },
          { provide: FiatWalletService, useValue: mockFiatWalletService },
          { provide: VirtualAccountService, useValue: { findOrCreateVirtualAccount: jest.fn() } },
          { provide: BlockchainWalletService, useValue: { createInternalBlockchainAccount: jest.fn() } },
          {
            provide: LockerService,
            useValue: { runWithLock: jest.fn().mockImplementation(async (_key, fn) => await fn()) },
          },
          { provide: MailerService, useValue: { send: jest.fn() } },
          { provide: KycVerificationRepository, useValue: mockKycVerificationRepository },
          { provide: UtilsService, useValue: { hashPassword: jest.fn().mockResolvedValue('hashedValue') } },
          { provide: TierConfigService, useValue: { isTierOneVerification: jest.fn().mockReturnValue(true) } },
          { provide: CountryRepository, useValue: { findOne: jest.fn() } },
          { provide: TierConfigRepository, useValue: { findById: jest.fn() } },
          { provide: UserTierService, useValue: { findOrCreate: jest.fn() } },
          { provide: QueueService, useValue: { addJob: jest.fn(), processJobs: jest.fn() } },
          { provide: InAppNotificationService, useValue: { createNotification: jest.fn() } },
          {
            provide: ExternalAccountService,
            useValue: {
              continueDepositFromWebhook: jest.fn(),
              failDepositFromWebhook: jest.fn(),
              holdDepositFromWebhook: jest.fn(),
            },
          },
          {
            provide: DoshPointsTransactionService,
            useValue: { creditPoints: jest.fn().mockResolvedValue({ is_duplicate: false }) },
          },
        ],
      }).compile();

      service = module.get<SumsubWebhookService>(SumsubWebhookService);
      mailerService = module.get(MailerService);
      inAppNotificationService = module.get(InAppNotificationService);
    });

    afterEach(() => {
      jest.clearAllMocks();
    });

    describe('parseFailureReasons', () => {
      it('should return empty array for null input', () => {
        const result = service['parseFailureReasons'](null);
        expect(result).toEqual([]);
      });

      it('should return empty array for empty string', () => {
        const result = service['parseFailureReasons']('');
        expect(result).toEqual([]);
      });

      it('should parse single line failure reason', () => {
        const result = service['parseFailureReasons']('Document is blurry');
        expect(result).toEqual(['Document is blurry']);
      });

      it('should parse multi-line failure reasons', () => {
        const result = service['parseFailureReasons']('Document is blurry\nFace not visible\nExpired document');
        expect(result).toEqual(['Document is blurry', 'Face not visible', 'Expired document']);
      });

      it('should remove leading bullet points', () => {
        const result = service['parseFailureReasons']('- Document is blurry\n• Face not visible');
        expect(result).toEqual(['Document is blurry', 'Face not visible']);
      });

      it('should trim whitespace from items', () => {
        const result = service['parseFailureReasons']('  Document is blurry  \n  Face not visible  ');
        expect(result).toEqual(['Document is blurry', 'Face not visible']);
      });

      it('should filter out empty lines', () => {
        const result = service['parseFailureReasons']('Document is blurry\n\n\nFace not visible');
        expect(result).toEqual(['Document is blurry', 'Face not visible']);
      });
    });

    describe('getTierOneWorkflowLastLevel', () => {
      it('should return null when workflows is empty', () => {
        jest.spyOn(OneDoshConfiguration, 'getSumsubKycLevelWorkflows').mockReturnValue([]);
        const result = service['getTierOneWorkflowLastLevel']();
        expect(result).toBeNull();
      });

      it('should return null when first workflow has no workflows array', () => {
        jest
          .spyOn(OneDoshConfiguration, 'getSumsubKycLevelWorkflows')
          .mockReturnValue([{ level: SumSubVerificationType.TIER_ONE_VERIFICATION, workflows: [] }]);
        const result = service['getTierOneWorkflowLastLevel']();
        expect(result).toBeNull();
      });

      it('should return last workflow level', () => {
        jest.spyOn(OneDoshConfiguration, 'getSumsubKycLevelWorkflows').mockReturnValue([
          {
            level: SumSubVerificationType.TIER_ONE_VERIFICATION,
            workflows: [SumSubVerificationType.TIER_ONE_VERIFICATION, SumSubVerificationType.ID_AND_LIVENESS],
          },
        ]);
        const result = service['getTierOneWorkflowLastLevel']();
        expect(result).toBe(SumSubVerificationType.ID_AND_LIVENESS);
      });
    });

    describe('ensureUSDFiatWallet', () => {
      it('should create USD fiat wallet successfully', async () => {
        mockFiatWalletService.getUserWallet.mockResolvedValue({ id: 'wallet-123' } as any);

        await service['ensureUSDFiatWallet']('user-123');

        expect(mockFiatWalletService.getUserWallet).toHaveBeenCalledWith('user-123', 'USD', expect.any(Object));
      });

      it('should throw error when wallet creation fails', async () => {
        mockFiatWalletService.getUserWallet.mockResolvedValue(null);

        await expect(service['ensureUSDFiatWallet']('user-123')).rejects.toThrow(InternalServerErrorException);
      });
    });

    describe('getKycVerificationsByLevelName', () => {
      it('should return empty array when workflow not found', async () => {
        jest.spyOn(OneDoshConfiguration, 'getSumsubKycLevelWorkflows').mockReturnValue([]);

        const result = await service['getKycVerificationsByLevelName']('user-123', 'unknown-level');

        expect(result).toEqual([]);
      });
    });

    describe('createUserTier', () => {
      it('should return early when no kyc verifications found', async () => {
        mockKycVerificationRepository.query.mockReturnValue({
          where: jest.fn().mockReturnThis(),
          withGraphFetched: jest.fn().mockResolvedValue([]),
        });

        jest.spyOn(OneDoshConfiguration, 'getSumsubKycLevelWorkflows').mockReturnValue([
          {
            level: SumSubVerificationType.TIER_ONE_VERIFICATION,
            workflows: [SumSubVerificationType.TIER_ONE_VERIFICATION],
          },
        ]);

        await service['createUserTier']('user-123', SumSubVerificationType.TIER_ONE_VERIFICATION);
      });
    });

    describe('handleApplicantPending', () => {
      it('should update status to SUBMITTED for liveness only level', async () => {
        const payload = {
          type: 'applicantPending',
          applicantId: 'APP123',
          externalUserId: 'USER123',
          levelName: 'liveness-only',
        };

        jest.spyOn(OneDoshConfiguration, 'getSumsubKycLevelWorkflows').mockReturnValue([
          {
            level: 'liveness-only' as any,
            workflows: ['liveness-only'] as any,
          },
        ]);

        mockKycVerificationRepository.query.mockReturnValue({
          where: jest.fn().mockReturnThis(),
          withGraphFetched: jest
            .fn()
            .mockResolvedValue([{ id: 'kyc-1', status: 'pending', tierConfig: { id: 'tier-1' } }]),
        });

        await service['handleApplicantPending'](payload as any);

        expect(mockKycVerificationRepository.transaction).toHaveBeenCalled();
      });

      it('should update status to PENDING for non-liveness level', async () => {
        const payload = {
          type: 'applicantPending',
          applicantId: 'APP123',
          externalUserId: 'USER123',
          levelName: 'basic-kyc-level',
        };

        jest.spyOn(OneDoshConfiguration, 'getSumsubKycLevelWorkflows').mockReturnValue([
          {
            level: 'basic-kyc-level' as any,
            workflows: ['basic-kyc-level'] as any,
          },
        ]);

        mockKycVerificationRepository.query.mockReturnValue({
          where: jest.fn().mockReturnThis(),
          withGraphFetched: jest
            .fn()
            .mockResolvedValue([{ id: 'kyc-1', status: 'pending', tierConfig: { id: 'tier-1' } }]),
        });

        await service['handleApplicantPending'](payload as any);

        expect(mockKycVerificationRepository.transaction).toHaveBeenCalled();
      });
    });

    describe('handleKycOnHold', () => {
      it('should update status to IN_REVIEW and send under review email', async () => {
        const payload = {
          type: 'applicantOnHold',
          applicantId: 'APP123',
          externalUserId: 'USER123',
          levelName: 'basic-kyc-level',
        };

        const mockUser = {
          id: 'USER123',
          email: 'user@example.com',
          first_name: 'John',
        };

        jest.spyOn(OneDoshConfiguration, 'getSumsubKycLevelWorkflows').mockReturnValue([
          {
            level: 'basic-kyc-level' as any,
            workflows: ['basic-kyc-level'] as any,
          },
        ]);

        mockKycVerificationRepository.query.mockReturnValue({
          where: jest.fn().mockReturnThis(),
          withGraphFetched: jest
            .fn()
            .mockResolvedValue([{ id: 'kyc-1', status: 'pending', tierConfig: { id: 'tier-1' } }]),
        });

        mockUserRepository.findById.mockResolvedValue(mockUser as any);

        await service['handleKycOnHold'](payload as any);

        expect(mockKycVerificationRepository.transaction).toHaveBeenCalled();
        expect(mockUserRepository.findById).toHaveBeenCalledWith('USER123');
        expect(mailerService.send).toHaveBeenCalledWith(
          expect.objectContaining({
            to: 'user@example.com',
            subject: 'Your KYC Verification is Under Review',
            view: 'kyc_under_review',
          }),
        );
        expect(inAppNotificationService.createNotification).toHaveBeenCalledWith({
          user_id: 'USER123',
          type: 'kyc_in_review',
          title: 'KYC Verification in Progress',
          message:
            "We've received your verification details. Our compliance team is reviewing your submission — you'll be notified once it's approved.",
          metadata: { levelName: 'basic-kyc-level' },
        });
      });
    });

    describe('handleKytTxnApproved', () => {
      it('should skip non-finance transactions', async () => {
        const payload = {
          type: 'applicantKytTxnApproved',
          kytDataTxnId: 'kyt-123',
          kytTxnType: 'withdrawal',
        };

        await service['handleKytTxnApproved'](payload as any);
      });
    });

    describe('handleKytTxnRejected', () => {
      it('should skip non-finance transactions', async () => {
        const payload = {
          type: 'applicantKytTxnRejected',
          kytDataTxnId: 'kyt-123',
          kytTxnType: 'withdrawal',
        };

        await service['handleKytTxnRejected'](payload as any);
      });
    });

    describe('handleKytOnHold', () => {
      it('should skip non-finance transactions', async () => {
        const payload = {
          type: 'applicantKytOnHold',
          kytDataTxnId: 'kyt-123',
          kytTxnType: 'withdrawal',
        };

        await service['handleKytOnHold'](payload as any);
      });
    });

    describe('updateKycAndKycLog', () => {
      it('should log warning when no KYC verifications found', async () => {
        jest.spyOn(OneDoshConfiguration, 'getSumsubKycLevelWorkflows').mockReturnValue([
          {
            level: 'basic-kyc-level' as any,
            workflows: ['basic-kyc-level'] as any,
          },
        ]);

        mockKycVerificationRepository.query.mockReturnValue({
          where: jest.fn().mockReturnThis(),
          withGraphFetched: jest.fn().mockResolvedValue([]),
        });

        const warnSpy = jest.spyOn(service['logger'], 'warn');

        await service['updateKycAndKycLog'](
          { userId: 'user-123' } as any,
          'basic-kyc-level',
          KycVerificationEnum.APPROVED,
        );

        expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('No KYC verifications found'));
      });
    });

    describe('handleKytTxnApproved - finance transactions', () => {
      it('should continue deposit for finance transactions', async () => {
        const payload = {
          type: 'applicantKytTxnApproved',
          kytDataTxnId: 'kyt-123',
          kytTxnType: 'finance',
        };

        const mockExternalAccountService = {
          continueDepositFromWebhook: jest.fn().mockResolvedValue({}),
        };

        (service as any).externalAccountService = mockExternalAccountService;

        await service['handleKytTxnApproved'](payload as any);

        expect(mockExternalAccountService.continueDepositFromWebhook).toHaveBeenCalledWith('kyt-123');
      });
    });

    describe('handleKytTxnRejected - finance transactions', () => {
      it('should fail deposit for finance transactions', async () => {
        const payload = {
          type: 'applicantKytTxnRejected',
          kytDataTxnId: 'kyt-123',
          kytTxnType: 'finance',
          reviewResult: {
            reviewRejectType: 'fraud',
          },
        };

        const mockExternalAccountService = {
          failDepositFromWebhook: jest.fn().mockResolvedValue({}),
        };

        (service as any).externalAccountService = mockExternalAccountService;

        await service['handleKytTxnRejected'](payload as any);

        expect(mockExternalAccountService.failDepositFromWebhook).toHaveBeenCalledWith('kyt-123', 'fraud');
      });

      it('should use default reason when reviewRejectType is missing', async () => {
        const payload = {
          type: 'applicantKytTxnRejected',
          kytDataTxnId: 'kyt-123',
          kytTxnType: 'finance',
          reviewResult: {},
        };

        const mockExternalAccountService = {
          failDepositFromWebhook: jest.fn().mockResolvedValue({}),
        };

        (service as any).externalAccountService = mockExternalAccountService;

        await service['handleKytTxnRejected'](payload as any);

        expect(mockExternalAccountService.failDepositFromWebhook).toHaveBeenCalledWith(
          'kyt-123',
          'Transaction monitoring rejection',
        );
      });
    });

    describe('handleKytOnHold - finance transactions', () => {
      it('should hold deposit for finance transactions', async () => {
        const payload = {
          type: 'applicantKytOnHold',
          kytDataTxnId: 'kyt-123',
          kytTxnType: 'finance',
        };

        const mockExternalAccountService = {
          holdDepositFromWebhook: jest.fn().mockResolvedValue({}),
        };

        (service as any).externalAccountService = mockExternalAccountService;

        await service['handleKytOnHold'](payload as any);

        expect(mockExternalAccountService.holdDepositFromWebhook).toHaveBeenCalledWith('kyt-123');
      });
    });

    describe('createUserTier - Additional Coverage', () => {
      it('should throw error when tier is not found', async () => {
        jest.spyOn(OneDoshConfiguration, 'getSumsubKycLevelWorkflows').mockReturnValue([
          {
            level: SumSubVerificationType.TIER_ONE_VERIFICATION,
            workflows: [SumSubVerificationType.TIER_ONE_VERIFICATION],
          },
        ]);

        mockKycVerificationRepository.query.mockReturnValue({
          where: jest.fn().mockReturnThis(),
          withGraphFetched: jest.fn().mockResolvedValue([
            {
              id: 'kyc-1',
              tierConfig: { id: 'tier-config-1', tier: null },
            },
          ]),
        });

        await expect(
          service['createUserTier']('user-123', SumSubVerificationType.TIER_ONE_VERIFICATION),
        ).rejects.toThrow(InternalServerErrorException);
      });

      it('should create user tier successfully', async () => {
        jest.spyOn(OneDoshConfiguration, 'getSumsubKycLevelWorkflows').mockReturnValue([
          {
            level: SumSubVerificationType.TIER_ONE_VERIFICATION,
            workflows: [SumSubVerificationType.TIER_ONE_VERIFICATION],
          },
        ]);

        mockKycVerificationRepository.query.mockReturnValue({
          where: jest.fn().mockReturnThis(),
          withGraphFetched: jest.fn().mockResolvedValue([
            {
              id: 'kyc-1',
              tierConfig: { id: 'tier-config-1', tier: { id: 'tier-1' } },
            },
          ]),
        });

        const mockUserTierService = {
          findOrCreate: jest.fn().mockResolvedValue({}),
        };
        (service as any).userTierService = mockUserTierService;

        await service['createUserTier']('user-123', SumSubVerificationType.TIER_ONE_VERIFICATION);

        expect(mockUserTierService.findOrCreate).toHaveBeenCalledWith('user-123', 'tier-1');
      });
    });

    describe('createNGVirtualAccount', () => {
      it('should throw error when user is missing', async () => {
        const data = { dob: '1990-01-01', fiatWallet: { id: 'wallet-1' } };

        await expect(service['createNGVirtualAccount'](null as any, data as any)).rejects.toThrow(
          InternalServerErrorException,
        );
      });

      it('should throw error when fiatWallet is missing', async () => {
        const user = { id: 'user-1' };
        const data = { dob: '1990-01-01', fiatWallet: null };

        await expect(service['createNGVirtualAccount'](user as any, data as any)).rejects.toThrow(
          InternalServerErrorException,
        );
      });

      it('should create virtual account without BVN', async () => {
        const user = { id: 'user-1' };
        const data = { dob: '1990-01-01', fiatWallet: { id: 'wallet-1' } };

        const mockUserRepository = {
          transaction: jest.fn().mockImplementation(async (callback) => callback({})),
        };

        const mockVirtualAccountService = {
          findOrCreateVirtualAccount: jest.fn().mockResolvedValue({ id: 'virtual-account-1' }),
        };

        (service as any).userRepository = mockUserRepository;
        (service as any).virtualAccountService = mockVirtualAccountService;

        await service['createNGVirtualAccount'](user as any, data as any);

        expect(mockVirtualAccountService.findOrCreateVirtualAccount).toHaveBeenCalledWith(
          'user-1',
          { fiat_wallet_id: 'wallet-1' },
          'main_account',
          {},
        );
      });

      it('should create virtual account with BVN', async () => {
        const user = { id: 'user-1' };
        const data = { dob: '1990-01-01', bvn: '12345678901', fiatWallet: { id: 'wallet-1' } };

        const mockUserRepository = {
          transaction: jest.fn().mockImplementation(async (callback) => callback({})),
        };

        const mockVirtualAccountService = {
          findOrCreateVirtualAccount: jest.fn().mockResolvedValue({ id: 'virtual-account-1' }),
        };

        (service as any).userRepository = mockUserRepository;
        (service as any).virtualAccountService = mockVirtualAccountService;

        await service['createNGVirtualAccount'](user as any, data as any);

        expect(mockVirtualAccountService.findOrCreateVirtualAccount).toHaveBeenCalledWith(
          'user-1',
          { fiat_wallet_id: 'wallet-1', bvn: '12345678901' },
          'main_account',
          {},
        );
      });
    });

    describe('handleCreateNGNBankAccount', () => {
      it('should create NGN wallet and virtual account for NG user', async () => {
        const data = {
          userId: 'user-1',
          country: 'NGA',
          dob: '1990-01-01',
          idNumber: '12345678901',
        };
        const user = { id: 'user-1' };

        const mockUserRepository = {
          transaction: jest.fn().mockImplementation(async (callback) => callback({})),
        };

        const mockFiatWalletService = {
          getUserWallet: jest.fn().mockResolvedValue({ id: 'wallet-1' }),
        };

        const mockVirtualAccountService = {
          findOrCreateVirtualAccount: jest.fn().mockResolvedValue({ id: 'virtual-account-1' }),
        };

        (service as any).userRepository = mockUserRepository;
        (service as any).fiatWalletService = mockFiatWalletService;
        (service as any).virtualAccountService = mockVirtualAccountService;

        await service['handleCreateNGNBankAccount'](data as any, user);

        expect(mockFiatWalletService.getUserWallet).toHaveBeenCalledWith('user-1', 'NGN', {});
        expect(mockVirtualAccountService.findOrCreateVirtualAccount).toHaveBeenCalled();
      });

      it('should throw error when NGN wallet creation fails', async () => {
        const data = { userId: 'user-1', country: 'NGA', dob: '1990-01-01' };
        const user = { id: 'user-1' };

        const mockUserRepository = {
          transaction: jest.fn().mockImplementation(async (callback) => callback({})),
        };

        const mockFiatWalletService = {
          getUserWallet: jest.fn().mockResolvedValue(null),
        };

        (service as any).userRepository = mockUserRepository;
        (service as any).fiatWalletService = mockFiatWalletService;

        await expect(service['handleCreateNGNBankAccount'](data as any, user)).rejects.toThrow(
          InternalServerErrorException,
        );
      });
    });

    describe('processVerificationRequirements', () => {
      it('should update existing KYC record', async () => {
        const tierConfig = {
          id: 'tier-config-1',
          tierConfigVerificationRequirements: [{ id: 'req-1' }],
        };
        const data = {
          userId: 'user-1',
          submittedAt: '2023-01-01',
          failureReason: 'Test failure',
        };

        const existingKycRecord = { id: 'kyc-1', attempt: 1, status: 'pending' };

        mockKycVerificationRepository.transaction.mockImplementation(async (callback) => callback({}));
        mockKycVerificationRepository.query.mockReturnValue({
          findOne: jest.fn().mockResolvedValue(existingKycRecord),
        });
        mockKycVerificationService.updateKycStatus.mockResolvedValue({});
        mockKycStatusLogService.logStatusChange.mockResolvedValue({});

        await service['processVerificationRequirements'](
          tierConfig as any,
          data as any,
          'basic-kyc-level',
          KycVerificationEnum.APPROVED,
          {},
        );

        expect(mockKycVerificationService.updateKycStatus).toHaveBeenCalled();
      });

      it('should create new KYC record when not exists', async () => {
        const tierConfig = {
          id: 'tier-config-1',
          tierConfigVerificationRequirements: [{ id: 'req-1' }],
        };
        const data = {
          userId: 'user-1',
          submittedAt: '2023-01-01',
        };

        mockKycVerificationRepository.transaction.mockImplementation(async (callback) => callback({}));
        mockKycVerificationRepository.query.mockReturnValue({
          findOne: jest.fn().mockResolvedValue(null),
        });
        mockKycVerificationRepository.create.mockResolvedValue({ id: 'new-kyc-1' });
        mockKycStatusLogService.logStatusChange.mockResolvedValue({});

        await service['processVerificationRequirements'](
          tierConfig as any,
          data as any,
          'basic-kyc-level',
          KycVerificationEnum.PENDING,
          {},
        );

        expect(mockKycVerificationRepository.create).toHaveBeenCalled();
      });

      it('should ensure user tier record when status is APPROVED', async () => {
        const tierConfig = {
          id: 'tier-config-1',
          tierConfigVerificationRequirements: [{ id: 'req-1' }],
        };
        const data = {
          userId: 'user-1',
          submittedAt: '2023-01-01',
        };

        const existingKycRecord = { id: 'kyc-1', attempt: 1, status: 'pending' };

        mockKycVerificationRepository.transaction.mockImplementation(async (callback) => callback({}));
        mockKycVerificationRepository.query.mockReturnValue({
          findOne: jest.fn().mockResolvedValue(existingKycRecord),
        });
        mockKycVerificationService.updateKycStatus.mockResolvedValue({});
        mockKycStatusLogService.logStatusChange.mockResolvedValue({});
        mockKycVerificationService.ensureUserTierRecord.mockResolvedValue({});

        await service['processVerificationRequirements'](
          tierConfig as any,
          data as any,
          'basic-kyc-level',
          KycVerificationEnum.APPROVED,
          {},
        );

        expect(mockKycVerificationService.ensureUserTierRecord).toHaveBeenCalled();
      });
    });

    describe('updateKycAndKycLog - with tierConfig without verificationRequirements', () => {
      it('should warn when no verification requirements found', async () => {
        jest.spyOn(OneDoshConfiguration, 'getSumsubKycLevelWorkflows').mockReturnValue([
          {
            level: 'basic-kyc-level' as any,
            workflows: ['basic-kyc-level'] as any,
          },
        ]);

        mockKycVerificationRepository.query.mockReturnValue({
          where: jest.fn().mockReturnThis(),
          withGraphFetched: jest.fn().mockResolvedValue([
            {
              id: 'kyc-1',
              tierConfig: { id: 'tier-config-1', tierConfigVerificationRequirements: null },
            },
          ]),
        });

        const warnSpy = jest.spyOn(service['logger'], 'warn');

        await service['updateKycAndKycLog'](
          { userId: 'user-123', idDocument: { number: '12345', type: 'PASSPORT' } } as any,
          'basic-kyc-level',
          KycVerificationEnum.APPROVED,
        );

        expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('No verification requirements found'));
      });
    });

    describe('updateKycAndKycLog - with RESUBMISSION_REQUESTED status', () => {
      it('should add failure_correction to metadata', async () => {
        jest.spyOn(OneDoshConfiguration, 'getSumsubKycLevelWorkflows').mockReturnValue([
          {
            level: 'basic-kyc-level' as any,
            workflows: ['basic-kyc-level'] as any,
          },
        ]);

        const existingKycRecord = { id: 'kyc-1', attempt: 1, status: 'pending' };

        mockKycVerificationRepository.query.mockReturnValue({
          where: jest.fn().mockReturnThis(),
          withGraphFetched: jest.fn().mockResolvedValue([
            {
              id: 'kyc-1',
              tierConfig: { id: 'tier-config-1', tierConfigVerificationRequirements: [{ id: 'req-1' }] },
            },
          ]),
        });
        mockKycVerificationRepository.transaction.mockImplementation(async (callback) => callback({}));
        mockKycVerificationRepository.query.mockReturnValue({
          where: jest.fn().mockReturnThis(),
          withGraphFetched: jest.fn().mockResolvedValue([
            {
              id: 'kyc-1',
              tierConfig: { id: 'tier-config-1', tierConfigVerificationRequirements: [{ id: 'req-1' }] },
            },
          ]),
          findOne: jest.fn().mockResolvedValue(existingKycRecord),
        });

        await service['updateKycAndKycLog'](
          {
            userId: 'user-123',
            idDocument: { number: '12345', type: 'PASSPORT' },
            failureCorrection: 'Please upload clearer document',
            submittedAt: '2023-01-01',
          } as any,
          'basic-kyc-level',
          KycVerificationEnum.RESUBMISSION_REQUESTED,
        );
      });
    });
  });
});
