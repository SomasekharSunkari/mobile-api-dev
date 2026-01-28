import { CardRepository } from './card.repository';
import { ICardStatus } from '../../../database/models/card/card.interface';
import { CardModel } from '../../../database/models/card/card.model';

describe('CardRepository', () => {
  let repository: CardRepository;

  const mockCard = {
    id: 'card-123',
    user_id: 'user-123',
    status: ICardStatus.ACTIVE,
    balance: 1000,
    created_at: new Date(),
    updated_at: new Date(),
  } as unknown as CardModel;

  beforeEach(() => {
    repository = new CardRepository();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('findNonCanceledCardByUserId', () => {
    it('should find a non-canceled card by user id', async () => {
      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        whereNot: jest.fn().mockReturnThis(),
        first: jest.fn().mockResolvedValue(mockCard),
      };

      jest.spyOn(repository, 'query').mockReturnValue(mockQueryBuilder as any);

      const result = await repository.findNonCanceledCardByUserId('user-123');

      expect(repository.query).toHaveBeenCalled();
      expect(mockQueryBuilder.where).toHaveBeenCalledWith({ user_id: 'user-123' });
      expect(mockQueryBuilder.whereNot).toHaveBeenCalledWith({ status: ICardStatus.CANCELED });
      expect(mockQueryBuilder.first).toHaveBeenCalled();
      expect(result).toEqual(mockCard);
    });

    it('should return undefined when no non-canceled card found', async () => {
      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        whereNot: jest.fn().mockReturnThis(),
        first: jest.fn().mockResolvedValue(undefined),
      };

      jest.spyOn(repository, 'query').mockReturnValue(mockQueryBuilder as any);

      const result = await repository.findNonCanceledCardByUserId('user-123');

      expect(result).toBeUndefined();
    });

    it('should exclude canceled cards', async () => {
      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        whereNot: jest.fn().mockReturnThis(),
        first: jest.fn().mockResolvedValue(undefined),
      };

      jest.spyOn(repository, 'query').mockReturnValue(mockQueryBuilder as any);

      await repository.findNonCanceledCardByUserId('user-123');

      expect(mockQueryBuilder.whereNot).toHaveBeenCalledWith({ status: ICardStatus.CANCELED });
    });

    it('should return undefined when only canceled cards exist for user', async () => {
      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        whereNot: jest.fn().mockReturnThis(),
        first: jest.fn().mockResolvedValue(undefined),
      };

      jest.spyOn(repository, 'query').mockReturnValue(mockQueryBuilder as any);

      const result = await repository.findNonCanceledCardByUserId('user-123');

      expect(result).toBeUndefined();
    });

    it('should find active card even when canceled card exists', async () => {
      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        whereNot: jest.fn().mockReturnThis(),
        first: jest.fn().mockResolvedValue(mockCard),
      };

      jest.spyOn(repository, 'query').mockReturnValue(mockQueryBuilder as any);

      const result = await repository.findNonCanceledCardByUserId('user-123');

      expect(result).toEqual(mockCard);
      expect(result?.status).not.toBe(ICardStatus.CANCELED);
    });
  });

  describe('findLastCanceledCardWithBalance', () => {
    it('should find last canceled card with balance', async () => {
      const mockCanceledCard = {
        ...mockCard,
        status: ICardStatus.CANCELED,
        balance: 5000,
      } as unknown as CardModel;

      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        whereNot: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        first: jest.fn().mockResolvedValue(mockCanceledCard),
      };

      jest.spyOn(repository, 'query').mockReturnValue(mockQueryBuilder as any);

      const result = await repository.findLastCanceledCardWithBalance('user-123');

      expect(repository.query).toHaveBeenCalled();
      expect(mockQueryBuilder.where).toHaveBeenCalledWith({
        user_id: 'user-123',
        status: ICardStatus.CANCELED,
      });
      expect(mockQueryBuilder.whereNot).toHaveBeenCalledWith('balance', 0);
      expect(mockQueryBuilder.orderBy).toHaveBeenCalledWith('updated_at', 'desc');
      expect(mockQueryBuilder.first).toHaveBeenCalled();
      expect(result).toEqual(mockCanceledCard);
    });

    it('should return undefined when no canceled card with balance found', async () => {
      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        whereNot: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        first: jest.fn().mockResolvedValue(undefined),
      };

      jest.spyOn(repository, 'query').mockReturnValue(mockQueryBuilder as any);

      const result = await repository.findLastCanceledCardWithBalance('user-123');

      expect(result).toBeUndefined();
    });
  });
});
