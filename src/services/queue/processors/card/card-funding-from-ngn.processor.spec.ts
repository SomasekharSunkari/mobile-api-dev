import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Job } from 'bullmq';
import { CardTransactionStatus } from '../../../../database/models/cardTransaction/cardTransaction.interface';
import { CardTransactionRepository } from '../../../../modules/card/repository/cardTransaction.repository';
import { NgToUsdExchangeEscrowService } from '../../../../modules/exchange/fiat-exchange/ng-to-usd-exchange.service/ng-to-usd-exchange.escrow.service';
import { VirtualAccountService } from '../../../../modules/virtualAccount/virtualAccount.service';
import { QueueService } from '../../queue.service';
import { ExecuteNgUsdExchangeProcessor } from '../exchange/execute-ng-usd-exchange.processor';
import { CardFundingFromNGNJobData, CardFundingFromNGNProcessor } from './card-funding-from-ngn.processor';

describe('CardFundingFromNGNProcessor', () => {
  let processor: CardFundingFromNGNProcessor;
  let queueService: jest.Mocked<QueueService>;
  let ngToUsdExchangeEscrowService: jest.Mocked<NgToUsdExchangeEscrowService>;
  let virtualAccountService: jest.Mocked<VirtualAccountService>;
  let cardTransactionRepository: jest.Mocked<CardTransactionRepository>;
  let executeNgUsdExchangeProcessor: jest.Mocked<ExecuteNgUsdExchangeProcessor>;

  const mockJobData: CardFundingFromNGNJobData = {
    cardTransactionId: 'card-txn-123',
    exchangeTransactionRef: 'exchange-ref-123',
    userId: 'user-123',
    cardId: 'card-123',
    ngnAmount: 160000,
    usdAmount: 100,
    netUsdAmount: 97.5,
    cardFeeUSD: 2.5,
    rateId: 'rate-123',
    depositAddress: '0x123456789',
  };

  const mockVirtualAccount = {
    id: 'va-123',
    user_id: 'user-123',
    account_number: '1234567890',
    bank_name: 'Test Bank',
    account_name: 'Test User',
  };

  const mockTransactionData = {
    amount: 160000,
    currency: 'NGN',
    userId: 'user-123',
    rateId: 'rate-123',
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CardFundingFromNGNProcessor,
        {
          provide: QueueService,
          useValue: {
            processJobs: jest.fn(),
            addJob: jest.fn(),
          },
        },
        {
          provide: NgToUsdExchangeEscrowService,
          useValue: {
            getTransactionData: jest.fn(),
          },
        },
        {
          provide: VirtualAccountService,
          useValue: {
            findOneByUserIdOrThrow: jest.fn(),
          },
        },
        {
          provide: CardTransactionRepository,
          useValue: {
            update: jest.fn(),
          },
        },
        {
          provide: ExecuteNgUsdExchangeProcessor,
          useValue: {
            queueExecuteNgToUSDExchange: jest.fn(),
          },
        },
      ],
    }).compile();

    processor = module.get<CardFundingFromNGNProcessor>(CardFundingFromNGNProcessor);
    queueService = module.get(QueueService);
    ngToUsdExchangeEscrowService = module.get(NgToUsdExchangeEscrowService);
    virtualAccountService = module.get(VirtualAccountService);
    cardTransactionRepository = module.get(CardTransactionRepository);
    executeNgUsdExchangeProcessor = module.get(ExecuteNgUsdExchangeProcessor);

    jest.clearAllMocks();
  });

  describe('queueCardFundingFromNGN', () => {
    it('should queue card funding job with correct parameters', async () => {
      const mockJob = { id: 'job-123' };
      queueService.addJob.mockResolvedValue(mockJob as any);

      const result = await processor.queueCardFundingFromNGN(mockJobData);

      expect(queueService.addJob).toHaveBeenCalledWith('card-funding-from-ngn', 'card-funding-from-ngn', mockJobData, {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
      });
      expect(result).toEqual(mockJob);
    });

    it('should register processor on first call', async () => {
      const mockJob = { id: 'job-123' };
      queueService.addJob.mockResolvedValue(mockJob as any);

      await processor.queueCardFundingFromNGN(mockJobData);

      expect(queueService.processJobs).toHaveBeenCalledWith(
        'card-funding-from-ngn',
        'card-funding-from-ngn',
        expect.any(Function),
        2,
      );
    });

    it('should not register processor on subsequent calls', async () => {
      const mockJob = { id: 'job-123' };
      queueService.addJob.mockResolvedValue(mockJob as any);

      await processor.queueCardFundingFromNGN(mockJobData);
      await processor.queueCardFundingFromNGN(mockJobData);

      // processJobs should only be called once
      expect(queueService.processJobs).toHaveBeenCalledTimes(1);
    });
  });

  describe('processCardFundingFromNGN', () => {
    it('should process card funding job successfully', async () => {
      const mockJob: Partial<Job<CardFundingFromNGNJobData>> = {
        data: mockJobData,
      };

      ngToUsdExchangeEscrowService.getTransactionData.mockResolvedValue(mockTransactionData as any);
      virtualAccountService.findOneByUserIdOrThrow.mockResolvedValue(mockVirtualAccount as any);
      executeNgUsdExchangeProcessor.queueExecuteNgToUSDExchange.mockResolvedValue({ id: 'exchange-job-123' } as any);

      // Access private method via prototype for testing
      const processMethod = (processor as any).processCardFundingFromNGN.bind(processor);
      const result = await processMethod(mockJob as Job<CardFundingFromNGNJobData>);

      expect(ngToUsdExchangeEscrowService.getTransactionData).toHaveBeenCalledWith(mockJobData.exchangeTransactionRef);
      expect(virtualAccountService.findOneByUserIdOrThrow).toHaveBeenCalledWith(mockJobData.userId);
      expect(executeNgUsdExchangeProcessor.queueExecuteNgToUSDExchange).toHaveBeenCalledWith(
        expect.objectContaining({
          transactionReference: mockJobData.exchangeTransactionRef,
          accountNumber: mockVirtualAccount.account_number,
          rateId: mockJobData.rateId,
          userId: mockJobData.userId,
          isCardFunding: true,
          cardTransactionId: mockJobData.cardTransactionId,
          depositAddress: mockJobData.depositAddress,
        }),
      );
      expect(cardTransactionRepository.update).toHaveBeenCalledWith(
        { id: mockJobData.cardTransactionId },
        { status: CardTransactionStatus.PENDING },
      );
      expect(result.status).toBe('queued');
    });

    it('should throw error when transaction data not found', async () => {
      const mockJob: Partial<Job<CardFundingFromNGNJobData>> = {
        data: mockJobData,
      };

      ngToUsdExchangeEscrowService.getTransactionData.mockResolvedValue(null);

      const processMethod = (processor as any).processCardFundingFromNGN.bind(processor);

      await expect(processMethod(mockJob as Job<CardFundingFromNGNJobData>)).rejects.toThrow(BadRequestException);

      expect(cardTransactionRepository.update).toHaveBeenCalledWith(
        { id: mockJobData.cardTransactionId },
        { status: CardTransactionStatus.DECLINED, declined_reason: 'Transaction data not found' },
      );
    });

    it('should update card transaction status to declined when transaction data not found', async () => {
      const mockJob: Partial<Job<CardFundingFromNGNJobData>> = {
        data: mockJobData,
      };

      ngToUsdExchangeEscrowService.getTransactionData.mockResolvedValue(null);

      const processMethod = (processor as any).processCardFundingFromNGN.bind(processor);

      try {
        await processMethod(mockJob as Job<CardFundingFromNGNJobData>);
      } catch {
        // Expected to throw
      }

      expect(cardTransactionRepository.update).toHaveBeenCalledWith(
        { id: mockJobData.cardTransactionId },
        {
          status: CardTransactionStatus.DECLINED,
          declined_reason: 'Transaction data not found',
        },
      );
    });

    it('should include card transaction id in exchange job when provided', async () => {
      const mockJob: Partial<Job<CardFundingFromNGNJobData>> = {
        data: mockJobData,
      };

      ngToUsdExchangeEscrowService.getTransactionData.mockResolvedValue(mockTransactionData as any);
      virtualAccountService.findOneByUserIdOrThrow.mockResolvedValue(mockVirtualAccount as any);
      executeNgUsdExchangeProcessor.queueExecuteNgToUSDExchange.mockResolvedValue({ id: 'exchange-job-123' } as any);

      const processMethod = (processor as any).processCardFundingFromNGN.bind(processor);
      await processMethod(mockJob as Job<CardFundingFromNGNJobData>);

      expect(executeNgUsdExchangeProcessor.queueExecuteNgToUSDExchange).toHaveBeenCalledWith(
        expect.objectContaining({
          cardTransactionId: mockJobData.cardTransactionId,
          isCardFunding: true,
        }),
      );
    });
  });
});
