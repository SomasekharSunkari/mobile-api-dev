import { Test, TestingModule } from '@nestjs/testing';
import { RedisService } from '../../../../services/redis/redis.service';
import { NgToUsdExchangeEscrowService } from './ng-to-usd-exchange.escrow.service';

describe('NgToUsdExchangeEscrowService', () => {
  let service: NgToUsdExchangeEscrowService;
  let redisService: jest.Mocked<RedisService>;

  const mockRedisClient = {
    set: jest.fn(),
    get: jest.fn(),
    del: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NgToUsdExchangeEscrowService,
        {
          provide: RedisService,
          useValue: {
            getClient: jest.fn(() => mockRedisClient),
          },
        },
      ],
    }).compile();

    service = module.get<NgToUsdExchangeEscrowService>(NgToUsdExchangeEscrowService);
    redisService = module.get(RedisService);

    jest.clearAllMocks();
  });

  describe('getKey', () => {
    it('should generate correct key for transaction reference', () => {
      const result = service.getKey('txn-ref-123');
      expect(result).toBe('ng-to-usd-exchange:transaction-reference:txn-ref-123');
    });

    it('should handle special characters in transaction reference', () => {
      const result = service.getKey('txn:ref:special-123');
      expect(result).toBe('ng-to-usd-exchange:transaction-reference:txn:ref:special-123');
    });
  });

  describe('getCardFundingContextKey', () => {
    it('should generate correct key for card funding context', () => {
      const result = service.getCardFundingContextKey('txn-ref-456');
      expect(result).toBe('card_funding_context:txn-ref-456');
    });
  });

  describe('storeTransactionData', () => {
    it('should store transaction data in redis with 10 minute expiration', async () => {
      const transactionRef = 'txn-ref-123';
      const data = {
        amount: 10000,
        currency: 'NGN',
        userId: 'user-123',
      };

      await service.storeTransactionData(transactionRef, data);

      expect(redisService.getClient).toHaveBeenCalled();
      expect(mockRedisClient.set).toHaveBeenCalledWith(
        'ng-to-usd-exchange:transaction-reference:txn-ref-123',
        JSON.stringify(data),
        'EX',
        600,
      );
    });

    it('should handle complex nested data objects', async () => {
      const transactionRef = 'txn-ref-456';
      const data = {
        amount: 50000,
        currency: 'NGN',
        rate: {
          id: 'rate-123',
          value: 1600,
        },
        user: {
          id: 'user-123',
          email: 'test@example.com',
        },
      };

      await service.storeTransactionData(transactionRef, data);

      expect(mockRedisClient.set).toHaveBeenCalledWith(
        'ng-to-usd-exchange:transaction-reference:txn-ref-456',
        JSON.stringify(data),
        'EX',
        600,
      );
    });
  });

  describe('removeTransactionData', () => {
    it('should remove transaction data from redis', async () => {
      const transactionRef = 'txn-ref-123';

      await service.removeTransactionData(transactionRef);

      expect(redisService.getClient).toHaveBeenCalled();
      expect(mockRedisClient.del).toHaveBeenCalledWith('ng-to-usd-exchange:transaction-reference:txn-ref-123');
    });
  });

  describe('getTransactionData', () => {
    it('should return parsed transaction data when found', async () => {
      const transactionRef = 'txn-ref-123';
      const storedData = {
        amount: 10000,
        currency: 'NGN',
        userId: 'user-123',
      };

      mockRedisClient.get.mockResolvedValue(JSON.stringify(storedData));

      const result = await service.getTransactionData(transactionRef);

      expect(redisService.getClient).toHaveBeenCalled();
      expect(mockRedisClient.get).toHaveBeenCalledWith('ng-to-usd-exchange:transaction-reference:txn-ref-123');
      expect(result).toEqual(storedData);
    });

    it('should return null when transaction data not found', async () => {
      const transactionRef = 'txn-ref-not-found';
      mockRedisClient.get.mockResolvedValue(null);

      const result = await service.getTransactionData(transactionRef);

      expect(result).toBeNull();
    });

    it('should return null when redis returns empty string', async () => {
      const transactionRef = 'txn-ref-empty';
      mockRedisClient.get.mockResolvedValue('');

      const result = await service.getTransactionData(transactionRef);

      expect(result).toBeNull();
    });
  });

  describe('storeCardFundingContext', () => {
    it('should store card funding context in redis with 1 hour expiration', async () => {
      const transactionRef = 'txn-ref-123';
      const context = {
        cardId: 'card-123',
        cardUserId: 'card-user-123',
        userId: 'user-123',
        depositAddress: '0x123456789',
        usdAmountAfterExchange: 100.5,
        cardFeeUSD: 2.5,
        netUsdUserWillReceive: 98.0,
        rateId: 'rate-123',
        ngnAmount: 160000,
      };

      await service.storeCardFundingContext(transactionRef, context);

      expect(redisService.getClient).toHaveBeenCalled();
      expect(mockRedisClient.set).toHaveBeenCalledWith(
        'card_funding_context:txn-ref-123',
        JSON.stringify(context),
        'EX',
        3600,
      );
    });
  });

  describe('getCardFundingContext', () => {
    it('should return parsed card funding context when found', async () => {
      const transactionRef = 'txn-ref-123';
      const storedContext = {
        cardId: 'card-123',
        cardUserId: 'card-user-123',
        userId: 'user-123',
        depositAddress: '0x123456789',
        usdAmountAfterExchange: 100.5,
        cardFeeUSD: 2.5,
        netUsdUserWillReceive: 98.0,
        rateId: 'rate-123',
        ngnAmount: 160000,
      };

      mockRedisClient.get.mockResolvedValue(JSON.stringify(storedContext));

      const result = await service.getCardFundingContext(transactionRef);

      expect(redisService.getClient).toHaveBeenCalled();
      expect(mockRedisClient.get).toHaveBeenCalledWith('card_funding_context:txn-ref-123');
      expect(result).toEqual(storedContext);
    });

    it('should return null when card funding context not found', async () => {
      const transactionRef = 'txn-ref-not-found';
      mockRedisClient.get.mockResolvedValue(null);

      const result = await service.getCardFundingContext(transactionRef);

      expect(result).toBeNull();
    });
  });

  describe('updateCardFundingContext', () => {
    it('should update card funding context in redis', async () => {
      const transactionRef = 'txn-ref-123';
      const updatedContext = {
        cardId: 'card-123',
        cardUserId: 'card-user-123',
        userId: 'user-123',
        depositAddress: '0x123456789',
        usdAmountAfterExchange: 100.5,
        cardFeeUSD: 2.5,
        netUsdUserWillReceive: 98.0,
        rateId: 'rate-123',
        ngnAmount: 160000,
        cardTransactionId: 'card-txn-123', // Added after creation
      };

      await service.updateCardFundingContext(transactionRef, updatedContext);

      expect(redisService.getClient).toHaveBeenCalled();
      expect(mockRedisClient.set).toHaveBeenCalledWith(
        'card_funding_context:txn-ref-123',
        JSON.stringify(updatedContext),
        'EX',
        3600,
      );
    });
  });

  describe('removeCardFundingContext', () => {
    it('should remove card funding context from redis', async () => {
      const transactionRef = 'txn-ref-123';

      await service.removeCardFundingContext(transactionRef);

      expect(redisService.getClient).toHaveBeenCalled();
      expect(mockRedisClient.del).toHaveBeenCalledWith('card_funding_context:txn-ref-123');
    });
  });

  describe('TRANSACTION_REFERENCE_PREFIX constant', () => {
    it('should have correct prefix value', () => {
      expect(service.TRANSACTION_REFERENCE_PREFIX).toBe('ng-to-usd-exchange:transaction-reference');
    });
  });

  describe('CARD_FUNDING_CONTEXT_PREFIX constant', () => {
    it('should have correct prefix value', () => {
      expect(service.CARD_FUNDING_CONTEXT_PREFIX).toBe('card_funding_context');
    });
  });
});
