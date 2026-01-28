import { Test, TestingModule } from '@nestjs/testing';
import { TransactionMonitoringAdapter } from '../../../adapters/transaction-monitoring/transaction-monitoring-adapter';
import { LoginDeviceModel } from '../../../database/models/loginDevice/loginDevice.model';
import { LoginEventModel } from '../../../database/models/loginEvent/loginEvent.model';
import { LoginEventRepository } from '../loginEvent/loginEvent.repository';
import { LoginDeviceRepository } from './loginDevice.repository';
import { LoginDeviceService } from './loginDevice.service';

describe('LoginDeviceService', () => {
  let service: LoginDeviceService;
  let loginDeviceRepository: jest.Mocked<LoginDeviceRepository>;
  let loginEventRepository: jest.Mocked<LoginEventRepository>;
  let transactionMonitoringAdapter: jest.Mocked<TransactionMonitoringAdapter>;

  const mockDevice: Partial<LoginDeviceModel> = {
    id: 'device-id',
    user_id: 'user-id',
    device_fingerprint: 'fingerprint-123',
    is_trusted: false,
    last_login: '2023-01-01T00:00:00.000Z',
  };

  const mockLoginEvent: Partial<LoginEventModel> = {
    id: 'event-id',
    user_id: 'user-id',
    device_id: 'device-id',
    ip_address: '192.168.1.1',
    login_time: '2023-01-01T00:00:00.000Z',
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const mockLoginDeviceRepository = {
      findOne: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    };

    const mockLoginEventRepository = {
      create: jest.fn(),
    };

    const mockTransactionMonitoringAdapter = {
      ipCheck: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LoginDeviceService,
        { provide: LoginDeviceRepository, useValue: mockLoginDeviceRepository },
        { provide: LoginEventRepository, useValue: mockLoginEventRepository },
        { provide: TransactionMonitoringAdapter, useValue: mockTransactionMonitoringAdapter },
      ],
    }).compile();

    service = module.get<LoginDeviceService>(LoginDeviceService);
    loginDeviceRepository = module.get(LoginDeviceRepository);
    loginEventRepository = module.get(LoginEventRepository);
    transactionMonitoringAdapter = module.get(TransactionMonitoringAdapter);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('log', () => {
    const userId = 'user-id';
    const ipAddress = '192.168.1.1';
    const deviceFingerprint = 'fingerprint-123';

    it('should create new device and login event when device does not exist', async () => {
      // Arrange
      loginDeviceRepository.findOne.mockResolvedValue(null);
      loginDeviceRepository.create.mockResolvedValue(mockDevice as LoginDeviceModel);
      loginEventRepository.create.mockResolvedValue(mockLoginEvent as LoginEventModel);

      // Act
      await service.log(userId, ipAddress, deviceFingerprint);

      // Assert
      expect(loginDeviceRepository.findOne).toHaveBeenCalledWith({
        user_id: userId,
        device_fingerprint: deviceFingerprint,
      });
      expect(loginDeviceRepository.create).toHaveBeenCalledWith(
        {
          user_id: userId,
          device_fingerprint: deviceFingerprint,
          is_trusted: false,
          last_login: expect.any(String),
        },
        undefined,
      );
      expect(loginEventRepository.create).toHaveBeenCalledWith(
        {
          user_id: userId,
          device_id: mockDevice.id,
          ip_address: ipAddress,
          login_time: expect.any(String),
        },
        undefined,
      );
    });

    it('should update existing device and create login event when device exists', async () => {
      // Arrange
      loginDeviceRepository.findOne.mockResolvedValue(mockDevice as LoginDeviceModel);
      loginDeviceRepository.update.mockResolvedValue(mockDevice as LoginDeviceModel);
      loginEventRepository.create.mockResolvedValue(mockLoginEvent as LoginEventModel);

      // Act
      await service.log(userId, ipAddress, deviceFingerprint);

      // Assert
      expect(loginDeviceRepository.findOne).toHaveBeenCalledWith({
        user_id: userId,
        device_fingerprint: deviceFingerprint,
      });
      expect(loginDeviceRepository.update).toHaveBeenCalledWith(mockDevice.id, {
        last_login: expect.any(String),
      });
      expect(loginEventRepository.create).toHaveBeenCalledWith(
        {
          user_id: userId,
          device_id: mockDevice.id,
          ip_address: ipAddress,
          login_time: expect.any(String),
        },
        undefined,
      );
    });

    it('should handle transaction parameter', async () => {
      // Arrange
      const mockTrx = { trx: 'transaction' };
      loginDeviceRepository.findOne.mockResolvedValue(null);
      loginDeviceRepository.create.mockResolvedValue(mockDevice as LoginDeviceModel);
      loginEventRepository.create.mockResolvedValue(mockLoginEvent as LoginEventModel);

      // Act
      await service.log(userId, ipAddress, deviceFingerprint, mockTrx);

      // Assert
      expect(loginDeviceRepository.create).toHaveBeenCalledWith(expect.any(Object), mockTrx);
      expect(loginEventRepository.create).toHaveBeenCalledWith(expect.any(Object), mockTrx);
    });
  });

  describe('registerDevice', () => {
    const userId = 'user-id';
    const ipAddress = '192.168.1.1';
    const deviceFingerprint = 'fingerprint-123';

    const mockIpCheckResult = {
      city: 'San Francisco',
      region: 'CA',
      country: 'US',
    };

    it('should register trusted device with geo data when IP check succeeds', async () => {
      // Arrange
      transactionMonitoringAdapter.ipCheck.mockResolvedValue(mockIpCheckResult);
      loginDeviceRepository.create.mockResolvedValue({
        ...mockDevice,
        is_trusted: true,
      } as LoginDeviceModel);
      loginEventRepository.create.mockResolvedValue(mockLoginEvent as LoginEventModel);

      const loggerSpy = jest.spyOn(service['logger'], 'log').mockImplementation();

      // Act
      await service.registerDevice(userId, ipAddress, deviceFingerprint);

      // Assert
      expect(transactionMonitoringAdapter.ipCheck).toHaveBeenCalledWith({
        ipAddress,
        userId,
      });
      expect(loginDeviceRepository.create).toHaveBeenCalledWith(
        {
          user_id: userId,
          device_fingerprint: deviceFingerprint,
          is_trusted: true,
          last_verified_at: expect.any(String),
          last_login: expect.any(String),
        },
        undefined,
      );
      expect(loginEventRepository.create).toHaveBeenCalledWith(
        {
          user_id: userId,
          device_id: mockDevice.id,
          ip_address: ipAddress,
          login_time: expect.any(String),
          city: mockIpCheckResult.city,
          region: mockIpCheckResult.region,
          country: mockIpCheckResult.country,
        },
        undefined,
      );
      expect(loggerSpy).toHaveBeenCalledWith(
        `Device registered with trust verification for user ${userId}`,
        'LoginDeviceService',
      );

      loggerSpy.mockRestore();
    });

    it('should register untrusted device without geo data when IP check fails', async () => {
      // Arrange
      transactionMonitoringAdapter.ipCheck.mockRejectedValue(new Error('IP check failed'));
      loginDeviceRepository.create.mockResolvedValue(mockDevice as LoginDeviceModel);
      loginEventRepository.create.mockResolvedValue(mockLoginEvent as LoginEventModel);

      const loggerErrorSpy = jest.spyOn(service['logger'], 'error').mockImplementation();
      const loggerLogSpy = jest.spyOn(service['logger'], 'log').mockImplementation();

      // Act
      await service.registerDevice(userId, ipAddress, deviceFingerprint);

      // Assert
      expect(transactionMonitoringAdapter.ipCheck).toHaveBeenCalledWith({
        ipAddress,
        userId,
      });
      expect(loginDeviceRepository.create).toHaveBeenCalledWith(
        {
          user_id: userId,
          device_fingerprint: deviceFingerprint,
          is_trusted: false,
          last_login: expect.any(String),
        },
        undefined,
      );
      expect(loginEventRepository.create).toHaveBeenCalledWith(
        {
          user_id: userId,
          device_id: mockDevice.id,
          ip_address: ipAddress,
          login_time: expect.any(String),
        },
        undefined,
      );
      expect(loggerErrorSpy).toHaveBeenCalledWith(
        `Failed to verify device during registration for user ${userId}: IP check failed`,
        'LoginDeviceService',
      );
      expect(loggerLogSpy).toHaveBeenCalledWith(
        `Device registered without verification (fallback) for user ${userId}`,
        'LoginDeviceService',
      );

      loggerErrorSpy.mockRestore();
      loggerLogSpy.mockRestore();
    });
  });

  describe('findDeviceByUserAndFingerprint', () => {
    const userId = 'user-id';
    const deviceFingerprint = 'fingerprint-123';

    it('should find device by user ID and fingerprint', async () => {
      // Arrange
      loginDeviceRepository.findOne.mockResolvedValue(mockDevice as LoginDeviceModel);

      // Act
      const result = await service.findDeviceByUserAndFingerprint(userId, deviceFingerprint);

      // Assert
      expect(loginDeviceRepository.findOne).toHaveBeenCalledWith({
        user_id: userId,
        device_fingerprint: deviceFingerprint,
      });
      expect(result).toEqual(mockDevice);
    });

    it('should return null when device not found', async () => {
      // Arrange
      loginDeviceRepository.findOne.mockResolvedValue(null);

      // Act
      const result = await service.findDeviceByUserAndFingerprint(userId, deviceFingerprint);

      // Assert
      expect(loginDeviceRepository.findOne).toHaveBeenCalledWith({
        user_id: userId,
        device_fingerprint: deviceFingerprint,
      });
      expect(result).toBeNull();
    });
  });
});
