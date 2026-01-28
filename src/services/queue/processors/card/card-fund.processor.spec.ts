import { Test, TestingModule } from '@nestjs/testing';
import { Job } from 'bullmq';
import { EnvironmentService } from '../../../../config/environment/environment.service';
import { UserModel } from '../../../../database/models/user/user.model';
import { BlockchainWalletService } from '../../../../modules/blockchainWallet/blockchainWallet.service';
import { CardFundRails } from '../../../../modules/card/dto/cardFund.dto';
import { CardTransactionRepository } from '../../../../modules/card/repository/cardTransaction.repository';
import { DepositAddressService } from '../../../../modules/depositAddress/depositAddress.service';
import { FiatWalletService } from '../../../../modules/fiatWallet/fiatWallet.service';
import { FiatWalletWithdrawalService } from '../../../../modules/fiatWallet/fiatWalletWithdrawal.service';
import { QueueService } from '../../queue.service';
import { CardFundingJobData, CardFundingProcessor } from './card-fund.processor';

jest.mock('../../../../database/models/user/user.model', () => ({
  UserModel: {
    query: jest.fn(),
  },
}));

describe('CardFundingProcessor', () => {
  let processor: CardFundingProcessor;
  let queueService: jest.Mocked<QueueService>;
  let cardTransactionRepository: jest.Mocked<CardTransactionRepository>;
  let depositAddressService: jest.Mocked<DepositAddressService>;
  let fiatWalletService: jest.Mocked<FiatWalletService>;
  let fiatWalletWithdrawalService: jest.Mocked<FiatWalletWithdrawalService>;
  let blockchainWalletService: jest.Mocked<BlockchainWalletService>;

  const mockJobData: CardFundingJobData = {
    cardTransactionId: 'txn-123',
    userId: 'user-123',
    cardId: 'card-123',
    amount: 100,
    fee: 5,
    rail: CardFundRails.FIAT,
  };

  const mockUser = {
    id: 'user-123',
    email: 'test@example.com',
  };

  const mockDepositAddress = {
    id: 'deposit-123',
    user_id: 'user-123',
    address: '0x1234567890abcdef',
    provider: 'rain',
    asset: 'ethereum',
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CardFundingProcessor,
        {
          provide: QueueService,
          useValue: {
            processJobs: jest.fn(),
            addJob: jest.fn(),
          },
        },
        {
          provide: CardTransactionRepository,
          useValue: {
            update: jest.fn(),
          },
        },
        {
          provide: DepositAddressService,
          useValue: {
            getRainDepositAddressForDefaultChain: jest.fn(),
          },
        },
        {
          provide: FiatWalletService,
          useValue: {
            getUserWallet: jest.fn(),
          },
        },
        {
          provide: FiatWalletWithdrawalService,
          useValue: {
            transferUSDToRainDepositAddress: jest.fn(),
          },
        },
        {
          provide: BlockchainWalletService,
          useValue: {
            initiateTransaction: jest.fn(),
            sendFromMasterVaultToAddress: jest.fn(),
          },
        },
      ],
    }).compile();

    processor = module.get<CardFundingProcessor>(CardFundingProcessor);
    queueService = module.get(QueueService) as jest.Mocked<QueueService>;
    cardTransactionRepository = module.get(CardTransactionRepository) as jest.Mocked<CardTransactionRepository>;
    depositAddressService = module.get(DepositAddressService) as jest.Mocked<DepositAddressService>;
    fiatWalletService = module.get(FiatWalletService) as jest.Mocked<FiatWalletService>;
    fiatWalletWithdrawalService = module.get(FiatWalletWithdrawalService) as jest.Mocked<FiatWalletWithdrawalService>;
    blockchainWalletService = module.get(BlockchainWalletService) as jest.Mocked<BlockchainWalletService>;

    jest.clearAllMocks();
  });

  afterEach(() => {
    (processor as any).ENABLE_FIAT_RAIL_BLOCKCHAIN_MIRROR = false;
    jest.restoreAllMocks();
  });

  describe('queueCardFunding', () => {
    it('should queue card funding job successfully', async () => {
      const mockJob = { id: 'job-123' } as Job<CardFundingJobData>;
      queueService.addJob.mockResolvedValue(mockJob);

      const result = await processor.queueCardFunding(mockJobData);

      expect(result).toEqual(mockJob);
      expect(queueService.processJobs).toHaveBeenCalled();
      expect(queueService.addJob).toHaveBeenCalledWith(
        'card-funding',
        'card-funding',
        mockJobData,
        expect.objectContaining({
          attempts: 3,
          backoff: expect.objectContaining({
            type: 'exponential',
            delay: 2000,
          }),
        }),
      );
    });

    it('should only register processors once on multiple calls', async () => {
      const mockJob = { id: 'job-123' } as Job<CardFundingJobData>;
      queueService.addJob.mockResolvedValue(mockJob);

      await processor.queueCardFunding(mockJobData);
      await processor.queueCardFunding(mockJobData);
      await processor.queueCardFunding(mockJobData);

      expect(queueService.processJobs).toHaveBeenCalledTimes(1);
    });
  });

  describe('processCardFunding - FIAT rail', () => {
    let mockJob: jest.Mocked<Job<CardFundingJobData>>;

    beforeEach(() => {
      mockJob = {
        data: mockJobData,
        updateProgress: jest.fn().mockResolvedValue(undefined),
      } as any;

      (UserModel.query as jest.Mock).mockReturnValue({
        findById: jest.fn().mockResolvedValue(mockUser),
      });
    });

    it('should process fiat funding successfully', async () => {
      depositAddressService.getRainDepositAddressForDefaultChain.mockResolvedValue(mockDepositAddress as any);
      fiatWalletService.getUserWallet.mockResolvedValue({ balance: 10500 } as any);
      fiatWalletWithdrawalService.transferUSDToRainDepositAddress.mockResolvedValue({
        senderTransactionId: 'sender-txn-123',
      } as any);

      const result = await (processor as any).processCardFunding(mockJob);

      expect(result.status).toBe('completed');
      expect(depositAddressService.getRainDepositAddressForDefaultChain).toHaveBeenCalled();
      expect(fiatWalletService.getUserWallet).toHaveBeenCalledWith('user-123', 'USD');
      expect(fiatWalletWithdrawalService.transferUSDToRainDepositAddress).toHaveBeenCalledWith(
        mockUser,
        expect.objectContaining({
          amount: 100,
          fee: 5,
          asset: 'USD',
          rain_deposit_address: mockDepositAddress.address,
        }),
      );
      expect(mockJob.updateProgress).toHaveBeenCalledWith(10);
      expect(mockJob.updateProgress).toHaveBeenCalledWith(25);
      expect(mockJob.updateProgress).toHaveBeenCalledWith(50);
      expect(mockJob.updateProgress).toHaveBeenCalledWith(100);
    });

    it('should pass cardLastFourDigits to transferUSDToRainDepositAddress when provided', async () => {
      const mockJobWithCardDigits = {
        ...mockJob,
        data: { ...mockJobData, cardLastFourDigits: '6890' },
      };
      depositAddressService.getRainDepositAddressForDefaultChain.mockResolvedValue(mockDepositAddress as any);
      fiatWalletService.getUserWallet.mockResolvedValue({ balance: 10500 } as any);
      fiatWalletWithdrawalService.transferUSDToRainDepositAddress.mockResolvedValue({
        senderTransactionId: 'sender-txn-123',
      } as any);

      await (processor as any).processCardFunding(mockJobWithCardDigits);

      expect(fiatWalletWithdrawalService.transferUSDToRainDepositAddress).toHaveBeenCalledWith(
        mockUser,
        expect.objectContaining({
          amount: 100,
          fee: 5,
          asset: 'USD',
          rain_deposit_address: mockDepositAddress.address,
          card_last_four_digits: '6890',
        }),
      );
    });

    it('should not pass cardLastFourDigits when not provided', async () => {
      depositAddressService.getRainDepositAddressForDefaultChain.mockResolvedValue(mockDepositAddress as any);
      fiatWalletService.getUserWallet.mockResolvedValue({ balance: 10500 } as any);
      fiatWalletWithdrawalService.transferUSDToRainDepositAddress.mockResolvedValue({
        senderTransactionId: 'sender-txn-123',
      } as any);

      await (processor as any).processCardFunding(mockJob);

      const callArgs = fiatWalletWithdrawalService.transferUSDToRainDepositAddress.mock.calls[0][1];
      expect(callArgs.card_last_four_digits).toBeUndefined();
    });

    it('should process fiat funding with blockchain mirror in staging/dev', async () => {
      jest.spyOn(EnvironmentService, 'isStaging').mockReturnValue(true);
      jest.spyOn(EnvironmentService, 'isDevelopment').mockReturnValue(false);

      depositAddressService.getRainDepositAddressForDefaultChain.mockResolvedValue(mockDepositAddress as any);
      fiatWalletService.getUserWallet.mockResolvedValue({ balance: 10500 } as any);
      fiatWalletWithdrawalService.transferUSDToRainDepositAddress.mockResolvedValue({
        senderTransactionId: 'sender-txn-123',
      } as any);
      blockchainWalletService.sendFromMasterVaultToAddress.mockResolvedValue({
        transactionId: 'blockchain-mirror-txn-123',
      } as any);

      const result = await (processor as any).processCardFunding(mockJob);

      expect(result.status).toBe('completed');
      expect(fiatWalletWithdrawalService.transferUSDToRainDepositAddress).toHaveBeenCalledWith(
        mockUser,
        expect.objectContaining({
          amount: 100,
          fee: 5,
          asset: 'USD',
          rain_deposit_address: mockDepositAddress.address,
        }),
      );
      const mirrorEnabled = (processor as any).ENABLE_FIAT_RAIL_BLOCKCHAIN_MIRROR;
      if (mirrorEnabled) {
        expect(blockchainWalletService.sendFromMasterVaultToAddress).toHaveBeenCalledWith(
          expect.objectContaining({
            amount: 105,
            destinationAddress: mockDepositAddress.address,
            idempotencyKey: expect.stringMatching(/^cf-fiat-[a-f0-9]{16}$/),
          }),
        );
        expect(mockJob.updateProgress).toHaveBeenCalledWith(75);
      } else {
        expect(blockchainWalletService.sendFromMasterVaultToAddress).not.toHaveBeenCalled();
      }
    });

    it('should process fiat funding with blockchain mirror in development', async () => {
      jest.spyOn(EnvironmentService, 'isStaging').mockReturnValue(false);
      jest.spyOn(EnvironmentService, 'isDevelopment').mockReturnValue(true);

      depositAddressService.getRainDepositAddressForDefaultChain.mockResolvedValue(mockDepositAddress as any);
      fiatWalletService.getUserWallet.mockResolvedValue({ balance: 10500 } as any);
      fiatWalletWithdrawalService.transferUSDToRainDepositAddress.mockResolvedValue({
        senderTransactionId: 'sender-txn-123',
      } as any);
      blockchainWalletService.sendFromMasterVaultToAddress.mockResolvedValue({
        transactionId: 'blockchain-mirror-txn-123',
      } as any);

      const result = await (processor as any).processCardFunding(mockJob);

      expect(result.status).toBe('completed');
      const mirrorEnabled = (processor as any).ENABLE_FIAT_RAIL_BLOCKCHAIN_MIRROR;
      if (mirrorEnabled) {
        expect(blockchainWalletService.sendFromMasterVaultToAddress).toHaveBeenCalled();
      } else {
        expect(blockchainWalletService.sendFromMasterVaultToAddress).not.toHaveBeenCalled();
      }
    });

    it('should not process blockchain mirror in production', async () => {
      jest.spyOn(EnvironmentService, 'isStaging').mockReturnValue(false);
      jest.spyOn(EnvironmentService, 'isDevelopment').mockReturnValue(false);

      depositAddressService.getRainDepositAddressForDefaultChain.mockResolvedValue(mockDepositAddress as any);
      fiatWalletService.getUserWallet.mockResolvedValue({ balance: 10500 } as any);
      fiatWalletWithdrawalService.transferUSDToRainDepositAddress.mockResolvedValue({
        senderTransactionId: 'sender-txn-123',
      } as any);

      const result = await (processor as any).processCardFunding(mockJob);

      expect(result.status).toBe('completed');
      expect(blockchainWalletService.sendFromMasterVaultToAddress).not.toHaveBeenCalled();
    });

    it('should process blockchain mirror when ENABLE_FIAT_RAIL_BLOCKCHAIN_MIRROR is true and isStaging is true', async () => {
      (processor as any).ENABLE_FIAT_RAIL_BLOCKCHAIN_MIRROR = true;
      jest.spyOn(EnvironmentService, 'isStaging').mockReturnValue(true);
      jest.spyOn(EnvironmentService, 'isDevelopment').mockReturnValue(false);

      depositAddressService.getRainDepositAddressForDefaultChain.mockResolvedValue(mockDepositAddress as any);
      fiatWalletService.getUserWallet.mockResolvedValue({ balance: 10500 } as any);
      fiatWalletWithdrawalService.transferUSDToRainDepositAddress.mockResolvedValue({
        senderTransactionId: 'sender-txn-123',
      } as any);
      blockchainWalletService.sendFromMasterVaultToAddress.mockResolvedValue({
        transactionId: 'blockchain-mirror-txn-123',
      } as any);

      const result = await (processor as any).processCardFunding(mockJob);

      expect(result.status).toBe('completed');
      expect(blockchainWalletService.sendFromMasterVaultToAddress).toHaveBeenCalledWith(
        expect.objectContaining({
          amount: 105,
          destinationAddress: mockDepositAddress.address,
          idempotencyKey: expect.stringMatching(/^cf-fiat-[a-f0-9]{16}$/),
          assetId: 'USDC_BASECHAIN_ETH_TEST5_8SH8',
        }),
      );
      expect(mockJob.updateProgress).toHaveBeenCalledWith(75);
    });

    it('should process blockchain mirror when ENABLE_FIAT_RAIL_BLOCKCHAIN_MIRROR is true and isDevelopment is true', async () => {
      (processor as any).ENABLE_FIAT_RAIL_BLOCKCHAIN_MIRROR = true;
      jest.spyOn(EnvironmentService, 'isStaging').mockReturnValue(false);
      jest.spyOn(EnvironmentService, 'isDevelopment').mockReturnValue(true);

      depositAddressService.getRainDepositAddressForDefaultChain.mockResolvedValue(mockDepositAddress as any);
      fiatWalletService.getUserWallet.mockResolvedValue({ balance: 10500 } as any);
      fiatWalletWithdrawalService.transferUSDToRainDepositAddress.mockResolvedValue({
        senderTransactionId: 'sender-txn-123',
      } as any);
      blockchainWalletService.sendFromMasterVaultToAddress.mockResolvedValue({
        transactionId: 'blockchain-mirror-txn-123',
      } as any);

      const result = await (processor as any).processCardFunding(mockJob);

      expect(result.status).toBe('completed');
      expect(blockchainWalletService.sendFromMasterVaultToAddress).toHaveBeenCalledWith(
        expect.objectContaining({
          amount: 105,
          destinationAddress: mockDepositAddress.address,
          idempotencyKey: expect.stringMatching(/^cf-fiat-[a-f0-9]{16}$/),
          assetId: 'USDC_BASECHAIN_ETH_TEST5_8SH8',
        }),
      );
      expect(mockJob.updateProgress).toHaveBeenCalledWith(75);
    });

    it('should not process blockchain mirror when ENABLE_FIAT_RAIL_BLOCKCHAIN_MIRROR is true but both staging and development are false', async () => {
      (processor as any).ENABLE_FIAT_RAIL_BLOCKCHAIN_MIRROR = true;
      jest.spyOn(EnvironmentService, 'isStaging').mockReturnValue(false);
      jest.spyOn(EnvironmentService, 'isDevelopment').mockReturnValue(false);

      depositAddressService.getRainDepositAddressForDefaultChain.mockResolvedValue(mockDepositAddress as any);
      fiatWalletService.getUserWallet.mockResolvedValue({ balance: 10500 } as any);
      fiatWalletWithdrawalService.transferUSDToRainDepositAddress.mockResolvedValue({
        senderTransactionId: 'sender-txn-123',
      } as any);

      const result = await (processor as any).processCardFunding(mockJob);

      expect(result.status).toBe('completed');
      expect(blockchainWalletService.sendFromMasterVaultToAddress).not.toHaveBeenCalled();
    });

    it('should truncate idempotency key when it exceeds 40 characters for fiat rail', async () => {
      const longTransactionId = 'a'.repeat(100);
      const mockJobWithLongId = {
        ...mockJob,
        data: { ...mockJob.data, cardTransactionId: longTransactionId },
      };

      jest.spyOn(EnvironmentService, 'isStaging').mockReturnValue(true);
      depositAddressService.getRainDepositAddressForDefaultChain.mockResolvedValue(mockDepositAddress as any);
      fiatWalletService.getUserWallet.mockResolvedValue({ balance: 10500 } as any);
      fiatWalletWithdrawalService.transferUSDToRainDepositAddress.mockResolvedValue({
        senderTransactionId: 'sender-txn-123',
      } as any);
      blockchainWalletService.sendFromMasterVaultToAddress.mockResolvedValue({
        transactionId: 'blockchain-mirror-txn-123',
      } as any);

      await (processor as any).processCardFunding(mockJobWithLongId);

      const mirrorEnabled = (processor as any).ENABLE_FIAT_RAIL_BLOCKCHAIN_MIRROR;
      if (mirrorEnabled) {
        const callArgs = blockchainWalletService.sendFromMasterVaultToAddress.mock.calls[0][0];
        expect(callArgs.idempotencyKey.length).toBeLessThanOrEqual(40);
      } else {
        expect(blockchainWalletService.sendFromMasterVaultToAddress).not.toHaveBeenCalled();
      }
    });

    it('should throw error if user not found', async () => {
      (UserModel.query as jest.Mock).mockReturnValue({
        findById: jest.fn().mockResolvedValue(null),
      });

      await expect((processor as any).processCardFunding(mockJob)).rejects.toThrow('User not found');
    });

    it('should throw error if deposit address not found', async () => {
      depositAddressService.getRainDepositAddressForDefaultChain.mockResolvedValue(null);

      await expect((processor as any).processCardFunding(mockJob)).rejects.toThrow(
        'No Rain deposit address found for user',
      );
    });

    it('should throw error if insufficient balance', async () => {
      depositAddressService.getRainDepositAddressForDefaultChain.mockResolvedValue(mockDepositAddress as any);
      fiatWalletService.getUserWallet.mockResolvedValue({ balance: 50 } as any);

      await expect((processor as any).processCardFunding(mockJob)).rejects.toThrow(
        'Insufficient balance in USD fiat wallet',
      );
    });
  });

  describe('processCardFunding - BLOCKCHAIN rail', () => {
    let mockJob: jest.Mocked<Job<CardFundingJobData>>;

    beforeEach(() => {
      mockJob = {
        data: { ...mockJobData, rail: CardFundRails.BLOCKCHAIN },
        updateProgress: jest.fn().mockResolvedValue(undefined),
      } as any;

      (UserModel.query as jest.Mock).mockReturnValue({
        findById: jest.fn().mockResolvedValue(mockUser),
      });
    });

    it('should process blockchain funding successfully', async () => {
      depositAddressService.getRainDepositAddressForDefaultChain.mockResolvedValue(mockDepositAddress as any);
      blockchainWalletService.initiateTransaction.mockResolvedValue({
        transactionId: 'blockchain-txn-123',
      } as any);

      const result = await (processor as any).processCardFunding(mockJob);

      expect(result.status).toBe('completed');
      expect(blockchainWalletService.initiateTransaction).toHaveBeenCalledWith(
        mockUser,
        expect.objectContaining({
          type: 'external',
          asset_id: 'USDC_ETH_TEST5_0GER',
          amount: 105,
          peer_address: mockDepositAddress.address,
          idempotencyKey: expect.stringMatching(/^cf-bc-[a-f0-9]{16}$/),
        }),
      );
      expect(mockJob.updateProgress).toHaveBeenCalledWith(10);
      expect(mockJob.updateProgress).toHaveBeenCalledWith(25);
      expect(mockJob.updateProgress).toHaveBeenCalledWith(50);
      expect(mockJob.updateProgress).toHaveBeenCalledWith(100);
    });

    it('should use correct idempotency key format for blockchain rail', async () => {
      depositAddressService.getRainDepositAddressForDefaultChain.mockResolvedValue(mockDepositAddress as any);
      blockchainWalletService.initiateTransaction.mockResolvedValue({
        transactionId: 'blockchain-txn-123',
      } as any);

      await (processor as any).processCardFunding(mockJob);

      const callArgs = blockchainWalletService.initiateTransaction.mock.calls[0][1];
      expect(callArgs.idempotencyKey).toBeDefined();
      expect(callArgs.idempotencyKey).toMatch(/^cf-bc-[a-f0-9]{16}$/);
      expect(callArgs.idempotencyKey.length).toBeLessThanOrEqual(40);
    });

    it('should truncate idempotency key when it exceeds 40 characters', async () => {
      const longTransactionId = 'a'.repeat(100);
      const mockJobWithLongId = {
        ...mockJob,
        data: { ...mockJob.data, cardTransactionId: longTransactionId },
      };

      depositAddressService.getRainDepositAddressForDefaultChain.mockResolvedValue(mockDepositAddress as any);
      blockchainWalletService.initiateTransaction.mockResolvedValue({
        transactionId: 'blockchain-txn-123',
      } as any);

      await (processor as any).processCardFunding(mockJobWithLongId);

      const callArgs = blockchainWalletService.initiateTransaction.mock.calls[0][1];
      expect(callArgs.idempotencyKey.length).toBeLessThanOrEqual(40);
    });

    it('should truncate idempotency key when prefix and hash exceed 40 characters', () => {
      const longPrefix = 'a'.repeat(30);
      const longTransactionId = 'test-transaction-id';
      const generateIdempotencyKey = (processor as any).generateIdempotencyKey.bind(processor);

      const result = generateIdempotencyKey(longPrefix, longTransactionId);

      expect(result.length).toBe(40);
      expect(result).toHaveLength(40);
    });
  });

  describe('processCardFunding - unsupported rail', () => {
    let mockJob: jest.Mocked<Job<CardFundingJobData>>;

    beforeEach(() => {
      mockJob = {
        data: { ...mockJobData, rail: 'unsupported' as CardFundRails },
        updateProgress: jest.fn().mockResolvedValue(undefined),
      } as any;

      (UserModel.query as jest.Mock).mockReturnValue({
        findById: jest.fn().mockResolvedValue(mockUser),
      });
    });

    it('should throw error for unsupported funding rails', async () => {
      depositAddressService.getRainDepositAddressForDefaultChain.mockResolvedValue(mockDepositAddress as any);

      await expect((processor as any).processCardFunding(mockJob)).rejects.toThrow('Unsupported funding rails');
    });
  });

  describe('error handling', () => {
    let mockJob: jest.Mocked<Job<CardFundingJobData>>;

    beforeEach(() => {
      mockJob = {
        data: mockJobData,
        updateProgress: jest.fn().mockResolvedValue(undefined),
      } as any;

      (UserModel.query as jest.Mock).mockReturnValue({
        findById: jest.fn().mockResolvedValue(mockUser),
      });
    });

    it('should update transaction status to declined on error', async () => {
      (UserModel.query as jest.Mock).mockReturnValue({
        findById: jest.fn().mockRejectedValue(new Error('Processing failed')),
      });

      try {
        await (processor as any).processCardFunding(mockJob);
      } catch {
        // Error should be thrown
      }

      expect(cardTransactionRepository.update).toHaveBeenCalledWith(
        { id: 'txn-123' },
        { status: 'declined', declined_reason: 'Processing failed' },
      );
    });

    it('should truncate error message longer than 255 characters', async () => {
      const longErrorMessage = 'a'.repeat(300);
      depositAddressService.getRainDepositAddressForDefaultChain.mockRejectedValue(new Error(longErrorMessage));

      try {
        await (processor as any).processCardFunding(mockJob);
      } catch {
        // Error should be thrown
      }

      expect(cardTransactionRepository.update).toHaveBeenCalledWith(
        { id: 'txn-123' },
        {
          status: 'declined',
          declined_reason: 'a'.repeat(252) + '...',
        },
      );
    });

    it('should not truncate error message exactly 255 characters', async () => {
      const exact255CharMessage = 'a'.repeat(255);
      depositAddressService.getRainDepositAddressForDefaultChain.mockRejectedValue(new Error(exact255CharMessage));

      try {
        await (processor as any).processCardFunding(mockJob);
      } catch {
        // Error should be thrown
      }

      expect(cardTransactionRepository.update).toHaveBeenCalledWith(
        { id: 'txn-123' },
        {
          status: 'declined',
          declined_reason: exact255CharMessage,
        },
      );
    });

    it('should not truncate error message shorter than 255 characters', async () => {
      const shortMessage = 'Short error message';
      depositAddressService.getRainDepositAddressForDefaultChain.mockRejectedValue(new Error(shortMessage));

      try {
        await (processor as any).processCardFunding(mockJob);
      } catch {
        // Error should be thrown
      }

      expect(cardTransactionRepository.update).toHaveBeenCalledWith(
        { id: 'txn-123' },
        {
          status: 'declined',
          declined_reason: shortMessage,
        },
      );
    });

    it('should use "Unknown error" when error message is null', async () => {
      const errorWithoutMessage = new Error();
      errorWithoutMessage.message = null as any;
      depositAddressService.getRainDepositAddressForDefaultChain.mockRejectedValue(errorWithoutMessage);

      try {
        await (processor as any).processCardFunding(mockJob);
      } catch {
        // Error should be thrown
      }

      expect(cardTransactionRepository.update).toHaveBeenCalledWith(
        { id: 'txn-123' },
        {
          status: 'declined',
          declined_reason: 'Unknown error',
        },
      );
    });

    it('should use "Unknown error" when error message is undefined', async () => {
      const errorWithoutMessage = new Error();
      errorWithoutMessage.message = undefined as any;
      depositAddressService.getRainDepositAddressForDefaultChain.mockRejectedValue(errorWithoutMessage);

      try {
        await (processor as any).processCardFunding(mockJob);
      } catch {
        // Error should be thrown
      }

      expect(cardTransactionRepository.update).toHaveBeenCalledWith(
        { id: 'txn-123' },
        {
          status: 'declined',
          declined_reason: 'Unknown error',
        },
      );
    });
  });
});
