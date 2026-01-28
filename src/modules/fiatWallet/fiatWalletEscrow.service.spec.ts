import { Test, TestingModule } from '@nestjs/testing';
import { RedisService } from '../../services/redis/redis.service';
import { FiatWalletEscrowService } from './fiatWalletEscrow.service';

describe('FiatWalletEscrowService', () => {
  let service: FiatWalletEscrowService;

  const mockRedisClient = {
    set: jest.fn(),
    del: jest.fn(),
    get: jest.fn(),
  };

  const mockRedisService = {
    getClient: jest.fn().mockReturnValue(mockRedisClient),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FiatWalletEscrowService,
        {
          provide: RedisService,
          useValue: mockRedisService,
        },
      ],
    }).compile();

    service = module.get<FiatWalletEscrowService>(FiatWalletEscrowService);

    jest.spyOn(service['logger'], 'debug').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('moveMoneyToEscrow', () => {
    it('should store the escrow amount in redis with correct key', async () => {
      const transactionId = 'txn-123';
      const amount = 500;

      mockRedisClient.set.mockResolvedValue('OK');

      await service.moveMoneyToEscrow(transactionId, amount);

      expect(mockRedisClient.set).toHaveBeenCalledWith(
        `fiat-wallet:transaction:${transactionId}:escrow:amount`,
        amount,
      );
    });

    it('should handle zero amount', async () => {
      const transactionId = 'txn-456';
      const amount = 0;

      mockRedisClient.set.mockResolvedValue('OK');

      await service.moveMoneyToEscrow(transactionId, amount);

      expect(mockRedisClient.set).toHaveBeenCalledWith(`fiat-wallet:transaction:${transactionId}:escrow:amount`, 0);
    });

    it('should handle decimal amounts', async () => {
      const transactionId = 'txn-789';
      const amount = 123.45;

      mockRedisClient.set.mockResolvedValue('OK');

      await service.moveMoneyToEscrow(transactionId, amount);

      expect(mockRedisClient.set).toHaveBeenCalledWith(
        `fiat-wallet:transaction:${transactionId}:escrow:amount`,
        123.45,
      );
    });

    it('should handle large amounts', async () => {
      const transactionId = 'txn-large';
      const amount = 999999999.99;

      mockRedisClient.set.mockResolvedValue('OK');

      await service.moveMoneyToEscrow(transactionId, amount);

      expect(mockRedisClient.set).toHaveBeenCalledWith(
        `fiat-wallet:transaction:${transactionId}:escrow:amount`,
        999999999.99,
      );
    });
  });

  describe('releaseMoneyFromEscrow', () => {
    it('should delete the escrow entry from redis', async () => {
      const transactionId = 'txn-123';

      mockRedisClient.del.mockResolvedValue(1);

      await service.releaseMoneyFromEscrow(transactionId);

      expect(mockRedisClient.del).toHaveBeenCalledWith(`fiat-wallet:transaction:${transactionId}:escrow:amount`);
    });

    it('should handle non-existent escrow entry', async () => {
      const transactionId = 'txn-not-found';

      mockRedisClient.del.mockResolvedValue(0);

      await service.releaseMoneyFromEscrow(transactionId);

      expect(mockRedisClient.del).toHaveBeenCalledWith(`fiat-wallet:transaction:${transactionId}:escrow:amount`);
    });
  });

  describe('getEscrowAmount', () => {
    it('should return the escrow amount as a number', async () => {
      const transactionId = 'txn-123';

      mockRedisClient.get.mockResolvedValue('500');

      const result = await service.getEscrowAmount(transactionId);

      expect(mockRedisClient.get).toHaveBeenCalledWith(`fiat-wallet:transaction:${transactionId}:escrow:amount`);
      expect(result).toBe(500);
    });

    it('should return 0 when escrow amount does not exist', async () => {
      const transactionId = 'txn-not-found';

      mockRedisClient.get.mockResolvedValue(null);

      const result = await service.getEscrowAmount(transactionId);

      expect(mockRedisClient.get).toHaveBeenCalledWith(`fiat-wallet:transaction:${transactionId}:escrow:amount`);
      expect(result).toBe(0);
    });

    it('should return 0 when escrow amount is empty string', async () => {
      const transactionId = 'txn-empty';

      mockRedisClient.get.mockResolvedValue('');

      const result = await service.getEscrowAmount(transactionId);

      expect(result).toBe(0);
    });

    it('should correctly parse decimal amounts', async () => {
      const transactionId = 'txn-decimal';

      mockRedisClient.get.mockResolvedValue('123.45');

      const result = await service.getEscrowAmount(transactionId);

      expect(result).toBe(123.45);
    });

    it('should correctly parse large amounts', async () => {
      const transactionId = 'txn-large';

      mockRedisClient.get.mockResolvedValue('999999999.99');

      const result = await service.getEscrowAmount(transactionId);

      expect(result).toBe(999999999.99);
    });
  });

  describe('escrow workflow', () => {
    it('should complete full escrow lifecycle', async () => {
      const transactionId = 'txn-workflow';
      const amount = 1000;

      mockRedisClient.set.mockResolvedValue('OK');
      mockRedisClient.get.mockResolvedValue('1000');
      mockRedisClient.del.mockResolvedValue(1);

      // Move money to escrow
      await service.moveMoneyToEscrow(transactionId, amount);
      expect(mockRedisClient.set).toHaveBeenCalledWith(
        `fiat-wallet:transaction:${transactionId}:escrow:amount`,
        amount,
      );

      // Get escrow amount
      const escrowAmount = await service.getEscrowAmount(transactionId);
      expect(escrowAmount).toBe(1000);

      // Release money from escrow
      await service.releaseMoneyFromEscrow(transactionId);
      expect(mockRedisClient.del).toHaveBeenCalledWith(`fiat-wallet:transaction:${transactionId}:escrow:amount`);
    });
  });
});
