import { HttpStatus } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { IPaginatedResponse, Pagination } from '../../database/base/base.interface';
import { InAppNotificationModel } from '../../database/models/InAppNotification/InAppNotification.model';
import { UserModel } from '../../database/models/user/user.model';
import { StreamService } from '../../services/streams/stream.service';
import { NotificationsController } from './inAppNotification.controller';
import { InAppNotificationService } from './inAppNotification.service';

describe('NotificationsController', () => {
  let controller: NotificationsController;
  let inAppNotificationService: jest.Mocked<InAppNotificationService>;
  let streamService: jest.Mocked<StreamService>;

  const mockUser: UserModel = {
    id: 'user-123',
    email: 'test@example.com',
    username: 'testuser',
    first_name: 'Test',
    last_name: 'User',
  } as UserModel;

  const mockNotification: InAppNotificationModel = {
    id: 'notif-123',
    user_id: 'user-123',
    type: 'INFO',
    title: 'Test Notification',
    message: 'Test message',
    is_read: false,
    created_at: new Date(),
    updated_at: new Date(),
  } as InAppNotificationModel;

  const mockPaginatedResponse = {
    in_app_notifications: [mockNotification],
    pagination: {
      previous_page: 0,
      current_page: 1,
      next_page: 2,
      limit: 10,
      page_count: 1,
      total: 1,
    },
  } as IPaginatedResponse<InAppNotificationModel>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [NotificationsController],
      providers: [
        {
          provide: InAppNotificationService,
          useValue: {
            findAllNotificationsByUser: jest.fn(),
          },
        },
        {
          provide: StreamService,
          useValue: {
            getUserUnreadNotificationCountStream: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<NotificationsController>(NotificationsController);
    inAppNotificationService = module.get(InAppNotificationService) as jest.Mocked<InAppNotificationService>;
    streamService = module.get(StreamService) as jest.Mocked<StreamService>;

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('streamUnreadCount', () => {
    it('should return Observable from StreamService', () => {
      const mockObservable = {
        subscribe: jest.fn(),
      } as any;

      streamService.getUserUnreadNotificationCountStream.mockReturnValue(mockObservable);

      const result = controller.streamUnreadCount(mockUser);

      expect(result).toBe(mockObservable);
      expect(streamService.getUserUnreadNotificationCountStream).toHaveBeenCalledWith(mockUser.id);
      expect(streamService.getUserUnreadNotificationCountStream).toHaveBeenCalledTimes(1);
    });
  });

  describe('getNotifications', () => {
    it('should return paginated notifications successfully', async () => {
      const pagination: Pagination = {
        page: 1,
        size: 10,
      };

      inAppNotificationService.findAllNotificationsByUser.mockResolvedValue(mockPaginatedResponse);

      const result = await controller.getNotifications(mockUser, pagination);

      expect(result.statusCode).toBe(HttpStatus.OK);
      expect(result.message).toBe('Notifications fetched successfully');
      expect(result.data).toEqual(mockPaginatedResponse);
      expect(result.timestamp).toBeDefined();
      expect(inAppNotificationService.findAllNotificationsByUser).toHaveBeenCalledWith(mockUser.id, pagination);
      expect(inAppNotificationService.findAllNotificationsByUser).toHaveBeenCalledTimes(1);
    });

    it('should handle pagination with default values', async () => {
      const pagination: Pagination = {};

      inAppNotificationService.findAllNotificationsByUser.mockResolvedValue(mockPaginatedResponse);

      const result = await controller.getNotifications(mockUser, pagination);

      expect(result.statusCode).toBe(HttpStatus.OK);
      expect(result.message).toBe('Notifications fetched successfully');
      expect(result.data).toEqual(mockPaginatedResponse);
      expect(inAppNotificationService.findAllNotificationsByUser).toHaveBeenCalledWith(mockUser.id, pagination);
    });

    it('should handle empty notifications list', async () => {
      const pagination: Pagination = {
        page: 1,
        size: 10,
      };

      const emptyResponse = {
        in_app_notifications: [],
        pagination: {
          previous_page: 0,
          current_page: 1,
          next_page: 0,
          limit: 10,
          page_count: 0,
          total: 0,
        },
      } as IPaginatedResponse<InAppNotificationModel>;

      inAppNotificationService.findAllNotificationsByUser.mockResolvedValue(emptyResponse);

      const result = await controller.getNotifications(mockUser, pagination);

      expect(result.statusCode).toBe(HttpStatus.OK);
      expect(result.message).toBe('Notifications fetched successfully');
      expect(result.data).toEqual(emptyResponse);
      expect(result.data.in_app_notifications).toHaveLength(0);
    });
  });
});
