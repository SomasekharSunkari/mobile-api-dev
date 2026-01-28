import { Test, TestingModule } from '@nestjs/testing';
import { InAppNotificationModel } from '../../database/models/InAppNotification/InAppNotification.model';
import { EventEmitterService } from '../../services/eventEmitter/eventEmitter.service';
import { CreateInAppNotificationDto } from './dtos/createUserNotification.dto';
import { IN_APP_NOTIFICATION_TYPE } from './inAppNotification.enum';
import { InAppNotificationRepository } from './inAppNotification.repository';
import { InAppNotificationService } from './inAppNotification.service';

describe('InAppNotificationService', () => {
  let service: InAppNotificationService;
  const mockEventEmitterService = {
    emit: jest.fn(),
  };

  const mockQueryBuilder = {
    where: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    offset: jest.fn().mockReturnThis(),
  };

  const mockNotificationRepository = {
    create: jest.fn(),
    findById: jest.fn(),
    update: jest.fn(),
    findSync: jest.fn(),
    paginateData: jest.fn(),
    query: jest.fn(() => mockQueryBuilder),
    patch: jest.fn(),
    where: jest.fn().mockReturnThis(),
    whereIn: jest.fn().mockReturnThis(),
    countUnreadByUserId: jest.fn(),
    markNotificationsAsRead: jest.fn().mockResolvedValue(undefined),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InAppNotificationService,
        {
          provide: InAppNotificationRepository,
          useValue: mockNotificationRepository,
        },
        {
          provide: EventEmitterService,
          useValue: mockEventEmitterService,
        },
      ],
    }).compile();
    service = module.get<InAppNotificationService>(InAppNotificationService);
  });

  describe('createNotification', () => {
    it('should create a notification and return the model', async () => {
      const dto: CreateInAppNotificationDto = {
        user_id: 'user1',
        type: IN_APP_NOTIFICATION_TYPE.INFO,
        title: 'Test',
        message: 'Test message',
        metadata: { foo: 'bar' },
      };
      const mockNotification = { ...dto, id: 'notif1', created_at: new Date(), updated_at: new Date() };
      mockNotificationRepository.create.mockResolvedValue(mockNotification);
      mockNotificationRepository.countUnreadByUserId.mockResolvedValue(5);

      const result = await service.createNotification(dto);

      expect(mockNotificationRepository.create).toHaveBeenCalledWith(dto);
      expect(mockNotificationRepository.countUnreadByUserId).toHaveBeenCalledWith('user1');
      expect(mockEventEmitterService.emit).toHaveBeenCalledWith(
        'in_app_notification_created',
        expect.objectContaining({
          userId: 'user1',
          notificationId: 'notif1',
          unread_count: 5,
        }),
      );
      expect(result).toEqual(mockNotification);
    });

    it('should handle countUnreadByUserId failure gracefully', async () => {
      const dto: CreateInAppNotificationDto = {
        user_id: 'user1',
        type: IN_APP_NOTIFICATION_TYPE.INFO,
        title: 'Test',
        message: 'Test message',
      };
      const mockNotification = { ...dto, id: 'notif1', created_at: new Date(), updated_at: new Date() };
      mockNotificationRepository.create.mockResolvedValue(mockNotification);
      mockNotificationRepository.countUnreadByUserId.mockRejectedValue(new Error('Count failed'));

      const result = await service.createNotification(dto);

      expect(result).toEqual(mockNotification);
      expect(mockEventEmitterService.emit).toHaveBeenCalledWith(
        'in_app_notification_created',
        expect.objectContaining({
          userId: 'user1',
          notificationId: 'notif1',
          unread_count: 0,
        }),
      );
    });

    it('should handle eventEmitter failure gracefully', async () => {
      const dto: CreateInAppNotificationDto = {
        user_id: 'user1',
        type: IN_APP_NOTIFICATION_TYPE.INFO,
        title: 'Test',
        message: 'Test message',
      };
      const mockNotification = { ...dto, id: 'notif1', created_at: new Date(), updated_at: new Date() };
      mockNotificationRepository.create.mockResolvedValue(mockNotification);
      mockNotificationRepository.countUnreadByUserId.mockResolvedValue(3);
      mockEventEmitterService.emit.mockImplementation(() => {
        throw new Error('Event emit failed');
      });

      const result = await service.createNotification(dto);

      expect(result).toEqual(mockNotification);
    });

    it('should create notification with different notification types', async () => {
      const dto: CreateInAppNotificationDto = {
        user_id: 'user1',
        type: IN_APP_NOTIFICATION_TYPE.CREDIT,
        title: 'Credit',
        message: 'Credit message',
      };
      const mockNotification = { ...dto, id: 'notif1', created_at: new Date(), updated_at: new Date() };
      mockNotificationRepository.create.mockResolvedValue(mockNotification);
      mockNotificationRepository.countUnreadByUserId.mockResolvedValue(1);

      const result = await service.createNotification(dto);

      expect(mockNotificationRepository.create).toHaveBeenCalledWith(dto);
      expect(result).toEqual(mockNotification);
    });

    it('should create notification with unread count of 0', async () => {
      const dto: CreateInAppNotificationDto = {
        user_id: 'user1',
        type: IN_APP_NOTIFICATION_TYPE.INFO,
        title: 'Test',
        message: 'Test message',
      };
      const mockNotification = { ...dto, id: 'notif1', created_at: new Date(), updated_at: new Date() };
      mockNotificationRepository.create.mockResolvedValue(mockNotification);
      mockNotificationRepository.countUnreadByUserId.mockResolvedValue(0);

      const result = await service.createNotification(dto);

      expect(mockEventEmitterService.emit).toHaveBeenCalledWith(
        'in_app_notification_created',
        expect.objectContaining({
          userId: 'user1',
          notificationId: 'notif1',
          unread_count: 0,
        }),
      );
      expect(result).toEqual(mockNotification);
    });

    it('should throw error when repository.create fails', async () => {
      const dto: CreateInAppNotificationDto = {
        user_id: 'user1',
        type: IN_APP_NOTIFICATION_TYPE.INFO,
        title: 'Test',
        message: 'Test message',
      };
      mockNotificationRepository.create.mockRejectedValue(new Error('Create failed'));

      await expect(service.createNotification(dto)).rejects.toThrow('Create failed');
    });
  });

  describe('findNotificationById', () => {
    it('should return notification and mark as read if unread', async () => {
      const mockNotification = {
        id: 'notif1',
        user_id: 'user1',
        is_read: false,
        $query: jest.fn().mockReturnValue({ patch: jest.fn() }),
      } as unknown as InAppNotificationModel;
      mockNotificationRepository.findById.mockResolvedValue(mockNotification);
      mockNotificationRepository.update.mockResolvedValue({});

      const result = await service.findNotificationById('notif1');

      expect(mockNotificationRepository.findById).toHaveBeenCalledWith('notif1');
      expect(mockNotificationRepository.update).toHaveBeenCalledWith('notif1', { is_read: true });
      expect(result).toEqual(mockNotification);
    });

    it('should return notification and not mark as read if already read', async () => {
      const mockNotification = {
        id: 'notif1',
        user_id: 'user1',
        is_read: true,
      } as unknown as InAppNotificationModel;
      mockNotificationRepository.findById.mockResolvedValue(mockNotification);

      const result = await service.findNotificationById('notif1');

      expect(mockNotificationRepository.findById).toHaveBeenCalledWith('notif1');
      expect(mockNotificationRepository.update).not.toHaveBeenCalled();
      expect(result).toEqual(mockNotification);
    });

    it('should return undefined when notification not found', async () => {
      mockNotificationRepository.findById.mockResolvedValue(undefined);

      const result = await service.findNotificationById('non-existent-id');

      expect(mockNotificationRepository.findById).toHaveBeenCalledWith('non-existent-id');
      expect(mockNotificationRepository.update).not.toHaveBeenCalled();
      expect(result).toBeUndefined();
    });

    it('should handle repository.findById error', async () => {
      mockNotificationRepository.findById.mockRejectedValue(new Error('Find failed'));

      await expect(service.findNotificationById('notif1')).rejects.toThrow('Find failed');
    });

    it('should return notification even when update fails', async () => {
      const mockNotification = {
        id: 'notif1',
        user_id: 'user1',
        is_read: false,
      } as unknown as InAppNotificationModel;
      mockNotificationRepository.findById.mockResolvedValue(mockNotification);
      mockNotificationRepository.update.mockRejectedValue(new Error('Update failed'));

      const result = await service.findNotificationById('notif1');

      expect(mockNotificationRepository.findById).toHaveBeenCalledWith('notif1');
      expect(mockNotificationRepository.update).toHaveBeenCalledWith('notif1', { is_read: true });
      expect(result).toEqual(mockNotification);
    });
  });

  describe('findAllNotificationsByUser', () => {
    it('should return all notifications and mark unread as read', async () => {
      const userId = 'user1';
      const pagination = { page: 1, size: 10 };
      const notifications = [
        { id: 'notif1', user_id: userId, is_read: false },
        { id: 'notif2', user_id: userId, is_read: true },
      ];
      const paginatedResult = {
        in_app_notifications: notifications,
        meta: { total: 2, page: 1, size: 10 },
      };

      mockNotificationRepository.paginateData.mockResolvedValue(paginatedResult);

      const result = await service.findAllNotificationsByUser(userId, pagination);

      expect(mockNotificationRepository.query).toHaveBeenCalled();
      expect(mockQueryBuilder.where).toHaveBeenCalledWith({ user_id: userId });
      expect(mockQueryBuilder.orderBy).toHaveBeenCalledWith('created_at', 'desc');
      expect(mockQueryBuilder.limit).toHaveBeenCalledWith(10);
      expect(mockQueryBuilder.offset).toHaveBeenCalledWith(0);
      expect(mockNotificationRepository.paginateData).toHaveBeenCalledWith(mockQueryBuilder, 10, 1);
      expect(mockNotificationRepository.markNotificationsAsRead).toHaveBeenCalledWith(userId, ['notif1']);
      expect(result).toEqual(paginatedResult);
    });

    it('should handle empty notifications list', async () => {
      const userId = 'user1';
      const pagination = { page: 1, size: 10 };
      const paginatedResult = {
        in_app_notifications: [],
        meta: { total: 0, page: 1, size: 10 },
      };

      mockNotificationRepository.paginateData.mockResolvedValue(paginatedResult);

      const result = await service.findAllNotificationsByUser(userId, pagination);

      expect(result).toEqual(paginatedResult);
      expect(mockNotificationRepository.markNotificationsAsRead).not.toHaveBeenCalled();
    });

    it('should handle different pagination values', async () => {
      const userId = 'user1';
      const pagination = { page: 2, size: 20 };
      const notifications = [{ id: 'notif1', user_id: userId, is_read: false }];
      const paginatedResult = {
        in_app_notifications: notifications,
        meta: { total: 1, page: 2, size: 20 },
      };

      mockNotificationRepository.paginateData.mockResolvedValue(paginatedResult);

      const result = await service.findAllNotificationsByUser(userId, pagination);

      expect(mockQueryBuilder.limit).toHaveBeenCalledWith(20);
      expect(mockQueryBuilder.offset).toHaveBeenCalledWith(20); // (page 2 - 1) * 20 = 20
      expect(mockNotificationRepository.paginateData).toHaveBeenCalledWith(mockQueryBuilder, 20, 2);
      expect(mockNotificationRepository.markNotificationsAsRead).toHaveBeenCalledWith(userId, ['notif1']);
      expect(result).toEqual(paginatedResult);
    });

    it('should handle when all notifications are already read', async () => {
      const userId = 'user1';
      const pagination = { page: 1, size: 10 };
      const notifications = [
        { id: 'notif1', user_id: userId, is_read: true },
        { id: 'notif2', user_id: userId, is_read: true },
      ];
      const paginatedResult = {
        in_app_notifications: notifications,
        meta: { total: 2, page: 1, size: 10 },
      };

      mockNotificationRepository.paginateData.mockResolvedValue(paginatedResult);

      const result = await service.findAllNotificationsByUser(userId, pagination);

      expect(mockNotificationRepository.markNotificationsAsRead).not.toHaveBeenCalled();
      expect(result).toEqual(paginatedResult);
    });

    it('should handle paginateData error', async () => {
      const userId = 'user1';
      const pagination = { page: 1, size: 10 };

      mockNotificationRepository.paginateData.mockRejectedValue(new Error('Pagination failed'));

      await expect(service.findAllNotificationsByUser(userId, pagination)).rejects.toThrow('Pagination failed');
    });

    it('should handle patch error gracefully', async () => {
      const userId = 'user1';
      const pagination = { page: 1, size: 10 };
      const notifications = [{ id: 'notif1', user_id: userId, is_read: false }];
      const paginatedResult = {
        in_app_notifications: notifications,
        meta: { total: 1, page: 1, size: 10 },
      };

      mockNotificationRepository.paginateData.mockResolvedValue(paginatedResult);
      mockNotificationRepository.markNotificationsAsRead.mockRejectedValue(new Error('Patch failed'));

      await expect(service.findAllNotificationsByUser(userId, pagination)).rejects.toThrow('Patch failed');
    });

    it('should mark multiple unread notifications as read', async () => {
      const userId = 'user1';
      const pagination = { page: 1, size: 10 };
      const notifications = [
        { id: 'notif1', user_id: userId, is_read: false },
        { id: 'notif2', user_id: userId, is_read: false },
        { id: 'notif3', user_id: userId, is_read: false },
      ];
      const paginatedResult = {
        in_app_notifications: notifications,
        meta: { total: 3, page: 1, size: 10 },
      };

      mockNotificationRepository.paginateData.mockResolvedValue(paginatedResult);
      mockNotificationRepository.markNotificationsAsRead.mockResolvedValue(undefined);

      const result = await service.findAllNotificationsByUser(userId, pagination);

      expect(mockNotificationRepository.markNotificationsAsRead).toHaveBeenCalledWith(userId, [
        'notif1',
        'notif2',
        'notif3',
      ]);
      expect(result).toEqual(paginatedResult);
    });

    it('should handle string pagination values and convert them to numbers', async () => {
      const userId = 'user1';
      const pagination = { page: '2' as any, size: '15' as any };
      const paginatedResult = {
        in_app_notifications: [],
        meta: { total: 0, page: 2, size: 15 },
      };

      mockNotificationRepository.paginateData.mockResolvedValue(paginatedResult);

      await service.findAllNotificationsByUser(userId, pagination);

      expect(mockQueryBuilder.limit).toHaveBeenCalledWith(15);
      expect(mockQueryBuilder.offset).toHaveBeenCalledWith(15); // (2 - 1) * 15 = 15
      expect(mockNotificationRepository.paginateData).toHaveBeenCalledWith(mockQueryBuilder, 15, 2);
    });

    it('should support limit parameter as alternative to size', async () => {
      const userId = 'user1';
      const pagination = { page: 1, limit: 25 };
      const paginatedResult = {
        in_app_notifications: [],
        meta: { total: 0, page: 1, limit: 25 },
      };

      mockNotificationRepository.paginateData.mockResolvedValue(paginatedResult);

      await service.findAllNotificationsByUser(userId, pagination);

      expect(mockQueryBuilder.limit).toHaveBeenCalledWith(25);
      expect(mockQueryBuilder.offset).toHaveBeenCalledWith(0);
      expect(mockNotificationRepository.paginateData).toHaveBeenCalledWith(mockQueryBuilder, 25, 1);
    });

    it('should prioritize limit over size when both are provided', async () => {
      const userId = 'user1';
      const pagination = { page: 1, limit: 30, size: 20 };
      const paginatedResult = {
        in_app_notifications: [],
        meta: { total: 0, page: 1, limit: 30 },
      };

      mockNotificationRepository.paginateData.mockResolvedValue(paginatedResult);

      await service.findAllNotificationsByUser(userId, pagination);

      expect(mockQueryBuilder.limit).toHaveBeenCalledWith(30);
      expect(mockNotificationRepository.paginateData).toHaveBeenCalledWith(mockQueryBuilder, 30, 1);
    });

    it('should use default values when pagination is empty', async () => {
      const userId = 'user1';
      const pagination = {};
      const paginatedResult = {
        in_app_notifications: [],
        meta: { total: 0, page: 1, size: 10 },
      };

      mockNotificationRepository.paginateData.mockResolvedValue(paginatedResult);

      await service.findAllNotificationsByUser(userId, pagination);

      expect(mockQueryBuilder.limit).toHaveBeenCalledWith(10);
      expect(mockQueryBuilder.offset).toHaveBeenCalledWith(0);
      expect(mockNotificationRepository.paginateData).toHaveBeenCalledWith(mockQueryBuilder, 10, 1);
    });
  });

  describe('getTransactionNotificationConfig', () => {
    it('should return correct config for deposit transaction', () => {
      const result = service.getTransactionNotificationConfig('deposit', '100.00', 'USD');

      expect(result).toEqual({
        type: IN_APP_NOTIFICATION_TYPE.TRANSACTION_SUCCESS,
        title: 'Transaction Completed',
        message: '$100.00 USDC added to your US Wallet. A receipt has also been sent to your email',
      });
    });

    it('should return correct config for deposit transaction with bank info', () => {
      const result = service.getTransactionNotificationConfig(
        'deposit',
        '1,500.00',
        'USD',
        undefined,
        undefined,
        'Chase',
        '1234567890124521',
      );

      expect(result).toEqual({
        type: IN_APP_NOTIFICATION_TYPE.TRANSACTION_SUCCESS,
        title: 'Transaction Completed',
        message:
          '$1,500.00 USDC added to your US Wallet via Chase (**4521). A receipt has also been sent to your email',
      });
    });

    it('should return correct config for withdrawal transaction', () => {
      const result = service.getTransactionNotificationConfig('withdrawal', '50.00', 'USD');

      expect(result).toEqual({
        type: IN_APP_NOTIFICATION_TYPE.TRANSACTION_SUCCESS,
        title: 'Withdrawal Completed',
        message: '$50.00 has been successfully withdrawn. A receipt has also been sent to your email.',
      });
    });

    it('should return correct config for withdrawal_initiated transaction', () => {
      const result = service.getTransactionNotificationConfig('withdrawal_initiated', '100.00', 'NGN');

      expect(result).toEqual({
        type: IN_APP_NOTIFICATION_TYPE.WITHDRAWAL_INITIATED,
        title: 'Withdrawal Initiated',
        message:
          "Your withdrawal of ₦100.00 has been initiated and funds have been reserved. If you didn't make this request, contact support immediately.",
      });
    });

    it('should return correct config for withdrawal_initiated transaction with USD', () => {
      const result = service.getTransactionNotificationConfig('withdrawal_initiated', '250.50', 'USD');

      expect(result).toEqual({
        type: IN_APP_NOTIFICATION_TYPE.WITHDRAWAL_INITIATED,
        title: 'Withdrawal Initiated',
        message:
          "Your withdrawal of $250.50 has been initiated and funds have been reserved. If you didn't make this request, contact support immediately.",
      });
    });

    it('should return correct config for transfer_in with sender name', () => {
      const result = service.getTransactionNotificationConfig('transfer_in', '25.00', 'USD', undefined, 'John Doe');

      expect(result).toEqual({
        type: IN_APP_NOTIFICATION_TYPE.TRANSACTION_SUCCESS,
        title: "You've Received Money",
        message:
          'You just received $25.00 USDC from John Doe. The funds are now available in your OneDosh wallet. A receipt has also been sent to your email',
      });
    });

    it('should return correct config for transfer_out with recipient name', () => {
      const result = service.getTransactionNotificationConfig('transfer_out', '75.00', 'USD', 'Jane Smith');

      expect(result).toEqual({
        type: IN_APP_NOTIFICATION_TYPE.TRANSACTION_SUCCESS,
        title: 'Transaction Completed',
        message: 'You sent $75.00 USDC to Jane Smith successfully. A receipt has also been sent to your email',
      });
    });

    it('should fallback to "another user" when no sender name provided for transfers', () => {
      const result = service.getTransactionNotificationConfig('transfer_in', '30.00', 'USD');

      expect(result).toEqual({
        type: IN_APP_NOTIFICATION_TYPE.TRANSACTION_SUCCESS,
        title: "You've Received Money",
        message:
          'You just received $30.00 USDC from another user. The funds are now available in your OneDosh wallet. A receipt has also been sent to your email',
      });
    });

    it('should return correct config for exchange transaction', () => {
      const result = service.getTransactionNotificationConfig('exchange', '200.00', 'USD');

      expect(result).toEqual({
        type: IN_APP_NOTIFICATION_TYPE.TRANSACTION_SUCCESS,
        title: 'Withdrawal & Exchange Processed',
        message:
          '$200.00 USDC withdrawal & exchange has been successfully processed, and the funds have been deposited into your NGN wallet. A receipt has also been sent to your email.',
      });
    });

    it('should return correct config for reward transaction', () => {
      const result = service.getTransactionNotificationConfig('reward', '5.00', 'USD');

      expect(result).toEqual({
        type: IN_APP_NOTIFICATION_TYPE.REWARDS,
        title: 'Reward Received!',
        message:
          'You received a $5.00 USDC deposit reward for your first deposit. A receipt has been sent to your email.',
      });
    });

    it('should return default config for unknown transaction type with USD', () => {
      const result = service.getTransactionNotificationConfig('unknown_type', '10.00', 'USD');

      expect(result).toEqual({
        type: IN_APP_NOTIFICATION_TYPE.TRANSACTION_SUCCESS,
        title: 'Transaction Completed Successfully',
        message:
          'Your $10.00 USDC transaction has been completed successfully. A receipt has also been sent to your email.',
      });
    });

    it('should return default config for unknown transaction type with USDC', () => {
      const result = service.getTransactionNotificationConfig('unknown_type', '15.50', 'USDC');

      expect(result).toEqual({
        type: IN_APP_NOTIFICATION_TYPE.TRANSACTION_SUCCESS,
        title: 'Transaction Completed Successfully',
        message:
          'Your 15.50 USDC transaction has been completed successfully. A receipt has also been sent to your email.',
      });
    });

    it('should return correct config for deposit with null asset', () => {
      const result = service.getTransactionNotificationConfig('deposit', '100.00', null as any);

      expect(result).toEqual({
        type: IN_APP_NOTIFICATION_TYPE.TRANSACTION_SUCCESS,
        title: 'Transaction Completed',
        message: '100.00  added to your Wallet. A receipt has also been sent to your email',
      });
    });

    it('should return correct config for deposit with undefined asset', () => {
      const result = service.getTransactionNotificationConfig('deposit', '100.00', undefined as any);

      expect(result).toEqual({
        type: IN_APP_NOTIFICATION_TYPE.TRANSACTION_SUCCESS,
        title: 'Transaction Completed',
        message: '100.00  added to your Wallet. A receipt has also been sent to your email',
      });
    });

    it('should return correct config for deposit with empty asset', () => {
      const result = service.getTransactionNotificationConfig('deposit', '100.00', '');

      expect(result).toEqual({
        type: IN_APP_NOTIFICATION_TYPE.TRANSACTION_SUCCESS,
        title: 'Transaction Completed',
        message: '100.00  added to your Wallet. A receipt has also been sent to your email',
      });
    });

    it('should return correct config for withdrawal with null asset', () => {
      const result = service.getTransactionNotificationConfig('withdrawal', '50.00', null as any);

      expect(result).toEqual({
        type: IN_APP_NOTIFICATION_TYPE.TRANSACTION_SUCCESS,
        title: 'Withdrawal Completed',
        message: '50.00 has been successfully withdrawn. A receipt has also been sent to your email.',
      });
    });

    it('should return correct config for withdrawal with undefined asset', () => {
      const result = service.getTransactionNotificationConfig('withdrawal', '50.00', undefined as any);

      expect(result).toEqual({
        type: IN_APP_NOTIFICATION_TYPE.TRANSACTION_SUCCESS,
        title: 'Withdrawal Completed',
        message: '50.00 has been successfully withdrawn. A receipt has also been sent to your email.',
      });
    });

    it('should return correct config for exchange with null asset', () => {
      const result = service.getTransactionNotificationConfig('exchange', '200.00', null as any);

      expect(result).toEqual({
        type: IN_APP_NOTIFICATION_TYPE.TRANSACTION_SUCCESS,
        title: 'Withdrawal & Exchange Processed',
        message:
          '200.00 withdrawal & exchange has been successfully processed. A receipt has also been sent to your email.',
      });
    });

    it('should return correct config for exchange with undefined asset', () => {
      const result = service.getTransactionNotificationConfig('exchange', '200.00', undefined as any);

      expect(result).toEqual({
        type: IN_APP_NOTIFICATION_TYPE.TRANSACTION_SUCCESS,
        title: 'Withdrawal & Exchange Processed',
        message:
          '200.00 withdrawal & exchange has been successfully processed. A receipt has also been sent to your email.',
      });
    });

    it('should return correct config for transfer_out without recipientName', () => {
      const result = service.getTransactionNotificationConfig('transfer_out', '75.00', 'USD');

      expect(result).toEqual({
        type: IN_APP_NOTIFICATION_TYPE.TRANSACTION_SUCCESS,
        title: 'Transaction Completed',
        message: 'You sent $75.00 USDC to another user successfully. A receipt has also been sent to your email',
      });
    });

    it('should return correct config for transfer_out with empty string recipientName', () => {
      const result = service.getTransactionNotificationConfig('transfer_out', '75.00', 'USD', '');

      expect(result).toEqual({
        type: IN_APP_NOTIFICATION_TYPE.TRANSACTION_SUCCESS,
        title: 'Transaction Completed',
        message: 'You sent $75.00 USDC to another user successfully. A receipt has also been sent to your email',
      });
    });

    it('should return correct config for transfer_in with empty string senderName', () => {
      const result = service.getTransactionNotificationConfig('transfer_in', '30.00', 'USD', undefined, '');

      expect(result).toEqual({
        type: IN_APP_NOTIFICATION_TYPE.TRANSACTION_SUCCESS,
        title: "You've Received Money",
        message:
          'You just received $30.00 USDC from another user. The funds are now available in your OneDosh wallet. A receipt has also been sent to your email',
      });
    });

    it('should return correct config for withdrawal_initiated with null asset', () => {
      const result = service.getTransactionNotificationConfig('withdrawal_initiated', '100.00', null as any);

      expect(result).toEqual({
        type: IN_APP_NOTIFICATION_TYPE.WITHDRAWAL_INITIATED,
        title: 'Withdrawal Initiated',
        message:
          "Your withdrawal of 100.00 has been initiated and funds have been reserved. If you didn't make this request, contact support immediately.",
      });
    });

    it('should return correct config for deposit with NGN currency', () => {
      const result = service.getTransactionNotificationConfig('deposit', '5000.00', 'NGN');

      expect(result).toEqual({
        type: IN_APP_NOTIFICATION_TYPE.TRANSACTION_SUCCESS,
        title: 'Funding Successful',
        message: '₦5000.00 was successfully added to your NGN Wallet. A receipt has also been sent to your email',
      });
    });

    it('should return correct config for withdrawal with EUR currency', () => {
      const result = service.getTransactionNotificationConfig('withdrawal', '150.00', 'EUR');

      expect(result).toEqual({
        type: IN_APP_NOTIFICATION_TYPE.TRANSACTION_SUCCESS,
        title: 'Withdrawal Completed',
        message: '150.00 has been successfully withdrawn. A receipt has also been sent to your email.',
      });
    });

    it('should return correct config for transfer_in with GBP currency', () => {
      const result = service.getTransactionNotificationConfig('transfer_in', '200.00', 'GBP', undefined, 'Alice');

      expect(result).toEqual({
        type: IN_APP_NOTIFICATION_TYPE.TRANSACTION_SUCCESS,
        title: "You've Received Money",
        message:
          'You just received 200.00 from Alice. The funds are now available in your OneDosh wallet. A receipt has also been sent to your email',
      });
    });

    it('should return correct config for exchange with large amount', () => {
      const result = service.getTransactionNotificationConfig('exchange', '1000000.50', 'USD');

      expect(result).toEqual({
        type: IN_APP_NOTIFICATION_TYPE.TRANSACTION_SUCCESS,
        title: 'Withdrawal & Exchange Processed',
        message:
          '$1000000.50 USDC withdrawal & exchange has been successfully processed, and the funds have been deposited into your NGN wallet. A receipt has also been sent to your email.',
      });
    });

    it('should return correct config for deposit with zero amount', () => {
      const result = service.getTransactionNotificationConfig('deposit', '0.00', 'USD');

      expect(result).toEqual({
        type: IN_APP_NOTIFICATION_TYPE.TRANSACTION_SUCCESS,
        title: 'Transaction Completed',
        message: '$0.00 USDC added to your US Wallet. A receipt has also been sent to your email',
      });
    });

    it('should return correct config for transfer_out with very long recipient name', () => {
      const longName = 'A'.repeat(100);
      const result = service.getTransactionNotificationConfig('transfer_out', '100.00', 'USD', longName);

      expect(result).toEqual({
        type: IN_APP_NOTIFICATION_TYPE.TRANSACTION_SUCCESS,
        title: 'Transaction Completed',
        message: `You sent $100.00 USDC to ${longName} successfully. A receipt has also been sent to your email`,
      });
    });

    it('should return correct config for exchange with non-USD asset', () => {
      const result = service.getTransactionNotificationConfig('exchange', '200.00', 'EUR');

      expect(result).toEqual({
        type: IN_APP_NOTIFICATION_TYPE.TRANSACTION_SUCCESS,
        title: 'Withdrawal & Exchange Processed',
        message:
          '200.00 withdrawal & exchange has been successfully processed. A receipt has also been sent to your email.',
      });
    });

    it('should return correct config for exchange with empty string asset', () => {
      const result = service.getTransactionNotificationConfig('exchange', '200.00', '');

      expect(result).toEqual({
        type: IN_APP_NOTIFICATION_TYPE.TRANSACTION_SUCCESS,
        title: 'Withdrawal & Exchange Processed',
        message:
          '200.00 withdrawal & exchange has been successfully processed. A receipt has also been sent to your email.',
      });
    });
  });
});
