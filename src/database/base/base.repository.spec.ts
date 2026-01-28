import { Test, TestingModule } from '@nestjs/testing';
import { Transaction } from 'objection';
import { BaseRepository } from './base.repository';
import { BaseModel } from './base.model';

class TestModel extends BaseModel {
  static get tableName() {
    return 'test_schema.test_table';
  }
}

class TestRepository extends BaseRepository<TestModel> {
  constructor() {
    super(TestModel);
  }
}

describe('BaseRepository', () => {
  let repository: TestRepository;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [TestRepository],
    }).compile();

    repository = module.get<TestRepository>(TestRepository);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('transaction', () => {
    it('should execute transaction when trxOrKnex is a function', async () => {
      const mockCallback = jest.fn().mockResolvedValue('result');
      const mockTrx = {} as Transaction;

      const transactionSpy = jest.spyOn(repository.model, 'transaction').mockImplementation(async (callback: any) => {
        return await callback(mockTrx);
      });

      const result = await repository.transaction(mockCallback);

      expect(transactionSpy).toHaveBeenCalledWith(mockCallback);
      expect(mockCallback).toHaveBeenCalledWith(mockTrx);
      expect(result).toBe('result');

      transactionSpy.mockRestore();
    });

    it('should execute callback when callback is provided with transaction object', async () => {
      const mockTrx = {} as Transaction;
      const mockCallback = jest.fn().mockResolvedValue('callback-result');
      const transactionSpy = jest.spyOn(repository.model, 'transaction');

      const result = await repository.transaction(mockTrx, mockCallback);

      expect(mockCallback).toHaveBeenCalledWith(mockTrx);
      expect(transactionSpy).not.toHaveBeenCalled();
      expect(result).toBe('callback-result');

      transactionSpy.mockRestore();
    });

    it('should throw error when invalid arguments are provided', async () => {
      const mockTrx = {} as Transaction;

      await expect(repository.transaction(mockTrx)).rejects.toThrow('Invalid arguments provided to transaction method');
    });
  });
});
