import { Test, TestingModule } from '@nestjs/testing';
import { PagaLedgerAccountModel } from '../../database/models/pagaLedgerAccount/pagaLedgerAccount.model';
import { PagaLedgerAccountRepository } from './pagaLedgerAccount.repository';

describe('PagaLedgerAccountRepository', () => {
  let repository: PagaLedgerAccountRepository;

  const mockQueryBuilder = {
    sum: jest.fn().mockReturnThis(),
    count: jest.fn().mockReturnThis(),
    first: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PagaLedgerAccountRepository],
    }).compile();

    repository = module.get<PagaLedgerAccountRepository>(PagaLedgerAccountRepository);

    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should be defined', () => {
    expect(repository).toBeDefined();
  });

  describe('constructor', () => {
    it('should initialize with PagaLedgerAccountModel', () => {
      expect(repository['model']).toBe(PagaLedgerAccountModel);
    });

    it('should extend BaseRepository', () => {
      expect(repository).toBeInstanceOf(PagaLedgerAccountRepository);
      expect(repository.findOne).toBeDefined();
      expect(repository.findById).toBeDefined();
      expect(repository.create).toBeDefined();
      expect(repository.update).toBeDefined();
      expect(repository.delete).toBeDefined();
    });
  });

  describe('getTotalUserBalances', () => {
    beforeEach(() => {
      jest.spyOn(PagaLedgerAccountModel, 'query').mockReturnValue(mockQueryBuilder as any);
    });

    it('should return the sum of all available balances', async () => {
      mockQueryBuilder.first.mockResolvedValue({ total: '1500000' });

      const result = await repository.getTotalUserBalances();

      expect(PagaLedgerAccountModel.query).toHaveBeenCalled();
      expect(mockQueryBuilder.sum).toHaveBeenCalledWith('available_balance as total');
      expect(mockQueryBuilder.first).toHaveBeenCalled();
      expect(result).toBe(1500000);
    });

    it('should return 0 when total is null', async () => {
      mockQueryBuilder.first.mockResolvedValue({ total: null });

      const result = await repository.getTotalUserBalances();

      expect(result).toBe(0);
    });

    it('should return 0 when result is undefined', async () => {
      mockQueryBuilder.first.mockResolvedValue(undefined);

      const result = await repository.getTotalUserBalances();

      expect(result).toBe(0);
    });

    it('should handle string number conversion correctly', async () => {
      mockQueryBuilder.first.mockResolvedValue({ total: '999999999' });

      const result = await repository.getTotalUserBalances();

      expect(result).toBe(999999999);
    });
  });

  describe('getTotalAccountsCount', () => {
    beforeEach(() => {
      jest.spyOn(PagaLedgerAccountModel, 'query').mockReturnValue(mockQueryBuilder as any);
    });

    it('should return the count of all paga ledger accounts', async () => {
      mockQueryBuilder.first.mockResolvedValue({ count: '150' });

      const result = await repository.getTotalAccountsCount();

      expect(PagaLedgerAccountModel.query).toHaveBeenCalled();
      expect(mockQueryBuilder.count).toHaveBeenCalledWith('id as count');
      expect(mockQueryBuilder.first).toHaveBeenCalled();
      expect(result).toBe(150);
    });

    it('should return 0 when count is null', async () => {
      mockQueryBuilder.first.mockResolvedValue({ count: null });

      const result = await repository.getTotalAccountsCount();

      expect(result).toBe(0);
    });

    it('should return 0 when result is undefined', async () => {
      mockQueryBuilder.first.mockResolvedValue(undefined);

      const result = await repository.getTotalAccountsCount();

      expect(result).toBe(0);
    });

    it('should handle large count values correctly', async () => {
      mockQueryBuilder.first.mockResolvedValue({ count: '1000000' });

      const result = await repository.getTotalAccountsCount();

      expect(result).toBe(1000000);
    });
  });
});
