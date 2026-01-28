import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import {
  CardLimitFrequency,
  CardStatus,
  CardType,
  CreateCardRequest,
  CreateCardUserRequest,
  DocumentUploadRequest,
  ListCardsRequest,
  ShippingMethod,
  UpdateCardRequest,
  UpdateCardUserRequest,
} from '../card.adapter.interface';
import { RainAdapter } from './rain.adapter';
import { RainHelper } from './rain.helper';
import { RainApplicationStatus, RainDocumentSide, RainDocumentType } from './rain.interface';
import { RainOccupationMapperService } from './rain.occupation-mapper';
import { RainOccupations } from './rain.occupations';

// Note: Do not mock the base class module to avoid subclassing a mocked constructor

describe('RainAdapter', () => {
  let adapter: RainAdapter;
  let mockRainHelper: jest.Mocked<RainHelper>;
  let mockAxiosHelper: any;

  const mockLogger = {
    log: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    // Mock axios helper methods
    mockAxiosHelper = {
      get: jest.fn(),
      post: jest.fn(),
      patch: jest.fn(),
      put: jest.fn(),
      delete: jest.fn(),
    };

    // Mock Rain helper
    mockRainHelper = {
      generateSessionId: jest.fn(),
      decryptSecret: jest.fn(),
      encryptCardPin: jest.fn(),
    } as any;

    // Mock Rain occupation mapper
    const mockOccupationMapper = {
      mapOccupation: jest.fn((occupation: string) => occupation),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RainAdapter,
        { provide: RainHelper, useValue: mockRainHelper },
        { provide: RainOccupationMapperService, useValue: mockOccupationMapper },
      ],
    }).compile();

    adapter = module.get<RainAdapter>(RainAdapter);

    // Override axios helper methods
    Object.assign(adapter, mockAxiosHelper);

    // Mock logger
    (adapter as any).logger = mockLogger;
  });

  describe('createCardUser', () => {
    const mockCreateCardUserRequest: CreateCardUserRequest = {
      proverUserRef: 'user-123',
      complianceToken: 'compliance-token-123',
      ipAddress: '192.168.1.1',
      occupation: 'Software Engineer',
      email: 'alice.smith@example.com',
      phoneNumber: '+45328393038',
      salary: 75000,
      cardUsageReason: 'Online shopping and travel',
      expectedMonthlySpend: 2000,
      isTermAccepted: true,
      useComplianceDocuments: true,
      cardStablecoinUserAddress: {
        walletAddress: '0x1234567890abcdef',
      },
    };

    const mockRainResponse = {
      status: 200,
      data: {
        id: 'rain-user-123',
        companyId: 'rain-company-456',
        firstName: 'John',
        lastName: 'Doe',
        email: 'john.doe@example.com',
        isActive: true,
        isTermsOfServiceAccepted: true,
        applicationStatus: RainApplicationStatus.APPROVED,
        applicationCompletionLink: 'https://rain.com/complete/123',
        applicationReason: 'Approved',
      },
    };

    it('should create card user successfully', async () => {
      mockAxiosHelper.post.mockResolvedValue(mockRainResponse);

      const result = await adapter.createCardUser(mockCreateCardUserRequest);

      expect(mockAxiosHelper.post).toHaveBeenCalledWith('/issuing/applications/user', {
        accountPurpose: mockCreateCardUserRequest.cardUsageReason,
        annualSalary: mockCreateCardUserRequest.salary.toString(),
        occupation: mockCreateCardUserRequest.occupation,
        ipAddress: mockCreateCardUserRequest.ipAddress,
        sourceKey: mockCreateCardUserRequest.proverUserRef,
        sumsubShareToken: mockCreateCardUserRequest.complianceToken,
        walletAddress: mockCreateCardUserRequest.cardStablecoinUserAddress?.walletAddress,
        isTermsOfServiceAccepted: mockCreateCardUserRequest.isTermAccepted,
        hasExistingDocuments: mockCreateCardUserRequest.useComplianceDocuments,
        expectedMonthlyVolume: mockCreateCardUserRequest.expectedMonthlySpend.toString(),
        email: mockCreateCardUserRequest.email,
        phoneNumber: mockCreateCardUserRequest.phoneNumber?.replace(/^\+/, ''),
        solanaAddress: mockCreateCardUserRequest.cardStablecoinUserAddress?.solanaAddress,
        tronAddress: mockCreateCardUserRequest.cardStablecoinUserAddress?.tronAddress,
        chainId: mockCreateCardUserRequest.cardStablecoinUserAddress?.chainId,
        contractAddress: mockCreateCardUserRequest.cardStablecoinUserAddress?.contractAddress,
      });

      expect(result).toEqual({
        providerRef: mockRainResponse.data.id,
        providerParentRef: mockRainResponse.data.companyId,
        status: mockRainResponse.data.applicationStatus,
        isTermAccepted: mockRainResponse.data.isTermsOfServiceAccepted,
        pendingActions: [mockRainResponse.data.applicationCompletionLink],
        isActive: true,
        applicationStatusReason: mockRainResponse.data.applicationReason,
      });

      expect(mockLogger.log).toHaveBeenCalledWith('Creating card user for user user-123');
    });

    it('should throw BadRequestException when API returns non-200 status', async () => {
      const errorResponse = {
        status: 400,
        data: 'Invalid request data',
      };
      mockAxiosHelper.post.mockResolvedValue(errorResponse);

      await expect(adapter.createCardUser(mockCreateCardUserRequest)).rejects.toThrow(
        'Failed to validate user for card creation',
      );

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to create card user for user user-123: Invalid request data',
      );
    });

    it('should handle API errors gracefully', async () => {
      const apiError = {
        response: {
          data: {
            message: 'User already exists',
          },
        },
      };
      mockAxiosHelper.post.mockRejectedValue(apiError);

      await expect(adapter.createCardUser(mockCreateCardUserRequest)).rejects.toThrow(
        new BadRequestException('Failed to validate user for card creation'),
      );

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Error creating card user for user user-123',
        'User already exists',
      );
    });

    it('should handle unknown errors', async () => {
      const unknownError = new Error('Network error');
      mockAxiosHelper.post.mockRejectedValue(unknownError);

      await expect(adapter.createCardUser(mockCreateCardUserRequest)).rejects.toThrow(
        new BadRequestException('Failed to validate user for card creation'),
      );
    });

    it('should handle application status correctly', async () => {
      const pendingResponse = {
        ...mockRainResponse,
        data: {
          ...mockRainResponse.data,
          applicationStatus: RainApplicationStatus.PENDING,
        },
      };
      mockAxiosHelper.post.mockResolvedValue(pendingResponse);

      const result = await adapter.createCardUser(mockCreateCardUserRequest);

      expect(result.isActive).toBe(false);
      expect(result.status).toBe(RainApplicationStatus.PENDING);
    });
  });

  describe('updateCardUser', () => {
    const mockUpdateCardUserRequest: UpdateCardUserRequest = {
      proverUserRef: 'user-123',
      ipAddress: '192.168.1.1',
      occupation: 'Senior Engineer',
      salary: 85000,
      cardUsageReason: 'Business expenses',
      expectedMonthlySpend: 3000,
      isTermAccepted: true,
      useComplianceDocuments: true,
      email: 'alice.smith@example.com',
      phoneNumber: '+45328393038',
      cardUserAddress: {
        line1: '123 Main St',
        line2: 'Apt 4B',
        city: 'New York',
        region: 'NY',
        postalCode: '10001',
        countryCode: 'US',
        country: 'United States',
      },
    };

    const mockRainResponse = {
      status: 200,
      data: {
        id: 'rain-user-123',
        companyId: 'rain-company-456',
        applicationStatus: RainApplicationStatus.APPROVED,
        isTermsOfServiceAccepted: true,
        applicationCompletionLink: 'https://rain.com/complete/123',
      },
    };

    it('should update card user successfully', async () => {
      mockAxiosHelper.patch.mockResolvedValue(mockRainResponse);

      const result = await adapter.updateCardUser(mockUpdateCardUserRequest);

      expect(mockAxiosHelper.patch).toHaveBeenCalledWith(
        `/issuing/applications/user/${mockUpdateCardUserRequest.proverUserRef}`,
        {
          accountPurpose: mockUpdateCardUserRequest.cardUsageReason,
          annualSalary: mockUpdateCardUserRequest.salary?.toString(),
          occupation: mockUpdateCardUserRequest.occupation,
          ipAddress: mockUpdateCardUserRequest.ipAddress,
          isTermsOfServiceAccepted: mockUpdateCardUserRequest.isTermAccepted,
          hasExistingDocuments: mockUpdateCardUserRequest.useComplianceDocuments,
          expectedMonthlyVolume: mockUpdateCardUserRequest.expectedMonthlySpend?.toString(),
          address: {
            line1: mockUpdateCardUserRequest.cardUserAddress.line1,
            line2: mockUpdateCardUserRequest.cardUserAddress.line2,
            city: mockUpdateCardUserRequest.cardUserAddress.city,
            region: mockUpdateCardUserRequest.cardUserAddress.region,
            postalCode: mockUpdateCardUserRequest.cardUserAddress.postalCode,
            countryCode: mockUpdateCardUserRequest.cardUserAddress.countryCode,
            country: mockUpdateCardUserRequest.cardUserAddress.country,
          },
        },
      );

      expect(result).toEqual({
        providerRef: mockRainResponse.data.id,
        providerParentRef: mockRainResponse.data.companyId,
        status: mockRainResponse.data.applicationStatus,
        isTermAccepted: mockRainResponse.data.isTermsOfServiceAccepted,
        pendingActions: [mockRainResponse.data.applicationCompletionLink],
        isActive: true,
        applicationStatusReason: undefined,
      });
    });

    it('should update card user without address', async () => {
      const requestWithoutAddress = { ...mockUpdateCardUserRequest };
      delete requestWithoutAddress.cardUserAddress;

      mockAxiosHelper.patch.mockResolvedValue(mockRainResponse);

      await adapter.updateCardUser(requestWithoutAddress);

      expect(mockAxiosHelper.patch).toHaveBeenCalledWith(
        `/issuing/applications/user/${requestWithoutAddress.proverUserRef}`,
        expect.not.objectContaining({ address: expect.anything() }),
      );
    });

    it('should throw BadRequestException when API returns non-200 status', async () => {
      const errorResponse = {
        status: 400,
        data: 'Update failed',
      };
      mockAxiosHelper.patch.mockResolvedValue(errorResponse);

      await expect(adapter.updateCardUser(mockUpdateCardUserRequest)).rejects.toThrow('Failed to update card user');
    });
  });

  describe('uploadCardUserDocument', () => {
    const mockDocumentRequest: DocumentUploadRequest = {
      documentName: 'Passport Front',
      documentType: 'passport',
      documentSide: 'front',
      country: 'US',
      file: Buffer.from('mock-file-data'),
    };

    const mockRainResponse = {
      status: 200,
      data: {
        documentId: 'doc-123',
        status: 'uploaded',
      },
    };

    it('should upload document successfully', async () => {
      mockAxiosHelper.post.mockResolvedValue(mockRainResponse);

      const result = await adapter.uploadCardUserDocument('user-123', mockDocumentRequest);

      expect(mockAxiosHelper.post).toHaveBeenCalledWith(
        '/issuing/applications/user/user-123/document',
        {
          name: mockDocumentRequest.documentName,
          type: RainDocumentType.PASSPORT,
          side: RainDocumentSide.FRONT,
          country: mockDocumentRequest.country,
          document: mockDocumentRequest.file,
        },
        {
          'Content-Type': 'multipart/form-data',
        },
      );

      expect(result).toEqual(mockRainResponse.data);
    });

    it('should map document types correctly', async () => {
      mockAxiosHelper.post.mockResolvedValue(mockRainResponse);

      const documentTypes = [
        { input: 'idCard', expected: RainDocumentType.ID_CARD },
        { input: 'passport', expected: RainDocumentType.PASSPORT },
        { input: 'drivers', expected: RainDocumentType.DRIVERS },
        { input: 'utilityBill', expected: RainDocumentType.UTILITY_BILL },
        { input: 'unknown', expected: RainDocumentType.OTHER },
      ];

      for (const { input, expected } of documentTypes) {
        const request = { ...mockDocumentRequest, documentType: input };
        await adapter.uploadCardUserDocument('user-123', request);

        expect(mockAxiosHelper.post).toHaveBeenCalledWith(
          expect.any(String),
          expect.objectContaining({ type: expected }),
          expect.any(Object),
        );
      }
    });

    it('should map document sides correctly', async () => {
      mockAxiosHelper.post.mockResolvedValue(mockRainResponse);

      const documentSides = [
        { input: 'front', expected: RainDocumentSide.FRONT },
        { input: 'back', expected: RainDocumentSide.BACK },
        { input: 'unknown', expected: RainDocumentSide.FRONT },
      ];

      for (const { input, expected } of documentSides) {
        const request = { ...mockDocumentRequest, documentSide: input };
        await adapter.uploadCardUserDocument('user-123', request);

        expect(mockAxiosHelper.post).toHaveBeenCalledWith(
          expect.any(String),
          expect.objectContaining({ side: expected }),
          expect.any(Object),
        );
      }
    });

    it('should throw BadRequestException when upload fails', async () => {
      const errorResponse = {
        status: 400,
        data: 'Invalid document format',
      };
      mockAxiosHelper.post.mockResolvedValue(errorResponse);

      await expect(adapter.uploadCardUserDocument('user-123', mockDocumentRequest)).rejects.toThrow(
        'Failed to upload document',
      );
    });
  });

  describe('getCardApplicationStatus', () => {
    const mockRainResponse = {
      status: 200,
      data: {
        id: 'rain-user-123',
        applicationStatus: RainApplicationStatus.APPROVED,
        applicationCompletionLink: {
          url: 'https://rain.com/complete',
          params: { userId: 'user-123' },
        },
        applicationReason: 'All documents verified',
      },
    };

    it('should get application status successfully', async () => {
      mockAxiosHelper.get.mockResolvedValue(mockRainResponse);

      const result = await adapter.getCardApplicationStatus('user-123');

      expect(mockAxiosHelper.get).toHaveBeenCalledWith('/issuing/applications/user/user-123');
      expect(result).toEqual({
        providerRef: mockRainResponse.data.id,
        status: mockRainResponse.data.applicationStatus,
        isActive: true,
        applicationCompletionLink: mockRainResponse.data.applicationCompletionLink,
        applicationReason: mockRainResponse.data.applicationReason,
      });
    });

    it('should handle pending application status', async () => {
      const pendingResponse = {
        ...mockRainResponse,
        data: {
          ...mockRainResponse.data,
          applicationStatus: RainApplicationStatus.PENDING,
        },
      };
      mockAxiosHelper.get.mockResolvedValue(pendingResponse);

      const result = await adapter.getCardApplicationStatus('user-123');

      expect(result.isActive).toBe(false);
      expect(result.status).toBe(RainApplicationStatus.PENDING);
    });

    it('should throw BadRequestException when API returns error', async () => {
      const errorResponse = {
        status: 404,
        data: 'User not found',
      };
      mockAxiosHelper.get.mockResolvedValue(errorResponse);

      await expect(adapter.getCardApplicationStatus('user-123')).rejects.toThrow(
        'Failed to get card application status',
      );
    });
  });

  describe('getUserBalance', () => {
    const mockRainResponse = {
      status: 200,
      data: {
        creditLimit: 5000,
        pendingCharges: 150,
        postedCharges: 300,
        balanceDue: 450,
        spendingPower: 4550,
      },
    };

    it('should get user balance successfully', async () => {
      mockAxiosHelper.get.mockResolvedValue(mockRainResponse);

      const result = await adapter.getUserBalance('user-123');

      expect(mockAxiosHelper.get).toHaveBeenCalledWith('/issuing/users/user-123/balances');
      expect(result).toEqual({
        creditLimit: 5000,
        pendingCharges: 150,
        postedCharges: 300,
        balanceDue: 450,
        spendingPower: 4550,
      });
    });

    it('should throw BadRequestException when API returns error', async () => {
      const errorResponse = {
        status: 404,
        data: 'User not found',
      };
      mockAxiosHelper.get.mockResolvedValue(errorResponse);

      await expect(adapter.getUserBalance('user-123')).rejects.toThrow('Failed to get user balance');
    });
  });

  describe('getPartnerBalance', () => {
    const mockRainResponse = {
      status: 200,
      data: {
        creditLimit: 100000,
        pendingCharges: 2500,
        postedCharges: 5000,
        balanceDue: 7500,
        spendingPower: 92500,
      },
    };

    it('should get partner balance successfully', async () => {
      mockAxiosHelper.get.mockResolvedValue(mockRainResponse);

      const result = await adapter.getPartnerBalance();

      expect(mockAxiosHelper.get).toHaveBeenCalledWith('/issuing/balances');
      expect(result).toEqual({
        creditLimit: 100000,
        pendingCharges: 2500,
        postedCharges: 5000,
        balanceDue: 7500,
        spendingPower: 92500,
      });
    });

    it('should throw BadRequestException when API returns error', async () => {
      const errorResponse = {
        status: 403,
        data: 'Access denied',
      };
      mockAxiosHelper.get.mockResolvedValue(errorResponse);

      await expect(adapter.getPartnerBalance()).rejects.toThrow('Failed to get partner balance');
    });
  });

  describe('getCardDetails', () => {
    const mockRainResponse = {
      status: 200,
      data: {
        id: 'card-abc',
        type: 'virtual',
        status: 'active',
        last4: '4321',
        expirationMonth: '05',
        expirationYear: '2031',
        limit: {
          amount: 2500,
          frequency: 'per24HourPeriod',
        },
        companyId: 'company-123',
        userId: 'user-789',
        tokenWallets: ['wallet-xyz'],
      },
    };

    it('should retrieve card details successfully', async () => {
      mockAxiosHelper.get.mockResolvedValue(mockRainResponse);

      const result = await adapter.getCardDetails('card-abc');

      expect(mockAxiosHelper.get).toHaveBeenCalledWith('/issuing/cards/card-abc');
      expect(result).toEqual({
        cardId: 'card-abc',
        type: CardType.VIRTUAL,
        status: CardStatus.ACTIVE,
        isActive: true,
        displayName: 'Card 4321',
        lastFourDigits: '4321',
        expiryMonth: '05',
        expiryYear: '2031',
        limitAmount: 2500,
        limitFrequency: CardLimitFrequency.PER_24_HOUR_PERIOD,
        providerMetadata: {
          companyId: 'company-123',
          userId: 'user-789',
          tokenWallets: ['wallet-xyz'],
        },
      });
    });

    it('should throw BadRequestException when provider returns an error', async () => {
      mockAxiosHelper.get.mockResolvedValue({ status: 404, data: 'not found' });

      await expect(adapter.getCardDetails('card-abc')).rejects.toThrow('Failed to get card details for card');
    });
  });

  describe('getDecryptedCardSecrets', () => {
    const mockSecretsResponse = {
      status: 200,
      data: {
        encryptedPan: {
          data: 'encrypted-pan',
          iv: 'pan-iv',
        },
        encryptedCvc: {
          data: 'encrypted-cvc',
          iv: 'cvc-iv',
        },
      },
    };

    it('should decrypt card secrets with session headers', async () => {
      mockRainHelper.generateSessionId.mockResolvedValue({ sessionId: 'session-123', secretKey: 'secret' });
      mockRainHelper.decryptSecret.mockResolvedValueOnce('4111111111111111').mockResolvedValueOnce('123');
      mockAxiosHelper.get.mockResolvedValue(mockSecretsResponse);

      const result = await adapter.getDecryptedCardSecrets('card-abc');

      expect(mockRainHelper.generateSessionId).toHaveBeenCalled();
      expect(mockAxiosHelper.get).toHaveBeenCalledWith(
        '/issuing/cards/card-abc/secrets',
        undefined,
        expect.objectContaining({
          sessionid: 'session-123',
        }),
      );
      expect(mockRainHelper.decryptSecret).toHaveBeenNthCalledWith(1, 'encrypted-pan', 'pan-iv');
      expect(mockRainHelper.decryptSecret).toHaveBeenNthCalledWith(2, 'encrypted-cvc', 'cvc-iv');
      expect(result).toEqual({
        decryptedPan: '4111111111111111',
        decryptedCvc: '123',
      });
    });

    it('should throw BadRequestException when request fails', async () => {
      mockRainHelper.generateSessionId.mockResolvedValue({ sessionId: 'session-123', secretKey: 'secret' });
      mockAxiosHelper.get.mockResolvedValue({ status: 500, data: 'boom' });

      await expect(adapter.getDecryptedCardSecrets('card-abc')).rejects.toThrow('Failed to get card secrets for card');
    });
  });

  describe('getCardPin', () => {
    const mockPinResponse = {
      status: 200,
      data: {
        encryptedPin: {
          data: 'encrypted-pin',
          iv: 'pin-iv',
        },
      },
    };

    it('should fetch encrypted pin with generated session id', async () => {
      mockRainHelper.generateSessionId.mockResolvedValue({ sessionId: 'session-789', secretKey: 'secret' });
      mockAxiosHelper.get.mockResolvedValue(mockPinResponse);

      const result = await adapter.getCardPin('card-123');

      expect(mockRainHelper.generateSessionId).toHaveBeenCalled();
      expect(mockAxiosHelper.get).toHaveBeenCalledWith('/cards/card-123/pin', undefined, {
        sessionid: 'session-789',
      });
      expect(result).toEqual({
        encryptedPin: {
          data: 'encrypted-pin',
          iv: 'pin-iv',
        },
      });
    });

    it('should throw BadRequestException when API responds with non-200', async () => {
      mockRainHelper.generateSessionId.mockResolvedValue({ sessionId: 'session-789', secretKey: 'secret' });
      mockAxiosHelper.get.mockResolvedValue({ status: 401, data: 'invalid session' });

      await expect(adapter.getCardPin('card-123')).rejects.toThrow('Failed to get card PIN for card');
    });
  });

  describe('getProcessorDetails', () => {
    const mockProcessorResponse = {
      status: 200,
      data: {
        processorCardId: 'processor-123',
        timeBasedSecret: 'secret-456',
      },
    };

    it('should retrieve processor details', async () => {
      mockAxiosHelper.get.mockResolvedValue(mockProcessorResponse);

      const result = await adapter.getProcessorDetails('card-123');

      expect(mockAxiosHelper.get).toHaveBeenCalledWith('/issuing/cards/card-123/processorDetails');
      expect(result).toEqual({
        processorCardId: 'processor-123',
        timeBasedSecret: 'secret-456',
      });
    });

    it('should throw when processor details cannot be fetched', async () => {
      mockAxiosHelper.get.mockResolvedValue({ status: 500, data: 'error' });

      await expect(adapter.getProcessorDetails('card-123')).rejects.toThrow(
        'Failed to get processor details for card card-123',
      );
    });
  });

  describe('listCards', () => {
    const baseRainCard = {
      id: 'card-1',
      type: 'virtual',
      status: 'active',
      last4: '1111',
      expirationMonth: '01',
      expirationYear: '2030',
      limit: {
        amount: 1000,
        frequency: 'per30DayPeriod',
      },
      companyId: 'company-1',
      userId: 'user-123',
      tokenWallets: ['wallet-1'],
    };

    it('should list cards for a user with default parameters', async () => {
      mockAxiosHelper.get.mockResolvedValue({ status: 200, data: [baseRainCard], headers: {} });

      const request: ListCardsRequest = { userId: 'user-123' };
      const result = await adapter.listCards(request);

      expect(mockAxiosHelper.get).toHaveBeenCalledWith('/issuing/cards?userId=user-123');
      expect(result).toEqual({
        cards: [
          {
            cardId: 'card-1',
            type: CardType.VIRTUAL,
            status: CardStatus.ACTIVE,
            isActive: true,
            displayName: 'Card 1111',
            lastFourDigits: '1111',
            expiryMonth: '01',
            expiryYear: '2030',
            limitAmount: 1000,
            limitFrequency: CardLimitFrequency.PER_30_DAY_PERIOD,
            providerMetadata: {
              companyId: 'company-1',
              userId: 'user-123',
              tokenWallets: ['wallet-1'],
            },
          },
        ],
        nextCursor: undefined,
        hasMore: false,
      });
    });

    it('should append filters and pagination metadata', async () => {
      mockAxiosHelper.get.mockResolvedValue({
        status: 200,
        data: [baseRainCard],
        headers: {
          'x-next-cursor': 'cursor-2',
          'x-has-more': 'true',
        },
      });

      const request: ListCardsRequest = {
        userId: 'user-123',
        status: CardStatus.ACTIVE,
        cursor: 'cursor-1',
        limit: 2,
      };

      const result = await adapter.listCards(request);

      expect(mockAxiosHelper.get).toHaveBeenCalledWith(
        '/issuing/cards?userId=user-123&status=active&cursor=cursor-1&limit=2',
      );
      expect(result.nextCursor).toBe('cursor-2');
      expect(result.hasMore).toBe(true);
    });

    it('should throw BadRequestException when provider returns error', async () => {
      mockAxiosHelper.get.mockResolvedValue({ status: 500, data: 'error' });

      await expect(
        adapter.listCards({
          userId: 'user-123',
        }),
      ).rejects.toThrow(/Failed to list cards for user user-123/);
    });
  });

  describe('createCard', () => {
    const mockCreateCardRequest: CreateCardRequest = {
      providerUserRef: 'user-123',
      type: CardType.VIRTUAL,
      limit: {
        frequency: CardLimitFrequency.PER_30_DAY_PERIOD,
        amount: 1000,
      },
      configuration: {
        productId: 'prod-123',
        productRef: 'ref-456',
        virtualCardArt: 'art-789',
      },
      firstName: 'John',
      lastName: 'Doe',
      billing: {
        line1: '123 Main St',
        line2: 'Apt 4B',
        city: 'New York',
        region: 'NY',
        postalCode: '10001',
        countryCode: 'US',
        country: 'United States',
      },
      status: CardStatus.ACTIVE,
    };

    const mockRainResponse = {
      status: 201,
      data: {
        id: 'card-123',
        companyId: 'company-456',
        userId: 'user-789',
        type: 'virtual',
        status: 'active',
        limit: {
          frequency: 'per30DayPeriod',
          amount: 1000,
        },
        last4: '1234',
        expirationMonth: '12',
        expirationYear: '2027',
        tokenWallets: ['wallet-1', 'wallet-2'],
      },
    };

    it('should create virtual card successfully', async () => {
      mockAxiosHelper.post.mockResolvedValue(mockRainResponse);

      const result = await adapter.createCard(mockCreateCardRequest);

      expect(mockAxiosHelper.post).toHaveBeenCalledWith('/issuing/users/user-123/cards', {
        type: CardType.VIRTUAL,
        limit: {
          frequency: CardLimitFrequency.PER_30_DAY_PERIOD,
          amount: 1000,
        },
        configuration: {
          displayName: 'John Doe',
          productId: 'prod-123',
          productRef: 'ref-456',
          virtualCardArt: 'art-789',
        },
        billing: mockCreateCardRequest.billing,
        status: CardStatus.ACTIVE,
      });

      expect(result).toEqual({
        cardId: 'card-123',
        type: CardType.VIRTUAL,
        status: CardStatus.ACTIVE,
        isActive: true,
        displayName: 'John Doe',
        lastFourDigits: '1234',
        expiryMonth: '12',
        expiryYear: '2027',
        limitAmount: 1000,
        limitFrequency: CardLimitFrequency.PER_30_DAY_PERIOD,
        providerMetadata: {
          companyId: 'company-456',
          userId: 'user-789',
          tokenWallets: ['wallet-1', 'wallet-2'],
          requestConfiguration: mockCreateCardRequest.configuration,
          requestBilling: mockCreateCardRequest.billing,
          requestShipping: undefined,
          bulkShippGroupId: undefined,
        },
      });
    });

    it('should create physical card with shipping successfully', async () => {
      const physicalCardRequest: CreateCardRequest = {
        ...mockCreateCardRequest,
        type: CardType.PHYSICAL,
        shipping: {
          line1: '456 Shipping St',
          line2: 'Suite 100',
          city: 'Boston',
          region: 'MA',
          postalCode: '02101',
          countryCode: 'US',
          country: 'United States',
          phoneNumber: '+1234567890',
          method: ShippingMethod.EXPRESS,
        },
        bulkShippGroupId: 'bulk-123',
      };

      const physicalResponse = {
        ...mockRainResponse,
        data: { ...mockRainResponse.data, type: 'physical' },
      };

      mockAxiosHelper.post.mockResolvedValue(physicalResponse);

      const result = await adapter.createCard(physicalCardRequest);

      expect(mockAxiosHelper.post).toHaveBeenCalledWith(
        '/issuing/users/user-123/cards',
        expect.objectContaining({
          type: CardType.PHYSICAL,
          shipping: {
            line1: '456 Shipping St',
            line2: 'Suite 100',
            city: 'Boston',
            region: 'MA',
            postalCode: '02101',
            countryCode: 'US',
            country: 'United States',
            phoneNumber: '+1234567890',
            method: ShippingMethod.EXPRESS,
          },
          bulkShippingGroupId: 'bulk-123',
        }),
      );

      expect(result.type).toBe(CardType.PHYSICAL);
    });

    it('should normalize billing and shipping country codes when invalid codes are provided', async () => {
      const request: CreateCardRequest = {
        ...mockCreateCardRequest,
        type: CardType.PHYSICAL,
        billing: {
          ...mockCreateCardRequest.billing,
          countryCode: 'USA',
          country: 'Canada',
        },
        shipping: {
          line1: '456 Shipping St',
          line2: '',
          city: 'Boston',
          region: 'MA',
          postalCode: '02101',
          countryCode: '',
          country: 'United States',
          phoneNumber: '+1234567890',
          method: ShippingMethod.STANDARD,
        },
      };

      mockAxiosHelper.post.mockResolvedValue({
        status: 200,
        data: { ...mockRainResponse.data, type: 'physical' },
      });

      await adapter.createCard(request);

      expect(mockAxiosHelper.post).toHaveBeenCalledWith(
        '/issuing/users/user-123/cards',
        expect.objectContaining({
          billing: expect.objectContaining({ countryCode: 'CA', country: 'Canada' }),
          shipping: expect.objectContaining({ countryCode: 'US', country: 'United States' }),
        }),
      );
      expect(mockLogger.log).toHaveBeenCalledWith('Mapped country "Canada" to country code "CA"');
      expect(mockLogger.log).toHaveBeenCalledWith('Mapped country "United States" to country code "US"');
    });

    it('should default to US when country code cannot be derived', async () => {
      const request: CreateCardRequest = {
        ...mockCreateCardRequest,
        type: CardType.PHYSICAL,
        billing: {
          ...mockCreateCardRequest.billing,
          countryCode: '',
          country: 'Unknownland',
        },
        shipping: {
          line1: '789 Mystery Ave',
          line2: '',
          city: 'Mystery',
          region: 'MU',
          postalCode: '99999',
          countryCode: '',
          country: 'Nowhere Land',
          phoneNumber: '+1234567890',
          method: ShippingMethod.STANDARD,
        },
      };

      mockAxiosHelper.post.mockResolvedValue({
        status: 200,
        data: { ...mockRainResponse.data, type: 'physical' },
      });

      await adapter.createCard(request);

      expect(mockAxiosHelper.post).toHaveBeenCalledWith(
        '/issuing/users/user-123/cards',
        expect.objectContaining({
          billing: expect.objectContaining({ countryCode: 'US' }),
          shipping: expect.objectContaining({ countryCode: 'US' }),
        }),
      );

      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Could not determine country code for "" or "Unknownland", defaulting to US',
      );
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Could not determine country code for "" or "Nowhere Land", defaulting to US',
      );
    });

    it('should convert lowercase country code to uppercase', async () => {
      const request: CreateCardRequest = {
        ...mockCreateCardRequest,
        type: CardType.VIRTUAL,
        billing: {
          ...mockCreateCardRequest.billing,
          countryCode: 'us',
          country: 'United States',
        },
      };

      mockAxiosHelper.post.mockResolvedValue({
        status: 200,
        data: { ...mockRainResponse.data, type: 'virtual' },
      });

      await adapter.createCard(request);

      expect(mockAxiosHelper.post).toHaveBeenCalledWith(
        '/issuing/users/user-123/cards',
        expect.objectContaining({
          billing: expect.objectContaining({ countryCode: 'US' }),
        }),
      );
    });

    it('should handle country code with invalid length', async () => {
      const request: CreateCardRequest = {
        ...mockCreateCardRequest,
        type: CardType.VIRTUAL,
        billing: {
          ...mockCreateCardRequest.billing,
          countryCode: 'USA',
          country: 'United States',
        },
      };

      mockAxiosHelper.post.mockResolvedValue({
        status: 200,
        data: { ...mockRainResponse.data, type: 'virtual' },
      });

      await adapter.createCard(request);

      expect(mockAxiosHelper.post).toHaveBeenCalledWith(
        '/issuing/users/user-123/cards',
        expect.objectContaining({
          billing: expect.objectContaining({ countryCode: 'US' }),
        }),
      );
    });

    it('should handle null country code and country name that does not map', async () => {
      const request: CreateCardRequest = {
        ...mockCreateCardRequest,
        type: CardType.VIRTUAL,
        billing: {
          ...mockCreateCardRequest.billing,
          countryCode: null as any,
          country: 'NonExistentCountry',
        },
      };

      mockAxiosHelper.post.mockResolvedValue({
        status: 200,
        data: { ...mockRainResponse.data, type: 'virtual' },
      });

      await adapter.createCard(request);

      expect(mockAxiosHelper.post).toHaveBeenCalledWith(
        '/issuing/users/user-123/cards',
        expect.objectContaining({
          billing: expect.objectContaining({ countryCode: 'US' }),
        }),
      );

      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Could not determine country code for "null" or "NonExistentCountry", defaulting to US',
      );
    });

    it('should validate physical card requirements', async () => {
      const invalidPhysicalRequest = {
        ...mockCreateCardRequest,
        type: CardType.PHYSICAL,
        // Missing shipping information
      };

      await expect(adapter.createCard(invalidPhysicalRequest)).rejects.toThrow('Failed to create physical card');
    });

    it('should validate virtual card restrictions', async () => {
      const invalidVirtualRequest = {
        ...mockCreateCardRequest,
        type: CardType.VIRTUAL,
        shipping: {
          line1: '123 Invalid St',
          city: 'Invalid',
          region: 'IV',
          postalCode: '00000',
          countryCode: 'US',
          country: 'United States',
          phoneNumber: '+1234567890',
          method: ShippingMethod.STANDARD,
        },
      };

      await expect(adapter.createCard(invalidVirtualRequest)).rejects.toThrow('Failed to create virtual card');
    });

    it('should throw BadRequestException when card creation fails', async () => {
      const errorResponse = {
        status: 400,
        data: 'Card creation failed',
      };
      mockAxiosHelper.post.mockResolvedValue(errorResponse);

      await expect(adapter.createCard(mockCreateCardRequest)).rejects.toThrow('Failed to create virtual card');
    });
  });

  describe('updateCard', () => {
    const mockUpdateCardRequest: UpdateCardRequest = {
      limit: {
        frequency: CardLimitFrequency.PER_7_DAY_PERIOD,
        amount: 1500,
      },
      billing: {
        line1: '789 Updated St',
        city: 'Updated City',
        region: 'UC',
        postalCode: '12345',
        countryCode: 'US',
        country: 'United States',
      },
      configuration: {
        productId: 'prod-123',
        productRef: 'ref-456',
        virtualCardArt: 'new-art-456',
      },
      firstName: 'Jane',
      lastName: 'Smith',
    };

    const mockRainResponse = {
      status: 200,
      data: {
        id: 'card-123',
        companyId: 'company-456',
        userId: 'user-789',
        type: 'virtual',
        status: 'active',
        limit: {
          frequency: 'per7DayPeriod',
          amount: 1500,
        },
        last4: '5678',
        expirationMonth: '06',
        expirationYear: '2028',
        tokenWallets: ['wallet-3'],
      },
    };

    it('should update card successfully', async () => {
      mockAxiosHelper.patch.mockResolvedValue(mockRainResponse);

      const result = await adapter.updateCard('card-123', mockUpdateCardRequest);

      expect(mockAxiosHelper.patch).toHaveBeenCalledWith('/issuing/cards/card-123', {
        limit: {
          frequency: CardLimitFrequency.PER_7_DAY_PERIOD,
          amount: 1500,
        },
        billing: mockUpdateCardRequest.billing,
        configuration: {
          virtualCardArt: 'new-art-456',
        },
      });

      expect(result).toEqual({
        cardId: 'card-123',
        type: CardType.VIRTUAL,
        status: CardStatus.ACTIVE,
        isActive: true,
        displayName: 'Jane Smith',
        lastFourDigits: '5678',
        expiryMonth: '06',
        expiryYear: '2028',
        limitAmount: 1500,
        limitFrequency: CardLimitFrequency.PER_7_DAY_PERIOD,
        providerMetadata: {
          companyId: 'company-456',
          userId: 'user-789',
          tokenWallets: ['wallet-3'],
          updateRequestData: mockUpdateCardRequest,
        },
      });
    });

    it('should update card with partial data', async () => {
      const partialUpdateRequest: UpdateCardRequest = {
        limit: {
          frequency: CardLimitFrequency.PER_24_HOUR_PERIOD,
          amount: 500,
        },
        status: CardStatus.LOCKED,
        firstName: 'Bob',
        lastName: 'Johnson',
      };

      mockAxiosHelper.patch.mockResolvedValue(mockRainResponse);

      await adapter.updateCard('card-123', partialUpdateRequest);

      expect(mockAxiosHelper.patch).toHaveBeenCalledWith('/issuing/cards/card-123', {
        limit: {
          frequency: CardLimitFrequency.PER_24_HOUR_PERIOD,
          amount: 500,
        },
        status: CardStatus.LOCKED,
      });
    });

    it('should throw BadRequestException when update fails', async () => {
      const errorResponse = {
        status: 400,
        data: 'Update failed',
      };
      mockAxiosHelper.patch.mockResolvedValue(errorResponse);

      await expect(adapter.updateCard('card-123', mockUpdateCardRequest)).rejects.toThrow('Failed to update card');
    });
  });

  describe('updateCardPin', () => {
    const mockPin = '1234';
    const mockEncryptedPinResponse = {
      encryptedPin: 'encrypted-pin-data',
      encodedIv: 'encoded-iv-data',
      sessionId: 'session-id-data',
    };

    const mockRainResponse = {
      status: 200,
      data: {
        data: 'encrypted-response-data',
        iv: 'response-iv-data',
      },
    };

    it('should update card PIN successfully', async () => {
      mockRainHelper.encryptCardPin.mockResolvedValue(mockEncryptedPinResponse);
      mockAxiosHelper.patch.mockResolvedValue(mockRainResponse);

      const result = await adapter.updateCardPin('card-123', mockPin);

      expect(mockRainHelper.encryptCardPin).toHaveBeenCalledWith(mockPin);
      expect(mockAxiosHelper.patch).toHaveBeenCalledWith(
        '/issuing/cards/card-123/pin',
        {
          encryptedPin: {
            iv: mockEncryptedPinResponse.encodedIv,
            data: mockEncryptedPinResponse.encryptedPin,
          },
        },
        {
          SessionId: mockEncryptedPinResponse.sessionId,
        },
      );

      expect(result).toEqual({
        encryptedPin: mockRainResponse.data.data,
        encodedIv: mockRainResponse.data.iv,
      });
    });

    it('should throw BadRequestException when PIN encryption fails', async () => {
      const encryptionError = new Error('Encryption failed');
      mockRainHelper.encryptCardPin.mockRejectedValue(encryptionError);

      await expect(adapter.updateCardPin('card-123', mockPin)).rejects.toThrow(
        new BadRequestException('Failed to update card pin for card'),
      );
    });

    it('should throw BadRequestException when PIN update fails', async () => {
      mockRainHelper.encryptCardPin.mockResolvedValue(mockEncryptedPinResponse);
      const errorResponse = {
        status: 400,
        data: 'PIN update failed',
      };
      mockAxiosHelper.patch.mockResolvedValue(errorResponse);

      await expect(adapter.updateCardPin('card-123', mockPin)).rejects.toThrow('Failed to update card pin for card');
    });
  });

  describe('validateCardRequest', () => {
    const baseCardRequest: CreateCardRequest = {
      providerUserRef: 'user-123',
      type: CardType.VIRTUAL,
      limit: {
        frequency: CardLimitFrequency.PER_30_DAY_PERIOD,
        amount: 1000,
      },
      configuration: {
        productId: 'prod-123',
        productRef: 'ref-456',
      },
      firstName: 'John',
      lastName: 'Doe',
      billing: {
        line1: '123 Main St',
        city: 'New York',
        region: 'NY',
        postalCode: '10001',
        countryCode: 'US',
        country: 'United States',
      },
      status: CardStatus.ACTIVE,
    };

    it('should validate physical card without shipping address', async () => {
      const physicalCardRequest = {
        ...baseCardRequest,
        type: CardType.PHYSICAL,
      };

      await expect(adapter.createCard(physicalCardRequest)).rejects.toThrow('Failed to create physical card');
    });

    it('should validate physical card without shipping method', async () => {
      const physicalCardRequest = {
        ...baseCardRequest,
        type: CardType.PHYSICAL,
        shipping: {
          line1: '123 Shipping St',
          city: 'Boston',
          region: 'MA',
          postalCode: '02101',
          countryCode: 'US',
          country: 'United States',
          phoneNumber: '+1234567890',
          method: '' as any,
        },
      };

      await expect(adapter.createCard(physicalCardRequest)).rejects.toThrow('Failed to create physical card');
    });

    it('should validate physical card without phone number', async () => {
      const physicalCardRequest = {
        ...baseCardRequest,
        type: CardType.PHYSICAL,
        shipping: {
          line1: '123 Shipping St',
          city: 'Boston',
          region: 'MA',
          postalCode: '02101',
          countryCode: 'US',
          country: 'United States',
          phoneNumber: '',
          method: ShippingMethod.STANDARD,
        },
      };

      await expect(adapter.createCard(physicalCardRequest)).rejects.toThrow('Failed to create physical card');
    });

    it('should validate virtual card with bulk shipping group ID', async () => {
      const virtualCardRequest = {
        ...baseCardRequest,
        type: CardType.VIRTUAL,
        bulkShippGroupId: 'bulk-123',
      };

      await expect(adapter.createCard(virtualCardRequest)).rejects.toThrow('Failed to create virtual card');
    });
  });

  describe('getOccupations', () => {
    it('should return Rain occupations list', async () => {
      const result = await adapter.getOccupations();

      expect(result).toBe(RainOccupations);
    });
  });

  describe('getUserContracts', () => {
    it('should fetch contracts when provider responds successfully', async () => {
      const mockResponse = { status: 200, data: [{ id: 'contract-1' }] };
      mockAxiosHelper.get.mockResolvedValue(mockResponse);

      const contracts = await adapter.getUserContracts('user-abc');

      expect(mockAxiosHelper.get).toHaveBeenCalledWith('/issuing/users/user-abc/contracts');
      expect(contracts).toEqual(mockResponse.data);
    });

    it('should throw when provider returns error status', async () => {
      mockAxiosHelper.get.mockResolvedValue({ status: 400, data: 'bad request' });

      await expect(adapter.getUserContracts('user-abc')).rejects.toThrow('Failed to fetch contracts');
    });

    it('should wrap unexpected errors as BadRequestException', async () => {
      const providerError = { response: { data: { message: 'boom' } } };
      mockAxiosHelper.get.mockRejectedValue(providerError);

      await expect(adapter.getUserContracts('user-abc')).rejects.toThrow('Failed to fetch contracts');
      expect(mockLogger.error).toHaveBeenCalledWith('Error fetching contracts for user user-abc', providerError);
    });
  });

  describe('createUserContract', () => {
    it('should create contract with provided chain id', async () => {
      const mockResponse = { status: 200, data: { id: 'contract-1' } };
      mockAxiosHelper.post.mockResolvedValue(mockResponse);

      const contract = await adapter.createUserContract('user-abc', 8453);

      expect(mockAxiosHelper.post).toHaveBeenCalledWith('/issuing/users/user-abc/contracts', { chainId: 8453 });
      expect(contract).toEqual(mockResponse.data);
    });

    it('should throw when provider rejects the request', async () => {
      mockAxiosHelper.post.mockResolvedValue({ status: 500, data: 'error' });

      await expect(adapter.createUserContract('user-abc', 8453)).rejects.toThrow('Failed to create contract');
    });

    it('should wrap transport errors with descriptive message', async () => {
      const providerError = { response: { data: { message: 'kaboom' } } };
      mockAxiosHelper.post.mockRejectedValue(providerError);

      await expect(adapter.createUserContract('user-abc', 8453)).rejects.toThrow('Failed to create contract');
      expect(mockLogger.error).toHaveBeenCalledWith('Error creating contract for user user-abc', providerError);
    });
  });

  describe('Error handling and logging', () => {
    it('should log appropriate messages for successful operations', async () => {
      const mockResponse = { status: 200, data: {} };
      mockAxiosHelper.get.mockResolvedValue(mockResponse);

      await adapter.getPartnerBalance();

      expect(mockLogger.log).toHaveBeenCalledWith('Getting partner balance');
    });

    it('should log error messages for failed operations', async () => {
      const apiError = { response: { data: { message: 'API Error' } } };
      mockAxiosHelper.get.mockRejectedValue(apiError);

      await expect(adapter.getPartnerBalance()).rejects.toThrow();
      expect(mockLogger.error).toHaveBeenCalledWith('Error getting partner balance', apiError);
    });

    it('should handle network errors gracefully', async () => {
      const networkError = new Error('ECONNREFUSED');
      mockAxiosHelper.post.mockRejectedValue(networkError);

      const createUserRequest: CreateCardUserRequest = {
        proverUserRef: 'user-123',
        complianceToken: 'token',
        ipAddress: '127.0.0.1',
        occupation: 'Engineer',
        salary: 75000,
        cardUsageReason: 'Testing',
        expectedMonthlySpend: 1000,
        isTermAccepted: true,
        useComplianceDocuments: false,
        email: 'alice.smith@example.com',
        phoneNumber: '+45328393038',
      };

      await expect(adapter.createCardUser(createUserRequest)).rejects.toThrow(
        new BadRequestException('Failed to validate user for card creation'),
      );
    });
  });

  describe('createCharge', () => {
    const mockRainChargeResponse = {
      status: 200,
      data: {
        id: 'charge-123',
        createdAt: '2024-01-01T00:00:00Z',
        amount: 1000,
        description: 'Test charge',
      },
    };

    it('should create charge successfully with status 200', async () => {
      mockAxiosHelper.post.mockResolvedValue(mockRainChargeResponse);

      const result = await adapter.createCharge('user-123', 1000, 'Test charge');

      expect(mockAxiosHelper.post).toHaveBeenCalledWith('/issuing/users/user-123/charges', {
        amount: 1000,
        description: 'Test charge',
      });

      expect(result).toEqual({
        providerRef: 'charge-123',
        createdAt: '2024-01-01T00:00:00Z',
        amount: 1000,
        description: 'Test charge',
      });

      expect(mockLogger.log).toHaveBeenCalledWith('Creating charge for user user-123 with amount 1000');
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Rain charge request payload: {"amount":1000,"description":"Test charge"}',
      );
    });

    it('should create charge successfully with status 201', async () => {
      const response201 = {
        ...mockRainChargeResponse,
        status: 201,
      };
      mockAxiosHelper.post.mockResolvedValue(response201);

      const result = await adapter.createCharge('user-123', 500, 'Another charge');

      expect(result).toEqual({
        providerRef: 'charge-123',
        createdAt: '2024-01-01T00:00:00Z',
        amount: 1000,
        description: 'Test charge',
      });
    });

    it('should throw BadRequestException when API returns non-200/201 status', async () => {
      const errorResponse = {
        status: 400,
        data: {
          error: 'Invalid amount',
          message: 'Amount must be positive',
        },
      };
      mockAxiosHelper.post.mockResolvedValue(errorResponse);

      try {
        await adapter.createCharge('user-123', -100, 'Invalid charge');
        fail('Should have thrown BadRequestException');
      } catch (error) {
        expect(error).toBeInstanceOf(BadRequestException);
        expect(error.message).toContain('Failed to create charge');
      }

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Error creating charge for user user-123'),
        expect.anything(),
      );
    });

    it('should throw BadRequestException when API returns non-200/201 status with null data', async () => {
      const errorResponse = {
        status: 400,
        data: null,
      };
      mockAxiosHelper.post.mockResolvedValue(errorResponse);

      try {
        await adapter.createCharge('user-123', -100, 'Invalid charge');
        fail('Should have thrown BadRequestException');
      } catch (error) {
        expect(error).toBeInstanceOf(BadRequestException);
        expect(error.message).toContain('Failed to create charge');
      }
    });

    it('should throw BadRequestException when API returns non-200/201 status with empty string data', async () => {
      const errorResponse = {
        status: 400,
        data: '',
      };
      mockAxiosHelper.post.mockResolvedValue(errorResponse);

      try {
        await adapter.createCharge('user-123', -100, 'Invalid charge');
        fail('Should have thrown BadRequestException');
      } catch (error) {
        expect(error).toBeInstanceOf(BadRequestException);
        expect(error.message).toContain('Failed to create charge');
      }
    });

    it('should handle API errors with response data', async () => {
      const apiError = {
        response: {
          status: 500,
          data: {
            message: 'Internal server error',
            code: 'ERR_500',
          },
        },
      };
      mockAxiosHelper.post.mockRejectedValue(apiError);

      try {
        await adapter.createCharge('user-123', 1000, 'Test charge');
        fail('Should have thrown BadRequestException');
      } catch (error) {
        expect(error).toBeInstanceOf(BadRequestException);
        expect(error.message).toContain('Failed to create charge');
      }

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Error creating charge for user user-123'),
        expect.anything(),
      );
    });

    it('should handle API errors without response data', async () => {
      const apiError = {
        response: {
          status: 404,
        },
      };
      mockAxiosHelper.post.mockRejectedValue(apiError);

      try {
        await adapter.createCharge('user-123', 1000, 'Test charge');
        fail('Should have thrown BadRequestException');
      } catch (error) {
        expect(error).toBeInstanceOf(BadRequestException);
        expect(error.message).toContain('Failed to create charge');
      }
    });

    it('should handle errors with message property', async () => {
      const errorWithMessage = {
        message: 'Network timeout',
      };
      mockAxiosHelper.post.mockRejectedValue(errorWithMessage);

      try {
        await adapter.createCharge('user-123', 1000, 'Test charge');
        fail('Should have thrown BadRequestException');
      } catch (error) {
        expect(error).toBeInstanceOf(BadRequestException);
        expect(error.message).toContain('Failed to create charge');
      }
    });

    it('should handle errors with stack trace', async () => {
      const errorWithStack = new Error('Test error');
      errorWithStack.stack = 'Error: Test error\n    at test.js:1:1';
      mockAxiosHelper.post.mockRejectedValue(errorWithStack);

      try {
        await adapter.createCharge('user-123', 1000, 'Test charge');
        fail('Should have thrown BadRequestException');
      } catch (error) {
        expect(error).toBeInstanceOf(BadRequestException);
        expect(error.message).toContain('Failed to create charge');
      }

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Error creating charge for user user-123'),
        errorWithStack.stack,
      );
    });

    it('should handle errors without stack trace', async () => {
      const errorWithoutStack = {
        message: 'Simple error',
      };
      mockAxiosHelper.post.mockRejectedValue(errorWithoutStack);

      try {
        await adapter.createCharge('user-123', 1000, 'Test charge');
        fail('Should have thrown BadRequestException');
      } catch (error) {
        expect(error).toBeInstanceOf(BadRequestException);
        expect(error.message).toContain('Failed to create charge');
      }
    });
  });

  describe('createDispute', () => {
    const mockRainDisputeResponse = {
      status: 200,
      data: {
        id: 'dispute-123',
        transactionId: 'txn-456',
        status: 'pending',
        createdAt: '2024-01-01T00:00:00Z',
        textEvidence: 'Test evidence',
      },
    };

    it('should create dispute successfully with status 200', async () => {
      mockAxiosHelper.post.mockResolvedValue(mockRainDisputeResponse);

      const result = await adapter.createDispute('txn-456', 'Test evidence');

      expect(mockAxiosHelper.post).toHaveBeenCalledWith('/issuing/transactions/txn-456/disputes', {
        textEvidence: 'Test evidence',
      });

      expect(result).toEqual({
        id: 'dispute-123',
        transactionId: 'txn-456',
        status: 'pending',
        createdAt: '2024-01-01T00:00:00Z',
        textEvidence: 'Test evidence',
      });

      expect(mockLogger.log).toHaveBeenCalledWith('Creating dispute for transaction txn-456');
      expect(mockLogger.debug).toHaveBeenCalledWith('Rain dispute request payload: {"textEvidence":"Test evidence"}');
    });

    it('should create dispute successfully with status 201', async () => {
      const response201 = {
        ...mockRainDisputeResponse,
        status: 201,
      };
      mockAxiosHelper.post.mockResolvedValue(response201);

      const result = await adapter.createDispute('txn-456', 'Test evidence');

      expect(result).toEqual({
        id: 'dispute-123',
        transactionId: 'txn-456',
        status: 'pending',
        createdAt: '2024-01-01T00:00:00Z',
        textEvidence: 'Test evidence',
      });
    });

    it('should create dispute without textEvidence', async () => {
      const responseWithoutEvidence = {
        ...mockRainDisputeResponse,
        data: {
          ...mockRainDisputeResponse.data,
          textEvidence: undefined,
        },
      };
      mockAxiosHelper.post.mockResolvedValue(responseWithoutEvidence);

      const result = await adapter.createDispute('txn-456');

      expect(mockAxiosHelper.post).toHaveBeenCalledWith('/issuing/transactions/txn-456/disputes', {
        textEvidence: undefined,
      });

      expect(result.textEvidence).toBeUndefined();
    });

    it('should throw BadRequestException when API returns non-200/201 status', async () => {
      const errorResponse = {
        status: 400,
        data: {
          error: 'Invalid transaction',
          message: 'Transaction not found',
        },
      };
      mockAxiosHelper.post.mockResolvedValue(errorResponse);

      try {
        await adapter.createDispute('invalid-txn', 'Test evidence');
        fail('Should have thrown BadRequestException');
      } catch (error) {
        expect(error).toBeInstanceOf(BadRequestException);
        expect(error.message).toContain('Failed to create dispute');
      }

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Error creating dispute for transaction invalid-txn'),
        expect.anything(),
      );
    });

    it('should handle API errors with response data', async () => {
      const apiError = {
        response: {
          status: 500,
          data: {
            message: 'Internal server error',
            code: 'ERR_500',
          },
        },
      };
      mockAxiosHelper.post.mockRejectedValue(apiError);

      try {
        await adapter.createDispute('txn-456', 'Test evidence');
        fail('Should have thrown BadRequestException');
      } catch (error) {
        expect(error).toBeInstanceOf(BadRequestException);
        expect(error.message).toContain('Failed to create dispute');
      }

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Error creating dispute for transaction txn-456'),
        expect.anything(),
      );
    });

    it('should handle API errors without response data', async () => {
      const apiError = {
        response: {
          status: 404,
        },
      };
      mockAxiosHelper.post.mockRejectedValue(apiError);

      try {
        await adapter.createDispute('txn-456', 'Test evidence');
        fail('Should have thrown BadRequestException');
      } catch (error) {
        expect(error).toBeInstanceOf(BadRequestException);
        expect(error.message).toContain('Failed to create dispute');
      }
    });

    it('should handle errors with message property', async () => {
      const errorWithMessage = {
        message: 'Network timeout',
      };
      mockAxiosHelper.post.mockRejectedValue(errorWithMessage);

      try {
        await adapter.createDispute('txn-456', 'Test evidence');
        fail('Should have thrown BadRequestException');
      } catch (error) {
        expect(error).toBeInstanceOf(BadRequestException);
        expect(error.message).toContain('Failed to create dispute');
      }
    });

    it('should handle errors with stack trace', async () => {
      const errorWithStack = new Error('Test error');
      errorWithStack.stack = 'Error: Test error\n    at test.js:1:1';
      mockAxiosHelper.post.mockRejectedValue(errorWithStack);

      try {
        await adapter.createDispute('txn-456', 'Test evidence');
        fail('Should have thrown BadRequestException');
      } catch (error) {
        expect(error).toBeInstanceOf(BadRequestException);
        expect(error.message).toContain('Failed to create dispute');
      }

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Error creating dispute for transaction txn-456'),
        errorWithStack.stack,
      );
    });
  });
});
