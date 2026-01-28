import { Test, TestingModule } from '@nestjs/testing';
import { RateConfigModel } from '../../database/models/rateConfig/rateConfig.model';
import { RateConfigRepository } from './rateConfig.repository';

describe('RateConfigRepository', () => {
  let repository: RateConfigRepository;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [RateConfigRepository],
    }).compile();

    repository = module.get<RateConfigRepository>(RateConfigRepository);
  });

  it('should be defined', () => {
    expect(repository).toBeDefined();
  });

  describe('constructor', () => {
    it('should initialize with RateConfigModel', () => {
      expect(repository['model']).toBe(RateConfigModel);
    });

    it('should extend BaseRepository', () => {
      expect(repository).toBeInstanceOf(RateConfigRepository);
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

  describe('findByProvider', () => {
    it('should have findByProvider method', () => {
      expect(typeof repository.findByProvider).toBe('function');
    });

    it('should call findOne with provider parameter', async () => {
      const mockRateConfig = {
        id: 'rate-config-1',
        provider: 'yellowcard',
        config: {
          fiat_exchange: {
            service_fee: { value: 0, is_percentage: false },
            partner_fee: { value: 0, is_percentage: false },
            disbursement_fee: { value: 0, is_percentage: false },
            ngn_withdrawal_fee: { value: 0, is_percentage: false, cap: 0 },
          },
          is_active: true,
        },
      };

      const findOneSpy = jest.spyOn(repository, 'findOne').mockResolvedValue(mockRateConfig as any);

      const result = await repository.findByProvider('yellowcard');

      expect(findOneSpy).toHaveBeenCalledWith({ provider: 'yellowcard' }, undefined, { trx: undefined });
      expect(result).toEqual(mockRateConfig);
    });

    it('should pass transaction to findOne when provided', async () => {
      const mockTrx = {} as any;
      const findOneSpy = jest.spyOn(repository, 'findOne').mockResolvedValue(null);

      await repository.findByProvider('zerohash', mockTrx);

      expect(findOneSpy).toHaveBeenCalledWith({ provider: 'zerohash' }, undefined, { trx: mockTrx });
    });

    it('should return undefined when provider not found', async () => {
      jest.spyOn(repository, 'findOne').mockResolvedValue(undefined);

      const result = await repository.findByProvider('non-existent');

      expect(result).toBeUndefined();
    });
  });
});
