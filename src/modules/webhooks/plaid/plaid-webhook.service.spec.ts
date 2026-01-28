import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { PlaidWebhookService } from './plaid-webhook.service';
import { InAppNotificationService } from '../../inAppNotification/inAppNotification.service';
import { ExternalAccountService } from '../../externalAccount/external-account.service';
import { LinkBankAccountAdapter } from '../../../adapters/link-bank-account/link-bank-account.adapter';
import { ExternalAccountAdapter } from '../../../adapters/external-account/external-account.adapter';
import { RedisCacheService } from '../../../services/redis/redis-cache.service';
import { MailerService } from '../../../services/queue/processors/mailer/mailer.service';
import { UserRepository } from '../../auth/user/user.repository';

describe('PlaidWebhookService', () => {
  let service: PlaidWebhookService;
  let mockExternalAccountService: any;
  let mockLinkBankAccountAdapter: any;
  let mockExternalAccountAdapter: any;
  let mockRedisCacheService: any;
  let mockMailerService: any;
  let mockUserRepository: any;
  let mockInAppNotificationService: any;

  const mockExternalAccount = {
    id: 'ext-123',
    user_id: 'user-123',
    linked_item_ref: 'item-123',
    linked_access_token: 'access-token-123',
    linked_account_ref: 'account-ref-123',
    status: 'approved',
  };

  beforeEach(async () => {
    mockExternalAccountService = {
      findOne: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      createDuplicateRecord: jest.fn(),
    };

    mockLinkBankAccountAdapter = {
      createLinkToken: jest.fn(),
    };

    mockExternalAccountAdapter = {
      refreshUserAuthData: jest.fn(),
    };

    mockRedisCacheService = { get: jest.fn(), set: jest.fn(), del: jest.fn() };
    mockMailerService = { sendMail: jest.fn(), send: jest.fn() };
    mockUserRepository = { findById: jest.fn(), findActiveById: jest.fn() };
    mockInAppNotificationService = { createNotification: jest.fn(), create: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PlaidWebhookService,
        { provide: ExternalAccountService, useValue: mockExternalAccountService },
        { provide: LinkBankAccountAdapter, useValue: mockLinkBankAccountAdapter },
        { provide: ExternalAccountAdapter, useValue: mockExternalAccountAdapter },
        { provide: RedisCacheService, useValue: mockRedisCacheService },
        { provide: MailerService, useValue: mockMailerService },
        { provide: UserRepository, useValue: mockUserRepository },
        { provide: InAppNotificationService, useValue: mockInAppNotificationService },
      ],
    }).compile();

    service = module.get<PlaidWebhookService>(PlaidWebhookService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('handleWebhook', () => {
    it('should handle ITEM webhook types', async () => {
      const payload = {
        webhook_type: 'ITEM',
        webhook_code: 'PENDING_DISCONNECT',
        item_id: 'item-123',
      };

      mockExternalAccountService.findOne.mockResolvedValue(mockExternalAccount);
      mockExternalAccountService.update.mockResolvedValue({});

      await service.handleWebhook(payload);

      expect(mockExternalAccountService.findOne).toHaveBeenCalledWith({
        linked_item_ref: 'item-123',
      });
      expect(mockExternalAccountService.update).toHaveBeenCalledWith(
        { id: 'ext-123' },
        { status: 'pending_disconnect' },
      );
    });

    it('should handle AUTH webhook types', async () => {
      const payload = {
        webhook_type: 'AUTH',
        webhook_code: 'DEFAULT_UPDATE',
        item_id: 'item-123',
        account_ids_with_updated_auth: {},
      };

      await service.handleWebhook(payload);

      // Should return early when no accounts with updated auth
      expect(mockExternalAccountService.findOne).not.toHaveBeenCalled();
    });
  });

  describe('handleItemError', () => {
    it('should update external account status to lowercase when receiving ITEM_LOGIN_REQUIRED', async () => {
      mockExternalAccountService.findOne.mockResolvedValue(mockExternalAccount);
      mockExternalAccountService.update.mockResolvedValue({});
      mockLinkBankAccountAdapter.createLinkToken.mockResolvedValue({
        token: 'update-token-123',
        expiration: '2024-01-01T12:00:00Z',
        requestRef: 'req-123',
      });
      mockRedisCacheService.set.mockResolvedValue(undefined);
      mockUserRepository.findActiveById.mockResolvedValue({
        id: 'user-123',
        email: 'test@example.com',
        first_name: 'John',
      });
      mockMailerService.send.mockResolvedValue(undefined);
      mockInAppNotificationService.create.mockResolvedValue(undefined);

      await (service as any).handleItemError('item-123', 'ITEM_LOGIN_REQUIRED');

      expect(mockExternalAccountService.findOne).toHaveBeenCalledWith({
        linked_item_ref: 'item-123',
      });
      expect(mockExternalAccountService.update).toHaveBeenCalledWith(
        { id: 'ext-123' },
        { status: 'item_login_required' }, // Should be lowercase
      );
    });

    it('should throw NotFoundException when external account not found', async () => {
      mockExternalAccountService.findOne.mockResolvedValue(null);

      await expect((service as any).handleItemError('item-123', 'ITEM_LOGIN_REQUIRED')).rejects.toThrow(
        new NotFoundException('External account with item_id item-123 not found'),
      );

      expect(mockExternalAccountService.update).not.toHaveBeenCalled();
    });
  });

  describe('handlePendingDisconnect', () => {
    it('should update external account status to pending_disconnect', async () => {
      mockExternalAccountService.findOne.mockResolvedValue(mockExternalAccount);
      mockExternalAccountService.update.mockResolvedValue({});

      await (service as any).handlePendingDisconnect('item-123');

      expect(mockExternalAccountService.findOne).toHaveBeenCalledWith({
        linked_item_ref: 'item-123',
      });
      expect(mockExternalAccountService.update).toHaveBeenCalledWith(
        { id: 'ext-123' },
        { status: 'pending_disconnect' },
      );
    });

    it('should throw NotFoundException when external account not found', async () => {
      mockExternalAccountService.findOne.mockResolvedValue(null);

      await expect((service as any).handlePendingDisconnect('item-123')).rejects.toThrow(
        new NotFoundException('External account with item_id item-123 not found'),
      );

      expect(mockExternalAccountService.update).not.toHaveBeenCalled();
    });
  });

  describe('handleUserPermissionRevoked', () => {
    it('should soft delete external account and create duplicate', async () => {
      mockExternalAccountService.findOne.mockResolvedValue(mockExternalAccount);
      mockExternalAccountService.update.mockResolvedValue({});
      mockExternalAccountService.createDuplicateRecord.mockResolvedValue({});

      await (service as any).handleUserPermissionRevoked('item-123');

      expect(mockExternalAccountService.update).toHaveBeenCalledWith(
        { id: 'ext-123' },
        {
          status: 'user_permission_revoked',
        },
      );
      expect(mockExternalAccountService.delete).toHaveBeenCalledWith({ id: 'ext-123' });
      expect(mockExternalAccountService.createDuplicateRecord).toHaveBeenCalledWith(mockExternalAccount);
    });

    it('should throw NotFoundException when external account not found', async () => {
      mockExternalAccountService.findOne.mockResolvedValue(null);

      await expect((service as any).handleUserPermissionRevoked('item-123')).rejects.toThrow(
        new NotFoundException('External account with item_id item-123 not found'),
      );

      expect(mockExternalAccountService.update).not.toHaveBeenCalled();
      expect(mockExternalAccountService.createDuplicateRecord).not.toHaveBeenCalled();
    });
  });

  describe('handleUserAccountRevoked', () => {
    it('should soft delete external account and create duplicate', async () => {
      mockExternalAccountService.findOne.mockResolvedValue(mockExternalAccount);
      mockExternalAccountService.update.mockResolvedValue({});
      mockExternalAccountService.createDuplicateRecord.mockResolvedValue({});

      await (service as any).handleUserAccountRevoked('item-123');

      expect(mockExternalAccountService.update).toHaveBeenCalledWith(
        { id: 'ext-123' },
        {
          status: 'user_account_revoked',
        },
      );
      expect(mockExternalAccountService.delete).toHaveBeenCalledWith({ id: 'ext-123' });
      expect(mockExternalAccountService.createDuplicateRecord).toHaveBeenCalledWith(mockExternalAccount);
    });

    it('should throw NotFoundException when external account not found', async () => {
      mockExternalAccountService.findOne.mockResolvedValue(null);

      await expect((service as any).handleUserAccountRevoked('item-123')).rejects.toThrow(
        new NotFoundException('External account with item_id item-123 not found'),
      );

      expect(mockExternalAccountService.update).not.toHaveBeenCalled();
      expect(mockExternalAccountService.createDuplicateRecord).not.toHaveBeenCalled();
    });
  });

  describe('handleAuthDefaultUpdate', () => {
    it('should return early when no accounts with updated auth', async () => {
      const payload = {
        account_ids_with_updated_auth: {},
      };

      await (service as any).handleAuthDefaultUpdate('item-123', payload);

      expect(mockExternalAccountService.findOne).not.toHaveBeenCalled();
    });

    it('should refresh auth data when account has updates', async () => {
      const payload = {
        account_ids_with_updated_auth: {
          'account-ref-123': ['ACCOUNT_NUMBER'],
        },
      };

      const refreshResponse = {
        requestRef: 'req-123',
        accountNumber: '1234',
        routingNumber: '021000021',
        mask: '0000',
      };

      mockExternalAccountService.findOne.mockResolvedValue(mockExternalAccount);
      mockExternalAccountAdapter.refreshUserAuthData.mockResolvedValue(refreshResponse);
      mockExternalAccountService.update.mockResolvedValue({});

      await (service as any).handleAuthDefaultUpdate('item-123', payload);

      expect(mockExternalAccountAdapter.refreshUserAuthData).toHaveBeenCalledWith(
        {
          accessToken: 'access-token-123',
          accountRef: 'account-ref-123',
        },
        'US',
      );
      expect(mockExternalAccountService.update).toHaveBeenCalledWith(
        { id: 'ext-123' },
        {
          account_number: '0000',
          routing_number: '021000021',
          updated_at: expect.any(String),
        },
      );
    });

    it('should throw NotFoundException when external account not found', async () => {
      const payload = {
        account_ids_with_updated_auth: {
          'account-ref-123': ['ACCOUNT_NUMBER'],
        },
      };

      mockExternalAccountService.findOne.mockResolvedValue(null);

      await expect((service as any).handleAuthDefaultUpdate('item-123', payload)).rejects.toThrow(
        new NotFoundException('External account with item_id item-123 not found'),
      );

      expect(mockExternalAccountAdapter.refreshUserAuthData).not.toHaveBeenCalled();
    });
  });
});
