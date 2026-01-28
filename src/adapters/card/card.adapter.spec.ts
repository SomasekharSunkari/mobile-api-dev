import { Test, TestingModule } from '@nestjs/testing';
import { CardAdapter } from './card.adapter';
import {
  CardApplicationStatusResponse,
  CardLimitFrequency,
  CardPartnerBalanceResponse,
  CardPinResponse,
  CardResponse,
  CardSecretsResponse,
  CardStatus,
  CardType,
  CardUserBalanceResponse,
  CreateCardRequest,
  CreateCardUserRequest,
  CreatedCardUserResponse,
  DocumentUploadRequest,
  ListCardsRequest,
  ListCardsResponse,
  Occupation,
  ProcessorDetailsResponse,
  ShippingMethod,
  UpdateCardPinResponse,
  UpdateCardRequest,
  UpdateCardUserRequest,
} from './card.adapter.interface';
import { RainAdapter } from './rain/rain.adapter';
import { RainContractResponse, RainDisputeResponse } from './rain/rain.interface';

// Mock RainAxiosHelper to prevent axios initialization issues
jest.mock('./rain/rain.axios-helper', () => {
  return {
    RainAxiosHelper: class {
      get = jest.fn();
      post = jest.fn();
      patch = jest.fn();
      put = jest.fn();
      delete = jest.fn();
    },
  };
});
describe('CardAdapter', () => {
  let adapter: CardAdapter;
  let rainAdapter: jest.Mocked<RainAdapter>;

  const mockRainAdapter = {
    createCardUser: jest.fn(),
    updateCardUser: jest.fn(),
    uploadCardUserDocument: jest.fn(),
    getCardApplicationStatus: jest.fn(),
    getUserBalance: jest.fn(),
    getPartnerBalance: jest.fn(),
    createCard: jest.fn(),
    getCardDetails: jest.fn(),
    getDecryptedCardSecrets: jest.fn(),
    getCardPin: jest.fn(),
    getProcessorDetails: jest.fn(),
    listCards: jest.fn(),
    updateCard: jest.fn(),
    updateCardPin: jest.fn(),
    getOccupations: jest.fn(),
    getUserContracts: jest.fn(),
    createUserContract: jest.fn(),
    createCharge: jest.fn(),
    createDispute: jest.fn(),
  };
  Object.setPrototypeOf(mockRainAdapter, RainAdapter.prototype);

  beforeEach(async () => {
    jest.clearAllMocks();

    // Set environment variable for DEFAULT_CARD_PROVIDER
    process.env.DEFAULT_CARD_PROVIDER = 'rain';

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CardAdapter,
        {
          provide: RainAdapter,
          useValue: mockRainAdapter,
        },
      ],
    }).compile();

    adapter = module.get<CardAdapter>(CardAdapter);
    rainAdapter = module.get(RainAdapter);
  });

  afterEach(() => {
    // Clean up environment variable
    delete process.env.DEFAULT_CARD_PROVIDER;
  });

  describe('createCardUser', () => {
    const mockCreateCardUserRequest: CreateCardUserRequest = {
      proverUserRef: 'user-123',
      complianceToken: 'token-abc',
      ipAddress: '192.168.1.1',
      occupation: 'Software Engineer',
      salary: 75000,
      cardUsageReason: 'Online shopping',
      expectedMonthlySpend: 2000,
      isTermAccepted: true,
      useComplianceDocuments: false,
      cardStablecoinUserAddress: {
        walletAddress: '0x1234567890abcdef',
        chainId: '1',
      },
      email: 'john.doe@example.com',
      phoneNumber: '+1234567890',
    };

    const mockResponse: CreatedCardUserResponse = {
      providerRef: 'rain-user-123',
      providerParentRef: 'rain-company-456',
      isActive: true,
      status: 'approved',
      isTermAccepted: true,
      pendingActions: {},
      applicationStatusReason: 'Application approved',
    };

    it('should successfully create card user', async () => {
      rainAdapter.createCardUser.mockResolvedValue(mockResponse);

      const result = await adapter.createCardUser(mockCreateCardUserRequest);

      expect(result).toEqual(mockResponse);
      expect(rainAdapter.createCardUser).toHaveBeenCalledWith(mockCreateCardUserRequest);
      expect(rainAdapter.createCardUser).toHaveBeenCalledTimes(1);
    });

    it('should handle createCardUser errors', async () => {
      const error = new Error('Provider error');
      rainAdapter.createCardUser.mockRejectedValue(error);

      await expect(adapter.createCardUser(mockCreateCardUserRequest)).rejects.toThrow('Provider error');
      expect(rainAdapter.createCardUser).toHaveBeenCalledWith(mockCreateCardUserRequest);
    });
  });

  describe('updateCardUser', () => {
    const mockUpdateCardUserRequest: UpdateCardUserRequest = {
      proverUserRef: 'user-123',
      ipAddress: '192.168.1.1',
      occupation: 'Senior Software Engineer',
      salary: 85000,
      cardUsageReason: 'Travel and shopping',
      expectedMonthlySpend: 2500,
      isTermAccepted: true,
      useComplianceDocuments: true,
      cardUserAddress: {
        line1: '123 Main St',
        line2: 'Apt 4B',
        city: 'New York',
        region: 'NY',
        postalCode: '10001',
        countryCode: 'US',
        country: 'United States',
      },
      email: 'john.doe@example.com',
      phoneNumber: '+1234567890',
    };

    const mockResponse: CreatedCardUserResponse = {
      providerRef: 'rain-user-123',
      providerParentRef: 'rain-company-456',
      isActive: true,
      status: 'approved',
      isTermAccepted: true,
      pendingActions: {},
      applicationStatusReason: 'Application approved',
    };

    it('should successfully update card user', async () => {
      rainAdapter.updateCardUser.mockResolvedValue(mockResponse);

      const result = await adapter.updateCardUser(mockUpdateCardUserRequest);

      expect(result).toEqual(mockResponse);
      expect(rainAdapter.updateCardUser).toHaveBeenCalledWith(mockUpdateCardUserRequest);
      expect(rainAdapter.updateCardUser).toHaveBeenCalledTimes(1);
    });

    it('should handle updateCardUser errors', async () => {
      const error = new Error('Update failed');
      rainAdapter.updateCardUser.mockRejectedValue(error);

      await expect(adapter.updateCardUser(mockUpdateCardUserRequest)).rejects.toThrow('Update failed');
      expect(rainAdapter.updateCardUser).toHaveBeenCalledWith(mockUpdateCardUserRequest);
    });
  });

  describe('uploadCardUserDocument', () => {
    const proverUserRef = 'user-123';
    const mockDocumentRequest: DocumentUploadRequest = {
      documentName: 'passport.jpg',
      documentType: 'passport',
      documentSide: 'front',
      country: 'US',
      file: Buffer.from('fake-file-content'),
    };

    const mockResponse = {
      documentId: 'doc-123',
      status: 'uploaded',
      processingStatus: 'pending',
    };

    it('should successfully upload document', async () => {
      rainAdapter.uploadCardUserDocument.mockResolvedValue(mockResponse);

      const result = await adapter.uploadCardUserDocument(proverUserRef, mockDocumentRequest);

      expect(result).toEqual(mockResponse);
      expect(rainAdapter.uploadCardUserDocument).toHaveBeenCalledWith(proverUserRef, mockDocumentRequest);
      expect(rainAdapter.uploadCardUserDocument).toHaveBeenCalledTimes(1);
    });

    it('should handle uploadCardUserDocument errors', async () => {
      const error = new Error('Upload failed');
      rainAdapter.uploadCardUserDocument.mockRejectedValue(error);

      await expect(adapter.uploadCardUserDocument(proverUserRef, mockDocumentRequest)).rejects.toThrow('Upload failed');
      expect(rainAdapter.uploadCardUserDocument).toHaveBeenCalledWith(proverUserRef, mockDocumentRequest);
    });
  });

  describe('getCardApplicationStatus', () => {
    const proverUserRef = 'user-123';
    const mockResponse: CardApplicationStatusResponse = {
      providerRef: 'rain-user-123',
      status: 'approved',
      isActive: true,
      applicationCompletionLink: {
        url: 'https://example.com/complete',
        params: { userId: 'user-123' },
      },
      applicationReason: 'Application approved',
    };

    it('should successfully get application status', async () => {
      rainAdapter.getCardApplicationStatus.mockResolvedValue(mockResponse);

      const result = await adapter.getCardApplicationStatus(proverUserRef);

      expect(result).toEqual(mockResponse);
      expect(rainAdapter.getCardApplicationStatus).toHaveBeenCalledWith(proverUserRef);
      expect(rainAdapter.getCardApplicationStatus).toHaveBeenCalledTimes(1);
    });

    it('should handle getCardApplicationStatus errors', async () => {
      const error = new Error('Status retrieval failed');
      rainAdapter.getCardApplicationStatus.mockRejectedValue(error);

      await expect(adapter.getCardApplicationStatus(proverUserRef)).rejects.toThrow('Status retrieval failed');
      expect(rainAdapter.getCardApplicationStatus).toHaveBeenCalledWith(proverUserRef);
    });
  });

  describe('getUserBalance', () => {
    const proverUserRef = 'user-123';
    const mockResponse: CardUserBalanceResponse = {
      creditLimit: 5000,
      pendingCharges: 150,
      postedCharges: 300,
      balanceDue: 450,
      spendingPower: 4550,
    };

    it('should successfully get user balance', async () => {
      rainAdapter.getUserBalance.mockResolvedValue(mockResponse);

      const result = await adapter.getUserBalance(proverUserRef);

      expect(result).toEqual(mockResponse);
      expect(rainAdapter.getUserBalance).toHaveBeenCalledWith(proverUserRef);
      expect(rainAdapter.getUserBalance).toHaveBeenCalledTimes(1);
    });

    it('should handle getUserBalance errors', async () => {
      const error = new Error('Balance retrieval failed');
      rainAdapter.getUserBalance.mockRejectedValue(error);

      await expect(adapter.getUserBalance(proverUserRef)).rejects.toThrow('Balance retrieval failed');
      expect(rainAdapter.getUserBalance).toHaveBeenCalledWith(proverUserRef);
    });
  });

  describe('getPartnerBalance', () => {
    const mockResponse: CardPartnerBalanceResponse = {
      creditLimit: 100000,
      pendingCharges: 2500,
      postedCharges: 15000,
      balanceDue: 17500,
      spendingPower: 82500,
    };

    it('should successfully get partner balance', async () => {
      rainAdapter.getPartnerBalance.mockResolvedValue(mockResponse);

      const result = await adapter.getPartnerBalance();

      expect(result).toEqual(mockResponse);
      expect(rainAdapter.getPartnerBalance).toHaveBeenCalledWith();
      expect(rainAdapter.getPartnerBalance).toHaveBeenCalledTimes(1);
    });

    it('should handle getPartnerBalance errors', async () => {
      const error = new Error('Partner balance retrieval failed');
      rainAdapter.getPartnerBalance.mockRejectedValue(error);

      await expect(adapter.getPartnerBalance()).rejects.toThrow('Partner balance retrieval failed');
      expect(rainAdapter.getPartnerBalance).toHaveBeenCalledWith();
    });
  });

  describe('createCard', () => {
    const mockCreateCardRequest: CreateCardRequest = {
      providerUserRef: 'rain-user-123',
      type: CardType.VIRTUAL,
      limit: {
        frequency: CardLimitFrequency.PER_30_DAY_PERIOD,
        amount: 3000,
      },
      configuration: {
        productId: 'prod-123',
        productRef: 'prod-ref-123',
        virtualCardArt: 'art-123',
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

    const mockResponse: CardResponse = {
      cardId: 'card-123',
      type: CardType.VIRTUAL,
      status: CardStatus.ACTIVE,
      isActive: true,
      displayName: 'John Doe',
      lastFourDigits: '1234',
      expiryMonth: '12',
      expiryYear: '2025',
      limitAmount: 3000,
      limitFrequency: CardLimitFrequency.PER_30_DAY_PERIOD,
      providerMetadata: {
        companyId: 'rain-company-456',
        userId: 'rain-user-123',
      },
    };

    it('should successfully create virtual card', async () => {
      rainAdapter.createCard.mockResolvedValue(mockResponse);

      const result = await adapter.createCard(mockCreateCardRequest);

      expect(result).toEqual(mockResponse);
      expect(rainAdapter.createCard).toHaveBeenCalledWith(mockCreateCardRequest);
      expect(rainAdapter.createCard).toHaveBeenCalledTimes(1);
    });

    it('should successfully create physical card with shipping', async () => {
      const physicalCardRequest: CreateCardRequest = {
        ...mockCreateCardRequest,
        type: CardType.PHYSICAL,
        shipping: {
          line1: '456 Oak Ave',
          city: 'Los Angeles',
          region: 'CA',
          postalCode: '90210',
          countryCode: 'US',
          country: 'United States',
          phoneNumber: '+1234567890',
          method: ShippingMethod.STANDARD,
        },
      };

      const physicalCardResponse: CardResponse = {
        ...mockResponse,
        type: CardType.PHYSICAL,
      };

      rainAdapter.createCard.mockResolvedValue(physicalCardResponse);

      const result = await adapter.createCard(physicalCardRequest);

      expect(result).toEqual(physicalCardResponse);
      expect(rainAdapter.createCard).toHaveBeenCalledWith(physicalCardRequest);
    });

    it('should handle createCard errors', async () => {
      const error = new Error('Card creation failed');
      rainAdapter.createCard.mockRejectedValue(error);

      await expect(adapter.createCard(mockCreateCardRequest)).rejects.toThrow('Card creation failed');
      expect(rainAdapter.createCard).toHaveBeenCalledWith(mockCreateCardRequest);
    });
  });

  describe('getCardDetails', () => {
    const cardId = 'card-123';
    const mockResponse: CardResponse = {
      cardId: 'card-123',
      type: CardType.VIRTUAL,
      status: CardStatus.ACTIVE,
      isActive: true,
      displayName: 'Card 1234',
      lastFourDigits: '1234',
      expiryMonth: '12',
      expiryYear: '2025',
      limitAmount: 3000,
      limitFrequency: CardLimitFrequency.PER_30_DAY_PERIOD,
      providerMetadata: {
        companyId: 'rain-company-456',
        userId: 'rain-user-123',
        tokenWallets: ['wallet1', 'wallet2'],
      },
    };

    it('should successfully get card details', async () => {
      rainAdapter.getCardDetails.mockResolvedValue(mockResponse);

      const result = await adapter.getCardDetails(cardId);

      expect(result).toEqual(mockResponse);
      expect(rainAdapter.getCardDetails).toHaveBeenCalledWith(cardId);
      expect(rainAdapter.getCardDetails).toHaveBeenCalledTimes(1);
    });

    it('should handle getCardDetails errors', async () => {
      const error = new Error('Card not found');
      rainAdapter.getCardDetails.mockRejectedValue(error);

      await expect(adapter.getCardDetails(cardId)).rejects.toThrow('Card not found');
      expect(rainAdapter.getCardDetails).toHaveBeenCalledWith(cardId);
    });
  });

  describe('getDecryptedCardSecrets', () => {
    const cardId = 'card-123';
    const mockResponse: CardSecretsResponse = {
      decryptedPan: '4111111111111111',
      decryptedCvc: '123',
    };

    it('should successfully get card secrets', async () => {
      rainAdapter.getDecryptedCardSecrets.mockResolvedValue(mockResponse);

      const result = await adapter.getDecryptedCardSecrets(cardId);

      expect(result).toEqual(mockResponse);
      expect(rainAdapter.getDecryptedCardSecrets).toHaveBeenCalledWith(cardId);
      expect(rainAdapter.getDecryptedCardSecrets).toHaveBeenCalledTimes(1);
    });

    it('should handle getDecryptedCardSecrets errors', async () => {
      const error = new Error('Insufficient permissions for sensitive data');
      rainAdapter.getDecryptedCardSecrets.mockRejectedValue(error);

      await expect(adapter.getDecryptedCardSecrets(cardId)).rejects.toThrow(
        'Insufficient permissions for sensitive data',
      );
      expect(rainAdapter.getDecryptedCardSecrets).toHaveBeenCalledWith(cardId);
    });

    it('should handle card not found errors', async () => {
      const error = new Error('Card not found');
      rainAdapter.getDecryptedCardSecrets.mockRejectedValue(error);

      await expect(adapter.getDecryptedCardSecrets(cardId)).rejects.toThrow('Card not found');
      expect(rainAdapter.getDecryptedCardSecrets).toHaveBeenCalledWith(cardId);
    });

    it('should return properly formatted encrypted data', async () => {
      rainAdapter.getDecryptedCardSecrets.mockResolvedValue(mockResponse);

      const result = await adapter.getDecryptedCardSecrets(cardId);

      // Verify decrypted values
      expect(result).toHaveProperty('decryptedPan');
      expect(result).toHaveProperty('decryptedCvc');
      expect(typeof result.decryptedPan).toBe('string');
      expect(typeof result.decryptedCvc).toBe('string');

      // Verify specific values from mock
      expect(result.decryptedPan).toBe('4111111111111111');
      expect(result.decryptedCvc).toBe('123');
    });
  });

  describe('getCardPin', () => {
    const cardId = 'card-123';
    const mockResponse: CardPinResponse = {
      encryptedPin: {
        iv: 'test-iv-pin-789',
        data: 'encrypted-pin-data-xyz789',
      },
    };

    it('should successfully get card PIN', async () => {
      rainAdapter.getCardPin.mockResolvedValue(mockResponse);

      const result = await adapter.getCardPin(cardId);

      expect(result).toEqual(mockResponse);
      expect(rainAdapter.getCardPin).toHaveBeenCalledWith(cardId);
      expect(rainAdapter.getCardPin).toHaveBeenCalledTimes(1);
    });

    it('should handle getCardPin errors', async () => {
      const error = new Error('Insufficient permissions for PIN data');
      rainAdapter.getCardPin.mockRejectedValue(error);

      await expect(adapter.getCardPin(cardId)).rejects.toThrow('Insufficient permissions for PIN data');
      expect(rainAdapter.getCardPin).toHaveBeenCalledWith(cardId);
    });

    it('should handle invalid session errors', async () => {
      const error = new Error('Invalid session ID');
      rainAdapter.getCardPin.mockRejectedValue(error);

      await expect(adapter.getCardPin(cardId)).rejects.toThrow('Invalid session ID');
      expect(rainAdapter.getCardPin).toHaveBeenCalledWith(cardId);
    });

    it('should handle card not found errors', async () => {
      const error = new Error('Card not found');
      rainAdapter.getCardPin.mockRejectedValue(error);

      await expect(adapter.getCardPin(cardId)).rejects.toThrow('Card not found');
      expect(rainAdapter.getCardPin).toHaveBeenCalledWith(cardId);
    });

    it('should return properly formatted encrypted PIN data', async () => {
      rainAdapter.getCardPin.mockResolvedValue(mockResponse);

      const result = await adapter.getCardPin(cardId);

      // Verify structure
      expect(result).toHaveProperty('encryptedPin');

      // Verify PIN structure
      expect(result.encryptedPin).toHaveProperty('iv');
      expect(result.encryptedPin).toHaveProperty('data');
      expect(typeof result.encryptedPin.iv).toBe('string');
      expect(typeof result.encryptedPin.data).toBe('string');

      // Verify specific values
      expect(result.encryptedPin.iv).toBe('test-iv-pin-789');
      expect(result.encryptedPin.data).toBe('encrypted-pin-data-xyz789');
    });
  });

  describe('getProcessorDetails', () => {
    const cardId = 'card-123';
    const mockResponse: ProcessorDetailsResponse = {
      processorCardId: 'proc-card-456789',
      timeBasedSecret: 'secret-token-abc123def456',
    };

    it('should successfully get processor details', async () => {
      rainAdapter.getProcessorDetails.mockResolvedValue(mockResponse);

      const result = await adapter.getProcessorDetails(cardId);

      expect(result).toEqual(mockResponse);
      expect(rainAdapter.getProcessorDetails).toHaveBeenCalledWith(cardId);
      expect(rainAdapter.getProcessorDetails).toHaveBeenCalledTimes(1);
    });

    it('should handle getProcessorDetails errors', async () => {
      const error = new Error('Processor details not available');
      rainAdapter.getProcessorDetails.mockRejectedValue(error);

      await expect(adapter.getProcessorDetails(cardId)).rejects.toThrow('Processor details not available');
      expect(rainAdapter.getProcessorDetails).toHaveBeenCalledWith(cardId);
    });

    it('should handle card not found errors', async () => {
      const error = new Error('Card not found');
      rainAdapter.getProcessorDetails.mockRejectedValue(error);

      await expect(adapter.getProcessorDetails(cardId)).rejects.toThrow('Card not found');
      expect(rainAdapter.getProcessorDetails).toHaveBeenCalledWith(cardId);
    });

    it('should handle insufficient permissions errors', async () => {
      const error = new Error('Insufficient permissions');
      rainAdapter.getProcessorDetails.mockRejectedValue(error);

      await expect(adapter.getProcessorDetails(cardId)).rejects.toThrow('Insufficient permissions');
      expect(rainAdapter.getProcessorDetails).toHaveBeenCalledWith(cardId);
    });

    it('should return properly formatted processor details', async () => {
      rainAdapter.getProcessorDetails.mockResolvedValue(mockResponse);

      const result = await adapter.getProcessorDetails(cardId);

      // Verify structure
      expect(result).toHaveProperty('processorCardId');
      expect(result).toHaveProperty('timeBasedSecret');

      // Verify data types
      expect(typeof result.processorCardId).toBe('string');
      expect(typeof result.timeBasedSecret).toBe('string');

      // Verify specific values
      expect(result.processorCardId).toBe('proc-card-456789');
      expect(result.timeBasedSecret).toBe('secret-token-abc123def456');
    });

    it('should handle empty processor details gracefully', async () => {
      const emptyResponse: ProcessorDetailsResponse = {
        processorCardId: '',
        timeBasedSecret: '',
      };
      rainAdapter.getProcessorDetails.mockResolvedValue(emptyResponse);

      const result = await adapter.getProcessorDetails(cardId);

      expect(result.processorCardId).toBe('');
      expect(result.timeBasedSecret).toBe('');
    });
  });

  describe('listCards', () => {
    const mockRequest: ListCardsRequest = {
      userId: 'user-123',
      status: CardStatus.ACTIVE,
      cursor: 'cursor-abc123',
      limit: 10,
    };

    const mockCards: CardResponse[] = [
      {
        cardId: 'card-123',
        type: CardType.VIRTUAL,
        status: CardStatus.ACTIVE,
        isActive: true,
        displayName: 'Card 1234',
        lastFourDigits: '1234',
        expiryMonth: '12',
        expiryYear: '2025',
        limitAmount: 3000,
        limitFrequency: CardLimitFrequency.PER_30_DAY_PERIOD,
        providerMetadata: {
          companyId: 'rain-company-456',
          userId: 'rain-user-123',
          tokenWallets: ['wallet1'],
        },
      },
      {
        cardId: 'card-456',
        type: CardType.PHYSICAL,
        status: CardStatus.ACTIVE,
        isActive: false,
        displayName: 'Card 5678',
        lastFourDigits: '5678',
        expiryMonth: '06',
        expiryYear: '2026',
        limitAmount: 5000,
        limitFrequency: CardLimitFrequency.PER_7_DAY_PERIOD,
        providerMetadata: {
          companyId: 'rain-company-456',
          userId: 'rain-user-123',
          tokenWallets: ['wallet2', 'wallet3'],
        },
      },
    ];

    const mockResponse: ListCardsResponse = {
      cards: mockCards,
      nextCursor: 'next-cursor-def456',
      hasMore: true,
    };

    it('should successfully list cards with all parameters', async () => {
      rainAdapter.listCards.mockResolvedValue(mockResponse);

      const result = await adapter.listCards(mockRequest);

      expect(result).toEqual(mockResponse);
      expect(rainAdapter.listCards).toHaveBeenCalledWith(mockRequest);
      expect(rainAdapter.listCards).toHaveBeenCalledTimes(1);
    });

    it('should successfully list cards with minimal parameters', async () => {
      const minimalRequest: ListCardsRequest = {
        userId: 'user-123',
      };
      rainAdapter.listCards.mockResolvedValue(mockResponse);

      const result = await adapter.listCards(minimalRequest);

      expect(result).toEqual(mockResponse);
      expect(rainAdapter.listCards).toHaveBeenCalledWith(minimalRequest);
    });

    it('should handle empty card list', async () => {
      const emptyResponse: ListCardsResponse = {
        cards: [],
        hasMore: false,
      };
      rainAdapter.listCards.mockResolvedValue(emptyResponse);

      const result = await adapter.listCards(mockRequest);

      expect(result.cards).toHaveLength(0);
      expect(result.hasMore).toBe(false);
      expect(result.nextCursor).toBeUndefined();
    });

    it('should handle listCards errors', async () => {
      const error = new Error('Failed to retrieve cards');
      rainAdapter.listCards.mockRejectedValue(error);

      await expect(adapter.listCards(mockRequest)).rejects.toThrow('Failed to retrieve cards');
      expect(rainAdapter.listCards).toHaveBeenCalledWith(mockRequest);
    });

    it('should handle invalid user ID errors', async () => {
      const error = new Error('User not found');
      rainAdapter.listCards.mockRejectedValue(error);

      await expect(adapter.listCards(mockRequest)).rejects.toThrow('User not found');
      expect(rainAdapter.listCards).toHaveBeenCalledWith(mockRequest);
    });

    it('should handle invalid parameters errors', async () => {
      const error = new Error('Invalid request parameters');
      rainAdapter.listCards.mockRejectedValue(error);

      await expect(adapter.listCards(mockRequest)).rejects.toThrow('Invalid request parameters');
      expect(rainAdapter.listCards).toHaveBeenCalledWith(mockRequest);
    });

    it('should return properly formatted card list response', async () => {
      rainAdapter.listCards.mockResolvedValue(mockResponse);

      const result = await adapter.listCards(mockRequest);

      // Verify response structure
      expect(result).toHaveProperty('cards');
      expect(result).toHaveProperty('nextCursor');
      expect(result).toHaveProperty('hasMore');

      // Verify cards array
      expect(Array.isArray(result.cards)).toBe(true);
      expect(result.cards).toHaveLength(2);

      // Verify first card structure
      const firstCard = result.cards[0];
      expect(firstCard).toHaveProperty('cardId');
      expect(firstCard).toHaveProperty('type');
      expect(firstCard).toHaveProperty('status');
      expect(firstCard).toHaveProperty('isActive');
      expect(firstCard).toHaveProperty('displayName');
      expect(firstCard).toHaveProperty('lastFourDigits');
      expect(firstCard).toHaveProperty('expiryMonth');
      expect(firstCard).toHaveProperty('expiryYear');
      expect(firstCard).toHaveProperty('limitAmount');
      expect(firstCard).toHaveProperty('limitFrequency');
      expect(firstCard).toHaveProperty('providerMetadata');

      // Verify pagination metadata
      expect(typeof result.nextCursor).toBe('string');
      expect(typeof result.hasMore).toBe('boolean');
    });

    it('should handle different card statuses', async () => {
      const statusFilterRequest: ListCardsRequest = {
        userId: 'user-123',
        status: CardStatus.NOT_ACTIVATED,
      };

      const statusFilterResponse: ListCardsResponse = {
        cards: [
          {
            ...mockCards[0],
            status: CardStatus.NOT_ACTIVATED,
            isActive: false,
          },
        ],
        hasMore: false,
      };

      rainAdapter.listCards.mockResolvedValue(statusFilterResponse);

      const result = await adapter.listCards(statusFilterRequest);

      expect(result.cards).toHaveLength(1);
      expect(result.cards[0].status).toBe(CardStatus.NOT_ACTIVATED);
      expect(result.cards[0].isActive).toBe(false);
    });
  });

  describe('updateCard', () => {
    const cardId = 'card-123';
    const mockUpdateCardRequest: UpdateCardRequest = {
      limit: {
        frequency: CardLimitFrequency.PER_30_DAY_PERIOD,
        amount: 4000,
      },
      firstName: 'John',
      lastName: 'Smith',
      status: CardStatus.LOCKED,
    };

    const mockResponse: CardResponse = {
      cardId: 'card-123',
      type: CardType.VIRTUAL,
      status: CardStatus.LOCKED,
      isActive: false,
      displayName: 'John Smith',
      lastFourDigits: '1234',
      expiryMonth: '12',
      expiryYear: '2025',
      limitAmount: 4000,
      limitFrequency: CardLimitFrequency.PER_30_DAY_PERIOD,
      providerMetadata: {
        companyId: 'rain-company-456',
        userId: 'rain-user-123',
      },
    };

    it('should successfully update card', async () => {
      rainAdapter.updateCard.mockResolvedValue(mockResponse);

      const result = await adapter.updateCard(cardId, mockUpdateCardRequest);

      expect(result).toEqual(mockResponse);
      expect(rainAdapter.updateCard).toHaveBeenCalledWith(cardId, mockUpdateCardRequest);
      expect(rainAdapter.updateCard).toHaveBeenCalledTimes(1);
    });

    it('should handle updateCard errors', async () => {
      const error = new Error('Card update failed');
      rainAdapter.updateCard.mockRejectedValue(error);

      await expect(adapter.updateCard(cardId, mockUpdateCardRequest)).rejects.toThrow('Card update failed');
      expect(rainAdapter.updateCard).toHaveBeenCalledWith(cardId, mockUpdateCardRequest);
    });
  });

  describe('updateCardPin', () => {
    const cardId = 'card-123';
    const pin = '1234';
    const mockResponse: UpdateCardPinResponse = {
      encryptedPin: 'encrypted-pin-data',
      encodedIv: 'encoded-iv-data',
    };

    it('should successfully update card PIN', async () => {
      rainAdapter.updateCardPin.mockResolvedValue(mockResponse);

      const result = await adapter.updateCardPin(cardId, pin);

      expect(result).toEqual(mockResponse);
      expect(rainAdapter.updateCardPin).toHaveBeenCalledWith(cardId, pin);
      expect(rainAdapter.updateCardPin).toHaveBeenCalledTimes(1);
    });

    it('should handle updateCardPin errors', async () => {
      const error = new Error('PIN update failed');
      rainAdapter.updateCardPin.mockRejectedValue(error);

      await expect(adapter.updateCardPin(cardId, pin)).rejects.toThrow('PIN update failed');
      expect(rainAdapter.updateCardPin).toHaveBeenCalledWith(cardId, pin);
    });
  });

  describe('getOccupations', () => {
    it('should fetch occupations from provider', async () => {
      const mockOccupations: Occupation[] = [{ name: 'Engineer', code: 'ENG' }];
      rainAdapter.getOccupations.mockResolvedValue(mockOccupations);

      const result = await adapter.getOccupations();

      expect(result).toEqual(mockOccupations);
      expect(rainAdapter.getOccupations).toHaveBeenCalledTimes(1);
    });
  });

  describe('createCharge', () => {
    const userId = 'user-123';
    const amount = 1000;
    const description = 'Test charge';
    const mockResponse = {
      providerRef: 'charge-123',
      createdAt: '2025-01-01T00:00:00Z',
      amount: 1000,
      description: 'Test charge',
    };

    it('should successfully create charge', async () => {
      rainAdapter.createCharge.mockResolvedValue(mockResponse);

      const result = await adapter.createCharge(userId, amount, description);

      expect(result).toEqual(mockResponse);
      expect(rainAdapter.createCharge).toHaveBeenCalledWith(userId, amount, description);
      expect(rainAdapter.createCharge).toHaveBeenCalledTimes(1);
    });

    it('should handle createCharge errors', async () => {
      const error = new Error('Charge creation failed');
      rainAdapter.createCharge.mockRejectedValue(error);

      await expect(adapter.createCharge(userId, amount, description)).rejects.toThrow('Charge creation failed');
      expect(rainAdapter.createCharge).toHaveBeenCalledWith(userId, amount, description);
    });
  });

  describe('getUserContracts', () => {
    const userId = 'user-abc';
    const mockContracts: RainContractResponse[] = [
      {
        id: 'contract-1',
        chainId: 11155111,
        programAddress: 'program',
        controllerAddress: 'controller',
        proxyAddress: 'proxy',
        depositAddress: 'deposit',
        tokens: [],
        contractVersion: 1,
      },
    ];

    it('should delegate fetching contracts to RainAdapter', async () => {
      rainAdapter.getUserContracts.mockResolvedValue(mockContracts);

      const result = await adapter.getUserContracts(userId);

      expect(result).toEqual(mockContracts);
      expect(rainAdapter.getUserContracts).toHaveBeenCalledWith(userId);
    });

    it('should throw when provider is not RainAdapter', async () => {
      const getProviderSpy = jest.spyOn(adapter as any, 'getProvider').mockReturnValue({} as any);

      await expect(adapter.getUserContracts(userId)).rejects.toThrow(
        'getUserContracts is only supported for Rain provider',
      );

      getProviderSpy.mockRestore();
    });
  });

  describe('createUserContract', () => {
    const userId = 'user-abc';
    const chainId = 8453;
    const mockContract: RainContractResponse = {
      id: 'contract-1',
      chainId,
      programAddress: 'program',
      controllerAddress: 'controller',
      proxyAddress: 'proxy',
      depositAddress: 'deposit',
      tokens: [],
      contractVersion: 1,
    };

    it('should delegate creation to RainAdapter', async () => {
      rainAdapter.createUserContract.mockResolvedValue(mockContract);

      const result = await adapter.createUserContract(userId, chainId);

      expect(result).toEqual(mockContract);
      expect(rainAdapter.createUserContract).toHaveBeenCalledWith(userId, chainId);
    });

    it('should throw when provider is not RainAdapter', async () => {
      const getProviderSpy = jest.spyOn(adapter as any, 'getProvider').mockReturnValue({} as any);

      await expect(adapter.createUserContract(userId, chainId)).rejects.toThrow(
        'createUserContract is only supported for Rain provider',
      );

      getProviderSpy.mockRestore();
    });
  });

  describe('createDispute', () => {
    const transactionId = 'txn-123';
    const textEvidence = 'Test evidence text';
    const mockDisputeResponse: RainDisputeResponse = {
      id: 'dispute-123',
      transactionId: 'txn-123',
      status: 'pending',
      createdAt: '2024-01-01T00:00:00Z',
      textEvidence: 'Test evidence text',
    };

    it('should delegate creation to RainAdapter', async () => {
      rainAdapter.createDispute.mockResolvedValue(mockDisputeResponse);

      const result = await adapter.createDispute(transactionId, textEvidence);

      expect(result).toEqual(mockDisputeResponse);
      expect(rainAdapter.createDispute).toHaveBeenCalledWith(transactionId, textEvidence);
      expect(rainAdapter.createDispute).toHaveBeenCalledTimes(1);
    });

    it('should delegate creation without textEvidence', async () => {
      const disputeResponseWithoutEvidence = {
        ...mockDisputeResponse,
        textEvidence: undefined,
      };
      rainAdapter.createDispute.mockResolvedValue(disputeResponseWithoutEvidence);

      const result = await adapter.createDispute(transactionId);

      expect(result).toEqual(disputeResponseWithoutEvidence);
      expect(rainAdapter.createDispute).toHaveBeenCalledWith(transactionId, undefined);
    });

    it('should throw when provider is not RainAdapter', async () => {
      const getProviderSpy = jest.spyOn(adapter as any, 'getProvider').mockReturnValue({} as any);

      await expect(adapter.createDispute(transactionId, textEvidence)).rejects.toThrow(
        'createDispute is only supported for Rain provider',
      );

      getProviderSpy.mockRestore();
    });

    it('should handle createDispute errors', async () => {
      const error = new Error('Dispute creation failed');
      rainAdapter.createDispute.mockRejectedValue(error);

      await expect(adapter.createDispute(transactionId, textEvidence)).rejects.toThrow('Dispute creation failed');
      expect(rainAdapter.createDispute).toHaveBeenCalledWith(transactionId, textEvidence);
    });
  });

  describe('getProvider', () => {
    it('should return RainAdapter when configured provider is rain', () => {
      expect(adapter.getProvider()).toBe(rainAdapter);
    });

    it('should throw when configured provider is unsupported', () => {
      const originalConfig = (adapter as any).cardConfig;
      (adapter as any).cardConfig = { default_card_provider: 'unsupported' };

      expect(() => adapter.getProvider()).toThrow('Unsupported card provider: unsupported');

      (adapter as any).cardConfig = originalConfig;
    });
  });

  describe('Integration tests', () => {
    it('should properly delegate all methods to RainAdapter', () => {
      const adapterMethods = [
        'createCardUser',
        'updateCardUser',
        'uploadCardUserDocument',
        'getCardApplicationStatus',
        'getUserBalance',
        'getPartnerBalance',
        'createCard',
        'getCardDetails',
        'getDecryptedCardSecrets',
        'getCardPin',
        'getProcessorDetails',
        'listCards',
        'updateCard',
        'updateCardPin',
      ];

      adapterMethods.forEach((method) => {
        expect(adapter[method]).toBeDefined();
        expect(typeof adapter[method]).toBe('function');
      });
      expect(adapter.createDispute).toBeDefined();
      expect(typeof adapter.createDispute).toBe('function');
    });

    it('should have proper dependency injection setup', () => {
      expect(adapter).toBeDefined();
      expect(rainAdapter).toBeDefined();
      // Check that the private rainAdapter property is properly injected
      expect((adapter as any).rainAdapter).toBe(rainAdapter);
    });
  });
});
