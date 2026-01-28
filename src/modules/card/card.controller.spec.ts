import { HttpStatus } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Observable, of } from 'rxjs';
import { UserModel } from '../../database/models/user/user.model';
import { StreamService } from '../../services/streams/stream.service';
import { RolesGuard } from '../auth/guard';
import { AccountDeactivationGuard } from '../auth/guard/accountDeactivationGuard/accountDeactivation.guard';
import { RegionalAccessGuard } from '../auth/guard/security-context.guard';
import { TransactionPinGuard } from '../auth/guard/transactionPinGuard/transactionPin.guard';
import { JwtAuthGuard } from '../auth/strategies/jwt-auth.guard';
import { CardController } from './card.controller';
import { CardService } from './card.service';
import { CardFundRails } from './dto/cardFund.dto';

describe('CardController', () => {
  let controller: CardController;
  let cardService: jest.Mocked<CardService>;
  let streamService: jest.Mocked<StreamService>;

  const mockUser = {
    id: 'user-123',
    first_name: 'John',
    last_name: 'Doe',
    email: 'john@example.com',
    phone_number: '+1234567890',
    country_id: 'US',
  } as UserModel;

  const mockCardUser = {
    id: 'card-user-123',
    user_id: 'user-123',
    provider_ref: 'provider-ref-123',
    status: 'approved',
  };

  const mockCard = {
    id: 'card-123',
    user_id: 'user-123',
    card_user_id: 'card-user-123',
    status: 'ACTIVE',
    limit: 1000,
    balance: 500,
  };

  const mockCardService = {
    getCardUser: jest.fn(),
    create: jest.fn(),
    getOccupations: jest.fn(),
    getCardLimitFrequencies: jest.fn(),
    getAllCardFees: jest.fn(),
    createCard: jest.fn(),
    getCardTransactions: jest.fn(),
    getCardTransaction: jest.fn(),
    createDispute: jest.fn(),
    getTransactionDisputeEligibility: jest.fn(),
    getCard: jest.fn(),
    fundCard: jest.fn(),
    initializeCardFundingFromNGN: jest.fn(),
    executeCardFundingFromNGN: jest.fn(),
    getCardDetails: jest.fn(),
    freezeOrUnfreezeCard: jest.fn(),
    adminBlockOrUnlockCard: jest.fn(),
    cancelCard: jest.fn(),
    reissueCard: jest.fn(),
    updateCardLimit: jest.fn(),
  };

  const mockStreamService = {
    getUserBalanceStream: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [CardController],
      providers: [
        { provide: CardService, useValue: mockCardService },
        { provide: StreamService, useValue: mockStreamService },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RegionalAccessGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(TransactionPinGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(AccountDeactivationGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<CardController>(CardController);
    cardService = module.get(CardService);
    streamService = module.get(StreamService);
  });

  describe('getCardUser', () => {
    it('should return card user successfully', async () => {
      cardService.getCardUser.mockResolvedValue(mockCardUser as any);

      const result = await controller.getCardUser(mockUser);

      expect(cardService.getCardUser).toHaveBeenCalledWith(mockUser);
      expect(result.message).toBe('Card user fetched successfully');
      expect(result.statusCode).toBe(HttpStatus.OK);
      expect(result.data).toEqual(mockCardUser);
    });
  });

  describe('create', () => {
    it('should create card user successfully', async () => {
      const createDto = { occupation_id: 'occ-123', terms_agreed: true };
      const ipAddress = '192.168.1.1';

      cardService.create.mockResolvedValue(mockCardUser as any);

      const result = await controller.create(mockUser, createDto as any, ipAddress);

      expect(cardService.create).toHaveBeenCalledWith(mockUser, createDto, ipAddress);
      expect(result.message).toBe('Card user created successfully');
      expect(result.statusCode).toBe(HttpStatus.CREATED);
    });
  });

  describe('getOccupations', () => {
    it('should return occupations list successfully', async () => {
      const mockOccupations = [
        { id: 'occ-1', name: 'Engineer' },
        { id: 'occ-2', name: 'Doctor' },
      ];

      cardService.getOccupations.mockResolvedValue(mockOccupations as any);

      const result = await controller.getOccupations();

      expect(cardService.getOccupations).toHaveBeenCalled();
      expect(result.message).toBe('Occupations fetched successfully');
      expect(result.data).toEqual(mockOccupations);
    });
  });

  describe('getCardLimitFrequencies', () => {
    it('should return card limit frequencies successfully', async () => {
      const mockFrequencies = [
        { key: 'daily', label: 'Daily' },
        { key: 'weekly', label: 'Weekly' },
        { key: 'monthly', label: 'Monthly' },
      ];

      (cardService.getCardLimitFrequencies as jest.Mock).mockResolvedValue(mockFrequencies);

      const result = await controller.getCardLimitFrequencies();

      expect(cardService.getCardLimitFrequencies).toHaveBeenCalled();
      expect(result.message).toBe('Card limit frequencies fetched successfully');
    });
  });

  describe('getCardFees', () => {
    it('should return card fees configuration successfully', async () => {
      const mockFees = {
        fiat_top_up: { percentage: 2.5 },
        crypto_top_up: { percentage: 1.5 },
      };

      cardService.getAllCardFees.mockReturnValue(mockFees as any);

      const result = await controller.getCardFees();

      expect(cardService.getAllCardFees).toHaveBeenCalled();
      expect(result.message).toBe('Card fees retrieved successfully');
      expect(result.data).toEqual(mockFees);
    });
  });

  describe('createCard', () => {
    it('should create card successfully', async () => {
      const createDto = { card_type: 'virtual', limit: 1000 };

      cardService.createCard.mockResolvedValue(mockCard as any);

      const result = await controller.createCard(mockUser, createDto as any);

      expect(cardService.createCard).toHaveBeenCalledWith(mockUser, createDto);
      expect(result.message).toBe('Card created successfully');
      expect(result.statusCode).toBe(HttpStatus.CREATED);
    });
  });

  describe('getCardTransactions', () => {
    it('should return card transactions successfully', async () => {
      const mockTransactions = [
        { id: 'txn-1', amount: 100 },
        { id: 'txn-2', amount: 200 },
      ];
      const query = { page: 1, limit: 10 };

      cardService.getCardTransactions.mockResolvedValue(mockTransactions as any);

      const result = await controller.getCardTransactions(mockUser, query as any);

      expect(cardService.getCardTransactions).toHaveBeenCalledWith(mockUser.id, query);
      expect(result.message).toBe('Card transactions retrieved successfully');
    });
  });

  describe('getCardTransaction', () => {
    it('should return single card transaction successfully', async () => {
      const mockTransaction = { id: 'txn-123', amount: 100 };

      cardService.getCardTransaction.mockResolvedValue(mockTransaction as any);

      const result = await controller.getCardTransaction(mockUser, 'txn-123');

      expect(cardService.getCardTransaction).toHaveBeenCalledWith('txn-123', mockUser.id);
      expect(result.message).toBe('Card transaction retrieved successfully');
    });
  });

  describe('createDispute', () => {
    it('should create dispute successfully', async () => {
      const createDisputeDto = { reason: 'unauthorized_transaction' };
      const mockDispute = { id: 'dispute-123', status: 'pending' };

      cardService.createDispute.mockResolvedValue(mockDispute as any);

      const result = await controller.createDispute(mockUser, 'txn-123', createDisputeDto as any);

      expect(cardService.createDispute).toHaveBeenCalledWith(mockUser, 'txn-123', createDisputeDto);
      expect(result.message).toBe('Dispute created successfully');
      expect(result.statusCode).toBe(HttpStatus.CREATED);
    });
  });

  describe('getTransactionDisputeEligibility', () => {
    it('should return dispute eligibility successfully', async () => {
      const mockEligibility = { eligible: true, reason: null };

      cardService.getTransactionDisputeEligibility.mockResolvedValue(mockEligibility as any);

      const result = await controller.getTransactionDisputeEligibility(mockUser, 'txn-123');

      expect(cardService.getTransactionDisputeEligibility).toHaveBeenCalledWith(mockUser, 'txn-123');
      expect(result.message).toBe('Dispute eligibility evaluated successfully');
    });
  });

  describe('getCard', () => {
    it('should return card successfully', async () => {
      cardService.getCard.mockResolvedValue(mockCard as any);

      const result = await controller.getCard(mockUser, 'card-123');

      expect(cardService.getCard).toHaveBeenCalledWith(mockUser, 'card-123');
      expect(result.message).toBe('Card fetched successfully');
    });
  });

  describe('fundCard', () => {
    it('should fund card successfully', async () => {
      const fundDto = { amount: 100, rail: CardFundRails.FIAT };
      const mockResult = { transaction_id: 'txn-123', status: 'processing' };

      cardService.fundCard.mockResolvedValue(mockResult as any);

      const result = await controller.fundCard(mockUser, 'card-123', fundDto as any);

      expect(cardService.fundCard).toHaveBeenCalledWith(mockUser, {
        ...fundDto,
        card_id: 'card-123',
      });
      expect(result.message).toBe('Card funding initiated successfully');
    });
  });

  describe('initializeCardFundingFromNGN', () => {
    it('should initialize card funding from NGN successfully', async () => {
      const initDto = { amount: 160000, rate_id: 'rate-123' };
      const mockResult = {
        transaction_id: 'txn-ref-123',
        usd_amount_after_exchange: 100,
        card_fee_usd: 2.5,
        net_usd_you_will_receive: 97.5,
      };

      cardService.initializeCardFundingFromNGN.mockResolvedValue(mockResult);

      const result = await controller.initializeCardFundingFromNGN(mockUser, 'card-123', initDto as any);

      expect(cardService.initializeCardFundingFromNGN).toHaveBeenCalledWith(mockUser, 'card-123', initDto);
      expect(result.message).toBe('Card funding initialization successful');
      expect(result.data).toEqual(mockResult);
    });
  });

  describe('executeCardFundingFromNGN', () => {
    it('should execute card funding from NGN successfully', async () => {
      const execDto = { transaction_id: 'txn-ref-123', transaction_pin: '123456' };
      const mockResult = {
        transaction_id: 'card-txn-123',
        exchange_transaction_id: 'txn-ref-123',
        status: 'processing',
      };

      cardService.executeCardFundingFromNGN.mockResolvedValue(mockResult);

      const result = await controller.executeCardFundingFromNGN(mockUser, 'card-123', execDto as any);

      expect(cardService.executeCardFundingFromNGN).toHaveBeenCalledWith(mockUser, 'card-123', execDto);
      expect(result.message).toBe('Card funding execution initiated');
      expect(result.data).toEqual(mockResult);
    });
  });

  describe('getCardDetails', () => {
    it('should return card details successfully', async () => {
      const mockDetails = { pan: '4111111111111111', cvv: '123', expiry: '12/26' };

      cardService.getCardDetails.mockResolvedValue(mockDetails as any);

      const result = await controller.getCardDetails(mockUser, 'card-123');

      expect(cardService.getCardDetails).toHaveBeenCalledWith(mockUser, 'card-123');
      expect(result.message).toBe('Card details retrieved successfully');
    });
  });

  describe('freezeOrUnfreezeCard', () => {
    it('should freeze card successfully', async () => {
      const freezeDto = { freeze: true };
      const mockResult = { id: 'card-123', status: 'LOCKED' };

      cardService.freezeOrUnfreezeCard.mockResolvedValue(mockResult as any);

      const result = await controller.freezeOrUnfreezeCard(mockUser, 'card-123', freezeDto as any);

      expect(cardService.freezeOrUnfreezeCard).toHaveBeenCalledWith(mockUser, 'card-123', freezeDto);
      expect(result.message).toBe('Card frozen successfully');
    });

    it('should unfreeze card successfully', async () => {
      const unfreezeDto = { freeze: false };
      const mockResult = { id: 'card-123', status: 'ACTIVE' };

      cardService.freezeOrUnfreezeCard.mockResolvedValue(mockResult as any);

      const result = await controller.freezeOrUnfreezeCard(mockUser, 'card-123', unfreezeDto as any);

      expect(cardService.freezeOrUnfreezeCard).toHaveBeenCalledWith(mockUser, 'card-123', unfreezeDto);
      expect(result.message).toBe('Card unfrozen successfully');
    });
  });

  describe('adminBlockOrUnlockCard', () => {
    it('should block card successfully', async () => {
      const blockDto = { block: true, reason: 'suspicious_activity' };
      const mockResult = { id: 'card-123', status: 'BLOCKED' };

      cardService.adminBlockOrUnlockCard.mockResolvedValue(mockResult as any);

      const result = await controller.adminBlockOrUnlockCard('card-123', blockDto as any);

      expect(cardService.adminBlockOrUnlockCard).toHaveBeenCalledWith('card-123', blockDto);
      expect(result.message).toBe('Card blocked successfully');
    });

    it('should unlock card successfully', async () => {
      const unlockDto = { block: false };
      const mockResult = { id: 'card-123', status: 'ACTIVE' };

      cardService.adminBlockOrUnlockCard.mockResolvedValue(mockResult as any);

      const result = await controller.adminBlockOrUnlockCard('card-123', unlockDto as any);

      expect(cardService.adminBlockOrUnlockCard).toHaveBeenCalledWith('card-123', unlockDto);
      expect(result.message).toBe('Card unlocked successfully');
    });
  });

  describe('cancelCard', () => {
    it('should cancel card successfully', async () => {
      const mockResult = { id: 'card-123', status: 'CANCELED' };

      cardService.cancelCard.mockResolvedValue(mockResult as any);

      const result = await controller.cancelCard(mockUser, 'card-123');

      expect(cardService.cancelCard).toHaveBeenCalledWith(mockUser, 'card-123');
      expect(result.message).toBe('Card canceled successfully');
    });
  });

  describe('reissueCard', () => {
    it('should reissue card successfully', async () => {
      const reissueDto = { card_type: 'virtual' };
      const mockResult = { id: 'new-card-123', status: 'ACTIVE' };

      cardService.reissueCard.mockResolvedValue(mockResult as any);

      const result = await controller.reissueCard(mockUser, 'card-123', reissueDto as any);

      expect(cardService.reissueCard).toHaveBeenCalledWith(mockUser, 'card-123', reissueDto);
      expect(result.message).toBe('Card re-issued successfully');
      expect(result.statusCode).toBe(HttpStatus.CREATED);
    });
  });

  describe('updateCardLimit', () => {
    it('should update card limit successfully', async () => {
      const updateDto = { limit: 2000, frequency: 'monthly' };
      const mockResult = { id: 'card-123', limit: 2000 };

      cardService.updateCardLimit.mockResolvedValue(mockResult as any);

      const result = await controller.updateCardLimit(mockUser, 'card-123', updateDto as any);

      expect(cardService.updateCardLimit).toHaveBeenCalledWith(mockUser, 'card-123', updateDto);
      expect(result.message).toBe('Card limit updated successfully');
    });
  });

  describe('streamBalanceUpdates', () => {
    it('should return observable for balance stream', () => {
      const mockObservable = of({ data: { balance: 500 } }) as Observable<any>;

      streamService.getUserBalanceStream.mockReturnValue(mockObservable);

      const result = controller.streamBalanceUpdates(mockUser);

      expect(streamService.getUserBalanceStream).toHaveBeenCalledWith(mockUser.id);
      expect(result).toBe(mockObservable);
    });
  });
});
