import { Test } from '@nestjs/testing';
import { TierStatus } from '../../database/models/tier/tier.interface';
import { TierModel } from '../../database/models/tier/tier.model';
import { TierController } from './tier.controller';
import { TierService } from './tier.service';

describe('TierController', () => {
  let controller: TierController;
  const getAllTiersMock = jest.fn();

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
    getAllTiersMock.mockResolvedValue(mockTiers);

    const moduleRef = await Test.createTestingModule({
      controllers: [TierController],
      providers: [
        {
          provide: TierService,
          useValue: {
            getAllTiers: getAllTiersMock,
          },
        },
      ],
    }).compile();

    controller = moduleRef.get<TierController>(TierController);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getAllTiers', () => {
    it('should return all tiers with success response', async () => {
      const result = await controller.getAllTiers();

      expect(getAllTiersMock).toHaveBeenCalled();
      expect(result.statusCode).toBe(200);
      expect(result.message).toBe('Tiers fetched successfully');
      expect(result.data).toEqual(mockTiers);
      expect(result.timestamp).toBeDefined();
    });

    it('should return empty array when no tiers exist', async () => {
      getAllTiersMock.mockResolvedValueOnce([]);

      const result = await controller.getAllTiers();

      expect(result.statusCode).toBe(200);
      expect(result.message).toBe('Tiers fetched successfully');
      expect(result.data).toEqual([]);
    });

    it('should return tiers with correct structure', async () => {
      const result = await controller.getAllTiers();

      expect(result.data).toHaveLength(3);
      expect(result.data[0]).toHaveProperty('id');
      expect(result.data[0]).toHaveProperty('name');
      expect(result.data[0]).toHaveProperty('level');
      expect(result.data[0]).toHaveProperty('description');
      expect(result.data[0]).toHaveProperty('status');
    });
  });
});
