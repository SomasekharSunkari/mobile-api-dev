import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ProviderLimitModel } from '../../database/models/providerLimit/providerLimit.model';
import { ProviderLimitType } from '../../database/models/providerLimit/providerLimit.interface';
import { PROVIDERS } from '../../constants/constants';
import { SUPPORTED_CURRENCIES } from '../../currencies';
import { ProviderLimitRepository } from './providerLimit.repository';
import { ProviderLimitService } from './providerLimit.service';

const mockProviderLimit: Partial<ProviderLimitModel> = {
  id: 'limit-123',
  provider: PROVIDERS.ZEROHASH,
  limit_type: ProviderLimitType.WEEKLY_DEPOSIT,
  limit_value: 10000000,
  currency: SUPPORTED_CURRENCIES.USD.code,
  is_active: true,
  description: 'ZeroHash weekly deposit limit',
  created_at: new Date(),
  updated_at: new Date(),
};

const mockProviderLimits: Partial<ProviderLimitModel>[] = [
  mockProviderLimit,
  {
    id: 'limit-456',
    provider: PROVIDERS.ZEROHASH,
    limit_type: ProviderLimitType.WEEKLY_WITHDRAWAL,
    limit_value: 10000000,
    currency: SUPPORTED_CURRENCIES.USD.code,
    is_active: true,
    description: 'ZeroHash weekly withdrawal limit',
    created_at: new Date(),
    updated_at: new Date(),
  },
];

describe('ProviderLimit Module', () => {
  describe('ProviderLimitRepository', () => {
    let repository: ProviderLimitRepository;

    beforeEach(() => {
      repository = new ProviderLimitRepository();
    });

    it('should be defined', () => {
      expect(repository).toBeDefined();
    });

    describe('constructor', () => {
      it('should initialize with ProviderLimitModel', () => {
        expect(repository.model).toBeDefined();
        expect(repository.model.tableName).toBe('api_service.provider_limits');
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
  });

  describe('ProviderLimitService', () => {
    let service: ProviderLimitService;
    let repository: jest.Mocked<ProviderLimitRepository>;
    let mockQueryBuilder: any;

    beforeEach(async () => {
      mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        modify: jest.fn().mockReturnThis(),
        first: jest.fn(),
      };

      const mockRepository = {
        query: jest.fn(() => mockQueryBuilder),
      };

      const module: TestingModule = await Test.createTestingModule({
        providers: [ProviderLimitService, { provide: ProviderLimitRepository, useValue: mockRepository }],
      }).compile();

      service = module.get<ProviderLimitService>(ProviderLimitService);
      repository = module.get(ProviderLimitRepository);
    });

    afterEach(() => {
      jest.clearAllMocks();
    });

    it('should be defined', () => {
      expect(service).toBeDefined();
    });

    describe('getProviderLimitValue', () => {
      it('should return limit value when provider limit exists', async () => {
        mockQueryBuilder.first.mockResolvedValue(mockProviderLimit);

        const result = await service.getProviderLimitValue(
          PROVIDERS.ZEROHASH,
          ProviderLimitType.WEEKLY_DEPOSIT,
          SUPPORTED_CURRENCIES.USD.code,
        );

        expect(result).toBe(10000000);
        expect(repository.query).toHaveBeenCalled();
        expect(mockQueryBuilder.where).toHaveBeenCalledWith('provider', PROVIDERS.ZEROHASH);
        expect(mockQueryBuilder.where).toHaveBeenCalledWith('limit_type', ProviderLimitType.WEEKLY_DEPOSIT);
        expect(mockQueryBuilder.where).toHaveBeenCalledWith('currency', SUPPORTED_CURRENCIES.USD.code);
        expect(mockQueryBuilder.where).toHaveBeenCalledWith('is_active', true);
        expect(mockQueryBuilder.modify).toHaveBeenCalledWith('notDeleted');
        expect(mockQueryBuilder.first).toHaveBeenCalled();
      });

      it('should throw NotFoundException when provider limit does not exist', async () => {
        mockQueryBuilder.first.mockResolvedValue(undefined);

        await expect(
          service.getProviderLimitValue(
            PROVIDERS.ZEROHASH,
            ProviderLimitType.WEEKLY_DEPOSIT,
            SUPPORTED_CURRENCIES.USD.code,
          ),
        ).rejects.toThrow(NotFoundException);

        await expect(
          service.getProviderLimitValue(
            PROVIDERS.ZEROHASH,
            ProviderLimitType.WEEKLY_DEPOSIT,
            SUPPORTED_CURRENCIES.USD.code,
          ),
        ).rejects.toThrow(
          `Provider limit not found for provider=${PROVIDERS.ZEROHASH}, type=${ProviderLimitType.WEEKLY_DEPOSIT}, currency=${SUPPORTED_CURRENCIES.USD.code}`,
        );
      });

      it('should only return active provider limits', async () => {
        mockQueryBuilder.first.mockResolvedValue(mockProviderLimit);

        await service.getProviderLimitValue(
          PROVIDERS.ZEROHASH,
          ProviderLimitType.WEEKLY_DEPOSIT,
          SUPPORTED_CURRENCIES.USD.code,
        );

        expect(mockQueryBuilder.where).toHaveBeenCalledWith('is_active', true);
      });

      it('should only return non-deleted provider limits', async () => {
        mockQueryBuilder.first.mockResolvedValue(mockProviderLimit);

        await service.getProviderLimitValue(
          PROVIDERS.ZEROHASH,
          ProviderLimitType.WEEKLY_DEPOSIT,
          SUPPORTED_CURRENCIES.USD.code,
        );

        expect(mockQueryBuilder.modify).toHaveBeenCalledWith('notDeleted');
      });

      it('should handle withdrawal limits correctly', async () => {
        const withdrawalLimit = {
          ...mockProviderLimit,
          id: 'limit-withdrawal',
          limit_type: ProviderLimitType.WEEKLY_WITHDRAWAL,
        };
        mockQueryBuilder.first.mockResolvedValue(withdrawalLimit);

        const result = await service.getProviderLimitValue(
          PROVIDERS.ZEROHASH,
          ProviderLimitType.WEEKLY_WITHDRAWAL,
          SUPPORTED_CURRENCIES.USD.code,
        );

        expect(result).toBe(10000000);
        expect(mockQueryBuilder.where).toHaveBeenCalledWith('limit_type', ProviderLimitType.WEEKLY_WITHDRAWAL);
      });

      it('should handle different currencies correctly', async () => {
        const ngnLimit = {
          ...mockProviderLimit,
          currency: SUPPORTED_CURRENCIES.NGN.code,
          limit_value: 50000000000,
        };
        mockQueryBuilder.first.mockResolvedValue(ngnLimit);

        const result = await service.getProviderLimitValue(
          PROVIDERS.ZEROHASH,
          ProviderLimitType.WEEKLY_DEPOSIT,
          SUPPORTED_CURRENCIES.NGN.code,
        );

        expect(result).toBe(50000000000);
        expect(mockQueryBuilder.where).toHaveBeenCalledWith('currency', SUPPORTED_CURRENCIES.NGN.code);
      });
    });

    describe('getAllProviderLimits', () => {
      beforeEach(() => {
        mockQueryBuilder.first = undefined;
        mockQueryBuilder.then = jest.fn((resolve) => resolve(mockProviderLimits));
      });

      it('should return all active provider limits when no provider specified', async () => {
        const result = await service.getAllProviderLimits();

        expect(result).toEqual(mockProviderLimits);
        expect(repository.query).toHaveBeenCalled();
        expect(mockQueryBuilder.where).toHaveBeenCalledWith('is_active', true);
        expect(mockQueryBuilder.modify).toHaveBeenCalledWith('notDeleted');
      });

      it('should return provider limits filtered by provider when specified', async () => {
        const result = await service.getAllProviderLimits(PROVIDERS.ZEROHASH);

        expect(result).toEqual(mockProviderLimits);
        expect(repository.query).toHaveBeenCalled();
        expect(mockQueryBuilder.where).toHaveBeenCalledWith('is_active', true);
        expect(mockQueryBuilder.where).toHaveBeenCalledWith('provider', PROVIDERS.ZEROHASH);
        expect(mockQueryBuilder.modify).toHaveBeenCalledWith('notDeleted');
      });

      it('should only return active limits', async () => {
        await service.getAllProviderLimits();

        expect(mockQueryBuilder.where).toHaveBeenCalledWith('is_active', true);
      });

      it('should only return non-deleted limits', async () => {
        await service.getAllProviderLimits();

        expect(mockQueryBuilder.modify).toHaveBeenCalledWith('notDeleted');
      });

      it('should return empty array when no limits found', async () => {
        mockQueryBuilder.then = jest.fn((resolve) => resolve([]));

        const result = await service.getAllProviderLimits(PROVIDERS.ZEROHASH);

        expect(result).toEqual([]);
      });
    });
  });
});
