import { Test } from '@nestjs/testing';
import { TierStatus } from '../../database/models/tier/tier.interface';
import { TierModel } from '../../database/models/tier/tier.model';
import { TierRepository } from './tier.repository';
import { TierService } from './tier.service';

describe('TierService', () => {
  let service: TierService;
  const queryMock = jest.fn();
  const withGraphFetchedMock = jest.fn();
  const orderByMock = jest.fn();

  const mockTiers: Partial<TierModel>[] = [
    {
      id: 'tier-1',
      name: 'Basic',
      level: 1,
      description: 'Basic tier with limited features',
      status: TierStatus.ACTIVE,
      created_at: new Date('2024-01-01'),
      updated_at: new Date('2024-01-01'),
    },
    {
      id: 'tier-2',
      name: 'Standard',
      level: 2,
      description: 'Standard tier with more features',
      status: TierStatus.ACTIVE,
      created_at: new Date('2024-01-01'),
      updated_at: new Date('2024-01-01'),
    },
    {
      id: 'tier-3',
      name: 'Premium',
      level: 3,
      description: 'Premium tier with all features',
      status: TierStatus.ACTIVE,
      created_at: new Date('2024-01-01'),
      updated_at: new Date('2024-01-01'),
    },
  ];

  beforeEach(async () => {
    queryMock.mockReturnValue({
      withGraphFetched: withGraphFetchedMock,
    });
    withGraphFetchedMock.mockReturnValue({
      orderBy: orderByMock,
    });
    orderByMock.mockResolvedValue(mockTiers);

    const moduleRef = await Test.createTestingModule({
      providers: [
        TierService,
        {
          provide: TierRepository,
          useValue: {
            query: queryMock,
          },
        },
      ],
    }).compile();

    service = moduleRef.get<TierService>(TierService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getAllTiers', () => {
    it('should return all tiers ordered by level ascending', async () => {
      const result = await service.getAllTiers();

      expect(queryMock).toHaveBeenCalled();
      expect(withGraphFetchedMock).toHaveBeenCalledWith('[tierConfigs.[country]]');
      expect(orderByMock).toHaveBeenCalledWith('level', 'asc');
      expect(result).toEqual(mockTiers);
      expect(result).toHaveLength(3);
    });

    it('should return tiers in correct order by level', async () => {
      const result = await service.getAllTiers();

      expect(result[0].level).toBe(1);
      expect(result[1].level).toBe(2);
      expect(result[2].level).toBe(3);
    });

    it('should return empty array when no tiers exist', async () => {
      orderByMock.mockResolvedValueOnce([]);

      const result = await service.getAllTiers();

      expect(result).toEqual([]);
      expect(result).toHaveLength(0);
    });
  });
});
