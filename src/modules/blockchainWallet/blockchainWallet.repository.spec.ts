import { Test, TestingModule } from '@nestjs/testing';
import { BlockchainWalletModel } from '../../database/models/blockchain_wallet/blockchain_wallet.model';
import { BlockchainWalletRepository } from './blockchainWallet.repository';

describe('BlockchainWalletRepository', () => {
  let repository: BlockchainWalletRepository;
  let mockQuery: any;

  beforeEach(async () => {
    mockQuery = {
      where: jest.fn().mockReturnThis(),
      whereIn: jest.fn().mockReturnThis(),
      first: jest.fn(),
      withGraphFetched: jest.fn().mockReturnThis(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [BlockchainWalletRepository],
    }).compile();

    repository = module.get<BlockchainWalletRepository>(BlockchainWalletRepository);

    jest.spyOn(repository.model, 'query').mockReturnValue(mockQuery as any);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(repository).toBeDefined();
  });

  describe('findActiveWalletByUserIdAndAsset', () => {
    it('should find active wallet by user id and asset', async () => {
      const userId = 'user-123';
      const asset = 'USDC_ETH_TEST5_0GER';
      const mockWallet = {
        id: 'wallet-123',
        user_id: userId,
        asset: asset,
        status: 'active',
        is_visible: true,
      } as BlockchainWalletModel;

      mockQuery.first.mockResolvedValue(mockWallet);

      const result = await repository.findActiveWalletByUserIdAndAsset(userId, asset);

      expect(result).toEqual(mockWallet);
      expect(mockQuery.where).toHaveBeenCalledWith('user_id', userId);
      expect(mockQuery.where).toHaveBeenCalledWith('asset', asset);
      expect(mockQuery.where).toHaveBeenCalledWith('status', 'active');
      expect(mockQuery.where).toHaveBeenCalledWith('is_visible', true);
      expect(mockQuery.first).toHaveBeenCalled();
    });

    it('should find active wallet including invisible when includeInvisible is true', async () => {
      const userId = 'user-123';
      const asset = 'USDC_ETH_TEST5_0GER';
      const mockWallet = {
        id: 'wallet-123',
        user_id: userId,
        asset: asset,
        status: 'active',
        is_visible: false,
      } as BlockchainWalletModel;

      mockQuery.first.mockResolvedValue(mockWallet);

      const result = await repository.findActiveWalletByUserIdAndAsset(userId, asset, true);

      expect(result).toEqual(mockWallet);
      expect(mockQuery.where).not.toHaveBeenCalledWith('is_visible', true);
    });
  });

  describe('findAllActiveWalletsByUserId', () => {
    it('should find all active wallets by user id', async () => {
      const userId = 'user-123';
      const mockWallets = [
        {
          id: 'wallet-123',
          user_id: userId,
          status: 'active',
          is_visible: true,
        },
      ] as BlockchainWalletModel[];

      const arrayLikeQuery = [...mockWallets] as any;
      arrayLikeQuery.where = jest.fn().mockReturnValue(arrayLikeQuery);
      arrayLikeQuery.whereIn = jest.fn().mockReturnValue(arrayLikeQuery);
      arrayLikeQuery.first = jest.fn();
      arrayLikeQuery.withGraphFetched = jest.fn().mockReturnValue(arrayLikeQuery);
      jest.spyOn(repository.model, 'query').mockReturnValue(arrayLikeQuery);

      const result = await repository.findAllActiveWalletsByUserId(userId);

      expect(Array.from(result)).toEqual(mockWallets);
      expect(arrayLikeQuery.where).toHaveBeenCalledWith('user_id', userId);
      expect(arrayLikeQuery.where).toHaveBeenCalledWith('status', 'active');
      expect(arrayLikeQuery.where).toHaveBeenCalledWith('is_visible', true);
    });

    it('should find all active wallets including invisible when includeInvisible is true', async () => {
      const userId = 'user-123';
      const mockWallets = [
        {
          id: 'wallet-123',
          user_id: userId,
          status: 'active',
          is_visible: false,
        },
      ] as BlockchainWalletModel[];

      const arrayLikeQuery = [...mockWallets] as any;
      arrayLikeQuery.where = jest.fn().mockReturnValue(arrayLikeQuery);
      arrayLikeQuery.whereIn = jest.fn().mockReturnValue(arrayLikeQuery);
      arrayLikeQuery.first = jest.fn();
      arrayLikeQuery.withGraphFetched = jest.fn().mockReturnValue(arrayLikeQuery);
      jest.spyOn(repository.model, 'query').mockReturnValue(arrayLikeQuery);

      const result = await repository.findAllActiveWalletsByUserId(userId, true);

      expect(Array.from(result)).toEqual(mockWallets);
      expect(arrayLikeQuery.where).not.toHaveBeenCalledWith('is_visible', true);
    });
  });

  describe('batchCreate', () => {
    it('should batch create wallets', async () => {
      const mockWallets = [
        {
          user_id: 'user-123',
          asset: 'USDC_ETH_TEST5_0GER',
          address: '0x123...',
        },
      ] as Partial<BlockchainWalletModel>[];

      const mockInsert = jest.fn().mockResolvedValue(mockWallets);
      const mockModelQuery = {
        insert: mockInsert,
      };
      repository['model'].query = jest.fn().mockReturnValue(mockModelQuery);

      const result = await repository.batchCreate(mockWallets);

      expect(result).toEqual(mockWallets);
      expect(mockInsert).toHaveBeenCalledWith(mockWallets);
    });
  });

  describe('findActiveWalletsByUserIdAndAssets', () => {
    it('should find active wallets by user id and assets', async () => {
      const userId = 'user-123';
      const assetIds = ['USDC_ETH_TEST5_0GER', 'USDT_ETH_TEST5_0GER'];
      const mockWallets = [
        {
          id: 'wallet-123',
          user_id: userId,
          asset: assetIds[0],
          status: 'active',
        },
      ] as BlockchainWalletModel[];

      const arrayLikeQuery = [...mockWallets] as any;
      arrayLikeQuery.where = jest.fn().mockReturnValue(arrayLikeQuery);
      arrayLikeQuery.whereIn = jest.fn().mockReturnValue(arrayLikeQuery);
      arrayLikeQuery.first = jest.fn();
      arrayLikeQuery.withGraphFetched = jest.fn().mockReturnValue(arrayLikeQuery);
      jest.spyOn(repository.model, 'query').mockReturnValue(arrayLikeQuery);

      const result = await repository.findActiveWalletsByUserIdAndAssets(userId, assetIds);

      expect(Array.from(result)).toEqual(mockWallets);
      expect(arrayLikeQuery.where).toHaveBeenCalledWith('user_id', userId);
      expect(arrayLikeQuery.whereIn).toHaveBeenCalledWith('asset', assetIds);
      expect(arrayLikeQuery.where).toHaveBeenCalledWith('status', 'active');
    });

    it('should find active wallets with rails filter', async () => {
      const userId = 'user-123';
      const assetIds = ['USDC_ETH_TEST5_0GER'];
      const rails = 'ETH_TEST5';

      const mockWallets = [
        {
          id: 'wallet-123',
          user_id: userId,
          asset: assetIds[0],
          status: 'active',
          rails: rails,
        },
      ] as unknown as BlockchainWalletModel[];

      const arrayLikeQuery = [...mockWallets] as any;
      arrayLikeQuery.where = jest.fn().mockReturnValue(arrayLikeQuery);
      arrayLikeQuery.whereIn = jest.fn().mockReturnValue(arrayLikeQuery);
      arrayLikeQuery.first = jest.fn();
      arrayLikeQuery.withGraphFetched = jest.fn().mockReturnValue(arrayLikeQuery);
      jest.spyOn(repository.model, 'query').mockReturnValue(arrayLikeQuery);

      const result = await repository.findActiveWalletsByUserIdAndAssets(userId, assetIds, rails);

      expect(Array.from(result)).toEqual(mockWallets);
      expect(arrayLikeQuery.where).toHaveBeenCalledWith('rails', rails);
    });
  });

  describe('findFirstWalletByUserId', () => {
    it('should find first wallet by user id', async () => {
      const userId = 'user-123';
      const mockWallet = {
        id: 'wallet-123',
        user_id: userId,
      } as BlockchainWalletModel;

      mockQuery.first.mockResolvedValue(mockWallet);

      const result = await repository.findFirstWalletByUserId(userId);

      expect(result).toEqual(mockWallet);
      expect(mockQuery.where).toHaveBeenCalledWith('user_id', userId);
      expect(mockQuery.first).toHaveBeenCalled();
    });

    it('should return null when no wallet found', async () => {
      const userId = 'user-123';

      mockQuery.first.mockResolvedValue(undefined);

      const result = await repository.findFirstWalletByUserId(userId);

      expect(result).toBeNull();
    });
  });

  describe('findByProviderAccountRef', () => {
    it('should find wallet by provider account ref', async () => {
      const providerAccountRef = 'provider-ref-123';
      const mockWallet = {
        id: 'wallet-123',
        provider_account_ref: providerAccountRef,
      } as BlockchainWalletModel;

      mockQuery.first.mockResolvedValue(mockWallet);

      const result = await repository.findByProviderAccountRef(providerAccountRef);

      expect(result).toEqual(mockWallet);
      expect(mockQuery.where).toHaveBeenCalledWith('provider_account_ref', providerAccountRef);
      expect(mockQuery.first).toHaveBeenCalled();
    });

    it('should find wallet by provider account ref with asset id filter', async () => {
      const providerAccountRef = 'provider-ref-123';
      const assetId = 'USDC_ETH_TEST5_0GER';
      const mockWallet = {
        id: 'wallet-123',
        provider_account_ref: providerAccountRef,
        asset: assetId,
      } as BlockchainWalletModel;

      mockQuery.first.mockResolvedValue(mockWallet);

      const result = await repository.findByProviderAccountRef(providerAccountRef, assetId);

      expect(result).toEqual(mockWallet);
      expect(mockQuery.where).toHaveBeenCalledWith('asset', assetId);
    });

    it('should find wallet by provider account ref with native asset id filter', async () => {
      const providerAccountRef = 'provider-ref-123';
      const nativeAssetId = 'ETH_TEST5';
      const mockWallet = {
        id: 'wallet-123',
        provider_account_ref: providerAccountRef,
        base_asset: nativeAssetId,
      } as BlockchainWalletModel;

      mockQuery.first.mockResolvedValue(mockWallet);

      const result = await repository.findByProviderAccountRef(providerAccountRef, undefined, nativeAssetId);

      expect(result).toEqual(mockWallet);
      expect(mockQuery.where).toHaveBeenCalledWith('base_asset', nativeAssetId);
    });
  });

  describe('findUserWalletById', () => {
    it('should find user wallet by id', async () => {
      const userId = 'user-123';
      const walletId = 'wallet-123';
      const mockWallet = {
        id: walletId,
        user_id: userId,
      } as BlockchainWalletModel;

      mockQuery.first.mockResolvedValue(mockWallet);

      const result = await repository.findUserWalletById(userId, walletId);

      expect(result).toEqual(mockWallet);
      expect(mockQuery.where).toHaveBeenCalledWith('id', walletId);
      expect(mockQuery.where).toHaveBeenCalledWith('user_id', userId);
      expect(mockQuery.first).toHaveBeenCalled();
    });

    it('should return null when wallet not found', async () => {
      const userId = 'user-123';
      const walletId = 'wallet-123';

      mockQuery.first.mockResolvedValue(null);

      const result = await repository.findUserWalletById(userId, walletId);

      expect(result).toBeNull();
    });
  });

  describe('findWalletByIdWithUser', () => {
    it('should find wallet by id with user graph fetched', async () => {
      const walletId = 'wallet-123';
      const mockWallet = {
        id: walletId,
        user: {
          id: 'user-123',
          email: 'test@example.com',
        },
      } as BlockchainWalletModel;

      mockQuery.first.mockResolvedValue(mockWallet);

      const result = await repository.findWalletByIdWithUser(walletId);

      expect(result).toEqual(mockWallet);
      expect(mockQuery.where).toHaveBeenCalledWith('id', walletId);
      expect(mockQuery.withGraphFetched).toHaveBeenCalledWith('user');
      expect(mockQuery.first).toHaveBeenCalled();
    });
  });

  describe('findByAddress', () => {
    it('should find wallet by address with user graph fetched', async () => {
      const address = '0x1234567890abcdef';
      const mockWallet = {
        id: 'wallet-123',
        address: address,
        user: {
          id: 'user-123',
          email: 'test@example.com',
        },
      } as BlockchainWalletModel;

      mockQuery.first.mockResolvedValue(mockWallet);

      const result = await repository.findByAddress(address);

      expect(result).toEqual(mockWallet);
      expect(mockQuery.where).toHaveBeenCalledWith('address', address);
      expect(mockQuery.withGraphFetched).toHaveBeenCalledWith('user');
      expect(mockQuery.first).toHaveBeenCalled();
    });
  });
});
