import { HttpStatus } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { IUser } from '../../database/models/user/user.interface';
import { StreamService } from '../../services/streams/stream.service';
import { BlockchainWalletService } from './blockchainWallet.service';
import { BlockchainWalletController } from './blockchainWallet.controller';

describe('BlockchainWalletController', () => {
  let controller: BlockchainWalletController;
  let blockchainWalletService: jest.Mocked<BlockchainWalletService>;
  let streamService: jest.Mocked<StreamService>;

  const mockUser = {
    id: 'user-123',
    email: 'test@example.com',
  } as IUser;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [BlockchainWalletController],
      providers: [
        {
          provide: BlockchainWalletService,
          useValue: {
            getStableCoins: jest.fn(),
            getStableCoinsFromProvider: jest.fn(),
            createBlockchainAccount: jest.fn(),
            createBlockchainWallet: jest.fn(),
            getUserAccount: jest.fn(),
            getWalletBalance: jest.fn(),
            estimateFee: jest.fn(),
            initiateTransaction: jest.fn(),
            convertToCurrency: jest.fn(),
            resendWebhook: jest.fn(),
            getUserWalletTransactions: jest.fn(),
            fundWalletFromGasStation: jest.fn(),
          },
        },
        {
          provide: StreamService,
          useValue: {
            getUserBalanceStream: jest.fn(),
            triggerSampleBalanceUpdate: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<BlockchainWalletController>(BlockchainWalletController);
    blockchainWalletService = module.get(BlockchainWalletService) as jest.Mocked<BlockchainWalletService>;
    streamService = module.get(StreamService) as jest.Mocked<StreamService>;

    jest.clearAllMocks();
  });

  describe('getSupportedCurrency', () => {
    it('should return supported currencies', async () => {
      const mockStableCoins = [
        {
          id: 'usdc',
          name: 'USD Coin',
          symbol: 'USDC',
          type: 'STABLE_COIN',
          nativeAsset: 'USD',
          imageUrl: '/public/images/usdc_erc20.png',
          decimals: 6,
        },
      ];

      blockchainWalletService.getStableCoins.mockResolvedValue(mockStableCoins as any);

      const result = await controller.getSupportedCurrency();

      expect(result.statusCode).toBe(HttpStatus.OK);
      expect(result.message).toBe('Stable coins fetched successfully');
      expect(result.data).toEqual(mockStableCoins);
      expect(blockchainWalletService.getStableCoins).toHaveBeenCalled();
    });
  });

  describe('getSupportedCurrencyFromProvider', () => {
    it('should return supported currencies from provider', async () => {
      const provider = 'fireblocks';
      const mockStableCoins = [
        {
          id: 'usdc',
          name: 'USD Coin',
          symbol: 'USDC',
          type: 'STABLE_COIN',
          nativeAsset: 'USD',
          imageUrl: '/public/images/usdc_erc20.png',
          decimals: 6,
        },
      ];

      blockchainWalletService.getStableCoinsFromProvider.mockResolvedValue(mockStableCoins as any);

      const result = await controller.getSupportedCurrencyFromProvider(provider);

      expect(result.statusCode).toBe(HttpStatus.OK);
      expect(result.message).toBe('Stable coins from provider fetched successfully');
      expect(result.data).toEqual(mockStableCoins);
      expect(blockchainWalletService.getStableCoinsFromProvider).toHaveBeenCalledWith(provider);
    });
  });

  describe('createAccount', () => {
    it('should create blockchain account successfully', async () => {
      const mockAccount = {
        id: 'acc_123456789',
        name: 'john_doe',
        user_id: 'user_123',
      };

      blockchainWalletService.createBlockchainAccount.mockResolvedValue(mockAccount as any);

      const result = await controller.createAccount(mockUser);

      expect(result.statusCode).toBe(HttpStatus.OK);
      expect(result.message).toBe('Account created successfully');
      expect(result.data).toEqual(mockAccount);
      expect(blockchainWalletService.createBlockchainAccount).toHaveBeenCalledWith(mockUser);
    });
  });

  describe('createWallet', () => {
    it('should create blockchain wallet successfully', async () => {
      const mockParams = {
        asset_ids: [{ asset_id: 'USDC_ETH_TEST5_0GER' }],
      };

      const mockWallet = {
        successful: [
          {
            asset_id: 'USDC_ETH_TEST5_0GER',
            address: '0x1234567890abcdef...',
            account_id: 'acc_123456789',
            user_id: 'user_123',
          },
        ],
        failed: [],
      };

      blockchainWalletService.createBlockchainWallet.mockResolvedValue(mockWallet as any);

      const result = await controller.createWallet(mockUser, mockParams);

      expect(result.statusCode).toBe(HttpStatus.OK);
      expect(result.message).toBe('Wallet created successfully');
      expect(result.data).toEqual(mockWallet);
      expect(blockchainWalletService.createBlockchainWallet).toHaveBeenCalledWith(mockUser, mockParams);
    });
  });

  describe('getVaultAccount', () => {
    it('should get vault account successfully', async () => {
      const mockAccount = {
        id: 'acc_123456789',
        name: 'john_doe',
        user_id: 'user_123',
      };

      blockchainWalletService.getUserAccount.mockResolvedValue(mockAccount as any);

      const result = await controller.getVaultAccount(mockUser);

      expect(result.statusCode).toBe(HttpStatus.OK);
      expect(result.message).toBe('Vault account fetched successfully');
      expect(result.data).toEqual(mockAccount);
      expect(blockchainWalletService.getUserAccount).toHaveBeenCalledWith(mockUser);
    });
  });

  describe('getAssetBalance', () => {
    it('should get asset balance successfully', async () => {
      const assetId = 'USDC_ETH_TEST5_0GER';
      const mockBalance = {
        asset_id: assetId,
        balance: '100.50',
        available_balance: '100.50',
      };

      blockchainWalletService.getWalletBalance.mockResolvedValue(mockBalance as any);

      const result = await controller.getAssetBalance(mockUser, assetId);

      expect(result.statusCode).toBe(HttpStatus.OK);
      expect(result.message).toBe('Asset balance fetched successfully');
      expect(result.data).toEqual(mockBalance);
      expect(blockchainWalletService.getWalletBalance).toHaveBeenCalledWith(mockUser, assetId);
    });
  });

  describe('estimateFee', () => {
    it('should estimate fee successfully', async () => {
      const mockParams = {
        type: 'external' as const,
        amount: '100',
        asset_id: 'USDC_ETH_TEST5_0GER',
        peer_address: '0xabcdef...',
      };

      const mockFee = {
        fee_amount: '0.01',
        fee_asset: 'USDC_ETH_TEST5_0GER',
      };

      blockchainWalletService.estimateFee.mockResolvedValue(mockFee as any);

      const result = await controller.estimateFee(mockUser, mockParams);

      expect(result.statusCode).toBe(HttpStatus.OK);
      expect(result.message).toBe('Fee estimated successfully');
      expect(result.data).toEqual(mockFee);
      expect(blockchainWalletService.estimateFee).toHaveBeenCalledWith(mockUser, mockParams);
    });
  });

  describe('initiateTransaction', () => {
    it('should initiate transaction successfully', async () => {
      const mockParams = {
        type: 'external' as const,
        amount: 100,
        asset_id: 'USDC_ETH_TEST5_0GER',
        peer_address: '0xabcdef...',
        pin: '123456',
      };

      const mockResult = {
        transactionId: 'txn_123456789',
        status: 'PENDING',
        externalTxId: 'ext_123456789',
      };

      blockchainWalletService.initiateTransaction.mockResolvedValue(mockResult as any);

      const result = await controller.initiateTransaction(mockUser, mockParams);

      expect(result.statusCode).toBe(HttpStatus.OK);
      expect(result.message).toBe('Transaction initiated successfully');
      expect(result.data).toEqual(mockResult);
      expect(blockchainWalletService.initiateTransaction).toHaveBeenCalledWith(mockUser, mockParams);
    });
  });

  describe('convertToCurrency', () => {
    it('should convert to currency successfully', async () => {
      const mockParams = {
        wallet_id: 'wallet-123',
        amount: 100,
        to_currency: 'USD' as const,
        note: 'Test conversion',
        pin: '123456',
      };

      const mockResult = {
        transactionId: 'txn_123456789',
        status: 'PENDING',
        externalTxId: 'ext_123456789',
        systemMessages: [],
      };

      blockchainWalletService.convertToCurrency.mockResolvedValue(mockResult as any);

      const result = await controller.convertToCurrency(mockUser, mockParams);

      expect(result.statusCode).toBe(HttpStatus.OK);
      expect(result.message).toBe('Currency conversion initiated successfully');
      expect(result.data).toEqual(mockResult);
      expect(blockchainWalletService.convertToCurrency).toHaveBeenCalledWith(
        mockUser,
        mockParams.wallet_id,
        mockParams.amount,
        mockParams.to_currency,
        mockParams.note,
      );
    });
  });

  describe('resendWebhook', () => {
    it('should resend webhook successfully', async () => {
      const mockBody = {
        txId: 'txn-123',
        resendCreated: true,
        resendStatusUpdated: true,
      };

      const mockResult = {
        success: true,
        message: 'Webhook resent successfully',
      };

      blockchainWalletService.resendWebhook.mockResolvedValue(mockResult as any);

      const result = await controller.resendWebhook(mockBody);

      expect(result.statusCode).toBe(HttpStatus.OK);
      expect(result.message).toBe('Webhooks resent successfully');
      expect(result.data).toEqual(mockResult);
      expect(blockchainWalletService.resendWebhook).toHaveBeenCalledWith(mockBody);
    });
  });

  describe('getUserTransactions', () => {
    it('should get user transactions successfully', async () => {
      const mockQuery = {
        page: 1,
        limit: 10,
      };

      const mockTransactions = {
        data: [
          {
            id: 'tx_123',
            blockchain_wallet_id: 'wallet_123',
            amount: '100.50',
            status: 'completed',
          },
        ],
        pagination: {
          total: 1,
          page: 1,
          limit: 10,
          pageCount: 1,
        },
      };

      blockchainWalletService.getUserWalletTransactions.mockResolvedValue(mockTransactions as any);

      const result = await controller.getUserTransactions(mockUser, mockQuery);

      expect(result.statusCode).toBe(HttpStatus.OK);
      expect(result.message).toBe('User transactions fetched successfully');
      expect(result.data).toEqual(mockTransactions);
      expect(blockchainWalletService.getUserWalletTransactions).toHaveBeenCalledWith(mockUser.id, mockQuery);
    });
  });

  describe('fundFromGasStation', () => {
    it('should fund wallet from gas station successfully', async () => {
      const mockBody = {
        wallet_id: 'wallet-123',
        native_asset_id: 'ETH_TEST5',
        amount: 0.01,
        note: 'Gas funding',
      };

      const mockResult = {
        transactionId: 'tx_123456789',
        status: 'SUBMITTED',
        externalTxId: 'ext_123456789',
      };

      blockchainWalletService.fundWalletFromGasStation.mockResolvedValue(mockResult as any);

      const result = await controller.fundFromGasStation(mockUser, mockBody);

      expect(result.statusCode).toBe(HttpStatus.CREATED);
      expect(result.message).toBe('Gas funding transaction initiated');
      expect(result.data).toEqual(mockResult);
      expect(blockchainWalletService.fundWalletFromGasStation).toHaveBeenCalledWith(mockUser, {
        wallet_id: mockBody.wallet_id,
        native_asset_id: mockBody.native_asset_id,
        amount: mockBody.amount,
        note: mockBody.note,
      });
    });
  });

  describe('streamBalanceUpdates', () => {
    it('should return balance stream observable', () => {
      const mockObservable = {
        subscribe: jest.fn(),
      } as any;

      streamService.getUserBalanceStream.mockReturnValue(mockObservable as any);

      const result = controller.streamBalanceUpdates(mockUser);

      expect(result).toBe(mockObservable);
      expect(streamService.getUserBalanceStream).toHaveBeenCalledWith(mockUser.id);
    });
  });

  describe('triggerSampleBlockchainBalance', () => {
    it('should trigger sample balance update', async () => {
      streamService.triggerSampleBalanceUpdate.mockResolvedValue(undefined);

      const result = await controller.triggerSampleBlockchainBalance(mockUser);

      expect(result.statusCode).toBe(HttpStatus.CREATED);
      expect(result.message).toBe('Sample balance update event published');
      expect(result.data).toEqual({ stream: 'balance', walletType: 'blockchain' });
      expect(streamService.triggerSampleBalanceUpdate).toHaveBeenCalledWith(mockUser.id, 'blockchain');
    });
  });
});
