import { Test, TestingModule } from '@nestjs/testing';
import { BlockchainWalletKeyModel } from '../../database/models/blockchain_wallet_key/blockchain_wallet_key.model';
import { BlockchainWalletKeyRepository } from './blockchainWalletKey.repository';

jest.mock('../../database/base/base.repository');

describe('BlockchainWalletKeyRepository', () => {
  let repository: BlockchainWalletKeyRepository;
  let mockQueryBuilder: any;

  beforeEach(async () => {
    mockQueryBuilder = {
      where: jest.fn().mockReturnThis(),
      first: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [BlockchainWalletKeyRepository],
    }).compile();

    repository = module.get<BlockchainWalletKeyRepository>(BlockchainWalletKeyRepository);
    repository.query = jest.fn().mockReturnValue(mockQueryBuilder);
  });

  describe('findByWalletId', () => {
    it('should find wallet key by wallet id', async () => {
      const mockWalletKey = {
        id: 'key-123',
        blockchain_wallet_id: 'wallet-123',
        encrypted_private_key: 'encrypted-key',
      } as BlockchainWalletKeyModel;

      mockQueryBuilder.first.mockResolvedValue(mockWalletKey);

      const result = await repository.findByWalletId('wallet-123');

      expect(result).toEqual(mockWalletKey);
      expect(repository.query).toHaveBeenCalled();
      expect(mockQueryBuilder.where).toHaveBeenCalledWith('blockchain_wallet_id', 'wallet-123');
      expect(mockQueryBuilder.first).toHaveBeenCalled();
    });

    it('should return null if wallet key not found', async () => {
      mockQueryBuilder.first.mockResolvedValue(null);

      const result = await repository.findByWalletId('wallet-123');

      expect(result).toBeNull();
    });
  });

  describe('findByWalletIdAndNetwork', () => {
    it('should find wallet key by wallet id and network', async () => {
      const mockWalletKey = {
        id: 'key-123',
        blockchain_wallet_id: 'wallet-123',
        network: 'ethereum',
      } as BlockchainWalletKeyModel;

      mockQueryBuilder.first.mockResolvedValue(mockWalletKey);

      const result = await repository.findByWalletIdAndNetwork('wallet-123', 'ethereum');

      expect(result).toEqual(mockWalletKey);
      expect(repository.query).toHaveBeenCalled();
      expect(mockQueryBuilder.where).toHaveBeenCalledWith('blockchain_wallet_id', 'wallet-123');
      expect(mockQueryBuilder.where).toHaveBeenCalledWith('network', 'ethereum');
      expect(mockQueryBuilder.first).toHaveBeenCalled();
    });

    it('should return null if wallet key not found', async () => {
      mockQueryBuilder.first.mockResolvedValue(null);

      const result = await repository.findByWalletIdAndNetwork('wallet-123', 'ethereum');

      expect(result).toBeNull();
    });
  });
});
