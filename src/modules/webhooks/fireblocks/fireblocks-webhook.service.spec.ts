import { Test, TestingModule } from '@nestjs/testing';
import {
  FireblocksV1EventType,
  FireblocksV2EventType,
  IFireblocksWebhookV1Payload,
  IFireblocksWebhookV2Payload,
} from '../../../adapters/blockchain-waas/fireblocks/fireblocks_interface';
import { EnvironmentService } from '../../../config';
import { BlockchainWalletService } from '../../blockchainWallet/blockchainWallet.service';
import { TransactionRepository } from '../../transaction';
import { FireblocksWebhookService } from './fireblocks-webhook.service';

jest.mock('../../../config', () => ({
  EnvironmentService: {
    isProduction: jest.fn(),
    getValue: jest.fn(),
  },
}));

describe('FireblocksWebhookService', () => {
  let service: FireblocksWebhookService;
  let blockchainWalletService: jest.Mocked<BlockchainWalletService>;
  let transactionRepository: jest.Mocked<TransactionRepository>;

  beforeEach(async () => {
    const mockBlockchainWalletService = {
      processWebhook: jest.fn(),
    };

    const mockTransactionRepository = {
      findOne: jest.fn(),
      update: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FireblocksWebhookService,
        {
          provide: BlockchainWalletService,
          useValue: mockBlockchainWalletService,
        },
        {
          provide: TransactionRepository,
          useValue: mockTransactionRepository,
        },
      ],
    }).compile();

    service = module.get<FireblocksWebhookService>(FireblocksWebhookService);
    blockchainWalletService = module.get(BlockchainWalletService);
    transactionRepository = module.get(TransactionRepository);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('processWebhook', () => {
    it('should process v1 webhook successfully', async () => {
      (EnvironmentService.isProduction as jest.Mock).mockReturnValue(true);

      const mockBody: IFireblocksWebhookV1Payload = {
        type: FireblocksV1EventType.TRANSACTION_CREATED,
        tenantId: 'test-tenant',
        timestamp: Date.now(),
        data: {
          id: 'test-transaction-id',
          createdAt: Date.now(),
          lastUpdated: Date.now(),
          assetId: 'ETH',
          source: { id: '0', type: 'VAULT_ACCOUNT', name: 'Test', subType: '' },
          destination: { id: '1', type: 'VAULT_ACCOUNT', name: 'Test', subType: '' },
          amount: 1,
          sourceAddress: '',
          destinationAddress: '',
          destinationAddressDescription: '',
          destinationTag: '',
          txHash: '',
          subStatus: '',
          signedBy: [],
          createdBy: 'test-user',
          rejectedBy: '',
          amountUSD: 1,
          addressType: '',
          note: '',
          exchangeTxId: '',
          requestedAmount: 1,
          feeCurrency: 'ETH',
          operation: 'TRANSFER',
          customerRefId: null,
          amountInfo: { amount: '1', requestedAmount: '1', amountUSD: '1' },
          feeInfo: {},
          destinations: [],
          externalTxId: null,
          blockInfo: {},
          signedMessages: [],
          assetType: 'ERC20',
          status: 'SUBMITTED',
        },
      };

      const mockHeaders = {
        'fireblocks-signature': 'test-signature',
        'fireblocks-api-version': '1.4.0',
      };

      const mockResult = { success: true };
      blockchainWalletService.processWebhook.mockResolvedValue(mockResult);

      const result = await service.processWebhook(mockBody, mockHeaders);

      expect(result).toEqual(mockResult);
      expect(blockchainWalletService.processWebhook).toHaveBeenCalledWith(
        JSON.stringify(mockBody),
        'test-signature',
        '',
        'v1',
      );
    });

    it('should process v2 webhook successfully', async () => {
      (EnvironmentService.isProduction as jest.Mock).mockReturnValue(true);

      const mockBody: IFireblocksWebhookV2Payload = {
        id: 'webhook-id',
        eventType: FireblocksV2EventType.TRANSACTION_STATUS_UPDATED,
        eventVersion: 1,
        data: {
          id: 'test-transaction-id',
          externalTxId: 'ext-123',
          status: 'COMPLETED',
          subStatus: '',
          txHash: '0x123...',
          operation: 'TRANSFER',
          note: 'Test transaction',
          assetId: 'ETH',
          assetType: 'ERC20',
          source: { type: 'VAULT_ACCOUNT', id: '0', name: 'Test', subType: '' },
          sourceAddress: '0xabc...',
          destination: { type: 'VAULT_ACCOUNT', id: '1', name: 'Test', subType: '' },
          destinations: [],
          destinationAddress: '0xdef...',
          destinationAddressDescription: '',
          destinationTag: '',
          amountInfo: { amount: '1', requestedAmount: '1', netAmount: '0.99', amountUSD: '1000' },
          treatAsGrossAmount: false,
          feeInfo: { networkFee: '0.01', serviceFee: '0' },
          feeCurrency: 'ETH',
          networkRecords: [],
          createdAt: Date.now(),
          lastUpdated: Date.now(),
          createdBy: 'test-user',
          signedBy: ['test-user'],
          rejectedBy: '',
          authorizationInfo: {},
          exchangeTxId: '',
          customerRefId: '',
          amlScreeningResult: {},
          replacedTxHash: '',
          extraParameters: {},
          signedMessages: [],
          numOfConfirmations: 1,
          blockInfo: { blockHash: '0xblock...', blockHeight: 12345 },
          index: 0,
          blockchainIndex: '0',
          rewardsInfo: {},
          systemMessages: [],
          addressType: '',
          requestedAmount: 1,
          amount: 1,
          netAmount: 0.99,
          amountUSD: 1000,
          serviceFee: 0,
          networkFee: 0.01,
        },
        createdAt: Date.now(),
        workspaceId: 'test-workspace',
      };

      const mockHeaders = {
        'fireblocks-signature': 'test-signature',
        'fireblocks-timestamp': '1234567890',
      };

      const mockResult = { success: true };
      blockchainWalletService.processWebhook.mockResolvedValue(mockResult);

      const result = await service.processWebhook(mockBody, mockHeaders);

      expect(result).toEqual(mockResult);
      expect(blockchainWalletService.processWebhook).toHaveBeenCalledWith(
        JSON.stringify(mockBody),
        'test-signature',
        '1234567890',
        'v2',
      );
    });

    it('should throw error when signature header is missing', async () => {
      const mockBody = { type: 'TEST' };
      const mockHeaders = {};

      await expect(service.processWebhook(mockBody as any, mockHeaders)).rejects.toThrow(
        'Missing required webhook signature header',
      );
    });

    it('should update USD transaction external reference in development environment', async () => {
      (EnvironmentService.isProduction as jest.Mock).mockReturnValue(false);

      const mockBody: IFireblocksWebhookV2Payload = {
        id: 'webhook-id',
        eventType: FireblocksV2EventType.TRANSACTION_STATUS_UPDATED,
        eventVersion: 1,
        data: {
          id: 'test-transaction-id',
          externalTxId: 'ext-123',
          status: 'COMPLETED',
          subStatus: '',
          txHash: '0x123...',
          operation: 'TRANSFER',
          note: 'Test transaction',
          assetId: 'ETH',
          assetType: 'ERC20',
          source: { type: 'VAULT_ACCOUNT', id: '0', name: 'Test', subType: '' },
          sourceAddress: '0xabc...',
          destination: { type: 'VAULT_ACCOUNT', id: '1', name: 'Test', subType: '' },
          destinations: [],
          destinationAddress: '0xdef...',
          destinationAddressDescription: '',
          destinationTag: '',
          amountInfo: { amount: '1', requestedAmount: '1', netAmount: '0.99', amountUSD: '1000' },
          treatAsGrossAmount: false,
          feeInfo: { networkFee: '0.01', serviceFee: '0' },
          feeCurrency: 'ETH',
          networkRecords: [],
          createdAt: Date.now(),
          lastUpdated: Date.now(),
          createdBy: 'test-user',
          signedBy: ['test-user'],
          rejectedBy: '',
          authorizationInfo: {},
          exchangeTxId: '',
          customerRefId: '',
          amlScreeningResult: {},
          replacedTxHash: '',
          extraParameters: {},
          signedMessages: [],
          numOfConfirmations: 1,
          blockInfo: { blockHash: '0xblock...', blockHeight: 12345 },
          index: 0,
          blockchainIndex: '0',
          rewardsInfo: {},
          systemMessages: [],
          addressType: '',
          requestedAmount: 1,
          amount: 1,
          netAmount: 0.99,
          amountUSD: 1000,
          serviceFee: 0,
          networkFee: 0.01,
        },
        createdAt: Date.now(),
        workspaceId: 'test-workspace',
      };

      const mockHeaders = {
        'fireblocks-signature': 'test-signature',
        'fireblocks-timestamp': '1234567890',
      };

      const mockTransaction = {
        id: 'transaction-123',
        external_reference: 'test-transaction-id',
      };

      transactionRepository.findOne.mockResolvedValue(mockTransaction as any);
      transactionRepository.update.mockResolvedValue(undefined);
      blockchainWalletService.processWebhook.mockResolvedValue({ success: true });

      await service.processWebhook(mockBody, mockHeaders);

      expect(transactionRepository.findOne).toHaveBeenCalledWith({
        external_reference: 'test-transaction-id',
      });
      expect(transactionRepository.update).toHaveBeenCalledWith('transaction-123', {
        external_reference: '0x123...',
      });
    });

    it('should not update USD transaction external reference if transaction not found in development', async () => {
      (EnvironmentService.isProduction as jest.Mock).mockReturnValue(false);

      const mockBody: IFireblocksWebhookV2Payload = {
        id: 'webhook-id',
        eventType: FireblocksV2EventType.TRANSACTION_STATUS_UPDATED,
        eventVersion: 1,
        data: {
          id: 'test-transaction-id',
          externalTxId: 'ext-123',
          status: 'COMPLETED',
          subStatus: '',
          txHash: '0x123...',
          operation: 'TRANSFER',
          note: 'Test transaction',
          assetId: 'ETH',
          assetType: 'ERC20',
          source: { type: 'VAULT_ACCOUNT', id: '0', name: 'Test', subType: '' },
          sourceAddress: '0xabc...',
          destination: { type: 'VAULT_ACCOUNT', id: '1', name: 'Test', subType: '' },
          destinations: [],
          destinationAddress: '0xdef...',
          destinationAddressDescription: '',
          destinationTag: '',
          amountInfo: { amount: '1', requestedAmount: '1', netAmount: '0.99', amountUSD: '1000' },
          treatAsGrossAmount: false,
          feeInfo: { networkFee: '0.01', serviceFee: '0' },
          feeCurrency: 'ETH',
          networkRecords: [],
          createdAt: Date.now(),
          lastUpdated: Date.now(),
          createdBy: 'test-user',
          signedBy: ['test-user'],
          rejectedBy: '',
          authorizationInfo: {},
          exchangeTxId: '',
          customerRefId: '',
          amlScreeningResult: {},
          replacedTxHash: '',
          extraParameters: {},
          signedMessages: [],
          numOfConfirmations: 1,
          blockInfo: { blockHash: '0xblock...', blockHeight: 12345 },
          index: 0,
          blockchainIndex: '0',
          rewardsInfo: {},
          systemMessages: [],
          addressType: '',
          requestedAmount: 1,
          amount: 1,
          netAmount: 0.99,
          amountUSD: 1000,
          serviceFee: 0,
          networkFee: 0.01,
        },
        createdAt: Date.now(),
        workspaceId: 'test-workspace',
      };

      const mockHeaders = {
        'fireblocks-signature': 'test-signature',
        'fireblocks-timestamp': '1234567890',
      };

      transactionRepository.findOne.mockResolvedValue(null);
      blockchainWalletService.processWebhook.mockResolvedValue({ success: true });

      await service.processWebhook(mockBody, mockHeaders);

      expect(transactionRepository.findOne).toHaveBeenCalledWith({
        external_reference: 'test-transaction-id',
      });
      expect(transactionRepository.update).not.toHaveBeenCalled();
    });

    it('should not update USD transaction external reference if txHash is missing', async () => {
      (EnvironmentService.isProduction as jest.Mock).mockReturnValue(false);

      const mockBody: IFireblocksWebhookV2Payload = {
        id: 'webhook-id',
        eventType: FireblocksV2EventType.TRANSACTION_STATUS_UPDATED,
        eventVersion: 1,
        data: {
          id: 'test-transaction-id',
          externalTxId: 'ext-123',
          status: 'COMPLETED',
          subStatus: '',
          txHash: '',
          operation: 'TRANSFER',
          note: 'Test transaction',
          assetId: 'ETH',
          assetType: 'ERC20',
          source: { type: 'VAULT_ACCOUNT', id: '0', name: 'Test', subType: '' },
          sourceAddress: '0xabc...',
          destination: { type: 'VAULT_ACCOUNT', id: '1', name: 'Test', subType: '' },
          destinations: [],
          destinationAddress: '0xdef...',
          destinationAddressDescription: '',
          destinationTag: '',
          amountInfo: { amount: '1', requestedAmount: '1', netAmount: '0.99', amountUSD: '1000' },
          treatAsGrossAmount: false,
          feeInfo: { networkFee: '0.01', serviceFee: '0' },
          feeCurrency: 'ETH',
          networkRecords: [],
          createdAt: Date.now(),
          lastUpdated: Date.now(),
          createdBy: 'test-user',
          signedBy: ['test-user'],
          rejectedBy: '',
          authorizationInfo: {},
          exchangeTxId: '',
          customerRefId: '',
          amlScreeningResult: {},
          replacedTxHash: '',
          extraParameters: {},
          signedMessages: [],
          numOfConfirmations: 1,
          blockInfo: { blockHash: '0xblock...', blockHeight: 12345 },
          index: 0,
          blockchainIndex: '0',
          rewardsInfo: {},
          systemMessages: [],
          addressType: '',
          requestedAmount: 1,
          amount: 1,
          netAmount: 0.99,
          amountUSD: 1000,
          serviceFee: 0,
          networkFee: 0.01,
        },
        createdAt: Date.now(),
        workspaceId: 'test-workspace',
      };

      const mockHeaders = {
        'fireblocks-signature': 'test-signature',
        'fireblocks-timestamp': '1234567890',
      };

      blockchainWalletService.processWebhook.mockResolvedValue({ success: true });

      await service.processWebhook(mockBody, mockHeaders);

      expect(transactionRepository.findOne).not.toHaveBeenCalled();
      expect(transactionRepository.update).not.toHaveBeenCalled();
    });

    it('should skip USD transaction update in production environment', async () => {
      (EnvironmentService.isProduction as jest.Mock).mockReturnValue(true);

      const mockBody: IFireblocksWebhookV2Payload = {
        id: 'webhook-id',
        eventType: FireblocksV2EventType.TRANSACTION_STATUS_UPDATED,
        eventVersion: 1,
        data: {
          id: 'test-transaction-id',
          externalTxId: 'ext-123',
          status: 'COMPLETED',
          subStatus: '',
          txHash: '0x123...',
          operation: 'TRANSFER',
          note: 'Test transaction',
          assetId: 'ETH',
          assetType: 'ERC20',
          source: { type: 'VAULT_ACCOUNT', id: '0', name: 'Test', subType: '' },
          sourceAddress: '0xabc...',
          destination: { type: 'VAULT_ACCOUNT', id: '1', name: 'Test', subType: '' },
          destinations: [],
          destinationAddress: '0xdef...',
          destinationAddressDescription: '',
          destinationTag: '',
          amountInfo: { amount: '1', requestedAmount: '1', netAmount: '0.99', amountUSD: '1000' },
          treatAsGrossAmount: false,
          feeInfo: { networkFee: '0.01', serviceFee: '0' },
          feeCurrency: 'ETH',
          networkRecords: [],
          createdAt: Date.now(),
          lastUpdated: Date.now(),
          createdBy: 'test-user',
          signedBy: ['test-user'],
          rejectedBy: '',
          authorizationInfo: {},
          exchangeTxId: '',
          customerRefId: '',
          amlScreeningResult: {},
          replacedTxHash: '',
          extraParameters: {},
          signedMessages: [],
          numOfConfirmations: 1,
          blockInfo: { blockHash: '0xblock...', blockHeight: 12345 },
          index: 0,
          blockchainIndex: '0',
          rewardsInfo: {},
          systemMessages: [],
          addressType: '',
          requestedAmount: 1,
          amount: 1,
          netAmount: 0.99,
          amountUSD: 1000,
          serviceFee: 0,
          networkFee: 0.01,
        },
        createdAt: Date.now(),
        workspaceId: 'test-workspace',
      };

      const mockHeaders = {
        'fireblocks-signature': 'test-signature',
        'fireblocks-timestamp': '1234567890',
      };

      blockchainWalletService.processWebhook.mockResolvedValue({ success: true });

      await service.processWebhook(mockBody, mockHeaders);

      expect(transactionRepository.findOne).not.toHaveBeenCalled();
      expect(transactionRepository.update).not.toHaveBeenCalled();
    });
  });

  describe('event type mapping', () => {
    it('should map v1 event types to v2 correctly', () => {
      expect(service.mapV1ToV2EventType(FireblocksV1EventType.TRANSACTION_CREATED)).toBe(
        FireblocksV2EventType.TRANSACTION_CREATED,
      );
      expect(service.mapV1ToV2EventType(FireblocksV1EventType.TRANSACTION_STATUS_UPDATED)).toBe(
        FireblocksV2EventType.TRANSACTION_STATUS_UPDATED,
      );
      expect(service.mapV1ToV2EventType(FireblocksV1EventType.VAULT_ACCOUNT_ADDED)).toBe(
        FireblocksV2EventType.VAULT_ACCOUNT_CREATED,
      );
    });

    it('should map v2 event types to v1 correctly', () => {
      expect(service.mapV2ToV1EventType(FireblocksV2EventType.TRANSACTION_CREATED)).toBe(
        FireblocksV1EventType.TRANSACTION_CREATED,
      );
      expect(service.mapV2ToV1EventType(FireblocksV2EventType.TRANSACTION_STATUS_UPDATED)).toBe(
        FireblocksV1EventType.TRANSACTION_STATUS_UPDATED,
      );
      expect(service.mapV2ToV1EventType(FireblocksV2EventType.VAULT_ACCOUNT_CREATED)).toBe(
        FireblocksV1EventType.VAULT_ACCOUNT_ADDED,
      );
    });
  });
});
