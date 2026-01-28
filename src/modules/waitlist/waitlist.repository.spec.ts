import { Test, TestingModule } from '@nestjs/testing';
import { WaitlistModel } from '../../database/models/waitlist';
import { WaitlistRepository } from './waitlist.repository';

describe('WaitlistRepository', () => {
  let repository: WaitlistRepository;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [WaitlistRepository],
    }).compile();

    repository = module.get<WaitlistRepository>(WaitlistRepository);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(repository).toBeDefined();
  });

  describe('constructor', () => {
    it('should initialize with WaitlistModel', () => {
      expect(repository['model']).toBe(WaitlistModel);
    });

    it('should extend BaseRepository', () => {
      expect(repository).toBeInstanceOf(WaitlistRepository);
      expect(repository.findOne).toBeDefined();
      expect(repository.findById).toBeDefined();
      expect(repository.create).toBeDefined();
      expect(repository.update).toBeDefined();
      expect(repository.delete).toBeDefined();
    });
  });

  describe('inherited methods', () => {
    it('should have query method', () => {
      expect(typeof repository.query).toBe('function');
    });

    it('should have findAll method', () => {
      expect(typeof repository.findAll).toBe('function');
    });

    it('should have findOne method', () => {
      expect(typeof repository.findOne).toBe('function');
    });

    it('should have findById method', () => {
      expect(typeof repository.findById).toBe('function');
    });

    it('should have create method', () => {
      expect(typeof repository.create).toBe('function');
    });

    it('should have update method', () => {
      expect(typeof repository.update).toBe('function');
    });

    it('should have delete method', () => {
      expect(typeof repository.delete).toBe('function');
    });

    it('should have transaction method', () => {
      expect(typeof repository.transaction).toBe('function');
    });
  });

  describe('findByUser', () => {
    it('should fetch waitlists by user id with optional filters', async () => {
      const mockQueryBuilder: any = {
        where: jest.fn().mockReturnThis(),
        skipUndefined: jest.fn().mockReturnThis(),
      };

      jest.spyOn(repository, 'query').mockReturnValue(mockQueryBuilder);

      const resultPromise = repository.findByUser('user-123', {
        reason: 'physical_cards' as any,
        feature: 'card' as any,
      });

      expect(repository.query).toHaveBeenCalled();
      expect(mockQueryBuilder.where).toHaveBeenCalledWith({ user_id: 'user-123' });
      expect(mockQueryBuilder.where).toHaveBeenCalledWith('reason', 'physical_cards');
      expect(mockQueryBuilder.where).toHaveBeenCalledWith('feature', 'card');
      await expect(resultPromise).resolves.toBe(mockQueryBuilder);
    });
  });
});
