import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { CardAdapter } from '../../adapters/card/card.adapter';
import { CardLimitFrequency, CardProvider, CardStatus, CardType } from '../../adapters/card/card.adapter.interface';
import { KYCAdapter } from '../../adapters/kyc/kyc-adapter';
import { EnvironmentService } from '../../config';
import { CardConfigProvider } from '../../config/card.config';
import { EventEmitterService } from '../../services/eventEmitter/eventEmitter.service';

import { StableCoinsService } from '../../config/onedosh/stablecoins.config';
import { RainConfigProvider } from '../../config/rain.config';

import { CardFeeType, CardFeesService, MAX_INSUFFICIENT_FUNDS_DECLINES } from '../../config/onedosh/cardFees.config';
import { OneDoshSupportedCryptoNetworks } from '../../config/onedosh/onedosh.config.interface';
import { ICardStatus, IIssuanceFeeStatus } from '../../database/models/card/card.interface';
import {
  CardTransactionDrCr,
  CardTransactionStatus,
  CardTransactionType,
} from '../../database/models/cardTransaction/cardTransaction.interface';
import { CardTransactionDisputeStatus } from '../../database/models/cardTransactionDispute/cardTransactionDispute.interface';
import { ICardUserStatus } from '../../database/models/cardUser';
import { UserModel } from '../../database/models/user/user.model';
import { CardCreatedMail } from '../../notifications/mails/card_created_mail';
import { CardManagementMail } from '../../notifications/mails/card_management_mail';
import { LockerService } from '../../services/locker/locker.service';
import { PushNotificationService } from '../../services/pushNotification/pushNotification.service';
import { CardFundingProcessor } from '../../services/queue/processors/card/card-fund.processor';
import { CardFundingFromNGNProcessor } from '../../services/queue/processors/card/card-funding-from-ngn.processor';
import { MailerService } from '../../services/queue/processors/mailer/mailer.service';
import { KycVerificationRepository } from '../auth/kycVerification/kycVerification.repository';
import { UserRepository } from '../auth/user/user.repository';
import { UserProfileRepository } from '../auth/userProfile/userProfile.repository';
import { BlockchainWalletService } from '../blockchainWallet/blockchainWallet.service';
import { CountryRepository } from '../country/country.repository';
import { DepositAddressRepository } from '../depositAddress/depositAddress.repository';
import { DepositAddressService } from '../depositAddress/depositAddress.service';
import { NgToUsdExchangeEscrowService } from '../exchange/fiat-exchange/ng-to-usd-exchange.service/ng-to-usd-exchange.escrow.service';
import { NgToUsdExchangeService } from '../exchange/fiat-exchange/ng-to-usd-exchange.service/ng-to-usd-exchange.service';
import { FiatWalletService } from '../fiatWallet/fiatWallet.service';
import { IN_APP_NOTIFICATION_TYPE } from '../inAppNotification/inAppNotification.enum';
import { InAppNotificationService } from '../inAppNotification/inAppNotification.service';
import { TransactionRepository } from '../transaction/transaction.repository';
import * as RainWebhookInterface from '../webhooks/rain/rain-webhook.interface';
import { CardNotificationType } from './card.interface';
import { CardService } from './card.service';
import { CardFundDto, CardFundRails } from './dto/cardFund.dto';
import { CreateCardDto } from './dto/createCard.dto';
import { FreezeCardDto } from './dto/freezeCard.dto';
import { ReissueCardDto } from './dto/reissueCard.dto';
import { UpdateCardLimitDto } from './dto/updateCardLimit.dto';
import { CardRepository } from './repository/card.repository';
import { CardTransactionRepository } from './repository/cardTransaction.repository';
import { CardTransactionDisputeRepository } from './repository/cardTransactionDispute.repository';
import { CardTransactionDisputeEventRepository } from './repository/cardTransactionDisputeEvent.repository';
import { CardUserRepository } from './repository/cardUser.repository';

describe('CardService', () => {
  let service: CardService;
  let testingModule: TestingModule;
  let cardUserRepository: jest.Mocked<CardUserRepository>;
  let cardRepository: jest.Mocked<CardRepository>;
  let cardTransactionRepository: jest.Mocked<CardTransactionRepository>;
  let cardTransactionDisputeRepository: jest.Mocked<CardTransactionDisputeRepository>;
  let cardTransactionDisputeEventRepository: jest.Mocked<CardTransactionDisputeEventRepository>;
  let cardAdapter: jest.Mocked<CardAdapter>;
  let userProfileRepository: jest.Mocked<UserProfileRepository>;
  let inAppNotificationService: jest.Mocked<InAppNotificationService>;
  let mailerService: jest.Mocked<MailerService>;
  let pushNotificationService: jest.Mocked<PushNotificationService>;
  let cardFundingProcessor: jest.Mocked<CardFundingProcessor>;
  let kycAdapter: jest.Mocked<KYCAdapter>;
  let kycVerificationRepository: jest.Mocked<KycVerificationRepository>;
  let blockchainWalletService: jest.Mocked<BlockchainWalletService>;
  let transactionRepository: jest.Mocked<TransactionRepository>;
  let userRepository: jest.Mocked<UserRepository>;
  let lockerService: jest.Mocked<LockerService>;
  let countryRepository: jest.Mocked<CountryRepository>;

  const mockUser = {
    id: 'user-123',
    first_name: 'John',
    last_name: 'Doe',
    email: 'john@example.com',
    phone_number: '+1234567890',
    country_id: 'US',
    country: { name: 'United States' },
  } as UserModel;

  const mockCardUser: any = {
    id: 'card-user-123',
    user_id: 'user-123',
    provider_ref: 'provider-ref-123',
    status: ICardUserStatus.APPROVED,
    provider_status: 'approved',
  };

  const mockCard: any = {
    id: 'card-123',
    user_id: 'user-123',
    card_user_id: 'card-user-123',
    provider_ref: 'provider-card-ref-123',
    status: ICardStatus.ACTIVE,
    limit: 1000,
    limit_frequency: CardLimitFrequency.PER_30_DAY_PERIOD,
    balance: 0,
    is_freezed: false,
  };

  const mockUserProfile = {
    id: 'profile-123',
    user_id: 'user-123',
    address_line1: '123 Main St',
    address_line2: 'Apt 4B',
    city: 'New York',
    state_or_province: 'NY',
    postal_code: '10001',
    notification_token: 'push-token-123',
  };

  beforeEach(async () => {
    testingModule = await Test.createTestingModule({
      providers: [
        CardService,
        {
          provide: CardUserRepository,
          useValue: {
            findOne: jest.fn(),
            create: jest.fn(),
            update: jest.fn(),
          },
        },
        {
          provide: CardRepository,
          useValue: {
            findOne: jest.fn(),
            create: jest.fn(),
            update: jest.fn(),
            findSync: jest.fn(),
            findNonCanceledCardByUserId: jest.fn(),
            findLastCanceledCardWithBalance: jest.fn(),
            transaction: jest.fn(),
          },
        },
        {
          provide: CardTransactionRepository,
          useValue: {
            create: jest.fn(),
            update: jest.fn(),
            findAll: jest.fn(),
            findOne: jest.fn(),
            findPreviousSuccessfulDeposits: jest.fn(),
            findAllWithCardLastFourDigits: jest.fn(),
            findByIdWithCardLastFourDigits: jest.fn(),
            transaction: jest.fn(),
          },
        },
        {
          provide: CardTransactionDisputeRepository,
          useValue: {
            create: jest.fn(),
            findOne: jest.fn(),
            update: jest.fn(),
          },
        },
        {
          provide: CardTransactionDisputeEventRepository,
          useValue: {
            create: jest.fn(),
            findOne: jest.fn(),
            findSync: jest.fn().mockResolvedValue([]),
          },
        },
        {
          provide: CardAdapter,
          useValue: {
            createCardUser: jest.fn(),
            createCard: jest.fn(),
            updateCard: jest.fn(),
            getDecryptedCardSecrets: jest.fn(),
            getOccupations: jest.fn(),
            getUserContracts: jest.fn(),
            createUserContract: jest.fn(),
            createCharge: jest.fn(),
            createDispute: jest.fn(),
          },
        },
        {
          provide: KYCAdapter,
          useValue: {
            getComplianceToken: jest.fn(),
            getKycDetails: jest.fn(),
            generateShareToken: jest.fn(),
          },
        },
        {
          provide: DepositAddressRepository,
          useValue: {
            findOne: jest.fn(),
            create: jest.fn(),
            findLatestRainDepositAddressByUserId: jest.fn(),
          },
        },
        {
          provide: DepositAddressService,
          useValue: {
            getRainDepositAddressForDefaultChain: jest.fn(),
          },
        },
        {
          provide: KycVerificationRepository,
          useValue: {
            findOne: jest.fn(),
            query: jest.fn().mockReturnThis(),
            where: jest.fn().mockReturnThis(),
            first: jest.fn(),
          },
        },
        {
          provide: BlockchainWalletService,
          useValue: {
            initiateTransaction: jest.fn(),
            createCustomWallet: jest.fn(),
          },
        },
        {
          provide: FiatWalletService,
          useValue: {
            transferUSDToRainDepositAddress: jest.fn(),
            getUserWallet: jest.fn(),
          },
        },
        {
          provide: UserProfileRepository,
          useValue: {
            findByUserId: jest.fn(),
          },
        },
        {
          provide: InAppNotificationService,
          useValue: {
            createNotification: jest.fn(),
          },
        },
        {
          provide: MailerService,
          useValue: {
            send: jest.fn(),
          },
        },
        {
          provide: CardFundingProcessor,
          useValue: {
            queueCardFunding: jest.fn(),
          },
        },
        {
          provide: CardFundingFromNGNProcessor,
          useValue: {
            queueCardFundingFromNGN: jest.fn(),
          },
        },
        {
          provide: NgToUsdExchangeService,
          useValue: {
            initializeNgToUSDExchange: jest.fn(),
            executeExchange: jest.fn(),
          },
        },
        {
          provide: NgToUsdExchangeEscrowService,
          useValue: {
            storeTransactionData: jest.fn(),
            getTransactionData: jest.fn(),
            removeTransactionData: jest.fn(),
            storeCardFundingContext: jest.fn(),
            getCardFundingContext: jest.fn(),
            updateCardFundingContext: jest.fn(),
            removeCardFundingContext: jest.fn(),
          },
        },
        {
          provide: TransactionRepository,
          useValue: {
            create: jest.fn(),
          },
        },
        {
          provide: UserRepository,
          useValue: {
            findActiveById: jest.fn(),
          },
        },
        {
          provide: LockerService,
          useValue: {
            withLock: jest.fn(),
          },
        },
        {
          provide: CountryRepository,
          useValue: {
            findById: jest.fn(),
          },
        },
        {
          provide: EventEmitterService,
          useValue: {
            emit: jest.fn(),
          },
        },
        {
          provide: PushNotificationService,
          useValue: {
            sendPushNotification: jest.fn(),
          },
        },
      ],
    }).compile();

    service = testingModule.get<CardService>(CardService);

    // Initialize config after service is created
    jest.spyOn(CardConfigProvider.prototype, 'getConfig').mockReturnValue({
      default_card_provider: CardProvider.RAIN,
    } as any);
    jest.spyOn(RainConfigProvider.prototype, 'getConfig').mockReturnValue({} as any);
    service.onModuleInit();

    cardUserRepository = testingModule.get(CardUserRepository) as jest.Mocked<CardUserRepository>;
    cardRepository = testingModule.get(CardRepository) as jest.Mocked<CardRepository>;
    cardTransactionRepository = testingModule.get(CardTransactionRepository) as jest.Mocked<CardTransactionRepository>;
    cardTransactionDisputeRepository = testingModule.get(
      CardTransactionDisputeRepository,
    ) as jest.Mocked<CardTransactionDisputeRepository>;

    cardTransactionDisputeEventRepository = testingModule.get(
      CardTransactionDisputeEventRepository,
    ) as jest.Mocked<CardTransactionDisputeEventRepository>;

    cardAdapter = testingModule.get(CardAdapter) as jest.Mocked<CardAdapter>;
    userProfileRepository = testingModule.get(UserProfileRepository) as jest.Mocked<UserProfileRepository>;
    inAppNotificationService = testingModule.get(InAppNotificationService) as jest.Mocked<InAppNotificationService>;
    mailerService = testingModule.get(MailerService) as jest.Mocked<MailerService>;
    pushNotificationService = testingModule.get(PushNotificationService) as jest.Mocked<PushNotificationService>;
    cardFundingProcessor = testingModule.get(CardFundingProcessor) as jest.Mocked<CardFundingProcessor>;
    kycAdapter = testingModule.get(KYCAdapter) as jest.Mocked<KYCAdapter>;
    kycVerificationRepository = testingModule.get(KycVerificationRepository) as jest.Mocked<KycVerificationRepository>;
    blockchainWalletService = testingModule.get(BlockchainWalletService) as jest.Mocked<BlockchainWalletService>;
    transactionRepository = testingModule.get(TransactionRepository) as jest.Mocked<TransactionRepository>;
    userRepository = testingModule.get(UserRepository) as jest.Mocked<UserRepository>;
    lockerService = testingModule.get(LockerService) as jest.Mocked<LockerService>;
    countryRepository = testingModule.get(CountryRepository) as jest.Mocked<CountryRepository>;

    jest.clearAllMocks();
  });

  describe('create', () => {
    const createCardUserDto = {} as any;
    const ipAddress = '192.168.1.1';

    const mockKycVerification = {
      id: 'kyc-123',
      user_id: 'user-123',
      provider_ref: 'applicant-123',
    };

    const mockKycDetails = {
      data: {
        expectedAnnualSalary: '50000',
        expectedMonthlyPaymentsUsd: '2000',
        mostRecentOccupation: 'Software Engineer',
        accountPurpose: 'Personal use',
      },
    };

    const mockShareTokenResponse = {
      data: {
        token: 'share-token-123',
      },
    };

    const mockBlockchainWallet = {
      address: '0x1234567890abcdef',
      network: 'ethereum',
    };

    const mockCardUserResponse = {
      providerRef: 'provider-ref-123',
      status: 'approved',
      applicationStatusReason: 'Approved',
    };

    it('should create card user successfully', async () => {
      cardUserRepository.findOne.mockResolvedValue(null);
      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        first: jest.fn().mockResolvedValue(mockKycVerification),
      };
      kycVerificationRepository.query.mockReturnValue(mockQueryBuilder as any);
      kycAdapter.getKycDetails.mockResolvedValue(mockKycDetails as any);
      kycAdapter.generateShareToken.mockResolvedValue(mockShareTokenResponse as any);
      blockchainWalletService.createCustomWallet.mockResolvedValue(mockBlockchainWallet as any);
      cardAdapter.createCardUser.mockResolvedValue(mockCardUserResponse as any);
      cardUserRepository.create.mockResolvedValue(mockCardUser as any);

      jest.spyOn(RainConfigProvider.prototype, 'getConfig').mockReturnValue({
        clientId: 'test-client-id',
      } as any);

      const result = await service.create(mockUser, createCardUserDto, ipAddress);

      expect(result).toBeDefined();
      expect(kycVerificationRepository.query).toHaveBeenCalled();
      expect(kycAdapter.getKycDetails).toHaveBeenCalled();
      expect(kycAdapter.generateShareToken).toHaveBeenCalled();
      expect(blockchainWalletService.createCustomWallet).toHaveBeenCalledWith(
        mockUser,
        expect.objectContaining({
          network: expect.any(String),
          rail: expect.any(String),
          useDefault: true,
          useBase: true,
        }),
      );
      expect(cardAdapter.createCardUser).toHaveBeenCalled();
      expect(cardUserRepository.create).toHaveBeenCalled();
    });

    it('should throw BadRequestException if card user already exists', async () => {
      cardUserRepository.findOne.mockResolvedValue(mockCardUser as any);

      await expect(service.create(mockUser, createCardUserDto, ipAddress)).rejects.toThrow(BadRequestException);
      await expect(service.create(mockUser, createCardUserDto, ipAddress)).rejects.toThrow(
        'Card user already exists for this user',
      );
    });

    it('should throw NotFoundException if KYC verification not found', async () => {
      cardUserRepository.findOne.mockResolvedValue(null);
      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        first: jest.fn().mockResolvedValue(null),
      };
      kycVerificationRepository.query.mockReturnValue(mockQueryBuilder as any);

      await expect(service.create(mockUser, createCardUserDto, ipAddress)).rejects.toThrow(NotFoundException);
      await expect(service.create(mockUser, createCardUserDto, ipAddress)).rejects.toThrow(
        'KYC verification not found for user',
      );
    });

    it('should throw BadRequestException if KYC not completed', async () => {
      cardUserRepository.findOne.mockResolvedValue(null);
      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        first: jest.fn().mockResolvedValue({
          ...mockKycVerification,
          provider_ref: null,
        }),
      };
      kycVerificationRepository.query.mockReturnValue(mockQueryBuilder as any);

      await expect(service.create(mockUser, createCardUserDto, ipAddress)).rejects.toThrow(BadRequestException);
      await expect(service.create(mockUser, createCardUserDto, ipAddress)).rejects.toThrow(
        'KYC has not been completed',
      );
    });

    it('should throw BadRequestException if IP address not provided', async () => {
      cardUserRepository.findOne.mockResolvedValue(null);
      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        first: jest.fn().mockResolvedValue(mockKycVerification),
      };
      kycVerificationRepository.query.mockReturnValue(mockQueryBuilder as any);
      kycAdapter.getKycDetails.mockResolvedValue(mockKycDetails as any);
      kycAdapter.generateShareToken.mockResolvedValue(mockShareTokenResponse as any);
      blockchainWalletService.createCustomWallet.mockResolvedValue(mockBlockchainWallet as any);

      jest.spyOn(RainConfigProvider.prototype, 'getConfig').mockReturnValue({
        clientId: 'test-client-id',
      } as any);

      await expect(service.create(mockUser, createCardUserDto, undefined)).rejects.toThrow(BadRequestException);
      await expect(service.create(mockUser, createCardUserDto, undefined)).rejects.toThrow(
        'IP address is required for card user creation',
      );
    });

    it('should throw BadRequestException if share token generation fails', async () => {
      cardUserRepository.findOne.mockResolvedValue(null);
      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        first: jest.fn().mockResolvedValue(mockKycVerification),
      };
      kycVerificationRepository.query.mockReturnValue(mockQueryBuilder as any);
      kycAdapter.getKycDetails.mockResolvedValue(mockKycDetails as any);
      kycAdapter.generateShareToken.mockResolvedValue({ data: null } as any);

      jest.spyOn(RainConfigProvider.prototype, 'getConfig').mockReturnValue({
        clientId: 'test-client-id',
      } as any);

      await expect(service.create(mockUser, createCardUserDto, ipAddress)).rejects.toThrow(BadRequestException);
      await expect(service.create(mockUser, createCardUserDto, ipAddress)).rejects.toThrow(
        'Failed to generate KYC share token',
      );
    });

    it('should handle errors and throw BadRequestException', async () => {
      cardUserRepository.findOne.mockRejectedValue(new Error('Database error'));

      await expect(service.create(mockUser, createCardUserDto, ipAddress)).rejects.toThrow(BadRequestException);
      await expect(service.create(mockUser, createCardUserDto, ipAddress)).rejects.toThrow(
        'Failed to create card user',
      );
    });

    it('should use walletAddress in non-production environment', async () => {
      jest.spyOn(EnvironmentService, 'isProduction').mockReturnValue(false);
      cardUserRepository.findOne.mockResolvedValue(null);
      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        first: jest.fn().mockResolvedValue(mockKycVerification),
      };
      kycVerificationRepository.query.mockReturnValue(mockQueryBuilder as any);
      kycAdapter.getKycDetails.mockResolvedValue(mockKycDetails as any);
      kycAdapter.generateShareToken.mockResolvedValue(mockShareTokenResponse as any);
      blockchainWalletService.createCustomWallet.mockResolvedValue(mockBlockchainWallet as any);
      cardAdapter.createCardUser.mockResolvedValue(mockCardUserResponse as any);
      cardUserRepository.create.mockResolvedValue(mockCardUser as any);

      jest.spyOn(RainConfigProvider.prototype, 'getConfig').mockReturnValue({
        clientId: 'test-client-id',
      } as any);

      await service.create(mockUser, createCardUserDto, ipAddress);

      expect(cardAdapter.createCardUser).toHaveBeenCalledWith(
        expect.objectContaining({
          cardStablecoinUserAddress: expect.objectContaining({
            walletAddress: mockBlockchainWallet.address,
          }),
        }),
      );
    });

    it('should use solanaAddress in production environment', async () => {
      jest.spyOn(EnvironmentService, 'isProduction').mockReturnValue(true);
      cardUserRepository.findOne.mockResolvedValue(null);
      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        first: jest.fn().mockResolvedValue(mockKycVerification),
      };
      kycVerificationRepository.query.mockReturnValue(mockQueryBuilder as any);
      kycAdapter.getKycDetails.mockResolvedValue(mockKycDetails as any);
      kycAdapter.generateShareToken.mockResolvedValue(mockShareTokenResponse as any);
      blockchainWalletService.createCustomWallet.mockResolvedValue(mockBlockchainWallet as any);
      cardAdapter.createCardUser.mockResolvedValue(mockCardUserResponse as any);
      cardUserRepository.create.mockResolvedValue(mockCardUser as any);

      jest.spyOn(RainConfigProvider.prototype, 'getConfig').mockReturnValue({
        clientId: 'test-client-id',
      } as any);

      await service.create(mockUser, createCardUserDto, ipAddress);

      expect(cardAdapter.createCardUser).toHaveBeenCalledWith(
        expect.objectContaining({
          cardStablecoinUserAddress: expect.objectContaining({
            solanaAddress: mockBlockchainWallet.address,
          }),
        }),
      );
    });

    it('should map provider status "approved" to APPROVED', async () => {
      cardUserRepository.findOne.mockResolvedValue(null);
      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        first: jest.fn().mockResolvedValue(mockKycVerification),
      };
      kycVerificationRepository.query.mockReturnValue(mockQueryBuilder as any);
      kycAdapter.getKycDetails.mockResolvedValue(mockKycDetails as any);
      kycAdapter.generateShareToken.mockResolvedValue(mockShareTokenResponse as any);
      blockchainWalletService.createCustomWallet.mockResolvedValue(mockBlockchainWallet as any);
      cardAdapter.createCardUser.mockResolvedValue({
        ...mockCardUserResponse,
        status: 'approved',
      } as any);
      cardUserRepository.create.mockResolvedValue({
        ...mockCardUser,
        status: ICardUserStatus.APPROVED,
      } as any);

      jest.spyOn(RainConfigProvider.prototype, 'getConfig').mockReturnValue({
        clientId: 'test-client-id',
      } as any);

      await service.create(mockUser, createCardUserDto, ipAddress);

      expect(cardUserRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          status: ICardUserStatus.APPROVED,
        }),
      );
    });

    it('should map provider status "rejected" to REJECTED', async () => {
      cardUserRepository.findOne.mockResolvedValue(null);
      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        first: jest.fn().mockResolvedValue(mockKycVerification),
      };
      kycVerificationRepository.query.mockReturnValue(mockQueryBuilder as any);
      kycAdapter.getKycDetails.mockResolvedValue(mockKycDetails as any);
      kycAdapter.generateShareToken.mockResolvedValue(mockShareTokenResponse as any);
      blockchainWalletService.createCustomWallet.mockResolvedValue(mockBlockchainWallet as any);
      cardAdapter.createCardUser.mockResolvedValue({
        ...mockCardUserResponse,
        status: 'rejected',
      } as any);
      cardUserRepository.create.mockResolvedValue(mockCardUser as any);

      jest.spyOn(RainConfigProvider.prototype, 'getConfig').mockReturnValue({
        clientId: 'test-client-id',
      } as any);

      await service.create(mockUser, createCardUserDto, ipAddress);

      expect(cardUserRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          status: ICardUserStatus.REJECTED,
        }),
      );
    });

    it('should map provider status "denied" to REJECTED', async () => {
      cardUserRepository.findOne.mockResolvedValue(null);
      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        first: jest.fn().mockResolvedValue(mockKycVerification),
      };
      kycVerificationRepository.query.mockReturnValue(mockQueryBuilder as any);
      kycAdapter.getKycDetails.mockResolvedValue(mockKycDetails as any);
      kycAdapter.generateShareToken.mockResolvedValue(mockShareTokenResponse as any);
      blockchainWalletService.createCustomWallet.mockResolvedValue(mockBlockchainWallet as any);
      cardAdapter.createCardUser.mockResolvedValue({
        ...mockCardUserResponse,
        status: 'denied',
      } as any);
      cardUserRepository.create.mockResolvedValue(mockCardUser as any);

      jest.spyOn(RainConfigProvider.prototype, 'getConfig').mockReturnValue({
        clientId: 'test-client-id',
      } as any);

      await service.create(mockUser, createCardUserDto, ipAddress);

      expect(cardUserRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          status: ICardUserStatus.REJECTED,
        }),
      );
    });

    it('should map provider status "active" to ACTIVE', async () => {
      cardUserRepository.findOne.mockResolvedValue(null);
      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        first: jest.fn().mockResolvedValue(mockKycVerification),
      };
      kycVerificationRepository.query.mockReturnValue(mockQueryBuilder as any);
      kycAdapter.getKycDetails.mockResolvedValue(mockKycDetails as any);
      kycAdapter.generateShareToken.mockResolvedValue(mockShareTokenResponse as any);
      blockchainWalletService.createCustomWallet.mockResolvedValue(mockBlockchainWallet as any);
      cardAdapter.createCardUser.mockResolvedValue({
        ...mockCardUserResponse,
        status: 'active',
      } as any);
      cardUserRepository.create.mockResolvedValue(mockCardUser as any);

      jest.spyOn(RainConfigProvider.prototype, 'getConfig').mockReturnValue({
        clientId: 'test-client-id',
      } as any);

      await service.create(mockUser, createCardUserDto, ipAddress);

      expect(cardUserRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          status: ICardUserStatus.ACTIVE,
        }),
      );
    });

    it('should map provider status "inactive" to INACTIVE', async () => {
      cardUserRepository.findOne.mockResolvedValue(null);
      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        first: jest.fn().mockResolvedValue(mockKycVerification),
      };
      kycVerificationRepository.query.mockReturnValue(mockQueryBuilder as any);
      kycAdapter.getKycDetails.mockResolvedValue(mockKycDetails as any);
      kycAdapter.generateShareToken.mockResolvedValue(mockShareTokenResponse as any);
      blockchainWalletService.createCustomWallet.mockResolvedValue(mockBlockchainWallet as any);
      cardAdapter.createCardUser.mockResolvedValue({
        ...mockCardUserResponse,
        status: 'inactive',
      } as any);
      cardUserRepository.create.mockResolvedValue(mockCardUser as any);

      jest.spyOn(RainConfigProvider.prototype, 'getConfig').mockReturnValue({
        clientId: 'test-client-id',
      } as any);

      await service.create(mockUser, createCardUserDto, ipAddress);

      expect(cardUserRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          status: ICardUserStatus.INACTIVE,
        }),
      );
    });

    it('should map provider status "suspended" to SUSPENDED', async () => {
      cardUserRepository.findOne.mockResolvedValue(null);
      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        first: jest.fn().mockResolvedValue(mockKycVerification),
      };
      kycVerificationRepository.query.mockReturnValue(mockQueryBuilder as any);
      kycAdapter.getKycDetails.mockResolvedValue(mockKycDetails as any);
      kycAdapter.generateShareToken.mockResolvedValue(mockShareTokenResponse as any);
      blockchainWalletService.createCustomWallet.mockResolvedValue(mockBlockchainWallet as any);
      cardAdapter.createCardUser.mockResolvedValue({
        ...mockCardUserResponse,
        status: 'suspended',
      } as any);
      cardUserRepository.create.mockResolvedValue(mockCardUser as any);

      jest.spyOn(RainConfigProvider.prototype, 'getConfig').mockReturnValue({
        clientId: 'test-client-id',
      } as any);

      await service.create(mockUser, createCardUserDto, ipAddress);

      expect(cardUserRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          status: ICardUserStatus.SUSPENDED,
        }),
      );
    });

    it('should map unknown provider status to PENDING', async () => {
      cardUserRepository.findOne.mockResolvedValue(null);
      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        first: jest.fn().mockResolvedValue(mockKycVerification),
      };
      kycVerificationRepository.query.mockReturnValue(mockQueryBuilder as any);
      kycAdapter.getKycDetails.mockResolvedValue(mockKycDetails as any);
      kycAdapter.generateShareToken.mockResolvedValue(mockShareTokenResponse as any);
      blockchainWalletService.createCustomWallet.mockResolvedValue(mockBlockchainWallet as any);
      cardAdapter.createCardUser.mockResolvedValue({
        ...mockCardUserResponse,
        status: 'unknown_status',
      } as any);
      cardUserRepository.create.mockResolvedValue(mockCardUser as any);

      jest.spyOn(RainConfigProvider.prototype, 'getConfig').mockReturnValue({
        clientId: 'test-client-id',
      } as any);

      await service.create(mockUser, createCardUserDto, ipAddress);

      expect(cardUserRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          status: ICardUserStatus.PENDING,
        }),
      );
    });
  });

  describe('getOccupations', () => {
    it('should return occupations from adapter', () => {
      const mockOccupations = [{ code: '13-2011', name: 'Accountant' }];
      cardAdapter.getOccupations.mockReturnValue(mockOccupations as any);

      const result = service.getOccupations();

      expect(result).toEqual(mockOccupations);
      expect(cardAdapter.getOccupations).toHaveBeenCalled();
    });
  });

  describe('getCardLimitFrequencies', () => {
    it('should return formatted limit frequencies', () => {
      const result = service.getCardLimitFrequencies();

      expect(result).toContainEqual({ value: CardLimitFrequency.PER_24_HOUR_PERIOD, label: 'Per 24 Hour Period' });
      expect(result).toContainEqual({ value: CardLimitFrequency.PER_7_DAY_PERIOD, label: 'Per 7 Day Period' });
      expect(result).toContainEqual({ value: CardLimitFrequency.PER_30_DAY_PERIOD, label: 'Per 30 Day Period' });
    });
  });

  describe('verifyCardOwnership', () => {
    it('should return card if user owns it', async () => {
      cardRepository.findOne.mockResolvedValue(mockCard as any);

      const result = await service.verifyCardOwnership(mockUser, 'card-123');

      expect(result).toEqual(mockCard);
      expect(cardRepository.findOne).toHaveBeenCalledWith({ id: 'card-123', user_id: 'user-123' });
    });

    it('should throw NotFoundException if card not found', async () => {
      cardRepository.findOne.mockResolvedValue(null);

      await expect(service.verifyCardOwnership(mockUser, 'card-123')).rejects.toThrow(NotFoundException);
    });
  });

  describe('createCard', () => {
    const createCardDto: CreateCardDto = {
      type: CardType.VIRTUAL,
    };

    it('should create virtual card successfully', async () => {
      const depositAddressRepository = testingModule.get(
        DepositAddressRepository,
      ) as jest.Mocked<DepositAddressRepository>;

      cardUserRepository.findOne.mockResolvedValue(mockCardUser as any);
      cardRepository.findOne.mockResolvedValue(null);
      userProfileRepository.findByUserId.mockResolvedValue(mockUserProfile as any);
      depositAddressRepository.findOne.mockResolvedValue({ address: '0x123', asset: 'ethereum' } as any);

      const mockProviderCard = {
        cardId: 'provider-card-123',
        status: CardStatus.ACTIVE,
        displayName: 'John Doe',
        lastFourDigits: '1234',
        expiryMonth: '12',
        expiryYear: '2027',
        limitAmount: 0,
        limitFrequency: CardLimitFrequency.PER_30_DAY_PERIOD,
      };

      cardAdapter.createCard.mockResolvedValue(mockProviderCard as any);
      cardRepository.create.mockResolvedValue(mockCard as any);
      inAppNotificationService.createNotification.mockResolvedValue({} as any);
      mailerService.send.mockResolvedValue(undefined);
      pushNotificationService.sendPushNotification.mockResolvedValue(undefined);

      const result = await service.createCard(mockUser, createCardDto);

      expect(result).toBeDefined();
      expect(cardAdapter.createCard).toHaveBeenCalled();
      expect(cardRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          last_four_digits: mockProviderCard.lastFourDigits,
        }),
      );
      expect(inAppNotificationService.createNotification).toHaveBeenCalled();
      expect(mailerService.send).toHaveBeenCalledWith(expect.any(CardCreatedMail));
      expect(pushNotificationService.sendPushNotification).toHaveBeenCalledWith(
        [mockUserProfile.notification_token],
        expect.objectContaining({
          title: expect.stringContaining('Card Created'),
          body: expect.stringContaining('card is ready'),
        }),
      );
    });

    it('should log error when card created notification fails', async () => {
      const depositAddressRepository = testingModule.get(
        DepositAddressRepository,
      ) as jest.Mocked<DepositAddressRepository>;

      cardUserRepository.findOne.mockResolvedValue(mockCardUser as any);
      cardRepository.findOne.mockResolvedValue(null);
      userProfileRepository.findByUserId.mockResolvedValue(mockUserProfile as any);
      depositAddressRepository.findOne.mockResolvedValue({ address: '0x123', asset: 'ethereum' } as any);

      const mockProviderCard = {
        cardId: 'provider-card-123',
        status: CardStatus.ACTIVE,
        displayName: 'John Doe',
        lastFourDigits: '1234',
        expiryMonth: '12',
        expiryYear: '2027',
        limitAmount: 0,
        limitFrequency: CardLimitFrequency.PER_30_DAY_PERIOD,
      };

      cardAdapter.createCard.mockResolvedValue(mockProviderCard as any);
      cardRepository.create.mockResolvedValue(mockCard as any);
      jest.spyOn(service, 'sendCardNotification').mockRejectedValue(new Error('Notify failed'));
      jest.spyOn(service as any, 'transferBalanceFromCanceledCard').mockResolvedValue(null);

      const loggerSpy = jest.spyOn(service['logger'], 'error');

      await service.createCard(mockUser, createCardDto);

      expect(loggerSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to send card created notification/email'),
        expect.any(Error),
      );
    });

    it('should throw NotFoundException if card user not found', async () => {
      cardUserRepository.findOne.mockResolvedValue(null);

      await expect(service.createCard(mockUser, createCardDto)).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException if card user not approved', async () => {
      const unapprovedCardUser = { ...mockCardUser, status: ICardUserStatus.PENDING };
      cardUserRepository.findOne.mockResolvedValue(unapprovedCardUser as any);

      await expect(service.createCard(mockUser, createCardDto)).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if user already has a card', async () => {
      cardUserRepository.findOne.mockResolvedValue(mockCardUser as any);
      cardRepository.findNonCanceledCardByUserId.mockResolvedValue(mockCard as any);

      await expect(service.createCard(mockUser, createCardDto)).rejects.toThrow(BadRequestException);
    });

    it('should allow creating a new card if existing card is canceled', async () => {
      const depositAddressRepository = testingModule.get(
        DepositAddressRepository,
      ) as jest.Mocked<DepositAddressRepository>;

      const canceledCard = { ...mockCard, status: ICardStatus.CANCELED, balance: 3000 };

      cardUserRepository.findOne.mockResolvedValue(mockCardUser as any);
      cardRepository.findNonCanceledCardByUserId.mockResolvedValue(undefined);
      cardRepository.findLastCanceledCardWithBalance.mockResolvedValue(canceledCard as any);
      cardRepository.findOne.mockResolvedValueOnce(mockCard as any).mockResolvedValueOnce(mockCard as any);
      cardRepository.transaction.mockImplementation(async (fn: any) => fn({}));
      cardTransactionRepository.create.mockResolvedValue({ id: 'txn-1' } as any);
      userProfileRepository.findByUserId.mockResolvedValue(mockUserProfile as any);
      depositAddressRepository.findOne.mockResolvedValue({ address: '0x123', asset: 'ethereum' } as any);
      countryRepository.findById.mockResolvedValue({ code: 'US' } as any);

      const mockProviderCard = {
        cardId: 'provider-card-123',
        status: CardStatus.ACTIVE,
        displayName: 'John Doe',
        lastFourDigits: '1234',
        expiryMonth: '12',
        expiryYear: '2027',
        limitAmount: 0,
        limitFrequency: CardLimitFrequency.PER_30_DAY_PERIOD,
      };

      cardAdapter.createCard.mockResolvedValue(mockProviderCard as any);
      cardRepository.create.mockResolvedValue(mockCard as any);
      inAppNotificationService.createNotification.mockResolvedValue({} as any);
      mailerService.send.mockResolvedValue(undefined);

      const result = await service.createCard(mockUser, createCardDto);

      expect(result).toBeDefined();
      expect(cardAdapter.createCard).toHaveBeenCalled();
      expect(cardRepository.findLastCanceledCardWithBalance).toHaveBeenCalledWith('user-123');
      expect(cardRepository.transaction).toHaveBeenCalled();
      expect(cardTransactionRepository.create).toHaveBeenCalledTimes(2);
    });

    it('should not transfer balance when no canceled card with balance exists', async () => {
      const depositAddressRepository = testingModule.get(
        DepositAddressRepository,
      ) as jest.Mocked<DepositAddressRepository>;

      cardUserRepository.findOne.mockResolvedValue(mockCardUser as any);
      cardRepository.findNonCanceledCardByUserId.mockResolvedValue(undefined);
      cardRepository.findLastCanceledCardWithBalance.mockResolvedValue(undefined);
      userProfileRepository.findByUserId.mockResolvedValue(mockUserProfile as any);
      depositAddressRepository.findOne.mockResolvedValue({ address: '0x123', asset: 'ethereum' } as any);
      countryRepository.findById.mockResolvedValue({ code: 'US' } as any);

      const mockProviderCard = {
        cardId: 'provider-card-123',
        status: CardStatus.ACTIVE,
        displayName: 'John Doe',
        lastFourDigits: '1234',
        expiryMonth: '12',
        expiryYear: '2027',
        limitAmount: 0,
        limitFrequency: CardLimitFrequency.PER_30_DAY_PERIOD,
      };

      cardAdapter.createCard.mockResolvedValue(mockProviderCard as any);
      cardRepository.create.mockResolvedValue(mockCard as any);
      inAppNotificationService.createNotification.mockResolvedValue({} as any);
      mailerService.send.mockResolvedValue(undefined);

      await service.createCard(mockUser, createCardDto);

      expect(cardRepository.findLastCanceledCardWithBalance).toHaveBeenCalledWith('user-123');
      expect(cardRepository.transaction).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException if user profile not found', async () => {
      cardUserRepository.findOne.mockResolvedValue(mockCardUser as any);
      cardRepository.findOne.mockResolvedValue(null);
      userProfileRepository.findByUserId.mockResolvedValue(null);

      await expect(service.createCard(mockUser, createCardDto)).rejects.toThrow(NotFoundException);
      await expect(service.createCard(mockUser, createCardDto)).rejects.toThrow('User profile not found');
    });

    it('should create physical card successfully', async () => {
      const depositAddressRepository = testingModule.get(
        DepositAddressRepository,
      ) as jest.Mocked<DepositAddressRepository>;
      const physicalCardDto: CreateCardDto = {
        type: CardType.PHYSICAL,
        shipping_line1: '123 Main St',
        shipping_city: 'New York',
        shipping_region: 'NY',
        shipping_postal_code: '10001',
        shipping_country_code: 'US',
      };

      cardUserRepository.findOne.mockResolvedValue(mockCardUser as any);
      cardRepository.findOne.mockResolvedValue(null);
      userProfileRepository.findByUserId.mockResolvedValue(mockUserProfile as any);
      depositAddressRepository.findOne.mockResolvedValue({ address: '0x123', asset: 'ethereum' } as any);

      const mockProviderCard = {
        cardId: 'provider-card-123',
        status: CardStatus.ACTIVE,
        displayName: 'John Doe',
        lastFourDigits: '1234',
        expiryMonth: '12',
        expiryYear: '2027',
        limitAmount: 0,
        limitFrequency: CardLimitFrequency.PER_30_DAY_PERIOD,
      };

      cardAdapter.createCard.mockResolvedValue(mockProviderCard as any);
      cardRepository.create.mockResolvedValue(mockCard as any);
      inAppNotificationService.createNotification.mockResolvedValue({} as any);
      mailerService.send.mockResolvedValue(undefined);

      const result = await service.createCard(mockUser, physicalCardDto);

      expect(result).toBeDefined();
      expect(cardAdapter.createCard).toHaveBeenCalledWith(
        expect.objectContaining({
          type: CardType.PHYSICAL,
          shipping: expect.objectContaining({
            line1: physicalCardDto.shipping_line1,
            city: physicalCardDto.shipping_city,
          }),
        }),
      );
    });

    it('should handle notification/email failure gracefully', async () => {
      const depositAddressRepository = testingModule.get(
        DepositAddressRepository,
      ) as jest.Mocked<DepositAddressRepository>;

      cardUserRepository.findOne.mockResolvedValue(mockCardUser as any);
      cardRepository.findOne.mockResolvedValue(null);
      userProfileRepository.findByUserId.mockResolvedValue(mockUserProfile as any);
      depositAddressRepository.findOne.mockResolvedValue({ address: '0x123', asset: 'ethereum' } as any);

      const mockProviderCard = {
        cardId: 'provider-card-123',
        status: CardStatus.ACTIVE,
        displayName: 'John Doe',
        lastFourDigits: '1234',
        expiryMonth: '12',
        expiryYear: '2027',
        limitAmount: 0,
        limitFrequency: CardLimitFrequency.PER_30_DAY_PERIOD,
      };

      cardAdapter.createCard.mockResolvedValue(mockProviderCard as any);
      cardRepository.create.mockResolvedValue(mockCard as any);
      inAppNotificationService.createNotification.mockRejectedValue(new Error('Notification failed'));
      mailerService.send.mockRejectedValue(new Error('Email failed'));

      const result = await service.createCard(mockUser, createCardDto);

      expect(result).toBeDefined();
      expect(cardRepository.create).toHaveBeenCalled();
    });
  });

  describe('fundCard', () => {
    const fundDto: CardFundDto = {
      amount: 100,
      rail: CardFundRails.FIAT,
      transaction_pin: '123456',
    };
    let depositAddressRepository: jest.Mocked<DepositAddressRepository>;

    beforeEach(() => {
      depositAddressRepository = testingModule.get(DepositAddressRepository) as jest.Mocked<DepositAddressRepository>;
      jest.spyOn(StableCoinsService, 'getDefaultNetwork').mockReturnValue('ETH' as any);
      jest.spyOn(service as any, 'getDefaultChainId').mockReturnValue(11155111);
      jest.spyOn(EnvironmentService, 'isProduction').mockReturnValue(false);
    });

    it('should fund card via fiat rail successfully', async () => {
      cardRepository.findOne.mockResolvedValue(mockCard as any);
      cardUserRepository.findOne.mockResolvedValue(mockCardUser as any);
      cardTransactionRepository.create.mockResolvedValue({ id: 'txn-123' } as any);
      cardFundingProcessor.queueCardFunding.mockResolvedValue({ id: 'job-123' } as any);
      depositAddressRepository.findOne.mockResolvedValue({
        id: 'deposit-1',
        address: '0x123',
        asset: 'ethereum',
      } as any);

      const result = await service.fundCard(mockUser, { ...fundDto, card_id: 'card-123' });

      expect(result).toBeDefined();
      expect(cardTransactionRepository.create).toHaveBeenCalled();
      expect(cardFundingProcessor.queueCardFunding).toHaveBeenCalled();
    });

    it('should not fund a canceled card', async () => {
      const canceledCard = { ...mockCard, status: ICardStatus.CANCELED };
      cardRepository.findOne.mockResolvedValue(canceledCard as any);

      await expect(service.fundCard(mockUser, { ...fundDto, card_id: 'card-123' })).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.fundCard(mockUser, { ...fundDto, card_id: 'card-123' })).rejects.toThrow(
        'Cannot fund a blocked or canceled card',
      );
      expect(cardFundingProcessor.queueCardFunding).not.toHaveBeenCalled();
    });

    it('should not fund a blocked card', async () => {
      const blockedCard = { ...mockCard, status: ICardStatus.BLOCKED };
      cardRepository.findOne.mockResolvedValue(blockedCard as any);

      await expect(service.fundCard(mockUser, { ...fundDto, card_id: 'card-123' })).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.fundCard(mockUser, { ...fundDto, card_id: 'card-123' })).rejects.toThrow(
        'Cannot fund a blocked or canceled card',
      );
      expect(cardFundingProcessor.queueCardFunding).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException if card not found', async () => {
      cardRepository.findOne.mockResolvedValue(null);

      await expect(service.fundCard(mockUser, { ...fundDto, card_id: 'card-123' })).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException if card user not found', async () => {
      cardRepository.findOne.mockResolvedValue(mockCard as any);
      cardUserRepository.findOne.mockResolvedValue(null);

      await expect(service.fundCard(mockUser, { ...fundDto, card_id: 'card-123' })).rejects.toThrow(NotFoundException);
    });

    it('should handle error when queueCardFunding fails', async () => {
      cardRepository.findOne.mockResolvedValue(mockCard as any);
      cardUserRepository.findOne.mockResolvedValue(mockCardUser as any);
      cardTransactionRepository.create.mockResolvedValue({ id: 'txn-123' } as any);
      cardFundingProcessor.queueCardFunding.mockRejectedValue(new Error('Queue failed'));
      cardTransactionRepository.update.mockResolvedValue({} as any);
      depositAddressRepository.findOne.mockResolvedValue({
        id: 'deposit-1',
        address: '0x123',
        asset: 'ethereum',
      } as any);

      await expect(service.fundCard(mockUser, { ...fundDto, card_id: 'card-123' })).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.fundCard(mockUser, { ...fundDto, card_id: 'card-123' })).rejects.toThrow(
        'Failed to initiate card funding: Queue failed',
      );

      expect(cardTransactionRepository.update).toHaveBeenCalledWith(
        { id: 'txn-123' },
        { status: CardTransactionStatus.DECLINED, declined_reason: 'Queue failed' },
      );
    });

    it('should fund card via blockchain rail successfully', async () => {
      const blockchainFundDto: CardFundDto = {
        amount: 100,
        rail: CardFundRails.BLOCKCHAIN,
        transaction_pin: '123456',
      };

      cardRepository.findOne.mockResolvedValue(mockCard as any);
      cardUserRepository.findOne.mockResolvedValue(mockCardUser as any);
      cardTransactionRepository.create.mockResolvedValue({ id: 'txn-123' } as any);
      cardFundingProcessor.queueCardFunding.mockResolvedValue({ id: 'job-123' } as any);
      depositAddressRepository.findOne.mockResolvedValue({
        id: 'deposit-1',
        address: '0x123',
        asset: 'ethereum',
      } as any);

      const result = await service.fundCard(mockUser, { ...blockchainFundDto, card_id: 'card-123' });

      expect(result).toBeDefined();
      expect(result.rail).toBe(CardFundRails.BLOCKCHAIN);
      expect(cardTransactionRepository.create).toHaveBeenCalled();
      expect(cardFundingProcessor.queueCardFunding).toHaveBeenCalledWith(
        expect.objectContaining({
          rail: CardFundRails.BLOCKCHAIN,
        }),
      );
    });
  });

  describe('getCardDetails', () => {
    it('should get card details successfully', async () => {
      cardRepository.findOne.mockResolvedValue(mockCard as any);
      cardAdapter.getDecryptedCardSecrets.mockResolvedValue({
        decryptedPan: '1234567890123456',
        decryptedCvc: '123',
      } as any);

      const result = await service.getCardDetails(mockUser, 'card-123');

      expect(result).toBeDefined();
      expect(cardAdapter.getDecryptedCardSecrets).toHaveBeenCalledWith('provider-card-ref-123');
    });

    it('should throw BadRequestException if provider ref not found', async () => {
      const cardWithoutProviderRef = { ...mockCard, provider_ref: null };
      cardRepository.findOne.mockResolvedValue(cardWithoutProviderRef as any);

      await expect(service.getCardDetails(mockUser, 'card-123')).rejects.toThrow(BadRequestException);
    });

    it('should handle error when getDecryptedCardSecrets fails', async () => {
      cardRepository.findOne.mockResolvedValue(mockCard as any);
      cardAdapter.getDecryptedCardSecrets.mockRejectedValue(new Error('Provider error'));

      await expect(service.getCardDetails(mockUser, 'card-123')).rejects.toThrow(BadRequestException);
      await expect(service.getCardDetails(mockUser, 'card-123')).rejects.toThrow(
        'Failed to get card details: Provider error',
      );
    });
  });

  describe('freezeOrUnfreezeCard', () => {
    const freezeDto: FreezeCardDto = {
      freeze: true,
      transaction_pin: '123456',
    };

    beforeEach(() => {
      userRepository.findActiveById.mockResolvedValue(mockUser as any);
      inAppNotificationService.createNotification.mockResolvedValue({} as any);
      mailerService.send.mockResolvedValue(undefined as any);
    });

    it('should freeze card successfully', async () => {
      cardRepository.findOne.mockResolvedValue(mockCard as any);
      cardAdapter.updateCard.mockResolvedValue({
        status: CardStatus.LOCKED,
      } as any);
      cardRepository.update.mockResolvedValue({ ...mockCard, is_freezed: true } as any);

      const result = await service.freezeOrUnfreezeCard(mockUser, 'card-123', freezeDto);

      expect(result.is_freezed).toBe(true);
      expect(cardAdapter.updateCard).toHaveBeenCalled();
      expect(cardRepository.update).toHaveBeenCalled();
    });

    it('should send notification and email when freezing card', async () => {
      cardRepository.findOne.mockResolvedValue(mockCard as any);
      cardAdapter.updateCard.mockResolvedValue({ status: CardStatus.LOCKED } as any);
      cardRepository.update.mockResolvedValue({ ...mockCard, is_freezed: true } as any);
      userProfileRepository.findByUserId.mockResolvedValue(mockUserProfile as any);
      pushNotificationService.sendPushNotification.mockResolvedValue(undefined);

      await service.freezeOrUnfreezeCard(mockUser, 'card-123', freezeDto);

      expect(inAppNotificationService.createNotification).toHaveBeenCalledWith({
        user_id: 'user-123',
        type: IN_APP_NOTIFICATION_TYPE.CARD_FROZEN,
        title: 'Card frozen.',
        message: 'No transactions can be made until you unfreeze it.',
        metadata: {
          cardId: 'card-123',
          status: ICardStatus.INACTIVE,
        },
      });
      expect(mailerService.send).toHaveBeenCalledWith(expect.any(CardManagementMail));
      expect(pushNotificationService.sendPushNotification).toHaveBeenCalledWith([mockUserProfile.notification_token], {
        title: 'Card frozen.',
        body: 'No transactions can be made until you unfreeze it.',
      });
    });

    it('should throw BadRequestException if card already frozen', async () => {
      const frozenCard = { ...mockCard, is_freezed: true };
      cardRepository.findOne.mockResolvedValue(frozenCard as any);

      await expect(service.freezeOrUnfreezeCard(mockUser, 'card-123', freezeDto)).rejects.toThrow(BadRequestException);
    });

    it('should unfreeze card successfully', async () => {
      const unfreezeDto: FreezeCardDto = {
        freeze: false,
        transaction_pin: '123456',
      };
      const frozenCard = { ...mockCard, is_freezed: true };
      cardRepository.findOne.mockResolvedValue(frozenCard as any);
      cardAdapter.updateCard.mockResolvedValue({
        status: CardStatus.ACTIVE,
      } as any);
      cardRepository.update.mockResolvedValue({ ...mockCard, is_freezed: false } as any);

      const result = await service.freezeOrUnfreezeCard(mockUser, 'card-123', unfreezeDto);

      expect(result.is_freezed).toBe(false);
      expect(cardAdapter.updateCard).toHaveBeenCalledWith('provider-card-ref-123', { status: CardStatus.ACTIVE });
      expect(cardRepository.update).toHaveBeenCalled();
    });

    it('should send notification and email when unfreezing card', async () => {
      const unfreezeDto: FreezeCardDto = {
        freeze: false,
        transaction_pin: '123456',
      };
      const frozenCard = { ...mockCard, is_freezed: true, status: ICardStatus.INACTIVE };
      cardRepository.findOne.mockResolvedValue(frozenCard as any);
      cardAdapter.updateCard.mockResolvedValue({ status: CardStatus.ACTIVE } as any);
      cardRepository.update.mockResolvedValue({ ...mockCard, is_freezed: false } as any);
      userProfileRepository.findByUserId.mockResolvedValue(mockUserProfile as any);
      pushNotificationService.sendPushNotification.mockResolvedValue(undefined);

      await service.freezeOrUnfreezeCard(mockUser, 'card-123', unfreezeDto);

      expect(inAppNotificationService.createNotification).toHaveBeenCalledWith({
        user_id: 'user-123',
        type: IN_APP_NOTIFICATION_TYPE.CARD_UNFROZEN,
        title: 'Card Unfrozen',
        message: "Card active. You're ready to spend again!",
        metadata: {
          cardId: 'card-123',
          status: ICardStatus.ACTIVE,
        },
      });
      expect(mailerService.send).toHaveBeenCalledWith(expect.any(CardManagementMail));
      expect(pushNotificationService.sendPushNotification).toHaveBeenCalledWith([mockUserProfile.notification_token], {
        title: 'Card Unfrozen',
        body: "Card active. You're ready to spend again!",
      });
    });

    it('should throw BadRequestException if card already unfrozen', async () => {
      const unfreezeDto: FreezeCardDto = {
        freeze: false,
        transaction_pin: '123456',
      };
      cardRepository.findOne.mockResolvedValue(mockCard as any);

      await expect(service.freezeOrUnfreezeCard(mockUser, 'card-123', unfreezeDto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException when trying to unfreeze a BLOCKED card', async () => {
      const unfreezeDto: FreezeCardDto = {
        freeze: false,
        transaction_pin: '123456',
      };
      const blockedCard = { ...mockCard, is_freezed: true, status: ICardStatus.BLOCKED };
      cardRepository.findOne.mockResolvedValue(blockedCard as any);

      await expect(service.freezeOrUnfreezeCard(mockUser, 'card-123', unfreezeDto)).rejects.toThrow(
        'Card is blocked and cannot be unfrozen. Please contact support.',
      );
    });

    it('should handle error when updateCard fails', async () => {
      cardRepository.findOne.mockResolvedValue(mockCard as any);
      cardAdapter.updateCard.mockRejectedValue(new Error('Provider error'));

      await expect(service.freezeOrUnfreezeCard(mockUser, 'card-123', freezeDto)).rejects.toThrow(BadRequestException);
      await expect(service.freezeOrUnfreezeCard(mockUser, 'card-123', freezeDto)).rejects.toThrow(
        'Failed to freeze card: Provider error',
      );
    });

    it('should set status to INACTIVE when user freezes card', async () => {
      cardRepository.findOne.mockResolvedValue(mockCard as any);
      cardAdapter.updateCard.mockResolvedValue({
        status: CardStatus.LOCKED,
      } as any);
      cardRepository.update.mockResolvedValue({ ...mockCard, is_freezed: true } as any);

      await service.freezeOrUnfreezeCard(mockUser, 'card-123', freezeDto);

      expect(cardRepository.update).toHaveBeenCalledWith(
        { id: 'card-123' },
        expect.objectContaining({
          status: ICardStatus.INACTIVE,
        }),
      );
    });

    it('should set status to ACTIVE when user unfreezes card', async () => {
      const unfreezeDto: FreezeCardDto = {
        freeze: false,
        transaction_pin: '123456',
      };
      const frozenCard = { ...mockCard, is_freezed: true, status: ICardStatus.INACTIVE };
      cardRepository.findOne.mockResolvedValue(frozenCard as any);
      cardAdapter.updateCard.mockResolvedValue({
        status: CardStatus.ACTIVE,
      } as any);
      cardRepository.update.mockResolvedValue({ ...mockCard, is_freezed: false } as any);

      await service.freezeOrUnfreezeCard(mockUser, 'card-123', unfreezeDto);

      expect(cardRepository.update).toHaveBeenCalledWith(
        { id: 'card-123' },
        expect.objectContaining({
          status: ICardStatus.ACTIVE,
        }),
      );
    });
  });

  describe('adminBlockOrUnlockCard', () => {
    const blockDto = { block: true };
    const unlockDto = { block: false };

    beforeEach(() => {
      userRepository.findActiveById.mockResolvedValue(mockUser as any);
      inAppNotificationService.createNotification.mockResolvedValue({} as any);
      mailerService.send.mockResolvedValue(undefined as any);
    });

    it('should block card successfully', async () => {
      cardRepository.findOne.mockResolvedValue(mockCard as any);
      cardAdapter.updateCard.mockResolvedValue({
        status: CardStatus.LOCKED,
      } as any);
      cardRepository.update.mockResolvedValue({ ...mockCard, is_freezed: true } as any);

      const result = await service.adminBlockOrUnlockCard('card-123', blockDto);

      expect(result.is_freezed).toBe(true);
      expect(cardRepository.findOne).toHaveBeenCalledWith({ id: 'card-123' });
      expect(cardAdapter.updateCard).toHaveBeenCalledWith('provider-card-ref-123', { status: CardStatus.LOCKED });
      expect(cardRepository.update).toHaveBeenCalledWith(
        { id: 'card-123' },
        { is_freezed: true, status: ICardStatus.BLOCKED },
      );
    });

    it('should unlock card successfully', async () => {
      const blockedCard = { ...mockCard, is_freezed: true, status: ICardStatus.BLOCKED };
      cardRepository.findOne.mockResolvedValue(blockedCard as any);
      cardAdapter.updateCard.mockResolvedValue({
        status: CardStatus.ACTIVE,
      } as any);
      cardRepository.update.mockResolvedValue({ ...mockCard, is_freezed: false } as any);

      const result = await service.adminBlockOrUnlockCard('card-123', unlockDto);

      expect(result.is_freezed).toBe(false);
      expect(cardAdapter.updateCard).toHaveBeenCalledWith('provider-card-ref-123', { status: CardStatus.ACTIVE });
      expect(cardRepository.update).toHaveBeenCalledWith(
        { id: 'card-123' },
        { is_freezed: false, status: ICardStatus.ACTIVE },
      );
    });

    it('should throw NotFoundException if card not found', async () => {
      cardRepository.findOne.mockResolvedValue(undefined);

      await expect(service.adminBlockOrUnlockCard('card-123', blockDto)).rejects.toThrow(NotFoundException);
      await expect(service.adminBlockOrUnlockCard('card-123', blockDto)).rejects.toThrow('Card not found');
    });

    it('should throw BadRequestException if card has no provider_ref', async () => {
      const cardWithoutProvider = { ...mockCard, provider_ref: undefined };
      cardRepository.findOne.mockResolvedValue(cardWithoutProvider as any);

      await expect(service.adminBlockOrUnlockCard('card-123', blockDto)).rejects.toThrow(BadRequestException);
      await expect(service.adminBlockOrUnlockCard('card-123', blockDto)).rejects.toThrow(
        'Card provider reference not found',
      );
    });

    it('should throw BadRequestException if card is canceled', async () => {
      const canceledCard = { ...mockCard, status: ICardStatus.CANCELED };
      cardRepository.findOne.mockResolvedValue(canceledCard as any);

      await expect(service.adminBlockOrUnlockCard('card-123', blockDto)).rejects.toThrow(BadRequestException);
      await expect(service.adminBlockOrUnlockCard('card-123', blockDto)).rejects.toThrow(
        'Cannot block or unlock a canceled card',
      );
    });

    it('should send notification and email when blocking card', async () => {
      cardRepository.findOne.mockResolvedValue(mockCard as any);
      cardAdapter.updateCard.mockResolvedValue({ status: CardStatus.LOCKED } as any);
      cardRepository.update.mockResolvedValue({ ...mockCard, is_freezed: true } as any);
      userProfileRepository.findByUserId.mockResolvedValue(mockUserProfile as any);
      pushNotificationService.sendPushNotification.mockResolvedValue(undefined);

      await service.adminBlockOrUnlockCard('card-123', blockDto);

      expect(inAppNotificationService.createNotification).toHaveBeenCalledWith({
        user_id: 'user-123',
        type: IN_APP_NOTIFICATION_TYPE.CARD_BLOCKED,
        title: 'Card Blocked',
        message:
          'Your card has been blocked and can no longer be used for transactions. Please contact support for assistance.',
        metadata: {
          cardId: 'card-123',
          status: ICardStatus.BLOCKED,
        },
      });
      expect(mailerService.send).toHaveBeenCalledWith(expect.any(CardManagementMail));
      expect(pushNotificationService.sendPushNotification).toHaveBeenCalledWith([mockUserProfile.notification_token], {
        title: 'Card Blocked',
        body: 'Your card has been blocked and can no longer be used for transactions. Please contact support for assistance.',
      });
    });

    it('should send notification and email when unlocking card', async () => {
      const blockedCard = { ...mockCard, is_freezed: true, status: ICardStatus.BLOCKED };
      cardRepository.findOne.mockResolvedValue(blockedCard as any);
      cardAdapter.updateCard.mockResolvedValue({ status: CardStatus.ACTIVE } as any);
      cardRepository.update.mockResolvedValue({ ...mockCard, is_freezed: false } as any);
      userProfileRepository.findByUserId.mockResolvedValue(mockUserProfile as any);
      pushNotificationService.sendPushNotification.mockResolvedValue(undefined);

      await service.adminBlockOrUnlockCard('card-123', unlockDto);

      expect(inAppNotificationService.createNotification).toHaveBeenCalledWith({
        user_id: 'user-123',
        type: IN_APP_NOTIFICATION_TYPE.CARD_UNFROZEN,
        title: 'Card Unfrozen',
        message: "Card active. You're ready to spend again!",
        metadata: {
          cardId: 'card-123',
          status: ICardStatus.ACTIVE,
        },
      });
      expect(mailerService.send).toHaveBeenCalledWith(expect.any(CardManagementMail));
      expect(pushNotificationService.sendPushNotification).toHaveBeenCalledWith([mockUserProfile.notification_token], {
        title: 'Card Unfrozen',
        body: "Card active. You're ready to spend again!",
      });
    });

    it('should handle error when updateCard fails', async () => {
      cardRepository.findOne.mockResolvedValue(mockCard as any);
      cardAdapter.updateCard.mockRejectedValue(new Error('Provider error'));

      await expect(service.adminBlockOrUnlockCard('card-123', blockDto)).rejects.toThrow(BadRequestException);
      await expect(service.adminBlockOrUnlockCard('card-123', blockDto)).rejects.toThrow(
        'Failed to block card: Provider error',
      );
    });

    it('should set status to BLOCKED when admin blocks card', async () => {
      cardRepository.findOne.mockResolvedValue(mockCard as any);
      cardAdapter.updateCard.mockResolvedValue({
        status: CardStatus.LOCKED,
      } as any);
      cardRepository.update.mockResolvedValue({ ...mockCard, is_freezed: true } as any);

      await service.adminBlockOrUnlockCard('card-123', blockDto);

      expect(cardRepository.update).toHaveBeenCalledWith(
        { id: 'card-123' },
        expect.objectContaining({
          status: ICardStatus.BLOCKED,
          is_freezed: true,
        }),
      );
    });

    it('should set status to ACTIVE when admin unlocks card', async () => {
      const blockedCard = { ...mockCard, is_freezed: true, status: ICardStatus.BLOCKED };
      cardRepository.findOne.mockResolvedValue(blockedCard as any);
      cardAdapter.updateCard.mockResolvedValue({
        status: CardStatus.ACTIVE,
      } as any);
      cardRepository.update.mockResolvedValue({ ...mockCard, is_freezed: false } as any);

      await service.adminBlockOrUnlockCard('card-123', unlockDto);

      expect(cardRepository.update).toHaveBeenCalledWith(
        { id: 'card-123' },
        expect.objectContaining({
          status: ICardStatus.ACTIVE,
          is_freezed: false,
        }),
      );
    });
  });

  describe('updateCardLimit', () => {
    const updateLimitDto: UpdateCardLimitDto = {
      amount: 2000,
      frequency: CardLimitFrequency.PER_7_DAY_PERIOD,
    };

    it('should update card limit successfully', async () => {
      cardRepository.findOne.mockResolvedValueOnce(mockCard as any).mockResolvedValueOnce({
        ...mockCard,
        limit: 2000,
        limit_frequency: CardLimitFrequency.PER_7_DAY_PERIOD,
      } as any);
      cardAdapter.updateCard.mockResolvedValue({
        limitAmount: 2000,
        limitFrequency: CardLimitFrequency.PER_7_DAY_PERIOD,
      } as any);
      cardRepository.update.mockResolvedValue({} as any);

      const result = await service.updateCardLimit(mockUser, 'card-123', updateLimitDto);

      expect(result.limit).toBe(2000);
      expect(result.limit_frequency).toBe(CardLimitFrequency.PER_7_DAY_PERIOD);
    });

    it('should throw BadRequestException if neither amount nor frequency provided', async () => {
      cardRepository.findOne.mockResolvedValue(mockCard as any);

      await expect(service.updateCardLimit(mockUser, 'card-123', {})).rejects.toThrow(BadRequestException);
    });

    it('should update card limit with only amount', async () => {
      const updateDto: UpdateCardLimitDto = {
        amount: 3000,
      };

      cardRepository.findOne.mockResolvedValueOnce(mockCard as any).mockResolvedValueOnce({
        ...mockCard,
        limit: 3000,
        limit_frequency: CardLimitFrequency.PER_30_DAY_PERIOD,
      } as any);
      cardAdapter.updateCard.mockResolvedValue({
        limitAmount: 3000,
        limitFrequency: CardLimitFrequency.PER_30_DAY_PERIOD,
      } as any);
      cardRepository.update.mockResolvedValue({} as any);

      const result = await service.updateCardLimit(mockUser, 'card-123', updateDto);

      expect(result.limit).toBe(3000);
      expect(cardAdapter.updateCard).toHaveBeenCalledWith(
        'provider-card-ref-123',
        expect.objectContaining({
          limit: expect.objectContaining({
            amount: 3000,
            frequency: CardLimitFrequency.PER_30_DAY_PERIOD,
          }),
        }),
      );
    });

    it('should update card limit with only frequency', async () => {
      const updateDto: UpdateCardLimitDto = {
        frequency: CardLimitFrequency.PER_7_DAY_PERIOD,
      };

      cardRepository.findOne.mockResolvedValueOnce(mockCard as any).mockResolvedValueOnce({
        ...mockCard,
        limit: 1000,
        limit_frequency: CardLimitFrequency.PER_7_DAY_PERIOD,
      } as any);
      cardAdapter.updateCard.mockResolvedValue({
        limitAmount: 1000,
        limitFrequency: CardLimitFrequency.PER_7_DAY_PERIOD,
      } as any);
      cardRepository.update.mockResolvedValue({} as any);

      const result = await service.updateCardLimit(mockUser, 'card-123', updateDto);

      expect(result.limit_frequency).toBe(CardLimitFrequency.PER_7_DAY_PERIOD);
      expect(cardAdapter.updateCard).toHaveBeenCalledWith(
        'provider-card-ref-123',
        expect.objectContaining({
          limit: expect.objectContaining({
            amount: 1000,
            frequency: CardLimitFrequency.PER_7_DAY_PERIOD,
          }),
        }),
      );
    });

    it('should handle error when updateCard fails', async () => {
      cardRepository.findOne.mockResolvedValue(mockCard as any);
      cardAdapter.updateCard.mockRejectedValue(new Error('Provider error'));

      await expect(service.updateCardLimit(mockUser, 'card-123', updateLimitDto)).rejects.toThrow(BadRequestException);
      await expect(service.updateCardLimit(mockUser, 'card-123', updateLimitDto)).rejects.toThrow(
        'Failed to update card limit: Provider error',
      );
    });

    it('should throw error if limit verification fails', async () => {
      cardRepository.findOne.mockResolvedValueOnce(mockCard as any).mockResolvedValueOnce({
        ...mockCard,
        limit: 1000,
        limit_frequency: CardLimitFrequency.PER_7_DAY_PERIOD,
      } as any);
      cardAdapter.updateCard.mockResolvedValue({
        limitAmount: 2000,
        limitFrequency: CardLimitFrequency.PER_7_DAY_PERIOD,
      } as any);
      cardRepository.update.mockResolvedValue({} as any);

      await expect(service.updateCardLimit(mockUser, 'card-123', updateLimitDto)).rejects.toThrow(
        'Card limit update verification failed',
      );
    });

    it('should throw error if frequency verification fails', async () => {
      cardRepository.findOne.mockResolvedValueOnce(mockCard as any).mockResolvedValueOnce({
        ...mockCard,
        limit: 2000,
        limit_frequency: CardLimitFrequency.PER_30_DAY_PERIOD,
      } as any);
      cardAdapter.updateCard.mockResolvedValue({
        limitAmount: 2000,
        limitFrequency: CardLimitFrequency.PER_7_DAY_PERIOD,
      } as any);
      cardRepository.update.mockResolvedValue({} as any);

      await expect(service.updateCardLimit(mockUser, 'card-123', updateLimitDto)).rejects.toThrow(
        'Card limit frequency update verification failed',
      );
    });

    it('should throw BadRequestException if provider ref not found', async () => {
      const cardWithoutProviderRef = { ...mockCard, provider_ref: null };
      cardRepository.findOne.mockResolvedValue(cardWithoutProviderRef as any);

      await expect(service.updateCardLimit(mockUser, 'card-123', updateLimitDto)).rejects.toThrow(BadRequestException);
      await expect(service.updateCardLimit(mockUser, 'card-123', updateLimitDto)).rejects.toThrow(
        'Card provider reference not found',
      );
    });

    it('should throw error if updatedVirtualCard is null', async () => {
      cardRepository.findOne.mockResolvedValue(mockCard as any);
      cardAdapter.updateCard.mockResolvedValue({
        limitAmount: 2000,
        limitFrequency: CardLimitFrequency.PER_7_DAY_PERIOD,
      } as any);
      cardRepository.update.mockResolvedValue(null);

      await expect(service.updateCardLimit(mockUser, 'card-123', updateLimitDto)).rejects.toThrow(
        'Failed to update card limit for card: card-123',
      );
    });
  });

  describe('ensureRainDepositAddress', () => {
    let depositAddressRepository: jest.Mocked<DepositAddressRepository>;

    beforeEach(() => {
      depositAddressRepository = testingModule.get(DepositAddressRepository) as jest.Mocked<DepositAddressRepository>;
      jest.spyOn(StableCoinsService, 'getDefaultNetwork').mockReturnValue('ETH' as any);
      jest.spyOn(EnvironmentService, 'isProduction').mockReturnValue(false);
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('should create deposit addresses for contracts that do not exist in DB', async () => {
      const contracts = [
        {
          id: 'contract-1',
          chainId: 11155111,
          depositAddress: '0x123',
        },
        {
          id: 'contract-2',
          chainId: 84532,
          depositAddress: '0x456',
        },
      ];

      depositAddressRepository.findOne.mockResolvedValue(null);
      cardAdapter.getUserContracts.mockResolvedValue(contracts as any);
      depositAddressRepository.create.mockResolvedValue({ id: 'deposit-1' } as any);

      await (service as any).ensureRainDepositAddress(mockUser, 'provider-ref-123');

      expect(cardAdapter.getUserContracts).toHaveBeenCalledWith('provider-ref-123');
      expect(depositAddressRepository.create).toHaveBeenCalledTimes(2);
    });

    it('should skip creating deposit address if it already exists', async () => {
      const contracts = [
        {
          id: 'contract-1',
          chainId: 11155111,
          depositAddress: '0x123',
        },
      ];

      const existingAddress = {
        id: 'deposit-1',
        address: '0x123',
        user_id: 'user-123',
        provider: 'rain',
        asset: 'ethereum',
      };

      depositAddressRepository.findOne.mockResolvedValueOnce(null).mockResolvedValueOnce(existingAddress as any);
      cardAdapter.getUserContracts.mockResolvedValue(contracts as any);

      await (service as any).ensureRainDepositAddress(mockUser, 'provider-ref-123');

      expect(depositAddressRepository.findOne).toHaveBeenCalled();
      expect(depositAddressRepository.create).not.toHaveBeenCalled();
    });

    it('should log when deposit address already exists in contracts loop', async () => {
      const contracts = [
        {
          id: 'contract-1',
          chainId: 11155111,
          depositAddress: '0x123',
        },
      ];

      const existingAddress = {
        id: 'deposit-1',
        address: '0x123',
        user_id: 'user-123',
        provider: 'rain',
        asset: 'ethereum',
      };

      depositAddressRepository.findOne.mockResolvedValueOnce(null).mockResolvedValueOnce(existingAddress as any);
      cardAdapter.getUserContracts.mockResolvedValue(contracts as any);

      const loggerSpy = jest.spyOn(service['logger'], 'log');

      await (service as any).ensureRainDepositAddress(mockUser, 'provider-ref-123');

      expect(loggerSpy).toHaveBeenCalledWith(
        expect.stringContaining('Deposit address already exists for user user-123 on chain ethereum: 0x123'),
      );
      expect(depositAddressRepository.create).not.toHaveBeenCalled();
    });

    it('should handle error when fetching contracts fails', async () => {
      depositAddressRepository.findOne.mockResolvedValue(null);
      cardAdapter.getUserContracts.mockRejectedValue(new Error('Provider error'));

      await (service as any).ensureRainDepositAddress(mockUser, 'provider-ref-123');

      expect(cardAdapter.getUserContracts).toHaveBeenCalledWith('provider-ref-123');
    });

    it('should create new contract when no contracts exist', async () => {
      depositAddressRepository.findOne.mockResolvedValue(null);
      cardAdapter.getUserContracts.mockResolvedValue([]);
      cardAdapter.createUserContract.mockResolvedValue({
        id: 'contract-new',
        chainId: 11155111,
        depositAddress: '0x789',
      } as any);

      await (service as any).ensureRainDepositAddress(mockUser, 'provider-ref-123');

      expect(cardAdapter.getUserContracts).toHaveBeenCalledWith('provider-ref-123');
      expect(cardAdapter.createUserContract).toHaveBeenCalledWith('provider-ref-123', 11155111);
    });

    it('should handle error when contract creation fails', async () => {
      depositAddressRepository.findOne.mockResolvedValue(null);
      cardAdapter.getUserContracts.mockResolvedValue([]);
      cardAdapter.createUserContract.mockRejectedValue(new Error('Contract creation failed'));

      await (service as any).ensureRainDepositAddress(mockUser, 'provider-ref-123');

      expect(cardAdapter.createUserContract).toHaveBeenCalled();
    });

    it('should skip contract creation when default chain ID not determined', async () => {
      jest.spyOn(StableCoinsService, 'getDefaultNetwork').mockReturnValue('UNKNOWN' as any);
      jest.spyOn(EnvironmentService, 'isProduction').mockReturnValue(false);
      depositAddressRepository.findOne.mockResolvedValue(null);
      cardAdapter.getUserContracts.mockResolvedValue([]);
      jest.spyOn(service as any, 'mapNetworkToChainName').mockReturnValue('nonexistentChain' as any);

      await (service as any).ensureRainDepositAddress(mockUser, 'provider-ref-123');

      expect(cardAdapter.createUserContract).not.toHaveBeenCalled();
    });

    it('should skip contracts without chainInfo or depositAddress', async () => {
      depositAddressRepository.findOne.mockResolvedValue(null);
      const contracts = [
        {
          id: 'contract-1',
          chainId: 999999,
          depositAddress: '0x123',
        },
        {
          id: 'contract-2',
          chainId: 11155111,
          depositAddress: null,
        },
      ];

      cardAdapter.getUserContracts.mockResolvedValue(contracts as any);

      await (service as any).ensureRainDepositAddress(mockUser, 'provider-ref-123');

      expect(depositAddressRepository.create).not.toHaveBeenCalled();
    });
  });

  describe('mapNetworkToChainName', () => {
    it('should map ETH to ethereum', () => {
      const result = (service as any).mapNetworkToChainName('ETH');
      expect(result).toBe('ethereum');
    });

    it('should map BASECHAIN to base', () => {
      const result = (service as any).mapNetworkToChainName('BASECHAIN');
      expect(result).toBe('base');
    });

    it('should map SOL to solana', () => {
      const result = (service as any).mapNetworkToChainName('SOL');
      expect(result).toBe('solana');
    });

    it('should map ERC20 to ethereum', () => {
      const result = (service as any).mapNetworkToChainName('ERC20');
      expect(result).toBe('ethereum');
    });

    it('should default to ethereum for unknown networks', () => {
      const result = (service as any).mapNetworkToChainName('UNKNOWN');
      expect(result).toBe('ethereum');
    });
  });

  describe('getCardUser', () => {
    const mockCardUserWithDetails = {
      id: 'card-user-123',
      user_id: 'user-123',
      provider_status: 'approved',
      status: ICardUserStatus.APPROVED,
      balance: 100.5,
      created_at: new Date('2024-01-01T12:00:00.000Z'),
      updated_at: new Date('2024-01-01T12:00:00.000Z'),
    };

    const mockCards = [
      {
        id: 'card-1',
        user_id: 'user-123',
        provider_product_id: 'product-1',
        provider_product_ref: 'ref-1',
        status: ICardStatus.ACTIVE,
        balance: 50,
      },
      {
        id: 'card-2',
        user_id: 'user-123',
        provider_product_id: 'product-2',
        provider_product_ref: 'ref-2',
        status: ICardStatus.ACTIVE,
        balance: 100,
      },
      {
        id: 'card-3',
        user_id: 'user-123',
        provider_product_id: 'product-3',
        provider_product_ref: 'ref-3',
        status: ICardStatus.CANCELED,
        balance: 0,
      },
    ];

    it('should return card user with cards successfully', async () => {
      cardUserRepository.findOne.mockResolvedValue(mockCardUserWithDetails as any);
      const mockQueryBuilder = {
        orderBy: jest.fn().mockReturnThis(),
      };
      cardRepository.findSync.mockReturnValue(mockQueryBuilder as any);
      (mockQueryBuilder.orderBy as jest.Mock).mockResolvedValue(mockCards);

      const result = await service.getCardUser(mockUser);

      expect(result).toEqual({
        id: 'card-user-123',
        user_id: 'user-123',
        provider_status: 'approved',
        status: ICardUserStatus.APPROVED,
        balance: 100.5,
        created_at: mockCardUserWithDetails.created_at,
        updated_at: mockCardUserWithDetails.updated_at,
        cards: [
          {
            id: 'card-1',
            user_id: 'user-123',
            status: ICardStatus.ACTIVE,
            balance: 50,
          },
          {
            id: 'card-2',
            user_id: 'user-123',
            status: ICardStatus.ACTIVE,
            balance: 100,
          },
          // canceled card should be excluded
        ],
      });
      expect(cardUserRepository.findOne).toHaveBeenCalledWith({ user_id: mockUser.id });
      expect(cardRepository.findSync).toHaveBeenCalledWith({ user_id: mockUser.id });
      expect(mockQueryBuilder.orderBy).toHaveBeenCalledWith('created_at', 'desc');
    });

    it('should return card user with empty cards array when no cards exist', async () => {
      cardUserRepository.findOne.mockResolvedValue(mockCardUserWithDetails as any);
      const mockQueryBuilder = {
        orderBy: jest.fn().mockReturnThis(),
      };
      cardRepository.findSync.mockReturnValue(mockQueryBuilder as any);
      (mockQueryBuilder.orderBy as jest.Mock).mockResolvedValue([]);

      const result = await service.getCardUser(mockUser);

      expect(Array.isArray(result)).toBe(false);
      if (!Array.isArray(result)) {
        expect(result.cards).toEqual([]);
      }
      expect(cardUserRepository.findOne).toHaveBeenCalledWith({ user_id: mockUser.id });
    });

    it('should filter out CANCELED cards from result', async () => {
      const cardsWithCanceled = [
        {
          id: 'card-1',
          user_id: 'user-123',
          status: ICardStatus.ACTIVE,
          balance: 50,
        },
        {
          id: 'card-2',
          user_id: 'user-123',
          status: ICardStatus.CANCELED,
          balance: 0,
        },
        {
          id: 'card-3',
          user_id: 'user-123',
          status: ICardStatus.ACTIVE,
          balance: 100,
        },
      ];

      cardUserRepository.findOne.mockResolvedValue(mockCardUserWithDetails as any);
      const mockQueryBuilder = {
        orderBy: jest.fn().mockReturnThis(),
      };
      cardRepository.findSync.mockReturnValue(mockQueryBuilder as any);
      (mockQueryBuilder.orderBy as jest.Mock).mockResolvedValue(cardsWithCanceled);

      const result = await service.getCardUser(mockUser);

      expect(result).not.toBeNull();
      if (result && !Array.isArray(result)) {
        expect(result.cards).toHaveLength(2);
        expect(result.cards.every((card) => card.status !== ICardStatus.CANCELED)).toBe(true);
        expect(result.cards.find((card) => card.id === 'card-2')).toBeUndefined();
      }
    });

    it('should return null when card user not found', async () => {
      cardUserRepository.findOne.mockResolvedValue(null);

      const result = await service.getCardUser(mockUser);

      expect(result).toBeNull();
      expect(cardUserRepository.findOne).toHaveBeenCalledWith({ user_id: mockUser.id });
    });
  });

  describe('getCard', () => {
    const mockCardWithExcludedFields = {
      id: 'card-123',
      user_id: 'user-123',
      card_user_id: 'card-user-123',
      provider_ref: 'provider-ref-123',
      status: ICardStatus.ACTIVE,
      limit: 1000,
      limit_frequency: CardLimitFrequency.PER_30_DAY_PERIOD,
      balance: 500,
      is_freezed: false,
      provider_product_id: 'product-123',
      provider_product_ref: 'ref-123',
      created_at: new Date('2024-01-01T12:00:00.000Z'),
      updated_at: new Date('2024-01-01T12:00:00.000Z'),
    };

    it('should return card successfully with excluded fields removed', async () => {
      cardRepository.findOne.mockResolvedValue(mockCardWithExcludedFields as any);

      const result = await service.getCard(mockUser, 'card-123');

      expect(result).not.toHaveProperty('provider_product_id');
      expect(result).not.toHaveProperty('provider_product_ref');
      expect(result).toHaveProperty('id', 'card-123');
      expect(result).toHaveProperty('user_id', 'user-123');
      expect(result).toHaveProperty('status', ICardStatus.ACTIVE);
      expect(cardRepository.findOne).toHaveBeenCalledWith({ id: 'card-123', user_id: mockUser.id });
    });

    it('should throw NotFoundException when card not found', async () => {
      cardRepository.findOne.mockResolvedValue(null);

      await expect(service.getCard(mockUser, 'card-123')).rejects.toThrow(NotFoundException);
      await expect(service.getCard(mockUser, 'card-123')).rejects.toThrow('Card not found or does not belong to user');
    });

    it('should throw NotFoundException when card belongs to different user', async () => {
      cardRepository.findOne.mockResolvedValue(null);

      await expect(service.getCard(mockUser, 'card-123')).rejects.toThrow(NotFoundException);
    });
  });

  describe('getCardTransactions', () => {
    const mockCardTransaction: any = {
      id: 'txn-123',
      user_id: 'user-123',
      card_user_id: 'card-user-123',
      card_id: 'card-123',
      amount: 50.0,
      provider_reference: 'REF_123456',
      currency: 'USD',
      transactionhash: null,
      authorized_amount: 50.0,
      authorization_method: 'chip',
      merchant_name: 'Amazon',
      merchant_id: 'merchant_123',
      merchant_city: 'Seattle',
      merchant_country: 'US',
      merchant_category: 'Online Retail',
      merchant_category_code: '5999',
      status: 'successful' as const,
      declined_reason: null,
      authorized_at: new Date('2025-01-15T10:30:00.000Z'),
      balance_before: 1000.0,
      balance_after: 950.0,
      transaction_type: 'spend' as const,
      type: 'debit' as const,
      created_at: new Date('2025-01-15T10:30:00.000Z'),
      updated_at: new Date('2025-01-15T10:30:00.000Z'),
    };

    const mockPaginatedResponse = {
      card_transactions: [mockCardTransaction],
      pagination: {
        current_page: 1,
        next_page: 0,
        previous_page: 0,
        limit: 10,
        page_count: 1,
        total: 1,
      },
    };

    it('should return card transactions with default pagination', async () => {
      const mockResponseWithVirtualCard = {
        card_transactions: [
          {
            id: 'txn-1',
            card: { last_four_digits: '1234' },
          },
        ],
        pagination: mockPaginatedResponse.pagination,
      };
      cardUserRepository.findOne.mockResolvedValue(mockCardUser as any);
      cardTransactionRepository.findAllWithCardLastFourDigits.mockResolvedValue(mockResponseWithVirtualCard as any);

      const result = await service.getCardTransactions('user-123', {});

      expect((result.card_transactions[0] as any).last_four_digits).toBe('1234');
      expect((result.card_transactions[0] as any).card).toBeUndefined();
      expect(cardUserRepository.findOne).toHaveBeenCalledWith({ user_id: 'user-123' });
      expect(cardTransactionRepository.findAllWithCardLastFourDigits).toHaveBeenCalledWith(
        { user_id: 'user-123', card_user_id: 'card-user-123' },
        { page: undefined, limit: undefined, endDateCol: 'created_at' },
      );
    });

    it('should return card transactions with pagination', async () => {
      cardUserRepository.findOne.mockResolvedValue(mockCardUser as any);
      cardTransactionRepository.findAllWithCardLastFourDigits.mockResolvedValue(mockPaginatedResponse as any);

      const result = await service.getCardTransactions('user-123', { page: 2, limit: 20 });

      expect(result).toEqual(mockPaginatedResponse);
      expect(cardUserRepository.findOne).toHaveBeenCalledWith({ user_id: 'user-123' });
      expect(cardTransactionRepository.findAllWithCardLastFourDigits).toHaveBeenCalledWith(
        { user_id: 'user-123', card_user_id: 'card-user-123' },
        { page: 2, limit: 20, endDateCol: 'created_at' },
      );
    });

    it('should automatically include card_user_id from user', async () => {
      cardUserRepository.findOne.mockResolvedValue(mockCardUser as any);
      cardTransactionRepository.findAllWithCardLastFourDigits.mockResolvedValue(mockPaginatedResponse as any);

      const result = await service.getCardTransactions('user-123', {});

      expect(result).toEqual(mockPaginatedResponse);
      expect(cardUserRepository.findOne).toHaveBeenCalledWith({ user_id: 'user-123' });
      expect(cardTransactionRepository.findAllWithCardLastFourDigits).toHaveBeenCalledWith(
        { user_id: 'user-123', card_user_id: 'card-user-123' },
        { page: undefined, limit: undefined, endDateCol: 'created_at' },
      );
    });

    it('should filter by card_id', async () => {
      cardUserRepository.findOne.mockResolvedValue(mockCardUser as any);
      cardTransactionRepository.findAllWithCardLastFourDigits.mockResolvedValue(mockPaginatedResponse as any);

      const result = await service.getCardTransactions('user-123', {
        card_id: 'card-123',
      });

      expect(result).toEqual(mockPaginatedResponse);
      expect(cardUserRepository.findOne).toHaveBeenCalledWith({ user_id: 'user-123' });
      expect(cardTransactionRepository.findAllWithCardLastFourDigits).toHaveBeenCalledWith(
        { user_id: 'user-123', card_user_id: 'card-user-123', card_id: 'card-123' },
        { page: undefined, limit: undefined, endDateCol: 'created_at' },
      );
    });

    it('should filter by transaction_type', async () => {
      cardUserRepository.findOne.mockResolvedValue(mockCardUser as any);
      cardTransactionRepository.findAllWithCardLastFourDigits.mockResolvedValue(mockPaginatedResponse as any);

      const result = await service.getCardTransactions('user-123', {
        transaction_type: CardTransactionType.SPEND,
      });

      expect(result).toEqual(mockPaginatedResponse);
      expect(cardUserRepository.findOne).toHaveBeenCalledWith({ user_id: 'user-123' });
      expect(cardTransactionRepository.findAllWithCardLastFourDigits).toHaveBeenCalledWith(
        { user_id: 'user-123', card_user_id: 'card-user-123', transaction_type: 'spend' },
        { page: undefined, limit: undefined, endDateCol: 'created_at' },
      );
    });

    it('should filter by status', async () => {
      cardUserRepository.findOne.mockResolvedValue(mockCardUser as any);
      cardTransactionRepository.findAllWithCardLastFourDigits.mockResolvedValue(mockPaginatedResponse as any);

      const result = await service.getCardTransactions('user-123', {
        status: CardTransactionStatus.SUCCESSFUL,
      });

      expect(result).toEqual(mockPaginatedResponse);
      expect(cardUserRepository.findOne).toHaveBeenCalledWith({ user_id: 'user-123' });
      expect(cardTransactionRepository.findAllWithCardLastFourDigits).toHaveBeenCalledWith(
        { user_id: 'user-123', card_user_id: 'card-user-123', status: 'successful' },
        { page: undefined, limit: undefined, endDateCol: 'created_at' },
      );
    });

    it('should filter by currency', async () => {
      cardUserRepository.findOne.mockResolvedValue(mockCardUser as any);
      cardTransactionRepository.findAllWithCardLastFourDigits.mockResolvedValue(mockPaginatedResponse as any);

      const result = await service.getCardTransactions('user-123', {
        currency: 'USD',
      });

      expect(result).toEqual(mockPaginatedResponse);
      expect(cardUserRepository.findOne).toHaveBeenCalledWith({ user_id: 'user-123' });
      expect(cardTransactionRepository.findAllWithCardLastFourDigits).toHaveBeenCalledWith(
        { user_id: 'user-123', card_user_id: 'card-user-123', currency: 'USD' },
        { page: undefined, limit: undefined, endDateCol: 'created_at' },
      );
    });

    it('should filter by provider_reference', async () => {
      cardUserRepository.findOne.mockResolvedValue(mockCardUser as any);
      cardTransactionRepository.findAllWithCardLastFourDigits.mockResolvedValue(mockPaginatedResponse as any);

      const result = await service.getCardTransactions('user-123', {
        provider_reference: 'REF_123456',
      });

      expect(result).toEqual(mockPaginatedResponse);
      expect(cardUserRepository.findOne).toHaveBeenCalledWith({ user_id: 'user-123' });
      expect(cardTransactionRepository.findAllWithCardLastFourDigits).toHaveBeenCalledWith(
        { user_id: 'user-123', card_user_id: 'card-user-123', provider_reference: 'REF_123456' },
        { page: undefined, limit: undefined, endDateCol: 'created_at' },
      );
    });

    it('should filter by type', async () => {
      cardUserRepository.findOne.mockResolvedValue(mockCardUser as any);
      cardTransactionRepository.findAllWithCardLastFourDigits.mockResolvedValue(mockPaginatedResponse as any);

      const result = await service.getCardTransactions('user-123', {
        type: 'debit',
      });

      expect(result).toEqual(mockPaginatedResponse);
      expect(cardUserRepository.findOne).toHaveBeenCalledWith({ user_id: 'user-123' });
      expect(cardTransactionRepository.findAllWithCardLastFourDigits).toHaveBeenCalledWith(
        { user_id: 'user-123', card_user_id: 'card-user-123', type: 'debit' },
        { page: undefined, limit: undefined, endDateCol: 'created_at' },
      );
    });

    it('should filter by start_date', async () => {
      cardUserRepository.findOne.mockResolvedValue(mockCardUser as any);
      cardTransactionRepository.findAllWithCardLastFourDigits.mockResolvedValue(mockPaginatedResponse as any);

      const result = await service.getCardTransactions('user-123', {
        start_date: '2025-01-01',
      });

      expect(result).toEqual(mockPaginatedResponse);
      expect(cardUserRepository.findOne).toHaveBeenCalledWith({ user_id: 'user-123' });
      expect(cardTransactionRepository.findAllWithCardLastFourDigits).toHaveBeenCalledWith(
        { user_id: 'user-123', card_user_id: 'card-user-123' },
        { page: undefined, limit: undefined, endDateCol: 'created_at', startDate: '2025-01-01 00:00:00.000 Z' },
      );
    });

    it('should filter by end_date', async () => {
      cardUserRepository.findOne.mockResolvedValue(mockCardUser as any);
      cardTransactionRepository.findAllWithCardLastFourDigits.mockResolvedValue(mockPaginatedResponse as any);

      const result = await service.getCardTransactions('user-123', {
        end_date: '2025-12-31',
      });

      expect(result).toEqual(mockPaginatedResponse);
      expect(cardUserRepository.findOne).toHaveBeenCalledWith({ user_id: 'user-123' });
      expect(cardTransactionRepository.findAllWithCardLastFourDigits).toHaveBeenCalledWith(
        { user_id: 'user-123', card_user_id: 'card-user-123' },
        { page: undefined, limit: undefined, endDateCol: 'created_at', endDate: '2025-12-31 23:59:59.999 Z' },
      );
    });

    it('should filter by all filters combined', async () => {
      cardUserRepository.findOne.mockResolvedValue(mockCardUser as any);
      cardTransactionRepository.findAllWithCardLastFourDigits.mockResolvedValue(mockPaginatedResponse as any);

      const result = await service.getCardTransactions('user-123', {
        page: 1,
        limit: 10,
        card_id: 'card-123',
        transaction_type: CardTransactionType.SPEND,
        status: CardTransactionStatus.SUCCESSFUL,
        currency: 'USD',
        provider_reference: 'REF_123456',
        type: CardTransactionDrCr.DEBIT,
        start_date: '2025-01-01',
        end_date: '2025-12-31',
      });

      expect(result).toEqual(mockPaginatedResponse);
      expect(cardUserRepository.findOne).toHaveBeenCalledWith({ user_id: 'user-123' });
      expect(cardTransactionRepository.findAllWithCardLastFourDigits).toHaveBeenCalledWith(
        {
          user_id: 'user-123',
          card_user_id: 'card-user-123',
          card_id: 'card-123',
          transaction_type: 'spend',
          status: 'successful',
          currency: 'USD',
          provider_reference: 'REF_123456',
          type: 'debit',
        },
        {
          page: 1,
          limit: 10,
          endDateCol: 'created_at',
          startDate: '2025-01-01 00:00:00.000 Z',
          endDate: '2025-12-31 23:59:59.999 Z',
        },
      );
    });

    it('should return empty result when cardUser not found', async () => {
      cardUserRepository.findOne.mockResolvedValue(null);

      const result = await service.getCardTransactions('user-123', {});

      expect(result).toEqual({
        card_transactions: [],
        pagination: {
          current_page: 1,
          next_page: 0,
          previous_page: 0,
          limit: 10,
          page_count: 0,
          total: 0,
        },
      });
      expect(cardUserRepository.findOne).toHaveBeenCalledWith({ user_id: 'user-123' });
      expect(cardTransactionRepository.findAllWithCardLastFourDigits).not.toHaveBeenCalled();
    });

    it('should filter by merchant name search', async () => {
      cardUserRepository.findOne.mockResolvedValue(mockCardUser as any);
      cardTransactionRepository.findAllWithCardLastFourDigits.mockResolvedValue(mockPaginatedResponse as any);

      const result = await service.getCardTransactions('user-123', {
        search: 'Amazon',
      });

      expect(result).toEqual(mockPaginatedResponse);
      expect(cardUserRepository.findOne).toHaveBeenCalledWith({ user_id: 'user-123' });
      expect(cardTransactionRepository.findAllWithCardLastFourDigits).toHaveBeenCalledWith(
        { user_id: 'user-123', card_user_id: 'card-user-123' },
        { page: undefined, limit: undefined, endDateCol: 'created_at', search: 'Amazon', filterBy: 'merchant_name' },
      );
    });

    it('should handle transactions without card', async () => {
      const mockResponseWithoutVirtualCard = {
        card_transactions: [
          {
            id: 'txn-1',
            card: null,
          },
        ],
        pagination: mockPaginatedResponse.pagination,
      };
      cardUserRepository.findOne.mockResolvedValue(mockCardUser as any);
      cardTransactionRepository.findAllWithCardLastFourDigits.mockResolvedValue(mockResponseWithoutVirtualCard as any);

      const result = await service.getCardTransactions('user-123', {});

      expect((result.card_transactions[0] as any).last_four_digits).toBeUndefined();
      expect((result.card_transactions[0] as any).card).toBeNull();
    });
  });

  describe('getCardTransaction', () => {
    const mockCardTransaction: any = {
      id: 'txn-123',
      user_id: 'user-123',
      card_user_id: 'card-user-123',
      card_id: 'card-123',
      amount: 50.0,
      provider_reference: 'REF_123456',
      currency: 'USD',
      transactionhash: null,
      authorized_amount: 50.0,
      authorization_method: 'chip',
      merchant_name: 'Amazon',
      merchant_id: 'merchant_123',
      merchant_city: 'Seattle',
      merchant_country: 'US',
      merchant_category: 'Online Retail',
      merchant_category_code: '5999',
      status: 'successful' as const,
      declined_reason: null,
      authorized_at: new Date('2025-01-15T10:30:00.000Z'),
      balance_before: 1000.0,
      balance_after: 950.0,
      transaction_type: 'spend' as const,
      type: 'debit' as const,
      created_at: new Date('2025-01-15T10:30:00.000Z'),
      updated_at: new Date('2025-01-15T10:30:00.000Z'),
    };

    it('should return a card transaction by id and user_id', async () => {
      const mockCardTransactionWithLastFour = {
        ...mockCardTransaction,
        card: { last_four_digits: '1234' },
      };
      cardTransactionRepository.findByIdWithCardLastFourDigits.mockResolvedValue(
        mockCardTransactionWithLastFour as any,
      );

      const result = await service.getCardTransaction('txn-123', 'user-123');

      expect(result.last_four_digits).toBe('1234');
      expect(result.card).toBeUndefined();
      expect(cardTransactionRepository.findByIdWithCardLastFourDigits).toHaveBeenCalledWith('txn-123', 'user-123');
    });

    it('should return card transaction without last_four_digits when card is null', async () => {
      const mockCardTransactionWithoutCard = {
        ...mockCardTransaction,
        card: null,
      };
      cardTransactionRepository.findByIdWithCardLastFourDigits.mockResolvedValue(mockCardTransactionWithoutCard as any);

      const result = await service.getCardTransaction('txn-123', 'user-123');

      expect(result.last_four_digits).toBeUndefined();
      expect(result.card).toBeNull();
    });

    it('should throw NotFoundException when transaction not found', async () => {
      cardTransactionRepository.findByIdWithCardLastFourDigits.mockResolvedValue(null);

      await expect(service.getCardTransaction('txn-123', 'user-123')).rejects.toThrow(NotFoundException);
      await expect(service.getCardTransaction('txn-123', 'user-123')).rejects.toThrow('Card transaction not found');
      expect(cardTransactionRepository.findByIdWithCardLastFourDigits).toHaveBeenCalledWith('txn-123', 'user-123');
    });

    it('should throw NotFoundException when transaction belongs to different user', async () => {
      cardTransactionRepository.findByIdWithCardLastFourDigits.mockResolvedValue(null);

      await expect(service.getCardTransaction('txn-123', 'user-456')).rejects.toThrow(NotFoundException);
      expect(cardTransactionRepository.findByIdWithCardLastFourDigits).toHaveBeenCalledWith('txn-123', 'user-456');
    });
  });

  describe('freezeOrUnfreezeCard - missing provider_ref', () => {
    it('should throw BadRequestException when card provider_ref is missing', async () => {
      const freezeDto: FreezeCardDto = {
        freeze: true,
        transaction_pin: '123456',
      };

      const cardWithoutProviderRef = {
        ...mockCard,
        provider_ref: null,
      };

      cardRepository.findOne.mockResolvedValue(cardWithoutProviderRef as any);

      await expect(service.freezeOrUnfreezeCard(mockUser, 'card-123', freezeDto)).rejects.toThrow(BadRequestException);
      await expect(service.freezeOrUnfreezeCard(mockUser, 'card-123', freezeDto)).rejects.toThrow(
        'Card provider reference not found',
      );
    });
  });

  describe('getCardTransactionFee - minimum fee enforcement', () => {
    it('should enforce minimum fee of 1 cent when calculated fee is below 1 cent', async () => {
      jest.spyOn(CardFeesService, 'calculateFee').mockReturnValue({
        fee: 0.005,
        feeType: 'percentage' as any,
      });

      const result = await service.getCardTransactionFee(100, CardFeeType.FIAT_TOP_UP);

      expect(result.fee).toBe(1);
      expect(CardFeesService.calculateFee).toHaveBeenCalledWith(100, CardFeeType.FIAT_TOP_UP);
    });

    it('should not enforce minimum when fee is 0', async () => {
      jest.spyOn(CardFeesService, 'calculateFee').mockReturnValue({
        fee: 0,
        feeType: 'none' as any,
      });

      const result = await service.getCardTransactionFee(100, CardFeeType.DOMESTIC_PURCHASE);

      expect(result.fee).toBe(0);
    });
  });

  describe('getCardFeeConfig', () => {
    it('should return fee config for given fee type', () => {
      jest.spyOn(CardFeesService, 'getFeeConfig').mockReturnValue({
        feeType: CardFeeType.FIAT_TOP_UP,
        calculationType: 'percentage' as any,
        percentage: 0.5,
        description: 'Fiat top-up',
        comment: '0.5%',
        appliedBy: 'platform',
      });

      const result = service.getCardFeeConfig(CardFeeType.FIAT_TOP_UP);

      expect(result).toBeDefined();
      expect(CardFeesService.getFeeConfig).toHaveBeenCalledWith(CardFeeType.FIAT_TOP_UP);
    });
  });

  describe('requiresChargeApi', () => {
    it('should return true when fee type requires charge API', () => {
      jest.spyOn(CardFeesService, 'requiresChargeApi').mockReturnValue(true);

      const result = service.requiresChargeApi(CardFeeType.FIAT_TOP_UP);

      expect(result).toBe(true);
      expect(CardFeesService.requiresChargeApi).toHaveBeenCalledWith(CardFeeType.FIAT_TOP_UP);
    });

    it('should return false when fee type does not require charge API', () => {
      jest.spyOn(CardFeesService, 'requiresChargeApi').mockReturnValue(false);

      const result = service.requiresChargeApi(CardFeeType.DOMESTIC_PURCHASE);

      expect(result).toBe(false);
      expect(CardFeesService.requiresChargeApi).toHaveBeenCalledWith(CardFeeType.DOMESTIC_PURCHASE);
    });
  });

  describe('ensureRainDepositAddress - existing deposit address', () => {
    it('should skip creating deposit address when it already exists', async () => {
      const depositAddressRepository = testingModule.get(
        DepositAddressRepository,
      ) as jest.Mocked<DepositAddressRepository>;

      jest.spyOn(StableCoinsService, 'getDefaultNetwork').mockReturnValue(OneDoshSupportedCryptoNetworks.ETH);
      jest.spyOn(service as any, 'mapNetworkToChainName').mockReturnValue('ethereum');

      depositAddressRepository.findOne.mockResolvedValue({
        id: 'deposit-123',
        address: '0xexisting',
        user_id: 'user-123',
        provider: 'rain',
        asset: 'ethereum',
      } as any);

      await (service as any).ensureRainDepositAddress(mockUser, 'provider-ref-123');

      expect(depositAddressRepository.findOne).toHaveBeenCalled();
      expect(cardAdapter.getUserContracts).not.toHaveBeenCalled();
      expect(cardAdapter.createUserContract).not.toHaveBeenCalled();
    });
  });

  describe('formatFrequencyLabel', () => {
    it('should return correct label for PER_24_HOUR_PERIOD', () => {
      const result = (service as any).formatFrequencyLabel(CardLimitFrequency.PER_24_HOUR_PERIOD);
      expect(result).toBe('Per 24 Hour Period');
    });

    it('should return correct label for PER_7_DAY_PERIOD', () => {
      const result = (service as any).formatFrequencyLabel(CardLimitFrequency.PER_7_DAY_PERIOD);
      expect(result).toBe('Per 7 Day Period');
    });

    it('should return correct label for PER_YEAR_PERIOD', () => {
      const result = (service as any).formatFrequencyLabel(CardLimitFrequency.PER_YEAR_PERIOD);
      expect(result).toBe('Per Year Period');
    });

    it('should return correct label for ALL_TIME', () => {
      const result = (service as any).formatFrequencyLabel(CardLimitFrequency.ALL_TIME);
      expect(result).toBe('All Time');
    });

    it('should return correct label for PER_AUTHORIZATION', () => {
      const result = (service as any).formatFrequencyLabel(CardLimitFrequency.PER_AUTHORIZATION);
      expect(result).toBe('Per Authorization');
    });

    it('should return frequency string for unknown frequency', () => {
      const unknownFrequency = 'unknown' as CardLimitFrequency;
      const result = (service as any).formatFrequencyLabel(unknownFrequency);
      expect(result).toBe('unknown');
    });
  });

  describe('mapProviderStatusToInternalStatus', () => {
    it('should map approved to APPROVED', () => {
      const result = (service as any).mapProviderStatusToInternalStatus('approved');
      expect(result).toBe(ICardUserStatus.APPROVED);
    });

    it('should map rejected to REJECTED', () => {
      const result = (service as any).mapProviderStatusToInternalStatus('rejected');
      expect(result).toBe(ICardUserStatus.REJECTED);
    });

    it('should map denied to REJECTED', () => {
      const result = (service as any).mapProviderStatusToInternalStatus('denied');
      expect(result).toBe(ICardUserStatus.REJECTED);
    });

    it('should map active to ACTIVE', () => {
      const result = (service as any).mapProviderStatusToInternalStatus('active');
      expect(result).toBe(ICardUserStatus.ACTIVE);
    });

    it('should map inactive to INACTIVE', () => {
      const result = (service as any).mapProviderStatusToInternalStatus('inactive');
      expect(result).toBe(ICardUserStatus.INACTIVE);
    });

    it('should map suspended to SUSPENDED', () => {
      const result = (service as any).mapProviderStatusToInternalStatus('suspended');
      expect(result).toBe(ICardUserStatus.SUSPENDED);
    });

    it('should map unknown status to PENDING', () => {
      const result = (service as any).mapProviderStatusToInternalStatus('unknown');
      expect(result).toBe(ICardUserStatus.PENDING);
    });

    it('should handle uppercase status', () => {
      const result = (service as any).mapProviderStatusToInternalStatus('APPROVED');
      expect(result).toBe(ICardUserStatus.APPROVED);
    });

    it('should map cancelled to REJECTED', () => {
      const result = (service as any).mapProviderStatusToInternalStatus('cancelled');
      expect(result).toBe(ICardUserStatus.REJECTED);
    });

    it('should map canceled to REJECTED', () => {
      const result = (service as any).mapProviderStatusToInternalStatus('canceled');
      expect(result).toBe(ICardUserStatus.REJECTED);
    });
  });

  describe('fundCard - edge cases', () => {
    let depositAddressRepository: jest.Mocked<DepositAddressRepository>;

    beforeEach(() => {
      depositAddressRepository = testingModule.get(DepositAddressRepository) as jest.Mocked<DepositAddressRepository>;
      jest.spyOn(StableCoinsService, 'getDefaultNetwork').mockReturnValue('ETH' as any);
      jest.spyOn(EnvironmentService, 'isProduction').mockReturnValue(false);
    });

    it('should throw BadRequestException when default chain not configured', async () => {
      cardRepository.findOne.mockResolvedValue(mockCard as any);
      cardUserRepository.findOne.mockResolvedValue(mockCardUser as any);
      jest.spyOn(service as any, 'getDefaultChainId').mockReturnValue(undefined);

      const fundDto: CardFundDto = {
        amount: 100,
        rail: CardFundRails.FIAT,
        transaction_pin: '123456',
      };

      await expect(service.fundCard(mockUser, { ...fundDto, card_id: 'card-123' })).rejects.toThrow(
        'Default chain not configured for card funding',
      );
    });

    it('should throw BadRequestException when chain info is invalid', async () => {
      cardRepository.findOne.mockResolvedValue(mockCard as any);
      cardUserRepository.findOne.mockResolvedValue(mockCardUser as any);
      jest.spyOn(service as any, 'getDefaultChainId').mockReturnValue(999999);

      const fundDto: CardFundDto = {
        amount: 100,
        rail: CardFundRails.FIAT,
        transaction_pin: '123456',
      };

      await expect(service.fundCard(mockUser, { ...fundDto, card_id: 'card-123' })).rejects.toThrow(
        'Invalid default chain configuration',
      );
    });

    it('should throw BadRequestException when deposit address not available', async () => {
      cardRepository.findOne.mockResolvedValue(mockCard as any);
      cardUserRepository.findOne.mockResolvedValue(mockCardUser as any);
      depositAddressRepository.findOne.mockResolvedValue(null);

      const fundDto: CardFundDto = {
        amount: 100,
        rail: CardFundRails.FIAT,
        transaction_pin: '123456',
      };

      await expect(service.fundCard(mockUser, { ...fundDto, card_id: 'card-123' })).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should calculate fee correctly for blockchain rail', async () => {
      cardRepository.findOne.mockResolvedValue(mockCard as any);
      cardUserRepository.findOne.mockResolvedValue(mockCardUser as any);
      cardTransactionRepository.create.mockResolvedValue({ id: 'txn-123' } as any);
      cardFundingProcessor.queueCardFunding.mockResolvedValue({ id: 'job-123' } as any);
      depositAddressRepository.findOne.mockResolvedValue({
        id: 'deposit-1',
        address: '0x123',
        asset: 'ethereum',
      } as any);

      const fundDto: CardFundDto = {
        amount: 100,
        rail: CardFundRails.BLOCKCHAIN,
        transaction_pin: '123456',
      };

      const result = await service.fundCard(mockUser, { ...fundDto, card_id: 'card-123' });

      expect(result.fee).toBeDefined();
      expect(result.total_amount).toBeGreaterThanOrEqual(result.amount);
    });

    it('should handle card with existing balance', async () => {
      const cardWithBalance = { ...mockCard, balance: 5000 };
      cardRepository.findOne.mockResolvedValue(cardWithBalance as any);
      cardUserRepository.findOne.mockResolvedValue(mockCardUser as any);
      cardTransactionRepository.create.mockResolvedValue({ id: 'txn-123' } as any);
      cardFundingProcessor.queueCardFunding.mockResolvedValue({ id: 'job-123' } as any);
      depositAddressRepository.findOne.mockResolvedValue({
        id: 'deposit-1',
        address: '0x123',
        asset: 'ethereum',
      } as any);

      const fundDto: CardFundDto = {
        amount: 100,
        rail: CardFundRails.FIAT,
        transaction_pin: '123456',
      };

      const result = await service.fundCard(mockUser, { ...fundDto, card_id: 'card-123' });

      expect(result).toBeDefined();
      expect(cardTransactionRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          balance_before: 5000,
        }),
      );
    });

    it('should enforce $5.00 minimum for first funding in production', async () => {
      cardRepository.findOne.mockResolvedValue(mockCard as any);
      cardUserRepository.findOne.mockResolvedValue(mockCardUser as any);
      jest.spyOn(service as any, 'getDefaultChainId').mockReturnValue(11155111);
      jest.spyOn(EnvironmentService, 'isProduction').mockReturnValue(true);
      cardTransactionRepository.findPreviousSuccessfulDeposits.mockResolvedValue([]);

      const fundDto: CardFundDto = {
        amount: 4.5,
        rail: CardFundRails.FIAT,
        transaction_pin: '123456',
      };

      await expect(service.fundCard(mockUser, { ...fundDto, card_id: 'card-123' })).rejects.toThrow(
        'First card top-up must be at least $5.00',
      );
    });

    it('should allow sub-dollar funding after the first successful funding in production', async () => {
      cardRepository.findOne.mockResolvedValue(mockCard as any);
      cardUserRepository.findOne.mockResolvedValue(mockCardUser as any);
      jest.spyOn(service as any, 'getDefaultChainId').mockReturnValue(11155111);
      jest.spyOn(EnvironmentService, 'isProduction').mockReturnValue(true);
      cardTransactionRepository.findPreviousSuccessfulDeposits.mockResolvedValue([{ id: 'prev' }] as any);

      const fundDto: CardFundDto = {
        amount: 0.5,
        rail: CardFundRails.FIAT,
        transaction_pin: '123456',
      };

      cardTransactionRepository.create.mockResolvedValue({ id: 'txn-123' } as any);
      cardFundingProcessor.queueCardFunding.mockResolvedValue({ id: 'job-123' } as any);
      depositAddressRepository.findOne.mockResolvedValue({
        id: 'deposit-1',
        address: '0x123',
        asset: 'ethereum',
      } as any);

      const result = await service.fundCard(mockUser, { ...fundDto, card_id: 'card-123' });

      expect(result).toBeDefined();
    });

    it('should allow amount less than $1.00 in non-production', async () => {
      cardRepository.findOne.mockResolvedValue(mockCard as any);
      cardUserRepository.findOne.mockResolvedValue(mockCardUser as any);
      cardTransactionRepository.create.mockResolvedValue({ id: 'txn-123' } as any);
      cardFundingProcessor.queueCardFunding.mockResolvedValue({ id: 'job-123' } as any);
      depositAddressRepository.findOne.mockResolvedValue({
        id: 'deposit-1',
        address: '0x123',
        asset: 'ethereum',
      } as any);
      jest.spyOn(service as any, 'getDefaultChainId').mockReturnValue(11155111);
      jest.spyOn(EnvironmentService, 'isProduction').mockReturnValue(false);

      const fundDto: CardFundDto = {
        amount: 0.5,
        rail: CardFundRails.FIAT,
        transaction_pin: '123456',
      };

      const result = await service.fundCard(mockUser, { ...fundDto, card_id: 'card-123' });

      expect(result).toBeDefined();
      expect(cardTransactionRepository.create).toHaveBeenCalled();
    });
  });

  describe('fundCard - deposit address validation', () => {
    let depositAddressRepository: jest.Mocked<DepositAddressRepository>;

    beforeEach(() => {
      depositAddressRepository = testingModule.get(DepositAddressRepository) as jest.Mocked<DepositAddressRepository>;
      cardRepository.findOne.mockResolvedValue(mockCard as any);
      cardUserRepository.findOne.mockResolvedValue(mockCardUser as any);
      jest.spyOn(StableCoinsService, 'getDefaultNetwork').mockReturnValue('ETH' as any);
      jest.spyOn(service as any, 'getDefaultChainId').mockReturnValue(11155111);
    });

    describe('production environment', () => {
      beforeEach(() => {
        jest.spyOn(EnvironmentService, 'isProduction').mockReturnValue(true);
      });

      it('should throw error when deposit address not found for default chain in production', async () => {
        depositAddressRepository.findOne.mockResolvedValue(null);

        const fundDto: CardFundDto = {
          amount: 100,
          rail: CardFundRails.FIAT,
          transaction_pin: '123456',
        };

        await expect(service.fundCard(mockUser, { ...fundDto, card_id: 'card-123' })).rejects.toThrow(
          BadRequestException,
        );
        await expect(service.fundCard(mockUser, { ...fundDto, card_id: 'card-123' })).rejects.toThrow(
          'Deposit address not available for',
        );
        expect(depositAddressRepository.findLatestRainDepositAddressByUserId).not.toHaveBeenCalled();
      });

      it('should throw error when deposit address asset does not match default chain in production', async () => {
        depositAddressRepository.findOne.mockResolvedValue({
          id: 'deposit-1',
          address: '0x123',
          asset: 'polygon',
          user_id: 'user-123',
          provider: 'rain',
        } as any);

        const fundDto: CardFundDto = {
          amount: 100,
          rail: CardFundRails.FIAT,
          transaction_pin: '123456',
        };

        await expect(service.fundCard(mockUser, { ...fundDto, card_id: 'card-123' })).rejects.toThrow(
          BadRequestException,
        );
        await expect(service.fundCard(mockUser, { ...fundDto, card_id: 'card-123' })).rejects.toThrow(
          'Deposit address must be for the default chain',
        );
      });

      it('should succeed when deposit address matches default chain in production', async () => {
        depositAddressRepository.findOne.mockResolvedValue({
          id: 'deposit-1',
          address: '0x123',
          asset: 'ethereum',
          user_id: 'user-123',
          provider: 'rain',
        } as any);
        cardTransactionRepository.create.mockResolvedValue({ id: 'txn-123' } as any);
        cardFundingProcessor.queueCardFunding.mockResolvedValue({ id: 'job-123' } as any);

        const fundDto: CardFundDto = {
          amount: 100,
          rail: CardFundRails.FIAT,
          transaction_pin: '123456',
        };

        const result = await service.fundCard(mockUser, { ...fundDto, card_id: 'card-123' });

        expect(result).toBeDefined();
        expect(depositAddressRepository.findOne).toHaveBeenCalledWith({
          user_id: 'user-123',
          provider: 'rain',
          asset: 'ethereum',
        });
      });
    });

    describe('staging/dev environment', () => {
      beforeEach(() => {
        jest.spyOn(EnvironmentService, 'isProduction').mockReturnValue(false);
      });

      it('should fallback to latest Rain deposit address when default chain address not found', async () => {
        depositAddressRepository.findOne.mockResolvedValue(null);
        depositAddressRepository.findLatestRainDepositAddressByUserId.mockResolvedValue({
          id: 'deposit-2',
          address: '0x456',
          asset: 'polygon',
          user_id: 'user-123',
          provider: 'rain',
        } as any);
        cardTransactionRepository.create.mockResolvedValue({ id: 'txn-123' } as any);
        cardFundingProcessor.queueCardFunding.mockResolvedValue({ id: 'job-123' } as any);

        const fundDto: CardFundDto = {
          amount: 100,
          rail: CardFundRails.FIAT,
          transaction_pin: '123456',
        };

        const result = await service.fundCard(mockUser, { ...fundDto, card_id: 'card-123' });

        expect(result).toBeDefined();
        expect(depositAddressRepository.findOne).toHaveBeenCalled();
        expect(depositAddressRepository.findLatestRainDepositAddressByUserId).toHaveBeenCalledWith('user-123');
      });

      it('should throw error when no deposit address found at all in staging/dev', async () => {
        depositAddressRepository.findOne.mockResolvedValue(null);
        depositAddressRepository.findLatestRainDepositAddressByUserId.mockResolvedValue(null);

        const fundDto: CardFundDto = {
          amount: 100,
          rail: CardFundRails.FIAT,
          transaction_pin: '123456',
        };

        await expect(service.fundCard(mockUser, { ...fundDto, card_id: 'card-123' })).rejects.toThrow(
          BadRequestException,
        );
        await expect(service.fundCard(mockUser, { ...fundDto, card_id: 'card-123' })).rejects.toThrow(
          'Deposit address not available for',
        );
        expect(depositAddressRepository.findLatestRainDepositAddressByUserId).toHaveBeenCalledWith('user-123');
      });

      it('should use default chain deposit address when available in staging/dev', async () => {
        depositAddressRepository.findOne.mockResolvedValue({
          id: 'deposit-1',
          address: '0x123',
          asset: 'ethereum',
          user_id: 'user-123',
          provider: 'rain',
        } as any);
        cardTransactionRepository.create.mockResolvedValue({ id: 'txn-123' } as any);
        cardFundingProcessor.queueCardFunding.mockResolvedValue({ id: 'job-123' } as any);

        const fundDto: CardFundDto = {
          amount: 100,
          rail: CardFundRails.FIAT,
          transaction_pin: '123456',
        };

        const result = await service.fundCard(mockUser, { ...fundDto, card_id: 'card-123' });

        expect(result).toBeDefined();
        expect(depositAddressRepository.findOne).toHaveBeenCalled();
        expect(depositAddressRepository.findLatestRainDepositAddressByUserId).not.toHaveBeenCalled();
      });
    });
  });

  describe('getCardTransactionFee - edge cases', () => {
    it('should return correct fee for normal calculation', async () => {
      jest.spyOn(CardFeesService, 'calculateFee').mockReturnValue({
        fee: 2.5,
        feePercentage: 2.5,
        feeFixed: 0,
        feeType: 'percentage' as any,
      });

      const result = await service.getCardTransactionFee(100, CardFeeType.STABLECOIN_TOP_UP);

      expect(result.fee).toBe(250);
      expect(result.feePercentage).toBe(2.5);
    });

    it('should handle very small amounts', async () => {
      jest.spyOn(CardFeesService, 'calculateFee').mockReturnValue({
        fee: 0.001,
        feeType: 'percentage' as any,
      });

      const result = await service.getCardTransactionFee(0.1, CardFeeType.FIAT_TOP_UP);

      expect(result.fee).toBe(1);
    });
  });

  describe('getAllCardFees', () => {
    it('should return all card fees with minimum charge API fee', () => {
      jest.spyOn(CardFeesService, 'getAllFeeConfigs').mockReturnValue([
        {
          feeType: CardFeeType.DOMESTIC_PURCHASE,
          calculationType: 'none' as any,
          fixed: 0,
          description: 'Domestic purchases',
          comment: '$0 (+ variable network fees)',
          appliedBy: 'rain',
        },
        {
          feeType: CardFeeType.FIAT_TOP_UP,
          calculationType: 'percentage' as any,
          percentage: 0.5,
          description: 'Fiat top-up',
          comment: '0.5%',
          appliedBy: 'platform',
          requiresChargeApi: true,
        },
      ]);

      const result = service.getAllCardFees();

      expect(result.fees).toHaveLength(2);
      expect(result.fees[0].feeType).toBe(CardFeeType.DOMESTIC_PURCHASE);
      expect(result.fees[0].requiresChargeApi).toBe(false);
      expect(result.fees[1].feeType).toBe(CardFeeType.FIAT_TOP_UP);
      expect(result.fees[1].requiresChargeApi).toBe(true);
      expect(result.minimumChargeApiFee).toBe(0.01);
      expect(CardFeesService.getAllFeeConfigs).toHaveBeenCalled();
    });

    it('should map all fee config properties correctly', () => {
      jest.spyOn(CardFeesService, 'getAllFeeConfigs').mockReturnValue([
        {
          feeType: CardFeeType.ATM_WITHDRAWAL,
          calculationType: 'percentage_plus_fixed' as any,
          percentage: 0.75,
          fixed: 2,
          description: 'ATM withdrawal',
          comment: '$2 + 0.75%',
          appliedBy: 'rain',
          requiresChargeApi: false,
        },
      ]);

      const result = service.getAllCardFees();

      expect(result.fees[0]).toEqual({
        feeType: CardFeeType.ATM_WITHDRAWAL,
        calculationType: 'percentage_plus_fixed',
        percentage: 0.75,
        fixed: 2,
        description: 'ATM withdrawal',
        comment: '$2 + 0.75%',
        appliedBy: 'rain',
        requiresChargeApi: false,
      });
    });
  });

  describe('createCard - edge cases', () => {
    it('should throw BadRequestException when provider_status is not approved', async () => {
      const cardUserNotApproved = {
        ...mockCardUser,
        status: ICardUserStatus.APPROVED,
        provider_status: 'pending',
      };
      cardUserRepository.findOne.mockResolvedValue(cardUserNotApproved as any);

      const createCardDto: CreateCardDto = {
        type: CardType.VIRTUAL,
      };

      await expect(service.createCard(mockUser, createCardDto)).rejects.toThrow(BadRequestException);
      await expect(service.createCard(mockUser, createCardDto)).rejects.toThrow('Card user is not approved');
    });

    it('should handle null provider_status', async () => {
      const cardUserNullStatus = {
        ...mockCardUser,
        status: ICardUserStatus.APPROVED,
        provider_status: null,
      };
      cardUserRepository.findOne.mockResolvedValue(cardUserNullStatus as any);

      const createCardDto: CreateCardDto = {
        type: CardType.VIRTUAL,
      };

      await expect(service.createCard(mockUser, createCardDto)).rejects.toThrow(BadRequestException);
    });
  });

  describe('create - edge cases', () => {
    const createCardUserDto = {} as any;
    const ipAddress = '192.168.1.1';

    it('should handle missing expectedAnnualSalary', async () => {
      const mockKycVerification = {
        id: 'kyc-123',
        user_id: 'user-123',
        provider_ref: 'applicant-123',
      };

      const mockKycDetailsNoSalary = {
        data: {
          expectedMonthlyPaymentsUsd: '2000',
          mostRecentOccupation: 'Software Engineer',
          accountPurpose: 'Personal use',
        },
      };

      const mockShareTokenResponse = {
        data: {
          token: 'share-token-123',
        },
      };

      const mockBlockchainWallet = {
        address: '0x1234567890abcdef',
        network: 'ethereum',
      };

      const mockCardUserResponse = {
        providerRef: 'provider-ref-123',
        status: 'approved',
        applicationStatusReason: 'Approved',
      };

      cardUserRepository.findOne.mockResolvedValue(null);
      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        first: jest.fn().mockResolvedValue(mockKycVerification),
      };
      kycVerificationRepository.query.mockReturnValue(mockQueryBuilder as any);
      kycAdapter.getKycDetails.mockResolvedValue(mockKycDetailsNoSalary as any);
      kycAdapter.generateShareToken.mockResolvedValue(mockShareTokenResponse as any);
      blockchainWalletService.createCustomWallet.mockResolvedValue(mockBlockchainWallet as any);
      cardAdapter.createCardUser.mockResolvedValue(mockCardUserResponse as any);
      cardUserRepository.create.mockResolvedValue(mockCardUser as any);

      jest.spyOn(RainConfigProvider.prototype, 'getConfig').mockReturnValue({
        clientId: 'test-client-id',
      } as any);

      const result = await service.create(mockUser, createCardUserDto, ipAddress);

      expect(result).toBeDefined();
      expect(cardAdapter.createCardUser).toHaveBeenCalledWith(
        expect.objectContaining({
          salary: 0,
        }),
      );
    });

    it('should handle missing expectedMonthlyPaymentsUsd', async () => {
      const mockKycVerification = {
        id: 'kyc-123',
        user_id: 'user-123',
        provider_ref: 'applicant-123',
      };

      const mockKycDetailsNoMonthly = {
        data: {
          expectedAnnualSalary: '50000',
          mostRecentOccupation: 'Software Engineer',
          accountPurpose: 'Personal use',
        },
      };

      const mockShareTokenResponse = {
        data: {
          token: 'share-token-123',
        },
      };

      const mockBlockchainWallet = {
        address: '0x1234567890abcdef',
        network: 'ethereum',
      };

      const mockCardUserResponse = {
        providerRef: 'provider-ref-123',
        status: 'approved',
        applicationStatusReason: 'Approved',
      };

      cardUserRepository.findOne.mockResolvedValue(null);
      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        first: jest.fn().mockResolvedValue(mockKycVerification),
      };
      kycVerificationRepository.query.mockReturnValue(mockQueryBuilder as any);
      kycAdapter.getKycDetails.mockResolvedValue(mockKycDetailsNoMonthly as any);
      kycAdapter.generateShareToken.mockResolvedValue(mockShareTokenResponse as any);
      blockchainWalletService.createCustomWallet.mockResolvedValue(mockBlockchainWallet as any);
      cardAdapter.createCardUser.mockResolvedValue(mockCardUserResponse as any);
      cardUserRepository.create.mockResolvedValue(mockCardUser as any);

      jest.spyOn(RainConfigProvider.prototype, 'getConfig').mockReturnValue({
        clientId: 'test-client-id',
      } as any);

      const result = await service.create(mockUser, createCardUserDto, ipAddress);

      expect(result).toBeDefined();
      expect(cardAdapter.createCardUser).toHaveBeenCalledWith(
        expect.objectContaining({
          expectedMonthlySpend: 0,
        }),
      );
    });
  });

  describe('getDefaultChainId', () => {
    beforeEach(() => {
      jest.spyOn(StableCoinsService, 'getDefaultNetwork').mockReturnValue('ETH' as any);
      jest.spyOn(EnvironmentService, 'isProduction').mockReturnValue(false);
    });

    it('should return chain ID for development environment', () => {
      const result = (service as any).getDefaultChainId();

      expect(result).toBe(11155111);
    });

    it('should return chain ID for production environment', () => {
      jest.spyOn(EnvironmentService, 'isProduction').mockReturnValue(true);

      const result = (service as any).getDefaultChainId();

      expect(result).toBe(1);
    });

    it('should return undefined for unknown network', () => {
      jest.spyOn(StableCoinsService, 'getDefaultNetwork').mockReturnValue('UNKNOWN' as any);
      jest.spyOn(service as any, 'mapNetworkToChainName').mockReturnValue('unknownChain');

      const result = (service as any).getDefaultChainId();

      expect(result).toBeUndefined();
    });
  });

  describe('freezeOrUnfreezeCard - user freeze/unfreeze status behavior', () => {
    it('should set INACTIVE status when user freezes card regardless of provider response', async () => {
      cardRepository.findOne.mockResolvedValue(mockCard as any);
      cardAdapter.updateCard.mockResolvedValue({
        status: CardStatus.LOCKED,
      } as any);
      cardRepository.update.mockResolvedValue({ ...mockCard, is_freezed: true } as any);

      const freezeDto: FreezeCardDto = {
        freeze: true,
        transaction_pin: '123456',
      };

      await service.freezeOrUnfreezeCard(mockUser, 'card-123', freezeDto);

      expect(cardRepository.update).toHaveBeenCalledWith(
        { id: 'card-123' },
        expect.objectContaining({
          status: ICardStatus.INACTIVE,
        }),
      );
    });

    it('should set ACTIVE status when user unfreezes card', async () => {
      const frozenCard = { ...mockCard, is_freezed: true, status: ICardStatus.INACTIVE };
      cardRepository.findOne.mockResolvedValue(frozenCard as any);
      cardAdapter.updateCard.mockResolvedValue({
        status: CardStatus.ACTIVE,
      } as any);
      cardRepository.update.mockResolvedValue({ ...mockCard, is_freezed: false } as any);

      const unfreezeDto: FreezeCardDto = {
        freeze: false,
        transaction_pin: '123456',
      };

      await service.freezeOrUnfreezeCard(mockUser, 'card-123', unfreezeDto);

      expect(cardRepository.update).toHaveBeenCalledWith(
        { id: 'card-123' },
        expect.objectContaining({
          status: ICardStatus.ACTIVE,
        }),
      );
    });

    it('should prevent user from unfreezing BLOCKED card', async () => {
      const blockedCard = { ...mockCard, is_freezed: true, status: ICardStatus.BLOCKED };
      cardRepository.findOne.mockResolvedValue(blockedCard as any);

      const unfreezeDto: FreezeCardDto = {
        freeze: false,
        transaction_pin: '123456',
      };

      await expect(service.freezeOrUnfreezeCard(mockUser, 'card-123', unfreezeDto)).rejects.toThrow(
        'Card is blocked and cannot be unfrozen. Please contact support.',
      );
      expect(cardAdapter.updateCard).not.toHaveBeenCalled();
    });
  });

  describe('cancelCard', () => {
    beforeEach(() => {
      userRepository.findActiveById.mockResolvedValue(mockUser as any);
      inAppNotificationService.createNotification.mockResolvedValue({} as any);
      mailerService.send.mockResolvedValue(undefined as any);
    });

    it('should cancel card successfully', async () => {
      const card = { ...mockCard, status: ICardStatus.ACTIVE };
      cardRepository.findOne.mockResolvedValue(card as any);
      cardTransactionRepository.findOne.mockResolvedValue(null);
      cardAdapter.updateCard.mockResolvedValue({
        status: CardStatus.CANCELED,
      } as any);
      cardRepository.update.mockResolvedValue({} as any);

      const result = await service.cancelCard(mockUser, 'card-123');

      expect(cardAdapter.updateCard).toHaveBeenCalledWith('provider-card-ref-123', { status: CardStatus.CANCELED });
      expect(cardRepository.update).toHaveBeenCalledWith(
        { id: 'card-123' },
        expect.objectContaining({
          status: ICardStatus.CANCELED,
          is_freezed: true,
        }),
      );
      expect(result).toEqual({ card_id: 'card-123', status: CardStatus.CANCELED });
    });

    it('should throw when provider_ref is missing', async () => {
      const cardWithoutProviderRef = { ...mockCard, provider_ref: null };
      cardRepository.findOne.mockResolvedValue(cardWithoutProviderRef as any);

      await expect(service.cancelCard(mockUser, 'card-123')).rejects.toThrow('Card provider reference not found');
      expect(cardAdapter.updateCard).not.toHaveBeenCalled();
    });

    it('should throw when card is already canceled', async () => {
      const canceledCard = { ...mockCard, status: ICardStatus.CANCELED };
      cardRepository.findOne.mockResolvedValue(canceledCard as any);

      await expect(service.cancelCard(mockUser, 'card-123')).rejects.toThrow('Card is already canceled');
      expect(cardAdapter.updateCard).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException when card has pending transactions', async () => {
      const card = { ...mockCard, status: ICardStatus.ACTIVE };
      const pendingTransaction = {
        id: 'txn-123',
        card_id: 'card-123',
        status: CardTransactionStatus.PENDING,
      };
      cardRepository.findOne.mockResolvedValue(card as any);
      cardTransactionRepository.findOne.mockResolvedValue(pendingTransaction as any);

      await expect(service.cancelCard(mockUser, 'card-123')).rejects.toThrow(BadRequestException);
      await expect(service.cancelCard(mockUser, 'card-123')).rejects.toThrow(
        'Cannot cancel card with pending transactions',
      );
      expect(cardAdapter.updateCard).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException when provider update fails', async () => {
      const card = { ...mockCard, status: ICardStatus.ACTIVE };
      cardRepository.findOne.mockResolvedValue(card as any);
      cardTransactionRepository.findOne.mockResolvedValue(null);
      cardAdapter.updateCard.mockRejectedValue(new Error('Provider error'));

      await expect(service.cancelCard(mockUser, 'card-123')).rejects.toThrow(BadRequestException);
      await expect(service.cancelCard(mockUser, 'card-123')).rejects.toThrow('Failed to cancel card: Provider error');
    });

    it('should use CANCELED status when canceling card', async () => {
      const card = { ...mockCard, status: ICardStatus.ACTIVE };
      cardRepository.findOne.mockResolvedValue(card as any);
      cardTransactionRepository.findOne.mockResolvedValue(null);
      cardAdapter.updateCard.mockResolvedValue({
        status: CardStatus.CANCELED,
      } as any);
      cardRepository.update.mockResolvedValue({} as any);

      await service.cancelCard(mockUser, 'card-123');

      expect(cardAdapter.updateCard).toHaveBeenCalledWith('provider-card-ref-123', { status: CardStatus.CANCELED });
      expect(cardRepository.update).toHaveBeenCalledWith(
        { id: 'card-123' },
        expect.objectContaining({
          status: ICardStatus.CANCELED,
        }),
      );
    });

    it('should set is_freezed to true when canceling card', async () => {
      const card = { ...mockCard, status: ICardStatus.ACTIVE, is_freezed: false };
      cardRepository.findOne.mockResolvedValue(card as any);
      cardTransactionRepository.findOne.mockResolvedValue(null);
      cardAdapter.updateCard.mockResolvedValue({
        status: CardStatus.CANCELED,
      } as any);
      cardRepository.update.mockResolvedValue({} as any);

      await service.cancelCard(mockUser, 'card-123');

      expect(cardRepository.update).toHaveBeenCalledWith(
        { id: 'card-123' },
        expect.objectContaining({
          is_freezed: true,
        }),
      );
    });

    it('should send notification and email when canceling card', async () => {
      const card = { ...mockCard, status: ICardStatus.ACTIVE };
      cardRepository.findOne.mockResolvedValue(card as any);
      cardTransactionRepository.findOne.mockResolvedValue(null);
      cardAdapter.updateCard.mockResolvedValue({ status: CardStatus.CANCELED } as any);
      cardRepository.update.mockResolvedValue({} as any);

      await service.cancelCard(mockUser, 'card-123');

      expect(inAppNotificationService.createNotification).toHaveBeenCalledWith({
        user_id: 'user-123',
        type: IN_APP_NOTIFICATION_TYPE.CARD_BLOCKED,
        title: 'Card Blocked',
        message:
          'Your card has been blocked and can no longer be used for transactions. Please contact support for assistance.',
        metadata: {
          cardId: 'card-123',
          status: ICardStatus.CANCELED,
        },
      });
      expect(mailerService.send).toHaveBeenCalledWith(expect.any(CardManagementMail));
    });

    it('should log correct messages when canceling card', async () => {
      const card = { ...mockCard, status: ICardStatus.ACTIVE };
      cardRepository.findOne.mockResolvedValue(card as any);
      cardTransactionRepository.findOne.mockResolvedValue(null);
      cardAdapter.updateCard.mockResolvedValue({
        status: CardStatus.CANCELED,
      } as any);
      cardRepository.update.mockResolvedValue({} as any);

      const loggerSpy = jest.spyOn(service['logger'], 'log');

      await service.cancelCard(mockUser, 'card-123');

      expect(loggerSpy).toHaveBeenCalledWith(
        expect.stringContaining('canceled successfully with provider (sent CANCELED status)'),
      );
      expect(loggerSpy).toHaveBeenCalledWith(expect.stringContaining('canceled successfully in database'));
    });
  });

  describe('reissueCard', () => {
    it('should re-issue card successfully by canceling old card and creating new one', async () => {
      const existingCard = { ...mockCard, status: ICardStatus.ACTIVE, balance: 5000 };
      const newCard = {
        ...mockCard,
        id: 'card-456',
        provider_ref: 'provider-card-ref-456',
        balance: 0,
      };

      cardRepository.findOne
        // verifyCardOwnership in reissueCard
        .mockResolvedValueOnce(existingCard as any)
        // verifyCardOwnership in cancelCard
        .mockResolvedValueOnce(existingCard as any)
        // oldCard in transferBalanceFromCanceledCard
        .mockResolvedValueOnce(existingCard as any)
        // newCard in transferBalanceFromCanceledCard
        .mockResolvedValueOnce(newCard as any);
      cardRepository.findNonCanceledCardByUserId.mockResolvedValueOnce(undefined);
      cardTransactionRepository.findOne
        // hasPendingTransactions in reissueCard
        .mockResolvedValueOnce(null)
        // hasPendingTransactions in cancelCard
        .mockResolvedValueOnce(null);
      cardAdapter.updateCard.mockResolvedValue({
        status: CardStatus.CANCELED,
      } as any);
      cardRepository.update.mockResolvedValue({} as any);
      cardRepository.transaction.mockImplementation(async (fn: any) => fn({}));
      cardUserRepository.findOne.mockResolvedValue(mockCardUser as any);
      cardTransactionRepository.create.mockResolvedValue({ id: 'txn-1' } as any);
      userProfileRepository.findByUserId.mockResolvedValue(mockUserProfile as any);
      cardAdapter.createCard.mockResolvedValue({
        cardId: 'provider-card-ref-456',
        status: CardStatus.ACTIVE,
        displayName: 'John Doe',
        lastFourDigits: '5678',
        expiryMonth: '12',
        expiryYear: '2027',
      } as any);
      cardRepository.create.mockResolvedValue(newCard as any);
      inAppNotificationService.createNotification.mockResolvedValue({} as any);
      mailerService.send.mockResolvedValue(undefined);
      userRepository.findActiveById.mockResolvedValue(mockUser as any);
      const sendCardNotificationSpy = jest.spyOn(service, 'sendCardNotification').mockResolvedValue(undefined);

      const reissueDto: ReissueCardDto = {
        type: CardType.VIRTUAL,
      };

      const result = await service.reissueCard(mockUser, 'card-123', reissueDto);

      expect(sendCardNotificationSpy).toHaveBeenCalledWith(
        { inApp: true, email: true, push: true },
        expect.objectContaining({
          userId: 'user-123',
          notificationType: CardNotificationType.CARD_REISSUED,
          metadata: expect.objectContaining({
            oldCardId: existingCard.id,
            newCardId: newCard.id,
          }),
          emailMail: expect.any(CardManagementMail),
        }),
      );
      expect(cardRepository.findOne).toHaveBeenCalledWith({ id: 'card-123', user_id: 'user-123' });
      expect(cardAdapter.updateCard).toHaveBeenCalledWith('provider-card-ref-123', { status: CardStatus.CANCELED });
      expect(cardAdapter.createCard).toHaveBeenCalled();
      expect(cardRepository.transaction).toHaveBeenCalled();
      expect(cardTransactionRepository.create).toHaveBeenCalledTimes(2);
      expect(result.oldCardId).toBe('card-123');
      expect(result.newCard.id).toBe('card-456');
    });

    it('should log error when issuance fee charge fails on reissue', async () => {
      const existingCard = { ...mockCard, status: ICardStatus.ACTIVE };
      const newCard = { ...mockCard, id: 'card-456', last_four_digits: '5678' };

      jest.spyOn(service as any, 'verifyCardOwnership').mockResolvedValue(existingCard);
      jest.spyOn(service as any, 'hasPendingTransactions').mockResolvedValue(false);
      jest
        .spyOn(service as any, 'cancelCard')
        .mockResolvedValue({ card_id: existingCard.id, status: CardStatus.CANCELED });
      jest.spyOn(service as any, 'createCard').mockResolvedValue(newCard);
      jest.spyOn(service as any, 'transferBalanceFromCanceledCard').mockResolvedValue({ id: 'txn-1' } as any);

      cardRepository.findOne.mockResolvedValue({ ...newCard, balance: 50 } as any);
      cardRepository.update.mockResolvedValue({} as any);
      cardUserRepository.findOne.mockResolvedValue(mockCardUser as any);
      jest.spyOn(service as any, 'chargeIssuanceFee').mockRejectedValue(new Error('Charge failed'));
      userRepository.findActiveById.mockResolvedValue(null);

      const loggerSpy = jest.spyOn(service['logger'], 'error');

      await service.reissueCard(mockUser, 'card-123', { type: CardType.VIRTUAL });

      expect(loggerSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to charge issuance fee for reissued card'),
        expect.any(Error),
      );
    });

    it('should skip issuance fee charge when transfer transaction is missing', async () => {
      const existingCard = { ...mockCard, status: ICardStatus.ACTIVE };
      const newCard = { ...mockCard, id: 'card-456', last_four_digits: '5678' };

      jest.spyOn(service as any, 'verifyCardOwnership').mockResolvedValue(existingCard);
      jest.spyOn(service as any, 'hasPendingTransactions').mockResolvedValue(false);
      jest
        .spyOn(service as any, 'cancelCard')
        .mockResolvedValue({ card_id: existingCard.id, status: CardStatus.CANCELED });
      jest.spyOn(service as any, 'createCard').mockResolvedValue(newCard);
      jest.spyOn(service as any, 'transferBalanceFromCanceledCard').mockResolvedValue(null);

      cardRepository.findOne.mockResolvedValue({ ...newCard, balance: 50 } as any);
      cardRepository.update.mockResolvedValue({} as any);
      cardUserRepository.findOne.mockResolvedValue(mockCardUser as any);
      const chargeSpy = jest.spyOn(service as any, 'chargeIssuanceFee').mockResolvedValue(undefined);
      userRepository.findActiveById.mockResolvedValue(null);

      await service.reissueCard(mockUser, 'card-123', { type: CardType.VIRTUAL });

      expect(chargeSpy).not.toHaveBeenCalled();
    });

    it('should log error when reissue notification fails', async () => {
      const existingCard = { ...mockCard, status: ICardStatus.ACTIVE };
      const newCard = { ...mockCard, id: 'card-456', last_four_digits: '5678' };

      jest.spyOn(service as any, 'verifyCardOwnership').mockResolvedValue(existingCard);
      jest.spyOn(service as any, 'hasPendingTransactions').mockResolvedValue(false);
      jest
        .spyOn(service as any, 'cancelCard')
        .mockResolvedValue({ card_id: existingCard.id, status: CardStatus.CANCELED });
      jest.spyOn(service as any, 'createCard').mockResolvedValue(newCard);
      jest.spyOn(service as any, 'transferBalanceFromCanceledCard').mockResolvedValue(null);

      userRepository.findActiveById.mockResolvedValue(mockUser as any);
      jest.spyOn(service, 'sendCardNotification').mockRejectedValue(new Error('Notify failed'));

      const loggerSpy = jest.spyOn(service['logger'], 'error');

      await service.reissueCard(mockUser, 'card-123', { type: CardType.PHYSICAL });

      expect(loggerSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to send card reissued notification/email'),
        expect.any(Error),
      );
    });

    it('should default to VIRTUAL card type when type is not specified', async () => {
      const existingCard = { ...mockCard, status: ICardStatus.ACTIVE };
      const newCard = {
        ...mockCard,
        id: 'card-456',
        provider_ref: 'provider-card-ref-456',
      };

      cardRepository.findOne.mockResolvedValueOnce(existingCard as any).mockResolvedValueOnce(existingCard as any);
      cardRepository.findNonCanceledCardByUserId.mockResolvedValueOnce(undefined);
      cardTransactionRepository.findOne
        // hasPendingTransactions in reissueCard
        .mockResolvedValueOnce(null)
        // hasPendingTransactions in cancelCard
        .mockResolvedValueOnce(null);
      cardAdapter.updateCard.mockResolvedValue({
        status: CardStatus.CANCELED,
      } as any);
      cardRepository.update.mockResolvedValue({} as any);
      cardUserRepository.findOne.mockResolvedValue(mockCardUser as any);
      userProfileRepository.findByUserId.mockResolvedValue(mockUserProfile as any);
      cardAdapter.createCard.mockResolvedValue({
        cardId: 'provider-card-ref-456',
        status: CardStatus.ACTIVE,
        displayName: 'John Doe',
        lastFourDigits: '5678',
        expiryMonth: '12',
        expiryYear: '2027',
      } as any);
      cardRepository.create.mockResolvedValue(newCard as any);
      inAppNotificationService.createNotification.mockResolvedValue({} as any);
      mailerService.send.mockResolvedValue(undefined);

      const reissueDto: ReissueCardDto = {};

      await service.reissueCard(mockUser, 'card-123', reissueDto);

      expect(cardAdapter.createCard).toHaveBeenCalledWith(
        expect.objectContaining({
          type: CardType.VIRTUAL,
        }),
      );
    });

    it('should throw NotFoundException when card does not exist', async () => {
      cardRepository.findOne.mockResolvedValue(null);

      const reissueDto: ReissueCardDto = {
        type: CardType.VIRTUAL,
      };

      await expect(service.reissueCard(mockUser, 'card-123', reissueDto)).rejects.toThrow(NotFoundException);
      await expect(service.reissueCard(mockUser, 'card-123', reissueDto)).rejects.toThrow(
        'Card not found or does not belong to user',
      );
      expect(cardAdapter.updateCard).not.toHaveBeenCalled();
      expect(cardAdapter.createCard).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException when card is canceled', async () => {
      const canceledCard = { ...mockCard, status: ICardStatus.CANCELED };
      cardRepository.findOne.mockResolvedValue(canceledCard as any);

      const reissueDto: ReissueCardDto = {
        type: CardType.VIRTUAL,
      };

      await expect(service.reissueCard(mockUser, 'card-123', reissueDto)).rejects.toThrow(BadRequestException);
      await expect(service.reissueCard(mockUser, 'card-123', reissueDto)).rejects.toThrow(
        'Cannot re-issue a canceled card',
      );
      expect(cardAdapter.updateCard).not.toHaveBeenCalled();
      expect(cardAdapter.createCard).not.toHaveBeenCalled();
    });

    it('should transfer balance from old card to new card when reissuing', async () => {
      const existingCard = { ...mockCard, status: ICardStatus.ACTIVE, balance: 10000 };
      const newCard = {
        ...mockCard,
        id: 'card-456',
        provider_ref: 'provider-card-ref-456',
        balance: 0,
      };

      cardRepository.findOne
        // verifyCardOwnership in reissueCard
        .mockResolvedValueOnce(existingCard as any)
        // verifyCardOwnership in cancelCard
        .mockResolvedValueOnce(existingCard as any)
        // oldCard in transferBalanceFromCanceledCard
        .mockResolvedValueOnce(existingCard as any)
        // newCard in transferBalanceFromCanceledCard
        .mockResolvedValueOnce(newCard as any);
      cardRepository.findNonCanceledCardByUserId.mockResolvedValueOnce(undefined);
      cardAdapter.updateCard.mockResolvedValue({
        status: CardStatus.CANCELED,
      } as any);
      cardRepository.update.mockResolvedValue({} as any);
      cardRepository.transaction.mockImplementation(async (fn: any) => fn({}));
      cardUserRepository.findOne.mockResolvedValue(mockCardUser as any);
      cardTransactionRepository.create.mockResolvedValue({ id: 'txn-1' } as any);
      userProfileRepository.findByUserId.mockResolvedValue(mockUserProfile as any);
      cardAdapter.createCard.mockResolvedValue({
        cardId: 'provider-card-ref-456',
        status: CardStatus.ACTIVE,
        displayName: 'John Doe',
        lastFourDigits: '5678',
        expiryMonth: '12',
        expiryYear: '2027',
      } as any);
      cardRepository.create.mockResolvedValue(newCard as any);
      inAppNotificationService.createNotification.mockResolvedValue({} as any);
      mailerService.send.mockResolvedValue(undefined);

      const reissueDto: ReissueCardDto = {
        type: CardType.VIRTUAL,
      };

      await service.reissueCard(mockUser, 'card-123', reissueDto);

      expect(cardRepository.transaction).toHaveBeenCalled();
      expect(cardTransactionRepository.create).toHaveBeenCalledTimes(2);
      expect(cardTransactionRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          merchant_name: 'Balance Transfer',
          amount: 10000,
          transaction_type: CardTransactionType.DEPOSIT,
          type: CardTransactionDrCr.CREDIT,
        }),
        expect.any(Object),
      );
      expect(cardTransactionRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          merchant_name: 'Balance Transfer',
          amount: 10000,
          transaction_type: CardTransactionType.TRANSFER,
          type: CardTransactionDrCr.DEBIT,
        }),
        expect.any(Object),
      );
    });

    it('should not transfer balance when old card has zero balance', async () => {
      const existingCard = { ...mockCard, status: ICardStatus.ACTIVE, balance: 0 };
      const newCard = {
        ...mockCard,
        id: 'card-456',
        provider_ref: 'provider-card-ref-456',
      };

      cardRepository.findOne
        .mockResolvedValueOnce(existingCard as any)
        .mockResolvedValueOnce(existingCard as any)
        .mockResolvedValueOnce(newCard as any);
      cardRepository.findNonCanceledCardByUserId.mockResolvedValueOnce(undefined);
      cardAdapter.updateCard.mockResolvedValue({
        status: CardStatus.CANCELED,
      } as any);
      cardRepository.update.mockResolvedValue({} as any);
      cardUserRepository.findOne.mockResolvedValue(mockCardUser as any);
      userProfileRepository.findByUserId.mockResolvedValue(mockUserProfile as any);
      cardAdapter.createCard.mockResolvedValue({
        cardId: 'provider-card-ref-456',
        status: CardStatus.ACTIVE,
        displayName: 'John Doe',
        lastFourDigits: '5678',
        expiryMonth: '12',
        expiryYear: '2027',
      } as any);
      cardRepository.create.mockResolvedValue(newCard as any);
      inAppNotificationService.createNotification.mockResolvedValue({} as any);
      mailerService.send.mockResolvedValue(undefined);

      const reissueDto: ReissueCardDto = {
        type: CardType.VIRTUAL,
      };

      await service.reissueCard(mockUser, 'card-123', reissueDto);

      expect(cardRepository.transaction).not.toHaveBeenCalled();
      expect(cardTransactionRepository.create).not.toHaveBeenCalled();
    });

    it('should transfer negative balance from old card to new card', async () => {
      const existingCard = { ...mockCard, status: ICardStatus.ACTIVE, balance: -5000 };
      const newCard = {
        ...mockCard,
        id: 'card-456',
        provider_ref: 'provider-card-ref-456',
        balance: 0,
      };

      cardRepository.findOne
        // verifyCardOwnership in reissueCard
        .mockResolvedValueOnce(existingCard as any)
        // verifyCardOwnership in cancelCard
        .mockResolvedValueOnce(existingCard as any)
        // oldCard in transferBalanceFromCanceledCard
        .mockResolvedValueOnce(existingCard as any)
        // newCard in transferBalanceFromCanceledCard
        .mockResolvedValueOnce(newCard as any);
      cardRepository.findNonCanceledCardByUserId.mockResolvedValueOnce(undefined);
      cardAdapter.updateCard.mockResolvedValue({
        status: CardStatus.CANCELED,
      } as any);
      cardRepository.update.mockResolvedValue({} as any);
      cardRepository.transaction.mockImplementation(async (fn: any) => fn({}));
      cardUserRepository.findOne.mockResolvedValue(mockCardUser as any);
      cardTransactionRepository.create.mockResolvedValue({ id: 'txn-1' } as any);
      userProfileRepository.findByUserId.mockResolvedValue(mockUserProfile as any);
      cardAdapter.createCard.mockResolvedValue({
        cardId: 'provider-card-ref-456',
        status: CardStatus.ACTIVE,
        displayName: 'John Doe',
        lastFourDigits: '5678',
        expiryMonth: '12',
        expiryYear: '2027',
      } as any);
      cardRepository.create.mockResolvedValue(newCard as any);
      inAppNotificationService.createNotification.mockResolvedValue({} as any);
      mailerService.send.mockResolvedValue(undefined);

      const reissueDto: ReissueCardDto = {
        type: CardType.VIRTUAL,
      };

      await service.reissueCard(mockUser, 'card-123', reissueDto);

      expect(cardRepository.transaction).toHaveBeenCalled();
      expect(cardTransactionRepository.create).toHaveBeenCalledTimes(2);
      expect(cardTransactionRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          amount: -5000,
        }),
        expect.any(Object),
      );
    });

    it('should handle balance transfer when old card not found', async () => {
      const existingCard = { ...mockCard, status: ICardStatus.ACTIVE, balance: 5000 };
      const newCard = {
        ...mockCard,
        id: 'card-456',
        provider_ref: 'provider-card-ref-456',
      };

      cardRepository.findOne
        // verifyCardOwnership in reissueCard
        .mockResolvedValueOnce(existingCard as any)
        // verifyCardOwnership in cancelCard
        .mockResolvedValueOnce(existingCard as any)
        // oldCard in transferBalanceFromCanceledCard (not found)
        .mockResolvedValueOnce(null)
        // newCard in transferBalanceFromCanceledCard (would not be called, but safe)
        .mockResolvedValueOnce(newCard as any);
      cardRepository.findNonCanceledCardByUserId.mockResolvedValueOnce(undefined);
      cardAdapter.updateCard.mockResolvedValue({
        status: CardStatus.CANCELED,
      } as any);
      cardRepository.update.mockResolvedValue({} as any);
      cardUserRepository.findOne.mockResolvedValue(mockCardUser as any);
      userProfileRepository.findByUserId.mockResolvedValue(mockUserProfile as any);
      cardAdapter.createCard.mockResolvedValue({
        cardId: 'provider-card-ref-456',
        status: CardStatus.ACTIVE,
        displayName: 'John Doe',
        lastFourDigits: '5678',
        expiryMonth: '12',
        expiryYear: '2027',
      } as any);
      cardRepository.create.mockResolvedValue(newCard as any);
      inAppNotificationService.createNotification.mockResolvedValue({} as any);
      mailerService.send.mockResolvedValue(undefined);

      const reissueDto: ReissueCardDto = {
        type: CardType.VIRTUAL,
      };

      await service.reissueCard(mockUser, 'card-123', reissueDto);

      expect(cardRepository.transaction).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException when card is not active', async () => {
      const inactiveCard = { ...mockCard, status: ICardStatus.INACTIVE };
      cardRepository.findOne.mockResolvedValue(inactiveCard as any);

      const reissueDto: ReissueCardDto = {
        type: CardType.VIRTUAL,
      };

      await expect(service.reissueCard(mockUser, 'card-123', reissueDto)).rejects.toThrow(BadRequestException);
      await expect(service.reissueCard(mockUser, 'card-123', reissueDto)).rejects.toThrow(
        'Card must be active to re-issue',
      );
      expect(cardAdapter.updateCard).not.toHaveBeenCalled();
      expect(cardAdapter.createCard).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException when card has pending transactions', async () => {
      const activeCard = { ...mockCard, status: ICardStatus.ACTIVE };
      const pendingTransaction = {
        id: 'txn-123',
        card_id: 'card-123',
        status: CardTransactionStatus.PENDING,
      };
      cardRepository.findOne.mockResolvedValue(activeCard as any);
      cardTransactionRepository.findOne.mockResolvedValue(pendingTransaction as any);

      const reissueDto: ReissueCardDto = {
        type: CardType.VIRTUAL,
      };

      await expect(service.reissueCard(mockUser, 'card-123', reissueDto)).rejects.toThrow(BadRequestException);
      await expect(service.reissueCard(mockUser, 'card-123', reissueDto)).rejects.toThrow(
        'Cannot re-issue card with pending transactions',
      );
      expect(cardAdapter.updateCard).not.toHaveBeenCalled();
      expect(cardAdapter.createCard).not.toHaveBeenCalled();
    });

    it('should handle physical card re-issue with shipping address', async () => {
      const existingCard = { ...mockCard, status: ICardStatus.ACTIVE };
      const newCard = {
        ...mockCard,
        id: 'card-456',
        provider_ref: 'provider-card-ref-456',
      };

      cardRepository.findOne.mockResolvedValueOnce(existingCard as any).mockResolvedValueOnce(existingCard as any);
      cardRepository.findNonCanceledCardByUserId.mockResolvedValueOnce(undefined);
      cardTransactionRepository.findOne
        // hasPendingTransactions in reissueCard
        .mockResolvedValueOnce(null)
        // hasPendingTransactions in cancelCard
        .mockResolvedValueOnce(null);
      cardAdapter.updateCard.mockResolvedValue({
        status: CardStatus.CANCELED,
      } as any);
      cardRepository.update.mockResolvedValue({} as any);
      cardUserRepository.findOne.mockResolvedValue(mockCardUser as any);
      userProfileRepository.findByUserId.mockResolvedValue(mockUserProfile as any);
      cardAdapter.createCard.mockResolvedValue({
        cardId: 'provider-card-ref-456',
        status: CardStatus.ACTIVE,
        displayName: 'John Doe',
        lastFourDigits: '5678',
        expiryMonth: '12',
        expiryYear: '2027',
      } as any);
      cardRepository.create.mockResolvedValue(newCard as any);
      inAppNotificationService.createNotification.mockResolvedValue({} as any);
      mailerService.send.mockResolvedValue(undefined);

      const reissueDto: ReissueCardDto = {
        type: CardType.PHYSICAL,
        shipping_line1: '456 Oak Ave',
        shipping_city: 'Los Angeles',
        shipping_region: 'CA',
        shipping_postal_code: '90001',
        shipping_country_code: 'US',
      };

      await service.reissueCard(mockUser, 'card-123', reissueDto);

      expect(cardAdapter.createCard).toHaveBeenCalledWith(
        expect.objectContaining({
          type: CardType.PHYSICAL,
          shipping: expect.objectContaining({
            line1: '456 Oak Ave',
            city: 'Los Angeles',
            region: 'CA',
            postalCode: '90001',
            countryCode: 'US',
          }),
        }),
      );
    });
  });

  describe('transferBalanceFromCanceledCard', () => {
    it('should return null when new card is not found', async () => {
      const oldCard = { ...mockCard, id: 'old-card', balance: 100 } as any;

      cardRepository.findOne.mockResolvedValueOnce(oldCard).mockResolvedValueOnce(null);

      const loggerSpy = jest.spyOn(service['logger'], 'warn');

      const result = await (service as any).transferBalanceFromCanceledCard(mockUser, 'new-card', 'old-card');

      expect(result).toBeNull();
      expect(loggerSpy).toHaveBeenCalledWith(expect.stringContaining('New card new-card not found'));
    });

    it('should return null when card user is not found', async () => {
      const oldCard = { ...mockCard, id: 'old-card', balance: 100 } as any;
      const newCard = { ...mockCard, id: 'new-card', balance: 0 } as any;

      cardRepository.findOne.mockResolvedValueOnce(oldCard).mockResolvedValueOnce(newCard);
      cardUserRepository.findOne.mockResolvedValue(null);

      const loggerSpy = jest.spyOn(service['logger'], 'warn');

      const result = await (service as any).transferBalanceFromCanceledCard(mockUser, 'new-card', 'old-card');

      expect(result).toBeNull();
      expect(loggerSpy).toHaveBeenCalledWith(expect.stringContaining('Card user not found'));
    });

    it('should return null when transfer balance fails', async () => {
      const oldCard = { ...mockCard, id: 'old-card', balance: 100 } as any;
      const newCard = { ...mockCard, id: 'new-card', balance: 0 } as any;

      cardRepository.findOne.mockResolvedValueOnce(oldCard).mockResolvedValueOnce(newCard);
      cardUserRepository.findOne.mockResolvedValue(mockCardUser as any);
      cardRepository.transaction.mockImplementation(() => {
        throw new Error('DB failure');
      });

      const loggerSpy = jest.spyOn(service['logger'], 'error');

      const result = await (service as any).transferBalanceFromCanceledCard(mockUser, 'new-card', 'old-card');

      expect(result).toBeNull();
      expect(loggerSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to transfer balance from canceled card'),
        expect.any(Error),
      );
    });
  });

  describe('updateCardLimit - edge cases', () => {
    it('should use default frequency when card has no limit_frequency', async () => {
      const cardNoFrequency = { ...mockCard, limit_frequency: null };
      cardRepository.findOne.mockResolvedValueOnce(cardNoFrequency as any).mockResolvedValueOnce({
        ...mockCard,
        limit: 2000,
        limit_frequency: CardLimitFrequency.PER_30_DAY_PERIOD,
      } as any);
      cardAdapter.updateCard.mockResolvedValue({
        limitAmount: 2000,
        limitFrequency: CardLimitFrequency.PER_30_DAY_PERIOD,
      } as any);
      cardRepository.update.mockResolvedValue({} as any);

      const updateDto: UpdateCardLimitDto = {
        amount: 2000,
      };

      const result = await service.updateCardLimit(mockUser, 'card-123', updateDto);

      expect(result.limit).toBe(2000);
      expect(cardAdapter.updateCard).toHaveBeenCalledWith(
        'provider-card-ref-123',
        expect.objectContaining({
          limit: expect.objectContaining({
            frequency: CardLimitFrequency.PER_30_DAY_PERIOD,
          }),
        }),
      );
    });

    it('should use default limit when card has no limit', async () => {
      const cardNoLimit = { ...mockCard, limit: null };
      cardRepository.findOne.mockResolvedValueOnce(cardNoLimit as any).mockResolvedValueOnce({
        ...mockCard,
        limit: 0,
        limit_frequency: CardLimitFrequency.PER_7_DAY_PERIOD,
      } as any);
      cardAdapter.updateCard.mockResolvedValue({
        limitAmount: 0,
        limitFrequency: CardLimitFrequency.PER_7_DAY_PERIOD,
      } as any);
      cardRepository.update.mockResolvedValue({} as any);

      const updateDto: UpdateCardLimitDto = {
        frequency: CardLimitFrequency.PER_7_DAY_PERIOD,
      };

      const result = await service.updateCardLimit(mockUser, 'card-123', updateDto);

      expect(result.limit_frequency).toBe(CardLimitFrequency.PER_7_DAY_PERIOD);
      expect(cardAdapter.updateCard).toHaveBeenCalledWith(
        'provider-card-ref-123',
        expect.objectContaining({
          limit: expect.objectContaining({
            amount: 0,
          }),
        }),
      );
    });
  });

  describe('checkAndChargeIssuanceFeeOnFirstFunding', () => {
    const mockCardUser = {
      id: 'card-user-123',
      user_id: 'user-123',
      provider_ref: 'provider-ref-123',
      balance: 10000,
    } as any;

    const mockFundingTransaction = {
      id: 'txn-123',
      user_id: 'user-123',
      card_user_id: 'card-user-123',
      card_id: 'card-123',
      amount: 10000,
      provider_reference: 'provider-ref-123',
    } as any;

    it('should return early if cardId is not provided', async () => {
      await service.checkAndChargeIssuanceFeeOnFirstFunding('', mockCardUser, mockFundingTransaction);

      expect(cardRepository.findOne).not.toHaveBeenCalled();
      expect(cardTransactionRepository.findPreviousSuccessfulDeposits).not.toHaveBeenCalled();
    });

    it('should return early if card not found', async () => {
      cardRepository.findOne.mockResolvedValue(null as any);

      await service.checkAndChargeIssuanceFeeOnFirstFunding('card-123', mockCardUser, mockFundingTransaction);

      expect(cardRepository.findOne).toHaveBeenCalledWith({ id: 'card-123' });
      expect(cardTransactionRepository.findPreviousSuccessfulDeposits).not.toHaveBeenCalled();
    });

    it('should return early if issuance_fee_status is not pending', async () => {
      const card = {
        id: 'card-123',
        issuance_fee_status: IIssuanceFeeStatus.COMPLETED,
      } as any;
      cardRepository.findOne.mockResolvedValue(card);

      await service.checkAndChargeIssuanceFeeOnFirstFunding('card-123', mockCardUser, mockFundingTransaction);

      expect(cardTransactionRepository.findPreviousSuccessfulDeposits).not.toHaveBeenCalled();
    });

    it('should return early if there are previous successful deposits', async () => {
      const card = {
        id: 'card-123',
        issuance_fee_status: IIssuanceFeeStatus.PENDING,
      } as any;
      cardRepository.findOne.mockResolvedValue(card);
      cardTransactionRepository.findPreviousSuccessfulDeposits.mockResolvedValue([{ id: 'prev-txn' }] as any);

      await service.checkAndChargeIssuanceFeeOnFirstFunding('card-123', mockCardUser, mockFundingTransaction);

      expect(cardTransactionRepository.findPreviousSuccessfulDeposits).toHaveBeenCalledWith('card-123', 'txn-123');
      expect(lockerService.withLock).not.toHaveBeenCalled();
    });

    it('should charge issuance fee if this is first successful deposit', async () => {
      const card = {
        id: 'card-123',
        issuance_fee_status: IIssuanceFeeStatus.PENDING,
        balance: 10000,
      } as any;
      cardRepository.findOne.mockResolvedValue(card);
      cardTransactionRepository.findPreviousSuccessfulDeposits.mockResolvedValue([]);

      const chargeIssuanceFeeSpy = jest.spyOn(service, 'chargeIssuanceFee').mockResolvedValue();

      await service.checkAndChargeIssuanceFeeOnFirstFunding('card-123', mockCardUser, mockFundingTransaction);

      expect(cardTransactionRepository.findPreviousSuccessfulDeposits).toHaveBeenCalledWith('card-123', 'txn-123');
      expect(chargeIssuanceFeeSpy).toHaveBeenCalledWith(card, mockCardUser, mockFundingTransaction);

      chargeIssuanceFeeSpy.mockRestore();
    });
  });

  describe('chargeIssuanceFee', () => {
    const mockCard = {
      id: 'card-123',
      user_id: 'user-123',
      card_user_id: 'card-user-123',
      balance: 10000,
      issuance_fee_status: IIssuanceFeeStatus.PENDING,
    } as any;

    const mockCardUser = {
      id: 'card-user-123',
      user_id: 'user-123',
      provider_ref: 'provider-ref-123',
      balance: 10000,
    } as any;

    const mockFundingTransaction = {
      id: 'txn-123',
      user_id: 'user-123',
      card_user_id: 'card-user-123',
      card_id: 'card-123',
      amount: 10000,
      provider_reference: 'provider-ref-123',
    } as any;

    beforeEach(() => {
      jest.spyOn(CardFeesService, 'calculateFee').mockReturnValue({
        fee: 1,
        feeType: 'fixed' as any,
        feeFixed: 1,
      });
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
      jest.restoreAllMocks();
    });

    it('should return early if fee is 0', async () => {
      jest.spyOn(CardFeesService, 'calculateFee').mockReturnValue({
        fee: 0,
        feeType: 'none' as any,
      });

      await service.chargeIssuanceFee(mockCard, mockCardUser, mockFundingTransaction);

      expect(lockerService.withLock).not.toHaveBeenCalled();
    });

    it('should skip if issuance_fee_status is not pending within lock', async () => {
      const lockedCard = {
        ...mockCard,
        issuance_fee_status: IIssuanceFeeStatus.COMPLETED,
      };
      cardRepository.findOne.mockResolvedValue(lockedCard);
      lockerService.withLock.mockImplementation(async (key, callback) => callback());

      await service.chargeIssuanceFee(mockCard, mockCardUser, mockFundingTransaction);

      expect(cardRepository.findOne).toHaveBeenCalledWith({ id: 'card-123' });
      expect(cardTransactionRepository.transaction).not.toHaveBeenCalled();
    });

    it('should successfully charge issuance fee', async () => {
      const lockedCard = { ...mockCard, balance: 10000 };
      const lockedCardUser = { ...mockCardUser, balance: 10000 };
      const mockUser = { id: 'user-123', email: 'test@example.com' } as any;

      cardRepository.findOne.mockResolvedValue(lockedCard);
      cardUserRepository.findOne.mockResolvedValue(lockedCardUser);
      userRepository.findActiveById.mockResolvedValue(mockUser);
      userProfileRepository.findByUserId.mockResolvedValue(mockUserProfile as any);
      cardAdapter.createCharge.mockResolvedValue({ providerRef: 'charge-ref-123' } as any);
      cardTransactionRepository.transaction.mockImplementation(async (fn: any) => fn({}));
      cardTransactionRepository.create.mockResolvedValue({ id: 'fee-card-txn-123' } as any);
      transactionRepository.create.mockResolvedValue({ id: 'fee-main-txn-123' } as any);
      cardRepository.update.mockResolvedValue(lockedCard as any);
      cardUserRepository.update.mockResolvedValue(lockedCardUser);
      lockerService.withLock.mockImplementation(async (key, callback) => callback());
      pushNotificationService.sendPushNotification.mockResolvedValue(undefined);

      await service.chargeIssuanceFee(mockCard, mockCardUser, mockFundingTransaction);

      expect(cardAdapter.createCharge).toHaveBeenCalledWith('provider-ref-123', 100, 'Virtual card issuance fee');
      expect(cardTransactionRepository.create).toHaveBeenCalled();
      expect(transactionRepository.create).toHaveBeenCalled();
      expect(cardRepository.update).toHaveBeenCalledWith(
        { id: 'card-123' },
        expect.objectContaining({
          balance: 9900,
          issuance_fee_status: IIssuanceFeeStatus.COMPLETED,
        }),
        expect.any(Object),
      );
      expect(cardUserRepository.update).toHaveBeenCalledWith(
        { id: 'card-user-123' },
        expect.objectContaining({ balance: 9900 }),
        expect.any(Object),
      );
      expect(inAppNotificationService.createNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          type: IN_APP_NOTIFICATION_TYPE.CARD_DEBITED,
          title: 'Card Issuance Fee',
        }),
      );
      expect(pushNotificationService.sendPushNotification).toHaveBeenCalledWith(
        [mockUserProfile.notification_token],
        expect.objectContaining({
          title: 'Card Issuance Fee',
          body: expect.stringContaining('issuance fee'),
        }),
      );
    });

    it('should handle negative balance after fee charge', async () => {
      const lockedCard = { ...mockCard, balance: 50 };
      const lockedCardUser = { ...mockCardUser, balance: 50 };
      const mockUser = { id: 'user-123', email: 'test@example.com' } as any;

      cardRepository.findOne.mockResolvedValue(lockedCard);
      cardUserRepository.findOne.mockResolvedValue(lockedCardUser);
      userRepository.findActiveById.mockResolvedValue(mockUser);
      cardAdapter.createCharge.mockResolvedValue({ providerRef: 'charge-ref-123' } as any);
      cardTransactionRepository.transaction.mockImplementation(async (fn: any) => fn({}));
      cardTransactionRepository.create.mockResolvedValue({ id: 'fee-card-txn-123' } as any);
      transactionRepository.create.mockResolvedValue({ id: 'fee-main-txn-123' } as any);
      cardRepository.update.mockResolvedValue(lockedCard as any);
      cardUserRepository.update.mockResolvedValue(lockedCardUser);
      lockerService.withLock.mockImplementation(async (key, callback) => callback());

      await service.chargeIssuanceFee(mockCard, mockCardUser, mockFundingTransaction);

      expect(cardRepository.update).toHaveBeenCalledWith(
        { id: 'card-123' },
        expect.objectContaining({
          balance: -50,
          issuance_fee_status: IIssuanceFeeStatus.COMPLETED,
        }),
        expect.any(Object),
      );
    });

    it('should retry on failure and succeed on second attempt', async () => {
      const lockedCard = { ...mockCard, balance: 10000 };
      const lockedCardUser = { ...mockCardUser, balance: 10000 };
      const mockUser = { id: 'user-123', email: 'test@example.com' } as any;

      cardRepository.findOne.mockResolvedValue(lockedCard);
      cardUserRepository.findOne.mockResolvedValue(lockedCardUser);
      userRepository.findActiveById.mockResolvedValue(mockUser);
      cardTransactionRepository.transaction.mockImplementation(async (fn: any) => fn({}));
      cardTransactionRepository.create.mockResolvedValue({ id: 'fee-card-txn-123' } as any);
      transactionRepository.create.mockResolvedValue({ id: 'fee-main-txn-123' } as any);
      cardRepository.update.mockResolvedValue(lockedCard);
      cardUserRepository.update.mockResolvedValue(lockedCardUser);
      lockerService.withLock.mockImplementation(async (key, callback) => callback());

      cardAdapter.createCharge
        .mockRejectedValueOnce(new Error('API Error'))
        .mockResolvedValueOnce({ providerRef: 'charge-ref-123' } as any);

      const promise = service.chargeIssuanceFee(mockCard, mockCardUser, mockFundingTransaction);
      await jest.runAllTimersAsync();
      await promise;

      expect(cardAdapter.createCharge).toHaveBeenCalledTimes(2);
      expect(cardRepository.update).toHaveBeenCalled();
    });

    it('should mark as failed after all retries fail', async () => {
      const lockedCard = { ...mockCard, balance: 10000 };
      const lockedCardUser = { ...mockCardUser, balance: 10000 };
      cardRepository.findOne.mockResolvedValue(lockedCard);
      cardUserRepository.findOne.mockResolvedValue(lockedCardUser);
      cardAdapter.createCharge.mockRejectedValue(new Error('API Error'));
      cardTransactionRepository.transaction.mockImplementation(async (fn: any) => {
        const mockTrx = {} as any;
        // The callback will call createCharge which throws, so we let it throw
        return await fn(mockTrx);
      });
      lockerService.withLock.mockImplementation(async (key, callback) => {
        try {
          return await callback();
        } catch (error) {
          // Allow retry loop to continue
          throw error;
        }
      });

      const promise = service.chargeIssuanceFee(mockCard, mockCardUser, mockFundingTransaction);
      await jest.runAllTimersAsync();
      await promise;

      expect(cardAdapter.createCharge).toHaveBeenCalledTimes(3);
      expect(cardRepository.update).toHaveBeenCalledWith(
        { id: 'card-123' },
        expect.objectContaining({
          issuance_fee_status: IIssuanceFeeStatus.FAILED,
        }),
      );
    });

    it('should handle notification error gracefully', async () => {
      const lockedCard = { ...mockCard, balance: 10000 };
      const lockedCardUser = { ...mockCardUser, balance: 10000 };

      cardRepository.findOne.mockResolvedValue(lockedCard);
      cardUserRepository.findOne.mockResolvedValue(lockedCardUser);
      userRepository.findActiveById.mockRejectedValue(new Error('User not found'));
      cardAdapter.createCharge.mockResolvedValue({ providerRef: 'charge-ref-123' } as any);
      cardTransactionRepository.transaction.mockImplementation(async (fn: any) => fn({}));
      cardTransactionRepository.create.mockResolvedValue({ id: 'fee-card-txn-123' } as any);
      transactionRepository.create.mockResolvedValue({ id: 'fee-main-txn-123' } as any);
      cardRepository.update.mockResolvedValue(lockedCard);
      cardUserRepository.update.mockResolvedValue(lockedCardUser);
      lockerService.withLock.mockImplementation(async (key, callback) => callback());

      await service.chargeIssuanceFee(mockCard, mockCardUser, mockFundingTransaction);

      expect(cardRepository.update).toHaveBeenCalled();
      expect(cardUserRepository.update).toHaveBeenCalled();
    });

    it('should mark as failed if card user not found during transaction', async () => {
      const lockedCard = { ...mockCard, balance: 10000 };
      cardRepository.findOne.mockResolvedValue(lockedCard);
      cardUserRepository.findOne.mockResolvedValue(null as any);
      cardTransactionRepository.transaction.mockImplementation(async (fn: any) => {
        const mockTrx = {} as any;
        // The callback will throw NotFoundException when cardUser is null
        return await fn(mockTrx);
      });
      lockerService.withLock.mockImplementation(async (key, callback) => {
        try {
          return await callback();
        } catch (error) {
          // Re-throw to allow retry logic to catch it
          throw error;
        }
      });

      const promise = service.chargeIssuanceFee(mockCard, mockCardUser, mockFundingTransaction);
      await jest.runAllTimersAsync();
      await promise;

      // NotFoundException will be caught by retry logic and status marked as FAILED
      expect(cardRepository.update).toHaveBeenCalledWith(
        { id: 'card-123' },
        expect.objectContaining({
          issuance_fee_status: IIssuanceFeeStatus.FAILED,
        }),
      );
    });
  });

  describe('createDispute', () => {
    const transactionId = 'txn-123';
    const mockCardTransaction = {
      id: transactionId,
      user_id: 'user-123',
      card_user_id: 'card-user-123',
      card_id: 'card-123',
      provider_reference: 'provider-txn-ref-123',
      amount: 5000,
      currency: 'USD',
      status: CardTransactionStatus.SUCCESSFUL,
      transaction_type: CardTransactionType.SPEND,
      type: CardTransactionDrCr.DEBIT,
      merchant_name: 'Test Merchant',
    };

    const mockDisputeDto = {
      textEvidence: 'This transaction was unauthorized',
    };

    const mockDisputeResponse = {
      id: 'dispute-123',
      transactionId: 'provider-txn-ref-123',
      status: 'pending',
      createdAt: '2024-01-01T00:00:00Z',
      textEvidence: 'This transaction was unauthorized',
    };

    const mockChargeResponse = {
      providerRef: 'charge-ref-123',
      createdAt: '2024-01-01T00:00:00Z',
      amount: 3000,
      description: 'Dispute/chargeback fee',
    };

    beforeEach(() => {
      jest.clearAllMocks();
      cardTransactionDisputeRepository.findOne.mockResolvedValue(null as any);
    });

    it('should create dispute successfully', async () => {
      const cardWithBalance = { ...mockCard, balance: 5000 };
      cardTransactionRepository.findOne.mockResolvedValue(mockCardTransaction as any);
      cardRepository.findOne.mockResolvedValue(cardWithBalance as any);
      cardUserRepository.findOne.mockResolvedValue(mockCardUser as any);

      const lockedCard = { ...cardWithBalance, balance: 5000 };
      const lockedCardUser = { ...mockCardUser };
      const lockedCardTransaction = { ...mockCardTransaction };

      cardRepository.findOne.mockResolvedValueOnce(cardWithBalance as any);
      cardRepository.findOne.mockResolvedValueOnce(lockedCard as any);
      cardUserRepository.findOne.mockResolvedValueOnce(mockCardUser as any);
      cardUserRepository.findOne.mockResolvedValueOnce(lockedCardUser as any);
      cardTransactionRepository.findOne.mockResolvedValueOnce(mockCardTransaction as any);
      cardTransactionRepository.findOne.mockResolvedValueOnce(lockedCardTransaction as any);

      cardAdapter.createCharge.mockResolvedValue(mockChargeResponse as any);
      cardAdapter.createDispute.mockResolvedValue(mockDisputeResponse as any);
      cardTransactionRepository.create.mockResolvedValue({ id: 'fee-card-txn-123' } as any);
      transactionRepository.create.mockResolvedValue({ id: 'fee-main-txn-123' } as any);
      cardRepository.update.mockResolvedValue(lockedCard);
      cardTransactionDisputeRepository.create.mockResolvedValue({
        id: 'dispute-123',
        transaction_id: transactionId,
        provider_dispute_ref: 'dispute-123',
        transaction_ref: 'provider-txn-ref-123',
        status: 'pending',
        text_evidence: 'This transaction was unauthorized',
      } as any);

      cardTransactionRepository.transaction.mockImplementation(async (fn: any) => fn({}));
      lockerService.withLock.mockImplementation(async (key, callback) => callback());

      const result = await service.createDispute(mockUser, transactionId, mockDisputeDto);

      expect(cardTransactionRepository.findOne).toHaveBeenCalledWith({ id: transactionId, user_id: mockUser.id });
      expect(cardRepository.findOne).toHaveBeenCalledWith({
        id: 'card-123',
        user_id: mockUser.id,
      });
      expect(cardAdapter.createCharge).toHaveBeenCalledWith('provider-ref-123', 3000, 'Dispute/chargeback fee');
      expect(cardAdapter.createDispute).toHaveBeenCalledWith(
        'provider-txn-ref-123',
        'This transaction was unauthorized',
      );
      expect(cardTransactionDisputeRepository.create).toHaveBeenCalled();
      expect(cardTransactionDisputeEventRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          dispute_id: 'dispute-123',
          previous_status: undefined,
          new_status: 'pending',
          event_type: 'created',
          triggered_by: 'user',
          user_id: mockUser.id,
        }),
        expect.anything(),
      );
      expect(result).toBeDefined();
    });

    it('should throw NotFoundException when transaction not found', async () => {
      cardTransactionRepository.findOne.mockResolvedValue(null);

      await expect(service.createDispute(mockUser, transactionId, mockDisputeDto)).rejects.toThrow(NotFoundException);
      expect(cardTransactionRepository.findOne).toHaveBeenCalledWith({ id: transactionId, user_id: mockUser.id });
    });

    it('should throw BadRequestException when transaction has no provider reference', async () => {
      const transactionWithoutProviderRef = {
        ...mockCardTransaction,
        provider_reference: null,
      };
      cardTransactionRepository.findOne.mockResolvedValue(transactionWithoutProviderRef as any);

      await expect(service.createDispute(mockUser, transactionId, mockDisputeDto)).rejects.toThrow(BadRequestException);
      expect(cardTransactionRepository.findOne).toHaveBeenCalledWith({ id: transactionId, user_id: mockUser.id });
    });

    it('should throw BadRequestException when transaction has no card ID', async () => {
      const transactionWithoutCardId = {
        ...mockCardTransaction,
        card_id: null,
      };
      cardTransactionRepository.findOne.mockResolvedValue(transactionWithoutCardId as any);

      await expect(service.createDispute(mockUser, transactionId, mockDisputeDto)).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when transaction type is not spend', async () => {
      const ineligibleTransaction = {
        ...mockCardTransaction,
        transaction_type: CardTransactionType.DEPOSIT,
      };

      cardTransactionRepository.findOne.mockResolvedValue(ineligibleTransaction as any);

      await expect(service.createDispute(mockUser, transactionId, mockDisputeDto)).rejects.toThrow(BadRequestException);
      expect(cardRepository.findOne).not.toHaveBeenCalled();
      expect(cardAdapter.createCharge).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException when transaction status is not successful', async () => {
      const ineligibleTransaction = {
        ...mockCardTransaction,
        status: CardTransactionStatus.PENDING,
      };

      cardTransactionRepository.findOne.mockResolvedValue(ineligibleTransaction as any);

      await expect(service.createDispute(mockUser, transactionId, mockDisputeDto)).rejects.toThrow(BadRequestException);
      expect(cardRepository.findOne).not.toHaveBeenCalled();
      expect(cardAdapter.createCharge).not.toHaveBeenCalled();
    });

    it('should return existing dispute when there is an active dispute', async () => {
      const activeDispute = {
        id: 'dispute-123',
        transaction_id: transactionId,
        status: CardTransactionDisputeStatus.PENDING,
      };

      cardTransactionRepository.findOne.mockResolvedValue(mockCardTransaction as any);
      cardTransactionDisputeRepository.findOne.mockResolvedValue(activeDispute as any);

      const result = await service.createDispute(mockUser, transactionId, mockDisputeDto);

      expect(cardRepository.findOne).not.toHaveBeenCalled();
      expect(cardAdapter.createCharge).not.toHaveBeenCalled();
      expect(result).toEqual(activeDispute);
    });

    it('should throw BadRequestException when dispute already exists with resolved status', async () => {
      const resolvedDispute = {
        id: 'dispute-accepted-1',
        transaction_id: transactionId,
        status: CardTransactionDisputeStatus.ACCEPTED,
      };

      cardTransactionRepository.findOne.mockResolvedValue(mockCardTransaction as any);
      cardTransactionDisputeRepository.findOne.mockResolvedValue(resolvedDispute as any);

      await expect(service.createDispute(mockUser, transactionId, mockDisputeDto)).rejects.toThrow(BadRequestException);
      expect(cardRepository.findOne).not.toHaveBeenCalled();
      expect(cardAdapter.createCharge).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException when card not found', async () => {
      cardTransactionRepository.findOne.mockResolvedValue(mockCardTransaction as any);
      cardRepository.findOne.mockResolvedValue(null);

      await expect(service.createDispute(mockUser, transactionId, mockDisputeDto)).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException when insufficient balance', async () => {
      const cardWithLowBalance = { ...mockCard, balance: 1000 };
      cardTransactionRepository.findOne.mockResolvedValue(mockCardTransaction as any);
      cardRepository.findOne.mockResolvedValue(cardWithLowBalance as any);
      cardUserRepository.findOne.mockResolvedValue(mockCardUser as any);

      await expect(service.createDispute(mockUser, transactionId, mockDisputeDto)).rejects.toThrow(BadRequestException);
      expect(cardAdapter.createCharge).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException when balance check fails inside transaction', async () => {
      const cardWithBalance = { ...mockCard, balance: 5000 };
      const lockedCardWithLowBalance = { ...mockCard, balance: 1000 };

      cardTransactionRepository.findOne.mockResolvedValue(mockCardTransaction as any);
      cardRepository.findOne.mockResolvedValueOnce(cardWithBalance as any);
      cardUserRepository.findOne.mockResolvedValue(mockCardUser as any);

      const lockedCardUser = { ...mockCardUser };
      const lockedCardTransaction = { ...mockCardTransaction };

      cardUserRepository.findOne.mockResolvedValueOnce(mockCardUser as any);
      cardUserRepository.findOne.mockResolvedValueOnce(lockedCardUser as any);
      cardTransactionRepository.findOne.mockResolvedValueOnce(mockCardTransaction as any);
      cardTransactionRepository.findOne.mockResolvedValueOnce(lockedCardTransaction as any);
      cardRepository.findOne.mockResolvedValueOnce(cardWithBalance as any);
      cardRepository.findOne.mockResolvedValueOnce(lockedCardWithLowBalance as any);

      cardTransactionRepository.transaction.mockImplementation(async (fn: any) => fn({}));
      lockerService.withLock.mockImplementation(async (key, callback) => callback());

      await expect(service.createDispute(mockUser, transactionId, mockDisputeDto)).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when charge API fails', async () => {
      const cardWithBalance = { ...mockCard, balance: 5000 };
      cardTransactionRepository.findOne.mockResolvedValue(mockCardTransaction as any);
      cardRepository.findOne.mockResolvedValue(cardWithBalance as any);
      cardUserRepository.findOne.mockResolvedValue(mockCardUser as any);

      const lockedCard = { ...cardWithBalance };
      const lockedCardUser = { ...mockCardUser };
      const lockedCardTransaction = { ...mockCardTransaction };

      cardRepository.findOne.mockResolvedValueOnce(cardWithBalance as any);
      cardRepository.findOne.mockResolvedValueOnce(lockedCard as any);
      cardUserRepository.findOne.mockResolvedValueOnce(mockCardUser as any);
      cardUserRepository.findOne.mockResolvedValueOnce(lockedCardUser as any);
      cardTransactionRepository.findOne.mockResolvedValueOnce(mockCardTransaction as any);
      cardTransactionRepository.findOne.mockResolvedValueOnce(lockedCardTransaction as any);

      cardAdapter.createDispute.mockResolvedValue(mockDisputeResponse as any);
      cardAdapter.createCharge.mockRejectedValue(new Error('Charge API failed'));
      cardTransactionRepository.transaction.mockImplementation(async (fn: any) => fn({}));
      lockerService.withLock.mockImplementation(async (key, callback) => callback());

      await expect(service.createDispute(mockUser, transactionId, mockDisputeDto)).rejects.toThrow(BadRequestException);
      expect(cardAdapter.createDispute).toHaveBeenCalledTimes(1);
      expect(cardAdapter.createCharge).toHaveBeenCalledTimes(1);
    });

    it('should throw BadRequestException when dispute API fails', async () => {
      const cardWithBalance = { ...mockCard, balance: 5000 };
      cardTransactionRepository.findOne.mockResolvedValue(mockCardTransaction as any);
      cardRepository.findOne.mockResolvedValue(cardWithBalance);
      cardUserRepository.findOne.mockResolvedValue(mockCardUser);

      const lockedCard = { ...cardWithBalance };
      const lockedCardUser = { ...mockCardUser };
      const lockedCardTransaction = { ...mockCardTransaction };

      cardRepository.findOne.mockResolvedValueOnce(cardWithBalance);
      cardRepository.findOne.mockResolvedValueOnce(lockedCard);
      cardUserRepository.findOne.mockResolvedValueOnce(mockCardUser);
      cardUserRepository.findOne.mockResolvedValueOnce(lockedCardUser);
      cardTransactionRepository.findOne.mockResolvedValueOnce(mockCardTransaction as any);
      cardTransactionRepository.findOne.mockResolvedValueOnce(lockedCardTransaction as any);

      cardAdapter.createCharge.mockResolvedValue(mockChargeResponse as any);
      cardAdapter.createDispute.mockRejectedValue(new Error('Dispute API failed'));
      cardTransactionRepository.transaction.mockImplementation(async (fn: any) => fn({}));
      lockerService.withLock.mockImplementation(async (key, callback) => callback());

      await expect(service.createDispute(mockUser, transactionId, mockDisputeDto)).rejects.toThrow(BadRequestException);
    });

    it('should create dispute without textEvidence', async () => {
      const cardWithBalance = { ...mockCard, balance: 5000 };
      const disputeDtoWithoutEvidence = {};

      cardTransactionRepository.findOne.mockResolvedValue(mockCardTransaction as any);
      cardRepository.findOne.mockResolvedValue(cardWithBalance);
      cardUserRepository.findOne.mockResolvedValue(mockCardUser);

      const lockedCard = { ...cardWithBalance };
      const lockedCardUser = { ...mockCardUser };
      const lockedCardTransaction = { ...mockCardTransaction };

      cardRepository.findOne.mockResolvedValueOnce(cardWithBalance);
      cardRepository.findOne.mockResolvedValueOnce(lockedCard);
      cardUserRepository.findOne.mockResolvedValueOnce(mockCardUser);
      cardUserRepository.findOne.mockResolvedValueOnce(lockedCardUser);
      cardTransactionRepository.findOne.mockResolvedValueOnce(mockCardTransaction as any);
      cardTransactionRepository.findOne.mockResolvedValueOnce(lockedCardTransaction as any);

      const disputeResponseWithoutEvidence = {
        ...mockDisputeResponse,
        textEvidence: undefined,
      };

      cardAdapter.createCharge.mockResolvedValue(mockChargeResponse as any);
      cardAdapter.createDispute.mockResolvedValue(disputeResponseWithoutEvidence as any);
      cardTransactionRepository.create.mockResolvedValue({ id: 'fee-card-txn-123' } as any);
      transactionRepository.create.mockResolvedValue({ id: 'fee-main-txn-123' } as any);
      cardRepository.update.mockResolvedValue(lockedCard);
      cardTransactionDisputeRepository.create.mockResolvedValue({
        id: 'dispute-123',
      } as any);

      cardTransactionRepository.transaction.mockImplementation(async (fn: any) => fn({}));
      lockerService.withLock.mockImplementation(async (key, callback) => callback());

      await service.createDispute(mockUser, transactionId, disputeDtoWithoutEvidence);

      expect(cardAdapter.createDispute).toHaveBeenCalledWith('provider-txn-ref-123', undefined);
    });

    it('should throw NotFoundException when card user not found during transaction', async () => {
      const cardWithBalance = { ...mockCard, balance: 5000 };
      cardTransactionRepository.findOne.mockResolvedValue(mockCardTransaction as any);
      cardRepository.findOne.mockResolvedValue(cardWithBalance);
      cardUserRepository.findOne.mockResolvedValue(mockCardUser);

      cardUserRepository.findOne.mockResolvedValueOnce(mockCardUser);
      cardUserRepository.findOne.mockResolvedValueOnce(null);
      cardTransactionRepository.findOne.mockResolvedValueOnce(mockCardTransaction as any);
      cardTransactionRepository.findOne.mockResolvedValueOnce(mockCardTransaction as any);
      cardRepository.findOne.mockResolvedValueOnce(cardWithBalance);
      cardRepository.findOne.mockResolvedValueOnce(cardWithBalance);

      cardTransactionRepository.transaction.mockImplementation(async (fn: any) => fn({}));
      lockerService.withLock.mockImplementation(async (key, callback) => callback());

      await expect(service.createDispute(mockUser, transactionId, mockDisputeDto)).rejects.toThrow(NotFoundException);
    });
  });

  describe('getTransactionDisputeEligibility', () => {
    const transactionId = 'txn-123';
    const mockEligibleTransaction = {
      id: transactionId,
      user_id: 'user-123',
      card_id: 'card-123',
      transaction_type: CardTransactionType.SPEND,
      status: CardTransactionStatus.SUCCESSFUL,
      merchant_name: 'Test Merchant',
      merchant_category: 'Retail',
      description: 'Purchase',
      merchant_category_code: '5411',
      created_at: new Date(),
    };

    beforeEach(() => {
      jest.clearAllMocks();
      cardTransactionDisputeRepository.findOne.mockResolvedValue(null);
      cardTransactionDisputeEventRepository.findSync.mockResolvedValue([]);
    });

    it('should return eligible when all conditions are met', async () => {
      const recentDate = new Date();
      recentDate.setDate(recentDate.getDate() - 30);
      const eligibleTransaction = {
        ...mockEligibleTransaction,
        created_at: recentDate,
      };

      cardTransactionRepository.findOne.mockResolvedValue(eligibleTransaction as any);

      const result = await service.getTransactionDisputeEligibility(mockUser, transactionId);

      expect(result).toEqual({
        transaction_id: transactionId,
        canDispute: true,
        reasons: [],
        events: [],
        isAlreadyDisputed: false,
      });
    });

    it('should return not eligible when transaction is not a card transaction', async () => {
      const nonCardTransaction = {
        ...mockEligibleTransaction,
        card_id: null,
      };

      cardTransactionRepository.findOne.mockResolvedValue(nonCardTransaction as any);

      const result = await service.getTransactionDisputeEligibility(mockUser, transactionId);

      expect(result.canDispute).toBe(false);
      expect(result.reasons).toContain('Transaction is not a card transaction');
    });

    it('should return not eligible when transaction type is not spend', async () => {
      const depositTransaction = {
        ...mockEligibleTransaction,
        transaction_type: CardTransactionType.DEPOSIT,
      };

      cardTransactionRepository.findOne.mockResolvedValue(depositTransaction as any);

      const result = await service.getTransactionDisputeEligibility(mockUser, transactionId);

      expect(result.canDispute).toBe(false);
      expect(result.reasons).toContain('Only purchase transactions are eligible for dispute');
    });

    it('should return not eligible when transaction is ATM transaction by merchant name', async () => {
      const atmTransaction = {
        ...mockEligibleTransaction,
        merchant_name: 'ATM Withdrawal',
      };

      cardTransactionRepository.findOne.mockResolvedValue(atmTransaction as any);

      const result = await service.getTransactionDisputeEligibility(mockUser, transactionId);

      expect(result.canDispute).toBe(false);
      expect(result.reasons).toContain('ATM transactions are not eligible for dispute');
    });

    it('should return not eligible when transaction is ATM transaction by merchant category', async () => {
      const atmTransaction = {
        ...mockEligibleTransaction,
        merchant_category: 'ATM Services',
      };

      cardTransactionRepository.findOne.mockResolvedValue(atmTransaction as any);

      const result = await service.getTransactionDisputeEligibility(mockUser, transactionId);

      expect(result.canDispute).toBe(false);
      expect(result.reasons).toContain('ATM transactions are not eligible for dispute');
    });

    it('should return not eligible when transaction is ATM transaction by description', async () => {
      const atmTransaction = {
        ...mockEligibleTransaction,
        description: 'ATM cash withdrawal',
      };

      cardTransactionRepository.findOne.mockResolvedValue(atmTransaction as any);

      const result = await service.getTransactionDisputeEligibility(mockUser, transactionId);

      expect(result.canDispute).toBe(false);
      expect(result.reasons).toContain('ATM transactions are not eligible for dispute');
    });

    it('should return not eligible when transaction is ATM transaction by category code', async () => {
      const atmTransaction = {
        ...mockEligibleTransaction,
        merchant_category_code: '6010',
      };

      cardTransactionRepository.findOne.mockResolvedValue(atmTransaction as any);

      const result = await service.getTransactionDisputeEligibility(mockUser, transactionId);

      expect(result.canDispute).toBe(false);
      expect(result.reasons).toContain('ATM transactions are not eligible for dispute');
    });

    it('should return not eligible when transaction status is not successful', async () => {
      const pendingTransaction = {
        ...mockEligibleTransaction,
        status: CardTransactionStatus.PENDING,
      };

      cardTransactionRepository.findOne.mockResolvedValue(pendingTransaction as any);

      const result = await service.getTransactionDisputeEligibility(mockUser, transactionId);

      expect(result.canDispute).toBe(false);
      expect(result.reasons).toContain('Only posted/settled transactions are eligible for dispute');
    });

    it('should return not eligible when transaction is outside 60-day window', async () => {
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 70);
      const oldTransaction = {
        ...mockEligibleTransaction,
        created_at: oldDate,
      };

      cardTransactionRepository.findOne.mockResolvedValue(oldTransaction as any);

      const result = await service.getTransactionDisputeEligibility(mockUser, transactionId);

      expect(result.canDispute).toBe(false);
      expect(result.reasons).toContain('Transaction is outside the 60-day dispute window');
    });

    it('should allow eligibility when created_at is an invalid date string', async () => {
      const eligibleTransaction = {
        ...mockEligibleTransaction,
        created_at: 'invalid-date',
      };

      cardTransactionRepository.findOne.mockResolvedValue(eligibleTransaction as any);

      const result = await service.getTransactionDisputeEligibility(mockUser, transactionId);

      expect(result.canDispute).toBe(true);
      expect(result.reasons).not.toContain('Transaction is outside the 60-day dispute window');
    });

    it('should return not eligible when transaction has open dispute', async () => {
      const openDispute = {
        id: 'dispute-123',
        transaction_id: transactionId,
        status: CardTransactionDisputeStatus.PENDING,
      };

      cardTransactionRepository.findOne.mockResolvedValue(mockEligibleTransaction as any);
      cardTransactionDisputeRepository.findOne.mockResolvedValue(openDispute as any);

      const result = await service.getTransactionDisputeEligibility(mockUser, transactionId);

      expect(result.canDispute).toBe(false);
      expect(result.reasons).toContain('Transaction already has an open dispute');
    });

    it('should return not eligible when transaction has resolved chargeback', async () => {
      const resolvedDispute = {
        id: 'dispute-123',
        transaction_id: transactionId,
        status: CardTransactionDisputeStatus.ACCEPTED,
      };

      cardTransactionRepository.findOne.mockResolvedValue(mockEligibleTransaction as any);
      cardTransactionDisputeRepository.findOne.mockResolvedValue(resolvedDispute as any);

      const result = await service.getTransactionDisputeEligibility(mockUser, transactionId);

      expect(result.canDispute).toBe(false);
      expect(result.reasons).toContain('Transaction already has a resolved chargeback');
    });

    it('should return not eligible when transaction is refund or reversal', async () => {
      const refundTransaction = {
        ...mockEligibleTransaction,
        transaction_type: CardTransactionType.REFUND,
      };

      cardTransactionRepository.findOne.mockResolvedValue(refundTransaction as any);

      const result = await service.getTransactionDisputeEligibility(mockUser, transactionId);

      expect(result.canDispute).toBe(false);
      expect(result.reasons).toContain('Refunded or reversed transactions are not eligible for dispute');
    });

    it('should return not eligible when transaction is reversal', async () => {
      const reversalTransaction = {
        ...mockEligibleTransaction,
        transaction_type: CardTransactionType.REVERSAL,
      };

      cardTransactionRepository.findOne.mockResolvedValue(reversalTransaction as any);

      const result = await service.getTransactionDisputeEligibility(mockUser, transactionId);

      expect(result.canDispute).toBe(false);
      expect(result.reasons).toContain('Refunded or reversed transactions are not eligible for dispute');
    });

    it('should return eligible with existing dispute info when dispute exists but is not active', async () => {
      const rejectedDispute = {
        id: 'dispute-123',
        transaction_id: transactionId,
        status: CardTransactionDisputeStatus.REJECTED,
      };

      const mockEvents = [
        {
          id: 'event-1',
          dispute_id: 'dispute-123',
          event_type: 'created',
          new_status: 'pending',
        },
        {
          id: 'event-2',
          dispute_id: 'dispute-123',
          event_type: 'status_changed',
          previous_status: 'pending',
          new_status: 'rejected',
        },
      ];

      const recentDate = new Date();
      recentDate.setDate(recentDate.getDate() - 30);
      const eligibleTransaction = {
        ...mockEligibleTransaction,
        created_at: recentDate,
      };

      cardTransactionRepository.findOne.mockResolvedValue(eligibleTransaction as any);
      cardTransactionDisputeRepository.findOne.mockResolvedValue(rejectedDispute as any);
      cardTransactionDisputeEventRepository.findSync.mockResolvedValue(mockEvents as any);

      const result = await service.getTransactionDisputeEligibility(mockUser, transactionId);

      expect(result).toEqual({
        transaction_id: transactionId,
        canDispute: true,
        reasons: [],
        events: mockEvents,
        isAlreadyDisputed: true,
        disputeStatus: CardTransactionDisputeStatus.REJECTED,
      });
      expect(cardTransactionDisputeEventRepository.findSync).toHaveBeenCalledWith({
        dispute_id: 'dispute-123',
      });
    });

    it('should return empty events array when no dispute exists', async () => {
      const recentDate = new Date();
      recentDate.setDate(recentDate.getDate() - 30);
      const eligibleTransaction = {
        ...mockEligibleTransaction,
        created_at: recentDate,
      };

      cardTransactionRepository.findOne.mockResolvedValue(eligibleTransaction as any);
      cardTransactionDisputeRepository.findOne.mockResolvedValue(null);

      const result = await service.getTransactionDisputeEligibility(mockUser, transactionId);

      expect(result.events).toEqual([]);
      expect(cardTransactionDisputeEventRepository.findSync).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException when transaction not found', async () => {
      cardTransactionRepository.findOne.mockResolvedValue(null);

      await expect(service.getTransactionDisputeEligibility(mockUser, transactionId)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should handle multiple ineligibility reasons', async () => {
      const ineligibleTransaction = {
        ...mockEligibleTransaction,
        card_id: null,
        transaction_type: CardTransactionType.DEPOSIT,
        status: CardTransactionStatus.PENDING,
      };

      cardTransactionRepository.findOne.mockResolvedValue(ineligibleTransaction as any);

      const result = await service.getTransactionDisputeEligibility(mockUser, transactionId);

      expect(result.canDispute).toBe(false);
      expect(result.reasons.length).toBeGreaterThan(1);
    });
  });

  describe('sendCardNotification', () => {
    it('should send push notification when userProfile has notification_token', async () => {
      userProfileRepository.findByUserId.mockResolvedValue(mockUserProfile as any);
      pushNotificationService.sendPushNotification.mockResolvedValue(undefined);
      inAppNotificationService.createNotification.mockResolvedValue({} as any);

      await service.sendCardNotification(
        { inApp: true, push: true },
        {
          userId: 'user-123',
          notificationType: CardNotificationType.CARD_CREATED,
          metadata: { cardId: 'card-123' },
        },
      );

      expect(userProfileRepository.findByUserId).toHaveBeenCalledWith('user-123');
      expect(pushNotificationService.sendPushNotification).toHaveBeenCalledWith(
        [mockUserProfile.notification_token],
        expect.objectContaining({
          title: expect.stringContaining('Card Created'),
          body: expect.stringContaining('card is ready'),
        }),
      );
    });

    it('should not send push notification when userProfile is null', async () => {
      userProfileRepository.findByUserId.mockResolvedValue(null);
      inAppNotificationService.createNotification.mockResolvedValue({} as any);

      await service.sendCardNotification(
        { inApp: true, push: true },
        {
          userId: 'user-123',
          notificationType: CardNotificationType.CARD_CREATED,
          metadata: { cardId: 'card-123' },
        },
      );

      expect(userProfileRepository.findByUserId).toHaveBeenCalledWith('user-123');
      expect(pushNotificationService.sendPushNotification).not.toHaveBeenCalled();
    });

    it('should not send push notification when userProfile has no notification_token', async () => {
      const userProfileWithoutToken = { ...mockUserProfile, notification_token: null };
      userProfileRepository.findByUserId.mockResolvedValue(userProfileWithoutToken as any);
      inAppNotificationService.createNotification.mockResolvedValue({} as any);

      await service.sendCardNotification(
        { inApp: true, push: true },
        {
          userId: 'user-123',
          notificationType: CardNotificationType.CARD_CREATED,
          metadata: { cardId: 'card-123' },
        },
      );

      expect(userProfileRepository.findByUserId).toHaveBeenCalledWith('user-123');
      expect(pushNotificationService.sendPushNotification).not.toHaveBeenCalled();
    });

    it('should handle push notification error gracefully', async () => {
      userProfileRepository.findByUserId.mockResolvedValue(mockUserProfile as any);
      pushNotificationService.sendPushNotification.mockRejectedValue(new Error('Push notification failed'));
      inAppNotificationService.createNotification.mockResolvedValue({} as any);

      await service.sendCardNotification(
        { inApp: true, push: true },
        {
          userId: 'user-123',
          notificationType: CardNotificationType.CARD_CREATED,
          metadata: { cardId: 'card-123' },
        },
      );

      expect(pushNotificationService.sendPushNotification).toHaveBeenCalled();
    });

    it('should return early when notification type is unknown', async () => {
      await service.sendCardNotification(
        { inApp: true },
        {
          userId: 'user-123',
          notificationType: 'unknown_type' as CardNotificationType,
          metadata: {},
        },
      );

      expect(inAppNotificationService.createNotification).not.toHaveBeenCalled();
      expect(mailerService.send).not.toHaveBeenCalled();
      expect(pushNotificationService.sendPushNotification).not.toHaveBeenCalled();
    });

    it('should emit balance change event when provided', async () => {
      const eventEmitterService = testingModule.get(EventEmitterService) as jest.Mocked<EventEmitterService>;
      userProfileRepository.findByUserId.mockResolvedValue(mockUserProfile as any);
      pushNotificationService.sendPushNotification.mockResolvedValue(undefined);
      inAppNotificationService.createNotification.mockResolvedValue({} as any);

      await service.sendCardNotification(
        { inApp: true, push: true },
        {
          userId: 'user-123',
          notificationType: CardNotificationType.CARD_FUNDED,
          metadata: { cardId: 'card-123', amount: 100 },
          balanceChangeEvent: {
            walletType: 'card',
            walletId: 'card-123',
            currency: 'USD',
            balance: '1000',
            previousBalance: '900',
            transactionId: 'txn-123',
            wallet: mockCard,
          },
        },
      );

      expect(eventEmitterService.emit).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          userId: 'user-123',
          walletType: 'card',
          walletId: 'card-123',
          currency: 'USD',
          balance: '1000',
          previousBalance: '900',
          transactionId: 'txn-123',
          timestamp: expect.any(Date),
        }),
      );
    });

    it('should handle error in sendCardNotification gracefully', async () => {
      inAppNotificationService.createNotification.mockRejectedValue(new Error('Notification failed'));

      await service.sendCardNotification(
        { inApp: true },
        {
          userId: 'user-123',
          notificationType: CardNotificationType.CARD_CREATED,
          metadata: { cardId: 'card-123' },
        },
      );

      expect(inAppNotificationService.createNotification).toHaveBeenCalled();
    });
  });

  describe('sendCardStatusUpdateNotification', () => {
    it('should return early when status is unknown', async () => {
      const card = { ...mockCard, status: 'UNKNOWN_STATUS' as any };
      userRepository.findActiveById.mockResolvedValue(mockUser as any);

      await (service as any).sendCardStatusUpdateNotification('user-123', card, 'UNKNOWN_STATUS' as any);

      expect(inAppNotificationService.createNotification).not.toHaveBeenCalled();
      expect(mailerService.send).not.toHaveBeenCalled();
    });

    it('should return early when user is not found', async () => {
      const card = { ...mockCard, status: ICardStatus.INACTIVE };
      userRepository.findActiveById.mockResolvedValue(null);

      await (service as any).sendCardStatusUpdateNotification('user-123', card, ICardStatus.INACTIVE);

      expect(inAppNotificationService.createNotification).not.toHaveBeenCalled();
      expect(mailerService.send).not.toHaveBeenCalled();
    });

    it.each([
      [ICardStatus.INACTIVE, CardNotificationType.CARD_FROZEN, 'freeze'],
      [ICardStatus.ACTIVE, CardNotificationType.CARD_UNFROZEN, 'unfreeze'],
      [ICardStatus.BLOCKED, CardNotificationType.CARD_BLOCKED, 'blocked'],
      [ICardStatus.CANCELED, CardNotificationType.CARD_BLOCKED, 'blocked'],
    ])('should send status update notification for %s', async (status, notificationType, action) => {
      const card = { ...mockCard, status };
      userRepository.findActiveById.mockResolvedValue(mockUser as any);
      const sendCardNotificationSpy = jest.spyOn(service as any, 'sendCardNotification').mockResolvedValue(undefined);

      await (service as any).sendCardStatusUpdateNotification('user-123', card, status);

      expect(sendCardNotificationSpy).toHaveBeenCalledWith(
        { inApp: true, email: true, push: true },
        expect.objectContaining({
          userId: 'user-123',
          notificationType,
          metadata: {
            cardId: card.id,
            status,
          },
          emailMail: expect.any(CardManagementMail),
        }),
      );

      const callArgs = sendCardNotificationSpy.mock.calls[0] as any;
      const emailMail = callArgs[1].emailMail as CardManagementMail;
      expect(emailMail.action).toBe(action);
    });
  });

  describe('getNotificationContent - edge cases', () => {
    it('should handle CARD_BLOCKED with default message when reason is not insufficient_funds', async () => {
      const result = (service as any).getNotificationContent(CardNotificationType.CARD_BLOCKED, {
        cardId: 'card-123',
      });

      expect(result).toEqual({
        inAppNotificationType: IN_APP_NOTIFICATION_TYPE.CARD_BLOCKED,
        title: 'Card Blocked',
        message:
          'Your card has been blocked and can no longer be used for transactions. Please contact support for assistance.',
      });
    });

    it('should handle CARD_BLOCKED with insufficient_funds reason', async () => {
      const result = (service as any).getNotificationContent(CardNotificationType.CARD_BLOCKED, {
        cardId: 'card-123',
        reason: 'insufficient_funds_consecutive_declines',
        declineCount: 5,
      });

      expect(result).toEqual({
        inAppNotificationType: IN_APP_NOTIFICATION_TYPE.CARD_BLOCKED,
        title: 'Card Blocked',
        message:
          'Your card has been blocked due to 5 consecutive declined transactions for insufficient funds. Please fund your card to continue using it.',
      });
    });

    it('should handle CARD_DEBITED with missing merchantName', async () => {
      const result = (service as any).getNotificationContent(CardNotificationType.CARD_DEBITED, {
        amount: 100,
        newBalance: 500,
      });

      expect(result).toEqual({
        inAppNotificationType: IN_APP_NOTIFICATION_TYPE.CARD_DEBITED,
        title: 'Payment Successful',
        message: '$100.00 paid at Merchant. Balance: $500.00',
      });
    });

    it('should handle INSUFFICIENT_FUNDS_FEE with warning message when declineCount is at threshold', async () => {
      const result = (service as any).getNotificationContent(CardNotificationType.INSUFFICIENT_FUNDS_FEE, {
        feeAmount: 1.0,
        declineCount: MAX_INSUFFICIENT_FUNDS_DECLINES - 1,
      });

      expect(result.message).toContain('Warning: One more decline will result in your card being blocked.');
    });

    it('should handle INSUFFICIENT_FUNDS_FEE without warning when declineCount is below threshold', async () => {
      const result = (service as any).getNotificationContent(CardNotificationType.INSUFFICIENT_FUNDS_FEE, {
        feeAmount: 1.0,
        declineCount: 1,
      });

      expect(result.message).not.toContain('Warning: One more decline will result in your card being blocked.');
    });

    it('should handle DISPUTE_UPDATED with a known status message', async () => {
      const result = (service as any).getNotificationContent(CardNotificationType.DISPUTE_UPDATED, {
        status: 'pending',
      });

      expect(result).toEqual({
        inAppNotificationType: IN_APP_NOTIFICATION_TYPE.DISPUTE_UPDATED,
        title: 'Dispute Status Updated',
        message: 'Your dispute is being reviewed.',
      });
    });

    it('should handle DISPUTE_UPDATED with a fallback status message', async () => {
      const result = (service as any).getNotificationContent(CardNotificationType.DISPUTE_UPDATED, {
        status: 'unknown',
      });

      expect(result).toEqual({
        inAppNotificationType: IN_APP_NOTIFICATION_TYPE.DISPUTE_UPDATED,
        title: 'Dispute Status Updated',
        message: 'Your dispute status has been updated.',
      });
    });

    it('should handle CARD_REISSUED for virtual cards', async () => {
      const result = (service as any).getNotificationContent(CardNotificationType.CARD_REISSUED, {
        cardType: CardType.VIRTUAL,
      });

      expect(result).toEqual({
        inAppNotificationType: IN_APP_NOTIFICATION_TYPE.CARD_CREATED,
        title: 'Card Reissued Successfully',
        message:
          'Your OneDosh virtual card has been successfully reissued. Your balance has been transferred to the new card.',
      });
    });

    it('should handle CARD_REISSUED for physical cards', async () => {
      const result = (service as any).getNotificationContent(CardNotificationType.CARD_REISSUED, {
        cardType: CardType.PHYSICAL,
      });

      expect(result).toEqual({
        inAppNotificationType: IN_APP_NOTIFICATION_TYPE.CARD_CREATED,
        title: 'Card Reissued Successfully',
        message:
          'Your OneDosh physical card has been successfully reissued. Your balance has been transferred to the new card.',
      });
    });
  });

  describe('calculateCardFundingFee', () => {
    it('should calculate card funding fee in USD and log details', async () => {
      const loggerSpy = jest.spyOn(service['logger'], 'log');
      jest.spyOn(service as any, 'getCardTransactionFee').mockResolvedValue({
        fee: 25,
        feeType: 'test',
      });

      const result = await (service as any).calculateCardFundingFee(100);

      expect(result).toBe(0.25);
      expect(loggerSpy).toHaveBeenCalledWith(
        expect.stringContaining('[NGN_CARD_FUNDING] Calculating card funding fee'),
      );
      expect(loggerSpy).toHaveBeenCalledWith(expect.stringContaining('[NGN_CARD_FUNDING] Card funding fee calculated'));
    });
  });

  describe('initializeCardFundingFromNGN', () => {
    const mockInitDto = {
      amount: 160000,
      rate_id: 'rate-123',
    };

    const mockExchangeInitResult = {
      sourceTransactionId: 'txn-ref-123',
      amountToReceiveUSD: 100,
      feeLocal: 500,
      feeUSD: 0.31,
      totalAmountToPayLocal: 160500,
      rateInMainUnit: 1600,
      expirationTime: '2025-01-22T12:00:00Z',
      minimumLocalAmount: 10000,
      maximumLocalAmount: 1000000,
    };

    const mockDepositAddress = {
      id: 'addr-123',
      user_id: 'user-123',
      address: '0xRainDepositAddress123',
      chain_id: 1,
    };

    let ngToUsdExchangeService: jest.Mocked<NgToUsdExchangeService>;
    let ngToUsdExchangeEscrowService: jest.Mocked<NgToUsdExchangeEscrowService>;

    beforeEach(() => {
      ngToUsdExchangeService = testingModule.get(NgToUsdExchangeService);
      ngToUsdExchangeEscrowService = testingModule.get(NgToUsdExchangeEscrowService);

      cardUserRepository.findOne.mockResolvedValue(mockCardUser);
      cardRepository.findOne.mockResolvedValue(mockCard);
      lockerService.withLock.mockImplementation((_, callback) => callback());
      ngToUsdExchangeService.initializeNgToUSDExchange.mockResolvedValue(mockExchangeInitResult as any);
      ngToUsdExchangeEscrowService.storeCardFundingContext.mockResolvedValue(undefined);

      // Mock private methods
      jest.spyOn(service as any, 'validateCardAndCardUserForFunding').mockResolvedValue({
        card: mockCard,
        cardUser: mockCardUser,
      });
      jest.spyOn(service as any, 'getDefaultChainId').mockReturnValue(1);
      jest.spyOn(service as any, 'getRainDepositAddressForCardFunding').mockResolvedValue(mockDepositAddress);
      jest.spyOn(service as any, 'getCurrencyAndNetworkFromConfig').mockReturnValue({
        currency: 'USDC',
        network: 'ETH',
      });
      jest.spyOn(service as any, 'validateMinimumFundingAmount').mockResolvedValue(undefined);
      jest.spyOn(service as any, 'calculateCardFundingFee').mockResolvedValue(2.5);
    });

    it('should initialize card funding from NGN successfully', async () => {
      const loggerSpy = jest.spyOn(service['logger'], 'log');
      const result = await service.initializeCardFundingFromNGN(mockUser, mockCard.id, mockInitDto);

      expect(result).toBeDefined();
      expect(result.transaction_id).toBe('txn-ref-123');
      expect(result.card_id).toBe(mockCard.id);
      expect(result.ngn_amount).toBe(mockInitDto.amount);
      expect(result.usd_amount_after_exchange).toBe(100);

      // Verify logging statements are called
      expect(loggerSpy).toHaveBeenCalledWith(
        expect.stringContaining('[NGN_CARD_FUNDING] Step 1 - Initialize: Input NGN amount'),
      );
      expect(loggerSpy).toHaveBeenCalledWith(
        expect.stringContaining('[NGN_CARD_FUNDING] Step 1 - Exchange init'),
        expect.anything(),
      );
      expect(loggerSpy).toHaveBeenCalledWith(
        expect.stringContaining('[NGN_CARD_FUNDING] Step 1 - Initialize: Exchange initialized'),
      );
      expect(loggerSpy).toHaveBeenCalledWith(
        expect.stringContaining('[NGN_CARD_FUNDING] Step 1 - Initialize: Exchange fee (NGN)'),
      );
      expect(loggerSpy).toHaveBeenCalledWith(
        expect.stringContaining('[NGN_CARD_FUNDING] Step 1 - Initialize: Exchange fee (USD)'),
      );
      expect(loggerSpy).toHaveBeenCalledWith(
        expect.stringContaining('[NGN_CARD_FUNDING] Step 1 - Initialize: Total NGN to be debited'),
      );
      expect(loggerSpy).toHaveBeenCalledWith(
        expect.stringContaining('[NGN_CARD_FUNDING] Step 1 - Initialize: Net USD user will receive (raw)'),
      );
      expect(loggerSpy).toHaveBeenCalledWith(
        expect.stringContaining('[NGN_CARD_FUNDING] Step 1 - Initialize: Net USD user will receive (after floor)'),
      );
      expect(loggerSpy).toHaveBeenCalledWith(
        expect.stringContaining('[NGN_CARD_FUNDING] Step 1 - Initialize: Current card balance'),
      );
      expect(loggerSpy).toHaveBeenCalledWith(
        expect.stringContaining('[NGN_CARD_FUNDING] Step 1 - Initialize: Card balance after funding'),
      );
    });

    it('should call initializeNgToUSDExchange with correct parameters', async () => {
      await service.initializeCardFundingFromNGN(mockUser, mockCard.id, mockInitDto);

      expect(ngToUsdExchangeService.initializeNgToUSDExchange).toHaveBeenCalledWith(
        mockUser.id,
        expect.objectContaining({
          from: 'NGN',
          to: 'USD',
          amount: mockInitDto.amount,
          rate_id: mockInitDto.rate_id,
        }),
        expect.objectContaining({
          destinationWalletAddress: expect.objectContaining({
            address: mockDepositAddress.address,
          }),
        }),
      );
    });

    it('should store card funding context in escrow service', async () => {
      await service.initializeCardFundingFromNGN(mockUser, mockCard.id, mockInitDto);

      expect(ngToUsdExchangeEscrowService.storeCardFundingContext).toHaveBeenCalledWith(
        'txn-ref-123',
        expect.objectContaining({
          cardId: mockCard.id,
          cardUserId: mockCardUser.id,
          userId: mockUser.id,
          depositAddress: mockDepositAddress.address,
          usdAmountAfterExchange: 100,
          cardFeeUSD: 2.5,
        }),
      );
    });

    it('should use lock to prevent concurrent operations', async () => {
      await service.initializeCardFundingFromNGN(mockUser, mockCard.id, mockInitDto);

      expect(lockerService.withLock).toHaveBeenCalledWith(
        expect.stringContaining('card_funding_init_ngn'),
        expect.any(Function),
        expect.objectContaining({ ttl: 30000 }),
      );
    });

    it('should throw error when chain info not configured', async () => {
      jest.spyOn(service as any, 'getDefaultChainId').mockReturnValue(999);

      // Mock getChainInfoFromId to return null for unknown chain
      const getChainInfoFromIdSpy = jest.spyOn(RainWebhookInterface, 'getChainInfoFromId').mockReturnValue(null);

      await expect(service.initializeCardFundingFromNGN(mockUser, mockCard.id, mockInitDto)).rejects.toThrow(
        BadRequestException,
      );

      getChainInfoFromIdSpy.mockRestore();
    });

    it('should calculate net USD user will receive correctly', async () => {
      const result = await service.initializeCardFundingFromNGN(mockUser, mockCard.id, mockInitDto);

      // usdAmountAfterExchange (100) - cardFeeUSD (2.5) = 97.5
      // After floor conversion: 97.5 * 100 = 9750 cents, floor = 9750 cents = 97.5 USD
      expect(result.net_usd_you_will_receive).toBe(97.5);
    });

    it('should return card balance after funding', async () => {
      // Set card balance to 50 USD (5000 cents)
      const cardWithBalance = { ...mockCard, balance: 5000 };
      cardRepository.findOne.mockResolvedValue(cardWithBalance);
      jest.spyOn(service as any, 'validateCardAndCardUserForFunding').mockResolvedValue({
        card: cardWithBalance,
        cardUser: mockCardUser,
      });

      const result = await service.initializeCardFundingFromNGN(mockUser, mockCard.id, mockInitDto);

      // Current balance: 50 USD (5000 cents)
      // Net amount to receive: 97.5 USD (9750 cents)
      // Balance after funding: 50 + 97.5 = 147.5 USD
      expect(result.card_balance_after_funding).toBe(147.5);
    });

    it('should handle floor conversion correctly for net USD amount', async () => {
      // Mock exchange to return amount that will floor down
      const mockExchangeWithDecimal = {
        ...mockExchangeInitResult,
        amountToReceiveUSD: 15.0999388,
      };
      ngToUsdExchangeService.initializeNgToUSDExchange.mockResolvedValue(mockExchangeWithDecimal as any);
      jest.spyOn(service as any, 'calculateCardFundingFee').mockResolvedValue(0.08);

      const result = await service.initializeCardFundingFromNGN(mockUser, mockCard.id, mockInitDto);

      // 15.0999388 - 0.08 = 15.0199388
      // After floor: 15.0199388 * 100 = 1501.99388 cents, floor = 1501 cents = 15.01 USD
      expect(result.net_usd_you_will_receive).toBe(15.01);
    });

    it('should handle floor conversion correctly for card fee', async () => {
      const mockExchangeWithDecimal = {
        ...mockExchangeInitResult,
        amountToReceiveUSD: 15.0999388,
      };
      ngToUsdExchangeService.initializeNgToUSDExchange.mockResolvedValue(mockExchangeWithDecimal as any);
      jest.spyOn(service as any, 'calculateCardFundingFee').mockResolvedValue(0.075499694);

      const result = await service.initializeCardFundingFromNGN(mockUser, mockCard.id, mockInitDto);

      // 0.075499694 * 100 = 7.5499694 cents, floor = 7 cents = 0.07 USD
      expect(result.card_fee_usd).toBe(0.07);
    });
  });

  describe('executeCardFundingFromNGN', () => {
    const mockExecDto = {
      transaction_id: 'txn-ref-123',
      transaction_pin: '123456',
    };

    const mockCardFundingContext = {
      cardId: 'card-123',
      cardUserId: 'card-user-123',
      userId: 'user-123',
      depositAddress: '0xRainDepositAddress123',
      usdAmountAfterExchange: 100,
      cardFeeUSD: 2.5,
      netUsdUserWillReceive: 97.5,
      rateId: 'rate-123',
      ngnAmount: 160000,
    };

    let ngToUsdExchangeEscrowService: jest.Mocked<NgToUsdExchangeEscrowService>;
    let cardFundingFromNGNProcessor: jest.Mocked<CardFundingFromNGNProcessor>;

    beforeEach(() => {
      ngToUsdExchangeEscrowService = testingModule.get(NgToUsdExchangeEscrowService);
      cardFundingFromNGNProcessor = testingModule.get(CardFundingFromNGNProcessor);

      cardUserRepository.findOne.mockResolvedValue(mockCardUser);
      cardRepository.findOne.mockResolvedValue(mockCard);
      lockerService.withLock.mockImplementation((_, callback) => callback());
      ngToUsdExchangeEscrowService.getCardFundingContext.mockResolvedValue(mockCardFundingContext);
      ngToUsdExchangeEscrowService.updateCardFundingContext.mockResolvedValue(undefined);
      cardTransactionRepository.create.mockResolvedValue({
        id: 'card-txn-123',
        ...mockCardFundingContext,
      } as any);
      cardFundingFromNGNProcessor.queueCardFundingFromNGN.mockResolvedValue({ id: 'job-123' } as any);

      jest.spyOn(service as any, 'verifyCardOwnership').mockResolvedValue(mockCard);
    });

    it('should execute card funding from NGN successfully', async () => {
      const result = await service.executeCardFundingFromNGN(mockUser, mockCard.id, mockExecDto);

      expect(result).toBeDefined();
      expect(result.transaction_id).toBe('card-txn-123');
      expect(result.exchange_transaction_id).toBe('txn-ref-123');
      expect(result.card_id).toBe(mockCard.id);
      expect(result.status).toBe('processing');
    });

    it('should throw error when card funding context not found', async () => {
      ngToUsdExchangeEscrowService.getCardFundingContext.mockResolvedValue(null);

      await expect(service.executeCardFundingFromNGN(mockUser, mockCard.id, mockExecDto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw error when card ID does not match context', async () => {
      ngToUsdExchangeEscrowService.getCardFundingContext.mockResolvedValue({
        ...mockCardFundingContext,
        cardId: 'different-card-id',
      });

      await expect(service.executeCardFundingFromNGN(mockUser, mockCard.id, mockExecDto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw error when user ID does not match context', async () => {
      ngToUsdExchangeEscrowService.getCardFundingContext.mockResolvedValue({
        ...mockCardFundingContext,
        userId: 'different-user-id',
      });

      await expect(service.executeCardFundingFromNGN(mockUser, mockCard.id, mockExecDto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw error when card user not found', async () => {
      cardUserRepository.findOne.mockResolvedValue(null);

      await expect(service.executeCardFundingFromNGN(mockUser, mockCard.id, mockExecDto)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw error when card is blocked', async () => {
      jest.spyOn(service as any, 'verifyCardOwnership').mockResolvedValue({
        ...mockCard,
        status: ICardStatus.BLOCKED,
      });

      await expect(service.executeCardFundingFromNGN(mockUser, mockCard.id, mockExecDto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw error when card is canceled', async () => {
      jest.spyOn(service as any, 'verifyCardOwnership').mockResolvedValue({
        ...mockCard,
        status: ICardStatus.CANCELED,
      });

      await expect(service.executeCardFundingFromNGN(mockUser, mockCard.id, mockExecDto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should log amounts correctly during execution', async () => {
      const loggerSpy = jest.spyOn(service['logger'], 'log');
      await service.executeCardFundingFromNGN(mockUser, mockCard.id, mockExecDto);

      expect(loggerSpy).toHaveBeenCalledWith(
        expect.stringContaining('[NGN_CARD_FUNDING] Step 2 - Execute: Starting execution with context'),
      );
      expect(loggerSpy).toHaveBeenCalledWith(
        expect.stringContaining('[NGN_CARD_FUNDING] Step 2 - Execute: USD amount after exchange'),
      );
      expect(loggerSpy).toHaveBeenCalledWith(
        expect.stringContaining('[NGN_CARD_FUNDING] Step 2 - Execute: Card fee (USD)'),
      );
      expect(loggerSpy).toHaveBeenCalledWith(
        expect.stringContaining('[NGN_CARD_FUNDING] Step 2 - Execute: Net USD user will receive'),
      );
      expect(loggerSpy).toHaveBeenCalledWith(
        expect.stringContaining('[NGN_CARD_FUNDING] Step 2 - Execute: Net USD amount (raw)'),
      );
      expect(loggerSpy).toHaveBeenCalledWith(
        expect.stringContaining('[NGN_CARD_FUNDING] Step 2 - Execute: Amount in cents'),
      );
      expect(loggerSpy).toHaveBeenCalledWith(
        expect.stringContaining('[NGN_CARD_FUNDING] Step 2 - Execute: Fee in cents'),
      );
      expect(loggerSpy).toHaveBeenCalledWith(
        expect.stringContaining('[NGN_CARD_FUNDING] Step 2 - Execute: Card balance before'),
      );
      expect(loggerSpy).toHaveBeenCalledWith(
        expect.stringContaining('[NGN_CARD_FUNDING] Step 2 - Execute: Card balance after'),
      );
    });

    it('should handle card with zero balance correctly', async () => {
      const cardWithZeroBalance = { ...mockCard, balance: 0 };
      jest.spyOn(service as any, 'verifyCardOwnership').mockResolvedValue(cardWithZeroBalance);

      const result = await service.executeCardFundingFromNGN(mockUser, mockCard.id, mockExecDto);

      expect(result).toBeDefined();
      expect(cardTransactionRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          balance_before: 0,
        }),
      );
    });

    it('should handle card with null balance correctly', async () => {
      const cardWithNullBalance = { ...mockCard, balance: null };
      jest.spyOn(service as any, 'verifyCardOwnership').mockResolvedValue(cardWithNullBalance);

      const result = await service.executeCardFundingFromNGN(mockUser, mockCard.id, mockExecDto);

      expect(result).toBeDefined();
      expect(cardTransactionRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          balance_before: 0,
        }),
      );
    });

    it('should create card transaction with correct amounts', async () => {
      await service.executeCardFundingFromNGN(mockUser, mockCard.id, mockExecDto);

      expect(cardTransactionRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: mockUser.id,
          card_user_id: mockCardUser.id,
          card_id: mockCard.id,
          currency: 'USD',
          status: CardTransactionStatus.PENDING,
          transaction_type: CardTransactionType.DEPOSIT,
          type: CardTransactionDrCr.CREDIT,
          parent_exchange_transaction_id: null,
        }),
      );
    });

    it('should update card funding context with card transaction ID', async () => {
      await service.executeCardFundingFromNGN(mockUser, mockCard.id, mockExecDto);

      expect(ngToUsdExchangeEscrowService.updateCardFundingContext).toHaveBeenCalledWith(
        mockExecDto.transaction_id,
        expect.objectContaining({
          cardTransactionId: 'card-txn-123',
        }),
      );
    });

    it('should queue card funding job with correct parameters', async () => {
      await service.executeCardFundingFromNGN(mockUser, mockCard.id, mockExecDto);

      expect(cardFundingFromNGNProcessor.queueCardFundingFromNGN).toHaveBeenCalledWith(
        expect.objectContaining({
          cardTransactionId: 'card-txn-123',
          exchangeTransactionRef: mockExecDto.transaction_id,
          userId: mockUser.id,
          cardId: mockCard.id,
          ngnAmount: mockCardFundingContext.ngnAmount,
          usdAmount: mockCardFundingContext.usdAmountAfterExchange,
          netUsdAmount: mockCardFundingContext.netUsdUserWillReceive,
          cardFeeUSD: mockCardFundingContext.cardFeeUSD,
          rateId: mockCardFundingContext.rateId,
          depositAddress: mockCardFundingContext.depositAddress,
        }),
      );
    });

    it('should use lock to prevent concurrent operations', async () => {
      await service.executeCardFundingFromNGN(mockUser, mockCard.id, mockExecDto);

      expect(lockerService.withLock).toHaveBeenCalledWith(
        expect.stringContaining('card_funding_exec_ngn'),
        expect.any(Function),
        expect.objectContaining({ ttl: 30000 }),
      );
    });
  });
});
