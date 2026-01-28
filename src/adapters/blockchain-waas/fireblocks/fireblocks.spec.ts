import { InternalServerErrorException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { FireblocksConfigProvider } from '../../../config';
import { ITransactionHistoryParams } from '../blockchain-waas-adapter.interface';
import { FireblocksAdapter } from './fireblocks_adapter';
import {
  FireblocksV1EventType,
  FireblocksV2EventType,
  IFireblocksAsset,
  IFireblocksCreateAccountResponse,
  IFireblocksCreateTransactionResponse,
  IFireBlocksCreateWalletResponse,
  IFireblocksResendWebhookResponse,
  IFireblocksVaultAccount,
  IFireblocksVaultAsset,
  IFireblocksWebhookV1Data,
  IFireblocksWebhookV1Payload,
  IFireblocksWebhookV2Data,
  IFireblocksWebhookV2Payload,
} from './fireblocks_interface';

describe('FireblocksAdapter', () => {
  let service: FireblocksAdapter;

  const mockAssets: IFireblocksAsset[] = [
    {
      id: '$USDT_ETH',
      name: 'Tether USD (ERC-20)',
      type: 'ERC20',
      nativeAsset: 'ETH',
      contractAddress: '0x123',
      decimals: 6,
    },
    {
      id: '$BTC',
      name: 'Bitcoin',
      type: 'coin',
      nativeAsset: 'BTC',
      decimals: 8,
    },
    {
      id: '$USDC_ETH',
      name: 'USD Coin (ERC-20)',
      type: 'ERC20',
      nativeAsset: 'ETH',
      contractAddress: '0xabc',
      decimals: 6,
    },
  ];

  const mockAccountResponse: IFireblocksCreateAccountResponse = {
    id: 'vault-123',
    name: 'Test User',
    assets: [],
    hiddenOnUI: false,
    autoFuel: false,
    customerRefId: 'user-123',
  };

  const mockWalletResponse: IFireBlocksCreateWalletResponse = {
    address: '0x123abc',
    legacyAddress: '0x456def',
    enterpriseAddress: '0x789ghi',
    tag: 'memo123',
    bip44AddressIndex: 0,
    customerRefId: 'user-123',
  };

  const mockVaultAccount: IFireblocksVaultAccount = {
    id: 'vault-123',
    name: 'Test Account',
    assets: [
      {
        id: 'ETH',
        total: '1.5',
        available: '1.0',
        pending: '0.5',
        frozen: '0',
        lockedAmount: '0',
      },
      {
        id: 'BTC',
        total: '0.25',
        available: '0.2',
        pending: '0.05',
        frozen: '0',
        lockedAmount: '0',
      },
    ],
    customerRefId: 'user-123',
    hiddenOnUI: false,
    autoFuel: false,
  };

  const mockVaultAsset: IFireblocksVaultAsset = {
    id: 'ETH',
    total: '1.5',
    available: '1.0',
    pending: '0.5',
    frozen: '0',
    lockedAmount: '0',
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [FireblocksAdapter],
    }).compile();

    service = module.get<FireblocksAdapter>(FireblocksAdapter);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('getAvailableStableAssets', () => {
    it('should return only stable assets that include "usd" in the name', async () => {
      jest.spyOn(FireblocksAdapter.prototype as any, 'get').mockResolvedValueOnce({
        data: mockAssets,
      });

      const result = await service.getAvailableStableAssets();

      expect(result).toEqual([
        {
          id: '$USDT_ETH',
          name: 'Tether USD (ERC-20)',
          type: 'ERC20',
          nativeAsset: 'ETH',
          decimals: 6,
        },
        {
          id: '$USDC_ETH',
          name: 'USD Coin (ERC-20)',
          type: 'ERC20',
          nativeAsset: 'ETH',
          decimals: 6,
        },
      ]);
    });

    it('should return an empty array when no assets are returned', async () => {
      jest.spyOn(FireblocksAdapter.prototype as any, 'get').mockResolvedValueOnce({ data: [] });

      const result = await service.getAvailableStableAssets();
      expect(result).toEqual([]);
    });

    it('should return an empty array when no asset names contain "usd"', async () => {
      jest.spyOn(FireblocksAdapter.prototype as any, 'get').mockResolvedValueOnce({
        data: [{ id: '$BTC', name: 'Bitcoin', type: 'coin', nativeAsset: 'BTC' }],
      });

      const result = await service.getAvailableStableAssets();
      expect(result).toEqual([]);
    });
  });

  describe('createAccount', () => {
    it('should successfully create an account and return transformed response', async () => {
      jest.spyOn(FireblocksAdapter.prototype as any, 'post').mockResolvedValueOnce({
        data: mockAccountResponse,
      });

      const result = await service.createAccount({
        user_name: 'Test User',
        user_id: 'user-123',
      });

      expect(result).toEqual({
        id: 'vault-123',
        name: 'Test User',
        user_id: 'user-123',
      });
    });

    it('should include all required fields in the request', async () => {
      const mockPost = jest
        .spyOn(FireblocksAdapter.prototype as any, 'post')
        .mockImplementationOnce(() => Promise.resolve({ data: mockAccountResponse }));

      await service.createAccount({
        user_name: 'Test User',
        user_id: 'user-123',
      });

      expect(mockPost).toHaveBeenCalledWith(
        '/v1/vault/accounts',
        {
          name: 'Test User',
          hiddenOnUI: false,
          customerRefId: 'user-123',
          autoFuel: true,
          vaultType: 'MPC',
        },
        undefined,
      );
    });

    it('should throw an error when account creation fails', async () => {
      jest
        .spyOn(FireblocksAdapter.prototype as any, 'post')
        .mockRejectedValueOnce(new InternalServerErrorException('API Error'));

      await expect(
        service.createAccount({
          user_name: 'Test User',
          user_id: 'user-123',
        }),
      ).rejects.toThrow(InternalServerErrorException);
    });

    it('should handle empty user name', async () => {
      jest.spyOn(FireblocksAdapter.prototype as any, 'post').mockResolvedValueOnce({
        data: {
          ...mockAccountResponse,
          name: '',
          customerRefId: 'user-123',
        },
      });

      const result = await service.createAccount({
        user_name: '',
        user_id: 'user-123',
      });

      expect(result.name).toEqual('');
    });

    it('should handle missing customerRefId in response', async () => {
      jest.spyOn(FireblocksAdapter.prototype as any, 'post').mockResolvedValueOnce({
        data: {
          ...mockAccountResponse,
          customerRefId: undefined,
        },
      });

      const result = await service.createAccount({
        user_name: 'Test User',
        user_id: 'user-123',
      });

      expect(result.user_id).toBeUndefined();
    });
  });

  describe('createWallet', () => {
    it('should successfully create wallets for multiple assets and return transformed response', async () => {
      const mockPost = jest
        .spyOn(FireblocksAdapter.prototype as any, 'post')
        .mockResolvedValueOnce({ data: mockWalletResponse }) // First asset success
        .mockResolvedValueOnce({ data: { ...mockWalletResponse, address: '0x456def' } }) // Second asset success
        .mockRejectedValueOnce(new Error('Unsupported asset')); // Third asset failure

      const result = await service.createWallet({
        provider_account_ref: 'vault-123',
        asset_ids: [{ asset_id: 'ETH' }, { asset_id: 'BTC' }, { asset_id: 'UNSUPPORTED' }],
        user_id: 'user-123',
      });

      expect(result).toEqual({
        successful: [
          {
            asset_id: 'ETH',
            address: '0x123abc',
            provider_account_ref: 'vault-123',
            user_id: 'user-123',
          },
          {
            asset_id: 'BTC',
            address: '0x456def',
            provider_account_ref: 'vault-123',
            user_id: 'user-123',
          },
        ],
        failed: [
          {
            asset_id: 'UNSUPPORTED',
            error: 'Unsupported asset',
          },
        ],
      });

      expect(mockPost).toHaveBeenCalledTimes(3);
    });

    it('should handle when all wallet creations fail', async () => {
      jest
        .spyOn(FireblocksAdapter.prototype as any, 'post')
        .mockRejectedValueOnce(new Error('API Error 1'))
        .mockRejectedValueOnce(new Error('API Error 2'));

      const result = await service.createWallet({
        provider_account_ref: 'vault-123',
        asset_ids: [{ asset_id: 'ETH' }, { asset_id: 'BTC' }],
        user_id: 'user-123',
      });

      expect(result).toEqual({
        successful: [],
        failed: [
          { asset_id: 'ETH', error: 'API Error 1' },
          { asset_id: 'BTC', error: 'API Error 2' },
        ],
      });
    });

    it('should handle when all wallet creations succeed', async () => {
      jest
        .spyOn(FireblocksAdapter.prototype as any, 'post')
        .mockResolvedValueOnce({ data: mockWalletResponse })
        .mockResolvedValueOnce({ data: { ...mockWalletResponse, address: '0x456def' } });

      const result = await service.createWallet({
        provider_account_ref: 'vault-123',
        asset_ids: [{ asset_id: 'ETH' }, { asset_id: 'BTC' }],
        user_id: 'user-123',
      });

      expect(result).toEqual({
        successful: [
          {
            asset_id: 'ETH',
            address: '0x123abc',
            provider_account_ref: 'vault-123',
            user_id: 'user-123',
          },
          {
            asset_id: 'BTC',
            address: '0x456def',
            provider_account_ref: 'vault-123',
            user_id: 'user-123',
          },
        ],
        failed: [],
      });
    });

    it('should include customerRefId in each request', async () => {
      const mockPost = jest.spyOn(FireblocksAdapter.prototype as any, 'post').mockImplementation((url: string) => {
        if (url.includes('ETH')) return Promise.resolve({ data: mockWalletResponse });
        if (url.includes('BTC')) return Promise.resolve({ data: mockWalletResponse });
        return Promise.reject(new Error('Unexpected call'));
      });

      await service.createWallet({
        provider_account_ref: 'vault-123',
        asset_ids: [{ asset_id: 'ETH' }, { asset_id: 'BTC' }],
        user_id: 'user-123',
      });

      expect(mockPost).toHaveBeenNthCalledWith(
        1,
        '/v1/vault/accounts/vault-123/ETH',
        {
          customerRefId: 'user-123',
        },
        null,
      );
      expect(mockPost).toHaveBeenNthCalledWith(
        2,
        '/v1/vault/accounts/vault-123/BTC',
        {
          customerRefId: 'user-123',
        },
        null,
      );
    });

    it('should handle empty asset_ids array', async () => {
      const result = await service.createWallet({
        provider_account_ref: 'vault-123',
        asset_ids: [],
        user_id: 'user-123',
      });

      expect(result).toEqual({
        successful: [],
        failed: [],
      });
    });

    it('should handle missing customerRefId in successful responses', async () => {
      jest
        .spyOn(FireblocksAdapter.prototype as any, 'post')
        .mockResolvedValueOnce({ data: { ...mockWalletResponse, customerRefId: undefined } });

      const result = await service.createWallet({
        provider_account_ref: 'vault-123',
        asset_ids: [{ asset_id: 'ETH' }],
        user_id: 'user-123',
      });

      expect(result.successful[0].user_id).toBeUndefined();
    });
  });

  describe('getVaultAccount', () => {
    it('should successfully fetch a vault account and transform the response', async () => {
      jest.spyOn(FireblocksAdapter.prototype as any, 'get').mockResolvedValueOnce({
        data: {
          ...mockVaultAccount,
          assets: [
            {
              id: 'USDC',
              total: '1000',
              available: '900',
              pending: '100',
              frozen: '0',
              lockedAmount: '0',
            },
            {
              id: 'USDT',
              total: '2000',
              available: '2000',
              pending: '0',
              frozen: '0',
              lockedAmount: '0',
            },
            {
              id: 'BTC',
              total: '0.25',
              available: '0.2',
              pending: '0.05',
              frozen: '0',
              lockedAmount: '0',
            },
          ],
        },
      });

      const result = await service.getVaultAccount('vault-123');

      expect(result).toEqual({
        id: 'vault-123',
        name: 'Test Account',
        user_id: 'user-123',
        assets: [
          {
            id: 'USDC',
            total: '1000',
            available: '900',
            pending: '100',
            frozen: '0',
            lockedAmount: '0',
          },
          {
            id: 'USDT',
            total: '2000',
            available: '2000',
            pending: '0',
            frozen: '0',
            lockedAmount: '0',
          },
        ],
      });
    });

    it('should handle vault account with no assets', async () => {
      jest.spyOn(FireblocksAdapter.prototype as any, 'get').mockResolvedValueOnce({
        data: {
          ...mockVaultAccount,
          assets: [],
        },
      });

      const result = await service.getVaultAccount('vault-123');

      expect(result.assets).toEqual([]);
    });

    it('should handle missing customerRefId', async () => {
      jest.spyOn(FireblocksAdapter.prototype as any, 'get').mockResolvedValueOnce({
        data: {
          ...mockVaultAccount,
          customerRefId: undefined,
        },
      });

      const result = await service.getVaultAccount('vault-123');

      expect(result.user_id).toBeUndefined();
    });

    it('should handle empty vault account name', async () => {
      jest.spyOn(FireblocksAdapter.prototype as any, 'get').mockResolvedValueOnce({
        data: {
          ...mockVaultAccount,
          name: '',
        },
      });

      const result = await service.getVaultAccount('vault-123');

      expect(result.name).toEqual('');
    });

    it('should throw an error when the vault account is not found', async () => {
      jest
        .spyOn(FireblocksAdapter.prototype as any, 'get')
        .mockRejectedValueOnce(new InternalServerErrorException('Vault account not found'));

      await expect(service.getVaultAccount('nonexistent-vault')).rejects.toThrow(InternalServerErrorException);
    });

    it('should handle missing optional fields in assets', async () => {
      jest.spyOn(FireblocksAdapter.prototype as any, 'get').mockResolvedValueOnce({
        data: {
          ...mockVaultAccount,
          assets: [
            {
              id: 'USDC',
              total: '1.5',
              available: '1.0',
              // Missing pending, lockedAmount
            },
            {
              id: 'BTC', // Should be filtered out
              total: '0.25',
              available: '0.2',
            },
          ],
        },
      });

      const result = await service.getVaultAccount('vault-123');

      expect(result.assets[0]).toEqual({
        id: 'USDC',
        total: '1.5',
        available: '1.0',
        pending: undefined,
        lockedAmount: undefined,
      });
    });
  });

  describe('getAssetBalance', () => {
    it('should successfully fetch an asset balance and transform the response', async () => {
      jest.spyOn(FireblocksAdapter.prototype as any, 'get').mockResolvedValueOnce({
        data: mockVaultAsset,
      });

      const result = await service.getAssetBalance('vault-123', 'ETH');

      expect(result).toEqual({
        id: 'ETH',
        total: '1.5',
        available: '1.0',
        pending: '0.5',
        lockedAmount: '0',
      });
    });

    it('should handle missing optional fields in asset balance', async () => {
      jest.spyOn(FireblocksAdapter.prototype as any, 'get').mockResolvedValueOnce({
        data: {
          id: 'ETH',
          total: '1.5',
          available: '1.0',
          // Missing pending, lockedAmount
        },
      });

      const result = await service.getAssetBalance('vault-123', 'ETH');

      expect(result).toEqual({
        id: 'ETH',
        total: '1.5',
        available: '1.0',
        pending: undefined,
        lockedAmount: undefined,
      });
    });

    it('should throw an error when the vault account is not found', async () => {
      jest
        .spyOn(FireblocksAdapter.prototype as any, 'get')
        .mockRejectedValueOnce(new InternalServerErrorException('Vault account not found'));

      await expect(service.getAssetBalance('nonexistent-vault', 'ETH')).rejects.toThrow(InternalServerErrorException);
    });

    it('should throw an error when the asset is not found', async () => {
      jest
        .spyOn(FireblocksAdapter.prototype as any, 'get')
        .mockRejectedValueOnce(new InternalServerErrorException('Asset not found'));

      await expect(service.getAssetBalance('vault-123', 'UNKNOWN')).rejects.toThrow(InternalServerErrorException);
    });

    it('should handle zero balances', async () => {
      jest.spyOn(FireblocksAdapter.prototype as any, 'get').mockResolvedValueOnce({
        data: {
          ...mockVaultAsset,
          total: '0',
          available: '0',
          pending: '0',
          lockedAmount: '0',
        },
      });

      const result = await service.getAssetBalance('vault-123', 'ETH');

      expect(result).toEqual({
        id: 'ETH',
        total: '0',
        available: '0',
        pending: '0',
        lockedAmount: '0',
      });
    });

    it('should handle very large balances', async () => {
      const largeBalance = '1000000000000000000000000'; // 1e24
      jest.spyOn(FireblocksAdapter.prototype as any, 'get').mockResolvedValueOnce({
        data: {
          ...mockVaultAsset,
          total: largeBalance,
          available: largeBalance,
          pending: '0',
          lockedAmount: '0',
        },
      });

      const result = await service.getAssetBalance('vault-123', 'ETH');

      expect(result).toEqual({
        id: 'ETH',
        total: largeBalance,
        available: largeBalance,
        pending: '0',
        lockedAmount: '0',
      });
    });
  });

  describe('estimateTransactionFee', () => {
    it('should estimate fees successfully for a valid request with address and tag', async () => {
      const mockFeeResponse = {
        networkFee: '0.001',
        gasPrice: '100',
        maxFeePerGas: '200',
        maxPriorityFeePerGas: '150',
      };

      const spy = jest
        .spyOn(FireblocksAdapter.prototype as any, 'post')
        .mockResolvedValueOnce({ data: mockFeeResponse });

      const result = await service.estimateTransactionFee({
        assetId: 'ETH',
        amount: '0.5',
        source: { type: 'VAULT_ACCOUNT', id: 'vault-123' },
        destination: {
          type: 'ONE_TIME_ADDRESS',
          address: '0xabc123',
          tag: 'memo-1',
        },
        feeLevel: 'MEDIUM',
      });

      expect(spy).toHaveBeenCalledWith(
        '/v1/transactions/estimate_fee',
        expect.objectContaining({
          assetId: 'ETH',
          amount: '0.5',
          source: { type: 'VAULT_ACCOUNT', id: 'vault-123' },
          destination: {
            type: 'ONE_TIME_ADDRESS',
            oneTimeAddress: { address: '0xabc123', tag: 'memo-1' },
          },
          feeLevel: 'MEDIUM',
          operation: 'TRANSFER',
        }),
      );

      expect(result).toEqual(mockFeeResponse);
    });

    it('should omit tag if not provided in destination', async () => {
      const mockFeeResponse = {
        networkFee: '0.002',
      };

      const spy = jest
        .spyOn(FireblocksAdapter.prototype as any, 'post')
        .mockResolvedValueOnce({ data: mockFeeResponse });

      const result = await service.estimateTransactionFee({
        assetId: 'ETH',
        amount: '1',
        source: { type: 'VAULT_ACCOUNT', id: 'vault-123' },
        destination: {
          type: 'ONE_TIME_ADDRESS',
          address: '0xabc456',
          // tag omitted
        },
      });

      expect(spy).toHaveBeenCalledWith(
        '/v1/transactions/estimate_fee',
        expect.objectContaining({
          destination: {
            type: 'ONE_TIME_ADDRESS',
            oneTimeAddress: { address: '0xabc456' },
          },
        }),
      );

      expect(result).toEqual(mockFeeResponse);
    });

    it('should throw InternalServerErrorException when API fails', async () => {
      jest.spyOn(FireblocksAdapter.prototype as any, 'post').mockRejectedValueOnce(new Error('API failure'));

      await expect(
        service.estimateTransactionFee({
          assetId: 'ETH',
          amount: '0.1',
          source: { type: 'VAULT_ACCOUNT', id: 'vault-123' },
          destination: {
            type: 'ONE_TIME_ADDRESS',
            address: '0xabc789',
          },
        }),
      ).rejects.toThrow(InternalServerErrorException);
    });

    it('should default feeLevel and operation when not provided', async () => {
      const mockFeeResponse = {
        networkFee: '0.003',
      };

      const spy = jest
        .spyOn(FireblocksAdapter.prototype as any, 'post')
        .mockResolvedValueOnce({ data: mockFeeResponse });

      const result = await service.estimateTransactionFee({
        assetId: 'USDC',
        amount: '10',
        source: { type: 'VAULT_ACCOUNT', id: 'vault-001' },
        destination: { type: 'VAULT_ACCOUNT', id: 'vault-002' },
      });

      expect(spy).toHaveBeenCalledWith(
        '/v1/transactions/estimate_fee',
        expect.objectContaining({
          operation: 'TRANSFER',
          feeLevel: 'HIGH',
        }),
      );

      expect(result).toEqual(mockFeeResponse);
    });

    it('should handle missing destination.address gracefully for non-one-time destinations', async () => {
      const mockFeeResponse = { networkFee: '0.0005' };

      jest.spyOn(FireblocksAdapter.prototype as any, 'post').mockResolvedValueOnce({ data: mockFeeResponse });

      const result = await service.estimateTransactionFee({
        assetId: 'ETH',
        amount: '0.01',
        source: { type: 'VAULT_ACCOUNT', id: 'vault-001' },
        destination: { type: 'VAULT_ACCOUNT', id: 'vault-002' }, // No address
      });

      expect(result).toEqual(mockFeeResponse);
    });
  });

  describe('createTransaction', () => {
    const mockTransactionResponse: IFireblocksCreateTransactionResponse = {
      id: 'txn-123456',
      status: 'SUBMITTED',
      externalTxId: 'ext-789012',
    };

    it('should successfully create a vault-to-vault transfer', async () => {
      const mockPost = jest
        .spyOn(FireblocksAdapter.prototype as any, 'post')
        .mockResolvedValueOnce({ data: mockTransactionResponse });

      const result = await service.createTransaction({
        assetId: 'ETH',
        source: {
          type: 'VAULT_ACCOUNT',
          id: 'vault-123',
        },
        destination: {
          type: 'VAULT_ACCOUNT',
          id: 'vault-456',
        },
        amount: '1.5',
        note: 'Internal transfer',
        feeLevel: 'MEDIUM',
      });

      expect(mockPost).toHaveBeenCalledWith(
        '/v1/transactions',
        expect.objectContaining({
          operation: 'TRANSFER',
          assetId: 'ETH',
          source: {
            type: 'VAULT_ACCOUNT',
            id: 'vault-123',
          },
          destination: {
            type: 'VAULT_ACCOUNT',
            id: 'vault-456',
          },
          amount: '1.5',
          note: 'Internal transfer',
          feeLevel: 'MEDIUM',
        }),
        undefined,
      );

      expect(result).toEqual({
        id: 'txn-123456',
        status: 'SUBMITTED',
        externalTxId: 'ext-789012',
      });
    });

    it('should successfully create an external transfer with destination address', async () => {
      const mockPost = jest
        .spyOn(FireblocksAdapter.prototype as any, 'post')
        .mockResolvedValueOnce({ data: mockTransactionResponse });

      const result = await service.createTransaction({
        assetId: 'USDC',
        source: {
          type: 'VAULT_ACCOUNT',
          id: 'vault-123',
        },
        destination: {
          type: 'ONE_TIME_ADDRESS',
          address: '0x742d35Cc6634C0532925a3b844Bc454e4438f44e',
        },
        amount: '1000',
        note: 'Customer withdrawal',
      });

      expect(mockPost).toHaveBeenCalledWith(
        '/v1/transactions',
        expect.objectContaining({
          destination: {
            type: 'ONE_TIME_ADDRESS',
            oneTimeAddress: {
              address: '0x742d35Cc6634C0532925a3b844Bc454e4438f44e',
            },
          },
        }),
        undefined,
      );

      expect(result).toEqual({
        id: 'txn-123456',
        status: 'SUBMITTED',
        externalTxId: 'ext-789012',
      });
    });

    it('should handle XRP transfer with destination tag', async () => {
      const mockPost = jest
        .spyOn(FireblocksAdapter.prototype as any, 'post')
        .mockResolvedValueOnce({ data: mockTransactionResponse });

      const result = await service.createTransaction({
        assetId: 'XRP',
        source: {
          type: 'VAULT_ACCOUNT',
          id: 'vault-123',
        },
        destination: {
          type: 'ONE_TIME_ADDRESS',
          address: 'rPEPPER7kfTD9w2To4CQk6UCfuHM9c6GDY',
          tag: '123456',
        },
        amount: '500',
      });

      expect(mockPost).toHaveBeenCalledWith(
        '/v1/transactions',
        expect.objectContaining({
          destination: {
            type: 'ONE_TIME_ADDRESS',
            oneTimeAddress: {
              address: 'rPEPPER7kfTD9w2To4CQk6UCfuHM9c6GDY',
              tag: '123456',
            },
          },
        }),
        undefined,
      );

      expect(result).toEqual({
        id: 'txn-123456',
        status: 'SUBMITTED',
        externalTxId: 'ext-789012',
      });
    });

    it('should include travel rule information when provided', async () => {
      const mockPost = jest
        .spyOn(FireblocksAdapter.prototype as any, 'post')
        .mockResolvedValueOnce({ data: mockTransactionResponse });

      const result = await service.createTransaction({
        assetId: 'USDC',
        source: {
          type: 'VAULT_ACCOUNT',
          id: 'vault-123',
        },
        destination: {
          type: 'ONE_TIME_ADDRESS',
          address: '0x742d35Cc6634C0532925a3b844Bc454e4438f44e',
        },
        amount: '5000',
        travelRuleMessage: {
          originatorVASPdid: 'did:example:123',
          beneficiaryVASPdid: 'did:example:456',
          originatorVASPname: 'Our Exchange',
          beneficiaryVASPname: 'Recipient Exchange',
          originatorProof: {
            type: 'eip-191',
            proof: '0x123abc',
            attestation: 'I certify this address belongs to me',
          },
        },
      });

      expect(mockPost).toHaveBeenCalledWith(
        '/v1/transactions',
        expect.objectContaining({
          travelRuleMessage: {
            originatorVASPdid: 'did:example:123',
            beneficiaryVASPdid: 'did:example:456',
            originatorVASPname: 'Our Exchange',
            beneficiaryVASPname: 'Recipient Exchange',
            originatorProof: {
              type: 'eip-191',
              proof: '0x123abc',
              attestation: 'I certify this address belongs to me',
            },
          },
        }),
        undefined,
      );

      expect(result).toEqual({
        id: 'txn-123456',
        status: 'SUBMITTED',
        externalTxId: 'ext-789012',
      });
    });

    it('should use idempotency key when provided', async () => {
      const mockPost = jest
        .spyOn(FireblocksAdapter.prototype as any, 'post')
        .mockResolvedValueOnce({ data: mockTransactionResponse });

      const idempotencyKey = 'idemp-123456';

      await service.createTransaction({
        assetId: 'ETH',
        source: {
          type: 'VAULT_ACCOUNT',
          id: 'vault-123',
        },
        destination: {
          type: 'VAULT_ACCOUNT',
          id: 'vault-456',
        },
        amount: '1.5',
        idempotencyKey,
      });

      expect(mockPost).toHaveBeenCalledWith('/v1/transactions', expect.anything(), idempotencyKey);
    });

    it('should throw InternalServerErrorException when API fails', async () => {
      jest.spyOn(FireblocksAdapter.prototype as any, 'post').mockRejectedValueOnce(new Error('API Error'));

      await expect(
        service.createTransaction({
          assetId: 'ETH',
          source: {
            type: 'VAULT_ACCOUNT',
            id: 'vault-123',
          },
          destination: {
            type: 'VAULT_ACCOUNT',
            id: 'vault-456',
          },
          amount: '1.5',
        }),
      ).rejects.toThrow(InternalServerErrorException);
    });

    it('should handle fee parameters correctly', async () => {
      const mockPost = jest
        .spyOn(FireblocksAdapter.prototype as any, 'post')
        .mockResolvedValueOnce({ data: mockTransactionResponse });

      await service.createTransaction({
        assetId: 'ETH',
        source: {
          type: 'VAULT_ACCOUNT',
          id: 'vault-123',
        },
        destination: {
          type: 'VAULT_ACCOUNT',
          id: 'vault-456',
        },
        amount: '1.5',
        feeLevel: 'HIGH',
        maxFee: '0.01',
        priorityFee: '100',
        gasLimit: '21000',
      });

      expect(mockPost).toHaveBeenCalledWith(
        '/v1/transactions',
        expect.objectContaining({
          feeLevel: 'HIGH',
          maxFee: '0.01',
          priorityFee: '100',
          gasLimit: '21000',
        }),
        undefined,
      );
    });

    it('should default to TRANSFER operation when not specified', async () => {
      const mockPost = jest
        .spyOn(FireblocksAdapter.prototype as any, 'post')
        .mockResolvedValueOnce({ data: mockTransactionResponse });

      await service.createTransaction({
        assetId: 'ETH',
        source: {
          type: 'VAULT_ACCOUNT',
          id: 'vault-123',
        },
        destination: {
          type: 'VAULT_ACCOUNT',
          id: 'vault-456',
        },
        amount: '1.5',
      });

      expect(mockPost).toHaveBeenCalledWith(
        '/v1/transactions',
        expect.objectContaining({
          operation: 'TRANSFER',
        }),
        undefined,
      );
    });
  });

  describe('getTransactionHistory', () => {
    const mockPaginatedResponse = {
      data: {
        transactions: [
          {
            id: 'txn-123',
            externalTxId: 'ext-123',
            status: 'COMPLETED',
            operation: 'TRANSFER',
            assetId: 'ETH',
            source: {
              type: 'VAULT_ACCOUNT',
              id: 'vault-123',
              sourceAddress: '0x123abc',
            },
            destination: {
              type: 'VAULT_ACCOUNT',
              id: 'vault-456',
              destinationAddress: '0x456def',
            },
            amountInfo: {
              amount: '1.5',
            },
            feeInfo: {
              networkFee: '0.001',
            },
            txHash: '0x789012',
            createdAt: Date.now(),
            lastUpdated: Date.now(),
          },
        ],
        pageDetails: {
          prevPage: 'prev123',
          nextPage: 'next456',
        },
      },
      status: 200,
      statusText: 'OK',
    };

    beforeEach(() => {
      jest.spyOn(FireblocksAdapter.prototype as any, 'getPaginated').mockResolvedValue(mockPaginatedResponse);
    });

    it('should fetch transactions with default parameters', async () => {
      const result = await service.getTransactionHistory({});

      expect(result).toEqual({
        transactions: [
          {
            id: 'txn-123',
            externalTxId: 'ext-123',
            status: 'COMPLETED',
            operation: 'TRANSFER',
            assetId: 'ETH',
            source: {
              type: 'VAULT_ACCOUNT',
              id: 'vault-123',
              address: '0x123abc',
            },
            destination: {
              type: 'VAULT_ACCOUNT',
              id: 'vault-456',
              address: '0x456def',
            },
            amount: '1.5',
            fee: '0.001',
            txHash: '0x789012',
            createdAt: expect.any(Date),
            lastUpdated: expect.any(Date),
          },
        ],
        nextPageToken: 'next456',
      });
    });

    it('should convert Date objects to timestamps for before/after', async () => {
      const date = new Date('2023-01-01');
      await service.getTransactionHistory({
        before: date,
        after: date,
      });

      const callParams = (service as any).getPaginated.mock.calls[0][1];
      expect(callParams.before).toBe(date.getTime().toString());
      expect(callParams.after).toBe(date.getTime().toString());
    });

    it('should use numeric timestamps directly for before/after', async () => {
      const timestamp = Date.now();
      await service.getTransactionHistory({
        before: timestamp,
        after: timestamp,
      });

      const callParams = (service as any).getPaginated.mock.calls[0][1];
      expect(callParams.before).toBe(timestamp.toString());
      expect(callParams.after).toBe(timestamp.toString());
    });

    it('should include all filter parameters in the request', async () => {
      const params: ITransactionHistoryParams = {
        sourceId: 'vault-123',
        assetId: 'ETH',
        status: 'COMPLETED',
        sourceType: 'VAULT_ACCOUNT',
        destType: 'VAULT_ACCOUNT',
        limit: 50,
        orderBy: 'createdAt',
        sort: 'DESC',
        nextPageToken: 'page123',
      };

      await service.getTransactionHistory(params);

      const callParams = (service as any).getPaginated.mock.calls[0][1];
      expect(callParams).toEqual({
        sourceId: 'vault-123',
        assetId: 'ETH',
        status: 'COMPLETED',
        sourceType: 'VAULT_ACCOUNT',
        destType: 'VAULT_ACCOUNT',
        limit: '50',
        orderBy: 'createdAt',
        sort: 'DESC',
        pageToken: 'page123',
      });
    });

    it('should handle transactions without destination', async () => {
      (service as any).getPaginated.mockResolvedValueOnce({
        data: {
          transactions: [
            {
              id: 'txn-456',
              status: 'FAILED',
              operation: 'BURN',
              assetId: 'ETH',
              source: {
                type: 'VAULT_ACCOUNT',
                id: 'vault-123',
                sourceAddress: '0x123abc',
              },
              // No destination
              amountInfo: { amount: '1.0' },
              createdAt: Date.now(),
              lastUpdated: Date.now(),
            },
          ],
          pageDetails: {},
        },
        status: 200,
        statusText: 'OK',
      });

      const result = await service.getTransactionHistory({});
      expect(result.transactions[0].destination).toBeUndefined();
    });

    it('should handle transactions without fee info', async () => {
      (service as any).getPaginated.mockResolvedValueOnce({
        data: {
          transactions: [
            {
              id: 'txn-789',
              status: 'PENDING',
              operation: 'MINT',
              assetId: 'USDC',
              source: { type: 'VAULT_ACCOUNT', id: 'vault-123' },
              destination: { type: 'VAULT_ACCOUNT', id: 'vault-456' },
              amountInfo: { amount: '100' },
              // No feeInfo
              createdAt: Date.now(),
              lastUpdated: Date.now(),
            },
          ],
          pageDetails: {},
        },
        status: 200,
        statusText: 'OK',
      });

      const result = await service.getTransactionHistory({});
      expect(result.transactions[0].fee).toBeUndefined();
    });

    it('should throw InternalServerErrorException when API fails', async () => {
      (service as any).getPaginated.mockRejectedValueOnce(new Error('API Error'));

      await expect(service.getTransactionHistory({})).rejects.toThrow(InternalServerErrorException);
    });

    it('should handle empty transactions response', async () => {
      (service as any).getPaginated.mockResolvedValueOnce({
        data: {
          transactions: [],
          pageDetails: {},
        },
        status: 200,
        statusText: 'OK',
      });

      const result = await service.getTransactionHistory({});
      expect(result.transactions).toEqual([]);
      expect(result.nextPageToken).toBeUndefined();
    });

    it('should handle missing pagination details', async () => {
      (service as any).getPaginated.mockResolvedValueOnce({
        data: {
          transactions: mockPaginatedResponse.data.transactions,
          pageDetails: {}, // No next/prev page
        },
        status: 200,
        statusText: 'OK',
      });

      const result = await service.getTransactionHistory({});
      expect(result.nextPageToken).toBeUndefined();
    });

    it('should log the request and response', async () => {
      const loggerSpy = jest.spyOn(service['logger'], 'log');

      await service.getTransactionHistory({ assetId: 'ETH' });

      expect(loggerSpy).toHaveBeenCalledWith('Fetching transaction history with params:', { assetId: 'ETH' });
      expect(loggerSpy).toHaveBeenCalledWith('Fetched 1 transactions');
    });

    it('should handle transactions with one-time addresses', async () => {
      (service as any).getPaginated.mockResolvedValueOnce({
        data: {
          transactions: [
            {
              id: 'txn-789',
              status: 'COMPLETED',
              operation: 'TRANSFER',
              assetId: 'BTC',
              source: { type: 'VAULT_ACCOUNT', id: 'vault-123' },
              destination: {
                type: 'ONE_TIME_ADDRESS',
                destinationAddress: 'bc1qxyz',
                destinationTag: 'memo123',
              },
              amountInfo: { amount: '0.5' },
              feeInfo: { networkFee: '0.0001' },
              txHash: 'abc123',
              createdAt: Date.now(),
              lastUpdated: Date.now(),
            },
          ],
          pageDetails: {},
        },
        status: 200,
        statusText: 'OK',
      });

      const result = await service.getTransactionHistory({});
      expect(result.transactions[0].destination).toEqual({
        type: 'ONE_TIME_ADDRESS',
        address: 'bc1qxyz',
        tag: 'memo123',
      });
    });
  });

  describe('getTransaction', () => {
    const mockTransactionResponse = {
      id: 'txn-123',
      externalTxId: 'ext-123',
      status: 'COMPLETED',
      operation: 'TRANSFER',
      assetId: 'ETH',
      source: {
        type: 'VAULT_ACCOUNT',
        id: 'vault-123',
        sourceAddress: '0x123abc',
      },
      destination: {
        type: 'VAULT_ACCOUNT',
        id: 'vault-456',
        destinationAddress: '0x456def',
      },
      amountInfo: {
        amount: '1.5',
      },
      feeInfo: {
        networkFee: '0.001',
      },
      txHash: '0x789012',
      createdAt: Date.now(),
      lastUpdated: Date.now(),
    };

    beforeEach(() => {
      jest.spyOn(FireblocksAdapter.prototype as any, 'get').mockImplementation((path: string) => {
        if (path.includes('/external_tx_id/')) {
          return Promise.resolve({ data: mockTransactionResponse });
        }
        return Promise.resolve({ data: mockTransactionResponse });
      });
    });

    it('should fetch transaction by Fireblocks ID', async () => {
      const result = await service.getTransaction({ txId: 'txn-123' });

      expect((service as any).get).toHaveBeenCalledWith('/v1/transactions/txn-123');
      expect(result).toEqual({
        id: 'txn-123',
        externalTxId: 'ext-123',
        status: 'COMPLETED',
        operation: 'TRANSFER',
        assetId: 'ETH',
        source: {
          type: 'VAULT_ACCOUNT',
          id: 'vault-123',
          address: '0x123abc',
        },
        destination: {
          type: 'VAULT_ACCOUNT',
          id: 'vault-456',
          address: '0x456def',
        },
        amount: '1.5',
        fee: '0.001',
        txHash: '0x789012',
        createdAt: expect.any(Date),
        lastUpdated: expect.any(Date),
      });
    });

    it('should fetch transaction by external ID', async () => {
      const result = await service.getTransaction({ externalTxId: 'ext-123' });

      expect((service as any).get).toHaveBeenCalledWith('/v1/transactions/external_tx_id/ext-123');
      expect(result).toEqual({
        id: 'txn-123',
        externalTxId: 'ext-123',
        status: 'COMPLETED',
        operation: 'TRANSFER',
        assetId: 'ETH',
        source: {
          type: 'VAULT_ACCOUNT',
          id: 'vault-123',
          address: '0x123abc',
        },
        destination: {
          type: 'VAULT_ACCOUNT',
          id: 'vault-456',
          address: '0x456def',
        },
        amount: '1.5',
        fee: '0.001',
        txHash: '0x789012',
        createdAt: expect.any(Date),
        lastUpdated: expect.any(Date),
      });
    });

    it('should prioritize Fireblocks ID when both are provided', async () => {
      const result = await service.getTransaction({ txId: 'txn-123', externalTxId: 'ext-123' });

      expect((service as any).get).toHaveBeenCalledWith('/v1/transactions/txn-123');
      expect(result).toBeDefined();
    });

    it('should throw error when neither ID is provided', async () => {
      await expect(service.getTransaction({})).rejects.toThrow('Either txId or externalTxId must be provided');
    });

    it('should handle transaction without destination', async () => {
      (service as any).get.mockResolvedValueOnce({
        data: {
          ...mockTransactionResponse,
          destination: undefined,
        },
      });

      const result = await service.getTransaction({ txId: 'txn-123' });
      expect(result.destination).toBeUndefined();
    });

    it('should handle transaction without fee info', async () => {
      (service as any).get.mockResolvedValueOnce({
        data: {
          ...mockTransactionResponse,
          feeInfo: undefined,
        },
      });

      const result = await service.getTransaction({ txId: 'txn-123' });
      expect(result.fee).toBeUndefined();
    });

    it('should throw InternalServerErrorException when API fails', async () => {
      (service as any).get.mockRejectedValueOnce(new Error('API Error'));

      await expect(service.getTransaction({ txId: 'txn-123' })).rejects.toThrow(InternalServerErrorException);
    });

    it('should log appropriate messages for Fireblocks ID lookup', async () => {
      const loggerSpy = jest.spyOn(service['logger'], 'log');

      await service.getTransaction({ txId: 'txn-123' });

      expect(loggerSpy).toHaveBeenCalledWith('Fetching transaction by Fireblocks ID: txn-123');
    });

    it('should log appropriate messages for external ID lookup', async () => {
      const loggerSpy = jest.spyOn(service['logger'], 'log');

      await service.getTransaction({ externalTxId: 'ext-123' });

      expect(loggerSpy).toHaveBeenCalledWith('Fetching transaction by external ID: ext-123');
    });

    it('should handle transaction with one-time address destination', async () => {
      (service as any).get.mockResolvedValueOnce({
        data: {
          ...mockTransactionResponse,
          destination: {
            type: 'ONE_TIME_ADDRESS',
            destinationAddress: '0x987xyz',
            destinationTag: 'memo456',
          },
        },
      });

      const result = await service.getTransaction({ txId: 'txn-123' });
      expect(result.destination).toEqual({
        type: 'ONE_TIME_ADDRESS',
        address: '0x987xyz',
        tag: 'memo456',
      });
    });
  });

  describe('verifyWebhookSignature', () => {
    it('should verify v1 webhook signature successfully', async () => {
      jest.spyOn(FireblocksConfigProvider.prototype, 'getConfig').mockReturnValue({
        webhookPublicKey: 'test-public-key',
      } as any);

      const mockVerifier = {
        write: jest.fn(),
        end: jest.fn(),
        verify: jest.fn().mockReturnValue(true),
      };
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      jest.spyOn(require('crypto'), 'createVerify').mockReturnValue(mockVerifier);

      const result = await (service as any).verifyWebhookSignature('test-payload', 'test-signature', '12345', 'v1');

      expect(result).toBe(true);
      expect(mockVerifier.verify).toHaveBeenCalledWith('test-public-key', 'test-signature', 'base64');
    });

    it('should return false for invalid v1 signature', async () => {
      jest.spyOn(FireblocksConfigProvider.prototype, 'getConfig').mockReturnValue({
        webhookPublicKey: 'test-public-key',
      } as any);

      const mockVerifier = {
        write: jest.fn(),
        end: jest.fn(),
        verify: jest.fn().mockReturnValue(false),
      };
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      jest.spyOn(require('crypto'), 'createVerify').mockReturnValue(mockVerifier);

      const result = await (service as any).verifyWebhookSignature('test-payload', 'test-signature', '12345', 'v1');

      expect(result).toBe(false);
    });

    it('should verify v2 webhook signature successfully', async () => {
      jest.spyOn(FireblocksConfigProvider.prototype, 'getConfig').mockReturnValue({
        webhookPublicKey: 'test-secret-key',
      } as any);

      const mockHmac = {
        update: jest.fn().mockReturnThis(),
        digest: jest.fn().mockReturnValue('expected-signature'),
      };
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      jest.spyOn(require('crypto'), 'createHmac').mockReturnValue(mockHmac);
      jest.spyOn(Date, 'now').mockReturnValue(12345678000); // Current time in ms

      const result = await (service as any).verifyWebhookSignature(
        'test-payload',
        'expected-signature',
        '12345678', // Timestamp within 5 minutes
        'v2',
      );

      expect(result).toBe(true);
    });

    it('should return false for expired v2 timestamp', async () => {
      jest.spyOn(FireblocksConfigProvider.prototype, 'getConfig').mockReturnValue({
        webhookPublicKey: 'test-secret-key',
      } as any);

      jest.spyOn(Date, 'now').mockReturnValue(12345678000); // Current time in ms

      const result = await (service as any).verifyWebhookSignature(
        'test-payload',
        'expected-signature',
        '12345000', // Timestamp more than 5 minutes old
        'v2',
      );

      expect(result).toBe(false);
    });
  });

  const mockV1WebhookData: IFireblocksWebhookV1Data = {
    id: 'txn-123',
    createdAt: 1234567800,
    lastUpdated: 1234567890,
    assetId: 'ETH',
    source: {
      id: 'vault-123',
      type: 'VAULT_ACCOUNT',
      name: 'Source Vault',
      subType: '',
    },
    destination: {
      id: 'vault-456',
      type: 'VAULT_ACCOUNT',
      name: 'Destination Vault',
      subType: '',
    },
    amount: 1.5,
    sourceAddress: '0xsource',
    destinationAddress: '0xdest',
    destinationAddressDescription: 'Destination',
    destinationTag: 'tag123',
    status: 'COMPLETED',
    txHash: '0x123abc',
    subStatus: '',
    signedBy: ['user1'],
    createdBy: 'user1',
    rejectedBy: '',
    amountUSD: 4500,
    addressType: 'WHITELISTED',
    note: 'Test transaction',
    exchangeTxId: '',
    requestedAmount: 1.5,
    feeCurrency: 'ETH',
    operation: 'TRANSFER',
    customerRefId: 'cust-123',
    amountInfo: {
      amount: '1.5',
      requestedAmount: '1.5',
      amountUSD: '4500',
    },
    feeInfo: {
      networkFee: '0.001',
    },
    destinations: [],
    externalTxId: 'ext-123',
    blockInfo: {
      blockHash: '0xblockhash',
      blockHeight: '123456',
    },
    signedMessages: [],
    assetType: 'BASE_ASSET',
    networkFee: 0.001,
    netAmount: 1.499,
    numOfConfirmations: 12,
  };

  const mockV2WebhookData: IFireblocksWebhookV2Data = {
    id: 'txn-123',
    externalTxId: 'ext-123',
    status: 'COMPLETED',
    subStatus: '',
    txHash: '0x123abc',
    operation: 'TRANSFER',
    note: 'Test transaction',
    assetId: 'ETH',
    assetType: 'BASE_ASSET',
    source: {
      type: 'VAULT_ACCOUNT',
      id: 'vault-123',
      name: 'Source Vault',
    },
    sourceAddress: '0xsource',
    destination: {
      type: 'VAULT_ACCOUNT',
      id: 'vault-456',
      name: 'Destination Vault',
    },
    destinations: [
      {
        amount: '1.5',
        destination: {
          type: 'VAULT_ACCOUNT',
          id: 'vault-456',
        },
      },
    ],
    destinationAddress: '0xdest',
    destinationAddressDescription: 'Destination',
    destinationTag: 'tag123',
    amountInfo: {
      amount: '1.5',
      requestedAmount: '1.5',
      netAmount: '1.499',
      amountUSD: '4500',
    },
    treatAsGrossAmount: false,
    feeInfo: {
      networkFee: '0.001',
      serviceFee: '0',
    },
    feeCurrency: 'ETH',
    networkRecords: [],
    createdAt: 1234567800,
    lastUpdated: 1234567890,
    createdBy: 'user1',
    signedBy: ['user1'],
    rejectedBy: '',
    authorizationInfo: {},
    exchangeTxId: '',
    customerRefId: 'cust-123',
    amlScreeningResult: {},
    replacedTxHash: '',
    extraParameters: {},
    signedMessages: [],
    numOfConfirmations: 12,
    blockInfo: {
      blockHash: '0xblockhash',
      blockHeight: 123456,
    },
    index: 0,
    blockchainIndex: '0',
    rewardsInfo: {},
    systemMessages: [
      {
        type: 'WARN',
        message: 'Test warning',
      },
    ],
    addressType: 'WHITELISTED',
    requestedAmount: 1.5,
    amount: 1.5,
    netAmount: 1.499,
    amountUSD: 4500,
    serviceFee: 0,
    networkFee: 0.001,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [FireblocksAdapter],
    }).compile();

    service = module.get<FireblocksAdapter>(FireblocksAdapter);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('handleWebhook', () => {
    it('should process v1 webhook successfully', async () => {
      const v1Payload: IFireblocksWebhookV1Payload = {
        type: FireblocksV1EventType.TRANSACTION_STATUS_UPDATED,
        tenantId: 'tenant-123',
        timestamp: 1234567890,
        data: mockV1WebhookData,
      };

      jest.spyOn(service as any, 'verifyWebhookSignature').mockResolvedValue(true);

      const result = await service.handleWebhook(JSON.stringify(v1Payload), 'test-signature', undefined, 'v1');

      expect(result).toEqual({
        type: FireblocksV1EventType.TRANSACTION_STATUS_UPDATED,
        tenantId: 'tenant-123',
        timestamp: 1234567890,
        data: {
          id: 'txn-123',
          status: 'COMPLETED',
          subStatus: '',
          externalTxId: 'ext-123',
          txHash: '0x123abc',
          operation: 'TRANSFER',
          assetId: 'ETH',
          source: {
            type: 'VAULT_ACCOUNT',
            id: 'vault-123',
            sourceAddress: '0xsource',
          },
          destination: {
            type: 'VAULT_ACCOUNT',
            id: 'vault-456',
            destinationAddress: '0xdest',
            destinationTag: 'tag123',
          },
          amountInfo: {
            amount: '1.5',
          },
          feeInfo: {
            networkFee: '0.001',
          },
          createdAt: 1234567800,
          createdBy: 'user1',
          lastUpdated: 1234567890,
        },
      });
    });

    it('should process v2 webhook successfully', async () => {
      const v2Payload: IFireblocksWebhookV2Payload = {
        id: 'webhook-123',
        eventType: FireblocksV2EventType.TRANSACTION_STATUS_UPDATED,
        eventVersion: 2.0,
        resourceId: 'txn-123',
        data: mockV2WebhookData,
        createdAt: 1234567890,
        workspaceId: 'workspace-123',
      };

      jest.spyOn(service as any, 'verifyWebhookSignature').mockResolvedValue(true);

      const result = await service.handleWebhook(JSON.stringify(v2Payload), 'test-signature', '1234567890', 'v2');

      expect(result).toEqual({
        eventType: FireblocksV2EventType.TRANSACTION_STATUS_UPDATED,
        id: 'webhook-123',
        eventVersion: 2.0,
        resourceId: 'txn-123',
        createdAt: 1234567890,
        workspaceId: 'workspace-123',
        data: {
          id: 'txn-123',
          status: 'COMPLETED',
          subStatus: '',
          externalTxId: 'ext-123',
          txHash: '0x123abc',
          operation: 'TRANSFER',
          assetId: 'ETH',
          source: {
            type: 'VAULT_ACCOUNT',
            id: 'vault-123',
            sourceAddress: '0xsource',
          },
          destination: {
            type: 'VAULT_ACCOUNT',
            id: 'vault-456',
            destinationAddress: '0xdest',
            destinationTag: 'tag123',
          },
          amountInfo: {
            amount: '1.5',
          },
          feeInfo: {
            networkFee: '0.001',
            serviceFee: '0',
          },
          createdAt: 1234567800,
          createdBy: 'user1',
          lastUpdated: 1234567890,
        },
      });
    });

    it('should throw error for invalid signature', async () => {
      jest.spyOn(service as any, 'verifyWebhookSignature').mockResolvedValue(false);

      const v1Payload: IFireblocksWebhookV1Payload = {
        type: FireblocksV1EventType.TRANSACTION_STATUS_UPDATED,
        tenantId: 'tenant-123',
        timestamp: 1234567890,
        data: mockV1WebhookData,
      };

      await expect(
        service.handleWebhook(JSON.stringify(v1Payload), 'invalid-signature', undefined, 'v1'),
      ).rejects.toThrow('Invalid webhook signature');
    });

    it('should handle missing optional fields in v1 webhook', async () => {
      const minimalV1Payload: IFireblocksWebhookV1Payload = {
        type: FireblocksV1EventType.TRANSACTION_STATUS_UPDATED,
        tenantId: 'tenant-123',
        timestamp: 1234567890,
        data: {
          ...mockV1WebhookData,
          destination: undefined,
          feeInfo: undefined,
          externalTxId: null,
          txHash: '',
        },
      };

      jest.spyOn(service as any, 'verifyWebhookSignature').mockResolvedValue(true);

      const result = await service.handleWebhook(JSON.stringify(minimalV1Payload), 'test-signature', undefined, 'v1');

      expect((result.data as any).destination).toBeUndefined();
      expect((result.data as any).feeInfo).toBeUndefined();
      expect((result.data as any).externalTxId).toBeNull();
      expect((result.data as any).txHash).toBe('');
    });

    it('should handle missing optional fields in v2 webhook', async () => {
      const minimalV2Payload: IFireblocksWebhookV2Payload = {
        id: 'webhook-123',
        eventType: FireblocksV2EventType.TRANSACTION_STATUS_UPDATED,
        eventVersion: 2.0,
        data: {
          ...mockV2WebhookData,
          destination: undefined,
          feeInfo: undefined,
          externalTxId: '',
          txHash: '',
          blockInfo: undefined,
          systemMessages: [],
        },
        createdAt: 1234567890,
        workspaceId: 'workspace-123',
      };

      jest.spyOn(service as any, 'verifyWebhookSignature').mockResolvedValue(true);

      const result = await service.handleWebhook(
        JSON.stringify(minimalV2Payload),
        'test-signature',
        '1234567890',
        'v2',
      );

      expect((result.data as any).destination).toBeUndefined();
      expect((result.data as any).feeInfo).toBeUndefined();
      expect((result.data as any).externalTxId).toBe('');
      expect((result.data as any).txHash).toBe('');
    });
  });

  describe('resendWebhook', () => {
    it('should resend webhooks for specific transaction', async () => {
      const mockResponse: IFireblocksResendWebhookResponse = {
        success: true,
        message: 'Webhooks resent successfully',
      };

      jest.spyOn(service as any, 'post').mockResolvedValueOnce({
        data: mockResponse,
      });

      const result = await service.resendWebhook({
        txId: 'txn-123',
        resendCreated: true,
        resendStatusUpdated: true,
      });

      expect(result).toEqual(mockResponse);
      expect((service as any).post).toHaveBeenCalledWith('/v1/webhooks/resend/txn-123', {
        resendCreated: true,
        resendStatusUpdated: true,
      });
    });

    it('should resend all failed webhooks', async () => {
      const mockResponse = { messagesCount: 5 };

      jest.spyOn(service as any, 'post').mockResolvedValueOnce({
        data: mockResponse,
      });

      const result = await service.resendWebhook();

      expect(result).toEqual({
        messagesCount: 5,
        message: 'Successfully resent 5 webhooks',
      });
      expect((service as any).post).toHaveBeenCalledWith('/v1/webhooks/resend', {});
    });

    it('should throw error when API fails', async () => {
      jest.spyOn(service as any, 'post').mockRejectedValueOnce(new Error('API Error'));

      await expect(
        service.resendWebhook({
          txId: 'txn-123',
          resendCreated: true,
        }),
      ).rejects.toThrow(InternalServerErrorException);
    });
  });

  describe('normalizeWebhookData', () => {
    it('should normalize full v1 webhook data', () => {
      const v1Payload: IFireblocksWebhookV1Payload = {
        type: FireblocksV1EventType.TRANSACTION_STATUS_UPDATED,
        tenantId: 'tenant-123',
        timestamp: 1234567890,
        data: mockV1WebhookData,
      };

      const result = (service as any).normalizeWebhookData(v1Payload);

      expect(result).toEqual({
        type: FireblocksV1EventType.TRANSACTION_STATUS_UPDATED,
        tenantId: 'tenant-123',
        timestamp: 1234567890,
        data: {
          id: 'txn-123',
          status: 'COMPLETED',
          subStatus: '',
          externalTxId: 'ext-123',
          txHash: '0x123abc',
          operation: 'TRANSFER',
          assetId: 'ETH',
          source: {
            type: 'VAULT_ACCOUNT',
            id: 'vault-123',
            sourceAddress: '0xsource',
          },
          destination: {
            type: 'VAULT_ACCOUNT',
            id: 'vault-456',
            destinationAddress: '0xdest',
            destinationTag: 'tag123',
          },
          amountInfo: {
            amount: '1.5',
          },
          feeInfo: {
            networkFee: '0.001',
          },
          createdAt: 1234567800,
          createdBy: 'user1',
          lastUpdated: 1234567890,
        },
      });
    });

    it('should normalize full v2 webhook data', () => {
      const v2Payload: IFireblocksWebhookV2Payload = {
        id: 'webhook-123',
        eventType: FireblocksV2EventType.TRANSACTION_STATUS_UPDATED,
        eventVersion: 2.0,
        resourceId: 'txn-123',
        data: mockV2WebhookData,
        createdAt: 1234567890,
        workspaceId: 'workspace-123',
      };

      const result = (service as any).normalizeWebhookData(v2Payload);

      expect(result).toEqual({
        eventType: FireblocksV2EventType.TRANSACTION_STATUS_UPDATED,
        id: 'webhook-123',
        eventVersion: 2.0,
        resourceId: 'txn-123',
        createdAt: 1234567890,
        workspaceId: 'workspace-123',
        data: {
          id: 'txn-123',
          status: 'COMPLETED',
          subStatus: '',
          externalTxId: 'ext-123',
          txHash: '0x123abc',
          operation: 'TRANSFER',
          assetId: 'ETH',
          source: {
            type: 'VAULT_ACCOUNT',
            id: 'vault-123',
            sourceAddress: '0xsource',
          },
          destination: {
            type: 'VAULT_ACCOUNT',
            id: 'vault-456',
            destinationAddress: '0xdest',
            destinationTag: 'tag123',
          },
          amountInfo: {
            amount: '1.5',
          },
          feeInfo: {
            networkFee: '0.001',
            serviceFee: '0',
          },
          createdAt: 1234567800,
          createdBy: 'user1',
          lastUpdated: 1234567890,
        },
      });
    });
  });

  describe('event type mapping', () => {
    it('should map v1 to v2 event types correctly', () => {
      expect(service.mapV1ToV2EventType('VAULT_ACCOUNT_ADDED')).toBe('vault_account.created');
      expect(service.mapV1ToV2EventType('VAULT_ACCOUNT_ASSET_ADDED')).toBe('vault_account.asset.added');
      expect(service.mapV1ToV2EventType('UNKNOWN_EVENT')).toBe('UNKNOWN_EVENT');
    });

    it('should map v2 to v1 event types correctly', () => {
      expect(service.mapV2ToV1EventType('vault_account.created')).toBe('VAULT_ACCOUNT_ADDED');
      expect(service.mapV2ToV1EventType('vault_account.asset.added')).toBe('VAULT_ACCOUNT_ASSET_ADDED');
      expect(service.mapV2ToV1EventType('UNKNOWN_EVENT')).toBe('UNKNOWN_EVENT');
    });
  });
});
