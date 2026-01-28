import { Test, TestingModule } from '@nestjs/testing';
import { CardTransactionModel } from '../../../database/models/cardTransaction/cardTransaction.model';
import {
  CardTransactionStatus,
  CardTransactionType,
} from '../../../database/models/cardTransaction/cardTransaction.interface';
import { CardTransactionRepository } from './cardTransaction.repository';

describe('CardTransactionRepository', () => {
  let repository: CardTransactionRepository;

  const createThenableQueryBuilder = (value: any) => {
    const thenable: any = {
      where: jest.fn().mockReturnThis(),
      whereNot: jest.fn().mockReturnThis(),
    };
    thenable.then = (onFulfilled: any) => Promise.resolve(value).then(onFulfilled);
    thenable.catch = (onRejected: any) => Promise.resolve(value).catch(onRejected);
    return thenable;
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [CardTransactionRepository],
    }).compile();

    repository = module.get<CardTransactionRepository>(CardTransactionRepository);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('findPreviousSuccessfulDeposits', () => {
    it('should find previous successful deposits excluding specified transaction', async () => {
      const mockTransactions = [
        { id: 'txn-1', card_id: 'card-123', transaction_type: CardTransactionType.DEPOSIT },
        { id: 'txn-2', card_id: 'card-123', transaction_type: CardTransactionType.DEPOSIT },
      ] as CardTransactionModel[];

      const thenableQueryBuilder = createThenableQueryBuilder(mockTransactions);
      jest.spyOn(repository, 'query').mockReturnValue(thenableQueryBuilder);

      const result = await repository.findPreviousSuccessfulDeposits('card-123', 'txn-exclude');

      expect(repository.query).toHaveBeenCalled();
      expect(thenableQueryBuilder.where).toHaveBeenCalledWith({
        card_id: 'card-123',
        transaction_type: CardTransactionType.DEPOSIT,
        status: CardTransactionStatus.SUCCESSFUL,
      });
      expect(thenableQueryBuilder.whereNot).toHaveBeenCalledWith({ merchant_name: 'Balance Transfer' });
      expect(thenableQueryBuilder.whereNot).toHaveBeenCalledWith({ id: 'txn-exclude' });
      expect(result).toEqual(mockTransactions);
    });

    it('should return empty array if no previous deposits found', async () => {
      const thenableQueryBuilder = createThenableQueryBuilder([]);
      jest.spyOn(repository, 'query').mockReturnValue(thenableQueryBuilder);

      const result = await repository.findPreviousSuccessfulDeposits('card-123', 'txn-exclude');

      expect(result).toEqual([]);
    });

    it('should find previous successful deposits without excluding any transaction', async () => {
      const mockTransactions = [
        { id: 'txn-1', card_id: 'card-123', transaction_type: CardTransactionType.DEPOSIT },
        { id: 'txn-2', card_id: 'card-123', transaction_type: CardTransactionType.DEPOSIT },
      ] as CardTransactionModel[];

      const thenableQueryBuilder = createThenableQueryBuilder(mockTransactions);
      jest.spyOn(repository, 'query').mockReturnValue(thenableQueryBuilder);

      const result = await repository.findPreviousSuccessfulDeposits('card-123');

      expect(repository.query).toHaveBeenCalled();
      expect(thenableQueryBuilder.where).toHaveBeenCalledWith({
        card_id: 'card-123',
        transaction_type: CardTransactionType.DEPOSIT,
        status: CardTransactionStatus.SUCCESSFUL,
      });
      expect(thenableQueryBuilder.whereNot).toHaveBeenCalledWith({ merchant_name: 'Balance Transfer' });
      expect(result).toEqual(mockTransactions);
    });
  });

  describe('findByIdWithCardLastFourDigits', () => {
    it('should find card transaction by id with card last four digits', async () => {
      const mockTransaction = {
        id: 'txn-123',
        user_id: 'user-123',
        card: { last_four_digits: '1234' },
      } as any;

      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        withGraphFetched: jest.fn().mockReturnThis(),
        modifyGraph: jest.fn().mockReturnThis(),
        first: jest.fn().mockResolvedValue(mockTransaction),
      };

      jest.spyOn(repository, 'query').mockReturnValue(mockQueryBuilder as any);

      const result = await repository.findByIdWithCardLastFourDigits('txn-123', 'user-123');

      expect(repository.query).toHaveBeenCalled();
      expect(mockQueryBuilder.where).toHaveBeenCalledWith({ id: 'txn-123', user_id: 'user-123' });
      expect(mockQueryBuilder.withGraphFetched).toHaveBeenCalledWith('card');
      expect(mockQueryBuilder.modifyGraph).toHaveBeenCalledWith('card', expect.any(Function));
      expect(mockQueryBuilder.first).toHaveBeenCalled();
      expect(result).toEqual(mockTransaction);
    });

    it('should return undefined when transaction not found', async () => {
      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        withGraphFetched: jest.fn().mockReturnThis(),
        modifyGraph: jest.fn().mockReturnThis(),
        first: jest.fn().mockResolvedValue(undefined),
      };

      jest.spyOn(repository, 'query').mockReturnValue(mockQueryBuilder as any);

      const result = await repository.findByIdWithCardLastFourDigits('txn-123', 'user-123');

      expect(result).toBeUndefined();
    });
  });

  describe('findAllWithCardLastFourDigits', () => {
    it('should find all card transactions with card last four digits', async () => {
      const mockPaginatedResponse = {
        card_transactions: [
          { id: 'txn-1', card: { last_four_digits: '1234' } },
          { id: 'txn-2', card: { last_four_digits: '5678' } },
        ],
        pagination: {
          current_page: 1,
          next_page: 0,
          previous_page: 0,
          limit: 10,
          page_count: 1,
          total: 2,
        },
      };

      jest.spyOn(repository, 'findAll').mockResolvedValue(mockPaginatedResponse as any);

      const result = await repository.findAllWithCardLastFourDigits({ user_id: 'user-123' }, { page: 1, limit: 10 });

      expect(repository.findAll).toHaveBeenCalledWith(
        { user_id: 'user-123' },
        { page: 1, limit: 10 },
        {
          graphFetch: 'card',
          graphModifier: {
            relationship: 'card',
            modifier: expect.any(Function),
          },
        },
      );
      expect(result).toEqual(mockPaginatedResponse);
    });
  });
});
