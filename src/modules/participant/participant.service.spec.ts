import { InternalServerErrorException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { KYCAdapter } from '../../adapters/kyc/kyc-adapter';
import { GetKycDetailsResponse, IdentityDocSubType, IdentityDocType } from '../../adapters/kyc/kyc-adapter.interface';
import { ParticipantAdapter } from '../../adapters/participant/participant.adapter';
import { ParticipantCreateResponse } from '../../adapters/participant/participant.adapter.interface';
import { AdapterConfigProvider } from '../../config/adapter.config';
import { UserModel } from '../../database/models/user/user.model';
import { DepositAddressService } from '../depositAddress/depositAddress.service';
import { ExternalAccountRepository } from '../externalAccount/external-account.repository';
import { ExternalAccountService } from '../externalAccount/external-account.service';
import { ParticipantService } from './participant.service';

describe('ParticipantService', () => {
  let service: ParticipantService;
  let participantAdapter: jest.Mocked<ParticipantAdapter>;
  let externalAccountService: jest.Mocked<ExternalAccountService>;

  const mockParticipantAdapter = {
    createParticipant: jest.fn(),
    uploadKycDocument: jest.fn(),
    updateParticipant: jest.fn(),
    getParticipantRef: jest.fn(),
    getKycStatus: jest.fn(),
  } as any;

  const mockExternalAccountService = {
    getExternalAccounts: jest.fn(),
    create: jest.fn(),
  } as any;

  const mockDepositAddressService = {
    createDepositAddress: jest.fn(),
  } as any;

  const mockExternalAccountRepository = {
    findByUserId: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  } as any;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ParticipantService,
        {
          provide: ParticipantAdapter,
          useValue: mockParticipantAdapter,
        },
        {
          provide: KYCAdapter,
          useValue: {
            getDocumentInfo: jest.fn(),
            getDocumentContent: jest.fn(),
          },
        },
        {
          provide: ExternalAccountService,
          useValue: mockExternalAccountService,
        },
        {
          provide: DepositAddressService,
          useValue: mockDepositAddressService,
        },
        {
          provide: AdapterConfigProvider,
          useValue: {
            getConfig: jest.fn().mockReturnValue({
              default_underlying_currency: 'USDC.SOL',
            }),
          },
        },
        {
          provide: ExternalAccountRepository,
          useValue: mockExternalAccountRepository,
        },
      ],
    }).compile();

    service = module.get<ParticipantService>(ParticipantService);
    participantAdapter = module.get(ParticipantAdapter);
    externalAccountService = module.get(ExternalAccountService);

    // defaults for common happy-paths
    mockParticipantAdapter.getParticipantRef.mockResolvedValue({ ref: null, provider: 'zerohash' });
    mockExternalAccountRepository.findOne.mockResolvedValue(null);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createParticipant', () => {
    const mockKycData: GetKycDetailsResponse = {
      userId: 'USER123',
      firstName: 'John',
      lastName: 'Doe',
      country: 'USA',
      dob: '1990-01-01',
      idNumber: '123456789',
      completedAt: '2023-01-01T00:00:00Z',
      agreementAcceptedAt: '2023-01-01T00:00:00Z',
      referenceId: 'INSPECTION123',
      idDocument: { number: 'PASSPORT123' },
      address: {
        address: '123 Main St',
        city: 'New York',
        state: 'NY',
        postalCode: '10001',
      },
    } as GetKycDetailsResponse;

    const mockUser = {
      id: 'USER123',
      email: 'john@example.com',
      first_name: 'John',
      last_name: 'Doe',
      country: { code: 'US' },
    };

    it('should return existing participant if found', async () => {
      const existingParticipant = {
        participant_code: 'EXISTING123',
        provider: 'zerohash',
      };

      externalAccountService.getExternalAccounts.mockResolvedValue({
        external_accounts: [existingParticipant],
      } as any);

      const result = await service.createParticipant(mockKycData, mockUser as UserModel);

      expect(result).toEqual({
        providerRef: 'EXISTING123',
        provider: 'zerohash',
      });
      expect(participantAdapter.createParticipant).not.toHaveBeenCalled();
    });

    it('should create new participant if none exists', async () => {
      externalAccountService.getExternalAccounts.mockResolvedValue({
        external_accounts: [],
      } as any);

      mockParticipantAdapter.getParticipantRef.mockResolvedValue({ ref: null, provider: 'zerohash' });

      const mockParticipantResponse: ParticipantCreateResponse = {
        providerRef: 'NEW123',
        provider: 'zerohash',
      };

      participantAdapter.createParticipant.mockResolvedValue(mockParticipantResponse);
      externalAccountService.create.mockResolvedValue({ id: 'EXT123' } as any);

      const result = await service.createParticipant(mockKycData, mockUser as UserModel);

      expect(result).toEqual(mockParticipantResponse);
      expect(participantAdapter.createParticipant).toHaveBeenCalledWith(
        expect.objectContaining({
          firstName: 'John',
          lastName: 'Doe',
          email: 'john@example.com',
          country: 'US',
          tin: '123456789',
          kyc: 'pass',
          compliance: 'pass',
          zip: '10001',
        }),
      );
      expect(externalAccountService.create).toHaveBeenCalledWith(
        expect.objectContaining({ user_id: 'USER123', participant_code: 'NEW123' }),
      );
    });

    it('should handle NG country without zip code', async () => {
      const ngKycData = { ...mockKycData, country: 'NGA' };

      externalAccountService.getExternalAccounts.mockResolvedValue({
        external_accounts: [],
      } as any);

      mockParticipantAdapter.getParticipantRef.mockResolvedValue({ ref: null, provider: 'zerohash' });

      const mockParticipantResponse: ParticipantCreateResponse = {
        providerRef: 'NEW123',
        provider: 'zerohash',
      };

      participantAdapter.createParticipant.mockResolvedValue(mockParticipantResponse);
      externalAccountService.create.mockResolvedValue({ id: 'EXT123' } as any);

      await service.createParticipant(ngKycData, mockUser as UserModel);

      expect(participantAdapter.createParticipant).toHaveBeenCalledWith(
        expect.objectContaining({
          country: 'NG',
        }),
      );

      // Ensure zip is not included for NG
      const call = participantAdapter.createParticipant.mock.calls[0][0];
      expect(call).not.toHaveProperty('zip');
    });

    it('should handle future timestamps by using current time', async () => {
      const futureDate = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(); // 1 day in future
      const futureKycData = {
        ...mockKycData,
        completedAt: futureDate,
        agreementAcceptedAt: futureDate,
      };

      externalAccountService.getExternalAccounts.mockResolvedValue({
        external_accounts: [],
      } as any);

      mockParticipantAdapter.getParticipantRef.mockResolvedValue({ ref: null, provider: 'zerohash' });

      const mockParticipantResponse: ParticipantCreateResponse = {
        providerRef: 'NEW123',
        provider: 'zerohash',
      };

      participantAdapter.createParticipant.mockResolvedValue(mockParticipantResponse);
      externalAccountService.create.mockResolvedValue({ id: 'EXT123' } as any);

      await service.createParticipant(futureKycData, mockUser as UserModel);

      const call = participantAdapter.createParticipant.mock.calls[0][0];
      const currentTime = Math.floor(Date.now() / 1000);

      expect(call.kycTimestamp).toBeLessThanOrEqual(currentTime);
      expect(call.complianceTimestamp).toBeLessThanOrEqual(currentTime);
      expect(call.signedTimestamp).toBeLessThanOrEqual(currentTime);
    });

    it('should throw error if participant creation fails', async () => {
      externalAccountService.getExternalAccounts.mockResolvedValue({
        external_accounts: [],
      });

      participantAdapter.createParticipant.mockRejectedValue(new Error('API Error'));

      await expect(service.createParticipant(mockKycData, mockUser as UserModel)).rejects.toThrow(
        InternalServerErrorException,
      );
    });

    it('should create participant with complete onboarding when documents provided', async () => {
      externalAccountService.getExternalAccounts.mockResolvedValue({
        external_accounts: [],
      });

      mockParticipantAdapter.getParticipantRef.mockResolvedValue({ ref: null, provider: 'zerohash' });

      const mockParticipantResponse: ParticipantCreateResponse = {
        providerRef: 'NEW123',
        provider: 'zerohash',
      };

      participantAdapter.createParticipant.mockResolvedValue(mockParticipantResponse);
      participantAdapter.uploadKycDocument.mockResolvedValue(undefined);
      participantAdapter.updateParticipant.mockResolvedValue(undefined);
      externalAccountService.create.mockResolvedValue({ id: 'EXT123' } as any);

      // Mock the document processing methods
      const mockKycAdapter = {
        getDocumentInfo: jest.fn().mockResolvedValue({
          data: {
            documents: [
              {
                id: 'doc1',
                documentType: IdentityDocType.PASSPORT,
                documentSubType: null,
                uploadSource: 'camera',
                reviewResult: { reviewAnswer: 'GREEN' },
                verificationResult: 'GREEN',
                mimeType: 'image/jpeg',
                originalFileName: 'passport.jpg',
                lastUpdatedAt: 1234567890,
                country: 'USA',
              },
              {
                id: 'liveness1',
                uploadSource: 'liveness',
                reviewResult: { reviewAnswer: 'GREEN' },
                verificationResult: 'GREEN',
              },
            ],
          },
        }),
        getDocumentContent: jest.fn().mockResolvedValue({
          data: {
            documentId: 'doc1',
            content: 'base64content',
            mimeType: 'image/jpeg',
            fileName: 'passport.jpg',
          },
        }),
      } as any;

      (service as any).kycAdapter = mockKycAdapter;

      const result = await service.createParticipant(mockKycData, mockUser as UserModel, 'APPLICANT123');

      expect(result).toEqual(mockParticipantResponse);
      expect(participantAdapter.createParticipant).toHaveBeenCalled();
      expect(mockKycAdapter.getDocumentInfo).toHaveBeenCalledWith({ applicantId: 'APPLICANT123' });
      expect(participantAdapter.uploadKycDocument).toHaveBeenCalledWith({
        documentType: 'us_passport',
        document: 'base64content',
        mime: 'image/jpeg',
        fileName: 'passport.jpg',
        userRef: 'NEW123',
        idFront: true,
        country: 'US',
      });
      expect(participantAdapter.updateParticipant).toHaveBeenCalledWith({
        userRef: 'NEW123',
        platformUpdatedAt: 1234567890,
        idNumber: 'PASSPORT123',
        idNumberType: 'us_passport',
        livenessCheck: 'pass',
        idv: 'pass',
        taxIdNumber: '123456789',
        citizenshipCode: 'US',
        employmentStatus: undefined,
        sourceOfFunds: undefined,
        industry: undefined,
      });
    });

    it('should create participant without document processing when no documents provided', async () => {
      externalAccountService.getExternalAccounts.mockResolvedValue({
        external_accounts: [],
      });

      mockParticipantAdapter.getParticipantRef.mockResolvedValue({ ref: null, provider: 'zerohash' });

      const mockParticipantResponse: ParticipantCreateResponse = {
        providerRef: 'NEW123',
        provider: 'zerohash',
      };

      participantAdapter.createParticipant.mockResolvedValue(mockParticipantResponse);
      externalAccountService.create.mockResolvedValue({ id: 'EXT123' } as any);

      const result = await service.createParticipant(mockKycData, mockUser as UserModel);

      expect(result).toEqual(mockParticipantResponse);
      expect(participantAdapter.createParticipant).toHaveBeenCalled();
      expect(participantAdapter.uploadKycDocument).not.toHaveBeenCalled();
      expect(participantAdapter.updateParticipant).not.toHaveBeenCalled();
    });
  });

  describe('uploadKycDocumentsToProvider', () => {
    const mockDocuments = [
      {
        idDocType: IdentityDocType.PASSPORT,
        idDocSubType: null,
        idNumberType: 'us_passport',
        document: 'base64content',
        mime: 'image/jpeg',
        fileName: 'passport.jpg',
      },
      {
        idDocType: IdentityDocType.DRIVERS,
        idDocSubType: IdentityDocSubType.FRONT_SIDE,
        idNumberType: 'us_drivers_license',
        document: 'base64content2',
        mime: 'image/jpeg',
        fileName: 'license.jpg',
      },
    ];

    it('should upload all documents successfully', async () => {
      participantAdapter.uploadKycDocument.mockResolvedValue(undefined);

      await service.uploadKycDocumentsToProvider(mockDocuments, 'PARTICIPANT123', 'US');

      expect(participantAdapter.uploadKycDocument).toHaveBeenCalledTimes(2);
      expect(participantAdapter.uploadKycDocument).toHaveBeenCalledWith({
        documentType: 'us_passport',
        document: 'base64content',
        mime: 'image/jpeg',
        fileName: 'passport.jpg',
        userRef: 'PARTICIPANT123',
        idFront: true,
        country: 'US',
      });
      expect(participantAdapter.uploadKycDocument).toHaveBeenCalledWith({
        documentType: 'us_drivers_license',
        document: 'base64content2',
        mime: 'image/jpeg',
        fileName: 'license.jpg',
        userRef: 'PARTICIPANT123',
        idFront: true,
        country: 'US',
      });
    });

    it('should handle upload failures gracefully', async () => {
      participantAdapter.uploadKycDocument.mockRejectedValue(new Error('Upload failed'));

      // Should not throw error
      await expect(service.uploadKycDocumentsToProvider(mockDocuments, 'PARTICIPANT123', 'US')).resolves.not.toThrow();
    });
  });

  describe('updateParticipantWithKycData', () => {
    const mockKycData = {
      idDocument: { number: 'PASSPORT123' },
      idNumber: 'SSN123',
    };

    const mockDocuments = [
      {
        idDocType: IdentityDocType.PASSPORT,
        idDocSubType: null,
        idNumberType: 'us_passport',
        platformUpdatedAt: 1234567890,
        livenessCheck: 'pass',
        idv: 'pass',
        citizenshipCode: 'US',
      },
    ];

    it('should update participant with KYC data', async () => {
      participantAdapter.updateParticipant.mockResolvedValue(undefined);

      await service.updateParticipantWithKycData('PARTICIPANT123', mockKycData, mockDocuments);

      expect(participantAdapter.updateParticipant).toHaveBeenCalledWith({
        userRef: 'PARTICIPANT123',
        platformUpdatedAt: 1234567890,
        idNumber: 'PASSPORT123',
        idNumberType: 'us_passport',
        livenessCheck: 'pass',
        idv: 'pass',
        taxIdNumber: 'SSN123',
        citizenshipCode: 'US',
        employmentStatus: undefined,
        sourceOfFunds: undefined,
        industry: undefined,
      });
    });

    it('should skip update if no documents provided', async () => {
      await service.updateParticipantWithKycData('PARTICIPANT123', mockKycData, []);

      expect(participantAdapter.updateParticipant).not.toHaveBeenCalled();
    });

    it('should skip update if missing required KYC data', async () => {
      const incompleteKycData = { idDocument: null, idNumber: 'SSN123' };

      await service.updateParticipantWithKycData('PARTICIPANT123', incompleteKycData, mockDocuments);

      expect(participantAdapter.updateParticipant).not.toHaveBeenCalled();
    });

    it('should prefer PASSPORT over DRIVERS documents', async () => {
      const mixedDocuments = [
        {
          idDocType: IdentityDocType.DRIVERS,
          idDocSubType: IdentityDocSubType.FRONT_SIDE,
          idNumberType: 'us_drivers_license',
          platformUpdatedAt: 1111111111,
          livenessCheck: 'pass',
          idv: 'pass',
          citizenshipCode: 'US',
        },
        {
          idDocType: IdentityDocType.PASSPORT,
          idDocSubType: null,
          idNumberType: 'us_passport',
          platformUpdatedAt: 2222222222,
          livenessCheck: 'pass',
          idv: 'pass',
          citizenshipCode: 'US',
        },
      ];

      participantAdapter.updateParticipant.mockResolvedValue(undefined);

      await service.updateParticipantWithKycData('PARTICIPANT123', mockKycData, mixedDocuments);

      expect(participantAdapter.updateParticipant).toHaveBeenCalledWith(
        expect.objectContaining({
          idNumberType: 'us_passport',
          platformUpdatedAt: 2222222222,
        }),
      );
    });

    it('should handle update failures gracefully', async () => {
      participantAdapter.updateParticipant.mockRejectedValue(new Error('Update failed'));

      // Should not throw error
      await expect(
        service.updateParticipantWithKycData('PARTICIPANT123', mockKycData, mockDocuments),
      ).resolves.not.toThrow();
    });
  });

  describe('private methods', () => {
    describe('normalizeCountryCode', () => {
      it('should normalize USA to US', () => {
        // Access private method for testing
        const result = (service as any).normalizeCountryCode('USA');
        expect(result).toBe('US');
      });

      it('should normalize NGA to NG', () => {
        const result = (service as any).normalizeCountryCode('NGA');
        expect(result).toBe('NG');
      });

      it('should return unchanged for other countries', () => {
        const result = (service as any).normalizeCountryCode('GB');
        expect(result).toBe('GB');
      });
    });

    describe('determineIfFrontSide', () => {
      it('should return true for PASSPORT', () => {
        const result = (service as any).determineIfFrontSide(IdentityDocType.PASSPORT, null);
        expect(result).toBe(true);
      });

      it('should return true for DRIVERS FRONT_SIDE', () => {
        const result = (service as any).determineIfFrontSide(IdentityDocType.DRIVERS, IdentityDocSubType.FRONT_SIDE);
        expect(result).toBe(true);
      });

      it('should return false for DRIVERS BACK_SIDE', () => {
        const result = (service as any).determineIfFrontSide(IdentityDocType.DRIVERS, IdentityDocSubType.BACK_SIDE);
        expect(result).toBe(false);
      });

      it('should return true for RESIDENCE_PERMIT FRONT_SIDE', () => {
        const result = (service as any).determineIfFrontSide(
          IdentityDocType.RESIDENCE_PERMIT,
          IdentityDocSubType.FRONT_SIDE,
        );
        expect(result).toBe(true);
      });

      it('should return false by default for unsupported types', () => {
        const result = (service as any).determineIfFrontSide(IdentityDocType.SELFIE, IdentityDocSubType.FRONT_SIDE);
        expect(result).toBe(false);
      });
    });
  });
});
