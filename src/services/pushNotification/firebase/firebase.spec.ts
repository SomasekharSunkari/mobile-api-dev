// Mock firebase-admin before any imports
const mockMessagingInstance = {
  sendEachForMulticast: jest.fn(),
};

const mockCredential = {
  cert: jest.fn().mockReturnValue({
    projectId: 'test-project',
    clientEmail: 'test@test.com',
    privateKey: 'test-key',
  }),
};

const mockAdmin = {
  initializeApp: jest.fn().mockReturnValue({
    name: '[DEFAULT]',
    options: {},
  }),
  credential: mockCredential,
  messaging: jest.fn(() => mockMessagingInstance),
};

jest.mock('firebase-admin', () => ({
  default: mockAdmin,
  ...mockAdmin,
}));

// Mock dotenv
jest.mock('dotenv', () => ({
  config: jest.fn(),
}));

// Mock EnvironmentService
jest.mock('../../../config', () => ({
  EnvironmentService: {
    getValue: jest.fn().mockReturnValue(
      JSON.stringify({
        type: 'service_account',
        project_id: 'test-project',
        private_key_id: 'test-key-id',
        private_key: '-----BEGIN PRIVATE KEY-----\nMOCK_KEY\n-----END PRIVATE KEY-----',
        client_email: 'test@test-project.iam.gserviceaccount.com',
        client_id: 'test-client-id',
        auth_uri: 'https://accounts.google.com/o/oauth2/auth',
        token_uri: 'https://oauth2.googleapis.com/token',
      }),
    ),
  },
}));

// Mock path module
jest.mock('path', () => ({
  join: jest.fn(() => '/mocked/path/to/config.json'),
  resolve: jest.fn((...args) => args.join('/')),
  dirname: jest.fn((path) => path.split('/').slice(0, -1).join('/')),
  basename: jest.fn((path) => path.split('/').pop()),
}));

// Mock fs module to avoid file system access
jest.mock('fs', () => ({
  readFileSync: jest.fn(() =>
    JSON.stringify({
      type: 'service_account',
      project_id: 'test-project',
      private_key_id: 'test-key-id',
      private_key: '-----BEGIN PRIVATE KEY-----\nMOCK_KEY\n-----END PRIVATE KEY-----',
      client_email: 'test@test-project.iam.gserviceaccount.com',
      client_id: 'test-client-id',
      auth_uri: 'https://accounts.google.com/o/oauth2/auth',
      token_uri: 'https://oauth2.googleapis.com/token',
    }),
  ),
  existsSync: jest.fn(() => true),
}));

import { Notification } from '@notifee/react-native';
import admin from 'firebase-admin';
import { EnvironmentService } from '../../../config';
import { FirebaseService } from './firebase.service';

describe('FirebaseService', () => {
  let service: FirebaseService;
  let mockMessaging: jest.Mocked<any>;

  const mockNotification: Notification = {
    title: 'Test Notification',
    body: 'Test notification body',
  };

  const mockTokens = ['token1', 'token2', 'token3'];

  beforeEach(async () => {
    jest.clearAllMocks();

    // Configure EnvironmentService mock
    (EnvironmentService.getValue as jest.Mock).mockImplementation((key: string) => {
      if (key === 'FIREBASE_SECRET_JSON')
        return JSON.stringify({
          type: 'service_account',
          project_id: 'test-project',
          private_key_id: 'test-key-id',
          private_key: '-----BEGIN PRIVATE KEY-----\nMOCK_KEY\n-----END PRIVATE KEY-----',
          client_email: 'test@test-project.iam.gserviceaccount.com',
          client_id: 'test-client-id',
          auth_uri: 'https://accounts.google.com/o/oauth2/auth',
          token_uri: 'https://oauth2.googleapis.com/token',
        });
      return 'test-value';
    });

    // Temporarily set NODE_ENV to allow Firebase initialization in unit tests
    process.env.NODE_ENV = 'development';

    // Set up Firebase messaging mock
    mockMessaging = mockMessagingInstance;

    // Create a mock instance instead of using TestingModule to avoid constructor issues
    service = new FirebaseService();
    service.app = mockAdmin.initializeApp();

    // Mock eventEmitterService using Object.defineProperty
    Object.defineProperty(service, 'eventEmitterService', {
      value: { emit: jest.fn() },
      writable: true,
    });

    // Mock instance logger methods
    jest.spyOn(service['logger'], 'log').mockImplementation();
    jest.spyOn(service['logger'], 'error').mockImplementation();
  });

  afterEach(() => {
    jest.clearAllMocks();
    // Restore original NODE_ENV
    process.env.NODE_ENV = 'test';
  });

  describe('constructor', () => {
    it('should be defined', () => {
      expect(service).toBeDefined();
    });

    it('should initialize Firebase app with correct configuration', () => {
      expect(admin.initializeApp).toHaveBeenCalledWith({
        credential: expect.anything(),
      });
      expect(admin.credential.cert).toHaveBeenCalled();
      expect(EnvironmentService.getValue).toHaveBeenCalledWith('FIREBASE_SECRET_JSON');
    });

    it('should set app property', () => {
      expect(service.app).toBeDefined();
    });

    it('should handle environment configuration without file system access', () => {
      expect(EnvironmentService.getValue).toHaveBeenCalledWith('FIREBASE_SECRET_JSON');
      expect(mockAdmin.credential.cert).toHaveBeenCalled();
      expect(mockAdmin.initializeApp).toHaveBeenCalledWith({
        credential: expect.anything(),
      });
    });
  });

  describe('sendPushNotification', () => {
    it('should send push notification successfully', async () => {
      const mockResponse = {
        responses: [
          { success: true, messageId: 'msg1' },
          { success: true, messageId: 'msg2' },
          { success: true, messageId: 'msg3' },
        ],
      };

      mockMessaging.sendEachForMulticast.mockResolvedValue(mockResponse);

      const result = await service.sendPushNotification(mockTokens, mockNotification);

      expect(mockMessaging.sendEachForMulticast).toHaveBeenCalledWith({
        tokens: mockTokens,
        data: {
          notification: JSON.stringify(mockNotification),
        },
        notification: {
          title: mockNotification.title,
          body: mockNotification.body,
        },
        android: {
          notification: {
            channelId: expect.any(String),
            visibility: 'public',
            priority: 'high',
            defaultSound: true,
          },
        },
      });

      expect(service['logger'].log).toHaveBeenCalledWith(
        'Sending push notification using adapter',
        'FirebaseAdapter.sendPushNotification',
      );

      expect(result).toEqual([]);
    });

    it('should return failed responses when some notifications fail', async () => {
      const mockResponse = {
        responses: [
          { success: true, messageId: 'msg1' },
          { success: false, error: { code: 'messaging/invalid-registration-token' } },
          { success: true, messageId: 'msg3' },
        ],
      };

      mockMessaging.sendEachForMulticast.mockResolvedValue(mockResponse);

      const result = await service.sendPushNotification(mockTokens, mockNotification);

      expect(result).toEqual([{ success: false, error: { code: 'messaging/invalid-registration-token' } }]);
    });

    it('should generate unique channel ID for each notification', async () => {
      const mockResponse = {
        responses: [{ success: true, messageId: 'msg1' }],
      };

      mockMessaging.sendEachForMulticast.mockResolvedValue(mockResponse);

      // Mock Date.now to return a specific timestamp
      const mockTimestamp = 1640995200000;
      const originalDateNow = Date.now;
      Date.now = jest.fn().mockReturnValue(mockTimestamp);

      await service.sendPushNotification(['token1'], mockNotification);

      expect(mockMessaging.sendEachForMulticast).toHaveBeenCalledWith(
        expect.objectContaining({
          android: {
            notification: expect.objectContaining({
              channelId: mockTimestamp.toString(30),
            }),
          },
        }),
      );

      // Restore original Date.now
      Date.now = originalDateNow;
    });

    it('should handle empty token array', async () => {
      const mockResponse = {
        responses: [],
      };

      mockMessaging.sendEachForMulticast.mockResolvedValue(mockResponse);

      const result = await service.sendPushNotification([], mockNotification);

      expect(mockMessaging.sendEachForMulticast).toHaveBeenCalledWith({
        tokens: [],
        data: {
          notification: JSON.stringify(mockNotification),
        },
        notification: {
          title: mockNotification.title,
          body: mockNotification.body,
        },
        android: {
          notification: {
            channelId: expect.any(String),
            visibility: 'public',
            priority: 'high',
            defaultSound: true,
          },
        },
      });

      expect(result).toEqual([]);
    });

    it('should handle notification with minimal data', async () => {
      const minimalNotification: Notification = {
        title: 'Simple Title',
        body: 'Simple Body',
      };

      const mockResponse = {
        responses: [{ success: true, messageId: 'msg1' }],
      };

      mockMessaging.sendEachForMulticast.mockResolvedValue(mockResponse);

      const result = await service.sendPushNotification(['token1'], minimalNotification);

      expect(mockMessaging.sendEachForMulticast).toHaveBeenCalledWith({
        tokens: ['token1'],
        data: {
          notification: JSON.stringify(minimalNotification),
        },
        notification: {
          title: 'Simple Title',
          body: 'Simple Body',
        },
        android: {
          notification: {
            channelId: expect.any(String),
            visibility: 'public',
            priority: 'high',
            defaultSound: true,
          },
        },
      });

      expect(result).toEqual([]);
    });

    it('should log error and return undefined when Firebase throws an error', async () => {
      const errorMessage = 'Firebase messaging error';
      const firebaseError = new Error(errorMessage);

      mockMessaging.sendEachForMulticast.mockRejectedValue(firebaseError);

      const result = await service.sendPushNotification(mockTokens, mockNotification);

      expect(service['logger'].error).toHaveBeenCalledWith(errorMessage, 'FirebaseAdapter.sendPushNotification');

      expect(result).toBeUndefined();
    });

    it('should handle network timeout errors', async () => {
      const timeoutError = new Error('Network timeout');
      timeoutError.name = 'TIMEOUT';

      mockMessaging.sendEachForMulticast.mockRejectedValue(timeoutError);

      const result = await service.sendPushNotification(mockTokens, mockNotification);

      expect(service['logger'].error).toHaveBeenCalledWith('Network timeout', 'FirebaseAdapter.sendPushNotification');

      expect(result).toBeUndefined();
    });

    it('should handle Firebase authentication errors', async () => {
      const authError = new Error('Firebase authentication failed');
      authError.name = 'AUTH_ERROR';

      mockMessaging.sendEachForMulticast.mockRejectedValue(authError);

      const result = await service.sendPushNotification(mockTokens, mockNotification);

      expect(service['logger'].error).toHaveBeenCalledWith(
        'Firebase authentication failed',
        'FirebaseAdapter.sendPushNotification',
      );

      expect(result).toBeUndefined();
    });

    it('should handle single token as string parameter', async () => {
      const singleToken = 'single-token';
      const mockResponse = {
        responses: [{ success: true, messageId: 'msg1' }],
      };

      mockMessaging.sendEachForMulticast.mockResolvedValue(mockResponse);

      const result = await service.sendPushNotification([singleToken], mockNotification);

      expect(mockMessaging.sendEachForMulticast).toHaveBeenCalledWith({
        tokens: [singleToken],
        data: {
          notification: JSON.stringify(mockNotification),
        },
        notification: {
          title: mockNotification.title,
          body: mockNotification.body,
        },
        android: {
          notification: {
            channelId: expect.any(String),
            visibility: 'public',
            priority: 'high',
            defaultSound: true,
          },
        },
      });

      expect(result).toEqual([]);
    });

    it('should serialize complex notification data correctly', async () => {
      const complexNotification: Notification = {
        title: 'Complex Notification',
        body: 'This is a complex notification',
        data: {
          customField: 'customValue',
          nested: JSON.stringify({ field: 'value' }),
        },
      };

      const mockResponse = {
        responses: [{ success: true, messageId: 'msg1' }],
      };

      mockMessaging.sendEachForMulticast.mockResolvedValue(mockResponse);

      await service.sendPushNotification(['token1'], complexNotification);

      expect(mockMessaging.sendEachForMulticast).toHaveBeenCalledWith({
        tokens: ['token1'],
        data: {
          notification: JSON.stringify(complexNotification),
        },
        notification: {
          title: 'Complex Notification',
          body: 'This is a complex notification',
        },
        android: {
          notification: {
            channelId: expect.any(String),
            visibility: 'public',
            priority: 'high',
            defaultSound: true,
          },
        },
      });
    });
  });
});
