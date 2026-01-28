import { BadRequestException, HttpStatus } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { LinkBankAccountAdapter } from '../../../adapters/link-bank-account/link-bank-account.adapter';
import { UserModel } from '../../../database/models/user/user.model';
import { RedisCacheService } from '../../../services/redis/redis-cache.service';
import { InAppNotificationService } from '../../inAppNotification/inAppNotification.service';
import { MailerService } from '../../../services/queue/processors/mailer/mailer.service';

import { AppLoggerService } from '../../../services/logger/logger.service';
import { ExternalAccountService } from '../external-account.service';
import { PlaidLinkTokenExchangeDto } from './dto/link_external_account.dto';
import { LinkExternalAccountController } from './link_external_account.controller';
import { LinkExternalAccountService } from './link_external_account.service';

describe('LinkExternalAccountService', () => {
  let service: LinkExternalAccountService;
  let mockAdapter: any;
  let mockExternalAccountService: any;
  let mockRedisCacheService: any;
  let mockInAppNotificationService: any;
  let mockMailerService: any;
  const user = { id: 'user-123' } as UserModel;

  beforeEach(async () => {
    mockAdapter = {
      exchangeToken: jest.fn(),
      getAccounts: jest.fn(),
      createProcessorToken: jest.fn(),
      linkBankAccount: jest.fn(),
    };
    mockExternalAccountService = {
      findOne: jest.fn(),
      update: jest.fn(),
      create: jest.fn(),
    };
    mockRedisCacheService = {
      get: jest.fn(),
      del: jest.fn(),
    };
    mockInAppNotificationService = {
      createNotification: jest.fn(),
    };
    mockMailerService = {
      send: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LinkExternalAccountService,
        { provide: LinkBankAccountAdapter, useValue: mockAdapter },
        { provide: ExternalAccountService, useValue: mockExternalAccountService },
        { provide: RedisCacheService, useValue: mockRedisCacheService },
        { provide: InAppNotificationService, useValue: mockInAppNotificationService },
        { provide: MailerService, useValue: mockMailerService },
      ],
    }).compile();

    service = module.get(LinkExternalAccountService);
  });

  afterEach(() => jest.clearAllMocks());

  it('should link multiple accounts and update ExternalAccount', async () => {
    // stub happy-path
    mockAdapter.exchangeToken.mockResolvedValue({ accessToken: 'tok123', itemId: 'itemABC' });
    mockAdapter.getAccounts.mockResolvedValue({
      accounts: [{ ref: 'acc1' }, { ref: 'acc2' }],
      item: { itemId: 'itemABC' },
    });

    mockExternalAccountService.findOne.mockResolvedValue({
      id: 'zh-1',
      participant_code: 'P123',
      provider_kyc_status: 'approved',
    });
    mockAdapter.createProcessorToken.mockResolvedValue({ processorToken: 'pt-xyz' });
    mockAdapter.linkBankAccount.mockResolvedValue({ accountRef: 'zh-ext-id' });

    const dto: PlaidLinkTokenExchangeDto = {
      public_token: 'mock-public-token',
      metadata: {
        institution: { name: 'Chase', id: 'ins_123' },
        accounts: [
          { id: 'acc1', name: 'Checking', mask: '0000', type: 'depository', subtype: 'checking' },
          { id: 'acc2', name: 'Savings', mask: '1111', type: 'depository', subtype: 'savings' },
        ],
      },
    };

    const result = await service.handleTokenExchangeAndAccountLink(dto, user);

    expect(mockAdapter.exchangeToken).toHaveBeenCalledWith({ publicToken: 'mock-public-token' }, 'US');
    expect(mockAdapter.getAccounts).toHaveBeenCalledWith({ accessToken: 'tok123' }, 'US');
    expect(mockAdapter.createProcessorToken).toHaveBeenCalledTimes(2);
    expect(mockAdapter.linkBankAccount).toHaveBeenCalledTimes(2);
    expect(mockExternalAccountService.update).toHaveBeenCalledTimes(2);
    expect(result).toEqual({ success: true, message: 'Bank accounts linked successfully' });
  });

  it('should throw if no accounts selected', async () => {
    // ← stub exchangeToken so we get past step 1
    mockAdapter.exchangeToken.mockResolvedValue({ accessToken: 'foo', itemId: 'bar' });

    await expect(
      service.handleTokenExchangeAndAccountLink({ public_token: 'ptok', metadata: { accounts: [] } } as any, user),
    ).rejects.toThrow(new BadRequestException('No accounts selected'));
  });

  it('should create in-app notification with institution name in message', async () => {
    // Setup
    mockAdapter.exchangeToken.mockResolvedValue({ accessToken: 'tok123', itemId: 'itemABC' });
    mockAdapter.getAccounts.mockResolvedValue({
      accounts: [{ ref: 'acc1' }],
      item: { itemId: 'itemABC' },
    });
    mockExternalAccountService.findOne.mockResolvedValue({
      id: 'zh-1',
      participant_code: 'P123',
      provider_kyc_status: 'approved',
    });
    mockAdapter.createProcessorToken.mockResolvedValue({ processorToken: 'pt-xyz' });
    mockAdapter.linkBankAccount.mockResolvedValue({ accountRef: 'zh-ext-id' });

    const dto: PlaidLinkTokenExchangeDto = {
      public_token: 'mock-public-token',
      metadata: {
        institution: { name: 'Chase', id: 'ins_123' },
        accounts: [{ id: 'acc1', name: 'Plaid Checking', mask: '0000', type: 'depository', subtype: 'checking' }],
      },
    };

    // Act
    await service.handleTokenExchangeAndAccountLink(dto, user);

    // Assert
    expect(mockInAppNotificationService.createNotification).toHaveBeenCalledWith({
      user_id: 'user-123',
      type: 'account_linked',
      title: 'Bank Account Linked Successfully',
      message: 'Your Chase account has been successfully linked to your OneDosh account.',
      metadata: {
        bankName: 'Chase',
        accountType: 'depository',
        accountId: 'acc1',
      },
    });
  });

  it('should create in-app notification with empty string when institution name is not provided', async () => {
    // Setup
    mockAdapter.exchangeToken.mockResolvedValue({ accessToken: 'tok123', itemId: 'itemABC' });
    mockAdapter.getAccounts.mockResolvedValue({
      accounts: [{ ref: 'acc1' }],
      item: { itemId: 'itemABC' },
    });
    mockExternalAccountService.findOne.mockResolvedValue({
      id: 'zh-1',
      participant_code: 'P123',
      provider_kyc_status: 'approved',
    });
    mockAdapter.createProcessorToken.mockResolvedValue({ processorToken: 'pt-xyz' });
    mockAdapter.linkBankAccount.mockResolvedValue({ accountRef: 'zh-ext-id' });

    const dto: PlaidLinkTokenExchangeDto = {
      public_token: 'mock-public-token',
      metadata: {
        institution: undefined,
        accounts: [{ id: 'acc1', name: 'Checking', mask: '0000', type: 'depository', subtype: 'checking' }],
      },
    };

    // Act
    await service.handleTokenExchangeAndAccountLink(dto, user);

    // Assert
    expect(mockInAppNotificationService.createNotification).toHaveBeenCalledWith({
      user_id: 'user-123',
      type: 'account_linked',
      title: 'Bank Account Linked Successfully',
      message: 'Your  account has been successfully linked to your OneDosh account.',
      metadata: {
        bankName: undefined,
        accountType: 'depository',
        accountId: 'acc1',
      },
    });
  });

  describe('handleCredentialUpdate', () => {
    const validDto: PlaidLinkTokenExchangeDto = {
      public_token: 'mock-public-token',
      metadata: {},
    };

    it('should successfully update credentials when Redis marker exists', async () => {
      // Setup Redis cache with valid data
      mockRedisCacheService.get.mockResolvedValue({
        token: 'cached-token',
        itemId: 'item-123',
        externalAccountId: 'ext-123',
      });

      // Setup successful token exchange
      mockAdapter.exchangeToken.mockResolvedValue({
        accessToken: 'new-access-token',
        itemId: 'item-123',
      });

      // Setup successful account access test
      mockAdapter.getAccounts.mockResolvedValue({
        accounts: [{ ref: 'acc1' }],
      });

      // Setup existing external account
      mockExternalAccountService.findOne.mockResolvedValue({
        id: 'ext-123',
        user_id: 'user-123',
        linked_item_ref: 'item-123',
        linked_provider: 'plaid',
      });

      const result = await service.handleCredentialUpdate(validDto, user);

      expect(mockRedisCacheService.get).toHaveBeenCalledWith('link_token_update:user-123:plaid');
      expect(mockAdapter.exchangeToken).toHaveBeenCalledWith({ publicToken: 'mock-public-token' }, 'US');
      expect(mockAdapter.getAccounts).toHaveBeenCalledWith({ accessToken: 'new-access-token' }, 'US');
      expect(mockExternalAccountService.update).toHaveBeenCalledWith(
        { id: 'ext-123' },
        {
          linked_access_token: 'new-access-token',
          status: 'approved',
          updated_at: expect.any(Date),
        },
      );
      expect(mockRedisCacheService.del).toHaveBeenCalledWith('link_token_update:user-123:plaid');
      expect(result).toEqual({
        success: true,
        message: 'Bank account credentials updated successfully',
      });
    });

    it('should throw BadRequestException when no Redis marker found', async () => {
      mockRedisCacheService.get.mockResolvedValue(null);

      await expect(service.handleCredentialUpdate(validDto, user)).rejects.toThrow(
        new BadRequestException('Invalid update request. Please start the update flow from the beginning.'),
      );

      expect(mockRedisCacheService.get).toHaveBeenCalledWith('link_token_update:user-123:plaid');
      expect(mockAdapter.exchangeToken).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException when item ID mismatch', async () => {
      mockRedisCacheService.get.mockResolvedValue({
        token: 'cached-token',
        itemId: 'item-456', // Different from exchange result
      });

      mockAdapter.exchangeToken.mockResolvedValue({
        accessToken: 'new-access-token',
        itemId: 'item-123', // Different from cached
      });

      await expect(service.handleCredentialUpdate(validDto, user)).rejects.toThrow(
        new BadRequestException('Item ID mismatch. This token is for a different bank account.'),
      );

      expect(mockAdapter.exchangeToken).toHaveBeenCalled();
      expect(mockAdapter.getAccounts).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException when access token test fails', async () => {
      mockRedisCacheService.get.mockResolvedValue({
        token: 'cached-token',
        itemId: 'item-123',
      });

      mockAdapter.exchangeToken.mockResolvedValue({
        accessToken: 'new-access-token',
        itemId: 'item-123',
      });

      // No accounts returned = access token doesn't work
      mockAdapter.getAccounts.mockResolvedValue({
        accounts: [],
      });

      await expect(service.handleCredentialUpdate(validDto, user)).rejects.toThrow(
        new BadRequestException('Failed to access bank account with new credentials'),
      );

      expect(mockAdapter.getAccounts).toHaveBeenCalledWith({ accessToken: 'new-access-token' }, 'US');
      expect(mockExternalAccountService.findOne).not.toHaveBeenCalled();
    });

    it('should handle getAccounts API failure', async () => {
      mockRedisCacheService.get.mockResolvedValue({
        token: 'cached-token',
        itemId: 'item-123',
      });

      mockAdapter.exchangeToken.mockResolvedValue({
        accessToken: 'new-access-token',
        itemId: 'item-123',
      });

      // getAccounts throws an error
      mockAdapter.getAccounts.mockRejectedValue(new Error('API Error'));

      await expect(service.handleCredentialUpdate(validDto, user)).rejects.toThrow(new Error('API Error'));

      expect(mockExternalAccountService.update).not.toHaveBeenCalled();
      expect(mockRedisCacheService.del).not.toHaveBeenCalled();
    });

    it('should not clean up Redis if update fails', async () => {
      mockRedisCacheService.get.mockResolvedValue({
        token: 'cached-token',
        itemId: 'item-123',
      });

      mockAdapter.exchangeToken.mockResolvedValue({
        accessToken: 'new-access-token',
        itemId: 'item-123',
      });

      mockAdapter.getAccounts.mockResolvedValue({
        accounts: [{ ref: 'acc1' }],
      });

      mockExternalAccountService.findOne.mockResolvedValue({
        id: 'ext-123',
        linked_item_ref: 'item-123',
      });

      // Update fails
      mockExternalAccountService.update.mockRejectedValue(new Error('Update failed'));

      await expect(service.handleCredentialUpdate(validDto, user)).rejects.toThrow(new Error('Update failed'));

      // Redis should NOT be cleaned up on failure (current implementation)
      expect(mockRedisCacheService.del).not.toHaveBeenCalled();
    });
  });
});

describe('LinkExternalAccountController', () => {
  let controller: LinkExternalAccountController;
  let service: LinkExternalAccountService;

  const mockAppLoggerService = {
    logInfo: jest.fn(),
    logError: jest.fn(),
    logUserAction: jest.fn(),
    setContext: jest.fn(),
    createChild: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    log: jest.fn(),
    debug: jest.fn(),
    verbose: jest.fn(),
  };

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      controllers: [LinkExternalAccountController],
      providers: [
        {
          provide: LinkExternalAccountService,
          useValue: {
            handleTokenExchangeAndAccountLink: jest.fn(),
            handleCredentialUpdate: jest.fn(),
          },
        },
        {
          provide: AppLoggerService,
          useValue: mockAppLoggerService,
        },
      ],
    }).compile();

    controller = module.get(LinkExternalAccountController);
    service = module.get(LinkExternalAccountService);
  });

  it('exchangeToken() should return a 201-wrapped payload', async () => {
    (service.handleTokenExchangeAndAccountLink as jest.Mock).mockResolvedValue({
      success: true,
      message: 'it worked',
    });

    const dto: PlaidLinkTokenExchangeDto = {
      public_token: 'ptok',
      metadata: {
        institution: { name: 'Bank', id: 'bank_1' },
        accounts: [{ id: 'a1', name: 'N1', mask: 'M1', type: 't', subtype: 's' }],
      },
    };
    const user = { id: 'u-1' } as UserModel;
    const res = await controller.exchangeToken(dto, user);

    expect(service.handleTokenExchangeAndAccountLink).toHaveBeenCalledWith(dto, user);
    expect(res).toMatchObject({
      message: 'it worked',
      data: { success: true, message: 'it worked' },
      statusCode: HttpStatus.CREATED,
      timestamp: expect.any(String),
    });
  });

  describe('updatePlaidAccount', () => {
    const dto: PlaidLinkTokenExchangeDto = {
      public_token: 'update-token',
      metadata: {},
    };
    const user = { id: 'u-1' } as UserModel;

    it('should return 200 with success message when update succeeds', async () => {
      (service.handleCredentialUpdate as jest.Mock).mockResolvedValue({
        success: true,
        message: 'Bank account credentials updated successfully',
      });

      const res = await controller.updatePlaidAccount(dto, user);

      expect(service.handleCredentialUpdate).toHaveBeenCalledWith(dto, user);
      expect(res).toMatchObject({
        message: 'Bank account credentials updated successfully',
        data: { success: true, message: 'Bank account credentials updated successfully' },
        statusCode: HttpStatus.OK,
        timestamp: expect.any(String),
      });
    });

    it('should handle service errors properly', async () => {
      const error = new BadRequestException('Invalid update request');
      (service.handleCredentialUpdate as jest.Mock).mockRejectedValue(error);

      await expect(controller.updatePlaidAccount(dto, user)).rejects.toThrow(error);

      expect(service.handleCredentialUpdate).toHaveBeenCalledWith(dto, user);
    });

    it('should handle internal service errors', async () => {
      const error = new Error('Internal service error');
      (service.handleCredentialUpdate as jest.Mock).mockRejectedValue(error);

      await expect(controller.updatePlaidAccount(dto, user)).rejects.toThrow(error);

      expect(service.handleCredentialUpdate).toHaveBeenCalledWith(dto, user);
    });
  });
});
