import { Test, TestingModule } from '@nestjs/testing';
import { DepositAddressModel } from '../../database/models/depositAddress/depositAddress.model';
import { DepositAddressRepository } from './depositAddress.repository';

describe('DepositAddressRepository', () => {
  let repository: DepositAddressRepository;
  let mockQuery: any;

  beforeEach(async () => {
    mockQuery = {
      where: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      first: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [DepositAddressRepository],
    }).compile();

    repository = module.get<DepositAddressRepository>(DepositAddressRepository);

    jest.spyOn(repository.model, 'query').mockReturnValue(mockQuery as any);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(repository).toBeDefined();
  });

  describe('findByUserId', () => {
    it('should find all deposit addresses for a user ordered by creation date', async () => {
      const userId = 'user-123';
      const mockAddresses = [
        {
          id: 'address-2',
          user_id: userId,
          asset: 'USDC_ETH_TEST5_0GER',
          address: '0x456...',
          created_at: new Date('2024-01-02'),
        },
        {
          id: 'address-1',
          user_id: userId,
          asset: 'USDT_ETH_TEST5_0GER',
          address: '0x123...',
          created_at: new Date('2024-01-01'),
        },
      ] as DepositAddressModel[];

      mockQuery.orderBy.mockReturnValue(mockAddresses);

      const result = await repository.findByUserId(userId);

      expect(result).toEqual(mockAddresses);
      expect(mockQuery.where).toHaveBeenCalledWith({ user_id: userId });
      expect(mockQuery.orderBy).toHaveBeenCalledWith('created_at', 'desc');
    });

    it('should return empty array when no addresses found', async () => {
      const userId = 'user-123';

      mockQuery.orderBy.mockReturnValue([]);

      const result = await repository.findByUserId(userId);

      expect(result).toEqual([]);
    });
  });

  describe('findByUserIdAndAsset', () => {
    it('should find deposit address for user and asset', async () => {
      const userId = 'user-123';
      const asset = 'USDC_ETH_TEST5_0GER';
      const mockAddress = {
        id: 'address-123',
        user_id: userId,
        asset: asset,
        address: '0x1234567890abcdef',
      } as DepositAddressModel;

      mockQuery.first.mockResolvedValue(mockAddress);

      const result = await repository.findByUserIdAndAsset(userId, asset);

      expect(result).toEqual(mockAddress);
      expect(mockQuery.where).toHaveBeenCalledWith({ user_id: userId, asset: asset });
      expect(mockQuery.first).toHaveBeenCalled();
    });

    it('should return undefined when address not found', async () => {
      const userId = 'user-123';
      const asset = 'USDC_ETH_TEST5_0GER';

      mockQuery.first.mockResolvedValue(undefined);

      const result = await repository.findByUserIdAndAsset(userId, asset);

      expect(result).toBeUndefined();
    });
  });

  describe('findLatestRainDepositAddressByUserId', () => {
    it('should find latest Rain deposit address for user', async () => {
      const userId = 'user-123';
      const mockAddress = {
        id: 'address-123',
        user_id: userId,
        provider: 'rain',
        asset: 'USDC_ETH_TEST5_0GER',
        address: '0x1234567890abcdef',
        created_at: new Date('2024-01-02'),
      } as DepositAddressModel;

      mockQuery.first.mockResolvedValue(mockAddress);

      const result = await repository.findLatestRainDepositAddressByUserId(userId);

      expect(result).toEqual(mockAddress);
      expect(mockQuery.where).toHaveBeenCalledWith({ user_id: userId, provider: 'rain' });
      expect(mockQuery.orderBy).toHaveBeenCalledWith('created_at', 'desc');
      expect(mockQuery.first).toHaveBeenCalled();
    });

    it('should return undefined when no Rain address found', async () => {
      const userId = 'user-123';

      mockQuery.first.mockResolvedValue(undefined);

      const result = await repository.findLatestRainDepositAddressByUserId(userId);

      expect(result).toBeUndefined();
    });
  });
});
