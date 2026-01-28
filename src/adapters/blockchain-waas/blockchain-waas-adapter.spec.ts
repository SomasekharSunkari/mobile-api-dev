import { Test, TestingModule } from '@nestjs/testing';
import { FireblocksConfigProvider } from '../../config';
import { BlockchainWaasAdapter } from './blockchain-waas-adapter';
import { FireblocksAdapter } from './fireblocks/fireblocks_adapter';

jest.mock('../../config', () => ({
  FireblocksConfigProvider: jest.fn().mockImplementation(() => ({
    getConfig: jest.fn().mockReturnValue({
      default_blockchain_waas_adapter: 'fireblocks',
    }),
  })),
}));

describe('BlockchainWaasAdapter', () => {
  let adapter: BlockchainWaasAdapter;
  let fireblocksAdapter: jest.Mocked<FireblocksAdapter>;

  const mockFireblocksAdapter = {
    getAvailableStableAssets: jest.fn(),
    createAccount: jest.fn(),
    createWallet: jest.fn(),
    getVaultAccount: jest.fn(),
    getAssetBalance: jest.fn(),
    estimateTransactionFee: jest.fn(),
    createTransaction: jest.fn(),
    getTransactionHistory: jest.fn(),
    getTransaction: jest.fn(),
    internalTransfer: jest.fn(),
    externalTransfer: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BlockchainWaasAdapter,
        {
          provide: FireblocksAdapter,
          useValue: mockFireblocksAdapter,
        },
      ],
    }).compile();

    adapter = module.get<BlockchainWaasAdapter>(BlockchainWaasAdapter);
    fireblocksAdapter = module.get(FireblocksAdapter);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getProvider', () => {
    it('should return FireblocksAdapter when fireblocks is configured', () => {
      const provider = adapter.getProvider();
      expect(provider).toBe(fireblocksAdapter);
    });

    it('should throw error for unsupported provider', () => {
      // Create a new instance with unsupported provider
      const mockConfig = {
        default_blockchain_waas_adapter: 'unsupported',
      };
      (FireblocksConfigProvider as any).mockImplementationOnce(() => ({
        getConfig: jest.fn().mockReturnValue(mockConfig),
      }));

      expect(() => adapter.getProvider()).toThrow('Unsupported blockchain WaaS provider: unsupported');
    });
  });

  describe('getAvailableStableAssets', () => {
    it('should delegate to provider and return stable assets', async () => {
      const mockAssets = [
        {
          id: 'USDC',
          name: 'USD Coin',
          type: 'ERC20',
          nativeAsset: 'ETH',
        },
      ];
      fireblocksAdapter.getAvailableStableAssets.mockResolvedValueOnce(mockAssets);

      const result = await adapter.getAvailableStableAssets();
      expect(result).toEqual(mockAssets);
      expect(fireblocksAdapter.getAvailableStableAssets).toHaveBeenCalled();
    });
  });

  describe('createAccount', () => {
    it('should delegate to provider and return account response', async () => {
      const mockParams = { user_id: '123', user_name: 'test' };
      const mockResponse = {
        id: 'acc123',
        name: 'test',
        assets: [],
        hiddenOnUI: false,
      };
      fireblocksAdapter.createAccount.mockResolvedValueOnce(mockResponse);

      const result = await adapter.createAccount(mockParams);
      expect(result).toEqual(mockResponse);
      expect(fireblocksAdapter.createAccount).toHaveBeenCalledWith(mockParams);
    });
  });

  describe('createWallet', () => {
    it('should delegate to provider and return wallet response', async () => {
      const mockParams = {
        account_id: 'acc123',
        asset_ids: [{ asset_id: 'USDC' }],
        user_id: 'user123',
        provider_account_ref: 'cmgfednos0000h8mi80oycy5s',
      };
      const mockResponse = {
        successful: [
          {
            address: 'wallet1',
            assetId: 'USDC',
            asset_id: 'USDC',
            provider_account_ref: 'acc123',
          },
        ],
        failed: [],
      };
      fireblocksAdapter.createWallet.mockResolvedValueOnce(mockResponse);

      const result = await adapter.createWallet(mockParams);
      expect(result).toEqual(mockResponse);
      expect(fireblocksAdapter.createWallet).toHaveBeenCalledWith(mockParams);
    });
  });

  describe('getVaultAccount', () => {
    it('should delegate to provider and return vault account', async () => {
      const mockVaultId = 'vault123';
      const mockResponse = { id: mockVaultId, name: 'Test Vault' };
      fireblocksAdapter.getVaultAccount.mockResolvedValueOnce(mockResponse);

      const result = await adapter.getVaultAccount(mockVaultId);
      expect(result).toEqual(mockResponse);
      expect(fireblocksAdapter.getVaultAccount).toHaveBeenCalledWith(mockVaultId);
    });
  });

  describe('getAssetBalance', () => {
    it('should delegate to provider and return asset balance', async () => {
      const mockVaultId = 'vault123';
      const mockAssetId = 'USDC';
      const mockResponse = {
        id: mockAssetId,
        assetId: mockAssetId,
        balance: '100',
        total: '100',
        available: '100',
        pending: '0',
        frozen: '0',
        lockedAmount: '0',
      };
      fireblocksAdapter.getAssetBalance.mockResolvedValueOnce(mockResponse);

      const result = await adapter.getAssetBalance(mockVaultId, mockAssetId);
      expect(result).toEqual(mockResponse);
    });
  });

  describe('estimateInternalTransferFee', () => {
    it('should delegate to provider and return fee estimate', async () => {
      const mockParams = {
        assetId: 'USDC',
        amount: '100',
        sourceVaultId: 'vault1',
        destinationVaultId: 'vault2',
        feeLevel: 'HIGH' as const,
      };
      const mockResponse = {
        low: {
          networkFee: '0.1',
          gasPrice: '100',
          gasLimit: '21000',
        },
        medium: {
          networkFee: '0.1',
          gasPrice: '100',
          gasLimit: '21000',
        },
        high: {
          networkFee: '0.1',
          gasPrice: '100',
          gasLimit: '21000',
        },
      };
      fireblocksAdapter.estimateTransactionFee.mockResolvedValueOnce(mockResponse);

      const result = await adapter.estimateInternalTransferFee(mockParams);
      expect(result).toEqual(mockResponse);
    });
  });

  describe('estimateExternalTransactionFee', () => {
    it('should delegate to provider and return fee estimate', async () => {
      const mockParams = {
        assetId: 'USDC',
        amount: '100',
        sourceVaultId: 'vault1',
        destinationAddress: '0x123',
        feeLevel: 'HIGH' as const,
      };
      const mockResponse = {
        low: {
          networkFee: '0.1',
          gasPrice: '100',
          gasLimit: '21000',
        },
        medium: {
          networkFee: '0.1',
          gasPrice: '100',
          gasLimit: '21000',
        },
        high: {
          networkFee: '0.1',
          gasPrice: '100',
          gasLimit: '21000',
        },
      };
      fireblocksAdapter.estimateTransactionFee.mockResolvedValueOnce(mockResponse);

      const result = await adapter.estimateExternalTransactionFee(mockParams);
      expect(result).toEqual(mockResponse);
    });
  });

  describe('internalTransfer', () => {
    it('should delegate to provider and return transfer response', async () => {
      const mockParams = {
        assetId: 'USDC',
        amount: '100',
        sourceVaultId: 'vault1',
        destinationVaultId: 'vault2',
        feeLevel: 'HIGH' as const,
      };
      const mockResponse = {
        transactionId: 'tx123',
        status: 'PENDING',
        externalTxId: undefined,
        systemMessages: undefined,
      };
      fireblocksAdapter.internalTransfer.mockResolvedValueOnce(mockResponse);

      const result = await adapter.internalTransfer(mockParams);
      expect(result).toEqual(mockResponse);
    });
  });

  describe('externalTransfer', () => {
    it('should delegate to provider and return transfer response', async () => {
      const mockParams = {
        assetId: 'USDC',
        amount: '100',
        sourceVaultId: 'vault1',
        destinationAddress: '0x123',
        feeLevel: 'HIGH' as const,
      };
      const mockResponse = {
        transactionId: 'tx123',
        status: 'PENDING',
        externalTxId: undefined,
        systemMessages: undefined,
      };
      fireblocksAdapter.externalTransfer.mockResolvedValueOnce(mockResponse);

      const result = await adapter.externalTransfer(mockParams);
      expect(result).toEqual(mockResponse);
    });
  });

  describe('getVaultAssetTransactionHistory', () => {
    it('should delegate to provider and return transaction history', async () => {
      const mockParams = {
        vaultAccountId: 'vault123',
        assetId: 'USDC',
      };
      const now = new Date();
      const mockResponse = {
        transactions: [
          {
            id: 'tx1',
            status: 'COMPLETED',
            operation: 'TRANSFER',
            assetId: 'USDC',
            source: { type: 'VAULT_ACCOUNT', id: 'vault1', address: '0x123' },
            destination: { type: 'VAULT_ACCOUNT', id: 'vault2', address: '0x456' },
            amount: '100',
            createdAt: now,
            lastUpdated: now,
          },
        ],
        nextPageToken: 'next',
      };
      fireblocksAdapter.getTransactionHistory.mockResolvedValueOnce(mockResponse);

      const result = await adapter.getVaultAssetTransactionHistory(mockParams);
      expect(result).toEqual(mockResponse);
    });
  });

  describe('getTransaction', () => {
    it('should delegate to provider and return transaction by txId', async () => {
      const mockParams = { txId: 'tx123' };
      const now = new Date();
      const mockResponse = {
        id: 'tx123',
        status: 'COMPLETED',
        operation: 'TRANSFER',
        assetId: 'USDC',
        source: { type: 'VAULT_ACCOUNT', id: 'vault1', address: '0x123' },
        destination: { type: 'VAULT_ACCOUNT', id: 'vault2', address: '0x456' },
        amount: '100',
        createdAt: now,
        lastUpdated: now,
      };
      fireblocksAdapter.getTransaction.mockResolvedValueOnce(mockResponse);

      const result = await adapter.getTransaction(mockParams);
      expect(result).toEqual(mockResponse);
    });

    it('should delegate to provider and return transaction by externalTxId', async () => {
      const mockParams = { externalTxId: 'ext123' };
      const now = new Date();
      const mockResponse = {
        id: 'tx123',
        status: 'COMPLETED',
        operation: 'TRANSFER',
        assetId: 'USDC',
        source: { type: 'VAULT_ACCOUNT', id: 'vault1', address: '0x123' },
        destination: { type: 'VAULT_ACCOUNT', id: 'vault2', address: '0x456' },
        amount: '100',
        createdAt: now,
        lastUpdated: now,
      };
      fireblocksAdapter.getTransaction.mockResolvedValueOnce(mockResponse);

      const result = await adapter.getTransaction(mockParams);
      expect(result).toEqual(mockResponse);
    });

    it('should throw error when neither txId nor externalTxId is provided', async () => {
      const mockParams = {};
      // Mock the provider to throw the expected error
      fireblocksAdapter.getTransaction.mockRejectedValueOnce(new Error('Either txId or externalTxId must be provided'));

      await expect(adapter.getTransaction(mockParams)).rejects.toThrow('Either txId or externalTxId must be provided');
    });
  });
});
