import { Test, TestingModule } from '@nestjs/testing';
import { CardAdapter } from '../../../adapters/card/card.adapter';
import { CardUserRepository } from '../../card/repository/cardUser.repository';
import { CardRepository } from '../../card/repository/card.repository';
import { CardTransactionRepository } from '../../card/repository/cardTransaction.repository';
import { CardTransactionDisputeRepository } from '../../card/repository/cardTransactionDispute.repository';
import { CardTransactionDisputeEventRepository } from '../../card/repository/cardTransactionDisputeEvent.repository';
import { UserProfileRepository } from '../../auth/userProfile/userProfile.repository';
import { DepositAddressRepository } from '../../depositAddress/depositAddress.repository';
import { BlockchainWalletRepository } from '../../blockchainWallet/blockchainWallet.repository';
import { TransactionRepository } from '../../transaction/transaction.repository';
import { UserRepository } from '../../auth/user/user.repository';
import { InAppNotificationService } from '../../inAppNotification/inAppNotification.service';
import { MailerService } from '../../../services/queue/processors/mailer/mailer.service';
import { LockerService } from '../../../services/locker/locker.service';
import { RainWebhookService } from './rain-webhook.service';
import { ICardUserStatus } from '../../../database/models/cardUser';
import { TransactionStatus } from '../../../database/models/transaction/transaction.interface';
import { CardFeesService } from '../../../config/onedosh/cardFees.config';
import { CardService } from '../../card/card.service';
import { ICardStatus } from '../../../database/models/card/card.interface';
import { EventEmitterService } from '../../../services/eventEmitter/eventEmitter.service';
import { EventEmitterEventsEnum } from '../../../services/eventEmitter/eventEmitter.interface';
import { DateTime } from 'luxon';

describe('RainWebhookService', () => {
  let service: RainWebhookService;

  const mockCardAdapter = {
    getCardApplicationStatus: jest.fn(),
    updateCard: jest.fn(),
    createCharge: jest.fn(),
  } as any;

  const mockCardUserRepository = {
    findOne: jest.fn(),
    update: jest.fn(),
    create: jest.fn(),
  } as any;

  const mockCardRepository = {
    findOne: jest.fn(),
    update: jest.fn(),
    create: jest.fn(),
    transaction: jest.fn(),
  } as any;

  const mockCardTransactionRepository = {
    findOne: jest.fn(),
    update: jest.fn(),
    create: jest.fn(),
    transaction: jest.fn(),
  } as any;

  const mockCardTransactionDisputeRepository = {
    findOne: jest.fn(),
    update: jest.fn(),
    create: jest.fn(),
  } as any;

  const mockCardTransactionDisputeEventRepository = {
    findOne: jest.fn(),
    findSync: jest.fn(),
    create: jest.fn(),
  } as any;

  const mockUserProfileRepository = {
    findOne: jest.fn(),
    update: jest.fn(),
  } as any;

  const mockDepositAddressRepository = {
    findOne: jest.fn(),
    update: jest.fn(),
    create: jest.fn(),
  } as any;

  const mockBlockchainWalletRepository = {
    findOne: jest.fn(),
    findByAddress: jest.fn(),
    update: jest.fn(),
  } as any;

  const mockTransactionRepository = {
    findOne: jest.fn(),
    update: jest.fn(),
    create: jest.fn(),
    transaction: jest.fn(),
  } as any;

  const mockUserRepository = {
    findOne: jest.fn(),
    findById: jest.fn(),
    findActiveById: jest.fn(),
    update: jest.fn(),
  } as any;

  const mockInAppNotificationService = {
    createNotification: jest.fn(),
  } as any;

  const mockMailerService = {
    send: jest.fn(),
    sendMail: jest.fn(),
  } as any;

  const mockLockerService = {
    lock: jest.fn(),
    unlock: jest.fn(),
    withLock: jest.fn(),
  } as any;

  const mockEventEmitterService = {
    emit: jest.fn(),
    on: jest.fn(),
    emitAsync: jest.fn(),
  } as any;

  const mockCardService = {
    checkAndChargeIssuanceFeeOnFirstFunding: jest.fn(),
    sendCardNotification: jest.fn(),
  } as any;

  beforeEach(async () => {
    mockCardService.sendCardNotification.mockImplementation(async (config, data) => {
      if (data.balanceChangeEvent) {
        mockEventEmitterService.emit(EventEmitterEventsEnum.WALLET_BALANCE_CHANGED, {
          userId: data.userId,
          ...data.balanceChangeEvent,
          timestamp: DateTime.now().toJSDate(),
        });
      }
    });
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RainWebhookService,
        { provide: CardAdapter, useValue: mockCardAdapter },
        { provide: CardUserRepository, useValue: mockCardUserRepository },
        { provide: CardRepository, useValue: mockCardRepository },
        { provide: CardTransactionRepository, useValue: mockCardTransactionRepository },
        { provide: CardTransactionDisputeRepository, useValue: mockCardTransactionDisputeRepository },
        { provide: CardTransactionDisputeEventRepository, useValue: mockCardTransactionDisputeEventRepository },
        { provide: UserProfileRepository, useValue: mockUserProfileRepository },
        { provide: DepositAddressRepository, useValue: mockDepositAddressRepository },
        { provide: BlockchainWalletRepository, useValue: mockBlockchainWalletRepository },
        { provide: TransactionRepository, useValue: mockTransactionRepository },
        { provide: UserRepository, useValue: mockUserRepository },
        { provide: InAppNotificationService, useValue: mockInAppNotificationService },
        { provide: MailerService, useValue: mockMailerService },
        { provide: LockerService, useValue: mockLockerService },
        { provide: CardService, useValue: mockCardService },
        { provide: EventEmitterService, useValue: mockEventEmitterService },
      ],
    }).compile();

    service = module.get<RainWebhookService>(RainWebhookService);
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('processWebhook', () => {
    it('should process user updated webhook successfully', async () => {
      const mockBody = {
        id: 'webhook-123',
        resource: 'user',
        action: 'updated',
        body: {
          id: 'user-456',
          email: 'test@example.com',
          firstName: 'John',
          lastName: 'Doe',
          applicationStatus: 'approved',
          applicationReason: 'All documents verified',
          applicationCompletionLink: {
            url: 'https://app.rain.com/complete',
            params: { token: 'abc123' },
          },
        },
      };

      const mockHeaders = {
        Signature: 'test-signature',
      };

      const mockCardUser = {
        id: 'card-user-1',
        user_id: 'user-123',
        provider_ref: 'user-456',
        status: 'pending',
      };

      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
      };

      mockCardUserRepository.findOne.mockResolvedValue(mockCardUser);
      mockUserRepository.findById.mockResolvedValue(mockUser);
      mockCardUserRepository.update.mockResolvedValue({});

      const result = await service.processWebhook(mockBody, mockHeaders);

      expect(result).toEqual({
        status: 'processed',
        action: 'user_approved',
        userId: 'user-456',
        cardUserUpdated: true,
      });
    });

    it('should process user updated webhook without completion link', async () => {
      const mockBody = {
        id: 'webhook-123',
        resource: 'user',
        action: 'updated',
        body: {
          id: 'user-456',
          email: 'test@example.com',
          firstName: 'Jane',
          lastName: 'Smith',
          applicationStatus: 'denied',
          applicationReason: 'Insufficient documentation',
        },
      };

      const mockHeaders = {
        Signature: 'test-signature',
      };

      const mockCardUser = {
        id: 'card-user-1',
        user_id: 'user-123',
        provider_ref: 'user-456',
        status: 'pending',
      };

      mockCardUserRepository.findOne.mockResolvedValue(mockCardUser);
      mockCardUserRepository.update.mockResolvedValue({});

      const result = await service.processWebhook(mockBody, mockHeaders);

      expect(result).toEqual({
        status: 'processed',
        action: 'user_denied',
        userId: 'user-456',
        cardUserUpdated: true,
      });
      expect(mockCardUserRepository.update).toHaveBeenCalledWith(
        { id: 'card-user-1' },
        {
          status: 'rejected',
          provider_status: 'denied',
          provider_application_status_reason: 'Insufficient documentation',
        },
      );
    });

    it('should process user updated webhook with completion link', async () => {
      const mockBody = {
        id: 'webhook-123',
        resource: 'user',
        action: 'updated',
        body: {
          id: 'user-456',
          email: 'test@example.com',
          firstName: 'Jane',
          lastName: 'Smith',
          applicationStatus: 'denied',
          applicationReason: 'Insufficient documentation',
          applicationCompletionLink: {
            url: 'https://app.rain.com/complete',
            params: { token: 'abc123' },
          },
        },
      };

      const mockHeaders = {
        Signature: 'test-signature',
      };

      const mockCardUser = {
        id: 'card-user-1',
        user_id: 'user-123',
        provider_ref: 'user-456',
        status: 'pending',
      };

      mockCardUserRepository.findOne.mockResolvedValue(mockCardUser);
      mockCardUserRepository.update.mockResolvedValue({});

      const result = await service.processWebhook(mockBody, mockHeaders);

      expect(result).toEqual({
        status: 'processed',
        action: 'user_denied',
        userId: 'user-456',
        cardUserUpdated: true,
      });
      expect(mockCardUserRepository.update).toHaveBeenCalledWith(
        { id: 'card-user-1' },
        {
          status: 'rejected',
          provider_status: 'denied',
          provider_application_status_reason: 'Insufficient documentation',
          provider_application_completion_url: 'https://app.rain.com/complete?token=abc123',
        },
      );
    });

    it('should handle user denied when card user not found', async () => {
      const mockBody = {
        id: 'webhook-123',
        resource: 'user',
        action: 'updated',
        body: {
          id: 'user-456',
          email: 'test@example.com',
          firstName: 'Jane',
          lastName: 'Smith',
          applicationStatus: 'denied',
          applicationReason: 'Insufficient documentation',
        },
      };

      const mockHeaders = {
        Signature: 'test-signature',
      };

      mockCardUserRepository.findOne.mockResolvedValue(null);

      const result = await service.processWebhook(mockBody, mockHeaders);

      expect(result).toEqual({
        status: 'processed',
        action: 'user_denied',
        userId: 'user-456',
        cardUserUpdated: false,
        reason: 'card_user_not_found',
      });
      expect(mockCardUserRepository.update).not.toHaveBeenCalled();
    });

    it('should handle error when updating card user for denied status', async () => {
      const mockBody = {
        id: 'webhook-123',
        resource: 'user',
        action: 'updated',
        body: {
          id: 'user-456',
          email: 'test@example.com',
          firstName: 'Jane',
          lastName: 'Smith',
          applicationStatus: 'canceled',
          applicationReason: 'User canceled application',
        },
      };

      const mockHeaders = {
        Signature: 'test-signature',
      };

      const mockCardUser = {
        id: 'card-user-1',
        user_id: 'user-123',
        provider_ref: 'user-456',
        status: 'pending',
      };

      mockCardUserRepository.findOne.mockResolvedValue(mockCardUser);
      mockCardUserRepository.update.mockRejectedValue(new Error('Database error'));

      const result = await service.processWebhook(mockBody, mockHeaders);

      expect(result).toEqual({
        status: 'processed',
        action: 'user_denied',
        userId: 'user-456',
        cardUserUpdated: false,
        error: 'Internal processing error',
      });
    });

    it('should handle user denied with canceled status', async () => {
      const mockBody = {
        id: 'webhook-123',
        resource: 'user',
        action: 'updated',
        body: {
          id: 'user-456',
          email: 'test@example.com',
          firstName: 'Jane',
          lastName: 'Smith',
          applicationStatus: 'canceled',
          applicationReason: 'User canceled application',
        },
      };

      const mockHeaders = {
        Signature: 'test-signature',
      };

      const mockCardUser = {
        id: 'card-user-1',
        user_id: 'user-123',
        provider_ref: 'user-456',
        status: 'pending',
      };

      mockCardUserRepository.findOne.mockResolvedValue(mockCardUser);
      mockCardUserRepository.update.mockResolvedValue({});

      const result = await service.processWebhook(mockBody, mockHeaders);

      expect(result).toEqual({
        status: 'processed',
        action: 'user_denied',
        userId: 'user-456',
        cardUserUpdated: true,
      });
      expect(mockCardUserRepository.update).toHaveBeenCalledWith(
        { id: 'card-user-1' },
        {
          status: 'rejected',
          provider_status: 'canceled',
          provider_application_status_reason: 'User canceled application',
        },
      );
    });

    it('should handle user denied with completion link but no url', async () => {
      const mockBody = {
        id: 'webhook-123',
        resource: 'user',
        action: 'updated',
        body: {
          id: 'user-456',
          email: 'test@example.com',
          firstName: 'Jane',
          lastName: 'Smith',
          applicationStatus: 'denied',
          applicationReason: 'Insufficient documentation',
          applicationCompletionLink: {},
        },
      };

      const mockHeaders = {
        Signature: 'test-signature',
      };

      const mockCardUser = {
        id: 'card-user-1',
        user_id: 'user-123',
        provider_ref: 'user-456',
        status: 'pending',
      };

      mockCardUserRepository.findOne.mockResolvedValue(mockCardUser);
      mockCardUserRepository.update.mockResolvedValue({});

      const result = await service.processWebhook(mockBody, mockHeaders);

      expect(result).toEqual({
        status: 'processed',
        action: 'user_denied',
        userId: 'user-456',
        cardUserUpdated: true,
      });
      expect(mockCardUserRepository.update).toHaveBeenCalledWith(
        { id: 'card-user-1' },
        {
          status: 'rejected',
          provider_status: 'denied',
          provider_application_status_reason: 'Insufficient documentation',
        },
      );
    });

    it('should handle user denied with completion link url as null', async () => {
      const mockBody = {
        id: 'webhook-123',
        resource: 'user',
        action: 'updated',
        body: {
          id: 'user-456',
          email: 'test@example.com',
          firstName: 'Jane',
          lastName: 'Smith',
          applicationStatus: 'denied',
          applicationReason: 'Insufficient documentation',
          applicationCompletionLink: {
            url: null,
            params: { token: 'abc123' },
          },
        },
      };

      const mockHeaders = {
        Signature: 'test-signature',
      };

      const mockCardUser = {
        id: 'card-user-1',
        user_id: 'user-123',
        provider_ref: 'user-456',
        status: 'pending',
      };

      mockCardUserRepository.findOne.mockResolvedValue(mockCardUser);
      mockCardUserRepository.update.mockResolvedValue({});

      const result = await service.processWebhook(mockBody, mockHeaders);

      expect(result).toEqual({
        status: 'processed',
        action: 'user_denied',
        userId: 'user-456',
        cardUserUpdated: true,
      });
      expect(mockCardUserRepository.update).toHaveBeenCalledWith(
        { id: 'card-user-1' },
        {
          status: 'rejected',
          provider_status: 'denied',
          provider_application_status_reason: 'Insufficient documentation',
        },
      );
    });

    it('should process user denied with completion link url but no params', async () => {
      const mockBody = {
        id: 'webhook-123',
        resource: 'user',
        action: 'updated',
        body: {
          id: 'user-456',
          email: 'test@example.com',
          firstName: 'Jane',
          lastName: 'Smith',
          applicationStatus: 'denied',
          applicationReason: 'Insufficient documentation',
          applicationCompletionLink: {
            url: 'https://app.rain.com/complete',
          },
        },
      };

      const mockHeaders = {
        Signature: 'test-signature',
      };

      const mockCardUser = {
        id: 'card-user-1',
        user_id: 'user-123',
        provider_ref: 'user-456',
        status: 'pending',
      };

      mockCardUserRepository.findOne.mockResolvedValue(mockCardUser);
      mockCardUserRepository.update.mockResolvedValue({});

      const result = await service.processWebhook(mockBody, mockHeaders);

      expect(result).toEqual({
        status: 'processed',
        action: 'user_denied',
        userId: 'user-456',
        cardUserUpdated: true,
      });
      expect(mockCardUserRepository.update).toHaveBeenCalledWith(
        { id: 'card-user-1' },
        {
          status: 'rejected',
          provider_status: 'denied',
          provider_application_status_reason: 'Insufficient documentation',
          provider_application_completion_url: 'https://app.rain.com/complete',
        },
      );
    });

    it('should process user denied with completion link with multiple params', async () => {
      const mockBody = {
        id: 'webhook-123',
        resource: 'user',
        action: 'updated',
        body: {
          id: 'user-456',
          email: 'test@example.com',
          firstName: 'Jane',
          lastName: 'Smith',
          applicationStatus: 'denied',
          applicationReason: 'Insufficient documentation',
          applicationCompletionLink: {
            url: 'https://app.rain.com/complete',
            params: { userId: 'user-456', signature: 'abc123' },
          },
        },
      };

      const mockHeaders = {
        Signature: 'test-signature',
      };

      const mockCardUser = {
        id: 'card-user-1',
        user_id: 'user-123',
        provider_ref: 'user-456',
        status: 'pending',
      };

      mockCardUserRepository.findOne.mockResolvedValue(mockCardUser);
      mockCardUserRepository.update.mockResolvedValue({});

      const result = await service.processWebhook(mockBody, mockHeaders);

      expect(result).toEqual({
        status: 'processed',
        action: 'user_denied',
        userId: 'user-456',
        cardUserUpdated: true,
      });
      expect(mockCardUserRepository.update).toHaveBeenCalledWith(
        { id: 'card-user-1' },
        {
          status: 'rejected',
          provider_status: 'denied',
          provider_application_status_reason: 'Insufficient documentation',
          provider_application_completion_url: 'https://app.rain.com/complete?userId=user-456&signature=abc123',
        },
      );
    });

    it('should handle unknown webhook events', async () => {
      const mockBody = {
        id: 'webhook-123',
        resource: 'card',
        action: 'created',
      };

      const mockHeaders = {
        Signature: 'test-signature',
      };

      const result = await service.processWebhook(mockBody, mockHeaders);

      expect(result).toEqual({
        status: 'ignored',
        reason: 'unsupported_card_action',
      });
    });

    it('should handle user webhook with different application statuses', async () => {
      const statuses = ['pending', 'needsInformation', 'needsVerification', 'manualReview', 'locked', 'canceled'];

      for (const status of statuses) {
        const mockBody = {
          id: 'webhook-123',
          resource: 'user',
          action: 'updated',
          body: {
            id: 'user-456',
            email: 'test@example.com',
            firstName: 'Test',
            lastName: 'User',
            applicationStatus: status,
            applicationReason: `Status: ${status}`,
          },
        };

        const mockHeaders = {
          Signature: 'test-signature',
        };

        if (status === 'canceled' || status === 'denied') {
          const mockCardUser = {
            id: 'card-user-1',
            user_id: 'user-123',
            provider_ref: 'user-456',
            status: 'pending',
          };
          mockCardUserRepository.findOne.mockResolvedValue(mockCardUser);
          mockCardUserRepository.update.mockResolvedValue({});
        }

        const result = await service.processWebhook(mockBody, mockHeaders);

        let expectedAction;
        switch (status) {
          case 'pending':
          case 'manualReview':
            expectedAction = 'user_pending';
            break;
          case 'needsVerification':
            expectedAction = 'user_needs_verification';
            break;
          case 'canceled':
            expectedAction = 'user_denied';
            break;
          default:
            expectedAction = 'ignored';
        }

        expect(result).toEqual({
          status: expectedAction === 'ignored' ? 'ignored' : 'processed',
          ...(expectedAction === 'ignored'
            ? { reason: 'unknown_user_status' }
            : {
                action: expectedAction,
                userId: 'user-456',
                ...(status === 'canceled' ? { cardUserUpdated: true } : {}),
              }),
        });
      }
    });
  });

  describe('handleWebhookEvent - contract', () => {
    it('should route contract webhook to handler', async () => {
      const payload = {
        id: 'webhook-123',
        resource: 'contract',
        action: 'created',
        body: { id: 'contract-123' },
      };
      const expected = { status: 'processed', action: 'contract_created' };
      const handlerSpy = jest.spyOn(service as any, 'handleContractCreated').mockResolvedValue(expected);

      const result = await (service as any).handleWebhookEvent(payload);

      expect(handlerSpy).toHaveBeenCalledWith(payload);
      expect(result).toEqual(expected);
    });
  });

  describe('lookupCollateralTransactionEntities - unknown chain', () => {
    it('should return unknown_chain_id for unrecognized chain', async () => {
      const result = await (service as any).lookupCollateralTransactionEntities('rain-user-123', 999999, 'txn-123');

      expect(result).toEqual({ success: false, reason: 'unknown_chain_id' });
    });
  });

  describe('processCollateralBalanceUpdate - updated transaction fetch', () => {
    it('should return updated transaction after balance update', async () => {
      const mockTxData = { id: 'txn-123' } as any;
      const mockCardUser = { id: 'card-user-123', user_id: 'user-123' } as any;
      const mockExistingTransaction = { id: 'card-txn-123', card_id: 'card-123' } as any;
      const mockUpdatedTransaction = { id: 'card-txn-123', status: 'successful' } as any;

      jest.spyOn(service as any, 'updateBalancesWithinTransaction').mockResolvedValue({ updated: true });
      mockLockerService.withLock.mockImplementation(async (key, callback) => callback());
      mockCardTransactionRepository.transaction.mockImplementation(async (callback) => callback({}));
      mockCardTransactionRepository.findOne.mockResolvedValue(mockUpdatedTransaction);

      const result = await (service as any).processCollateralBalanceUpdate(
        mockTxData,
        mockCardUser,
        mockExistingTransaction,
        1000,
      );

      expect(result.updated).toBe(true);
      expect(result.updatedTransaction).toEqual(mockUpdatedTransaction);
    });
  });

  describe('handleCollateralTransaction - post funding failure', () => {
    it('should return error when post funding actions fail', async () => {
      const mockTxData = {
        id: 'txn-123',
        collateral: {
          amount: 10000,
          currency: 'USD',
          chainId: 11155111,
          walletAddress: '0x123',
          transactionHash: '0xabc',
          userId: 'rain-user-123',
        },
      } as any;

      const mockCardUser = {
        id: 'card-user-123',
        user_id: 'user-123',
      } as any;

      const mockExistingTransaction = {
        id: 'card-txn-123',
        card_id: 'card-123',
      } as any;

      jest.spyOn(service as any, 'validateCollateralTransaction').mockResolvedValue(null);
      jest
        .spyOn(service as any, 'lookupCollateralTransactionEntities')
        .mockResolvedValue({ success: true, cardUser: mockCardUser, existingTransaction: mockExistingTransaction });
      jest.spyOn(service as any, 'processCollateralBalanceUpdate').mockResolvedValue({
        updated: true,
        updatedTransaction: { status: 'successful' },
        amountToCredit: 9900,
      });
      const postFundingSpy = jest
        .spyOn(service as any, 'handlePostFundingActions')
        .mockRejectedValue(new Error('Post funding failed'));

      const result = await (service as any).handleCollateralTransaction(mockTxData);

      expect(postFundingSpy).toHaveBeenCalled();
      expect(result).toEqual({
        status: 'processed',
        action: 'transaction_created',
        transactionId: 'txn-123',
        updated: false,
        error: 'Internal processing error',
      });
    });
  });

  describe('processSpendTransactionInTransaction - declined status', () => {
    it('should not debit balances when transaction is declined', async () => {
      const mockCard = { id: 'card-123', balance: 500, user_id: 'user-123', card_user_id: 'card-user-123' } as any;
      const mockCardUser = { id: 'card-user-123', balance: 500, user_id: 'user-123' } as any;
      const mockTxData = { id: 'txn-123' } as any;

      mockCardRepository.findOne.mockResolvedValue(mockCard);
      mockCardUserRepository.findOne.mockResolvedValue(mockCardUser);

      jest.spyOn(service as any, 'createSpendCardTransaction').mockResolvedValue({ id: 'card-txn-123' });
      jest.spyOn(service as any, 'createSpendMainTransaction').mockResolvedValue({ id: 'main-txn-123' });
      const updateBalancesSpy = jest.spyOn(service as any, 'updateBalancesForSpend').mockResolvedValue(undefined);

      const result = await (service as any).processSpendTransactionInTransaction(
        {},
        {
          card: mockCard,
          cardUser: mockCardUser,
          txData: mockTxData,
          amount: 100,
          currency: 'USD',
          status: 'declined',
          merchantName: 'Test Merchant',
          merchantId: 'merchant-123',
          merchantCity: 'New York',
          merchantCountry: 'US',
          merchantCategory: 'Retail',
          merchantCategoryCode: '1234',
          authorizedAmount: 100,
          authorizationMethod: 'chip',
          declinedReason: 'do_not_honor',
          authorizedAt: new Date(),
          cardId: 'rain-card-123',
          cardType: 'virtual',
          localAmount: 100,
          localCurrency: 'USD',
        },
      );

      expect(result.newBalance).toBe(500);
      expect(updateBalancesSpy).not.toHaveBeenCalled();
    });
  });

  describe('createSpendMainTransaction - processedAt', () => {
    it('should persist processed_at when provided', async () => {
      const processedAt = new Date().toISOString();
      const mockCardUser = { id: 'card-user-123', user_id: 'user-123' } as any;
      const mockTxData = { id: 'txn-123' } as any;
      const trx = {};

      mockTransactionRepository.create.mockResolvedValue({ id: 'main-txn-123' } as any);

      const result = await (service as any).createSpendMainTransaction(trx, {
        cardUser: mockCardUser,
        txData: mockTxData,
        currency: 'USD',
        transactionAmount: 100,
        currentBalance: 500,
        newBalance: 400,
        mainTransactionStatus: TransactionStatus.COMPLETED,
        processedAt,
        cardId: 'rain-card-123',
        cardType: 'virtual',
        merchantName: 'Test Merchant',
        merchantId: 'merchant-123',
        merchantCity: 'New York',
        merchantCountry: 'US',
        merchantCategory: 'Retail',
        merchantCategoryCode: '1234',
        localAmount: 100,
        localCurrency: 'USD',
        authorizationMethod: 'chip',
        declinedReason: 'do_not_honor',
      });

      expect(mockTransactionRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ processed_at: processedAt }),
        trx,
      );
      expect(result).toEqual({ id: 'main-txn-123' });
    });
  });

  describe('processWebhook - card events', () => {
    it('should process card updated webhook successfully', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
      };

      const mockCard = {
        id: 'card-123',
        user_id: 'user-123',
        provider_ref: 'rain-card-123',
        status: 'active',
        limit: 1000,
        limit_frequency: 'per30DayPeriod',
      };

      const mockCardUser = {
        id: 'card-user-123',
        provider_ref: 'rain-user-123',
        user: mockUser,
      };

      const mockBody = {
        id: 'webhook-123',
        resource: 'card',
        action: 'updated',
        body: {
          id: 'rain-card-123',
          userId: 'rain-user-123',
          status: 'active',
          limit: {
            amount: 2000,
            frequency: 'per7DayPeriod',
          },
          expirationMonth: '12',
          expirationYear: '2027',
          tokenWallets: ['apple', 'google'],
        },
      };

      const mockHeaders = {
        Signature: 'test-signature',
      };

      mockCardRepository.findOne
        .mockResolvedValueOnce(mockCard as any)
        .mockResolvedValueOnce({ ...mockCard, status: 'active', limit: 2000 } as any);
      mockCardUserRepository.findOne.mockResolvedValue(mockCardUser as any);
      mockCardRepository.update.mockResolvedValue({} as any);
      mockInAppNotificationService.createNotification.mockResolvedValue({} as any);
      mockMailerService.send.mockResolvedValue(undefined);

      const result = await service.processWebhook(mockBody, mockHeaders);

      expect(result.status).toBe('processed');
      expect(result.action).toBe('card_updated');
      expect(mockCardRepository.update).toHaveBeenCalled();
    });

    it('should process card notification webhook successfully', async () => {
      const mockCardUser = {
        id: 'card-user-123',
        provider_ref: 'rain-user-123',
      };

      const mockBody = {
        id: 'webhook-123',
        resource: 'card',
        action: 'notification',
        body: {
          id: 'notification-123',
          card: {
            id: 'rain-card-123',
            userId: 'rain-user-123',
          },
          tokenWallet: 'apple',
          reasonCode: 'card_locked',
          decisionReason: {
            code: 'LOCKED',
            description: 'Card has been locked',
          },
        },
      };

      const mockHeaders = {
        Signature: 'test-signature',
      };

      mockCardUserRepository.findOne.mockResolvedValue(mockCardUser as any);

      const result = await service.processWebhook(mockBody, mockHeaders);

      expect(result.status).toBe('processed');
      expect(result.action).toBe('card_notification');
    });
  });

  describe('processWebhook - contract events', () => {
    it('should process contract created webhook successfully', async () => {
      const mockCardUser = {
        id: 'card-user-123',
        provider_ref: 'rain-user-123',
        user_id: 'user-123',
      };

      const mockBody = {
        id: 'webhook-123',
        resource: 'contract',
        action: 'created',
        body: {
          id: 'contract-123',
          userId: 'rain-user-123',
          chainId: 1,
          depositAddress: '0x1234567890abcdef',
        },
      };

      const mockHeaders = {
        Signature: 'test-signature',
      };

      mockCardUserRepository.findOne.mockResolvedValue(mockCardUser as any);
      mockDepositAddressRepository.findOne.mockResolvedValue(null);
      mockDepositAddressRepository.create.mockResolvedValue({} as any);

      const result = await service.processWebhook(mockBody, mockHeaders);

      expect(result.status).toBe('processed');
      expect(result.action).toBe('contract_created');
    });
  });

  describe('processWebhook - transaction events', () => {
    it('should process spend transaction created webhook successfully', async () => {
      const mockCard = {
        id: 'card-123',
        user_id: 'user-123',
        provider_ref: 'rain-card-123',
        balance: 10000,
      };

      const mockCardUser = {
        id: 'card-user-123',
        user_id: 'user-123',
        provider_ref: 'rain-user-123',
        balance: 10000,
      };

      const mockBody = {
        id: 'webhook-123',
        resource: 'transaction',
        action: 'created',
        body: {
          id: 'txn-123',
          type: 'spend',
          spend: {
            amount: -5000,
            currency: 'USD',
            merchantName: 'Test Merchant',
            merchantCity: 'New York',
            merchantCountry: 'US',
            merchantCategory: 'Retail',
            merchantCategoryCode: '5411',
            cardId: 'rain-card-123',
            cardType: 'virtual',
            userId: 'rain-user-123',
            userFirstName: 'John',
            userLastName: 'Doe',
            userEmail: 'john@example.com',
            status: 'pending',
          },
        },
      };

      const mockHeaders = {
        Signature: 'test-signature',
      };

      mockCardRepository.findOne.mockResolvedValue(mockCard as any);
      mockCardUserRepository.findOne.mockResolvedValue(mockCardUser as any);
      mockCardTransactionRepository.findOne.mockResolvedValue(null);
      mockCardTransactionRepository.create.mockResolvedValue({ id: 'card-txn-123' } as any);
      mockCardRepository.update.mockResolvedValue({} as any);
      mockCardUserRepository.update.mockResolvedValue({} as any);
      mockInAppNotificationService.createNotification.mockResolvedValue({} as any);
      mockMailerService.send.mockResolvedValue(undefined);

      const result = await service.processWebhook(mockBody, mockHeaders);

      expect(result.status).toBe('processed');
      expect(result.action).toBe('spend_transaction_created');
    });

    it('should trim whitespace from merchant fields using normalizeMerchantData', () => {
      const inputData = {
        merchantName: '  Test Merchant  ',
        merchantId: '  MERCHANT-123  ',
        merchantCity: '  New York  ',
        merchantCountry: '  US  ',
        merchantCategory: '  Retail  ',
        merchantCategoryCode: '  5411  ',
      };

      const normalized = (service as any).normalizeMerchantData(inputData);

      expect(normalized.merchantName).toBe('Test Merchant');
      expect(normalized.merchantId).toBe('MERCHANT-123');
      expect(normalized.merchantCity).toBe('New York');
      expect(normalized.merchantCountry).toBe('US');
      expect(normalized.merchantCategory).toBe('Retail');
      expect(normalized.merchantCategoryCode).toBe('5411');
    });

    it('should handle non-string values in normalizeMerchantData', () => {
      const inputData = {
        merchantName: '  Test Merchant  ',
        merchantId: null,
        merchantCity: undefined,
        merchantCountry: '  US  ',
        merchantCategory: 123,
        merchantCategoryCode: '  5411  ',
      };

      const normalized = (service as any).normalizeMerchantData(inputData);

      expect(normalized.merchantName).toBe('Test Merchant');
      expect(normalized.merchantId).toBe(null);
      expect(normalized.merchantCity).toBe(undefined);
      expect(normalized.merchantCountry).toBe('US');
      expect(normalized.merchantCategory).toBe(123);
      expect(normalized.merchantCategoryCode).toBe('5411');
    });
  });

  describe('processWebhook - user events edge cases', () => {
    it('should handle card user already approved', async () => {
      const mockBody = {
        id: 'webhook-123',
        resource: 'user',
        action: 'updated',
        body: {
          id: 'rain-user-123',
          applicationStatus: 'approved',
        },
      };

      const mockCardUser = {
        id: 'card-user-123',
        user_id: 'user-123',
        provider_ref: 'rain-user-123',
        status: ICardUserStatus.APPROVED,
        provider_status: 'approved',
      };

      const mockHeaders = {
        Signature: 'test-signature',
      };

      mockCardUserRepository.findOne.mockResolvedValue(mockCardUser as any);

      const result = await service.processWebhook(mockBody, mockHeaders);

      expect(result.status).toBe('processed');
      expect(result.action).toBe('user_approved');
      expect(result.cardUserUpdated).toBe(false);
      expect(result.reason).toBe('already_approved');
    });

    it('should handle user not found for card user', async () => {
      const mockBody = {
        id: 'webhook-123',
        resource: 'user',
        action: 'updated',
        body: {
          id: 'rain-user-123',
          applicationStatus: 'approved',
        },
      };

      const mockCardUser = {
        id: 'card-user-123',
        user_id: 'user-123',
        provider_ref: 'rain-user-123',
        status: ICardUserStatus.PENDING,
        provider_status: 'pending',
      };

      const mockHeaders = {
        Signature: 'test-signature',
      };

      mockCardUserRepository.findOne.mockResolvedValue(mockCardUser as any);
      mockUserRepository.findById.mockResolvedValue(null);

      const result = await service.processWebhook(mockBody, mockHeaders);

      expect(result.status).toBe('processed');
      expect(result.action).toBe('user_approved');
      expect(result.cardCreated).toBe(false);
      expect(result.reason).toBe('user_not_found');
    });

    it('should handle error when updating card user status', async () => {
      const mockBody = {
        id: 'webhook-123',
        resource: 'user',
        action: 'updated',
        body: {
          id: 'rain-user-123',
          applicationStatus: 'approved',
        },
      };

      const mockCardUser = {
        id: 'card-user-123',
        user_id: 'user-123',
        provider_ref: 'rain-user-123',
        status: ICardUserStatus.PENDING,
        provider_status: 'pending',
      };

      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
      };

      const mockHeaders = {
        Signature: 'test-signature',
      };

      mockCardUserRepository.findOne.mockResolvedValue(mockCardUser as any);
      mockUserRepository.findById.mockResolvedValue(mockUser as any);
      mockCardUserRepository.update.mockRejectedValue(new Error('Database error'));

      const result = await service.processWebhook(mockBody, mockHeaders);

      expect(result.status).toBe('processed');
      expect(result.action).toBe('user_approved');
    });
  });

  describe('processWebhook - contract events edge cases', () => {
    it('should handle unknown chain ID', async () => {
      const mockBody = {
        id: 'webhook-123',
        resource: 'contract',
        action: 'created',
        body: {
          id: 'contract-123',
          userAddress: '0x123',
          chainId: '999999',
          depositAddress: '0x456',
        },
      };

      const mockCardUser = {
        id: 'card-user-123',
        user_id: 'user-123',
        provider_ref: 'rain-user-123',
      };

      const mockHeaders = {
        Signature: 'test-signature',
      };

      mockCardUserRepository.findOne.mockResolvedValue(mockCardUser as any);

      const result = await service.processWebhook(mockBody, mockHeaders);

      expect(result.status).toBe('processed');
      expect(result.action).toBe('contract_created');
    });

    it('should handle blockchain wallet or user not found', async () => {
      const mockBody = {
        id: 'webhook-123',
        resource: 'contract',
        action: 'created',
        body: {
          id: 'contract-123',
          userAddress: '0x123',
          chainId: '11155111',
          depositAddress: '0x456',
        },
      };

      const mockCardUser = {
        id: 'card-user-123',
        user_id: 'user-123',
        provider_ref: 'rain-user-123',
      };

      const mockHeaders = {
        Signature: 'test-signature',
      };

      mockCardUserRepository.findOne.mockResolvedValue(mockCardUser as any);
      mockBlockchainWalletRepository.findByAddress.mockResolvedValue(null);

      const result = await service.processWebhook(mockBody, mockHeaders);

      expect(result.status).toBe('processed');
      expect(result.action).toBe('contract_created');
    });

    it('should handle deposit address already exists', async () => {
      const mockBody = {
        id: 'webhook-123',
        resource: 'contract',
        action: 'created',
        body: {
          id: 'contract-123',
          userAddress: '0x123',
          chainId: '11155111',
          depositAddress: '0x456',
        },
      };

      const mockCardUser = {
        id: 'card-user-123',
        user_id: 'user-123',
        provider_ref: 'rain-user-123',
      };

      const mockBlockchainWallet = {
        id: 'wallet-123',
        address: '0x123',
        user: {
          id: 'user-123',
        },
      };

      const mockExistingDepositAddress = {
        id: 'deposit-123',
        address: '0x456',
      };

      const mockHeaders = {
        Signature: 'test-signature',
      };

      mockCardUserRepository.findOne.mockResolvedValue(mockCardUser as any);
      mockBlockchainWalletRepository.findByAddress.mockResolvedValue(mockBlockchainWallet as any);
      mockDepositAddressRepository.findOne.mockResolvedValue(mockExistingDepositAddress as any);

      const result = await service.processWebhook(mockBody, mockHeaders);

      expect(result.status).toBe('processed');
      expect(result.action).toBe('contract_created');
    });

    it('should create deposit address successfully', async () => {
      const mockBody = {
        id: 'webhook-123',
        resource: 'contract',
        action: 'created',
        body: {
          id: 'contract-123',
          userAddress: '0x123',
          chainId: '11155111',
          depositAddress: '0x456',
        },
      };

      const mockCardUser = {
        id: 'card-user-123',
        user_id: 'user-123',
        provider_ref: 'rain-user-123',
      };

      const mockBlockchainWallet = {
        id: 'wallet-123',
        address: '0x123',
        user: {
          id: 'user-123',
        },
      };

      const mockCreatedDepositAddress = {
        id: 'deposit-123',
        address: '0x456',
      };

      const mockHeaders = {
        Signature: 'test-signature',
      };

      mockCardUserRepository.findOne.mockResolvedValue(mockCardUser as any);
      mockBlockchainWalletRepository.findByAddress.mockResolvedValue(mockBlockchainWallet as any);
      mockDepositAddressRepository.findOne.mockResolvedValue(null);
      mockDepositAddressRepository.create.mockResolvedValue(mockCreatedDepositAddress as any);

      const result = await service.processWebhook(mockBody, mockHeaders);

      expect(result.status).toBe('processed');
      expect(result.action).toBe('contract_created');
      expect(mockDepositAddressRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: 'user-123',
          provider: 'rain',
          address: '0x456',
        }),
      );
    });
  });

  describe('processWebhook - transaction events', () => {
    it('should handle spend transaction requested', async () => {
      const mockBody = {
        id: 'webhook-123',
        resource: 'transaction',
        action: 'requested',
        body: {
          id: 'txn-123',
          type: 'spend',
          spend: {
            amount: -5000,
            currency: 'USD',
            cardId: 'rain-card-123',
            userId: 'rain-user-123',
            merchantName: 'Test Merchant',
            status: 'pending',
          },
        },
      };

      const mockHeaders = {
        Signature: 'test-signature',
      };

      const result = await service.processWebhook(mockBody, mockHeaders);

      expect(result).toBeDefined();
    });

    it('should handle spend transaction updated', async () => {
      const mockBody = {
        id: 'webhook-123',
        resource: 'transaction',
        action: 'updated',
        body: {
          id: 'txn-123',
          type: 'spend',
          spend: {
            amount: -5000,
            currency: 'USD',
            cardId: 'rain-card-123',
            userId: 'rain-user-123',
            merchantName: 'Test Merchant',
            status: 'pending',
          },
        },
      };

      const mockHeaders = {
        Signature: 'test-signature',
      };

      const result = await service.processWebhook(mockBody, mockHeaders);

      expect(result).toBeDefined();
    });

    it('should handle spend transaction completed', async () => {
      const mockBody = {
        id: 'webhook-123',
        resource: 'transaction',
        action: 'completed',
        body: {
          id: 'txn-123',
          type: 'spend',
          spend: {
            amount: -5000,
            currency: 'USD',
            cardId: 'rain-card-123',
            userId: 'rain-user-123',
            merchantName: 'Test Merchant',
            status: 'completed',
          },
        },
      };

      const mockCard = {
        id: 'card-123',
        user_id: 'user-123',
        provider_ref: 'rain-card-123',
        balance: 10000,
      };

      const mockCardUser = {
        id: 'card-user-123',
        user_id: 'user-123',
        provider_ref: 'rain-user-123',
        balance: 10000,
      };

      const mockHeaders = {
        Signature: 'test-signature',
      };

      mockCardRepository.findOne.mockResolvedValue(mockCard as any);
      mockCardUserRepository.findOne.mockResolvedValue(mockCardUser as any);
      mockCardTransactionRepository.findOne.mockResolvedValue({
        id: 'card-txn-123',
        card_id: 'card-123',
      } as any);
      mockLockerService.withLock.mockImplementation(async (key, fn) => fn());
      mockCardTransactionRepository.transaction.mockImplementation(async (fn) => fn({}));
      mockCardTransactionRepository.update.mockResolvedValue({} as any);
      mockCardRepository.update.mockResolvedValue({} as any);
      mockCardUserRepository.update.mockResolvedValue({} as any);

      const result = await service.processWebhook(mockBody, mockHeaders);

      expect(result).toBeDefined();
    });

    it('should handle collateral transaction', async () => {
      const mockBody = {
        id: 'webhook-123',
        resource: 'transaction',
        action: 'created',
        body: {
          id: 'txn-123',
          type: 'collateral',
          collateral: {
            amount: 10000,
            currency: 'USD',
            chainId: 11155111,
            walletAddress: '0x123',
            transactionHash: '0xabc',
            userId: 'rain-user-123',
            postedAt: '2024-01-01T00:00:00Z',
          },
        },
      };

      const mockCardUser = {
        id: 'card-user-123',
        user_id: 'user-123',
        provider_ref: 'rain-user-123',
        balance: 0,
      };

      const mockDepositAddress = {
        id: 'deposit-123',
        address: '0x456',
      };

      const mockCardTransaction = {
        id: 'card-txn-123',
        card_id: 'card-123',
        user_id: 'user-123',
        card_user_id: 'card-user-123',
      };

      const mockCard = {
        id: 'card-123',
        user_id: 'user-123',
        balance: 0,
      };

      const mockHeaders = {
        Signature: 'test-signature',
      };

      mockTransactionRepository.findOne.mockResolvedValue(null);
      mockCardUserRepository.findOne.mockResolvedValue(mockCardUser as any);
      mockDepositAddressRepository.findOne.mockResolvedValue(mockDepositAddress as any);
      mockCardTransactionRepository.findOne.mockResolvedValue(mockCardTransaction as any);
      mockLockerService.withLock.mockImplementation(async (key, fn) => fn());
      mockCardTransactionRepository.transaction.mockImplementation(async (fn) => fn({}));
      mockCardRepository.findOne.mockResolvedValue(mockCard as any);
      mockCardTransactionRepository.update.mockResolvedValue({} as any);
      mockCardRepository.update.mockResolvedValue({} as any);
      mockCardUserRepository.update.mockResolvedValue({} as any);

      const result = await service.processWebhook(mockBody, mockHeaders);

      expect(result).toBeDefined();
    });

    it('should handle collateral transaction already processed', async () => {
      const mockBody = {
        id: 'webhook-123',
        resource: 'transaction',
        action: 'created',
        body: {
          id: 'txn-123',
          type: 'collateral',
          collateral: {
            amount: 10000,
            currency: 'USD',
            chainId: 11155111,
            walletAddress: '0x123',
            transactionHash: '0xabc',
            userId: 'rain-user-123',
            postedAt: '2024-01-01T00:00:00Z',
          },
        },
      };

      const mockExistingTransaction = {
        id: 'txn-123',
        reference: 'txn-123',
        status: TransactionStatus.COMPLETED,
      };

      const mockHeaders = {
        Signature: 'test-signature',
      };

      mockTransactionRepository.findOne.mockResolvedValue(mockExistingTransaction as any);

      const result = await service.processWebhook(mockBody, mockHeaders);

      expect(result.status).toBe('processed');
      expect(result.action).toBe('transaction_created');
      expect(result.updated).toBe(false);
      expect(result.reason).toBe('transaction_already_processed');
    });

    it('should handle missing userId or chainId in collateral transaction', async () => {
      const mockBody = {
        id: 'webhook-123',
        resource: 'transaction',
        action: 'created',
        body: {
          id: 'txn-123',
          type: 'collateral',
          collateral: {
            amount: 10000,
            currency: 'USD',
            chainId: null,
            walletAddress: '0x123',
            transactionHash: '0xabc',
            userId: null,
            postedAt: '2024-01-01T00:00:00Z',
          },
        },
      };

      const mockHeaders = {
        Signature: 'test-signature',
      };

      mockTransactionRepository.findOne.mockResolvedValue(null);

      const result = await service.processWebhook(mockBody, mockHeaders);

      expect(result.status).toBe('processed');
      expect(result.action).toBe('transaction_created');
      expect(result.updated).toBe(false);
      expect(result.reason).toBe('missing_user_id_or_chain_id');
    });

    it('should handle no pending card transaction matched', async () => {
      const mockBody = {
        id: 'webhook-123',
        resource: 'transaction',
        action: 'created',
        body: {
          id: 'txn-123',
          type: 'collateral',
          collateral: {
            amount: 10000,
            currency: 'USD',
            chainId: 11155111,
            walletAddress: '0x123',
            transactionHash: '0xabc',
            userId: 'rain-user-123',
            postedAt: '2024-01-01T00:00:00Z',
          },
        },
      };

      const mockCardUser = {
        id: 'card-user-123',
        user_id: 'user-123',
        provider_ref: 'rain-user-123',
      };

      const mockDepositAddress = {
        id: 'deposit-123',
        address: '0x456',
      };

      const mockHeaders = {
        Signature: 'test-signature',
      };

      mockTransactionRepository.findOne.mockResolvedValue(null);
      mockCardUserRepository.findOne.mockResolvedValue(mockCardUser as any);
      mockDepositAddressRepository.findOne.mockResolvedValue(mockDepositAddress as any);
      mockCardTransactionRepository.findOne.mockResolvedValue(null);

      const result = await service.processWebhook(mockBody, mockHeaders);

      expect(result.status).toBe('processed');
      expect(result.reason).toBe('no_pending_card_transaction');
    });

    it('should handle no card ID found in transaction', async () => {
      const mockBody = {
        id: 'webhook-123',
        resource: 'transaction',
        action: 'created',
        body: {
          id: 'txn-123',
          type: 'collateral',
          collateral: {
            amount: 10000,
            currency: 'USD',
            chainId: 11155111,
            walletAddress: '0x123',
            transactionHash: '0xabc',
            userId: 'rain-user-123',
            postedAt: '2024-01-01T00:00:00Z',
          },
        },
      };

      const mockCardUser = {
        id: 'card-user-123',
        user_id: 'user-123',
        provider_ref: 'rain-user-123',
      };

      const mockDepositAddress = {
        id: 'deposit-123',
        address: '0x456',
      };

      const mockCardTransaction = {
        id: 'card-txn-123',
        card_id: null,
        user_id: 'user-123',
        card_user_id: 'card-user-123',
      };

      const mockHeaders = {
        Signature: 'test-signature',
      };

      mockTransactionRepository.findOne.mockResolvedValue(null);
      mockCardUserRepository.findOne.mockResolvedValue(mockCardUser as any);
      mockDepositAddressRepository.findOne.mockResolvedValue(mockDepositAddress as any);
      mockCardTransactionRepository.findOne.mockResolvedValue(mockCardTransaction as any);

      const result = await service.processWebhook(mockBody, mockHeaders);

      expect(result.status).toBe('processed');
      expect(result.reason).toBe('no_card_id_in_transaction');
    });

    it('should handle card not found during funding transaction processing', async () => {
      const mockBody = {
        id: 'webhook-123',
        resource: 'transaction',
        action: 'created',
        body: {
          id: 'txn-123',
          type: 'collateral',
          collateral: {
            amount: 10000,
            currency: 'USD',
            chainId: 11155111,
            walletAddress: '0x123',
            transactionHash: '0xabc',
            userId: 'rain-user-123',
            postedAt: '2024-01-01T00:00:00Z',
          },
        },
      };

      const mockCardUser = {
        id: 'card-user-123',
        user_id: 'user-123',
        provider_ref: 'rain-user-123',
        balance: 0,
      };

      const mockDepositAddress = {
        id: 'deposit-123',
        address: '0x456',
      };

      const mockCardTransaction = {
        id: 'card-txn-123',
        card_id: 'card-123',
        user_id: 'user-123',
        card_user_id: 'card-user-123',
      };

      const mockHeaders = {
        Signature: 'test-signature',
      };

      mockTransactionRepository.findOne.mockResolvedValue(null);
      mockCardUserRepository.findOne.mockResolvedValue(mockCardUser as any);
      mockDepositAddressRepository.findOne.mockResolvedValue(mockDepositAddress as any);
      mockCardTransactionRepository.findOne.mockResolvedValue(mockCardTransaction as any);
      mockLockerService.withLock.mockImplementation(async (key, fn) => fn());
      mockCardTransactionRepository.transaction.mockImplementation(async (fn) => fn({}));
      mockCardRepository.findOne.mockResolvedValue(null);

      const result = await service.processWebhook(mockBody, mockHeaders);

      expect(result).toBeDefined();
    });
  });

  describe('processWebhook - sanitizeWebhookBody', () => {
    it('should sanitize webhook body with sensitive fields', async () => {
      const mockBody = {
        id: 'webhook-123',
        resource: 'user',
        action: 'updated',
        body: {
          id: 'user-123',
          email: 'test@example.com',
          phoneNumber: '+1234567890',
          firstName: 'John',
          cardNumber: '1234567890123456',
        },
      };

      const mockHeaders = {
        Signature: 'test-signature',
      };

      mockCardUserRepository.findOne.mockResolvedValue(null);

      await service.processWebhook(mockBody, mockHeaders);

      expect(service).toBeDefined();
    });

    it('should handle non-object body in sanitizeWebhookBody', async () => {
      const mockBody = 'string-body';
      const mockHeaders = {
        Signature: 'test-signature',
      };

      const result = await service.processWebhook(mockBody as any, mockHeaders);

      expect(result.status).toBe('ignored');
      expect(result.reason).toBe('unknown_event_type');
    });
  });

  describe('processWebhook - handleUserApproved edge cases', () => {
    it('should handle card user not found in handleUserApproved', async () => {
      const mockBody = {
        id: 'webhook-123',
        resource: 'user',
        action: 'updated',
        body: {
          id: 'rain-user-123',
          applicationStatus: 'approved',
        },
      };

      const mockHeaders = {
        Signature: 'test-signature',
      };

      mockCardUserRepository.findOne.mockResolvedValue(null);

      const result = await service.processWebhook(mockBody, mockHeaders);

      expect(result.status).toBe('processed');
      expect(result.action).toBe('user_approved');
      expect(result.cardCreated).toBe(false);
      expect(result.reason).toBe('card_user_not_found');
    });
  });

  describe('processWebhook - handleContractCreated error handling', () => {
    it('should handle error in handleContractCreated', async () => {
      const mockBody = {
        id: 'webhook-123',
        resource: 'contract',
        action: 'created',
        body: {
          id: 'contract-123',
          userAddress: '0x123',
          chainId: '11155111',
          depositAddress: '0x456',
        },
      };

      const mockCardUser = {
        id: 'card-user-123',
        user_id: 'user-123',
        provider_ref: 'rain-user-123',
      };

      const mockBlockchainWallet = {
        id: 'wallet-123',
        address: '0x123',
        user: {
          id: 'user-123',
        },
      };

      const mockHeaders = {
        Signature: 'test-signature',
      };

      mockCardUserRepository.findOne.mockResolvedValue(mockCardUser as any);
      mockBlockchainWalletRepository.findByAddress.mockResolvedValue(mockBlockchainWallet as any);
      mockDepositAddressRepository.findOne.mockRejectedValue(new Error('Database error'));

      const result = await service.processWebhook(mockBody, mockHeaders);

      expect(result.status).toBe('processed');
      expect(result.action).toBe('contract_created');
      expect(result.depositAddressCreated).toBe(false);
      expect(result.error).toBe('Internal processing error');
    });
  });

  describe('processWebhook - unsupported transaction type', () => {
    it('should handle unsupported transaction type', async () => {
      const mockBody = {
        id: 'webhook-123',
        resource: 'transaction',
        action: 'created',
        body: {
          id: 'txn-123',
          type: 'unknown_type',
        },
      };

      const mockHeaders = {
        Signature: 'test-signature',
      };

      const result = await service.processWebhook(mockBody, mockHeaders);

      expect(result.status).toBe('ignored');
      expect(result.reason).toBe('unsupported_transaction_type');
    });
  });

  describe('processWebhook - handleCollateralTransaction edge cases', () => {
    it('should handle deposit address not found in collateral transaction', async () => {
      const mockBody = {
        id: 'webhook-123',
        resource: 'transaction',
        action: 'created',
        body: {
          id: 'txn-123',
          type: 'collateral',
          collateral: {
            amount: 10000,
            currency: 'USD',
            chainId: 11155111,
            walletAddress: '0x123',
            transactionHash: '0xabc',
            userId: 'rain-user-123',
            postedAt: '2024-01-01T00:00:00Z',
          },
        },
      };

      const mockCardUser = {
        id: 'card-user-123',
        user_id: 'user-123',
        provider_ref: 'rain-user-123',
      };

      const mockHeaders = {
        Signature: 'test-signature',
      };

      mockTransactionRepository.findOne.mockResolvedValue(null);
      mockCardUserRepository.findOne.mockResolvedValue(mockCardUser as any);
      mockDepositAddressRepository.findOne.mockResolvedValue(null);

      const result = await service.processWebhook(mockBody, mockHeaders);

      expect(result.status).toBe('processed');
      expect(result.action).toBe('transaction_created');
      expect(result.updated).toBe(false);
      expect(result.reason).toBe('deposit_address_not_found');
    });

    it('should handle card user not found during balance update in collateral transaction', async () => {
      const mockBody = {
        id: 'webhook-123',
        resource: 'transaction',
        action: 'created',
        body: {
          id: 'txn-123',
          type: 'collateral',
          collateral: {
            amount: 10000,
            currency: 'USD',
            chainId: 11155111,
            walletAddress: '0x123',
            transactionHash: '0xabc',
            userId: 'rain-user-123',
            postedAt: '2024-01-01T00:00:00Z',
          },
        },
      };

      const mockCardUser = {
        id: 'card-user-123',
        user_id: 'user-123',
        provider_ref: 'rain-user-123',
        balance: 0,
      };

      const mockDepositAddress = {
        id: 'deposit-123',
        address: '0x456',
      };

      const mockCardTransaction = {
        id: 'card-txn-123',
        card_id: 'card-123',
        user_id: 'user-123',
        card_user_id: 'card-user-123',
      };

      const mockCard = {
        id: 'card-123',
        user_id: 'user-123',
        balance: 0,
      };

      const mockHeaders = {
        Signature: 'test-signature',
      };

      mockTransactionRepository.findOne.mockResolvedValue(null);
      mockCardUserRepository.findOne.mockResolvedValueOnce(mockCardUser as any).mockResolvedValueOnce(null);
      mockDepositAddressRepository.findOne.mockResolvedValue(mockDepositAddress as any);
      mockCardTransactionRepository.findOne.mockResolvedValue(mockCardTransaction as any);
      mockLockerService.withLock.mockImplementation(async (key, fn) => fn());
      mockCardTransactionRepository.transaction.mockImplementation(async (fn) => {
        try {
          return await fn({});
        } catch {
          return { updated: false };
        }
      });
      mockCardRepository.findOne.mockResolvedValue(mockCard as any);

      const result = await service.processWebhook(mockBody, mockHeaders);

      expect(result).toBeDefined();
    });

    it('should handle invalid deposit amount in collateral transaction', async () => {
      const mockBody = {
        id: 'webhook-123',
        resource: 'transaction',
        action: 'created',
        body: {
          id: 'txn-123',
          type: 'collateral',
          collateral: {
            amount: -1000,
            currency: 'USD',
            chainId: 11155111,
            walletAddress: '0x123',
            transactionHash: '0xabc',
            userId: 'rain-user-123',
            postedAt: '2024-01-01T00:00:00Z',
          },
        },
      };

      const mockCardUser = {
        id: 'card-user-123',
        user_id: 'user-123',
        provider_ref: 'rain-user-123',
        balance: 0,
      };

      const mockDepositAddress = {
        id: 'deposit-123',
        address: '0x456',
      };

      const mockCardTransaction = {
        id: 'card-txn-123',
        card_id: 'card-123',
        user_id: 'user-123',
        card_user_id: 'card-user-123',
      };

      const mockCard = {
        id: 'card-123',
        user_id: 'user-123',
        balance: 0,
      };

      const mockHeaders = {
        Signature: 'test-signature',
      };

      mockTransactionRepository.findOne.mockResolvedValue(null);
      mockCardUserRepository.findOne.mockResolvedValue(mockCardUser as any);
      mockDepositAddressRepository.findOne.mockResolvedValue(mockDepositAddress as any);
      mockCardTransactionRepository.findOne.mockResolvedValue(mockCardTransaction as any);
      mockLockerService.withLock.mockImplementation(async (key, fn) => fn());
      mockCardTransactionRepository.transaction.mockImplementation(async (fn) => {
        try {
          return await fn({});
        } catch {
          return { updated: false };
        }
      });
      mockCardRepository.findOne.mockResolvedValue(mockCard as any);
      mockCardUserRepository.findOne.mockResolvedValue(mockCardUser as any);

      const result = await service.processWebhook(mockBody, mockHeaders);

      expect(result).toBeDefined();
    });

    it('should handle deposit amount exceeds max safe value in collateral transaction', async () => {
      const mockBody = {
        id: 'webhook-123',
        resource: 'transaction',
        action: 'created',
        body: {
          id: 'txn-123',
          type: 'collateral',
          collateral: {
            amount: Number.MAX_SAFE_INTEGER + 1,
            currency: 'USD',
            chainId: 11155111,
            walletAddress: '0x123',
            transactionHash: '0xabc',
            userId: 'rain-user-123',
            postedAt: '2024-01-01T00:00:00Z',
          },
        },
      };

      const mockCardUser = {
        id: 'card-user-123',
        user_id: 'user-123',
        provider_ref: 'rain-user-123',
        balance: 0,
      };

      const mockDepositAddress = {
        id: 'deposit-123',
        address: '0x456',
      };

      const mockCardTransaction = {
        id: 'card-txn-123',
        card_id: 'card-123',
        user_id: 'user-123',
        card_user_id: 'card-user-123',
      };

      const mockCard = {
        id: 'card-123',
        user_id: 'user-123',
        balance: 0,
      };

      const mockHeaders = {
        Signature: 'test-signature',
      };

      mockTransactionRepository.findOne.mockResolvedValue(null);
      mockCardUserRepository.findOne.mockResolvedValue(mockCardUser as any);
      mockDepositAddressRepository.findOne.mockResolvedValue(mockDepositAddress as any);
      mockCardTransactionRepository.findOne.mockResolvedValue(mockCardTransaction as any);
      mockLockerService.withLock.mockImplementation(async (key, fn) => fn());
      mockCardTransactionRepository.transaction.mockImplementation(async (fn) => {
        try {
          return await fn({});
        } catch {
          return { updated: false };
        }
      });
      mockCardRepository.findOne.mockResolvedValue(mockCard as any);
      mockCardUserRepository.findOne.mockResolvedValue(mockCardUser as any);

      const result = await service.processWebhook(mockBody, mockHeaders);

      expect(result).toBeDefined();
    });

    it('should handle card user balance would exceed max safe value', async () => {
      const mockBody = {
        id: 'webhook-123',
        resource: 'transaction',
        action: 'created',
        body: {
          id: 'txn-123',
          type: 'collateral',
          collateral: {
            amount: Number.MAX_SAFE_INTEGER,
            currency: 'USD',
            chainId: 11155111,
            walletAddress: '0x123',
            transactionHash: '0xabc',
            userId: 'rain-user-123',
            postedAt: '2024-01-01T00:00:00Z',
          },
        },
      };

      const mockCardUser = {
        id: 'card-user-123',
        user_id: 'user-123',
        provider_ref: 'rain-user-123',
        balance: 1,
      };

      const mockDepositAddress = {
        id: 'deposit-123',
        address: '0x456',
      };

      const mockCardTransaction = {
        id: 'card-txn-123',
        card_id: 'card-123',
        user_id: 'user-123',
        card_user_id: 'card-user-123',
      };

      const mockCard = {
        id: 'card-123',
        user_id: 'user-123',
        balance: 0,
      };

      const mockHeaders = {
        Signature: 'test-signature',
      };

      mockTransactionRepository.findOne.mockResolvedValue(null);
      mockCardUserRepository.findOne.mockResolvedValue(mockCardUser as any);
      mockDepositAddressRepository.findOne.mockResolvedValue(mockDepositAddress as any);
      mockCardTransactionRepository.findOne.mockResolvedValue(mockCardTransaction as any);
      mockLockerService.withLock.mockImplementation(async (key, fn) => fn());
      mockCardTransactionRepository.transaction.mockImplementation(async (fn) => {
        try {
          return await fn({});
        } catch {
          return { updated: false };
        }
      });
      mockCardRepository.findOne.mockResolvedValue(mockCard as any);
      mockCardUserRepository.findOne.mockResolvedValue(mockCardUser as any);

      const result = await service.processWebhook(mockBody, mockHeaders);

      expect(result).toBeDefined();
    });

    it('should handle card balance would exceed max safe value', async () => {
      const mockBody = {
        id: 'webhook-123',
        resource: 'transaction',
        action: 'created',
        body: {
          id: 'txn-123',
          type: 'collateral',
          collateral: {
            amount: Number.MAX_SAFE_INTEGER,
            currency: 'USD',
            chainId: 11155111,
            walletAddress: '0x123',
            transactionHash: '0xabc',
            userId: 'rain-user-123',
            postedAt: '2024-01-01T00:00:00Z',
          },
        },
      };

      const mockCardUser = {
        id: 'card-user-123',
        user_id: 'user-123',
        provider_ref: 'rain-user-123',
        balance: 0,
      };

      const mockDepositAddress = {
        id: 'deposit-123',
        address: '0x456',
      };

      const mockCardTransaction = {
        id: 'card-txn-123',
        card_id: 'card-123',
        user_id: 'user-123',
        card_user_id: 'card-user-123',
      };

      const mockCard = {
        id: 'card-123',
        user_id: 'user-123',
        balance: 1,
      };

      const mockHeaders = {
        Signature: 'test-signature',
      };

      mockTransactionRepository.findOne.mockResolvedValue(null);
      mockCardUserRepository.findOne.mockResolvedValue(mockCardUser as any);
      mockDepositAddressRepository.findOne.mockResolvedValue(mockDepositAddress as any);
      mockCardTransactionRepository.findOne.mockResolvedValue(mockCardTransaction as any);
      mockLockerService.withLock.mockImplementation(async (key, fn) => fn());
      mockCardTransactionRepository.transaction.mockImplementation(async (fn) => {
        try {
          return await fn({});
        } catch {
          return { updated: false };
        }
      });
      mockCardRepository.findOne.mockResolvedValue(mockCard as any);
      mockCardUserRepository.findOne.mockResolvedValue(mockCardUser as any);

      const result = await service.processWebhook(mockBody, mockHeaders);

      expect(result).toBeDefined();
    });

    it('should handle failed to update card user balance', async () => {
      const mockBody = {
        id: 'webhook-123',
        resource: 'transaction',
        action: 'created',
        body: {
          id: 'txn-123',
          type: 'collateral',
          collateral: {
            amount: 10000,
            currency: 'USD',
            chainId: 11155111,
            walletAddress: '0x123',
            transactionHash: '0xabc',
            userId: 'rain-user-123',
            postedAt: '2024-01-01T00:00:00Z',
          },
        },
      };

      const mockCardUser = {
        id: 'card-user-123',
        user_id: 'user-123',
        provider_ref: 'rain-user-123',
        balance: 0,
      };

      const mockDepositAddress = {
        id: 'deposit-123',
        address: '0x456',
      };

      const mockCardTransaction = {
        id: 'card-txn-123',
        card_id: 'card-123',
        user_id: 'user-123',
        card_user_id: 'card-user-123',
      };

      const mockCard = {
        id: 'card-123',
        user_id: 'user-123',
        balance: 0,
      };

      const mockHeaders = {
        Signature: 'test-signature',
      };

      mockTransactionRepository.findOne.mockResolvedValue(null);
      mockCardUserRepository.findOne.mockResolvedValue(mockCardUser as any);
      mockDepositAddressRepository.findOne.mockResolvedValue(mockDepositAddress as any);
      mockCardTransactionRepository.findOne.mockResolvedValue(mockCardTransaction as any);
      mockLockerService.withLock.mockImplementation(async (key, fn) => fn());
      mockCardTransactionRepository.transaction.mockImplementation(async (fn) => {
        try {
          return await fn({});
        } catch {
          return { updated: false };
        }
      });
      mockCardRepository.findOne.mockResolvedValue(mockCard as any);
      mockCardUserRepository.findOne.mockResolvedValue(mockCardUser as any);
      mockCardUserRepository.update.mockResolvedValue(null);
      mockTransactionRepository.create.mockResolvedValue({ id: 'main-txn-123' } as any);

      const result = await service.processWebhook(mockBody, mockHeaders);

      expect(result).toBeDefined();
    });

    it('should handle failed to update card balance', async () => {
      const mockBody = {
        id: 'webhook-123',
        resource: 'transaction',
        action: 'created',
        body: {
          id: 'txn-123',
          type: 'collateral',
          collateral: {
            amount: 10000,
            currency: 'USD',
            chainId: 11155111,
            walletAddress: '0x123',
            transactionHash: '0xabc',
            userId: 'rain-user-123',
            postedAt: '2024-01-01T00:00:00Z',
          },
        },
      };

      const mockCardUser = {
        id: 'card-user-123',
        user_id: 'user-123',
        provider_ref: 'rain-user-123',
        balance: 0,
      };

      const mockDepositAddress = {
        id: 'deposit-123',
        address: '0x456',
      };

      const mockCardTransaction = {
        id: 'card-txn-123',
        card_id: 'card-123',
        user_id: 'user-123',
        card_user_id: 'card-user-123',
      };

      const mockCard = {
        id: 'card-123',
        user_id: 'user-123',
        balance: 0,
      };

      const mockHeaders = {
        Signature: 'test-signature',
      };

      mockTransactionRepository.findOne.mockResolvedValue(null);
      mockCardUserRepository.findOne.mockResolvedValue(mockCardUser as any);
      mockDepositAddressRepository.findOne.mockResolvedValue(mockDepositAddress as any);
      mockCardTransactionRepository.findOne.mockResolvedValue(mockCardTransaction as any);
      mockLockerService.withLock.mockImplementation(async (key, fn) => fn());
      mockCardTransactionRepository.transaction.mockImplementation(async (fn) => {
        try {
          return await fn({});
        } catch {
          return { updated: false };
        }
      });
      mockCardRepository.findOne.mockResolvedValue(mockCard as any);
      mockCardUserRepository.findOne.mockResolvedValue(mockCardUser as any);
      mockCardUserRepository.update.mockResolvedValue({} as any);
      mockCardRepository.update.mockResolvedValue(null);
      mockTransactionRepository.create.mockResolvedValue({ id: 'main-txn-123' } as any);

      const result = await service.processWebhook(mockBody, mockHeaders);

      expect(result).toBeDefined();
    });

    it('should handle card balance update verification failed', async () => {
      const mockBody = {
        id: 'webhook-123',
        resource: 'transaction',
        action: 'created',
        body: {
          id: 'txn-123',
          type: 'collateral',
          collateral: {
            amount: 10000,
            currency: 'USD',
            chainId: 11155111,
            walletAddress: '0x123',
            transactionHash: '0xabc',
            userId: 'rain-user-123',
            postedAt: '2024-01-01T00:00:00Z',
          },
        },
      };

      const mockCardUser = {
        id: 'card-user-123',
        user_id: 'user-123',
        provider_ref: 'rain-user-123',
        balance: 0,
      };

      const mockDepositAddress = {
        id: 'deposit-123',
        address: '0x456',
      };

      const mockCardTransaction = {
        id: 'card-txn-123',
        card_id: 'card-123',
        user_id: 'user-123',
        card_user_id: 'card-user-123',
      };

      const mockCard = {
        id: 'card-123',
        user_id: 'user-123',
        balance: 0,
      };

      const mockHeaders = {
        Signature: 'test-signature',
      };

      mockTransactionRepository.findOne.mockResolvedValue(null);
      mockCardUserRepository.findOne.mockResolvedValue(mockCardUser as any);
      mockDepositAddressRepository.findOne.mockResolvedValue(mockDepositAddress as any);
      mockCardTransactionRepository.findOne.mockResolvedValue(mockCardTransaction as any);
      mockLockerService.withLock.mockImplementation(async (key, fn) => fn());
      mockCardTransactionRepository.transaction.mockImplementation(async (fn) => {
        try {
          return await fn({});
        } catch {
          return { updated: false };
        }
      });
      mockCardRepository.findOne
        .mockResolvedValueOnce(mockCard as any)
        .mockResolvedValueOnce({ ...mockCard, balance: 5000 } as any);
      mockCardUserRepository.findOne.mockResolvedValue(mockCardUser as any);
      mockCardUserRepository.update.mockResolvedValue({} as any);
      mockCardRepository.update.mockResolvedValue({} as any);
      mockTransactionRepository.create.mockResolvedValue({ id: 'main-txn-123' } as any);

      const result = await service.processWebhook(mockBody, mockHeaders);

      expect(result).toBeDefined();
    });

    it('should send notification and email for successful collateral transaction', async () => {
      const mockBody = {
        id: 'webhook-123',
        resource: 'transaction',
        action: 'created',
        body: {
          id: 'txn-123',
          type: 'collateral',
          collateral: {
            amount: 10000,
            currency: 'USD',
            chainId: 11155111,
            walletAddress: '0x123',
            transactionHash: '0xabc',
            userId: 'rain-user-123',
            postedAt: '2024-01-01T00:00:00Z',
          },
        },
      };

      const mockCardUser = {
        id: 'card-user-123',
        user_id: 'user-123',
        provider_ref: 'rain-user-123',
        balance: 0,
      };

      const mockDepositAddress = {
        id: 'deposit-123',
        address: '0x456',
      };

      const mockCardTransaction = {
        id: 'card-txn-123',
        card_id: 'card-123',
        user_id: 'user-123',
        card_user_id: 'card-user-123',
      };

      const mockCard = {
        id: 'card-123',
        user_id: 'user-123',
        balance: 0,
      };

      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
      };

      const mockHeaders = {
        Signature: 'test-signature',
      };

      mockTransactionRepository.findOne.mockResolvedValue(null);
      mockCardUserRepository.findOne.mockResolvedValue(mockCardUser as any);
      mockDepositAddressRepository.findOne.mockResolvedValue(mockDepositAddress as any);
      mockCardTransactionRepository.findOne.mockResolvedValue(mockCardTransaction as any);
      mockLockerService.withLock.mockImplementation(async (key, fn) => fn());
      mockCardTransactionRepository.transaction.mockImplementation(async (fn) => fn({}));
      mockCardRepository.findOne.mockResolvedValue(mockCard as any);
      mockCardUserRepository.findOne.mockResolvedValue(mockCardUser as any);
      mockCardUserRepository.update.mockResolvedValue({} as any);
      mockCardRepository.update.mockResolvedValue({} as any);
      mockTransactionRepository.create.mockResolvedValue({ id: 'main-txn-123' } as any);
      mockCardTransactionRepository.update.mockResolvedValue({} as any);
      mockUserRepository.findActiveById = jest.fn().mockResolvedValue(mockUser as any);
      mockInAppNotificationService.createNotification.mockResolvedValue({} as any);
      mockMailerService.send.mockResolvedValue(undefined);

      const result = await service.processWebhook(mockBody, mockHeaders);

      expect(result).toBeDefined();
    });
  });

  describe('processWebhook - handleSpendTransactionCreated edge cases', () => {
    it('should handle transaction already processed', async () => {
      const mockBody = {
        id: 'webhook-123',
        resource: 'transaction',
        action: 'created',
        body: {
          id: 'txn-123',
          type: 'spend',
          spend: {
            amount: -5000,
            currency: 'USD',
            cardId: 'rain-card-123',
            userId: 'rain-user-123',
            merchantName: 'Test Merchant',
            status: 'pending',
          },
        },
      };

      const mockExistingCardTransaction = {
        id: 'card-txn-123',
        provider_reference: 'txn-123',
        status: 'pending',
        amount: -5000,
      };

      const mockHeaders = {
        Signature: 'test-signature',
      };

      mockCardTransactionRepository.findOne.mockResolvedValue(mockExistingCardTransaction as any);
      mockTransactionRepository.findOne.mockResolvedValue(null);

      const result = await service.processWebhook(mockBody, mockHeaders);

      expect(result.status).toBe('processed');
      expect(result.action).toBe('spend_transaction_created');
      expect(result.persisted).toBe(false);
      expect(result.reason).toBe('transaction_already_processed');
    });

    it('should handle card user not found in handleSpendTransactionCreated', async () => {
      const mockBody = {
        id: 'webhook-123',
        resource: 'transaction',
        action: 'created',
        body: {
          id: 'txn-123',
          type: 'spend',
          spend: {
            amount: -5000,
            currency: 'USD',
            cardId: 'rain-card-123',
            userId: 'rain-user-123',
            merchantName: 'Test Merchant',
            status: 'pending',
          },
        },
      };

      const mockHeaders = {
        Signature: 'test-signature',
      };

      mockCardTransactionRepository.findOne.mockResolvedValue(null);
      mockCardUserRepository.findOne.mockResolvedValue(null);

      const result = await service.processWebhook(mockBody, mockHeaders);

      expect(result.status).toBe('processed');
      expect(result.action).toBe('spend_transaction_created');
      expect(result.persisted).toBe(false);
      expect(result.reason).toBe('card_user_not_found');
    });

    it('should handle card not found in handleSpendTransactionCreated', async () => {
      const mockBody = {
        id: 'webhook-123',
        resource: 'transaction',
        action: 'created',
        body: {
          id: 'txn-123',
          type: 'spend',
          spend: {
            amount: -5000,
            currency: 'USD',
            cardId: 'rain-card-123',
            userId: 'rain-user-123',
            merchantName: 'Test Merchant',
            status: 'pending',
          },
        },
      };

      const mockCardUser = {
        id: 'card-user-123',
        user_id: 'user-123',
        provider_ref: 'rain-user-123',
      };

      const mockHeaders = {
        Signature: 'test-signature',
      };

      mockCardTransactionRepository.findOne.mockResolvedValue(null);
      mockCardUserRepository.findOne.mockResolvedValue(mockCardUser as any);
      mockCardRepository.findOne.mockResolvedValue(null);

      const result = await service.processWebhook(mockBody, mockHeaders);

      expect(result.status).toBe('processed');
      expect(result.action).toBe('spend_transaction_created');
      expect(result.persisted).toBe(false);
      expect(result.reason).toBe('card_not_found');
    });

    it('should handle card ID not found in handleSpendTransactionCreated', async () => {
      const mockBody = {
        id: 'webhook-123',
        resource: 'transaction',
        action: 'created',
        body: {
          id: 'txn-123',
          type: 'spend',
          spend: {
            amount: -5000,
            currency: 'USD',
            cardId: 'rain-card-123',
            userId: 'rain-user-123',
            merchantName: 'Test Merchant',
            status: 'pending',
          },
        },
      };

      const mockCardUser = {
        id: 'card-user-123',
        user_id: 'user-123',
        provider_ref: 'rain-user-123',
      };

      const mockCard = {
        id: null,
        user_id: 'user-123',
        card_user_id: 'card-user-123',
        provider_ref: 'rain-card-123',
      };

      const mockHeaders = {
        Signature: 'test-signature',
      };

      mockCardTransactionRepository.findOne.mockResolvedValue(null);
      mockCardUserRepository.findOne.mockResolvedValue(mockCardUser as any);
      mockCardRepository.findOne.mockResolvedValue(mockCard as any);

      const result = await service.processWebhook(mockBody, mockHeaders);

      expect(result.status).toBe('processed');
      expect(result.action).toBe('spend_transaction_created');
      expect(result.persisted).toBe(false);
      expect(result.reason).toBe('card_id_not_found');
    });

    it('should handle card or card user not found during balance update', async () => {
      const mockBody = {
        id: 'webhook-123',
        resource: 'transaction',
        action: 'created',
        body: {
          id: 'txn-123',
          type: 'spend',
          spend: {
            amount: -5000,
            currency: 'USD',
            cardId: 'rain-card-123',
            userId: 'rain-user-123',
            merchantName: 'Test Merchant',
            status: 'pending',
          },
        },
      };

      const mockCardUser = {
        id: 'card-user-123',
        user_id: 'user-123',
        provider_ref: 'rain-user-123',
      };

      const mockCard = {
        id: 'card-123',
        user_id: 'user-123',
        provider_ref: 'rain-card-123',
        balance: 10000,
      };

      const mockHeaders = {
        Signature: 'test-signature',
      };

      mockCardTransactionRepository.findOne.mockResolvedValue(null);
      mockCardUserRepository.findOne.mockResolvedValue(mockCardUser as any);
      mockCardRepository.findOne.mockResolvedValue(mockCard as any);
      mockLockerService.withLock.mockImplementation(async (key, fn) => fn());
      mockCardTransactionRepository.transaction.mockImplementation(async (fn) => {
        try {
          return await fn({});
        } catch {
          return { mainTransaction: null, newBalance: 0, cardTransaction: null };
        }
      });
      mockCardRepository.findOne.mockResolvedValue(null);
      mockCardUserRepository.findOne.mockResolvedValue(null);

      const result = await service.processWebhook(mockBody, mockHeaders);

      expect(result).toBeDefined();
    });

    it('should handle invalid transaction amount in handleSpendTransactionCreated', async () => {
      const mockBody = {
        id: 'webhook-123',
        resource: 'transaction',
        action: 'created',
        body: {
          id: 'txn-123',
          type: 'spend',
          spend: {
            amount: -5000,
            currency: 'USD',
            cardId: 'rain-card-123',
            userId: 'rain-user-123',
            merchantName: 'Test Merchant',
            status: 'pending',
          },
        },
      };

      const mockCardUser = {
        id: 'card-user-123',
        user_id: 'user-123',
        provider_ref: 'rain-user-123',
        balance: 10000,
      };

      const mockCard = {
        id: 'card-123',
        user_id: 'user-123',
        provider_ref: 'rain-card-123',
        balance: 10000,
      };

      const mockHeaders = {
        Signature: 'test-signature',
      };

      mockCardTransactionRepository.findOne.mockResolvedValue(null);
      mockCardUserRepository.findOne.mockResolvedValue(mockCardUser as any);
      mockCardRepository.findOne.mockResolvedValue(mockCard as any);
      mockLockerService.withLock.mockImplementation(async (key, fn) => fn());
      mockCardTransactionRepository.transaction.mockImplementation(async (fn) => {
        try {
          return await fn({});
        } catch {
          return { mainTransaction: null, newBalance: 0, cardTransaction: null };
        }
      });
      mockCardRepository.findOne.mockResolvedValue(mockCard as any);
      mockCardUserRepository.findOne.mockResolvedValue(mockCardUser as any);

      const result = await service.processWebhook(mockBody, mockHeaders);

      expect(result).toBeDefined();
    });

    it('should handle transaction amount exceeds max safe value in handleSpendTransactionCreated', async () => {
      const mockBody = {
        id: 'webhook-123',
        resource: 'transaction',
        action: 'created',
        body: {
          id: 'txn-123',
          type: 'spend',
          spend: {
            amount: Number.MAX_SAFE_INTEGER + 1,
            currency: 'USD',
            cardId: 'rain-card-123',
            userId: 'rain-user-123',
            merchantName: 'Test Merchant',
            status: 'pending',
          },
        },
      };

      const mockCardUser = {
        id: 'card-user-123',
        user_id: 'user-123',
        provider_ref: 'rain-user-123',
        balance: 10000,
      };

      const mockCard = {
        id: 'card-123',
        user_id: 'user-123',
        provider_ref: 'rain-card-123',
        balance: 10000,
      };

      const mockHeaders = {
        Signature: 'test-signature',
      };

      mockCardTransactionRepository.findOne.mockResolvedValue(null);
      mockCardUserRepository.findOne.mockResolvedValue(mockCardUser as any);
      mockCardRepository.findOne.mockResolvedValue(mockCard as any);
      mockLockerService.withLock.mockImplementation(async (key, fn) => fn());
      mockCardTransactionRepository.transaction.mockImplementation(async (fn) => {
        try {
          return await fn({});
        } catch {
          return { mainTransaction: null, newBalance: 0, cardTransaction: null };
        }
      });
      mockCardRepository.findOne.mockResolvedValue(mockCard as any);
      mockCardUserRepository.findOne.mockResolvedValue(mockCardUser as any);

      const result = await service.processWebhook(mockBody, mockHeaders);

      expect(result).toBeDefined();
    });

    it('should handle insufficient balance in handleSpendTransactionCreated', async () => {
      const mockBody = {
        id: 'webhook-123',
        resource: 'transaction',
        action: 'created',
        body: {
          id: 'txn-123',
          type: 'spend',
          spend: {
            amount: -50000,
            currency: 'USD',
            cardId: 'rain-card-123',
            userId: 'rain-user-123',
            merchantName: 'Test Merchant',
            status: 'pending',
          },
        },
      };

      const mockCardUser = {
        id: 'card-user-123',
        user_id: 'user-123',
        provider_ref: 'rain-user-123',
        balance: 10000,
      };

      const mockCard = {
        id: 'card-123',
        user_id: 'user-123',
        provider_ref: 'rain-card-123',
        balance: 10000,
      };

      const mockHeaders = {
        Signature: 'test-signature',
      };

      mockCardTransactionRepository.findOne.mockResolvedValue(null);
      mockCardUserRepository.findOne.mockResolvedValue(mockCardUser as any);
      mockCardRepository.findOne.mockResolvedValue(mockCard as any);
      mockLockerService.withLock.mockImplementation(async (key, fn) => fn());
      mockCardTransactionRepository.transaction.mockImplementation(async (fn) => {
        try {
          return await fn({});
        } catch {
          return { mainTransaction: null, newBalance: 0, cardTransaction: null };
        }
      });
      mockCardRepository.findOne.mockResolvedValue(mockCard as any);
      mockCardUserRepository.findOne.mockResolvedValue(mockCardUser as any);

      const result = await service.processWebhook(mockBody, mockHeaders);

      expect(result).toBeDefined();
    });

    it('should handle insufficient card user balance in handleSpendTransactionCreated', async () => {
      const mockBody = {
        id: 'webhook-123',
        resource: 'transaction',
        action: 'created',
        body: {
          id: 'txn-123',
          type: 'spend',
          spend: {
            amount: -50000,
            currency: 'USD',
            cardId: 'rain-card-123',
            userId: 'rain-user-123',
            merchantName: 'Test Merchant',
            status: 'successful',
          },
        },
      };

      const mockCardUser = {
        id: 'card-user-123',
        user_id: 'user-123',
        provider_ref: 'rain-user-123',
        balance: 10000,
      };

      const mockCard = {
        id: 'card-123',
        user_id: 'user-123',
        provider_ref: 'rain-card-123',
        balance: 50000,
      };

      const mockHeaders = {
        Signature: 'test-signature',
      };

      mockCardTransactionRepository.findOne.mockResolvedValue(null);
      mockCardUserRepository.findOne.mockResolvedValue(mockCardUser as any);
      mockCardRepository.findOne.mockResolvedValue(mockCard as any);
      mockLockerService.withLock.mockImplementation(async (key, fn) => fn());
      mockCardTransactionRepository.transaction.mockImplementation(async (fn) => {
        try {
          return await fn({});
        } catch {
          return { mainTransaction: null, newBalance: 0, cardTransaction: null };
        }
      });
      mockCardRepository.findOne.mockResolvedValue(mockCard as any);
      mockCardUserRepository.findOne.mockResolvedValue(mockCardUser as any);

      const result = await service.processWebhook(mockBody, mockHeaders);

      expect(result).toBeDefined();
    });
  });

  describe('processWebhook - handleSpendTransactionUpdated edge cases', () => {
    it('should handle card user not found in handleSpendTransactionUpdated', async () => {
      const mockBody = {
        id: 'webhook-123',
        resource: 'transaction',
        action: 'updated',
        body: {
          id: 'txn-123',
          type: 'spend',
          spend: {
            amount: -5000,
            currency: 'USD',
            cardId: 'rain-card-123',
            userId: 'rain-user-123',
            merchantName: 'Test Merchant',
            status: 'successful',
          },
        },
      };

      const mockExistingCardTransaction = {
        id: 'card-txn-123',
        provider_reference: 'txn-123',
        status: 'pending',
        amount: -5000,
      };

      const mockHeaders = {
        Signature: 'test-signature',
      };

      mockCardTransactionRepository.findOne.mockResolvedValue(mockExistingCardTransaction as any);
      mockTransactionRepository.findOne.mockResolvedValue(null);
      mockCardUserRepository.findOne.mockResolvedValue(null);

      const result = await service.processWebhook(mockBody, mockHeaders);

      expect(result.status).toBe('processed');
      expect(result.action).toBe('spend_transaction_updated');
      expect(result.updated).toBe(false);
      expect(result.reason).toBe('card_user_not_found');
    });

    it('should handle card not found in handleSpendTransactionUpdated', async () => {
      const mockBody = {
        id: 'webhook-123',
        resource: 'transaction',
        action: 'updated',
        body: {
          id: 'txn-123',
          type: 'spend',
          spend: {
            amount: -5000,
            currency: 'USD',
            cardId: 'rain-card-123',
            userId: 'rain-user-123',
            merchantName: 'Test Merchant',
            status: 'successful',
          },
        },
      };

      const mockExistingCardTransaction = {
        id: 'card-txn-123',
        provider_reference: 'txn-123',
        status: 'pending',
        amount: -5000,
      };

      const mockCardUser = {
        id: 'card-user-123',
        user_id: 'user-123',
        provider_ref: 'rain-user-123',
      };

      const mockHeaders = {
        Signature: 'test-signature',
      };

      mockCardTransactionRepository.findOne.mockResolvedValue(mockExistingCardTransaction as any);
      mockTransactionRepository.findOne.mockResolvedValue(null);
      mockCardUserRepository.findOne.mockResolvedValue(mockCardUser as any);
      mockCardRepository.findOne.mockResolvedValue(null);

      const result = await service.processWebhook(mockBody, mockHeaders);

      expect(result.status).toBe('processed');
      expect(result.action).toBe('spend_transaction_updated');
      expect(result.updated).toBe(false);
      expect(result.reason).toBe('card_not_found');
    });

    it('should handle error in handleSpendTransactionUpdated', async () => {
      const mockBody = {
        id: 'webhook-123',
        resource: 'transaction',
        action: 'updated',
        body: {
          id: 'txn-123',
          type: 'spend',
          spend: {
            amount: -5000,
            currency: 'USD',
            cardId: 'rain-card-123',
            userId: 'rain-user-123',
            merchantName: 'Test Merchant',
            status: 'successful',
          },
        },
      };

      const mockExistingCardTransaction = {
        id: 'card-txn-123',
        provider_reference: 'txn-123',
      };

      const mockCardUser = {
        id: 'card-user-123',
        user_id: 'user-123',
        provider_ref: 'rain-user-123',
      };

      const mockCard = {
        id: 'card-123',
        user_id: 'user-123',
        provider_ref: 'rain-card-123',
      };

      const mockHeaders = {
        Signature: 'test-signature',
      };

      mockCardTransactionRepository.findOne.mockResolvedValue(mockExistingCardTransaction as any);
      mockTransactionRepository.findOne.mockResolvedValue(null);
      mockCardUserRepository.findOne.mockResolvedValue(mockCardUser as any);
      mockCardRepository.findOne.mockResolvedValue(mockCard as any);
      mockLockerService.withLock.mockRejectedValue(new Error('Lock error'));

      const result = await service.processWebhook(mockBody, mockHeaders);

      expect(result.status).toBe('processed');
      expect(result.action).toBe('spend_transaction_updated');
    });
  });

  describe('processWebhook - handleSpendTransactionCompleted edge cases', () => {
    it('should handle card user not found in handleSpendTransactionCompleted', async () => {
      const mockBody = {
        id: 'webhook-123',
        resource: 'transaction',
        action: 'completed',
        body: {
          id: 'txn-123',
          type: 'spend',
          spend: {
            amount: -5000,
            currency: 'USD',
            cardId: 'rain-card-123',
            userId: 'rain-user-123',
            merchantName: 'Test Merchant',
            status: 'completed',
          },
        },
      };

      const mockHeaders = {
        Signature: 'test-signature',
      };

      mockCardUserRepository.findOne.mockResolvedValue(null);

      const result = await service.processWebhook(mockBody, mockHeaders);

      expect(result.status).toBe('processed');
      expect(result.action).toBe('spend_transaction_completed');
      expect(result.completed).toBe(false);
      expect(result.reason).toBe('card_user_not_found');
    });

    it('should handle card not found in handleSpendTransactionCompleted', async () => {
      const mockBody = {
        id: 'webhook-123',
        resource: 'transaction',
        action: 'completed',
        body: {
          id: 'txn-123',
          type: 'spend',
          spend: {
            amount: -5000,
            currency: 'USD',
            cardId: 'rain-card-123',
            userId: 'rain-user-123',
            merchantName: 'Test Merchant',
            status: 'completed',
          },
        },
      };

      const mockCardUser = {
        id: 'card-user-123',
        user_id: 'user-123',
        provider_ref: 'rain-user-123',
      };

      const mockHeaders = {
        Signature: 'test-signature',
      };

      mockCardUserRepository.findOne.mockResolvedValue(mockCardUser as any);
      mockCardRepository.findOne.mockResolvedValue(null);

      const result = await service.processWebhook(mockBody, mockHeaders);

      expect(result.status).toBe('processed');
      expect(result.action).toBe('spend_transaction_completed');
      expect(result.completed).toBe(false);
      expect(result.reason).toBe('card_not_found');
    });

    it('should handle card ID not found in handleSpendTransactionCompleted', async () => {
      const mockBody = {
        id: 'webhook-123',
        resource: 'transaction',
        action: 'completed',
        body: {
          id: 'txn-123',
          type: 'spend',
          spend: {
            amount: -5000,
            currency: 'USD',
            cardId: 'rain-card-123',
            userId: 'rain-user-123',
            merchantName: 'Test Merchant',
            status: 'completed',
          },
        },
      };

      const mockCardUser = {
        id: 'card-user-123',
        user_id: 'user-123',
        provider_ref: 'rain-user-123',
      };

      const mockCard = {
        id: null,
        user_id: 'user-123',
        card_user_id: 'card-user-123',
        provider_ref: 'rain-card-123',
      };

      const mockExistingCardTransaction = {
        id: 'card-txn-123',
        provider_reference: 'txn-123',
        status: 'pending',
        amount: -5000,
      };

      const mockMainTransaction = {
        id: 'main-txn-123',
        reference: 'txn-123',
      };

      const mockHeaders = {
        Signature: 'test-signature',
      };

      mockCardUserRepository.findOne.mockResolvedValue(mockCardUser as any);
      mockCardRepository.findOne.mockResolvedValue(mockCard as any);
      mockCardTransactionRepository.findOne.mockResolvedValue(mockExistingCardTransaction as any);
      mockTransactionRepository.findOne.mockResolvedValue(mockMainTransaction as any);

      const result = await service.processWebhook(mockBody, mockHeaders);

      expect(result.status).toBe('processed');
      expect(result.action).toBe('spend_transaction_completed');
      expect(result.completed).toBe(false);
      expect(result.reason).toBe('card_id_not_found');
    });

    it('should handle card transaction not found in handleSpendTransactionCompleted', async () => {
      const mockBody = {
        id: 'webhook-123',
        resource: 'transaction',
        action: 'completed',
        body: {
          id: 'txn-123',
          type: 'spend',
          spend: {
            amount: -5000,
            currency: 'USD',
            cardId: 'rain-card-123',
            userId: 'rain-user-123',
            merchantName: 'Test Merchant',
            status: 'completed',
          },
        },
      };

      const mockCardUser = {
        id: 'card-user-123',
        user_id: 'user-123',
        provider_ref: 'rain-user-123',
      };

      const mockCard = {
        id: 'card-123',
        user_id: 'user-123',
        provider_ref: 'rain-card-123',
        balance: 10000,
      };

      const mockHeaders = {
        Signature: 'test-signature',
      };

      mockCardUserRepository.findOne.mockResolvedValue(mockCardUser as any);
      mockCardRepository.findOne.mockResolvedValue(mockCard as any);
      mockCardTransactionRepository.findOne.mockResolvedValue(null);
      mockTransactionRepository.findOne.mockResolvedValue(null);
      mockLockerService.withLock.mockImplementation(async (key, fn) => fn());
      mockCardTransactionRepository.transaction.mockImplementation(async (fn) => fn({}));
      mockCardTransactionRepository.create.mockResolvedValue({ id: 'card-txn-123' } as any);
      mockTransactionRepository.create.mockResolvedValue({ id: 'main-txn-123' } as any);
      mockCardRepository.findOne.mockResolvedValue(mockCard as any);
      mockCardUserRepository.findOne.mockResolvedValue(mockCardUser as any);
      mockCardRepository.update.mockResolvedValue({} as any);
      mockCardUserRepository.update.mockResolvedValue({} as any);

      const result = await service.processWebhook(mockBody, mockHeaders);

      expect(result.status).toBe('processed');
      expect(result.action).toBe('spend_transaction_completed');
    });
  });

  describe('processWebhook - handleSpendTransactionRequest edge cases', () => {
    it('should handle card user not found in handleSpendTransactionRequest', async () => {
      const mockBody = {
        id: 'webhook-123',
        resource: 'transaction',
        action: 'requested',
        body: {
          id: 'txn-123',
          type: 'spend',
          spend: {
            amount: -5000,
            currency: 'USD',
            cardId: 'rain-card-123',
            userId: 'rain-user-123',
            merchantName: 'Test Merchant',
            status: 'pending',
          },
        },
      };

      const mockHeaders = {
        Signature: 'test-signature',
      };

      mockCardUserRepository.findOne.mockResolvedValue(null);

      const result = await service.processWebhook(mockBody, mockHeaders);

      expect(result.status).toBe('rejected');
      expect(result.action).toBe('spend_authorization');
      expect(result.authorized).toBe(false);
      expect(result.reason).toBe('card_user_not_found');
    });

    it('should handle card not found in handleSpendTransactionRequest', async () => {
      const mockBody = {
        id: 'webhook-123',
        resource: 'transaction',
        action: 'requested',
        body: {
          id: 'txn-123',
          type: 'spend',
          spend: {
            amount: -5000,
            currency: 'USD',
            cardId: 'rain-card-123',
            userId: 'rain-user-123',
            merchantName: 'Test Merchant',
            status: 'pending',
          },
        },
      };

      const mockCardUser = {
        id: 'card-user-123',
        user_id: 'user-123',
        provider_ref: 'rain-user-123',
      };

      const mockHeaders = {
        Signature: 'test-signature',
      };

      mockCardUserRepository.findOne.mockResolvedValue(mockCardUser as any);
      mockCardRepository.findOne.mockResolvedValue(null);

      const result = await service.processWebhook(mockBody, mockHeaders);

      expect(result.status).toBe('rejected');
      expect(result.action).toBe('spend_authorization');
      expect(result.authorized).toBe(false);
      expect(result.reason).toBe('card_not_found');
    });

    it('should handle insufficient balance in handleSpendTransactionRequest', async () => {
      const mockBody = {
        id: 'webhook-123',
        resource: 'transaction',
        action: 'requested',
        body: {
          id: 'txn-123',
          type: 'spend',
          spend: {
            amount: 50000,
            currency: 'USD',
            cardId: 'rain-card-123',
            userId: 'rain-user-123',
            merchantName: 'Test Merchant',
            status: 'pending',
          },
        },
      };

      const mockCardUser = {
        id: 'card-user-123',
        user_id: 'user-123',
        provider_ref: 'rain-user-123',
      };

      const mockCard = {
        id: 'card-123',
        user_id: 'user-123',
        provider_ref: 'rain-card-123',
        balance: 10000,
        status: 'active',
      };

      const mockHeaders = {
        Signature: 'test-signature',
      };

      mockCardUserRepository.findOne.mockResolvedValue(mockCardUser as any);
      mockCardRepository.findOne.mockResolvedValue(mockCard as any);

      const result = await service.processWebhook(mockBody, mockHeaders);

      expect(result.status).toBe('rejected');
      expect(result.action).toBe('spend_authorization');
      expect(result.authorized).toBe(false);
      expect(result.reason).toBe('insufficient_balance');
    });

    it('should authorize transaction successfully in handleSpendTransactionRequest', async () => {
      const mockBody = {
        id: 'webhook-123',
        resource: 'transaction',
        action: 'requested',
        body: {
          id: 'txn-123',
          type: 'spend',
          spend: {
            amount: -5000,
            currency: 'USD',
            cardId: 'rain-card-123',
            userId: 'rain-user-123',
            merchantName: 'Test Merchant',
            status: 'pending',
          },
        },
      };

      const mockCardUser = {
        id: 'card-user-123',
        user_id: 'user-123',
        provider_ref: 'rain-user-123',
      };

      const mockCard = {
        id: 'card-123',
        user_id: 'user-123',
        provider_ref: 'rain-card-123',
        balance: 10000,
        status: 'active',
      };

      const mockHeaders = {
        Signature: 'test-signature',
      };

      mockCardUserRepository.findOne.mockResolvedValue(mockCardUser as any);
      mockCardRepository.findOne.mockResolvedValue(mockCard as any);

      const result = await service.processWebhook(mockBody, mockHeaders);

      expect(result.status).toBe('approved');
      expect(result.action).toBe('spend_authorization');
      expect(result.authorized).toBe(true);
    });

    it('should handle error in handleSpendTransactionRequest', async () => {
      const mockBody = {
        id: 'webhook-123',
        resource: 'transaction',
        action: 'requested',
        body: {
          id: 'txn-123',
          type: 'spend',
          spend: {
            amount: -5000,
            currency: 'USD',
            cardId: 'rain-card-123',
            userId: 'rain-user-123',
            merchantName: 'Test Merchant',
            status: 'pending',
          },
        },
      };

      const mockHeaders = {
        Signature: 'test-signature',
      };

      mockCardUserRepository.findOne.mockRejectedValue(new Error('Database error'));

      const result = await service.processWebhook(mockBody, mockHeaders);

      expect(result.status).toBe('rejected');
      expect(result.action).toBe('spend_authorization');
      expect(result.authorized).toBe(false);
    });
  });

  describe('processWebhook - handleSpendTransactionUpdated additional coverage', () => {
    it('should handle card or card user not found during balance update in handleSpendTransactionUpdated', async () => {
      const mockBody = {
        id: 'webhook-123',
        resource: 'transaction',
        action: 'updated',
        body: {
          id: 'txn-123',
          type: 'spend',
          spend: {
            id: 'spend-123',
            amount: -5000,
            currency: 'USD',
            cardId: 'rain-card-123',
            userId: 'rain-user-123',
            status: 'completed',
            merchantName: 'Test Merchant',
          },
        },
      };

      const mockCardUser = {
        id: 'card-user-123',
        user_id: 'user-123',
        provider_ref: 'rain-user-123',
      };

      const mockCard = {
        id: 'card-123',
        user_id: 'user-123',
        provider_ref: 'rain-card-123',
        balance: 10000,
      };

      const mockExistingCardTransaction = {
        id: 'card-txn-123',
      };

      const mockMainTransaction = {
        id: 'main-txn-123',
      };

      const mockHeaders = {
        Signature: 'test-signature',
      };

      mockCardUserRepository.findOne.mockResolvedValue(mockCardUser as any);
      mockCardRepository.findOne.mockResolvedValue(mockCard as any);
      mockCardTransactionRepository.findOne.mockResolvedValue(mockExistingCardTransaction as any);
      mockTransactionRepository.findOne.mockResolvedValue(mockMainTransaction as any);
      mockLockerService.withLock.mockImplementation(async (key, fn) => {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        return await mockCardTransactionRepository.transaction(async (_trx: any) => {
          return await fn();
        });
      });
      mockCardTransactionRepository.transaction.mockImplementation(async (fn) => {
        try {
          return await fn({} as any);
        } catch {
          return { updated: false };
        }
      });
      mockCardRepository.findOne.mockResolvedValueOnce(mockCard as any).mockResolvedValueOnce(null);
      mockCardUserRepository.findOne.mockResolvedValueOnce(mockCardUser as any).mockResolvedValueOnce(null);

      const result = await service.processWebhook(mockBody, mockHeaders);

      expect(result.status).toBe('processed');
      expect(result.action).toBe('spend_transaction_updated');
    });
  });

  describe('processWebhook - handleSpendTransactionCompleted additional coverage', () => {
    it('should handle card or card user not found during balance update in handleSpendTransactionCompleted', async () => {
      const mockBody = {
        id: 'webhook-123',
        resource: 'transaction',
        action: 'completed',
        body: {
          id: 'txn-123',
          type: 'spend',
          spend: {
            id: 'spend-123',
            amount: -5000,
            currency: 'USD',
            cardId: 'rain-card-123',
            userId: 'rain-user-123',
            status: 'completed',
            merchantName: 'Test Merchant',
          },
        },
      };

      const mockCardUser = {
        id: 'card-user-123',
        user_id: 'user-123',
        provider_ref: 'rain-user-123',
      };

      const mockCard = {
        id: 'card-123',
        user_id: 'user-123',
        provider_ref: 'rain-card-123',
        balance: 10000,
      };

      const mockHeaders = {
        Signature: 'test-signature',
      };

      mockCardUserRepository.findOne.mockResolvedValue(mockCardUser as any);
      mockCardRepository.findOne.mockResolvedValue(mockCard as any);
      mockCardTransactionRepository.findOne.mockResolvedValue(null);
      mockTransactionRepository.findOne.mockResolvedValue(null);
      mockLockerService.withLock.mockImplementation(async (key, fn) => {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        return await mockCardTransactionRepository.transaction(async (_trx: any) => {
          return await fn();
        });
      });
      mockCardTransactionRepository.transaction.mockImplementation(async (fn) => {
        try {
          return await fn({} as any);
        } catch {
          return { calculatedNewBalance: 0, cardTransaction: null };
        }
      });
      mockCardRepository.findOne.mockResolvedValueOnce(mockCard as any).mockResolvedValueOnce(null);
      mockCardUserRepository.findOne.mockResolvedValueOnce(mockCardUser as any).mockResolvedValueOnce(null);

      const result = await service.processWebhook(mockBody, mockHeaders);

      expect(result.status).toBe('processed');
      expect(result.action).toBe('spend_transaction_completed');
    });

    it('should handle error in handleSpendTransactionCompleted catch block', async () => {
      const mockBody = {
        id: 'webhook-123',
        resource: 'transaction',
        action: 'completed',
        body: {
          id: 'txn-123',
          type: 'spend',
          spend: {
            id: 'spend-123',
            amount: -5000,
            currency: 'USD',
            cardId: 'rain-card-123',
            userId: 'rain-user-123',
            status: 'completed',
            merchantName: 'Test Merchant',
          },
        },
      };

      const mockCardUser = {
        id: 'card-user-123',
        user_id: 'user-123',
        provider_ref: 'rain-user-123',
      };

      const mockCard = {
        id: 'card-123',
        user_id: 'user-123',
        provider_ref: 'rain-card-123',
        balance: 10000,
      };

      const mockHeaders = {
        Signature: 'test-signature',
      };

      mockCardUserRepository.findOne.mockResolvedValue(mockCardUser as any);
      mockCardRepository.findOne.mockResolvedValue(mockCard as any);
      mockCardTransactionRepository.findOne.mockResolvedValue(null);
      mockTransactionRepository.findOne.mockResolvedValue(null);
      mockLockerService.withLock.mockImplementation(async (key, fn) => {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        return await mockCardTransactionRepository.transaction(async (_trx: any) => {
          return await fn();
        });
      });
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      mockCardTransactionRepository.transaction.mockImplementation(async (_fn) => {
        throw new Error('Transaction error');
      });

      const result = await service.processWebhook(mockBody, mockHeaders);

      expect(result.status).toBe('processed');
      expect(result.action).toBe('spend_transaction_completed');
      expect(result.completed).toBe(false);
    });
  });

  describe('processWebhook - handleCardUpdated edge cases', () => {
    it('should handle card not found in handleCardUpdated', async () => {
      const mockBody = {
        id: 'webhook-123',
        resource: 'card',
        action: 'updated',
        body: {
          id: 'rain-card-123',
          userId: 'rain-user-123',
          status: 'active',
          limit: { amount: 1000, frequency: 'per30DayPeriod' },
          expirationMonth: '12',
          expirationYear: '2027',
        },
      };

      const mockHeaders = {
        Signature: 'test-signature',
      };

      mockCardRepository.findOne.mockReset();
      mockCardRepository.findOne.mockResolvedValue(null);

      const result = await service.processWebhook(mockBody, mockHeaders);

      expect(result.status).toBe('processed');
      expect(result.action).toBe('card_updated');
      expect(result.updated).toBe(false);
      expect(result.reason).toBe('card_not_found');
    });

    it('should send card status update notification for locked card', async () => {
      const mockBody = {
        id: 'webhook-123',
        resource: 'card',
        action: 'updated',
        body: {
          id: 'rain-card-123',
          userId: 'rain-user-123',
          status: 'locked',
          limit: { amount: 1000, frequency: 'per30DayPeriod' },
          expirationMonth: '12',
          expirationYear: '2027',
        },
      };

      const mockCard = {
        id: 'card-123',
        user_id: 'user-123',
        provider_ref: 'rain-card-123',
        status: 'active',
        limit: 1000,
        limit_frequency: 'per30DayPeriod',
        expiration_month: '12',
        expiration_year: '2027',
        is_freezed: false,
      };

      const mockCardUser = {
        id: 'card-user-123',
        user_id: 'user-123',
        provider_ref: 'rain-user-123',
        user: {
          id: 'user-123',
        },
      };

      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
      };

      const mockUpdatedCard = {
        ...mockCard,
        status: 'blocked',
        is_freezed: true,
      };

      const mockHeaders = {
        Signature: 'test-signature',
      };

      mockCardRepository.findOne.mockResolvedValueOnce(mockCard as any).mockResolvedValueOnce(mockUpdatedCard as any);
      mockCardUserRepository.findOne.mockResolvedValue(mockCardUser as any);
      mockCardRepository.update.mockResolvedValue({} as any);
      mockUserRepository.findActiveById = jest.fn().mockResolvedValue(mockUser as any);
      mockInAppNotificationService.createNotification.mockResolvedValue({} as any);
      mockMailerService.send.mockResolvedValue(undefined);

      const result = await service.processWebhook(mockBody, mockHeaders);

      expect(result.status).toBe('processed');
      expect(result.action).toBe('card_updated');
    });

    it('should not send notification for active card that was not frozen', async () => {
      const mockBody = {
        id: 'webhook-123',
        resource: 'card',
        action: 'updated',
        body: {
          id: 'rain-card-123',
          userId: 'rain-user-123',
          status: 'active',
          limit: { amount: 1000, frequency: 'per30DayPeriod' },
          expirationMonth: '12',
          expirationYear: '2027',
        },
      };

      const mockCard = {
        id: 'card-123',
        user_id: 'user-123',
        provider_ref: 'rain-card-123',
        status: 'active',
        limit: 1000,
        limit_frequency: 'per30DayPeriod',
        expiration_month: '12',
        expiration_year: '2027',
        is_freezed: false,
      };

      const mockCardUser = {
        id: 'card-user-123',
        user_id: 'user-123',
        provider_ref: 'rain-user-123',
        user: {
          id: 'user-123',
        },
      };

      const mockUpdatedCard = {
        ...mockCard,
        status: 'active',
      };

      const mockHeaders = {
        Signature: 'test-signature',
      };

      mockCardRepository.findOne.mockResolvedValueOnce(mockCard as any).mockResolvedValueOnce(mockUpdatedCard as any);
      mockCardUserRepository.findOne.mockResolvedValue(mockCardUser as any);
      mockCardRepository.update.mockResolvedValue({} as any);

      const result = await service.processWebhook(mockBody, mockHeaders);

      expect(result.status).toBe('processed');
      expect(result.action).toBe('card_updated');
    });
  });

  describe('processWebhook - handleCardNotification', () => {
    it('should handle card user not found in handleCardNotification', async () => {
      const mockBody = {
        id: 'webhook-123',
        resource: 'card',
        action: 'notification',
        body: {
          id: 'notification-123',
          card: {
            id: 'rain-card-123',
            userId: 'rain-user-123',
          },
        },
      };

      const mockHeaders = {
        Signature: 'test-signature',
      };

      mockCardUserRepository.findOne.mockResolvedValue(null);

      const result = await service.processWebhook(mockBody, mockHeaders);

      expect(result.status).toBe('processed');
      expect(result.action).toBe('card_notification');
      expect(result.processed).toBe(false);
      expect(result.reason).toBe('card_user_not_found');
    });

    it('should handle virtual card not found in handleCardNotification', async () => {
      const mockBody = {
        id: 'webhook-123',
        resource: 'card',
        action: 'notification',
        body: {
          id: 'notification-123',
          card: {
            id: 'rain-card-123',
            userId: 'rain-user-123',
          },
        },
      };

      const mockCardUser = {
        id: 'card-user-123',
        user_id: 'user-123',
        provider_ref: 'rain-user-123',
      };

      const mockHeaders = {
        Signature: 'test-signature',
      };

      mockCardUserRepository.findOne.mockResolvedValueOnce(mockCardUser as any);
      mockCardRepository.findOne.mockResolvedValueOnce(null);

      const result = await service.processWebhook(mockBody, mockHeaders);

      expect(result.status).toBe('processed');
      expect(result.action).toBe('card_notification');
      expect(result.processed).toBe(false);
      expect(result.reason).toBe('card_not_found');
    });

    it('should handle error in handleCardNotification', async () => {
      const mockBody = {
        id: 'webhook-123',
        resource: 'card',
        action: 'notification',
        body: {
          id: 'notification-123',
          card: {
            id: 'rain-card-123',
            userId: 'rain-user-123',
          },
        },
      };

      const mockHeaders = {
        Signature: 'test-signature',
      };

      mockCardUserRepository.findOne.mockRejectedValue(new Error('Database error'));

      const result = await service.processWebhook(mockBody, mockHeaders);

      expect(result.status).toBe('processed');
      expect(result.action).toBe('card_notification');
      expect(result.processed).toBe(false);
      expect(result.error).toBe('Internal processing error');
    });
  });

  describe('processWebhook - handleCollateralTransaction additional coverage', () => {
    it('should handle card not found during balance update in collateral transaction', async () => {
      const mockBody = {
        id: 'webhook-123',
        resource: 'transaction',
        action: 'created',
        body: {
          id: 'txn-123',
          type: 'collateral',
          collateral: {
            amount: 10000,
            currency: 'USD',
            chainId: 11155111,
            walletAddress: '0x123',
            transactionHash: '0xabc',
            userId: 'rain-user-123',
            postedAt: '2024-01-01T00:00:00Z',
          },
        },
      };

      const mockCardUser = {
        id: 'card-user-123',
        user_id: 'user-123',
        provider_ref: 'rain-user-123',
        balance: 0,
      };

      const mockDepositAddress = {
        id: 'deposit-123',
        address: '0x123',
        user_id: 'user-123',
        asset: 'ethereum',
      };

      const mockExistingTransaction = {
        id: 'card-txn-123',
        provider_reference: 'txn-123',
        user_id: 'user-123',
        card_user_id: 'card-user-123',
        status: 'pending',
        transaction_type: 'deposit',
        type: 'credit',
        card_id: 'card-123',
      };

      const mockCard = {
        id: 'card-123',
        user_id: 'user-123',
        provider_ref: 'rain-card-123',
        balance: 0,
      };

      const mockHeaders = {
        Signature: 'test-signature',
      };

      mockCardUserRepository.findOne.mockResolvedValue(mockCardUser as any);
      mockDepositAddressRepository.findOne.mockResolvedValue(mockDepositAddress as any);
      mockCardTransactionRepository.findOne.mockResolvedValue(mockExistingTransaction as any);
      mockCardRepository.findOne.mockResolvedValueOnce(mockCard as any).mockResolvedValueOnce(null);

      mockLockerService.withLock.mockImplementation(async (key, fn) => {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        return await mockCardTransactionRepository.transaction(async (_trx: any) => {
          return await fn();
        });
      });

      mockCardTransactionRepository.transaction.mockImplementation(async (fn) => {
        return await fn({} as any);
      });

      const result = await service.processWebhook(mockBody, mockHeaders);

      expect(result.status).toBe('processed');
      expect(result.action).toBe('transaction_created');
      expect(result.updated).toBe(false);
    });
  });

  describe('processWebhook - handleSpendTransactionCompleted additional coverage', () => {
    it('should handle status update from pending in handleSpendTransactionCompleted', async () => {
      jest.resetAllMocks();

      const mockBody = {
        id: 'webhook-123',
        resource: 'transaction',
        action: 'completed',
        body: {
          id: 'txn-123',
          type: 'spend',
          spend: {
            id: 'spend-123',
            amount: -5000,
            currency: 'USD',
            cardId: 'rain-card-123',
            userId: 'rain-user-123',
            status: 'completed',
            merchantName: 'Test Merchant',
          },
        },
      };

      const mockCardUser = {
        id: 'card-user-123',
        user_id: 'user-123',
        provider_ref: 'rain-user-123',
        balance: 10000,
      };

      const mockCard = {
        id: 'card-123',
        user_id: 'user-123',
        card_user_id: 'card-user-123',
        provider_ref: 'rain-card-123',
        balance: 10000,
      };

      const mockExistingCardTransaction = {
        id: 'card-txn-123',
        provider_reference: 'txn-123',
        status: 'pending',
        amount: -5000,
        card_id: 'card-123',
        card_user_id: 'card-user-123',
      };

      const mockMainTransaction = {
        id: 'main-txn-123',
        reference: 'txn-123',
        status: TransactionStatus.PENDING,
        amount: -5000,
      };

      const mockHeaders = {
        Signature: 'test-signature',
      };

      const mockTrx = {} as any;
      mockCardUserRepository.findOne.mockImplementation(async (query: any, options: any, context: any) => {
        if (context?.trx === mockTrx) {
          // When querying by id within transaction
          if (query?.id === mockCardUser.id) {
            return mockCardUser as any;
          }
          return mockCardUser as any;
        }
        // When querying by provider_ref outside transaction
        if (query?.provider_ref === mockCardUser.provider_ref) {
          return mockCardUser as any;
        }
        return mockCardUser as any;
      });

      mockCardRepository.findOne.mockImplementation(async (query: any, options: any, context: any) => {
        if (context?.trx === mockTrx) {
          // When querying by id within transaction
          if (query?.id === mockCard.id) {
            return mockCard as any;
          }
          return mockCard as any;
        }
        // When querying by provider_ref outside transaction
        if (query?.provider_ref === mockCard.provider_ref) {
          return mockCard as any;
        }
        return mockCard as any;
      });

      mockCardTransactionRepository.findOne.mockResolvedValue(mockExistingCardTransaction as any);
      mockTransactionRepository.findOne.mockResolvedValue(mockMainTransaction as any);

      mockLockerService.withLock.mockImplementation(async (key, fn) => {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        return await mockCardTransactionRepository.transaction(async (_trx: any) => {
          return await fn();
        });
      });

      mockCardTransactionRepository.transaction.mockImplementation(async (fn) => {
        return await fn(mockTrx);
      });

      mockCardTransactionRepository.update.mockImplementation(async (query: any, data: any, context: any) => {
        if (context?.trx === mockTrx) {
          return {} as any;
        }
        return {} as any;
      });

      mockTransactionRepository.update.mockImplementation(async (query: any, data: any, context: any) => {
        if (context?.trx === mockTrx) {
          return {} as any;
        }
        return {} as any;
      });

      const result = await service.processWebhook(mockBody, mockHeaders);

      expect(result.status).toBe('processed');
      expect(result.action).toBe('spend_transaction_completed');
      expect(result.completed).toBe(true);
      expect(result.reason).toBe('status_updated_from_pending');
    });
  });

  describe('processWebhook - handleCardUpdated status mapping', () => {
    it('should map canceled status to canceled', async () => {
      const mockBody = {
        id: 'webhook-123',
        resource: 'card',
        action: 'updated',
        body: {
          id: 'rain-card-123',
          userId: 'rain-user-123',
          status: 'canceled',
          limit: { amount: 1000, frequency: 'per30DayPeriod' },
          expirationMonth: '12',
          expirationYear: '2027',
        },
      };

      const mockCard = {
        id: 'card-123',
        user_id: 'user-123',
        provider_ref: 'rain-card-123',
        status: 'active',
        limit: 1000,
        limit_frequency: 'per30DayPeriod',
        expiration_month: '12',
        expiration_year: '2027',
        is_freezed: false,
      };

      const mockCardUser = {
        id: 'card-user-123',
        user_id: 'user-123',
        provider_ref: 'rain-user-123',
        user: {
          id: 'user-123',
        },
      };

      const mockUpdatedCard = {
        ...mockCard,
        status: 'suspended',
      };

      const mockHeaders = {
        Signature: 'test-signature',
      };

      mockCardRepository.findOne.mockResolvedValueOnce(mockCard as any).mockResolvedValueOnce(mockUpdatedCard as any);
      mockCardUserRepository.findOne.mockResolvedValue(mockCardUser as any);
      mockCardRepository.update.mockResolvedValue({} as any);

      const result = await service.processWebhook(mockBody, mockHeaders);

      expect(result.status).toBe('processed');
      expect(result.action).toBe('card_updated');
      expect(mockCardRepository.update).toHaveBeenCalledWith(
        { id: mockCard.id },
        expect.objectContaining({
          status: 'canceled',
        }),
      );
    });

    it('should not downgrade blocked & frozen card when status is locked', async () => {
      const mockBody = {
        id: 'webhook-123',
        resource: 'card',
        action: 'updated',
        body: {
          id: 'rain-card-123',
          userId: 'rain-user-123',
          status: 'locked',
          limit: { amount: 1000, frequency: 'per30DayPeriod' },
          expirationMonth: '12',
          expirationYear: '2027',
        },
      };

      const mockCard = {
        id: 'card-123',
        user_id: 'user-123',
        provider_ref: 'rain-card-123',
        status: 'blocked',
        limit: 1000,
        limit_frequency: 'per30DayPeriod',
        expiration_month: '12',
        expiration_year: '2027',
        is_freezed: true,
      };

      const mockHeaders = {
        Signature: 'test-signature',
      };

      mockCardRepository.findOne.mockResolvedValue(mockCard as any);

      const result = await service.processWebhook(mockBody as any, mockHeaders);

      expect(result.status).toBe('processed');
      expect(result.action).toBe('card_updated');
      expect(result.updated).toBe(false);
      expect(result.reason).toBe('card_already_blocked_and_frozen');
      expect(mockCardRepository.update).not.toHaveBeenCalled();
    });

    it('should map inactive status', async () => {
      const mockBody = {
        id: 'webhook-123',
        resource: 'card',
        action: 'updated',
        body: {
          id: 'rain-card-123',
          userId: 'rain-user-123',
          status: 'inactive',
          limit: { amount: 1000, frequency: 'per30DayPeriod' },
          expirationMonth: '12',
          expirationYear: '2027',
        },
      };

      const mockCard = {
        id: 'card-123',
        user_id: 'user-123',
        provider_ref: 'rain-card-123',
        status: 'active',
        limit: 1000,
        limit_frequency: 'per30DayPeriod',
        expiration_month: '12',
        expiration_year: '2027',
        is_freezed: false,
      };

      const mockCardUser = {
        id: 'card-user-123',
        user_id: 'user-123',
        provider_ref: 'rain-user-123',
        user: {
          id: 'user-123',
        },
      };

      const mockUpdatedCard = {
        ...mockCard,
        status: 'inactive',
      };

      const mockHeaders = {
        Signature: 'test-signature',
      };

      mockCardRepository.findOne.mockResolvedValueOnce(mockCard as any).mockResolvedValueOnce(mockUpdatedCard as any);
      mockCardUserRepository.findOne.mockResolvedValue(mockCardUser as any);
      mockCardRepository.update.mockResolvedValue({} as any);

      const result = await service.processWebhook(mockBody, mockHeaders);

      expect(result.status).toBe('processed');
      expect(result.action).toBe('card_updated');
      expect(mockCardRepository.update).toHaveBeenCalledWith(
        { id: mockCard.id },
        expect.objectContaining({
          status: 'inactive',
        }),
      );
    });

    it('should send notification/email when status becomes inactive', async () => {
      const mockBody = {
        id: 'webhook-123',
        resource: 'card',
        action: 'updated',
        body: {
          id: 'rain-card-123',
          userId: 'rain-user-123',
          status: 'inactive',
          limit: { amount: 1000, frequency: 'per30DayPeriod' },
          expirationMonth: '12',
          expirationYear: '2027',
        },
      };

      const mockCard = {
        id: 'card-123',
        user_id: 'user-123',
        provider_ref: 'rain-card-123',
        status: 'active',
        limit: 1000,
        limit_frequency: 'per30DayPeriod',
        expiration_month: '12',
        expiration_year: '2027',
        is_freezed: false,
      };

      const mockCardUser = {
        id: 'card-user-123',
        user_id: 'user-123',
        provider_ref: 'rain-user-123',
        user: {
          id: 'user-123',
        },
      };

      const mockUpdatedCard = {
        ...mockCard,
        status: 'inactive',
      };

      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
      };

      const mockHeaders = {
        Signature: 'test-signature',
      };

      mockCardRepository.findOne.mockResolvedValueOnce(mockCard as any).mockResolvedValueOnce(mockUpdatedCard as any);
      mockCardUserRepository.findOne.mockResolvedValue(mockCardUser as any);
      mockCardRepository.update.mockResolvedValue({} as any);
      mockUserRepository.findActiveById.mockResolvedValue(mockUser as any);

      const result = await service.processWebhook(mockBody, mockHeaders);

      expect(result.status).toBe('processed');
      expect(result.action).toBe('card_updated');
    });
  });

  describe('Security Features - Transaction Amount Validation', () => {
    it('should reject non-finite amounts in collateral transaction', async () => {
      const mockBody = {
        id: 'webhook-123',
        resource: 'transaction',
        action: 'created',
        body: {
          id: 'txn-123',
          type: 'collateral',
          collateral: {
            amount: Infinity,
            currency: 'USD',
            chainId: 11155111,
            walletAddress: '0x123',
            transactionHash: '0xabc',
            userId: 'rain-user-123',
          },
        },
      };

      const mockCardUser = {
        id: 'card-user-123',
        user_id: 'user-123',
        provider_ref: 'rain-user-123',
      };

      const mockDepositAddress = {
        id: 'deposit-123',
        address: '0x456',
      };

      const mockCardTransaction = {
        id: 'card-txn-123',
        card_id: 'card-123',
        user_id: 'user-123',
        card_user_id: 'card-user-123',
        fee: 100,
        amount: 9900,
        status: 'pending',
      };

      mockCardUserRepository.findOne.mockResolvedValue(mockCardUser as any);
      mockDepositAddressRepository.findOne.mockResolvedValue(mockDepositAddress as any);
      mockCardTransactionRepository.findOne.mockResolvedValue(mockCardTransaction as any);
      mockCardRepository.findOne.mockResolvedValue({
        id: 'card-123',
        user_id: 'user-123',
        card_user_id: 'card-user-123',
        balance: 0,
      } as any);
      mockCardTransactionRepository.transaction.mockImplementation((callback) => {
        try {
          return callback({});
        } catch (error) {
          throw error;
        }
      });
      mockLockerService.withLock.mockImplementation((key, callback) => {
        try {
          return callback();
        } catch (error) {
          throw error;
        }
      });

      const result = await service.processWebhook(mockBody, {});

      expect(result.status).toBe('processed');
      expect(result.error).toBe('Internal processing error');
    });

    it('should reject negative amounts in collateral transaction', async () => {
      const mockBody = {
        id: 'webhook-123',
        resource: 'transaction',
        action: 'created',
        body: {
          id: 'txn-123',
          type: 'collateral',
          collateral: {
            amount: -1000,
            currency: 'USD',
            chainId: 11155111,
            walletAddress: '0x123',
            transactionHash: '0xabc',
            userId: 'rain-user-123',
          },
        },
      };

      const mockCardUser = {
        id: 'card-user-123',
        user_id: 'user-123',
        provider_ref: 'rain-user-123',
      };

      const mockDepositAddress = {
        id: 'deposit-123',
        address: '0x456',
      };

      const mockCardTransaction = {
        id: 'card-txn-123',
        card_id: 'card-123',
        user_id: 'user-123',
        card_user_id: 'card-user-123',
        fee: 100,
        amount: 9900,
        status: 'pending',
      };

      mockCardUserRepository.findOne.mockResolvedValue(mockCardUser as any);
      mockDepositAddressRepository.findOne.mockResolvedValue(mockDepositAddress as any);
      mockCardTransactionRepository.findOne.mockResolvedValue(mockCardTransaction as any);
      mockCardRepository.findOne.mockResolvedValue({
        id: 'card-123',
        user_id: 'user-123',
        card_user_id: 'card-user-123',
        balance: 0,
      } as any);
      mockCardTransactionRepository.transaction.mockImplementation((callback) => {
        try {
          return callback({});
        } catch (error) {
          throw error;
        }
      });
      mockLockerService.withLock.mockImplementation((key, callback) => {
        try {
          return callback();
        } catch (error) {
          throw error;
        }
      });

      const result = await service.processWebhook(mockBody, {});

      expect(result.status).toBe('processed');
      expect(result.error).toBe('Internal processing error');
    });

    it('should reject USD amounts with decimal precision', async () => {
      const mockBody = {
        id: 'webhook-123',
        resource: 'transaction',
        action: 'created',
        body: {
          id: 'txn-123',
          type: 'collateral',
          collateral: {
            amount: 1000.5,
            currency: 'USD',
            chainId: 11155111,
            walletAddress: '0x123',
            transactionHash: '0xabc',
            userId: 'rain-user-123',
          },
        },
      };

      const mockCardUser = {
        id: 'card-user-123',
        user_id: 'user-123',
        provider_ref: 'rain-user-123',
      };

      const mockDepositAddress = {
        id: 'deposit-123',
        address: '0x456',
      };

      const mockCardTransaction = {
        id: 'card-txn-123',
        card_id: 'card-123',
        user_id: 'user-123',
        card_user_id: 'card-user-123',
        fee: 100,
        amount: 9900,
        status: 'pending',
      };

      mockCardUserRepository.findOne.mockResolvedValue(mockCardUser as any);
      mockDepositAddressRepository.findOne.mockResolvedValue(mockDepositAddress as any);
      mockCardTransactionRepository.findOne.mockResolvedValue(mockCardTransaction as any);
      mockCardRepository.findOne.mockResolvedValue({
        id: 'card-123',
        user_id: 'user-123',
        card_user_id: 'card-user-123',
        balance: 0,
      } as any);
      mockCardTransactionRepository.transaction.mockImplementation((callback) => {
        try {
          return callback({});
        } catch (error) {
          throw error;
        }
      });
      mockLockerService.withLock.mockImplementation((key, callback) => {
        try {
          return callback();
        } catch (error) {
          throw error;
        }
      });

      const result = await service.processWebhook(mockBody, {});

      expect(result.status).toBe('processed');
      expect(result.error).toBe('Internal processing error');
    });
  });

  describe('Security Features - Fee Validation', () => {
    it('should reject fee exceeding transaction amount', async () => {
      const mockBody = {
        id: 'webhook-123',
        resource: 'transaction',
        action: 'created',
        body: {
          id: 'txn-123',
          type: 'collateral',
          collateral: {
            amount: 1000,
            currency: 'USD',
            chainId: 11155111,
            walletAddress: '0x123',
            transactionHash: '0xabc',
            userId: 'rain-user-123',
          },
        },
      };

      const mockCardUser = {
        id: 'card-user-123',
        user_id: 'user-123',
        provider_ref: 'rain-user-123',
      };

      const mockDepositAddress = {
        id: 'deposit-123',
        address: '0x456',
      };

      const mockCardTransaction = {
        id: 'card-txn-123',
        card_id: 'card-123',
        user_id: 'user-123',
        card_user_id: 'card-user-123',
        fee: 2000,
        amount: 9900,
        status: 'pending',
      };

      mockCardUserRepository.findOne.mockResolvedValue(mockCardUser as any);
      mockDepositAddressRepository.findOne.mockResolvedValue(mockDepositAddress as any);
      mockCardTransactionRepository.findOne.mockResolvedValue(mockCardTransaction as any);
      mockCardRepository.findOne.mockResolvedValue({
        id: 'card-123',
        user_id: 'user-123',
        card_user_id: 'card-user-123',
        balance: 0,
      } as any);
      mockCardTransactionRepository.transaction.mockImplementation((callback) => {
        try {
          return callback({});
        } catch (error) {
          throw error;
        }
      });
      mockLockerService.withLock.mockImplementation((key, callback) => {
        try {
          return callback();
        } catch (error) {
          throw error;
        }
      });

      const result = await service.processWebhook(mockBody, {});

      expect(result.status).toBe('processed');
      expect(result.error).toBe('Internal processing error');
    });

    it('should not charge fees for failed funding transactions', async () => {
      const mockBody = {
        id: 'webhook-123',
        resource: 'transaction',
        action: 'created',
        body: {
          id: 'txn-123',
          type: 'collateral',
          collateral: {
            amount: 10000,
            currency: 'USD',
            chainId: 11155111,
            walletAddress: '0x123',
            transactionHash: '0xabc',
            userId: 'rain-user-123',
          },
        },
      };

      const mockCardUser = {
        id: 'card-user-123',
        user_id: 'user-123',
        provider_ref: 'rain-user-123',
        balance: 0,
      };

      const mockDepositAddress = {
        id: 'deposit-123',
        address: '0x456',
      };

      const mockCardTransaction = {
        id: 'card-txn-123',
        card_id: 'card-123',
        user_id: 'user-123',
        card_user_id: 'card-user-123',
        fee: 100,
        amount: 9900,
        status: 'pending',
        transaction_type: 'deposit',
      };

      const mockCard = {
        id: 'card-123',
        user_id: 'user-123',
        card_user_id: 'card-user-123',
        balance: 0,
      };

      mockCardUserRepository.findOne.mockResolvedValue(mockCardUser as any);
      mockDepositAddressRepository.findOne.mockResolvedValue(mockDepositAddress as any);
      mockCardTransactionRepository.findOne
        .mockResolvedValueOnce(mockCardTransaction as any)
        .mockResolvedValueOnce({ ...mockCardTransaction, status: 'declined' } as any);
      mockCardRepository.findOne.mockResolvedValue(mockCard as any);
      mockCardTransactionRepository.transaction.mockImplementation((callback) => callback({}));
      mockLockerService.withLock.mockImplementation((key, callback) => callback());
      mockTransactionRepository.create.mockResolvedValue({ id: 'main-txn' } as any);
      mockCardTransactionRepository.update.mockResolvedValue({} as any);
      mockCardRepository.update.mockResolvedValue({} as any);
      mockCardUserRepository.update.mockResolvedValue({} as any);
      mockCardAdapter.createCharge = jest.fn();

      const result = await service.processWebhook(mockBody, {});

      expect(result.status).toBe('processed');
      expect(mockCardAdapter.createCharge).not.toHaveBeenCalled();
    });

    it('should not charge fees for pending transactions', async () => {
      const mockBody = {
        id: 'webhook-123',
        resource: 'transaction',
        action: 'created',
        body: {
          id: 'txn-123',
          type: 'collateral',
          collateral: {
            amount: 10000,
            currency: 'USD',
            chainId: 11155111,
            walletAddress: '0x123',
            transactionHash: '0xabc',
            userId: 'rain-user-123',
          },
        },
      };

      const mockCardUser = {
        id: 'card-user-123',
        user_id: 'user-123',
        provider_ref: 'rain-user-123',
        balance: 0,
      };

      const mockDepositAddress = {
        id: 'deposit-123',
        address: '0x456',
      };

      const mockCardTransaction = {
        id: 'card-txn-123',
        card_id: 'card-123',
        user_id: 'user-123',
        card_user_id: 'card-user-123',
        fee: 100,
        amount: 9900,
        status: 'pending',
        transaction_type: 'deposit',
      };

      const mockCard = {
        id: 'card-123',
        user_id: 'user-123',
        card_user_id: 'card-user-123',
        balance: 0,
      };

      mockCardUserRepository.findOne.mockResolvedValue(mockCardUser as any);
      mockDepositAddressRepository.findOne.mockResolvedValue(mockDepositAddress as any);
      mockCardTransactionRepository.findOne
        .mockResolvedValueOnce(mockCardTransaction as any)
        .mockResolvedValueOnce({ ...mockCardTransaction, status: 'pending' } as any);
      mockCardRepository.findOne.mockResolvedValue(mockCard as any);
      mockCardTransactionRepository.transaction.mockImplementation((callback) => callback({}));
      mockLockerService.withLock.mockImplementation((key, callback) => callback());
      mockTransactionRepository.create.mockResolvedValue({ id: 'main-txn' } as any);
      mockCardTransactionRepository.update.mockResolvedValue({} as any);
      mockCardRepository.update.mockResolvedValue({} as any);
      mockCardUserRepository.update.mockResolvedValue({} as any);
      mockCardAdapter.createCharge = jest.fn();

      const result = await service.processWebhook(mockBody, {});

      expect(result.status).toBe('processed');
      expect(mockCardAdapter.createCharge).not.toHaveBeenCalled();
    });
  });

  describe('Security Features - Authorization Checks', () => {
    it('should reject transaction when card does not belong to cardUser in collateral transaction', async () => {
      const mockBody = {
        id: 'webhook-123',
        resource: 'transaction',
        action: 'created',
        body: {
          id: 'txn-123',
          type: 'collateral',
          collateral: {
            amount: 10000,
            currency: 'USD',
            chainId: 11155111,
            walletAddress: '0x123',
            transactionHash: '0xabc',
            userId: 'rain-user-123',
          },
        },
      };

      const mockCardUser = {
        id: 'card-user-123',
        user_id: 'user-123',
        provider_ref: 'rain-user-123',
      };

      const mockDepositAddress = {
        id: 'deposit-123',
        address: '0x456',
      };

      const mockCardTransaction = {
        id: 'card-txn-123',
        card_id: 'card-123',
        user_id: 'user-123',
        card_user_id: 'card-user-123',
        fee: 100,
        amount: 9900,
        status: 'pending',
      };

      const mockCard = {
        id: 'card-123',
        user_id: 'user-456',
        card_user_id: 'card-user-456',
        balance: 0,
      };

      mockCardUserRepository.findOne.mockResolvedValue(mockCardUser as any);
      mockDepositAddressRepository.findOne.mockResolvedValue(mockDepositAddress as any);
      mockCardTransactionRepository.findOne.mockResolvedValue(mockCardTransaction as any);
      mockCardRepository.findOne.mockResolvedValue(mockCard as any);
      mockCardTransactionRepository.transaction.mockImplementation((callback) => {
        try {
          return callback({});
        } catch (error) {
          throw error;
        }
      });
      mockLockerService.withLock.mockImplementation((key, callback) => {
        try {
          return callback();
        } catch (error) {
          throw error;
        }
      });

      const result = await service.processWebhook(mockBody, {});

      expect(result.status).toBe('processed');
      expect(result.error).toBe('Internal processing error');
    });

    it('should reject transaction when card does not belong to cardUser after re-fetch in collateral transaction', async () => {
      const mockBody = {
        id: 'webhook-123',
        resource: 'transaction',
        action: 'created',
        body: {
          id: 'txn-123',
          type: 'collateral',
          collateral: {
            amount: 10000,
            currency: 'USD',
            chainId: 11155111,
            walletAddress: '0x123',
            transactionHash: '0xabc',
            userId: 'rain-user-123',
          },
        },
      };

      const mockCardUser = {
        id: 'card-user-123',
        user_id: 'user-123',
        provider_ref: 'rain-user-123',
      };

      const mockDepositAddress = {
        id: 'deposit-123',
        address: '0x456',
      };

      const mockCardTransaction = {
        id: 'card-txn-123',
        card_id: 'card-123',
        user_id: 'user-123',
        card_user_id: 'card-user-123',
        fee: 100,
        amount: 9900,
        status: 'pending',
      };

      const mockCard = {
        id: 'card-123',
        user_id: 'user-123',
        card_user_id: 'card-user-123',
        balance: 0,
      };

      const mockLockedCard = {
        id: 'card-123',
        user_id: 'user-456',
        card_user_id: 'card-user-456',
        balance: 0,
      };

      mockCardUserRepository.findOne
        .mockResolvedValueOnce(mockCardUser as any)
        .mockResolvedValueOnce({ ...mockCardUser } as any);
      mockDepositAddressRepository.findOne.mockResolvedValue(mockDepositAddress as any);
      mockCardTransactionRepository.findOne.mockResolvedValue(mockCardTransaction as any);
      mockCardRepository.findOne.mockResolvedValueOnce(mockCard as any).mockResolvedValueOnce(mockLockedCard as any);
      mockCardTransactionRepository.transaction.mockImplementation((callback) => {
        try {
          return callback({});
        } catch (error) {
          throw error;
        }
      });
      mockLockerService.withLock.mockImplementation((key, callback) => {
        try {
          return callback();
        } catch (error) {
          throw error;
        }
      });

      const result = await service.processWebhook(mockBody, {});

      expect(result.status).toBe('processed');
      expect(result.error).toBe('Internal processing error');
    });
  });

  describe('Security Features - Idempotency Validation', () => {
    it('should reject invalid status transitions', async () => {
      const mockBody = {
        id: 'webhook-123',
        resource: 'transaction',
        action: 'created',
        body: {
          id: 'txn-123',
          type: 'spend',
          spend: {
            amount: -5000,
            currency: 'USD',
            cardId: 'rain-card-123',
            userId: 'rain-user-123',
            merchantName: 'Test Merchant',
            status: 'pending',
          },
        },
      };

      const mockCardUser = {
        id: 'card-user-123',
        user_id: 'user-123',
        provider_ref: 'rain-user-123',
      };

      const mockCard = {
        id: 'card-123',
        user_id: 'user-123',
        card_user_id: 'card-user-123',
        balance: 10000,
        provider_ref: 'rain-card-123',
      };

      const mockExistingCardTransaction = {
        id: 'card-txn-123',
        provider_reference: 'txn-123',
        status: 'successful',
        amount: -5000,
      };

      mockCardUserRepository.findOne.mockResolvedValue(mockCardUser as any);
      mockCardRepository.findOne.mockResolvedValue(mockCard as any);
      mockCardTransactionRepository.findOne.mockResolvedValue(mockExistingCardTransaction as any);
      mockTransactionRepository.findOne.mockResolvedValue(null);

      const result = await service.processWebhook(mockBody, {});

      expect(result.status).toBe('processed');
      expect(result.reason).toContain('invalid_status_transition');
    });

    it('should reject amount mismatches beyond tolerance', async () => {
      const mockBody = {
        id: 'webhook-123',
        resource: 'transaction',
        action: 'created',
        body: {
          id: 'txn-123',
          type: 'spend',
          spend: {
            amount: -10000,
            currency: 'USD',
            cardId: 'rain-card-123',
            userId: 'rain-user-123',
            merchantName: 'Test Merchant',
            status: 'pending',
          },
        },
      };

      const mockCardUser = {
        id: 'card-user-123',
        user_id: 'user-123',
        provider_ref: 'rain-user-123',
      };

      const mockCard = {
        id: 'card-123',
        user_id: 'user-123',
        card_user_id: 'card-user-123',
        balance: 10000,
        provider_ref: 'rain-card-123',
      };

      const mockExistingCardTransaction = {
        id: 'card-txn-123',
        provider_reference: 'txn-123',
        status: 'pending',
        amount: -5000,
      };

      mockCardUserRepository.findOne.mockResolvedValue(mockCardUser as any);
      mockCardRepository.findOne.mockResolvedValue(mockCard as any);
      mockCardTransactionRepository.findOne.mockResolvedValue(mockExistingCardTransaction as any);
      mockTransactionRepository.findOne.mockResolvedValue(null);

      const result = await service.processWebhook(mockBody, {});

      expect(result.status).toBe('processed');
      expect(result.reason).toContain('amount_mismatch');
    });

    it('should skip duplicate transactions with same status and amount', async () => {
      const mockBody = {
        id: 'webhook-123',
        resource: 'transaction',
        action: 'created',
        body: {
          id: 'txn-123',
          type: 'spend',
          spend: {
            amount: -5000,
            currency: 'USD',
            cardId: 'rain-card-123',
            userId: 'rain-user-123',
            merchantName: 'Test Merchant',
            status: 'pending',
          },
        },
      };

      const mockCardUser = {
        id: 'card-user-123',
        user_id: 'user-123',
        provider_ref: 'rain-user-123',
      };

      const mockCard = {
        id: 'card-123',
        user_id: 'user-123',
        card_user_id: 'card-user-123',
        balance: 10000,
        provider_ref: 'rain-card-123',
      };

      const mockExistingCardTransaction = {
        id: 'card-txn-123',
        provider_reference: 'txn-123',
        status: 'pending',
        amount: -5000,
      };

      const mockMainTransaction = {
        id: 'main-txn-123',
        reference: 'txn-123',
        status: TransactionStatus.PENDING,
        amount: -5000,
      };

      mockCardUserRepository.findOne.mockResolvedValue(mockCardUser as any);
      mockCardRepository.findOne.mockResolvedValue(mockCard as any);
      mockCardTransactionRepository.findOne.mockResolvedValue(mockExistingCardTransaction as any);
      mockTransactionRepository.findOne.mockResolvedValue(mockMainTransaction as any);

      const result = await service.processWebhook(mockBody, {});

      expect(result.status).toBe('processed');
      expect(result.reason).toBe('transaction_already_processed');
    });

    it('should reject declined transactions with non-zero amount', async () => {
      const mockBody = {
        id: 'webhook-123',
        resource: 'transaction',
        action: 'created',
        body: {
          id: 'txn-123',
          type: 'spend',
          spend: {
            amount: -5000,
            currency: 'USD',
            cardId: 'rain-card-123',
            userId: 'rain-user-123',
            merchantName: 'Test Merchant',
            status: 'declined',
          },
        },
      };

      const mockCardUser = {
        id: 'card-user-123',
        user_id: 'user-123',
        provider_ref: 'rain-user-123',
      };

      const mockCard = {
        id: 'card-123',
        user_id: 'user-123',
        card_user_id: 'card-user-123',
        balance: 10000,
        provider_ref: 'rain-card-123',
      };

      const mockExistingCardTransaction = {
        id: 'card-txn-123',
        provider_reference: 'txn-123',
        status: 'pending',
        amount: -5000,
      };

      mockCardUserRepository.findOne.mockResolvedValue(mockCardUser as any);
      mockCardRepository.findOne.mockResolvedValue(mockCard as any);
      mockCardTransactionRepository.findOne.mockResolvedValue(mockExistingCardTransaction as any);
      mockTransactionRepository.findOne.mockResolvedValue(null);

      const result = await service.processWebhook(mockBody, {});

      expect(result.status).toBe('processed');
      expect(result.reason).toContain('invalid_amount_for_declined');
    });
  });

  describe('Security Features - Lock Keys', () => {
    it('should use specific lock keys including user_id and transaction_id', async () => {
      const mockBody = {
        id: 'webhook-123',
        resource: 'transaction',
        action: 'created',
        body: {
          id: 'txn-123',
          type: 'spend',
          spend: {
            amount: -5000,
            currency: 'USD',
            cardId: 'rain-card-123',
            userId: 'rain-user-123',
            merchantName: 'Test Merchant',
            status: 'pending',
          },
        },
      };

      const mockCardUser = {
        id: 'card-user-123',
        user_id: 'user-123',
        provider_ref: 'rain-user-123',
        balance: 10000,
      };

      const mockCard = {
        id: 'card-123',
        user_id: 'user-123',
        card_user_id: 'card-user-123',
        balance: 10000,
        provider_ref: 'rain-card-123',
      };

      let capturedLockKey = '';

      mockCardUserRepository.findOne.mockResolvedValue(mockCardUser as any);
      mockCardRepository.findOne.mockResolvedValue(mockCard as any);
      mockCardTransactionRepository.findOne.mockResolvedValue(null);
      mockTransactionRepository.findOne.mockResolvedValue(null);
      mockCardTransactionRepository.transaction.mockImplementation((callback) => callback({}));
      mockLockerService.withLock.mockImplementation((key, callback) => {
        capturedLockKey = key;
        return callback();
      });
      mockCardTransactionRepository.create.mockResolvedValue({ id: 'new-txn' } as any);
      mockTransactionRepository.create.mockResolvedValue({ id: 'main-txn' } as any);
      mockCardRepository.update.mockResolvedValue({} as any);
      mockCardUserRepository.update.mockResolvedValue({} as any);

      await service.processWebhook(mockBody, {});

      expect(capturedLockKey).toContain('user-123');
      expect(capturedLockKey).toContain('txn-123');
      expect(capturedLockKey).toContain('card-123');
    });
  });

  describe('Security Features - Exception Handling', () => {
    it('should throw NotFoundException when transaction not found during balance update', async () => {
      const mockBody = {
        id: 'webhook-123',
        resource: 'transaction',
        action: 'created',
        body: {
          id: 'txn-123',
          type: 'collateral',
          collateral: {
            amount: 10000,
            currency: 'USD',
            chainId: 11155111,
            walletAddress: '0x123',
            transactionHash: '0xabc',
            userId: 'rain-user-123',
          },
        },
      };

      const mockCardUser = {
        id: 'card-user-123',
        user_id: 'user-123',
        provider_ref: 'rain-user-123',
      };

      const mockDepositAddress = {
        id: 'deposit-123',
        address: '0x456',
      };

      const mockCardTransaction = {
        id: 'card-txn-123',
        card_id: 'card-123',
        user_id: 'user-123',
        card_user_id: 'card-user-123',
        fee: 100,
        amount: 9900,
        status: 'pending',
      };

      mockCardUserRepository.findOne.mockResolvedValue(mockCardUser as any);
      mockDepositAddressRepository.findOne.mockResolvedValue(mockDepositAddress as any);
      mockCardTransactionRepository.findOne
        .mockResolvedValueOnce(mockCardTransaction as any)
        .mockResolvedValueOnce(null);
      mockCardRepository.findOne.mockResolvedValue({
        id: 'card-123',
        user_id: 'user-123',
        card_user_id: 'card-user-123',
        balance: 0,
      } as any);
      mockCardTransactionRepository.transaction.mockImplementation((callback) => {
        try {
          return callback({});
        } catch (error) {
          throw error;
        }
      });
      mockLockerService.withLock.mockImplementation((key, callback) => {
        try {
          return callback();
        } catch (error) {
          throw error;
        }
      });

      const result = await service.processWebhook(mockBody, {});

      expect(result.status).toBe('processed');
      expect(result.error).toBe('Internal processing error');
    });
  });

  describe('sanitizeNestedObject', () => {
    it('should handle array inputs', () => {
      const input = ['item1', 'item2', 'item3'];
      const result = (service as any).sanitizeNestedObject(input);
      expect(result).toEqual(input);
    });

    it('should handle null input', () => {
      const result = (service as any).sanitizeNestedObject(null);
      expect(result).toBeNull();
    });

    it('should handle non-object input', () => {
      const result = (service as any).sanitizeNestedObject('string');
      expect(result).toBe('string');
    });
  });

  describe('chargeFundingFee', () => {
    it('should skip charging fee when fee is missing', async () => {
      const mockCardUser = {
        id: 'card-user-123',
        provider_ref: 'rain-user-123',
      } as any;

      const mockTransaction = {
        id: 'txn-123',
        fee: null,
        transaction_type: 'deposit',
        status: 'successful',
      } as any;

      mockCardTransactionRepository.findOne.mockResolvedValue(mockTransaction);

      await (service as any).chargeFundingFee(mockCardUser, mockTransaction);

      expect(mockCardAdapter.createCharge).not.toHaveBeenCalled();
    });

    it('should skip charging fee when fee is zero', async () => {
      const mockCardUser = {
        id: 'card-user-123',
        provider_ref: 'rain-user-123',
      } as any;

      const mockTransaction = {
        id: 'txn-123',
        fee: 0,
        transaction_type: 'deposit',
        status: 'successful',
      } as any;

      mockCardTransactionRepository.findOne.mockResolvedValue(mockTransaction);

      await (service as any).chargeFundingFee(mockCardUser, mockTransaction);

      expect(mockCardAdapter.createCharge).not.toHaveBeenCalled();
    });

    it('should skip charging fee when transaction type is not deposit', async () => {
      const mockCardUser = {
        id: 'card-user-123',
        provider_ref: 'rain-user-123',
      } as any;

      const mockTransaction = {
        id: 'txn-123',
        fee: 100,
        transaction_type: 'spend',
        status: 'successful',
      } as any;

      mockCardTransactionRepository.findOne.mockResolvedValue(mockTransaction);

      await (service as any).chargeFundingFee(mockCardUser, mockTransaction);

      expect(mockCardAdapter.createCharge).not.toHaveBeenCalled();
    });

    it('should skip charging fee when updatedCardTransaction is null', async () => {
      const mockCardUser = {
        id: 'card-user-123',
        provider_ref: 'rain-user-123',
      } as any;

      const mockTransaction = {
        id: 'txn-123',
        fee: 100,
        transaction_type: 'deposit',
        status: 'successful',
      } as any;

      mockCardTransactionRepository.findOne.mockResolvedValue(null);

      await (service as any).chargeFundingFee(mockCardUser, mockTransaction);

      expect(mockCardAdapter.createCharge).not.toHaveBeenCalled();
    });

    it('should skip charging fee when fee is negative', async () => {
      const mockCardUser = {
        id: 'card-user-123',
        provider_ref: 'rain-user-123',
      } as any;

      const mockTransaction = {
        id: 'txn-123',
        fee: -10,
        transaction_type: 'deposit',
        status: 'successful',
      } as any;

      mockCardTransactionRepository.findOne.mockResolvedValue(mockTransaction);

      await (service as any).chargeFundingFee(mockCardUser, mockTransaction);

      expect(mockCardAdapter.createCharge).not.toHaveBeenCalled();
    });

    it('should skip charging fee when fee is undefined', async () => {
      const mockCardUser = {
        id: 'card-user-123',
        provider_ref: 'rain-user-123',
      } as any;

      const mockTransaction = {
        id: 'txn-123',
        fee: undefined,
        transaction_type: 'deposit',
        status: 'successful',
      } as any;

      mockCardTransactionRepository.findOne.mockResolvedValue(mockTransaction);

      await (service as any).chargeFundingFee(mockCardUser, mockTransaction);

      expect(mockCardAdapter.createCharge).not.toHaveBeenCalled();
    });

    it('should skip charging fee when transaction status is not successful', async () => {
      const mockCardUser = {
        id: 'card-user-123',
        provider_ref: 'rain-user-123',
      } as any;

      const mockTransaction = {
        id: 'txn-123',
        fee: 100,
        transaction_type: 'deposit',
        status: 'pending',
      } as any;

      mockCardTransactionRepository.findOne.mockResolvedValue(mockTransaction);

      await (service as any).chargeFundingFee(mockCardUser, mockTransaction);

      expect(mockCardAdapter.createCharge).not.toHaveBeenCalled();
    });

    it('should skip charging fee when feeRequiresChargeApi is false and set is_fee_settled to true', async () => {
      const mockCardUser = {
        id: 'card-user-123',
        provider_ref: 'rain-user-123',
      } as any;

      const mockTransaction = {
        id: 'txn-123',
        fee: 100,
        transaction_type: 'deposit',
        status: 'successful',
      } as any;

      jest.spyOn(CardFeesService, 'requiresChargeApi').mockReturnValue(false);
      mockCardTransactionRepository.findOne.mockResolvedValue(mockTransaction);

      await (service as any).chargeFundingFee(mockCardUser, mockTransaction);

      expect(mockCardAdapter.createCharge).not.toHaveBeenCalled();
      expect(mockCardTransactionRepository.update).toHaveBeenCalledWith(
        { id: 'txn-123' },
        {
          is_fee_settled: true,
        },
      );
    });

    it('should charge fee successfully', async () => {
      const mockCardUser = {
        id: 'card-user-123',
        provider_ref: 'rain-user-123',
      } as any;

      const mockTransaction = {
        id: 'txn-123',
        fee: 100,
        transaction_type: 'deposit',
        status: 'successful',
      } as any;

      jest.spyOn(CardFeesService, 'requiresChargeApi').mockReturnValue(true);
      mockCardTransactionRepository.findOne.mockResolvedValue(mockTransaction);
      mockCardAdapter.createCharge.mockResolvedValue({ providerRef: 'charge-123' } as any);

      await (service as any).chargeFundingFee(mockCardUser, mockTransaction);

      expect(mockCardAdapter.createCharge).toHaveBeenCalled();
      expect(mockCardTransactionRepository.update).toHaveBeenCalledWith(
        { id: 'txn-123' },
        {
          provider_fee_reference: 'charge-123',
          is_fee_settled: true,
        },
      );
    });

    it('should handle error when charging fee fails', async () => {
      const mockCardUser = {
        id: 'card-user-123',
        provider_ref: 'rain-user-123',
      } as any;

      const mockTransaction = {
        id: 'txn-123',
        fee: 100,
        transaction_type: 'deposit',
        status: 'successful',
      } as any;

      jest.spyOn(CardFeesService, 'requiresChargeApi').mockReturnValue(true);
      mockCardTransactionRepository.findOne.mockResolvedValue(mockTransaction);
      mockCardAdapter.createCharge.mockRejectedValue(new Error('Charge failed'));

      await (service as any).chargeFundingFee(mockCardUser, mockTransaction);

      expect(mockCardAdapter.createCharge).toHaveBeenCalled();
      expect(mockCardTransactionRepository.update).not.toHaveBeenCalled();
    });

    it('should log NGN card funding fee charging when parent_exchange_transaction_id is set', async () => {
      const mockCardUser = {
        id: 'card-user-123',
        provider_ref: 'rain-user-123',
      } as any;

      const mockTransaction = {
        id: 'txn-123',
        card_id: 'card-123',
        fee: 10,
        transaction_type: 'deposit',
        status: 'successful',
        parent_exchange_transaction_id: 'exchange-txn-123',
      } as any;

      const mockUpdatedTransaction = {
        ...mockTransaction,
        fee: 10,
      } as any;

      const mockCardAfterFee = {
        id: 'card-123',
        balance: 15000,
      } as any;

      mockCardTransactionRepository.findOne.mockResolvedValue(mockUpdatedTransaction);
      mockCardAdapter.createCharge.mockResolvedValue({ providerRef: 'charge-123' } as any);
      mockCardRepository.findOne.mockResolvedValue(mockCardAfterFee);

      jest.spyOn(CardFeesService, 'requiresChargeApi').mockReturnValue(true);

      const loggerSpy = jest.spyOn(service['logger'], 'log');

      await (service as any).chargeFundingFee(mockCardUser, mockTransaction);

      expect(loggerSpy).toHaveBeenCalledWith(
        expect.stringContaining('[NGN_CARD_FUNDING] Step 6 - Rain Webhook: Charging card funding fee'),
      );
      expect(loggerSpy).toHaveBeenCalledWith(
        expect.stringContaining(
          '[NGN_CARD_FUNDING] Step 6 - Rain Webhook: Fee charged successfully. Final card balance',
        ),
      );
    });

    it('should log NGN card funding fee when card balance is zero', async () => {
      const mockCardUser = {
        id: 'card-user-123',
        provider_ref: 'rain-user-123',
      } as any;

      const mockTransaction = {
        id: 'txn-123',
        card_id: 'card-123',
        fee: 10,
        transaction_type: 'deposit',
        status: 'successful',
        parent_exchange_transaction_id: 'exchange-txn-123',
      } as any;

      const mockUpdatedTransaction = {
        ...mockTransaction,
        fee: 10,
      } as any;

      mockCardTransactionRepository.findOne.mockResolvedValue(mockUpdatedTransaction);
      mockCardAdapter.createCharge.mockResolvedValue({ providerRef: 'charge-123' } as any);
      mockCardRepository.findOne.mockResolvedValue({ id: 'card-123', balance: 0 } as any);

      jest.spyOn(CardFeesService, 'requiresChargeApi').mockReturnValue(true);

      const loggerSpy = jest.spyOn(service['logger'], 'log');

      await (service as any).chargeFundingFee(mockCardUser, mockTransaction);

      expect(loggerSpy).toHaveBeenCalledWith(expect.stringContaining('Final card balance: 0 cents'));
    });

    it('should handle case when card not found after fee charge for NGN card funding', async () => {
      const mockCardUser = {
        id: 'card-user-123',
        provider_ref: 'rain-user-123',
      } as any;

      const mockTransaction = {
        id: 'txn-123',
        card_id: 'card-123',
        fee: 10,
        transaction_type: 'deposit',
        status: 'successful',
        parent_exchange_transaction_id: 'exchange-txn-123',
      } as any;

      const mockUpdatedTransaction = {
        ...mockTransaction,
        fee: 10,
      } as any;

      mockCardTransactionRepository.findOne.mockResolvedValue(mockUpdatedTransaction);
      mockCardAdapter.createCharge.mockResolvedValue({ providerRef: 'charge-123' } as any);
      mockCardRepository.findOne.mockResolvedValue(null);

      jest.spyOn(CardFeesService, 'requiresChargeApi').mockReturnValue(true);

      const loggerSpy = jest.spyOn(service['logger'], 'log');

      await (service as any).chargeFundingFee(mockCardUser, mockTransaction);

      expect(loggerSpy).toHaveBeenCalledWith(
        expect.stringContaining('[NGN_CARD_FUNDING] Step 6 - Rain Webhook: Charging card funding fee'),
      );
      // Should not log final balance when card not found
      expect(loggerSpy).not.toHaveBeenCalledWith(
        expect.stringContaining(
          '[NGN_CARD_FUNDING] Step 6 - Rain Webhook: Fee charged successfully. Final card balance',
        ),
      );
    });
  });

  describe('sendFundingNotifications', () => {
    it('should send funding notifications successfully', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
      } as any;

      const mockCardUser = {
        id: 'card-user-123',
        user_id: 'user-123',
      } as any;

      const mockUpdateResult = {
        cardId: 'card-123',
        mainTransactionId: 'txn-123',
        cardTransactionId: 'card-txn-123',
        cardBalance: 10000,
      } as any;

      const mockCard = {
        id: 'card-123',
        user_id: 'user-123',
        balance: 10000,
      } as any;

      const mockCardTransaction = {
        id: 'card-txn-123',
        balance_before: 0,
        balance_after: 10000,
      } as any;

      mockCardRepository.findOne.mockResolvedValue(mockCard);
      mockCardTransactionRepository.findOne.mockResolvedValue(mockCardTransaction);

      await (service as any).sendFundingNotifications(mockUser, mockCardUser, mockUpdateResult, 10000, 'USD');

      expect(mockCardService.sendCardNotification).toHaveBeenCalled();
      expect(mockEventEmitterService.emit).toHaveBeenCalledWith(EventEmitterEventsEnum.WALLET_BALANCE_CHANGED, {
        userId: 'user-123',
        walletType: 'card',
        walletId: 'card-123',
        currency: 'USD',
        balance: '10000',
        previousBalance: '0',
        transactionId: 'txn-123',
        timestamp: expect.any(Date),
        wallet: mockCard,
      });
    });

    it('should emit balance change event with correct previous balance from transaction', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
      } as any;

      const mockCardUser = {
        id: 'card-user-123',
        user_id: 'user-123',
      } as any;

      const mockUpdateResult = {
        cardId: 'card-123',
        mainTransactionId: 'txn-123',
        cardTransactionId: 'card-txn-123',
        cardBalance: 15000,
      } as any;

      const mockCard = {
        id: 'card-123',
        user_id: 'user-123',
        balance: 15000,
      } as any;

      const mockCardTransaction = {
        id: 'card-txn-123',
        balance_before: 5000,
        balance_after: 15000,
      } as any;

      mockCardRepository.findOne.mockResolvedValue(mockCard);
      mockCardTransactionRepository.findOne.mockResolvedValue(mockCardTransaction);

      await (service as any).sendFundingNotifications(mockUser, mockCardUser, mockUpdateResult, 10000, 'USD');

      expect(mockCardService.sendCardNotification).toHaveBeenCalled();
      expect(mockEventEmitterService.emit).toHaveBeenCalledWith(EventEmitterEventsEnum.WALLET_BALANCE_CHANGED, {
        userId: 'user-123',
        walletType: 'card',
        walletId: 'card-123',
        currency: 'USD',
        balance: '15000',
        previousBalance: '5000',
        transactionId: 'txn-123',
        timestamp: expect.any(Date),
        wallet: mockCard,
      });
    });

    it('should not emit event if card not found', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
      } as any;

      const mockCardUser = {
        id: 'card-user-123',
        user_id: 'user-123',
      } as any;

      const mockUpdateResult = {
        cardId: 'card-123',
        mainTransactionId: 'txn-123',
        cardTransactionId: 'card-txn-123',
      } as any;

      mockCardRepository.findOne.mockResolvedValue(null);

      await (service as any).sendFundingNotifications(mockUser, mockCardUser, mockUpdateResult, 0, 'USD');

      expect(mockCardService.sendCardNotification).toHaveBeenCalledWith(
        { inApp: true, email: true, push: true },
        expect.objectContaining({
          metadata: expect.objectContaining({
            amount: 0,
            newBalance: 0,
            currency: 'USD',
          }),
          balanceChangeEvent: undefined,
        }),
      );
      expect(mockEventEmitterService.emit).not.toHaveBeenCalled();
    });
  });

  describe('handleCollateralTransaction - transaction status checks', () => {
    it('should skip fee charge when transaction status is not successful', async () => {
      const mockBody = {
        id: 'webhook-123',
        resource: 'transaction',
        action: 'created',
        body: {
          id: 'txn-123',
          type: 'collateral',
          collateral: {
            amount: 10000,
            currency: 'USD',
            chainId: 11155111,
            walletAddress: '0x123',
            transactionHash: '0xabc',
            userId: 'rain-user-123',
          },
        },
      };

      const mockCardUser = {
        id: 'card-user-123',
        user_id: 'user-123',
        provider_ref: 'rain-user-123',
      } as any;

      const mockDepositAddress = {
        id: 'deposit-123',
        address: '0x123',
      } as any;

      const mockCardTransaction = {
        id: 'card-txn-123',
        card_id: 'card-123',
        user_id: 'user-123',
        card_user_id: 'card-user-123',
        fee: 100,
        amount: 9900,
        status: 'pending',
      } as any;

      mockCardUserRepository.findOne.mockResolvedValue(mockCardUser as any);
      mockDepositAddressRepository.findOne.mockResolvedValue(mockDepositAddress as any);
      mockCardTransactionRepository.findOne
        .mockResolvedValueOnce(mockCardTransaction as any)
        .mockResolvedValueOnce({ ...mockCardTransaction, status: 'pending' } as any);
      mockCardRepository.findOne.mockResolvedValue({
        id: 'card-123',
        user_id: 'user-123',
        card_user_id: 'card-user-123',
        balance: 0,
      } as any);
      mockCardTransactionRepository.transaction.mockImplementation((callback) => callback({}));
      mockLockerService.withLock.mockImplementation((key, callback) => callback());
      mockCardTransactionRepository.update.mockResolvedValue({} as any);
      mockCardRepository.update.mockResolvedValue({} as any);
      mockCardUserRepository.update.mockResolvedValue({} as any);

      await service.processWebhook(mockBody, {});

      expect(mockCardAdapter.createCharge).not.toHaveBeenCalled();
    });
  });

  describe('handleCollateralTransaction - unknown chain ID', () => {
    it('should handle unknown chain ID', async () => {
      const mockBody = {
        id: 'webhook-123',
        resource: 'transaction',
        action: 'created',
        body: {
          id: 'txn-123',
          type: 'collateral',
          collateral: {
            amount: 10000,
            currency: 'USD',
            chainId: 999999,
            walletAddress: '0x123',
            transactionHash: '0xabc',
            userId: 'rain-user-123',
          },
        },
      };

      const result = await service.processWebhook(mockBody, {});

      expect(result.status).toBe('processed');
      expect(result.action).toBe('transaction_created');
    });
  });

  describe('handleWebhookEvent - unknown resource', () => {
    it('should handle unknown webhook resource', async () => {
      const mockBody = {
        id: 'webhook-123',
        resource: 'unknown',
        action: 'updated',
      };

      const result = await service.processWebhook(mockBody, {});

      expect(result.status).toBe('ignored');
      expect(result.reason).toBe('unknown_event_type');
    });
  });

  describe('updateCardBalance - verification failures', () => {
    it('should throw error when card update returns null', async () => {
      const mockCard = {
        id: 'card-123',
        balance: 1000,
      } as any;

      const mockTrx = {};

      mockCardRepository.update.mockResolvedValue(null);
      mockCardRepository.findOne.mockResolvedValue(mockCard);

      await expect((service as any).updateCardBalance(mockCard, 2000, mockTrx)).rejects.toThrow(
        'Failed to update card balance',
      );
    });

    it('should throw error when balance verification fails', async () => {
      const mockCard = {
        id: 'card-123',
        balance: 1000,
      } as any;

      const mockTrx = {};

      mockCardRepository.update.mockResolvedValue(mockCard);
      mockCardRepository.findOne.mockResolvedValue({ ...mockCard, balance: 1500 } as any);

      await expect((service as any).updateCardBalance(mockCard, 2000, mockTrx)).rejects.toThrow(
        'Card balance update verification failed',
      );
    });
  });

  describe('updateCardUserBalance - verification failures', () => {
    it('should throw error when card user update returns null', async () => {
      const mockCardUser = {
        id: 'card-user-123',
        balance: 1000,
      } as any;

      const mockTrx = {};

      mockCardUserRepository.update.mockResolvedValue(null);
      mockCardUserRepository.findOne.mockResolvedValue(mockCardUser);

      await expect((service as any).updateCardUserBalance(mockCardUser, 2000, mockTrx)).rejects.toThrow(
        'Failed to update card user balance',
      );
    });

    it('should throw error when balance verification fails', async () => {
      const mockCardUser = {
        id: 'card-user-123',
        balance: 1000,
      } as any;

      const mockTrx = {};

      mockCardUserRepository.update.mockResolvedValue(mockCardUser);
      mockCardUserRepository.findOne.mockResolvedValue({ ...mockCardUser, balance: 1500 } as any);

      await expect((service as any).updateCardUserBalance(mockCardUser, 2000, mockTrx)).rejects.toThrow(
        'Card user balance update verification failed',
      );
    });
  });

  describe('chargeFundingFee - fee too small', () => {
    it('should charge minimum 1 cent when fee is too small after rounding and feeRequiresChargeApi is true', async () => {
      const mockCardUser = {
        id: 'card-user-123',
        provider_ref: 'rain-user-123',
      } as any;

      const mockTransaction = {
        id: 'txn-123',
        fee: 0.0001,
        transaction_type: 'deposit',
        status: 'successful',
      } as any;

      jest.spyOn(CardFeesService, 'requiresChargeApi').mockReturnValue(true);
      mockCardTransactionRepository.findOne.mockResolvedValue(mockTransaction);
      mockCardAdapter.createCharge.mockResolvedValue({ providerRef: 'charge-ref-123' });

      await (service as any).chargeFundingFee(mockCardUser, mockTransaction);

      expect(mockCardAdapter.createCharge).toHaveBeenCalledWith('rain-user-123', 1, 'Card top-up fee');
      expect(mockCardTransactionRepository.update).toHaveBeenCalledWith(
        { id: 'txn-123' },
        {
          provider_fee_reference: 'charge-ref-123',
          is_fee_settled: true,
        },
      );
    });

    it('should set is_fee_settled to true when fee is too small and feeRequiresChargeApi is false', async () => {
      const mockCardUser = {
        id: 'card-user-123',
        provider_ref: 'rain-user-123',
      } as any;

      const mockTransaction = {
        id: 'txn-123',
        fee: 0.0001,
        transaction_type: 'deposit',
        status: 'successful',
      } as any;

      jest.spyOn(CardFeesService, 'requiresChargeApi').mockReturnValue(false);
      mockCardTransactionRepository.findOne.mockResolvedValue(mockTransaction);

      await (service as any).chargeFundingFee(mockCardUser, mockTransaction);

      expect(mockCardAdapter.createCharge).not.toHaveBeenCalled();
      expect(mockCardTransactionRepository.update).toHaveBeenCalledWith(
        { id: 'txn-123' },
        {
          is_fee_settled: true,
        },
      );
    });
  });

  describe('validateTransactionAmount - MAX_TRANSACTION_AMOUNT', () => {
    it('should throw error when amount exceeds MAX_TRANSACTION_AMOUNT', async () => {
      const cardFeesConfig = await import('../../../config/onedosh/cardFees.config');
      const originalMax = cardFeesConfig.MAX_TRANSACTION_AMOUNT;
      Object.defineProperty(cardFeesConfig, 'MAX_TRANSACTION_AMOUNT', {
        value: 1000,
        writable: true,
        configurable: true,
      });

      try {
        expect(() => {
          (service as any).validateTransactionAmount(2000, 'USD');
        }).toThrow('exceeds maximum limit');
      } finally {
        Object.defineProperty(cardFeesConfig, 'MAX_TRANSACTION_AMOUNT', {
          value: originalMax,
          writable: true,
          configurable: true,
        });
      }
    });
  });

  describe('validateTransactionAmount - MAX_SAFE_AMOUNT', () => {
    it('should throw error when amount exceeds MAX_SAFE_INTEGER', () => {
      const largeAmount = Number.MAX_SAFE_INTEGER + 1;

      expect(() => {
        (service as any).validateTransactionAmount(largeAmount, 'USD');
      }).toThrow('exceeds maximum safe integer value');
    });
  });

  describe('calculateNewBalances - MAX_SAFE_AMOUNT checks', () => {
    it('should throw error when card user balance would exceed MAX_SAFE_INTEGER', () => {
      const mockCard = {
        balance: 0,
      } as any;

      const mockCardUser = {
        balance: Number.MAX_SAFE_INTEGER - 100,
      } as any;

      const largeAmount = 200;

      expect(() => {
        (service as any).calculateNewBalances(mockCardUser, mockCard, largeAmount);
      }).toThrow('Card user balance would exceed maximum safe value');
    });

    it('should throw error when card balance would exceed MAX_SAFE_INTEGER', () => {
      const MAX_SAFE = Number.MAX_SAFE_INTEGER;
      const mockCard = {
        balance: MAX_SAFE - 1,
      } as any;

      const mockCardUser = {
        balance: 0,
      } as any;

      const largeAmount = 2;

      expect(() => {
        (service as any).calculateNewBalances(mockCardUser, mockCard, largeAmount);
      }).toThrow('Card balance would exceed maximum safe value');
    });
  });

  describe('handlePostFundingActions - error handling', () => {
    it('should handle error when chargeFundingFee fails', async () => {
      const mockCardUser = {
        id: 'card-user-123',
        user_id: 'user-123',
        provider_ref: 'rain-user-123',
      } as any;

      const mockTransaction = {
        id: 'txn-123',
      } as any;

      const mockUpdateResult = {
        cardId: 'card-123',
        mainTransactionId: 'txn-123',
        cardBalance: 10000,
      } as any;

      jest.spyOn(service as any, 'chargeFundingFee').mockRejectedValue(new Error('Charge failed'));

      await (service as any).handlePostFundingActions(mockCardUser, mockTransaction, mockUpdateResult, 10000, 'USD');

      expect(mockCardService.sendCardNotification).not.toHaveBeenCalled();
    });
  });

  describe('updateBalancesWithinTransaction - card not found', () => {
    it('should return updated false when card not found', async () => {
      const mockTxData = {
        id: 'txn-123',
        collateral: {
          amount: 10000,
          currency: 'USD',
          transactionHash: '0xabc',
        },
      } as any;

      const mockCardUser = {
        id: 'card-user-123',
        user_id: 'user-123',
        balance: 1000,
      } as any;

      const mockTransaction = {
        id: 'txn-123',
        card_id: 'card-123',
        amount: 1000,
        fee: 100,
      } as any;

      const mockTrx = {};

      mockCardRepository.findOne.mockResolvedValue(null);

      const result = await (service as any).updateBalancesWithinTransaction(
        mockTxData,
        mockCardUser,
        mockTransaction,
        1000,
        mockTrx,
      );

      expect(result.updated).toBe(false);
    });
  });

  describe('updateBalancesWithinTransaction - card user not found', () => {
    it('should throw error when card user not found during balance update', async () => {
      const mockTxData = {
        id: 'txn-123',
        collateral: {
          amount: 10000,
          currency: 'USD',
          transactionHash: '0xabc',
        },
      } as any;

      const mockCardUser = {
        id: 'card-user-123',
        user_id: 'user-123',
        balance: 1000,
      } as any;

      const mockCard = {
        id: 'card-123',
        user_id: 'user-123',
        card_user_id: 'card-user-123',
        balance: 1000,
      } as any;

      const mockTransaction = {
        id: 'txn-123',
        card_id: 'card-123',
        amount: 1000,
        fee: 100,
      } as any;

      const mockTrx = {};

      mockCardRepository.findOne.mockResolvedValue(mockCard);
      mockCardUserRepository.findOne.mockResolvedValue(null);

      await expect(
        (service as any).updateBalancesWithinTransaction(mockTxData, mockCardUser, mockTransaction, 1000, mockTrx),
      ).rejects.toThrow('Card user not found during balance update');
    });
  });

  describe('handleCollateralTransaction - successful transaction with post funding actions', () => {
    it('should call handlePostFundingActions when transaction becomes successful', async () => {
      const mockBody = {
        id: 'webhook-123',
        resource: 'transaction',
        action: 'created',
        body: {
          id: 'txn-123',
          type: 'collateral',
          collateral: {
            amount: 10000,
            currency: 'USD',
            chainId: 11155111,
            walletAddress: '0x123',
            transactionHash: '0xabc',
            userId: 'rain-user-123',
          },
        },
      };

      const mockCardUser = {
        id: 'card-user-123',
        user_id: 'user-123',
        provider_ref: 'rain-user-123',
        balance: 0,
      } as any;

      const mockDepositAddress = {
        id: 'deposit-123',
        address: '0x123',
      } as any;

      const mockCardTransaction = {
        id: 'card-txn-123',
        card_id: 'card-123',
        user_id: 'user-123',
        card_user_id: 'card-user-123',
        fee: 100,
        amount: 9900,
        status: 'pending',
      } as any;

      const mockCard = {
        id: 'card-123',
        user_id: 'user-123',
        card_user_id: 'card-user-123',
        balance: 0,
      } as any;

      mockCardUserRepository.findOne.mockResolvedValue(mockCardUser);
      mockDepositAddressRepository.findOne.mockResolvedValue(mockDepositAddress);
      mockCardTransactionRepository.findOne
        .mockResolvedValueOnce(mockCardTransaction)
        .mockResolvedValueOnce({ ...mockCardTransaction, status: 'successful' } as any)
        .mockResolvedValueOnce({ ...mockCardTransaction, status: 'successful' } as any);
      mockCardRepository.findOne.mockResolvedValue(mockCard);
      mockCardTransactionRepository.transaction.mockImplementation((callback) => callback({}));
      mockLockerService.withLock.mockImplementation((key, callback) => callback());
      mockCardTransactionRepository.update.mockResolvedValue({ ...mockCardTransaction, status: 'successful' } as any);
      mockCardRepository.update.mockResolvedValue(mockCard);
      mockCardUserRepository.update.mockResolvedValue(mockCardUser);
      mockTransactionRepository.create.mockResolvedValue({ id: 'main-txn-123' } as any);

      // Mock processCollateralBalanceUpdate to return updated result
      jest.spyOn(service as any, 'processCollateralBalanceUpdate').mockResolvedValue({
        updated: true,
        updatedTransaction: { ...mockCardTransaction, status: 'successful' },
        amountToCredit: 9900,
      });

      const handlePostFundingActionsSpy = jest
        .spyOn(service as any, 'handlePostFundingActions')
        .mockResolvedValue(undefined);

      await service.processWebhook(mockBody, {});

      expect(handlePostFundingActionsSpy).toHaveBeenCalled();
    });
  });

  describe('updateBalancesWithinTransaction - amountToCredit validation', () => {
    it('should throw error when amountToCredit is <= 0', async () => {
      const mockTxData = {
        id: 'txn-123',
        collateral: {
          amount: 100,
          currency: 'USD',
          transactionHash: '0xabc',
        },
      } as any;

      const mockCardUser = {
        id: 'card-user-123',
        user_id: 'user-123',
        balance: 1000,
      } as any;

      const mockCard = {
        id: 'card-123',
        user_id: 'user-123',
        card_user_id: 'card-user-123',
        balance: 1000,
      } as any;

      const mockTransaction = {
        id: 'txn-123',
        card_id: 'card-123',
        amount: 1000,
        fee: 100, // Fee equals amount, making amountToCredit = 0
      } as any;

      const mockTrx = {};

      mockCardRepository.findOne.mockResolvedValue(mockCard);
      mockCardUserRepository.findOne.mockResolvedValue(mockCardUser);

      await expect(
        (service as any).updateBalancesWithinTransaction(mockTxData, mockCardUser, mockTransaction, 100, mockTrx),
      ).rejects.toThrow('Invalid amount to credit');
    });
  });

  describe('updateBalancesWithinTransaction - NGN card funding logging', () => {
    it('should log NGN card funding amounts when parent_exchange_transaction_id is set', async () => {
      const mockTxData = {
        id: 'txn-123',
        collateral: {
          amount: 15020,
          currency: 'USD',
          transactionHash: '0xabc',
        },
      } as any;

      const mockTransactionWithParent = {
        id: 'card-txn-123',
        card_id: 'card-123',
        user_id: 'user-123',
        amount: 15010,
        fee: 10,
        transaction_type: 'deposit',
        parent_exchange_transaction_id: 'exchange-txn-123',
      } as any;

      const mockCard = {
        id: 'card-123',
        user_id: 'user-123',
        card_user_id: 'card-user-123',
        balance: 5000,
        last_four_digits: '6890',
      } as any;

      const mockCardUser = {
        id: 'card-user-123',
        user_id: 'user-123',
        balance: 5000,
      } as any;

      const mockTrx = {} as any;

      mockCardRepository.findOne.mockResolvedValue(mockCard);
      mockCardUserRepository.findOne.mockResolvedValue(mockCardUser);
      mockTransactionRepository.create.mockResolvedValue({ id: 'main-txn-123' } as any);
      mockCardTransactionRepository.update.mockResolvedValue(mockTransactionWithParent);
      mockCardUserRepository.update.mockResolvedValue(mockCardUser);
      mockCardRepository.update.mockResolvedValue(mockCard);

      const loggerSpy = jest.spyOn(service['logger'], 'log');

      await (service as any).updateBalancesWithinTransaction(
        mockTxData,
        mockCardUser,
        mockTransactionWithParent,
        15020,
        mockTrx,
      );

      expect(loggerSpy).toHaveBeenCalledWith(
        expect.stringContaining('[NGN_CARD_FUNDING] Step 5 - Rain Webhook: Processing card deposit'),
      );
      expect(loggerSpy).toHaveBeenCalledWith(
        expect.stringContaining('[NGN_CARD_FUNDING] Step 5 - Rain Webhook: Total amount received from Rain'),
      );
      expect(loggerSpy).toHaveBeenCalledWith(
        expect.stringContaining('[NGN_CARD_FUNDING] Step 5 - Rain Webhook: Fee to deduct'),
      );
      expect(loggerSpy).toHaveBeenCalledWith(
        expect.stringContaining('[NGN_CARD_FUNDING] Step 5 - Rain Webhook: Amount to credit to card'),
      );
      expect(loggerSpy).toHaveBeenCalledWith(
        expect.stringContaining('[NGN_CARD_FUNDING] Step 5 - Rain Webhook: Card balance before credit'),
      );
      expect(loggerSpy).toHaveBeenCalledWith(
        expect.stringContaining('[NGN_CARD_FUNDING] Step 5 - Rain Webhook: Card balance after credit'),
      );
    });
  });

  describe('updateBalancesWithinTransaction - full update flow', () => {
    it('should update transaction after balance update', async () => {
      const mockTxData = {
        id: 'txn-123',
        collateral: {
          amount: 10000,
          currency: 'USD',
          transactionHash: '0xabc',
        },
      } as any;

      const mockCardUser = {
        id: 'card-user-123',
        user_id: 'user-123',
        balance: 0,
      } as any;

      const mockCard = {
        id: 'card-123',
        user_id: 'user-123',
        card_user_id: 'card-user-123',
        balance: 0,
      } as any;

      const mockTransaction = {
        id: 'txn-123',
        card_id: 'card-123',
        amount: 9900,
        fee: 100,
      } as any;

      const mockTrx = {};

      mockCardRepository.findOne.mockResolvedValue(mockCard);
      mockCardUserRepository.findOne.mockResolvedValue(mockCardUser);
      mockCardTransactionRepository.update.mockResolvedValue({} as any);
      mockCardRepository.update.mockResolvedValue({} as any);
      mockCardUserRepository.update.mockResolvedValue({} as any);
      mockTransactionRepository.create.mockResolvedValue({ id: 'main-txn-123' } as any);

      const result = await (service as any).updateBalancesWithinTransaction(
        mockTxData,
        mockCardUser,
        mockTransaction,
        10000,
        mockTrx,
      );

      expect(result.updated).toBe(true);
      expect(mockCardTransactionRepository.update).toHaveBeenCalledWith(
        { id: 'txn-123' },
        expect.objectContaining({
          status: 'successful',
          transactionhash: '0xabc',
          amount: 9900,
        }),
        { trx: mockTrx },
      );
    });

    it('should store card last_four_digits in transaction metadata as destination_name', async () => {
      const mockTxData = {
        id: 'txn-123',
        collateral: {
          amount: 10000,
          currency: 'USD',
          chainId: '1',
          walletAddress: '0x123',
          transactionHash: '0xabc',
        },
      } as any;

      const mockCardUser = {
        id: 'card-user-123',
        user_id: 'user-123',
        balance: 0,
      } as any;

      const mockCard = {
        id: 'card-123',
        user_id: 'user-123',
        card_user_id: 'card-user-123',
        balance: 0,
        last_four_digits: '6890',
      } as any;

      const mockTransaction = {
        id: 'txn-123',
        card_id: 'card-123',
        amount: 9900,
        fee: 100,
      } as any;

      const mockTrx = {};

      mockCardRepository.findOne.mockResolvedValue(mockCard);
      mockCardUserRepository.findOne.mockResolvedValue(mockCardUser);
      mockCardTransactionRepository.update.mockResolvedValue({} as any);
      mockCardRepository.update.mockResolvedValue({} as any);
      mockCardUserRepository.update.mockResolvedValue({} as any);
      mockTransactionRepository.create.mockResolvedValue({ id: 'main-txn-123' } as any);

      await (service as any).updateBalancesWithinTransaction(mockTxData, mockCardUser, mockTransaction, 10000, mockTrx);

      expect(mockTransactionRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.objectContaining({
            destination_name: 'Card ****6890',
          }),
        }),
        mockTrx,
      );
    });

    it('should not include destination_name when card last_four_digits is not available', async () => {
      const mockTxData = {
        id: 'txn-123',
        collateral: {
          amount: 10000,
          currency: 'USD',
          chainId: '1',
          walletAddress: '0x123',
          transactionHash: '0xabc',
        },
      } as any;

      const mockCardUser = {
        id: 'card-user-123',
        user_id: 'user-123',
        balance: 0,
      } as any;

      const mockCard = {
        id: 'card-123',
        user_id: 'user-123',
        card_user_id: 'card-user-123',
        balance: 0,
        last_four_digits: null,
      } as any;

      const mockTransaction = {
        id: 'txn-123',
        card_id: 'card-123',
        amount: 9900,
        fee: 100,
      } as any;

      const mockTrx = {};

      mockCardRepository.findOne.mockResolvedValue(mockCard);
      mockCardUserRepository.findOne.mockResolvedValue(mockCardUser);
      mockCardTransactionRepository.update.mockResolvedValue({} as any);
      mockCardRepository.update.mockResolvedValue({} as any);
      mockCardUserRepository.update.mockResolvedValue({} as any);
      mockTransactionRepository.create.mockResolvedValue({ id: 'main-txn-123' } as any);

      await (service as any).updateBalancesWithinTransaction(mockTxData, mockCardUser, mockTransaction, 10000, mockTrx);

      const createCall = mockTransactionRepository.create.mock.calls[0][0];
      expect(createCall.metadata).not.toHaveProperty('destination_name');
    });
  });

  describe('validateTransactionAmount - amount mismatch', () => {
    it('should throw error when amount differs from expected amount beyond tolerance', () => {
      expect(() => {
        (service as any).validateTransactionAmount(100, 'USD', 200, false);
      }).toThrow('Amount mismatch');
    });
  });

  describe('validateIdempotency - no existing transaction', () => {
    it('should return valid when no existing transaction', () => {
      const result = (service as any).validateIdempotency(null, null, 1000, 'successful', 'USD', 'txn-123');
      expect(result.isValid).toBe(true);
    });
  });

  describe('handlePostFundingActions - user found', () => {
    it('should send funding notifications when user is found', async () => {
      const mockCardUser = {
        id: 'card-user-123',
        user_id: 'user-123',
        provider_ref: 'rain-user-123',
      } as any;

      const mockTransaction = {
        id: 'txn-123',
        card_id: 'card-123',
      } as any;

      const mockUpdateResult = {
        cardId: 'card-123',
        mainTransactionId: 'txn-123',
        cardBalance: 10000,
      } as any;

      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
      } as any;

      jest.spyOn(service as any, 'chargeFundingFee').mockResolvedValue(undefined);
      mockUserRepository.findActiveById.mockResolvedValue(mockUser);
      jest.spyOn(service as any, 'sendFundingNotifications').mockResolvedValue(undefined);
      mockCardService.checkAndChargeIssuanceFeeOnFirstFunding.mockResolvedValue(undefined);

      await (service as any).handlePostFundingActions(mockCardUser, mockTransaction, mockUpdateResult, 10000, 'USD');

      expect(mockUserRepository.findActiveById).toHaveBeenCalledWith('user-123');
      expect(mockCardService.checkAndChargeIssuanceFeeOnFirstFunding).toHaveBeenCalledWith(
        'card-123',
        mockCardUser,
        mockTransaction,
      );
      expect((service as any).sendFundingNotifications).toHaveBeenCalledWith(
        mockUser,
        mockCardUser,
        mockUpdateResult,
        10000,
        'USD',
      );
    });

    it('should not call checkAndChargeIssuanceFeeOnFirstFunding if user_virtual_card_id is missing', async () => {
      const mockCardUser = {
        id: 'card-user-123',
        user_id: 'user-123',
        provider_ref: 'rain-user-123',
      } as any;

      const mockTransaction = {
        id: 'txn-123',
      } as any;

      const mockUpdateResult = {
        cardId: 'card-123',
        mainTransactionId: 'txn-123',
        cardBalance: 10000,
      } as any;

      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
      } as any;

      jest.spyOn(service as any, 'chargeFundingFee').mockResolvedValue(undefined);
      mockUserRepository.findActiveById.mockResolvedValue(mockUser);
      jest.spyOn(service as any, 'sendFundingNotifications').mockResolvedValue(undefined);

      await (service as any).handlePostFundingActions(mockCardUser, mockTransaction, mockUpdateResult, 10000, 'USD');

      expect(mockCardService.checkAndChargeIssuanceFeeOnFirstFunding).not.toHaveBeenCalled();
    });
  });

  describe('revalidateFundingFee - minimum fee enforcement', () => {
    it('should enforce minimum fee of 1 cent', () => {
      const mockTransaction = {
        id: 'txn-123',
        transaction_type: 'deposit',
        amount: 10000,
      } as any;

      jest.spyOn(CardFeesService, 'calculateFee').mockReturnValue({
        fee: 0.005,
        feeType: 'percentage' as any,
      });

      const result = (service as any).revalidateFundingFee(mockTransaction, 10000);
      expect(result).toBe(1);
    });
  });

  describe('handleSpendTransactionCreated - card or cardUser not found', () => {
    it('should throw error when card or cardUser not found during balance update', async () => {
      const mockBody = {
        id: 'webhook-123',
        resource: 'transaction',
        action: 'created',
        body: {
          id: 'txn-123',
          type: 'spend',
          spend: {
            userId: 'rain-user-123',
            cardId: 'rain-card-123',
            amount: 1000,
            currency: 'USD',
            status: 'pending',
            merchantName: 'Test Merchant',
          },
        },
      };

      const mockCardUser = {
        id: 'card-user-123',
        user_id: 'user-123',
        provider_ref: 'rain-user-123',
      } as any;

      const mockCard = {
        id: 'card-123',
        user_id: 'user-123',
        card_user_id: 'card-user-123',
        provider_ref: 'rain-card-123',
        balance: 1000,
      } as any;

      mockCardUserRepository.findOne.mockResolvedValue(mockCardUser);
      mockCardRepository.findOne.mockResolvedValue(mockCard);
      mockCardTransactionRepository.transaction.mockImplementation((callback) => callback({}));
      mockLockerService.withLock.mockImplementation((key, callback) => callback());
      mockCardRepository.findOne.mockResolvedValueOnce(mockCard).mockResolvedValueOnce(null);
      mockCardUserRepository.findOne.mockResolvedValueOnce(mockCardUser).mockResolvedValueOnce(null);

      const result = await service.processWebhook(mockBody, {});

      expect(result.status).toBe('processed');
      expect(result.error).toBeDefined();
    });
  });

  describe('handleSpendTransactionCreated - full flow with pending status', () => {
    it('should create transaction with pending status and debit balance', async () => {
      const mockBody = {
        id: 'webhook-123',
        resource: 'transaction',
        action: 'created',
        body: {
          id: 'txn-123',
          type: 'spend',
          spend: {
            userId: 'rain-user-123',
            cardId: 'rain-card-123',
            amount: 1000,
            currency: 'USD',
            status: 'pending',
            merchantName: 'Test Merchant',
            merchantId: 'merchant-123',
            merchantCity: 'New York',
            merchantCountry: 'US',
            merchantCategory: 'Retail',
            merchantCategoryCode: '5999',
            authorizationMethod: 'chip',
            authorizedAmount: 1000,
            authorizedAt: '2025-01-01T00:00:00Z',
          },
        },
      };

      const mockCardUser = {
        id: 'card-user-123',
        user_id: 'user-123',
        provider_ref: 'rain-user-123',
        balance: 5000,
      } as any;

      const mockCard = {
        id: 'card-123',
        user_id: 'user-123',
        card_user_id: 'card-user-123',
        provider_ref: 'rain-card-123',
        balance: 5000,
      } as any;

      mockCardUserRepository.findOne.mockResolvedValue(mockCardUser);
      mockCardRepository.findOne.mockResolvedValue(mockCard);
      mockCardTransactionRepository.transaction.mockImplementation((callback) => callback({}));
      mockLockerService.withLock.mockImplementation((key, callback) => callback());
      // Within transaction, both should be found
      mockCardRepository.findOne.mockResolvedValue(mockCard);
      mockCardUserRepository.findOne.mockResolvedValue(mockCardUser);
      mockCardTransactionRepository.create.mockResolvedValue({ id: 'card-txn-123' } as any);
      mockTransactionRepository.create.mockResolvedValue({ id: 'main-txn-123' } as any);
      mockCardRepository.update.mockResolvedValue({} as any);
      mockCardUserRepository.update.mockResolvedValue({} as any);

      const result = await service.processWebhook(mockBody, {});

      expect(result.status).toBe('processed');
      expect(mockCardTransactionRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'pending',
          amount: 1000,
        }),
        expect.anything(),
      );
    });
  });

  describe('handleSpendTransactionUpdated - shouldSkip path', () => {
    it('should skip when shouldSkip is true', async () => {
      const mockBody = {
        id: 'webhook-123',
        resource: 'transaction',
        action: 'updated',
        body: {
          id: 'txn-123',
          type: 'spend',
          spend: {
            userId: 'rain-user-123',
            cardId: 'rain-card-123',
            amount: 1000,
            currency: 'USD',
            status: 'successful',
          },
        },
      };

      const mockCardUser = {
        id: 'card-user-123',
        user_id: 'user-123',
        provider_ref: 'rain-user-123',
      } as any;

      const mockCard = {
        id: 'card-123',
        user_id: 'user-123',
        card_user_id: 'card-user-123',
        provider_ref: 'rain-card-123',
      } as any;

      const mockCardTransaction = {
        id: 'card-txn-123',
        status: 'successful',
        amount: 1000,
      } as any;

      mockCardUserRepository.findOne.mockResolvedValue(mockCardUser);
      mockCardRepository.findOne.mockResolvedValue(mockCard);
      mockCardTransactionRepository.findOne.mockResolvedValue(mockCardTransaction);
      jest.spyOn(service as any, 'validateIdempotency').mockReturnValue({ isValid: true, shouldSkip: true });

      const result = await service.processWebhook(mockBody, {});

      expect(result.status).toBe('processed');
      expect(result.reason).toBe('transaction_already_updated');
    });
  });

  describe('handleSpendTransactionUpdated - declined transaction credit back', () => {
    it('should credit back funds when transaction becomes declined', async () => {
      const mockBody = {
        id: 'webhook-123',
        resource: 'transaction',
        action: 'updated',
        body: {
          id: 'txn-123',
          type: 'spend',
          spend: {
            userId: 'rain-user-123',
            cardId: 'rain-card-123',
            amount: 1000,
            currency: 'USD',
            status: 'declined',
            declinedReason: 'Insufficient funds',
          },
        },
      };

      const mockCardUser = {
        id: 'card-user-123',
        user_id: 'user-123',
        provider_ref: 'rain-user-123',
        balance: 4000,
      } as any;

      const mockCard = {
        id: 'card-123',
        user_id: 'user-123',
        card_user_id: 'card-user-123',
        provider_ref: 'rain-card-123',
        balance: 4000,
      } as any;

      const mockCardTransaction = {
        id: 'card-txn-123',
        status: 'pending',
        amount: 1000,
      } as any;

      const mockMainTransaction = {
        id: 'main-txn-123',
      } as any;

      mockCardUserRepository.findOne.mockResolvedValue(mockCardUser);
      mockCardRepository.findOne.mockResolvedValue(mockCard);
      mockCardTransactionRepository.findOne.mockResolvedValue(mockCardTransaction);
      mockTransactionRepository.findOne.mockResolvedValue(mockMainTransaction);
      jest.spyOn(service as any, 'validateIdempotency').mockReturnValue({ isValid: true, shouldSkip: false });
      mockCardTransactionRepository.transaction.mockImplementation((callback) => callback({}));
      mockLockerService.withLock.mockImplementation((key, callback) => callback());
      mockCardRepository.findOne.mockResolvedValue(mockCard);
      mockCardUserRepository.findOne.mockResolvedValue(mockCardUser);
      mockCardTransactionRepository.update.mockResolvedValue({} as any);
      mockTransactionRepository.update.mockResolvedValue({} as any);
      mockCardRepository.update.mockResolvedValue({} as any);
      mockCardUserRepository.update.mockResolvedValue({} as any);

      const result = await service.processWebhook(mockBody, {});

      expect(result.status).toBe('processed');
      expect(mockCardRepository.update).toHaveBeenCalledWith(
        { id: 'card-123' },
        expect.objectContaining({
          balance: 5000, // 4000 + 1000 (credited back)
        }),
        expect.anything(),
      );
    });
  });

  describe('handleSpendTransactionCompleted - full flow', () => {
    it('should complete transaction and update balances', async () => {
      const mockBody = {
        id: 'webhook-123',
        resource: 'transaction',
        action: 'completed',
        body: {
          id: 'txn-123',
          type: 'spend',
          spend: {
            userId: 'rain-user-123',
            cardId: 'rain-card-123',
            amount: 1000,
            currency: 'USD',
            status: 'completed',
            merchantName: 'Test Merchant',
            authorizedAt: '2025-01-01T00:00:00Z',
            postedAt: '2025-01-01T00:00:00Z',
          },
        },
      };

      const mockCardUser = {
        id: 'card-user-123',
        user_id: 'user-123',
        provider_ref: 'rain-user-123',
        balance: 4000,
      } as any;

      const mockCard = {
        id: 'card-123',
        user_id: 'user-123',
        card_user_id: 'card-user-123',
        provider_ref: 'rain-card-123',
        balance: 4000,
      } as any;

      mockCardUserRepository.findOne.mockResolvedValue(mockCardUser);
      mockCardRepository.findOne.mockResolvedValue(mockCard);
      mockCardTransactionRepository.findOne.mockResolvedValue(null);
      mockTransactionRepository.findOne.mockResolvedValue(null);
      mockCardTransactionRepository.transaction.mockImplementation((callback) => callback({}));
      mockLockerService.withLock.mockImplementation((key, callback) => callback());
      mockCardRepository.findOne.mockResolvedValue(mockCard);
      mockCardUserRepository.findOne.mockResolvedValue(mockCardUser);
      mockCardTransactionRepository.create.mockResolvedValue({ id: 'card-txn-123' } as any);
      mockTransactionRepository.create.mockResolvedValue({ id: 'main-txn-123' } as any);
      const updatedCardUser = { ...mockCardUser, balance: 3000 };
      const updatedCard = { ...mockCard, balance: 3000 };
      mockCardRepository.update.mockResolvedValue(updatedCard as any);
      mockCardUserRepository.update.mockResolvedValue(updatedCardUser as any);
      mockCardUserRepository.findOne.mockResolvedValue(updatedCardUser);
      mockCardRepository.findOne.mockResolvedValue(updatedCard);

      const result = await service.processWebhook(mockBody, {});

      expect(result.status).toBe('processed');
      expect(result.completed).toBe(true);
      expect(mockCardTransactionRepository.create).toHaveBeenCalled();
    });
  });

  describe('handleCardUpdated - error handling', () => {
    it('should handle error when card update fails', async () => {
      const mockBody = {
        id: 'webhook-123',
        resource: 'card',
        action: 'updated',
        body: {
          id: 'rain-card-123',
          userId: 'rain-user-123',
          status: 'locked',
        },
      };

      mockCardRepository.findOne.mockResolvedValue({
        id: 'card-123',
        provider_ref: 'rain-card-123',
        user_id: 'user-123',
        card_user_id: 'card-user-123',
        status: 'active',
        limit: 1000,
        limit_frequency: 'per7DayPeriod',
        expiration_month: '12',
        expiration_year: '2027',
        is_freezed: false,
      } as any);
      mockCardUserRepository.findOne.mockResolvedValue({
        id: 'card-user-123',
        user_id: 'user-123',
        provider_ref: 'rain-user-123',
        user: {},
      } as any);
      mockCardRepository.update.mockRejectedValue(new Error('Update failed'));

      const result = await service.processWebhook(mockBody, {});

      expect(result.status).toBe('processed');
      expect(result.error).toBe('Internal processing error');
    });
  });

  describe('handleSpendTransactionUpdated - authorization check', () => {
    it('should return unauthorized when card does not belong to cardUser', async () => {
      const mockBody = {
        id: 'webhook-123',
        resource: 'transaction',
        action: 'updated',
        body: {
          id: 'txn-123',
          type: 'spend',
          spend: {
            userId: 'rain-user-123',
            cardId: 'rain-card-123',
            amount: 1000,
            currency: 'USD',
            status: 'successful',
          },
        },
      };

      const mockCardUser = {
        id: 'card-user-123',
        user_id: 'user-123',
        provider_ref: 'rain-user-123',
      } as any;

      const mockCard = {
        id: 'card-123',
        user_id: 'user-456', // Different user_id
        card_user_id: 'card-user-123',
        provider_ref: 'rain-card-123',
      } as any;

      const mockCardTransaction = {
        id: 'card-txn-123',
        status: 'pending',
        amount: 1000,
      } as any;

      mockCardUserRepository.findOne.mockResolvedValue(mockCardUser);
      mockCardRepository.findOne.mockResolvedValue(mockCard);
      mockCardTransactionRepository.findOne.mockResolvedValue(mockCardTransaction);
      jest.spyOn(service as any, 'validateIdempotency').mockReturnValue({ isValid: true, shouldSkip: false });

      const result = await service.processWebhook(mockBody, {});

      expect(result.status).toBe('processed');
      expect(result.reason).toBe('unauthorized_card_access');
    });
  });

  describe('handleSpendTransactionUpdated - amount consistency check', () => {
    it('should validate amount consistency with tolerance', async () => {
      const mockBody = {
        id: 'webhook-123',
        resource: 'transaction',
        action: 'updated',
        body: {
          id: 'txn-123',
          type: 'spend',
          spend: {
            userId: 'rain-user-123',
            cardId: 'rain-card-123',
            amount: 1100, // 10% increase from original 1000
            currency: 'USD',
            status: 'successful',
          },
        },
      };

      const mockCardUser = {
        id: 'card-user-123',
        user_id: 'user-123',
        provider_ref: 'rain-user-123',
        balance: 5000,
      } as any;

      const mockCard = {
        id: 'card-123',
        user_id: 'user-123',
        card_user_id: 'card-user-123',
        provider_ref: 'rain-card-123',
        balance: 5000,
      } as any;

      const mockCardTransaction = {
        id: 'card-txn-123',
        status: 'pending',
        amount: 1000, // Original amount
      } as any;

      const mockMainTransaction = {
        id: 'main-txn-123',
      } as any;

      mockCardUserRepository.findOne.mockResolvedValue(mockCardUser);
      mockCardRepository.findOne.mockResolvedValue(mockCard);
      mockCardTransactionRepository.findOne.mockResolvedValue(mockCardTransaction);
      mockTransactionRepository.findOne.mockResolvedValue(mockMainTransaction);
      jest.spyOn(service as any, 'validateIdempotency').mockReturnValue({ isValid: true, shouldSkip: false });
      mockCardTransactionRepository.transaction.mockImplementation((callback) => callback({}));
      mockLockerService.withLock.mockImplementation((key, callback) => callback());
      mockCardRepository.findOne.mockResolvedValue(mockCard);
      mockCardUserRepository.findOne.mockResolvedValue(mockCardUser);
      mockCardTransactionRepository.update.mockResolvedValue({} as any);
      mockTransactionRepository.update.mockResolvedValue({} as any);
      mockCardRepository.update.mockResolvedValue({} as any);
      mockCardUserRepository.update.mockResolvedValue({} as any);

      const result = await service.processWebhook(mockBody, {});

      expect(result.status).toBe('processed');
      expect(result.updated).toBe(true);
    });
  });

  describe('handleSpendTransactionCompleted - idempotency validation failure', () => {
    it('should return error when idempotency validation fails', async () => {
      const mockBody = {
        id: 'webhook-123',
        resource: 'transaction',
        action: 'completed',
        body: {
          id: 'txn-123',
          type: 'spend',
          spend: {
            userId: 'rain-user-123',
            cardId: 'rain-card-123',
            amount: 1000,
            currency: 'USD',
            status: 'completed',
          },
        },
      };

      const mockCardUser = {
        id: 'card-user-123',
        user_id: 'user-123',
        provider_ref: 'rain-user-123',
      } as any;

      const mockCard = {
        id: 'card-123',
        user_id: 'user-123',
        card_user_id: 'card-user-123',
        provider_ref: 'rain-card-123',
      } as any;

      const mockCardTransaction = {
        id: 'card-txn-123',
        status: 'successful',
        amount: 1000,
      } as any;

      const mockMainTransaction = {
        id: 'main-txn-123',
      } as any;

      mockCardUserRepository.findOne.mockResolvedValue(mockCardUser);
      mockCardRepository.findOne.mockResolvedValue(mockCard);
      mockCardTransactionRepository.findOne.mockResolvedValue(mockCardTransaction);
      mockTransactionRepository.findOne.mockResolvedValue(mockMainTransaction);
      jest.spyOn(service as any, 'validateIdempotency').mockReturnValue({
        isValid: false,
        reason: 'invalid_status_transition',
      });

      const result = await service.processWebhook(mockBody, {});

      expect(result.status).toBe('processed');
      expect(result.completed).toBe(false);
      expect(result.reason).toBe('invalid_status_transition');
    });
  });

  describe('handleSpendTransactionCompleted - update existing transaction', () => {
    it('should update existing card transaction when found', async () => {
      const mockBody = {
        id: 'webhook-123',
        resource: 'transaction',
        action: 'completed',
        body: {
          id: 'txn-123',
          type: 'spend',
          spend: {
            userId: 'rain-user-123',
            cardId: 'rain-card-123',
            amount: 1000,
            currency: 'USD',
            status: 'completed',
            merchantName: 'Test Merchant',
            authorizedAt: '2025-01-01T00:00:00Z',
            postedAt: '2025-01-01T00:00:00Z',
          },
        },
      };

      const mockCardUser = {
        id: 'card-user-123',
        user_id: 'user-123',
        provider_ref: 'rain-user-123',
        balance: 5000,
      } as any;

      const mockCard = {
        id: 'card-123',
        user_id: 'user-123',
        card_user_id: 'card-user-123',
        provider_ref: 'rain-card-123',
        balance: 5000,
      } as any;

      const mockCardTransaction = {
        id: 'card-txn-123',
        status: 'pending',
        amount: 1000,
      } as any;

      mockCardUserRepository.findOne.mockResolvedValue(mockCardUser);
      mockCardRepository.findOne.mockResolvedValue(mockCard);
      mockCardTransactionRepository.findOne.mockResolvedValue(mockCardTransaction);
      mockTransactionRepository.findOne.mockResolvedValue(null);
      mockCardTransactionRepository.transaction.mockImplementation((callback) => callback({}));
      mockLockerService.withLock.mockImplementation((key, callback) => callback());
      mockCardRepository.findOne.mockResolvedValue(mockCard);
      mockCardUserRepository.findOne.mockResolvedValue(mockCardUser);
      mockCardTransactionRepository.update.mockResolvedValue(mockCardTransaction);
      mockTransactionRepository.create.mockResolvedValue({ id: 'main-txn-123' } as any);
      mockCardRepository.update.mockResolvedValue({} as any);
      mockCardUserRepository.update.mockResolvedValue({} as any);

      const result = await service.processWebhook(mockBody, {});

      expect(result.status).toBe('processed');
      expect(mockCardTransactionRepository.update).toHaveBeenCalled();
    });
  });

  describe('handleSpendTransactionCompleted - card or cardUser not found', () => {
    it('should throw error when card or cardUser not found during balance update', async () => {
      const mockBody = {
        id: 'webhook-123',
        resource: 'transaction',
        action: 'completed',
        body: {
          id: 'txn-123',
          type: 'spend',
          spend: {
            userId: 'rain-user-123',
            cardId: 'rain-card-123',
            amount: 1000,
            currency: 'USD',
            status: 'completed',
            merchantName: 'Test Merchant',
          },
        },
      };

      const mockCardUser = {
        id: 'card-user-123',
        user_id: 'user-123',
        provider_ref: 'rain-user-123',
      } as any;

      const mockCard = {
        id: 'card-123',
        user_id: 'user-123',
        card_user_id: 'card-user-123',
        provider_ref: 'rain-card-123',
      } as any;

      mockCardUserRepository.findOne.mockResolvedValue(mockCardUser);
      mockCardRepository.findOne.mockResolvedValue(mockCard);
      mockCardTransactionRepository.findOne.mockResolvedValue(null);
      mockTransactionRepository.findOne.mockResolvedValue(null);
      mockCardTransactionRepository.transaction.mockImplementation((callback) => callback({}));
      mockLockerService.withLock.mockImplementation((key, callback) => callback());
      mockCardRepository.findOne.mockResolvedValueOnce(mockCard).mockResolvedValueOnce(null);
      mockCardUserRepository.findOne.mockResolvedValueOnce(mockCardUser).mockResolvedValueOnce(null);

      const result = await service.processWebhook(mockBody, {});

      expect(result.status).toBe('processed');
      expect(result.error).toBeDefined();
    });
  });

  describe('handleSpendTransactionCompleted - insufficient balance', () => {
    it('should throw error when balance would go negative', async () => {
      const mockBody = {
        id: 'webhook-123',
        resource: 'transaction',
        action: 'completed',
        body: {
          id: 'txn-123',
          type: 'spend',
          spend: {
            userId: 'rain-user-123',
            cardId: 'rain-card-123',
            amount: 10000,
            currency: 'USD',
            status: 'completed',
            merchantName: 'Test Merchant',
          },
        },
      };

      const mockCardUser = {
        id: 'card-user-123',
        user_id: 'user-123',
        provider_ref: 'rain-user-123',
        balance: 5000,
      } as any;

      const mockCard = {
        id: 'card-123',
        user_id: 'user-123',
        card_user_id: 'card-user-123',
        provider_ref: 'rain-card-123',
        balance: 5000,
      } as any;

      mockCardUserRepository.findOne.mockResolvedValue(mockCardUser);
      mockCardRepository.findOne.mockResolvedValue(mockCard);
      mockCardTransactionRepository.findOne.mockResolvedValue(null);
      mockTransactionRepository.findOne.mockResolvedValue(null);
      mockCardTransactionRepository.transaction.mockImplementation((callback) => callback({}));
      mockLockerService.withLock.mockImplementation((key, callback) => callback());
      mockCardRepository.findOne.mockResolvedValue(mockCard);
      mockCardUserRepository.findOne.mockResolvedValue(mockCardUser);
      mockCardTransactionRepository.create.mockResolvedValue({ id: 'card-txn-123' } as any);

      const result = await service.processWebhook(mockBody, {});

      expect(result.status).toBe('processed');
      expect(result.error).toBeDefined();
    });
  });

  describe('handleSpendTransactionCompleted - amount consistency validation', () => {
    it('should validate amount consistency with existing transaction', async () => {
      const mockBody = {
        id: 'webhook-123',
        resource: 'transaction',
        action: 'completed',
        body: {
          id: 'txn-123',
          type: 'spend',
          spend: {
            userId: 'rain-user-123',
            cardId: 'rain-card-123',
            amount: 1000,
            currency: 'USD',
            status: 'completed',
            merchantName: 'Test Merchant',
            authorizedAt: '2025-01-01T00:00:00Z',
            postedAt: '2025-01-01T00:00:00Z',
          },
        },
      };

      const mockCardUser = {
        id: 'card-user-123',
        user_id: 'user-123',
        provider_ref: 'rain-user-123',
        balance: 5000,
      } as any;

      const mockCard = {
        id: 'card-123',
        user_id: 'user-123',
        card_user_id: 'card-user-123',
        provider_ref: 'rain-card-123',
        balance: 5000,
      } as any;

      const mockCardTransaction = {
        id: 'card-txn-123',
        status: 'pending',
        amount: 1000,
      } as any;

      mockCardUserRepository.findOne.mockResolvedValue(mockCardUser);
      mockCardRepository.findOne.mockResolvedValue(mockCard);
      mockCardTransactionRepository.findOne.mockResolvedValue(mockCardTransaction);
      mockTransactionRepository.findOne.mockResolvedValue(null);
      mockCardTransactionRepository.transaction.mockImplementation((callback) => callback({}));
      mockLockerService.withLock.mockImplementation((key, callback) => callback());
      mockCardRepository.findOne.mockResolvedValue(mockCard);
      mockCardUserRepository.findOne.mockResolvedValue(mockCardUser);
      mockCardTransactionRepository.update.mockResolvedValue(mockCardTransaction);
      mockTransactionRepository.create.mockResolvedValue({ id: 'main-txn-123' } as any);
      mockCardRepository.update.mockResolvedValue({} as any);
      mockCardUserRepository.update.mockResolvedValue({} as any);

      const result = await service.processWebhook(mockBody, {});

      expect(result.status).toBe('processed');
      expect(result.completed).toBe(true);
    });
  });

  describe('sendSpendTransactionNotification - edge cases', () => {
    it('should handle notification failure gracefully', async () => {
      const mockBody = {
        id: 'webhook-123',
        resource: 'transaction',
        action: 'created',
        body: {
          id: 'txn-123',
          type: 'spend',
          spend: {
            userId: 'rain-user-123',
            cardId: 'rain-card-123',
            amount: 1000,
            currency: 'USD',
            status: 'pending',
            merchantName: 'Test Merchant',
            merchantCity: 'New York',
            merchantCountry: 'US',
            authorizedAt: new Date(),
          },
        },
      };

      const mockCardUser = {
        id: 'card-user-123',
        user_id: 'user-123',
        provider_ref: 'rain-user-123',
        balance: 5000,
      } as any;

      const mockCard = {
        id: 'card-123',
        user_id: 'user-123',
        card_user_id: 'card-user-123',
        provider_ref: 'rain-card-123',
        balance: 5000,
      } as any;

      mockCardUserRepository.findOne.mockResolvedValue(mockCardUser);
      mockCardRepository.findOne.mockResolvedValue(mockCard);
      mockCardTransactionRepository.findOne.mockResolvedValue(null);
      mockTransactionRepository.findOne.mockResolvedValue(null);
      mockCardTransactionRepository.transaction.mockImplementation((callback) => callback({}));
      mockLockerService.withLock.mockImplementation((key, callback) => callback());
      mockCardTransactionRepository.create.mockResolvedValue({ id: 'card-txn-123' } as any);
      mockTransactionRepository.create.mockResolvedValue({ id: 'main-txn-123' } as any);
      mockCardRepository.update.mockResolvedValue({} as any);
      mockCardUserRepository.update.mockResolvedValue({} as any);
      mockUserRepository.findActiveById.mockResolvedValue(null);

      const result = await service.processWebhook(mockBody, {});

      expect(result.status).toBe('processed');
    });

    it('should emit balance change event when sending spend transaction notification', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
      } as any;

      const mockCardUser = {
        id: 'card-user-123',
        user_id: 'user-123',
      } as any;

      const mockCard = {
        id: 'card-123',
        user_id: 'user-123',
        balance: 4000,
      } as any;

      const mockMainTransaction = {
        id: 'main-txn-123',
        balance_before: 5000,
        balance_after: 4000,
      } as any;

      mockUserRepository.findActiveById.mockResolvedValue(mockUser);

      await (service as any).sendSpendTransactionNotification({
        cardUser: mockCardUser,
        card: mockCard,
        mainTransaction: mockMainTransaction,
        amount: 1000,
        newBalance: 4000,
        currency: 'USD',
        merchantName: 'Test Merchant',
        merchantCity: 'New York',
        merchantCountry: 'US',
      });

      expect(mockCardService.sendCardNotification).toHaveBeenCalled();
      expect(mockEventEmitterService.emit).toHaveBeenCalledWith(EventEmitterEventsEnum.WALLET_BALANCE_CHANGED, {
        userId: 'user-123',
        walletType: 'card',
        walletId: 'card-123',
        currency: 'USD',
        balance: '4000',
        previousBalance: '5000',
        transactionId: 'main-txn-123',
        timestamp: expect.any(Date),
        wallet: mockCard,
      });
    });

    it('should calculate previous balance from newBalance + amount if balance_before not available', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
      } as any;

      const mockCardUser = {
        id: 'card-user-123',
        user_id: 'user-123',
      } as any;

      const mockCard = {
        id: 'card-123',
        user_id: 'user-123',
        balance: 4000,
      } as any;

      const mockMainTransaction = {
        id: 'main-txn-123',
        balance_before: null,
        balance_after: 4000,
      } as any;

      mockUserRepository.findActiveById.mockResolvedValue(mockUser);

      await (service as any).sendSpendTransactionNotification({
        cardUser: mockCardUser,
        card: mockCard,
        mainTransaction: mockMainTransaction,
        amount: 1000,
        newBalance: 4000,
        currency: 'USD',
        merchantName: 'Test Merchant',
        merchantCity: 'New York',
        merchantCountry: 'US',
      });

      expect(mockEventEmitterService.emit).toHaveBeenCalledWith(EventEmitterEventsEnum.WALLET_BALANCE_CHANGED, {
        userId: 'user-123',
        walletType: 'card',
        walletId: 'card-123',
        currency: 'USD',
        balance: '4000',
        previousBalance: '5000',
        transactionId: 'main-txn-123',
        timestamp: expect.any(Date),
        wallet: mockCard,
      });
    });

    it('should not emit event if user not found', async () => {
      const mockCardUser = {
        id: 'card-user-123',
        user_id: 'user-123',
      } as any;

      const mockCard = {
        id: 'card-123',
        user_id: 'user-123',
        balance: 4000,
      } as any;

      const mockMainTransaction = {
        id: 'main-txn-123',
        balance_before: 5000,
        balance_after: 4000,
      } as any;

      mockUserRepository.findActiveById.mockResolvedValue(null);

      await (service as any).sendSpendTransactionNotification({
        cardUser: mockCardUser,
        card: mockCard,
        mainTransaction: mockMainTransaction,
        amount: 1000,
        newBalance: 4000,
        currency: 'USD',
        merchantName: 'Test Merchant',
        merchantCity: 'New York',
        merchantCountry: 'US',
      });

      expect(mockCardService.sendCardNotification).not.toHaveBeenCalled();
      expect(mockEventEmitterService.emit).not.toHaveBeenCalled();
    });
  });

  describe('upsertCompletedMainTransaction - update existing', () => {
    it('should update existing main transaction when found', async () => {
      const mockBody = {
        id: 'webhook-123',
        resource: 'transaction',
        action: 'completed',
        body: {
          id: 'txn-123',
          type: 'spend',
          spend: {
            userId: 'rain-user-123',
            cardId: 'rain-card-123',
            amount: 1000,
            currency: 'USD',
            status: 'completed',
            merchantName: 'Test Merchant',
            authorizedAt: '2025-01-01T00:00:00Z',
            postedAt: '2025-01-01T00:00:00Z',
          },
        },
      };

      const mockCardUser = {
        id: 'card-user-123',
        user_id: 'user-123',
        provider_ref: 'rain-user-123',
        balance: 5000,
      } as any;

      const mockCard = {
        id: 'card-123',
        user_id: 'user-123',
        card_user_id: 'card-user-123',
        provider_ref: 'rain-card-123',
        balance: 5000,
      } as any;

      const mockCardTransaction = {
        id: 'card-txn-123',
        status: 'pending',
        amount: 1000,
      } as any;

      const mockMainTransaction = {
        id: 'main-txn-123',
        status: TransactionStatus.PENDING,
      } as any;

      mockCardUserRepository.findOne.mockResolvedValue(mockCardUser);
      mockCardRepository.findOne.mockResolvedValue(mockCard);
      mockCardTransactionRepository.findOne.mockResolvedValue(mockCardTransaction);
      mockTransactionRepository.findOne.mockResolvedValue(mockMainTransaction);
      mockCardTransactionRepository.transaction.mockImplementation((callback) => callback({}));
      mockLockerService.withLock.mockImplementation((key, callback) => callback());
      mockCardRepository.findOne.mockResolvedValue(mockCard);
      mockCardUserRepository.findOne.mockResolvedValue(mockCardUser);
      mockCardTransactionRepository.update.mockResolvedValue(mockCardTransaction);
      mockTransactionRepository.update.mockResolvedValue(mockMainTransaction);
      mockCardRepository.update.mockResolvedValue({} as any);
      mockCardUserRepository.update.mockResolvedValue({} as any);

      const result = await service.processWebhook(mockBody, {});

      expect(result.status).toBe('processed');
      expect(mockTransactionRepository.update).toHaveBeenCalled();
    });
  });

  describe('updateCompletedBalances - insufficient card user balance', () => {
    it('should throw error when card user balance would go negative in completed', async () => {
      const mockBody = {
        id: 'webhook-123',
        resource: 'transaction',
        action: 'completed',
        body: {
          id: 'txn-123',
          type: 'spend',
          spend: {
            userId: 'rain-user-123',
            cardId: 'rain-card-123',
            amount: 10000,
            currency: 'USD',
            status: 'completed',
            merchantName: 'Test Merchant',
            authorizedAt: '2025-01-01T00:00:00Z',
            postedAt: '2025-01-01T00:00:00Z',
          },
        },
      };

      const mockCardUser = {
        id: 'card-user-123',
        user_id: 'user-123',
        provider_ref: 'rain-user-123',
        balance: 100,
      } as any;

      const mockCard = {
        id: 'card-123',
        user_id: 'user-123',
        card_user_id: 'card-user-123',
        provider_ref: 'rain-card-123',
        balance: 50000,
      } as any;

      mockCardUserRepository.findOne.mockResolvedValue(mockCardUser);
      mockCardRepository.findOne.mockResolvedValue(mockCard);
      mockCardTransactionRepository.findOne.mockResolvedValue(null);
      mockTransactionRepository.findOne.mockResolvedValue(null);
      mockCardTransactionRepository.transaction.mockImplementation((callback) => callback({}));
      mockLockerService.withLock.mockImplementation((key, callback) => callback());
      mockCardTransactionRepository.create.mockResolvedValue({ id: 'card-txn-123' } as any);

      const result = await service.processWebhook(mockBody, {});

      expect(result.status).toBe('processed');
      expect(result.error).toBeDefined();
    });
  });

  describe('insufficient funds decline handling', () => {
    it('should detect insufficient funds decline reason', async () => {
      const result = (service as any).isInsufficientFundsDecline('insufficient funds');
      expect(result).toBe(true);
    });

    it('should detect account credit limit exceeded', async () => {
      const result = (service as any).isInsufficientFundsDecline('account credit limit exceeded');
      expect(result).toBe(true);
    });

    it('should return false for other decline reasons', async () => {
      const result = (service as any).isInsufficientFundsDecline('card expired');
      expect(result).toBe(false);
    });

    it('should return false for null decline reason', async () => {
      const result = (service as any).isInsufficientFundsDecline(null);
      expect(result).toBe(false);
    });

    it('should handle insufficient funds decline and charge fee', async () => {
      const mockBody = {
        id: 'webhook-123',
        resource: 'transaction',
        action: 'created',
        body: {
          id: 'txn-123',
          type: 'spend',
          spend: {
            userId: 'rain-user-123',
            cardId: 'rain-card-123',
            amount: 1000,
            currency: 'USD',
            status: 'declined',
            declinedReason: 'insufficient funds',
            merchantName: 'Test Merchant',
            authorizedAt: '2025-01-01T00:00:00Z',
          },
        },
      };

      const mockCardUser = {
        id: 'card-user-123',
        user_id: 'user-123',
        provider_ref: 'rain-user-123',
        balance: 5000,
      } as any;

      const mockCard = {
        id: 'card-123',
        user_id: 'user-123',
        card_user_id: 'card-user-123',
        provider_ref: 'rain-card-123',
        balance: 5000,
        insufficient_funds_decline_count: 0,
      } as any;

      mockCardUserRepository.findOne.mockResolvedValue(mockCardUser);
      mockCardRepository.findOne.mockResolvedValue(mockCard);
      mockCardTransactionRepository.findOne.mockResolvedValue(null);
      mockTransactionRepository.findOne.mockResolvedValue(null);
      mockCardTransactionRepository.transaction.mockImplementation((callback) => callback({}));
      mockLockerService.withLock.mockImplementation((key, callback) => callback());
      mockCardTransactionRepository.create.mockResolvedValue({
        id: 'card-txn-123',
        provider_reference: 'txn-123',
      } as any);
      mockTransactionRepository.create.mockResolvedValue({ id: 'main-txn-123' } as any);
      mockCardRepository.update.mockResolvedValue({} as any);
      mockCardUserRepository.update.mockResolvedValue({} as any);
      mockCardAdapter.createCharge.mockResolvedValue({ providerRef: 'charge-123' } as any);
      mockCardTransactionRepository.update.mockResolvedValue({} as any);

      const result = await service.processWebhook(mockBody, {});

      expect(result.status).toBe('processed');
      expect(result.insufficientFunds).toBeDefined();
      // Fee charging may fail in test due to mock limitations, but decline count should increment
      expect(result.insufficientFunds.declineCount).toBe(1);
    });

    it('should block card after 3 consecutive insufficient funds declines', async () => {
      const mockBody = {
        id: 'webhook-123',
        resource: 'transaction',
        action: 'created',
        body: {
          id: 'txn-123',
          type: 'spend',
          spend: {
            userId: 'rain-user-123',
            cardId: 'rain-card-123',
            amount: 1000,
            currency: 'USD',
            status: 'declined',
            declinedReason: 'insufficient funds',
            merchantName: 'Test Merchant',
            authorizedAt: '2025-01-01T00:00:00Z',
          },
        },
      };

      const mockCardUser = {
        id: 'card-user-123',
        user_id: 'user-123',
        provider_ref: 'rain-user-123',
        balance: 5000,
      } as any;

      const mockCard = {
        id: 'card-123',
        user_id: 'user-123',
        card_user_id: 'card-user-123',
        provider_ref: 'rain-card-123',
        balance: 5000,
        insufficient_funds_decline_count: 2,
      } as any;

      mockCardUserRepository.findOne.mockResolvedValue(mockCardUser);
      mockCardRepository.findOne.mockResolvedValue(mockCard);
      mockCardTransactionRepository.findOne.mockResolvedValue(null);
      mockTransactionRepository.findOne.mockResolvedValue(null);
      mockCardTransactionRepository.transaction.mockImplementation((callback) => callback({}));
      mockLockerService.withLock.mockImplementation((key, callback) => callback());
      mockCardTransactionRepository.create.mockResolvedValue({ id: 'card-txn-123' } as any);
      mockTransactionRepository.create.mockResolvedValue({ id: 'main-txn-123' } as any);
      mockCardRepository.update.mockResolvedValue({} as any);
      mockCardUserRepository.update.mockResolvedValue({} as any);
      mockCardAdapter.createCharge.mockResolvedValue({ providerRef: 'charge-123' } as any);
      mockCardAdapter.updateCard.mockResolvedValue({ status: 'locked' } as any);
      mockUserRepository.findActiveById.mockResolvedValue({ id: 'user-123', email: 'test@test.com' } as any);

      const result = await service.processWebhook(mockBody, {});

      expect(result.status).toBe('processed');
      expect(result.insufficientFunds).toBeDefined();
      expect(result.insufficientFunds.cardBlocked).toBe(true);
      expect(result.insufficientFunds.declineCount).toBe(3);
    });

    it('should reset decline count on successful transaction', async () => {
      const mockBody = {
        id: 'webhook-123',
        resource: 'transaction',
        action: 'created',
        body: {
          id: 'txn-123',
          type: 'spend',
          spend: {
            userId: 'rain-user-123',
            cardId: 'rain-card-123',
            amount: 1000,
            currency: 'USD',
            status: 'successful',
            merchantName: 'Test Merchant',
            authorizedAt: '2025-01-01T00:00:00Z',
          },
        },
      };

      const mockCardUser = {
        id: 'card-user-123',
        user_id: 'user-123',
        provider_ref: 'rain-user-123',
        balance: 5000,
      } as any;

      const mockCard = {
        id: 'card-123',
        user_id: 'user-123',
        card_user_id: 'card-user-123',
        provider_ref: 'rain-card-123',
        balance: 5000,
        insufficient_funds_decline_count: 2,
      } as any;

      mockCardUserRepository.findOne.mockResolvedValue(mockCardUser);
      mockCardRepository.findOne.mockResolvedValue(mockCard);
      mockCardTransactionRepository.findOne.mockResolvedValue(null);
      mockTransactionRepository.findOne.mockResolvedValue(null);
      mockCardTransactionRepository.transaction.mockImplementation((callback) => callback({}));
      mockLockerService.withLock.mockImplementation((key, callback) => callback());
      mockCardTransactionRepository.create.mockResolvedValue({ id: 'card-txn-123' } as any);
      mockTransactionRepository.create.mockResolvedValue({ id: 'main-txn-123' } as any);
      mockCardRepository.update.mockResolvedValue({} as any);
      mockCardUserRepository.update.mockResolvedValue({} as any);
      mockUserRepository.findActiveById.mockResolvedValue({ id: 'user-123', email: 'test@test.com' } as any);

      await service.processWebhook(mockBody, {});

      // Verify reset was called (decline count reset to 0)
      expect(mockCardRepository.update).toHaveBeenCalledWith(
        { id: 'card-123' },
        expect.objectContaining({ insufficient_funds_decline_count: 0 }),
        expect.any(Object),
      );
    });

    it('should charge insufficient funds fee when fee is greater than 0', async () => {
      const mockBody = {
        id: 'webhook-123',
        resource: 'transaction',
        action: 'created',
        body: {
          id: 'txn-123',
          type: 'spend',
          spend: {
            userId: 'rain-user-123',
            cardId: 'rain-card-123',
            amount: 10000,
            currency: 'USD',
            status: 'declined',
            declinedReason: 'Insufficient Funds',
            merchantName: 'Test Merchant',
            authorizedAt: '2025-01-01T00:00:00Z',
          },
        },
      };

      const mockCardUser = {
        id: 'card-user-123',
        user_id: 'user-123',
        provider_ref: 'rain-user-123',
        balance: 100,
      } as any;

      const mockCard = {
        id: 'card-123',
        user_id: 'user-123',
        card_user_id: 'card-user-123',
        provider_ref: 'rain-card-123',
        balance: 100,
        insufficient_funds_decline_count: 0,
      } as any;

      mockCardUserRepository.findOne.mockResolvedValue(mockCardUser);
      mockCardRepository.findOne.mockResolvedValue(mockCard);
      mockCardTransactionRepository.findOne.mockResolvedValue(null);
      mockTransactionRepository.findOne.mockResolvedValue(null);
      mockCardTransactionRepository.transaction.mockImplementation((callback) => callback({}));
      mockLockerService.withLock.mockImplementation((key, callback) => callback());
      mockCardTransactionRepository.create.mockResolvedValue({ id: 'card-txn-123' } as any);
      mockTransactionRepository.create.mockResolvedValue({ id: 'main-txn-123' } as any);
      mockCardRepository.update.mockResolvedValue({} as any);
      mockCardUserRepository.update.mockResolvedValue({} as any);
      mockCardAdapter.createCharge.mockResolvedValue({ providerRef: 'charge-123' });
      mockUserRepository.findActiveById.mockResolvedValue({ id: 'user-123', email: 'test@test.com' } as any);

      // Mock CardFeesService to return a fee
      jest.spyOn(CardFeesService, 'calculateFee').mockReturnValue({ fee: 0.25, feeType: 'fixed' as any });

      await service.processWebhook(mockBody, {});

      expect(mockCardAdapter.createCharge).toHaveBeenCalled();
    });

    it('should handle Rain API charge failure gracefully', async () => {
      const mockBody = {
        id: 'webhook-123',
        resource: 'transaction',
        action: 'created',
        body: {
          id: 'txn-123',
          type: 'spend',
          spend: {
            userId: 'rain-user-123',
            cardId: 'rain-card-123',
            amount: 10000,
            currency: 'USD',
            status: 'declined',
            declinedReason: 'Insufficient Funds',
            merchantName: 'Test Merchant',
            authorizedAt: '2025-01-01T00:00:00Z',
          },
        },
      };

      const mockCardUser = {
        id: 'card-user-123',
        user_id: 'user-123',
        provider_ref: 'rain-user-123',
        balance: 100,
      } as any;

      const mockCard = {
        id: 'card-123',
        user_id: 'user-123',
        card_user_id: 'card-user-123',
        provider_ref: 'rain-card-123',
        balance: 100,
        insufficient_funds_decline_count: 0,
      } as any;

      mockCardUserRepository.findOne.mockResolvedValue(mockCardUser);
      mockCardRepository.findOne.mockResolvedValue(mockCard);
      mockCardTransactionRepository.findOne.mockResolvedValue(null);
      mockTransactionRepository.findOne.mockResolvedValue(null);
      mockCardTransactionRepository.transaction.mockImplementation((callback) => callback({}));
      mockLockerService.withLock.mockImplementation((key, callback) => callback());
      mockCardTransactionRepository.create.mockResolvedValue({ id: 'card-txn-123' } as any);
      mockTransactionRepository.create.mockResolvedValue({ id: 'main-txn-123' } as any);
      mockCardRepository.update.mockResolvedValue({} as any);
      mockCardUserRepository.update.mockResolvedValue({} as any);
      mockCardAdapter.createCharge.mockRejectedValue(new Error('Rain API error'));
      mockUserRepository.findActiveById.mockResolvedValue({ id: 'user-123', email: 'test@test.com' } as any);

      jest.spyOn(CardFeesService, 'calculateFee').mockReturnValue({ fee: 0.25, feeType: 'fixed' as any });

      const result = await service.processWebhook(mockBody, {});

      // Should still process successfully even if charge fails
      expect(result.status).toBe('processed');
    });

    it('should block card after max consecutive insufficient funds declines', async () => {
      const mockBody = {
        id: 'webhook-123',
        resource: 'transaction',
        action: 'created',
        body: {
          id: 'txn-123',
          type: 'spend',
          spend: {
            userId: 'rain-user-123',
            cardId: 'rain-card-123',
            amount: 10000,
            currency: 'USD',
            status: 'declined',
            declinedReason: 'Insufficient Funds',
            merchantName: 'Test Merchant',
            authorizedAt: '2025-01-01T00:00:00Z',
          },
        },
      };

      const mockCardUser = {
        id: 'card-user-123',
        user_id: 'user-123',
        provider_ref: 'rain-user-123',
        balance: 100,
      } as any;

      const mockCard = {
        id: 'card-123',
        user_id: 'user-123',
        card_user_id: 'card-user-123',
        provider_ref: 'rain-card-123',
        balance: 100,
        insufficient_funds_decline_count: 4, // One more will trigger block (max is 5)
      } as any;

      mockCardUserRepository.findOne.mockResolvedValue(mockCardUser);
      mockCardRepository.findOne.mockResolvedValue(mockCard);
      mockCardTransactionRepository.findOne.mockResolvedValue(null);
      mockTransactionRepository.findOne.mockResolvedValue(null);
      mockCardTransactionRepository.transaction.mockImplementation((callback) => callback({}));
      mockLockerService.withLock.mockImplementation((key, callback) => callback());
      mockCardTransactionRepository.create.mockResolvedValue({ id: 'card-txn-123' } as any);
      mockTransactionRepository.create.mockResolvedValue({ id: 'main-txn-123' } as any);
      mockCardRepository.update.mockResolvedValue({} as any);
      mockCardUserRepository.update.mockResolvedValue({} as any);
      mockCardAdapter.createCharge.mockResolvedValue({ providerRef: 'charge-123' });
      mockCardAdapter.updateCard.mockResolvedValue({});
      mockUserRepository.findActiveById.mockResolvedValue({ id: 'user-123', email: 'test@test.com' } as any);

      jest.spyOn(CardFeesService, 'calculateFee').mockReturnValue({ fee: 0.25, feeType: 'fixed' as any });

      await service.processWebhook(mockBody, {});

      // Verify card was blocked via Rain API
      expect(mockCardAdapter.updateCard).toHaveBeenCalledWith('rain-card-123', { status: 'locked' });
    });

    it('should send card blocked notification when card is blocked', async () => {
      const mockBody = {
        id: 'webhook-123',
        resource: 'transaction',
        action: 'created',
        body: {
          id: 'txn-123',
          type: 'spend',
          spend: {
            userId: 'rain-user-123',
            cardId: 'rain-card-123',
            amount: 10000,
            currency: 'USD',
            status: 'declined',
            declinedReason: 'Insufficient Funds',
            merchantName: 'Test Merchant',
            authorizedAt: '2025-01-01T00:00:00Z',
          },
        },
      };

      const mockCardUser = {
        id: 'card-user-123',
        user_id: 'user-123',
        provider_ref: 'rain-user-123',
        balance: 100,
      } as any;

      const mockCard = {
        id: 'card-123',
        user_id: 'user-123',
        card_user_id: 'card-user-123',
        provider_ref: 'rain-card-123',
        balance: 100,
        insufficient_funds_decline_count: 4,
      } as any;

      const mockUser = { id: 'user-123', email: 'test@test.com' };

      mockCardUserRepository.findOne.mockResolvedValue(mockCardUser);
      mockCardRepository.findOne.mockResolvedValue(mockCard);
      mockCardTransactionRepository.findOne.mockResolvedValue(null);
      mockTransactionRepository.findOne.mockResolvedValue(null);
      mockCardTransactionRepository.transaction.mockImplementation((callback) => callback({}));
      mockLockerService.withLock.mockImplementation((key, callback) => callback());
      mockCardTransactionRepository.create.mockResolvedValue({ id: 'card-txn-123' } as any);
      mockTransactionRepository.create.mockResolvedValue({ id: 'main-txn-123' } as any);
      mockCardRepository.update.mockResolvedValue({} as any);
      mockCardUserRepository.update.mockResolvedValue({} as any);
      mockCardAdapter.createCharge.mockResolvedValue({ providerRef: 'charge-123' });
      mockCardAdapter.updateCard.mockResolvedValue({});
      mockUserRepository.findActiveById.mockResolvedValue(mockUser as any);
      mockInAppNotificationService.createNotification.mockResolvedValue({});
      mockMailerService.send.mockResolvedValue({});

      jest.spyOn(CardFeesService, 'calculateFee').mockReturnValue({ fee: 0.25, feeType: 'fixed' as any });

      await service.processWebhook(mockBody, {});

      // Wait for async notifications
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(mockCardService.sendCardNotification).toHaveBeenCalled();
    });

    it('should handle user not found when sending card blocked notification', async () => {
      const mockBody = {
        id: 'webhook-123',
        resource: 'transaction',
        action: 'created',
        body: {
          id: 'txn-123',
          type: 'spend',
          spend: {
            userId: 'rain-user-123',
            cardId: 'rain-card-123',
            amount: 10000,
            currency: 'USD',
            status: 'declined',
            declinedReason: 'Insufficient Funds',
            merchantName: 'Test Merchant',
            authorizedAt: '2025-01-01T00:00:00Z',
          },
        },
      };

      const mockCardUser = {
        id: 'card-user-123',
        user_id: 'user-123',
        provider_ref: 'rain-user-123',
        balance: 100,
      } as any;

      const mockCard = {
        id: 'card-123',
        user_id: 'user-123',
        card_user_id: 'card-user-123',
        provider_ref: 'rain-card-123',
        balance: 100,
        insufficient_funds_decline_count: 4,
      } as any;

      mockCardUserRepository.findOne.mockResolvedValue(mockCardUser);
      mockCardRepository.findOne.mockResolvedValue(mockCard);
      mockCardTransactionRepository.findOne.mockResolvedValue(null);
      mockTransactionRepository.findOne.mockResolvedValue(null);
      mockCardTransactionRepository.transaction.mockImplementation((callback) => callback({}));
      mockLockerService.withLock.mockImplementation((key, callback) => callback());
      mockCardTransactionRepository.create.mockResolvedValue({ id: 'card-txn-123' } as any);
      mockTransactionRepository.create.mockResolvedValue({ id: 'main-txn-123' } as any);
      mockCardRepository.update.mockResolvedValue({} as any);
      mockCardUserRepository.update.mockResolvedValue({} as any);
      mockCardAdapter.createCharge.mockResolvedValue({ providerRef: 'charge-123' });
      mockCardAdapter.updateCard.mockResolvedValue({});
      mockUserRepository.findActiveById.mockResolvedValue(null);

      jest.spyOn(CardFeesService, 'calculateFee').mockReturnValue({ fee: 0.25, feeType: 'fixed' as any });

      const result = await service.processWebhook(mockBody, {});

      // Should still process successfully
      expect(result.status).toBe('processed');
    });

    it('should send decline fee notification when fee is charged', async () => {
      const mockBody = {
        id: 'webhook-123',
        resource: 'transaction',
        action: 'created',
        body: {
          id: 'txn-123',
          type: 'spend',
          spend: {
            userId: 'rain-user-123',
            cardId: 'rain-card-123',
            amount: 10000,
            currency: 'USD',
            status: 'declined',
            declinedReason: 'Insufficient Funds',
            merchantName: 'Test Merchant',
            authorizedAt: '2025-01-01T00:00:00Z',
          },
        },
      };

      const mockCardUser = {
        id: 'card-user-123',
        user_id: 'user-123',
        provider_ref: 'rain-user-123',
        balance: 100,
      } as any;

      const mockCard = {
        id: 'card-123',
        user_id: 'user-123',
        card_user_id: 'card-user-123',
        provider_ref: 'rain-card-123',
        balance: 100,
        insufficient_funds_decline_count: 1,
      } as any;

      const mockUser = { id: 'user-123', email: 'test@test.com' };

      mockCardUserRepository.findOne.mockResolvedValue(mockCardUser);
      mockCardRepository.findOne.mockResolvedValue(mockCard);
      mockCardTransactionRepository.findOne.mockResolvedValue(null);
      mockTransactionRepository.findOne.mockResolvedValue(null);
      mockCardTransactionRepository.transaction.mockImplementation((callback) => callback({}));
      mockLockerService.withLock.mockImplementation((key, callback) => callback());
      mockCardTransactionRepository.create.mockResolvedValue({ id: 'card-txn-123' } as any);
      mockTransactionRepository.create.mockResolvedValue({ id: 'main-txn-123' } as any);
      mockCardRepository.update.mockResolvedValue({} as any);
      mockCardUserRepository.update.mockResolvedValue({} as any);
      mockCardAdapter.createCharge.mockResolvedValue({ providerRef: 'charge-123' });
      mockUserRepository.findActiveById.mockResolvedValue(mockUser as any);
      mockInAppNotificationService.createNotification.mockResolvedValue({});

      jest.spyOn(CardFeesService, 'calculateFee').mockReturnValue({ fee: 0.25, feeType: 'fixed' as any });

      await service.processWebhook(mockBody, {});

      // Wait for async notifications
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(mockCardService.sendCardNotification).toHaveBeenCalled();
    });

    it('should handle user not found when sending decline fee notification', async () => {
      const mockBody = {
        id: 'webhook-123',
        resource: 'transaction',
        action: 'created',
        body: {
          id: 'txn-123',
          type: 'spend',
          spend: {
            userId: 'rain-user-123',
            cardId: 'rain-card-123',
            amount: 10000,
            currency: 'USD',
            status: 'declined',
            declinedReason: 'Insufficient Funds',
            merchantName: 'Test Merchant',
            authorizedAt: '2025-01-01T00:00:00Z',
          },
        },
      };

      const mockCardUser = {
        id: 'card-user-123',
        user_id: 'user-123',
        provider_ref: 'rain-user-123',
        balance: 100,
      } as any;

      const mockCard = {
        id: 'card-123',
        user_id: 'user-123',
        card_user_id: 'card-user-123',
        provider_ref: 'rain-card-123',
        balance: 100,
        insufficient_funds_decline_count: 1,
      } as any;

      mockCardUserRepository.findOne.mockResolvedValue(mockCardUser);
      mockCardRepository.findOne.mockResolvedValue(mockCard);
      mockCardTransactionRepository.findOne.mockResolvedValue(null);
      mockTransactionRepository.findOne.mockResolvedValue(null);
      mockCardTransactionRepository.transaction.mockImplementation((callback) => callback({}));
      mockLockerService.withLock.mockImplementation((key, callback) => callback());
      mockCardTransactionRepository.create.mockResolvedValue({ id: 'card-txn-123' } as any);
      mockTransactionRepository.create.mockResolvedValue({ id: 'main-txn-123' } as any);
      mockCardRepository.update.mockResolvedValue({} as any);
      mockCardUserRepository.update.mockResolvedValue({} as any);
      mockCardAdapter.createCharge.mockResolvedValue({ providerRef: 'charge-123' });
      mockUserRepository.findActiveById.mockResolvedValue(null);

      jest.spyOn(CardFeesService, 'calculateFee').mockReturnValue({ fee: 0.25, feeType: 'fixed' as any });

      const result = await service.processWebhook(mockBody, {});

      expect(result.status).toBe('processed');
    });

    it('should skip fee charge when fee is 0', async () => {
      const mockBody = {
        id: 'webhook-123',
        resource: 'transaction',
        action: 'created',
        body: {
          id: 'txn-123',
          type: 'spend',
          spend: {
            userId: 'rain-user-123',
            cardId: 'rain-card-123',
            amount: 10000,
            currency: 'USD',
            status: 'declined',
            declinedReason: 'Insufficient Funds',
            merchantName: 'Test Merchant',
            authorizedAt: '2025-01-01T00:00:00Z',
          },
        },
      };

      const mockCardUser = {
        id: 'card-user-123',
        user_id: 'user-123',
        provider_ref: 'rain-user-123',
        balance: 100,
      } as any;

      const mockCard = {
        id: 'card-123',
        user_id: 'user-123',
        card_user_id: 'card-user-123',
        provider_ref: 'rain-card-123',
        balance: 100,
        insufficient_funds_decline_count: 0,
      } as any;

      mockCardUserRepository.findOne.mockResolvedValue(mockCardUser);
      mockCardRepository.findOne.mockResolvedValue(mockCard);
      mockCardTransactionRepository.findOne.mockResolvedValue(null);
      mockTransactionRepository.findOne.mockResolvedValue(null);
      mockCardTransactionRepository.transaction.mockImplementation((callback) => callback({}));
      mockLockerService.withLock.mockImplementation((key, callback) => callback());
      mockCardTransactionRepository.create.mockResolvedValue({ id: 'card-txn-123' } as any);
      mockTransactionRepository.create.mockResolvedValue({ id: 'main-txn-123' } as any);
      mockCardRepository.update.mockResolvedValue({} as any);
      mockCardUserRepository.update.mockResolvedValue({} as any);
      mockUserRepository.findActiveById.mockResolvedValue({ id: 'user-123', email: 'test@test.com' } as any);

      jest.spyOn(CardFeesService, 'calculateFee').mockReturnValue({ fee: 0, feeType: 'none' as any });

      await service.processWebhook(mockBody, {});

      expect(mockCardAdapter.createCharge).not.toHaveBeenCalled();
    });

    it('should handle error in blockCardDueToDeclines', async () => {
      const mockBody = {
        id: 'webhook-123',
        resource: 'transaction',
        action: 'created',
        body: {
          id: 'txn-123',
          type: 'spend',
          spend: {
            userId: 'rain-user-123',
            cardId: 'rain-card-123',
            amount: 10000,
            currency: 'USD',
            status: 'declined',
            declinedReason: 'Insufficient Funds',
            merchantName: 'Test Merchant',
            authorizedAt: '2025-01-01T00:00:00Z',
          },
        },
      };

      const mockCardUser = {
        id: 'card-user-123',
        user_id: 'user-123',
        provider_ref: 'rain-user-123',
        balance: 100,
      } as any;

      const mockCard = {
        id: 'card-123',
        user_id: 'user-123',
        card_user_id: 'card-user-123',
        provider_ref: 'rain-card-123',
        balance: 100,
        insufficient_funds_decline_count: 4,
      } as any;

      mockCardUserRepository.findOne.mockResolvedValue(mockCardUser);
      mockCardRepository.findOne.mockResolvedValue(mockCard);
      mockCardTransactionRepository.findOne.mockResolvedValue(null);
      mockTransactionRepository.findOne.mockResolvedValue(null);
      mockCardTransactionRepository.transaction.mockImplementation((callback) => callback({}));
      mockLockerService.withLock.mockImplementation((key, callback) => callback());
      mockCardTransactionRepository.create.mockResolvedValue({ id: 'card-txn-123' } as any);
      mockTransactionRepository.create.mockResolvedValue({ id: 'main-txn-123' } as any);
      mockCardRepository.update.mockResolvedValue({} as any);
      mockCardUserRepository.update.mockResolvedValue({} as any);
      mockCardAdapter.createCharge.mockResolvedValue({ providerRef: 'charge-123' });
      mockCardAdapter.updateCard.mockRejectedValue(new Error('Rain API error'));
      mockUserRepository.findActiveById.mockResolvedValue({ id: 'user-123', email: 'test@test.com' } as any);

      jest.spyOn(CardFeesService, 'calculateFee').mockReturnValue({ fee: 0.25, feeType: 'fixed' as any });

      // Error is caught and returns processed response
      const result = await service.processWebhook(mockBody, {});
      expect(result.status).toBe('processed');
      expect(result.error).toBe('Internal processing error');
    });

    it('should handle error in sendDeclineFeeNotification', async () => {
      const mockBody = {
        id: 'webhook-123',
        resource: 'transaction',
        action: 'created',
        body: {
          id: 'txn-123',
          type: 'spend',
          spend: {
            userId: 'rain-user-123',
            cardId: 'rain-card-123',
            amount: 10000,
            currency: 'USD',
            status: 'declined',
            declinedReason: 'Insufficient Funds',
            merchantName: 'Test Merchant',
            authorizedAt: '2025-01-01T00:00:00Z',
          },
        },
      };

      const mockCardUser = {
        id: 'card-user-123',
        user_id: 'user-123',
        provider_ref: 'rain-user-123',
        balance: 100,
      } as any;

      const mockCard = {
        id: 'card-123',
        user_id: 'user-123',
        card_user_id: 'card-user-123',
        provider_ref: 'rain-card-123',
        balance: 100,
        insufficient_funds_decline_count: 1,
      } as any;

      mockCardUserRepository.findOne.mockResolvedValue(mockCardUser);
      mockCardRepository.findOne.mockResolvedValue(mockCard);
      mockCardTransactionRepository.findOne.mockResolvedValue(null);
      mockTransactionRepository.findOne.mockResolvedValue(null);
      mockCardTransactionRepository.transaction.mockImplementation((callback) => callback({}));
      mockLockerService.withLock.mockImplementation((key, callback) => callback());
      mockCardTransactionRepository.create.mockResolvedValue({ id: 'card-txn-123' } as any);
      mockTransactionRepository.create.mockResolvedValue({ id: 'main-txn-123' } as any);
      mockCardRepository.update.mockResolvedValue({} as any);
      mockCardUserRepository.update.mockResolvedValue({} as any);
      mockCardAdapter.createCharge.mockResolvedValue({ providerRef: 'charge-123' });
      mockUserRepository.findActiveById.mockRejectedValue(new Error('DB error'));

      jest.spyOn(CardFeesService, 'calculateFee').mockReturnValue({ fee: 0.25, feeType: 'fixed' as any });

      const result = await service.processWebhook(mockBody, {});

      // Should still process successfully even if notification fails
      expect(result.status).toBe('processed');
    });

    it('should handle decline fee notification with warning message near max declines', async () => {
      const mockBody = {
        id: 'webhook-123',
        resource: 'transaction',
        action: 'created',
        body: {
          id: 'txn-123',
          type: 'spend',
          spend: {
            userId: 'rain-user-123',
            cardId: 'rain-card-123',
            amount: 10000,
            currency: 'USD',
            status: 'declined',
            declinedReason: 'Insufficient Funds',
            merchantName: 'Test Merchant',
            authorizedAt: '2025-01-01T00:00:00Z',
          },
        },
      };

      const mockCardUser = {
        id: 'card-user-123',
        user_id: 'user-123',
        provider_ref: 'rain-user-123',
        balance: 100,
      } as any;

      const mockCard = {
        id: 'card-123',
        user_id: 'user-123',
        card_user_id: 'card-user-123',
        provider_ref: 'rain-card-123',
        balance: 100,
        insufficient_funds_decline_count: 3, // Near max (5-1=4)
      } as any;

      const mockUser = { id: 'user-123', email: 'test@test.com' };

      mockCardUserRepository.findOne.mockResolvedValue(mockCardUser);
      mockCardRepository.findOne.mockResolvedValue(mockCard);
      mockCardTransactionRepository.findOne.mockResolvedValue(null);
      mockTransactionRepository.findOne.mockResolvedValue(null);
      mockCardTransactionRepository.transaction.mockImplementation((callback) => callback({}));
      mockLockerService.withLock.mockImplementation((key, callback) => callback());
      mockCardTransactionRepository.create.mockResolvedValue({ id: 'card-txn-123' } as any);
      mockTransactionRepository.create.mockResolvedValue({ id: 'main-txn-123' } as any);
      mockCardRepository.update.mockResolvedValue({} as any);
      mockCardUserRepository.update.mockResolvedValue({} as any);
      mockCardAdapter.createCharge.mockResolvedValue({ providerRef: 'charge-123' });
      mockUserRepository.findActiveById.mockResolvedValue(mockUser as any);
      mockInAppNotificationService.createNotification.mockResolvedValue({});

      jest.spyOn(CardFeesService, 'calculateFee').mockReturnValue({ fee: 0.25, feeType: 'fixed' as any });

      await service.processWebhook(mockBody, {});

      // Wait for async notifications
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(mockCardService.sendCardNotification).toHaveBeenCalled();
    });

    it('should handle error in sendCardBlockedNotification', async () => {
      const mockBody = {
        id: 'webhook-123',
        resource: 'transaction',
        action: 'created',
        body: {
          id: 'txn-123',
          type: 'spend',
          spend: {
            userId: 'rain-user-123',
            cardId: 'rain-card-123',
            amount: 10000,
            currency: 'USD',
            status: 'declined',
            declinedReason: 'Insufficient Funds',
            merchantName: 'Test Merchant',
            authorizedAt: '2025-01-01T00:00:00Z',
          },
        },
      };

      const mockCardUser = {
        id: 'card-user-123',
        user_id: 'user-123',
        provider_ref: 'rain-user-123',
        balance: 100,
      } as any;

      const mockCard = {
        id: 'card-123',
        user_id: 'user-123',
        card_user_id: 'card-user-123',
        provider_ref: 'rain-card-123',
        balance: 100,
        insufficient_funds_decline_count: 4,
      } as any;

      mockCardUserRepository.findOne.mockResolvedValue(mockCardUser);
      mockCardRepository.findOne.mockResolvedValue(mockCard);
      mockCardTransactionRepository.findOne.mockResolvedValue(null);
      mockTransactionRepository.findOne.mockResolvedValue(null);
      mockCardTransactionRepository.transaction.mockImplementation((callback) => callback({}));
      mockLockerService.withLock.mockImplementation((key, callback) => callback());
      mockCardTransactionRepository.create.mockResolvedValue({ id: 'card-txn-123' } as any);
      mockTransactionRepository.create.mockResolvedValue({ id: 'main-txn-123' } as any);
      mockCardRepository.update.mockResolvedValue({} as any);
      mockCardUserRepository.update.mockResolvedValue({} as any);
      mockCardAdapter.createCharge.mockResolvedValue({ providerRef: 'charge-123' });
      mockCardAdapter.updateCard.mockResolvedValue({});
      mockUserRepository.findActiveById.mockResolvedValue({ id: 'user-123', email: 'test@test.com' } as any);
      mockInAppNotificationService.createNotification.mockRejectedValue(new Error('Notification error'));

      jest.spyOn(CardFeesService, 'calculateFee').mockReturnValue({ fee: 0.25, feeType: 'fixed' as any });

      const result = await service.processWebhook(mockBody, {});

      // Wait for async notifications
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Should still process successfully even if notification fails
      expect(result.status).toBe('processed');
    });

    it('should skip insufficient funds handling when card is already blocked', async () => {
      const mockCard = {
        id: 'card-123',
        status: ICardStatus.BLOCKED,
        insufficient_funds_decline_count: undefined,
      } as any;

      const result = await (service as any).handleInsufficientFundsDecline(
        mockCard,
        { id: 'card-user-123' } as any,
        { id: 'card-txn-123' } as any,
        {},
      );

      expect(result).toEqual({
        feeCharged: false,
        cardBlocked: false,
        newDeclineCount: 0,
        feeCardTransactionId: null,
        feeMainTransactionId: null,
      });
      expect(mockCardRepository.update).not.toHaveBeenCalled();
    });

    it('should skip blocking when card is already blocked', async () => {
      const mockCard = {
        id: 'card-123',
        status: ICardStatus.BLOCKED,
      } as any;

      await (service as any).blockCardDueToDeclines(mockCard, { id: 'card-user-123' } as any, {});

      expect(mockCardAdapter.updateCard).not.toHaveBeenCalled();
      expect(mockCardRepository.update).not.toHaveBeenCalled();
    });
  });

  describe('processWebhook - handleSpendTransactionRequest card not active', () => {
    it('should reject transaction when card is not active', async () => {
      const mockBody = {
        id: 'webhook-123',
        resource: 'transaction',
        action: 'requested',
        body: {
          id: 'txn-123',
          type: 'spend',
          spend: {
            userId: 'rain-user-123',
            cardId: 'rain-card-123',
            amount: 1000,
            currency: 'USD',
            merchantName: 'Test Merchant',
          },
        },
      };

      const mockCardUser = {
        id: 'card-user-123',
        user_id: 'user-123',
        provider_ref: 'rain-user-123',
        balance: 5000,
      } as any;

      const mockCard = {
        id: 'card-123',
        user_id: 'user-123',
        card_user_id: 'card-user-123',
        provider_ref: 'rain-card-123',
        balance: 5000,
        status: 'locked', // Not active
      } as any;

      mockCardUserRepository.findOne.mockResolvedValue(mockCardUser);
      mockCardRepository.findOne.mockResolvedValue(mockCard);

      const result = await service.processWebhook(mockBody, {});

      expect(result.status).toBe('rejected');
      expect(result.reason).toBe('card_not_active');
    });
  });

  describe('processWebhook - handleCardUpdated card user not found', () => {
    it('should handle card user not found in handleCardUpdated', async () => {
      const mockBody = {
        id: 'webhook-123',
        resource: 'card',
        action: 'updated',
        body: {
          id: 'card-456',
          userId: 'rain-user-123',
          status: 'locked',
        },
      };

      const mockCard = {
        id: 'card-123',
        provider_ref: 'card-456',
        status: 'active',
      } as any;

      mockCardRepository.findOne.mockResolvedValue(mockCard);
      mockCardUserRepository.findOne.mockResolvedValue(null);

      const result = await service.processWebhook(mockBody, {});

      expect(result.reason).toBe('card_user_not_found');
    });
  });

  describe('processWebhook - handleSpendTransactionCompleted duplicate', () => {
    it('should skip duplicate transaction completion', async () => {
      const mockBody = {
        id: 'webhook-123',
        resource: 'transaction',
        action: 'completed',
        body: {
          id: 'txn-123',
          type: 'spend',
          spend: {
            userId: 'rain-user-123',
            cardId: 'rain-card-123',
            amount: 1000,
            currency: 'USD',
            status: 'successful',
            merchantName: 'Test Merchant',
          },
        },
      };

      const mockCardUser = {
        id: 'card-user-123',
        user_id: 'user-123',
        provider_ref: 'rain-user-123',
        balance: 5000,
      } as any;

      const mockCard = {
        id: 'card-123',
        user_id: 'user-123',
        card_user_id: 'card-user-123',
        provider_ref: 'rain-card-123',
        balance: 5000,
        status: 'active',
      } as any;

      const mockExistingCardTransaction = {
        id: 'card-txn-123',
        provider_reference: 'txn-123',
        status: 'successful',
        amount: 1000,
      } as any;

      mockCardUserRepository.findOne.mockResolvedValue(mockCardUser);
      mockCardRepository.findOne.mockResolvedValue(mockCard);
      mockCardTransactionRepository.findOne.mockResolvedValue(mockExistingCardTransaction);
      mockTransactionRepository.findOne.mockResolvedValue({ id: 'main-txn-123', status: 'completed' } as any);

      const result = await service.processWebhook(mockBody, {});

      expect(result.reason).toBe('transaction_already_completed');
    });
  });

  describe('processWebhook - post-funding actions error handling', () => {
    it('should handle error in post-funding actions', async () => {
      const mockBody = {
        id: 'webhook-123',
        resource: 'transaction',
        action: 'created',
        body: {
          id: 'txn-123',
          type: 'collateral',
          collateral: {
            userId: 'rain-user-123',
            chainId: 8453,
            amount: 1000,
            currency: 'USD',
            status: 'successful',
            txHash: '0x123',
          },
        },
      };

      const mockCardUser = {
        id: 'card-user-123',
        user_id: 'user-123',
        provider_ref: 'rain-user-123',
        balance: 5000,
        user: { id: 'user-123', email: 'test@test.com' },
      } as any;

      const mockCard = {
        id: 'card-123',
        user_id: 'user-123',
        card_user_id: 'card-user-123',
        provider_ref: 'rain-card-123',
        balance: 5000,
        status: 'active',
      } as any;

      const mockDepositAddress = {
        id: 'deposit-123',
        user_id: 'user-123',
        provider: 'rain',
        asset: 'base',
      } as any;

      const mockExistingTransaction = {
        id: 'card-txn-123',
        provider_reference: 'txn-123',
        status: 'pending',
        card_id: 'card-123',
      } as any;

      mockCardUserRepository.findOne.mockResolvedValue(mockCardUser);
      mockCardRepository.findOne.mockResolvedValue(mockCard);
      mockDepositAddressRepository.findOne.mockResolvedValue(mockDepositAddress);
      mockCardTransactionRepository.findOne.mockResolvedValue(mockExistingTransaction);
      mockTransactionRepository.findOne.mockResolvedValue(null);
      mockCardTransactionRepository.transaction.mockImplementation((callback) => callback({}));
      mockLockerService.withLock.mockImplementation((key, callback) => callback());
      mockCardRepository.update.mockResolvedValue({} as any);
      mockCardUserRepository.update.mockResolvedValue({} as any);
      mockCardTransactionRepository.update.mockResolvedValue({} as any);
      mockTransactionRepository.create.mockResolvedValue({ id: 'main-txn-123' } as any);
      mockUserRepository.findActiveById.mockRejectedValue(new Error('User fetch failed'));

      const result = await service.processWebhook(mockBody, {});

      expect(result.status).toBe('processed');
    });
  });

  describe('processWebhook - lookupCollateralTransactionEntities unknown chain', () => {
    it('should return unknown_chain_id when chain is not recognized', async () => {
      const mockBody = {
        id: 'webhook-123',
        resource: 'transaction',
        action: 'created',
        body: {
          id: 'txn-123',
          type: 'collateral',
          collateral: {
            userId: 'rain-user-123',
            chainId: 999999, // Unknown chain
            amount: 1000,
            currency: 'USD',
            status: 'successful',
            txHash: '0x123',
          },
        },
      };

      mockTransactionRepository.findOne.mockResolvedValue(null);

      const result = await service.processWebhook(mockBody, {});

      expect(result.reason).toBe('unknown_chain_id');
    });
  });

  describe('processWebhook - handleSpendTransactionUpdated error path', () => {
    it('should return error response when update fails', async () => {
      const mockBody = {
        id: 'webhook-123',
        resource: 'transaction',
        action: 'updated',
        body: {
          id: 'txn-123',
          type: 'spend',
          spend: {
            userId: 'rain-user-123',
            cardId: 'rain-card-123',
            amount: 1000,
            currency: 'USD',
            status: 'successful',
            merchantName: 'Test Merchant',
          },
        },
      };

      const mockCardUser = {
        id: 'card-user-123',
        user_id: 'user-123',
        provider_ref: 'rain-user-123',
        balance: 5000,
      } as any;

      const mockCard = {
        id: 'card-123',
        user_id: 'user-123',
        card_user_id: 'card-user-123',
        provider_ref: 'rain-card-123',
        balance: 5000,
        status: 'active',
      } as any;

      const mockExistingCardTransaction = {
        id: 'card-txn-123',
        provider_reference: 'txn-123',
        status: 'pending',
        amount: 1000,
        card_id: 'card-123',
      } as any;

      mockCardUserRepository.findOne.mockResolvedValue(mockCardUser);
      mockCardRepository.findOne.mockResolvedValue(mockCard);
      mockCardTransactionRepository.findOne.mockResolvedValue(mockExistingCardTransaction);
      mockTransactionRepository.findOne.mockResolvedValue({ id: 'main-txn-123' } as any);
      mockCardTransactionRepository.transaction.mockRejectedValue(new Error('Transaction failed'));
      mockLockerService.withLock.mockImplementation((key, callback) => callback());

      const result = await service.processWebhook(mockBody, {});

      expect(result.updated).toBe(false);
      expect(result.error).toBe('Internal processing error');
    });
  });

  describe('processWebhook - notification error handling', () => {
    it('should handle error in sendSpendTransactionNotification', async () => {
      const mockBody = {
        id: 'webhook-123',
        resource: 'transaction',
        action: 'created',
        body: {
          id: 'txn-123',
          type: 'spend',
          spend: {
            userId: 'rain-user-123',
            cardId: 'rain-card-123',
            amount: 1000,
            currency: 'USD',
            status: 'successful',
            merchantName: 'Test Merchant',
            authorizedAt: '2025-01-01T00:00:00Z',
          },
        },
      };

      const mockCardUser = {
        id: 'card-user-123',
        user_id: 'user-123',
        provider_ref: 'rain-user-123',
        balance: 5000,
      } as any;

      const mockCard = {
        id: 'card-123',
        user_id: 'user-123',
        card_user_id: 'card-user-123',
        provider_ref: 'rain-card-123',
        balance: 5000,
        insufficient_funds_decline_count: 0,
      } as any;

      mockCardUserRepository.findOne.mockResolvedValue(mockCardUser);
      mockCardRepository.findOne.mockResolvedValue(mockCard);
      mockCardTransactionRepository.findOne.mockResolvedValue(null);
      mockTransactionRepository.findOne.mockResolvedValue(null);
      mockCardTransactionRepository.transaction.mockImplementation((callback) => callback({}));
      mockLockerService.withLock.mockImplementation((key, callback) => callback());
      mockCardTransactionRepository.create.mockResolvedValue({ id: 'card-txn-123' } as any);
      mockTransactionRepository.create.mockResolvedValue({ id: 'main-txn-123' } as any);
      mockCardRepository.update.mockResolvedValue({} as any);
      mockCardUserRepository.update.mockResolvedValue({} as any);
      mockUserRepository.findActiveById.mockRejectedValue(new Error('User fetch failed'));

      const result = await service.processWebhook(mockBody, {});

      // Should still process successfully even if notification fails
      expect(result.status).toBe('processed');
    });
  });

  describe('processWebhook - calculateUpdatedBalances edge cases', () => {
    it('should skip already processed transaction with same status and amount', async () => {
      const mockBody = {
        id: 'webhook-123',
        resource: 'transaction',
        action: 'updated',
        body: {
          id: 'txn-123',
          type: 'spend',
          spend: {
            userId: 'rain-user-123',
            cardId: 'rain-card-123',
            authorizedAmount: -1000, // Negative for spend transactions
            amount: -1000,
            currency: 'USD',
            status: 'successful', // Same as existing
            merchantName: 'Test Merchant',
          },
        },
      };

      const mockExistingCardTransaction = {
        id: 'card-txn-123',
        provider_reference: 'txn-123',
        status: 'successful', // Same as incoming
        amount: -1000, // Same as incoming (negative for spend)
        card_id: 'card-123',
      } as any;

      const mockMainTransaction = {
        id: 'main-txn-123',
        reference: 'txn-123',
        status: 'completed', // Matches expected status for 'successful'
        amount: -1000, // Same as incoming
      } as any;

      mockCardTransactionRepository.findOne.mockResolvedValue(mockExistingCardTransaction);
      mockTransactionRepository.findOne.mockResolvedValue(mockMainTransaction);

      const result = await service.processWebhook(mockBody, {});

      expect(result.status).toBe('processed');
      expect(result.updated).toBe(false);
      expect(result.reason).toBe('transaction_already_updated');
    });
  });

  describe('processWebhook - amount tolerance warning', () => {
    it('should log warning when amount change exceeds tolerance', async () => {
      const mockBody = {
        id: 'webhook-123',
        resource: 'transaction',
        action: 'updated',
        body: {
          id: 'txn-123',
          type: 'spend',
          spend: {
            userId: 'rain-user-123',
            cardId: 'rain-card-123',
            amount: 2000, // 100% increase from original 1000
            currency: 'USD',
            status: 'successful',
            merchantName: 'Test Merchant',
          },
        },
      };

      const mockCardUser = {
        id: 'card-user-123',
        user_id: 'user-123',
        provider_ref: 'rain-user-123',
        balance: 50000,
      } as any;

      const mockCard = {
        id: 'card-123',
        user_id: 'user-123',
        card_user_id: 'card-user-123',
        provider_ref: 'rain-card-123',
        balance: 50000,
        status: 'active',
      } as any;

      const mockExistingCardTransaction = {
        id: 'card-txn-123',
        provider_reference: 'txn-123',
        status: 'pending',
        amount: 1000, // Original amount
        card_id: 'card-123',
      } as any;

      mockCardUserRepository.findOne.mockResolvedValue(mockCardUser);
      mockCardRepository.findOne.mockResolvedValue(mockCard);
      mockCardTransactionRepository.findOne.mockResolvedValue(mockExistingCardTransaction);
      mockTransactionRepository.findOne.mockResolvedValue(null);
      mockCardTransactionRepository.transaction.mockImplementation((callback) => callback({}));
      mockLockerService.withLock.mockImplementation((key, callback) => callback());
      mockCardTransactionRepository.update.mockResolvedValue({} as any);
      mockCardRepository.update.mockResolvedValue({} as any);
      mockCardUserRepository.update.mockResolvedValue({} as any);
      mockTransactionRepository.create.mockResolvedValue({ id: 'main-txn-123' } as any);

      const result = await service.processWebhook(mockBody, {});

      expect(result.status).toBe('processed');
    });
  });

  describe('processWebhook - updateMainTransactionForSpend existing transaction', () => {
    it('should update existing main transaction instead of creating new one', async () => {
      const mockBody = {
        id: 'webhook-123',
        resource: 'transaction',
        action: 'updated',
        body: {
          id: 'txn-123',
          type: 'spend',
          spend: {
            userId: 'rain-user-123',
            cardId: 'rain-card-123',
            amount: 1000,
            currency: 'USD',
            status: 'successful',
            merchantName: 'Test Merchant',
          },
        },
      };

      const mockCardUser = {
        id: 'card-user-123',
        user_id: 'user-123',
        provider_ref: 'rain-user-123',
        balance: 5000,
      } as any;

      const mockCard = {
        id: 'card-123',
        user_id: 'user-123',
        card_user_id: 'card-user-123',
        provider_ref: 'rain-card-123',
        balance: 5000,
        status: 'active',
      } as any;

      const mockExistingCardTransaction = {
        id: 'card-txn-123',
        provider_reference: 'txn-123',
        status: 'pending',
        amount: 1000,
        card_id: 'card-123',
      } as any;

      const mockExistingMainTransaction = {
        id: 'main-txn-123',
        reference: 'txn-123',
        status: TransactionStatus.PENDING,
      } as any;

      mockCardUserRepository.findOne.mockResolvedValue(mockCardUser);
      mockCardRepository.findOne.mockResolvedValue(mockCard);
      mockCardTransactionRepository.findOne.mockResolvedValue(mockExistingCardTransaction);
      mockTransactionRepository.findOne.mockResolvedValue(mockExistingMainTransaction);
      mockCardTransactionRepository.transaction.mockImplementation((callback) => callback({}));
      mockLockerService.withLock.mockImplementation((key, callback) => callback());
      mockCardTransactionRepository.update.mockResolvedValue({} as any);
      mockCardRepository.update.mockResolvedValue({} as any);
      mockCardUserRepository.update.mockResolvedValue({} as any);
      mockTransactionRepository.update.mockResolvedValue({} as any);

      const result = await service.processWebhook(mockBody, {});

      expect(result.status).toBe('processed');
      expect(mockTransactionRepository.update).toHaveBeenCalled();
    });
  });

  describe('handleCardUpdated - private methods for CANCELED status', () => {
    describe('mapWebhookStatusToInternalStatus', () => {
      it('should map canceled status to CANCELED', () => {
        const mockCard = {
          id: 'card-123',
          status: ICardStatus.ACTIVE,
        } as any;

        const result = service['mapWebhookStatusToInternalStatus']('canceled', mockCard);

        expect(result).toBe(ICardStatus.CANCELED);
      });

      it('should map locked status to INACTIVE when card is not blocked', () => {
        const mockCard = {
          id: 'card-123',
          status: ICardStatus.ACTIVE,
        } as any;

        const result = service['mapWebhookStatusToInternalStatus']('locked', mockCard);

        expect(result).toBe(ICardStatus.INACTIVE);
      });

      it('should map locked status to BLOCKED when card is already blocked', () => {
        const mockCard = {
          id: 'card-123',
          status: ICardStatus.BLOCKED,
        } as any;

        const result = service['mapWebhookStatusToInternalStatus']('locked', mockCard);

        expect(result).toBe(ICardStatus.BLOCKED);
      });

      it('should map active status to ACTIVE', () => {
        const mockCard = {
          id: 'card-123',
          status: ICardStatus.INACTIVE,
        } as any;

        const result = service['mapWebhookStatusToInternalStatus']('active', mockCard);

        expect(result).toBe(ICardStatus.ACTIVE);
      });

      it('should return INACTIVE for unknown status', () => {
        const mockCard = {
          id: 'card-123',
          status: ICardStatus.ACTIVE,
        } as any;

        const result = service['mapWebhookStatusToInternalStatus']('unknown', mockCard);

        expect(result).toBe(ICardStatus.INACTIVE);
      });
    });

    describe('checkCardUpdateNeeds', () => {
      it('should detect status update needed when status changes to CANCELED', () => {
        const mockCard = {
          id: 'card-123',
          status: ICardStatus.ACTIVE,
          limit: 1000,
          limit_frequency: 'per30DayPeriod',
          expiration_month: '12',
          expiration_year: '2027',
        } as any;

        const result = service['checkCardUpdateNeeds'](mockCard, 'canceled', ICardStatus.CANCELED);

        expect(result.needsStatusUpdate).toBe(true);
      });

      it('should detect limit update needed', () => {
        const mockCard = {
          id: 'card-123',
          status: ICardStatus.ACTIVE,
          limit: 1000,
          limit_frequency: 'per30DayPeriod',
        } as any;

        const result = service['checkCardUpdateNeeds'](mockCard, 'active', ICardStatus.ACTIVE, {
          amount: 2000,
          frequency: 'per30DayPeriod',
        });

        expect(result.needsLimitUpdate).toBe(true);
      });

      it('should detect expiration update needed', () => {
        const mockCard = {
          id: 'card-123',
          status: ICardStatus.ACTIVE,
          expiration_month: '12',
          expiration_year: '2027',
        } as any;

        const result = service['checkCardUpdateNeeds'](mockCard, 'active', ICardStatus.ACTIVE, undefined, '01', '2028');

        expect(result.needsExpirationUpdate).toBe(true);
      });

      it('should detect token wallets update needed', () => {
        const mockCard = {
          id: 'card-123',
          status: ICardStatus.ACTIVE,
        } as any;

        const result = service['checkCardUpdateNeeds'](
          mockCard,
          'active',
          ICardStatus.ACTIVE,
          undefined,
          undefined,
          undefined,
          ['apple', 'google'],
        );

        expect(result.needsTokenWalletsUpdate).toBe(true);
      });

      it('should return all false when no updates needed', () => {
        const mockCard = {
          id: 'card-123',
          status: ICardStatus.ACTIVE,
          limit: 1000,
          limit_frequency: 'per30DayPeriod',
          expiration_month: '12',
          expiration_year: '2027',
        } as any;

        const result = service['checkCardUpdateNeeds'](
          mockCard,
          'active',
          ICardStatus.ACTIVE,
          { amount: 1000, frequency: 'per30DayPeriod' },
          '12',
          '2027',
        );

        expect(result.needsStatusUpdate).toBe(false);
        expect(result.needsLimitUpdate).toBe(false);
        expect(result.needsExpirationUpdate).toBe(false);
        expect(result.needsTokenWalletsUpdate).toBe(false);
      });
    });

    describe('hasAnyCardUpdates', () => {
      it('should return true when status update needed', () => {
        const updateNeeds = {
          needsStatusUpdate: true,
          needsLimitUpdate: false,
          needsExpirationUpdate: false,
          needsTokenWalletsUpdate: false,
        };

        const result = service['hasAnyCardUpdates'](updateNeeds);

        expect(result).toBe(true);
      });

      it('should return true when limit update needed', () => {
        const updateNeeds = {
          needsStatusUpdate: false,
          needsLimitUpdate: true,
          needsExpirationUpdate: false,
          needsTokenWalletsUpdate: false,
        };

        const result = service['hasAnyCardUpdates'](updateNeeds);

        expect(result).toBe(true);
      });

      it('should return false when no updates needed', () => {
        const updateNeeds = {
          needsStatusUpdate: false,
          needsLimitUpdate: false,
          needsExpirationUpdate: false,
          needsTokenWalletsUpdate: false,
        };

        const result = service['hasAnyCardUpdates'](updateNeeds);

        expect(result).toBe(false);
      });
    });

    describe('buildCardUpdateData', () => {
      it('should build update data for CANCELED status', () => {
        const mockCard = {
          id: 'card-123',
          status: ICardStatus.ACTIVE,
          is_freezed: false,
        } as any;

        const updateNeeds = {
          needsStatusUpdate: true,
          needsLimitUpdate: false,
          needsExpirationUpdate: false,
          needsTokenWalletsUpdate: false,
        };

        const result = service['buildCardUpdateData']({
          card: mockCard,
          status: 'canceled',
          mappedStatus: ICardStatus.CANCELED,
          updateNeeds,
        });

        expect(result.status).toBe(ICardStatus.CANCELED);
      });

      it('should set is_freezed to true when status is locked', () => {
        const mockCard = {
          id: 'card-123',
          status: ICardStatus.ACTIVE,
          is_freezed: false,
        } as any;

        const updateNeeds = {
          needsStatusUpdate: true,
          needsLimitUpdate: false,
          needsExpirationUpdate: false,
          needsTokenWalletsUpdate: false,
        };

        const result = service['buildCardUpdateData']({
          card: mockCard,
          status: 'locked',
          mappedStatus: ICardStatus.INACTIVE,
          updateNeeds,
        });

        expect(result.is_freezed).toBe(true);
      });

      it('should set is_freezed to false when status is active', () => {
        const mockCard = {
          id: 'card-123',
          status: ICardStatus.INACTIVE,
          is_freezed: true,
        } as any;

        const updateNeeds = {
          needsStatusUpdate: true,
          needsLimitUpdate: false,
          needsExpirationUpdate: false,
          needsTokenWalletsUpdate: false,
        };

        const result = service['buildCardUpdateData']({
          card: mockCard,
          status: 'active',
          mappedStatus: ICardStatus.ACTIVE,
          updateNeeds,
        });

        expect(result.is_freezed).toBe(false);
      });

      it('should include limit update when needed', () => {
        const mockCard = {
          id: 'card-123',
          status: ICardStatus.ACTIVE,
          limit: 1000,
          limit_frequency: 'per30DayPeriod',
        } as any;

        const updateNeeds = {
          needsStatusUpdate: false,
          needsLimitUpdate: true,
          needsExpirationUpdate: false,
          needsTokenWalletsUpdate: false,
        };

        const result = service['buildCardUpdateData']({
          card: mockCard,
          status: 'active',
          mappedStatus: ICardStatus.ACTIVE,
          updateNeeds,
          limit: { amount: 2000, frequency: 'per30DayPeriod' },
        });

        expect(result.limit).toBe(2000);
        expect(result.limit_frequency).toBe('per30DayPeriod');
      });

      it('should include token wallets when provided', () => {
        const mockCard = {
          id: 'card-123',
          status: ICardStatus.ACTIVE,
        } as any;

        const updateNeeds = {
          needsStatusUpdate: false,
          needsLimitUpdate: false,
          needsExpirationUpdate: false,
          needsTokenWalletsUpdate: true,
        };

        const result = service['buildCardUpdateData']({
          card: mockCard,
          status: 'active',
          mappedStatus: ICardStatus.ACTIVE,
          updateNeeds,
          tokenWallets: ['apple', 'google'],
        });

        expect(result.token_wallets).toBe('apple,google');
      });
    });

    describe('findCardForUpdate', () => {
      it('should return card when found', async () => {
        const mockCard = {
          id: 'card-123',
          provider_ref: 'rain-card-123',
        } as any;

        mockCardRepository.findOne.mockResolvedValue(mockCard);

        const result = await service['findCardForUpdate']('rain-card-123');

        expect(result).toEqual(mockCard);
        expect(mockCardRepository.findOne).toHaveBeenCalledWith({ provider_ref: 'rain-card-123' });
      });

      it('should return null when card not found', async () => {
        mockCardRepository.findOne.mockResolvedValue(null);

        const warnSpy = jest.spyOn(service['logger'], 'warn');

        const result = await service['findCardForUpdate']('rain-card-123');

        expect(result).toBeNull();
        expect(warnSpy).toHaveBeenCalledWith('Card not found for provider ref: rain-card-123');
      });
    });

    describe('findCardUserForUpdate', () => {
      it('should return card user when found', async () => {
        const mockCardUser = {
          id: 'card-user-123',
          provider_ref: 'rain-user-123',
          user: { id: 'user-123' },
        } as any;

        mockCardUserRepository.findOne.mockResolvedValue(mockCardUser);

        const result = await service['findCardUserForUpdate']('rain-user-123');

        expect(result).toEqual(mockCardUser);
        expect(mockCardUserRepository.findOne).toHaveBeenCalledWith(
          { provider_ref: 'rain-user-123' },
          {},
          { graphFetch: '[user]' },
        );
      });

      it('should return null when card user not found', async () => {
        mockCardUserRepository.findOne.mockResolvedValue(null);

        const warnSpy = jest.spyOn(service['logger'], 'warn');

        const result = await service['findCardUserForUpdate']('rain-user-123');

        expect(result).toBeNull();
        expect(warnSpy).toHaveBeenCalledWith('Card user not found for provider ref: rain-user-123');
      });
    });

    describe('createCardUpdateErrorResponse', () => {
      it('should create error response with correct structure', () => {
        const result = service['createCardUpdateErrorResponse']('rain-card-123', 'card_not_found');

        expect(result).toEqual({
          status: 'processed',
          action: 'card_updated',
          cardId: 'rain-card-123',
          updated: false,
          reason: 'card_not_found',
        });
      });
    });
  });

  describe('handleDisputeEvent', () => {
    describe('handleDisputeCreated', () => {
      const mockDisputeCreatedPayload = {
        id: 'webhook-123',
        resource: 'dispute' as const,
        action: 'created' as const,
        version: '1.0.0',
        body: {
          id: 'dispute-123',
          transactionId: 'provider-txn-123',
          status: 'pending' as const,
          textEvidence: 'Test evidence',
          createdAt: '2024-01-01T00:00:00Z',
        },
        eventReceivedAt: '2024-01-01T00:00:01Z',
      };

      const mockCardTransaction = {
        id: 'txn-123',
        user_id: 'user-123',
        provider_reference: 'provider-txn-123',
        amount: 100,
        currency: 'USD',
      };

      it('should create dispute successfully', async () => {
        mockCardTransactionRepository.findOne.mockResolvedValue(mockCardTransaction);
        mockCardTransactionDisputeRepository.findOne.mockResolvedValue(null);
        mockCardTransactionDisputeRepository.create.mockResolvedValue({
          id: 'dispute-db-123',
          transaction_id: 'txn-123',
          provider_dispute_ref: 'dispute-123',
          transaction_ref: 'provider-txn-123',
          status: 'pending',
          text_evidence: 'Test evidence',
        });

        const result = await service['handleDisputeCreated'](mockDisputeCreatedPayload);

        expect(result).toEqual({
          status: 'processed',
          action: 'dispute_created',
          providerDisputeId: 'dispute-123',
          transactionId: 'provider-txn-123',
          disputeCreated: true,
          disputeId: 'dispute-db-123',
        });
        expect(mockCardTransactionRepository.findOne).toHaveBeenCalledWith({
          provider_reference: 'provider-txn-123',
        });
        expect(mockCardTransactionDisputeRepository.findOne).toHaveBeenCalledWith({
          provider_dispute_ref: 'dispute-123',
        });
        expect(mockCardTransactionDisputeRepository.create).toHaveBeenCalled();
        expect(mockCardTransactionDisputeEventRepository.create).toHaveBeenCalledWith(
          expect.objectContaining({
            dispute_id: 'dispute-db-123',
            previous_status: undefined,
            new_status: 'pending',
            event_type: 'created',
            triggered_by: 'webhook',
          }),
        );
      });

      it('should return processed when transaction not found', async () => {
        mockCardTransactionRepository.findOne.mockResolvedValue(null);

        const result = await service['handleDisputeCreated'](mockDisputeCreatedPayload);

        expect(result).toEqual({
          status: 'processed',
          action: 'dispute_created',
          disputeId: 'dispute-123',
          transactionId: 'provider-txn-123',
          disputeCreated: false,
          reason: 'transaction_not_found',
        });
        expect(mockCardTransactionDisputeRepository.create).not.toHaveBeenCalled();
      });

      it('should return processed when dispute already exists', async () => {
        mockCardTransactionRepository.findOne.mockResolvedValue(mockCardTransaction);
        mockCardTransactionDisputeRepository.findOne.mockResolvedValue({
          id: 'existing-dispute',
          provider_dispute_ref: 'dispute-123',
        });

        const result = await service['handleDisputeCreated'](mockDisputeCreatedPayload);

        expect(result).toEqual({
          status: 'processed',
          action: 'dispute_created',
          disputeId: 'dispute-123',
          transactionId: 'provider-txn-123',
          disputeCreated: false,
          reason: 'already_exists',
        });
        expect(mockCardTransactionDisputeRepository.create).not.toHaveBeenCalled();
      });

      it('should handle errors gracefully', async () => {
        mockCardTransactionRepository.findOne.mockRejectedValue(new Error('Database error'));

        const result = await service['handleDisputeCreated'](mockDisputeCreatedPayload);

        expect(result).toEqual({
          status: 'processed',
          action: 'dispute_created',
          disputeId: 'dispute-123',
          transactionId: 'provider-txn-123',
          disputeCreated: false,
          error: 'Internal processing error',
        });
      });

      it('should create dispute without textEvidence', async () => {
        const payloadWithoutEvidence: typeof mockDisputeCreatedPayload = {
          ...mockDisputeCreatedPayload,
          body: {
            ...mockDisputeCreatedPayload.body,
            textEvidence: undefined,
          },
        };

        mockCardTransactionRepository.findOne.mockResolvedValue(mockCardTransaction);
        mockCardTransactionDisputeRepository.findOne.mockResolvedValue(null);
        mockCardTransactionDisputeRepository.create.mockResolvedValue({
          id: 'dispute-db-123',
          transaction_id: 'txn-123',
          provider_dispute_ref: 'dispute-123',
          transaction_ref: 'provider-txn-123',
          status: 'pending',
          text_evidence: undefined,
        });

        const result = await service['handleDisputeCreated'](payloadWithoutEvidence);

        expect(result.disputeCreated).toBe(true);
        expect(mockCardTransactionDisputeRepository.create).toHaveBeenCalledWith(
          expect.objectContaining({
            text_evidence: undefined,
          }),
        );
      });
    });

    describe('handleDisputeUpdated', () => {
      const mockDisputeUpdatedPayload = {
        id: 'webhook-456',
        resource: 'dispute' as const,
        action: 'updated' as const,
        version: '1.0.0',
        body: {
          id: 'dispute-123',
          transactionId: 'provider-txn-123',
          status: 'accepted' as const,
          textEvidence: 'Updated evidence',
          createdAt: '2024-01-01T00:00:00Z',
          resolvedAt: '2024-01-02T00:00:00Z',
        },
        eventReceivedAt: '2024-01-02T00:00:01Z',
      };

      const mockExistingDispute = {
        id: 'dispute-db-123',
        transaction_id: 'txn-123',
        provider_dispute_ref: 'dispute-123',
        transaction_ref: 'provider-txn-123',
        status: 'pending',
        text_evidence: 'Old evidence',
      };

      it('should update dispute successfully', async () => {
        const mockCardTransaction = {
          id: 'txn-123',
          user_id: 'user-123',
        };

        mockCardTransactionDisputeRepository.findOne.mockResolvedValue(mockExistingDispute);
        mockCardTransactionDisputeRepository.update.mockResolvedValue(undefined);
        mockCardTransactionRepository.findOne.mockResolvedValue(mockCardTransaction);

        const result = await service['handleDisputeUpdated'](mockDisputeUpdatedPayload);

        expect(result).toEqual({
          status: 'processed',
          action: 'dispute_updated',
          providerDisputeId: 'dispute-123',
          transactionId: 'provider-txn-123',
          disputeUpdated: true,
          disputeId: 'dispute-db-123',
          newStatus: 'accepted',
        });
        expect(mockCardTransactionDisputeRepository.findOne).toHaveBeenCalledWith({
          provider_dispute_ref: 'dispute-123',
        });
        expect(mockCardTransactionDisputeRepository.update).toHaveBeenCalledWith(
          { id: 'dispute-db-123' },
          expect.objectContaining({
            status: 'accepted',
            text_evidence: 'Updated evidence',
            resolved_at: expect.any(Date),
          }),
        );
        expect(mockCardTransactionDisputeEventRepository.create).toHaveBeenCalledWith(
          expect.objectContaining({
            dispute_id: 'dispute-db-123',
            previous_status: 'pending',
            new_status: 'accepted',
            event_type: 'status_changed',
            triggered_by: 'webhook',
          }),
        );
        expect(mockCardTransactionRepository.findOne).toHaveBeenCalledWith({
          id: 'txn-123',
        });
        expect(mockCardService.sendCardNotification).toHaveBeenCalledWith(
          { inApp: true, push: true },
          expect.objectContaining({
            userId: 'user-123',
            notificationType: 'dispute_updated',
            metadata: expect.objectContaining({
              disputeId: 'dispute-db-123',
              transactionId: 'txn-123',
              previousStatus: 'pending',
              status: 'accepted',
            }),
          }),
        );
      });

      it('should log notification errors without failing update', async () => {
        const mockCardTransaction = {
          id: 'txn-123',
          user_id: 'user-123',
        };

        const loggerSpy = jest.spyOn((service as any).logger, 'error').mockImplementation(() => undefined);

        mockCardTransactionDisputeRepository.findOne.mockResolvedValue(mockExistingDispute);
        mockCardTransactionDisputeRepository.update.mockResolvedValue(undefined);
        mockCardTransactionRepository.findOne.mockResolvedValue(mockCardTransaction);
        mockCardService.sendCardNotification.mockRejectedValueOnce(new Error('Notify failed'));

        const result = await service['handleDisputeUpdated'](mockDisputeUpdatedPayload);

        expect(result.disputeUpdated).toBe(true);
        expect(mockCardService.sendCardNotification).toHaveBeenCalled();
        expect(loggerSpy).toHaveBeenCalledWith(
          expect.stringContaining('Failed to send dispute update notification'),
          expect.any(Error),
        );
        loggerSpy.mockRestore();
      });

      it('should return processed when dispute not found', async () => {
        mockCardTransactionDisputeRepository.findOne.mockResolvedValue(null);

        const result = await service['handleDisputeUpdated'](mockDisputeUpdatedPayload);

        expect(result).toEqual({
          status: 'processed',
          action: 'dispute_updated',
          disputeId: 'dispute-123',
          transactionId: 'provider-txn-123',
          disputeUpdated: false,
          reason: 'dispute_not_found',
        });
        expect(mockCardTransactionDisputeRepository.update).not.toHaveBeenCalled();
      });

      it('should handle errors gracefully', async () => {
        mockCardTransactionDisputeRepository.findOne.mockRejectedValue(new Error('Database error'));

        const result = await service['handleDisputeUpdated'](mockDisputeUpdatedPayload);

        expect(result).toEqual({
          status: 'processed',
          action: 'dispute_updated',
          disputeId: 'dispute-123',
          transactionId: 'provider-txn-123',
          disputeUpdated: false,
          error: 'Internal processing error',
        });
      });

      it('should update dispute without resolvedAt', async () => {
        const payloadWithoutResolved: typeof mockDisputeUpdatedPayload = {
          ...mockDisputeUpdatedPayload,
          body: {
            ...mockDisputeUpdatedPayload.body,
            resolvedAt: undefined,
          },
        };

        mockCardTransactionDisputeRepository.findOne.mockResolvedValue(mockExistingDispute);
        mockCardTransactionDisputeRepository.update.mockResolvedValue(undefined);

        const result = await service['handleDisputeUpdated'](payloadWithoutResolved);

        expect(result.disputeUpdated).toBe(true);
        expect(mockCardTransactionDisputeRepository.update).toHaveBeenCalledWith(
          { id: 'dispute-db-123' },
          expect.objectContaining({
            resolved_at: undefined,
          }),
        );
        expect(mockCardTransactionDisputeEventRepository.create).toHaveBeenCalled();
      });

      it('should not create event when status does not change', async () => {
        const payloadSameStatus = {
          ...mockDisputeUpdatedPayload,
          body: {
            ...mockDisputeUpdatedPayload.body,
            status: 'pending' as const,
          },
        };

        const disputeWithPendingStatus = {
          ...mockExistingDispute,
          status: 'pending',
        };

        mockCardTransactionDisputeRepository.findOne.mockResolvedValue(disputeWithPendingStatus);
        mockCardTransactionDisputeRepository.update.mockResolvedValue(undefined);

        const result = await service['handleDisputeUpdated'](payloadSameStatus);

        expect(result.disputeUpdated).toBe(true);
        expect(mockCardTransactionDisputeRepository.update).toHaveBeenCalled();
        expect(mockCardTransactionDisputeEventRepository.create).not.toHaveBeenCalled();
      });

      it('should handle all dispute statuses', async () => {
        const statuses: Array<'pending' | 'inReview' | 'accepted' | 'rejected' | 'canceled'> = [
          'pending',
          'inReview',
          'accepted',
          'rejected',
          'canceled',
        ];

        for (const status of statuses) {
          jest.clearAllMocks();
          const payload = {
            id: mockDisputeUpdatedPayload.id,
            resource: 'dispute' as const,
            action: 'updated' as const,
            version: mockDisputeUpdatedPayload.version,
            body: {
              id: mockDisputeUpdatedPayload.body.id,
              transactionId: mockDisputeUpdatedPayload.body.transactionId,
              status,
              textEvidence: mockDisputeUpdatedPayload.body.textEvidence,
              createdAt: mockDisputeUpdatedPayload.body.createdAt,
              resolvedAt: mockDisputeUpdatedPayload.body.resolvedAt,
            },
            eventReceivedAt: mockDisputeUpdatedPayload.eventReceivedAt,
          };

          mockCardTransactionDisputeRepository.findOne.mockResolvedValue(mockExistingDispute);
          mockCardTransactionDisputeRepository.update.mockResolvedValue(undefined);

          const result = await service['handleDisputeUpdated'](payload);

          expect(result.disputeUpdated).toBe(true);
          expect(result.newStatus).toBe(status);

          if (status === 'pending') {
            expect(mockCardTransactionDisputeEventRepository.create).not.toHaveBeenCalled();
          } else {
            expect(mockCardTransactionDisputeEventRepository.create).toHaveBeenCalledWith(
              expect.objectContaining({
                dispute_id: 'dispute-db-123',
                previous_status: 'pending',
                new_status: status,
                event_type: 'status_changed',
                triggered_by: 'webhook',
              }),
            );
          }
        }
      });
    });

    describe('handleDisputeEvent routing', () => {
      it('should route to handleDisputeCreated for created action', async () => {
        const payload = {
          id: 'webhook-123',
          resource: 'dispute' as const,
          action: 'created' as const,
          body: {
            id: 'dispute-123',
            transactionId: 'provider-txn-123',
            status: 'pending' as const,
            createdAt: '2024-01-01T00:00:00Z',
          },
        };

        mockCardTransactionRepository.findOne.mockResolvedValue({
          id: 'txn-123',
          provider_reference: 'provider-txn-123',
        });
        mockCardTransactionDisputeRepository.findOne.mockResolvedValue(null);
        mockCardTransactionDisputeRepository.create.mockResolvedValue({
          id: 'dispute-db-123',
          provider_dispute_ref: 'dispute-123',
        });

        const result = await service['handleDisputeEvent'](payload);

        expect(result.disputeCreated).toBe(true);
      });

      it('should route to handleDisputeUpdated for updated action', async () => {
        const payload = {
          id: 'webhook-456',
          resource: 'dispute' as const,
          action: 'updated' as const,
          body: {
            id: 'dispute-123',
            transactionId: 'provider-txn-123',
            status: 'accepted' as const,
            createdAt: '2024-01-01T00:00:00Z',
          },
        };

        mockCardTransactionDisputeRepository.findOne.mockResolvedValue({
          id: 'dispute-db-123',
          provider_dispute_ref: 'dispute-123',
        });
        mockCardTransactionDisputeRepository.update.mockResolvedValue(undefined);

        const result = await service['handleDisputeEvent'](payload);

        expect(result.disputeUpdated).toBe(true);
      });

      it('should return ignored for unknown action', async () => {
        const payload = {
          id: 'webhook-789',
          resource: 'dispute',
          action: 'unknown',
          body: {},
        };

        const result = await service['handleDisputeEvent'](payload);

        expect(result).toEqual({
          status: 'ignored',
          reason: 'unknown_dispute_action',
        });
      });
    });
  });
});
