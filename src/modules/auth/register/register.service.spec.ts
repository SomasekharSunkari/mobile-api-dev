import { BadRequestException, ConflictException, InternalServerErrorException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { DateTime } from 'luxon';
import { RegistrationSuccessfulMail } from '../../../notifications/mails/registration_successful_mail';
import { VerifyAccountMail } from '../../../notifications/mails/verify_account.mail';
import { MailerService } from '../../../services/queue/processors/mailer/mailer.service';
import { UtilsService } from '../../../utils/utils.service';
import { CountryService } from '../../country/country.service';
import { DoshPointsTransactionService } from '../../doshPoints/doshPointsTransaction/doshPointsTransaction.service';
import { InAppNotificationService } from '../../inAppNotification';
import { AccessTokenService } from '../accessToken/accessToken.service';
import { AccountVerificationService } from '../accountVerification/accountVerification.service';
import { LoginDeviceService } from '../loginDevice/loginDevice.service';
import { LoginSecurityService } from '../loginSecurity/loginSecurity.service';
import { RefreshTokenService } from '../refreshToken/refreshToken.service';
import { RoleRepository } from '../role/role.repository';
import { UserRepository } from '../user/user.repository';
import { UserService } from '../user/user.service';
import { UserProfileRepository } from '../userProfile/userProfile.repository';
import { UserRoleRepository } from '../userRole/user_role.repository';
import { RegisterService } from './register.service';

jest.mock('../../../utils/utils.service');
jest.mock('luxon');
jest.mock('bcryptjs', () => ({
  genSalt: jest.fn().mockResolvedValue('salt'),
  hash: jest.fn().mockResolvedValue('hashed-password'),
}));
jest.mock('../../../notifications/mails/registration_successful_mail');

describe('RegisterService', () => {
  let service: RegisterService;

  // Mock repositories and services
  const mockUserRepository = {
    findOne: jest.fn(),
    query: jest.fn().mockReturnValue({
      whereILike: jest.fn().mockReturnValue({
        first: jest.fn(),
      }),
      findOne: jest.fn(),
    }),
    create: jest.fn(),
    transaction: jest.fn(),
  };

  const mockUserProfileRepository = {
    create: jest.fn(),
  };

  const mockUserRoleRepository = {
    create: jest.fn(),
  };

  const mockLoginDeviceService = {
    registerDevice: jest.fn(),
  };

  const mockRoleRepository = {
    query: jest.fn(),
  };

  const mockAccountVerificationService = {
    expireUnusedCode: jest.fn(),
    create: jest.fn(),
    verifyRegistrationToken: jest.fn(),
    markAccountVerificationAsUsed: jest.fn(),
  };

  const mockCountryService = {
    validateCountryExists: jest.fn(),
  };

  const mockAccessTokenService = {
    create: jest.fn(),
  };

  const mockRefreshTokenService = {
    create: jest.fn(),
  };

  const mockMailerService = {
    send: jest.fn(),
  };

  const mockLoginSecurityService = {
    getCurrentLocation: jest.fn(),
  };

  const mockUserService = {
    findByUserId: jest.fn(),
  };

  const mockInAppNotificationService = {
    createNotification: jest.fn(),
  };

  const mockDoshPointsTransactionService = {
    creditPoints: jest.fn().mockResolvedValue({ is_duplicate: false }),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    // Reset the query mock to default state
    mockUserRepository.query.mockReturnValue({
      whereILike: jest.fn().mockReturnValue({
        first: jest.fn(),
      }),
      findOne: jest.fn(),
    });

    // Setup DateTime mock
    const mockDateTime = {
      plus: jest.fn().mockReturnThis(),
      toSQL: jest.fn().mockReturnValue('2025-05-27T07:00:00Z'),
    };
    (DateTime.now as jest.Mock).mockReturnValue(mockDateTime);

    // Setup UtilsService mocks
    (UtilsService.generateCode as jest.Mock).mockReturnValue('123456');
    (UtilsService.hashPassword as jest.Mock).mockResolvedValue('hashed-123456');

    // Setup UserService mock
    mockUserService.findByUserId.mockResolvedValue({
      id: 'user-id',
      email: 'test@example.com',
      username: 'testuser',
      first_name: 'Test',
      last_name: 'User',
      phone_number: null,
      account_verified: false,
      kyc_status: 'not_started',
      linked_external_account_status: null,
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RegisterService,
        { provide: UserRepository, useValue: mockUserRepository },
        { provide: UserProfileRepository, useValue: mockUserProfileRepository },
        { provide: UserRoleRepository, useValue: mockUserRoleRepository },
        { provide: LoginDeviceService, useValue: mockLoginDeviceService },
        { provide: RoleRepository, useValue: mockRoleRepository },
        { provide: AccountVerificationService, useValue: mockAccountVerificationService },
        { provide: CountryService, useValue: mockCountryService },
        { provide: AccessTokenService, useValue: mockAccessTokenService },
        { provide: RefreshTokenService, useValue: mockRefreshTokenService },
        { provide: MailerService, useValue: mockMailerService },
        { provide: LoginSecurityService, useValue: mockLoginSecurityService },
        { provide: UserService, useValue: mockUserService },
        { provide: InAppNotificationService, useValue: mockInAppNotificationService },
        { provide: DoshPointsTransactionService, useValue: mockDoshPointsTransactionService },
      ],
    }).compile();

    service = module.get<RegisterService>(RegisterService);
  });

  describe('sendVerificationCode', () => {
    const mockAccountVerificationDto = {
      email: 'test@example.com',
    };

    it('should throw ConflictException when user with email already exists', async () => {
      // Arrange
      const existingUser = {
        id: 'user-123',
        email: 'test@example.com',
        username: 'testuser',
      };

      // Mock the chained query methods
      const mockFirst = jest.fn().mockResolvedValue(existingUser);
      const mockWhereILike = jest.fn().mockReturnValue({ first: mockFirst });
      mockUserRepository.query.mockReturnValue({ whereILike: mockWhereILike });

      // Act & Assert
      await expect(service.sendVerificationCode(mockAccountVerificationDto)).rejects.toThrow(
        new ConflictException('User with this email already exists'),
      );

      expect(mockUserRepository.query).toHaveBeenCalled();
      expect(mockWhereILike).toHaveBeenCalledWith('email', 'test@example.com');
      expect(mockFirst).toHaveBeenCalled();
      expect(mockAccountVerificationService.expireUnusedCode).not.toHaveBeenCalled();
      expect(mockAccountVerificationService.create).not.toHaveBeenCalled();
      expect(mockMailerService.send).not.toHaveBeenCalled();
    });

    it('should successfully send verification code when user does not exist', async () => {
      // Arrange
      // Mock the chained query methods to return null (user doesn't exist)
      const mockFirst = jest.fn().mockResolvedValue(null);
      const mockWhereILike = jest.fn().mockReturnValue({ first: mockFirst });
      mockUserRepository.query.mockReturnValue({ whereILike: mockWhereILike });

      mockAccountVerificationService.expireUnusedCode.mockResolvedValue(undefined);
      mockAccountVerificationService.create.mockResolvedValue({});
      mockMailerService.send.mockResolvedValue({});

      // Act
      const result = await service.sendVerificationCode(mockAccountVerificationDto);

      // Assert
      expect(mockUserRepository.query).toHaveBeenCalled();
      expect(mockWhereILike).toHaveBeenCalledWith('email', 'test@example.com');
      expect(mockFirst).toHaveBeenCalled();
      expect(mockAccountVerificationService.expireUnusedCode).toHaveBeenCalledWith('test@example.com');
      expect(UtilsService.generateCode).toHaveBeenCalled();
      expect(UtilsService.hashPassword).toHaveBeenCalledWith('123456');
      expect(mockAccountVerificationService.create).toHaveBeenCalledWith({
        code: 'hashed-123456',
        user_id: undefined,
        email: 'test@example.com',
        expiration_time: '2025-05-27T07:00:00Z',
      });
      expect(mockMailerService.send).toHaveBeenCalledWith(expect.any(VerifyAccountMail));
      expect(result).toEqual({ success: true });
    });

    it('should throw InternalServerErrorException when account verification creation fails', async () => {
      // Arrange
      // Mock the chained query methods to return null (user doesn't exist)
      const mockFirst = jest.fn().mockResolvedValue(null);
      const mockWhereILike = jest.fn().mockReturnValue({ first: mockFirst });
      mockUserRepository.query.mockReturnValue({ whereILike: mockWhereILike });

      mockAccountVerificationService.expireUnusedCode.mockResolvedValue(undefined);
      mockAccountVerificationService.create.mockRejectedValue(new Error('Database error'));

      // Act & Assert
      await expect(service.sendVerificationCode(mockAccountVerificationDto)).rejects.toThrow(
        new InternalServerErrorException('Error while creating the code'),
      );

      expect(mockUserRepository.query).toHaveBeenCalled();
      expect(mockWhereILike).toHaveBeenCalledWith('email', 'test@example.com');
      expect(mockFirst).toHaveBeenCalled();
      expect(mockAccountVerificationService.expireUnusedCode).toHaveBeenCalledWith('test@example.com');
      expect(mockAccountVerificationService.create).toHaveBeenCalled();
      expect(mockMailerService.send).not.toHaveBeenCalled();
    });

    it('should throw InternalServerErrorException when mailer service fails', async () => {
      // Arrange
      // Mock the chained query methods to return null (user doesn't exist)
      const mockFirst = jest.fn().mockResolvedValue(null);
      const mockWhereILike = jest.fn().mockReturnValue({ first: mockFirst });
      mockUserRepository.query.mockReturnValue({ whereILike: mockWhereILike });

      mockAccountVerificationService.expireUnusedCode.mockResolvedValue(undefined);
      mockAccountVerificationService.create.mockResolvedValue({});
      mockMailerService.send.mockRejectedValue(new Error('Email service error'));

      // Act & Assert
      await expect(service.sendVerificationCode(mockAccountVerificationDto)).rejects.toThrow(
        new InternalServerErrorException('Error while creating the code'),
      );

      expect(mockUserRepository.query).toHaveBeenCalled();
      expect(mockWhereILike).toHaveBeenCalledWith('email', 'test@example.com');
      expect(mockFirst).toHaveBeenCalled();
      expect(mockAccountVerificationService.expireUnusedCode).toHaveBeenCalledWith('test@example.com');
      expect(mockAccountVerificationService.create).toHaveBeenCalled();
      expect(mockMailerService.send).toHaveBeenCalled();
    });

    it('should throw InternalServerErrorException when hashing verification code fails', async () => {
      const mockFirst = jest.fn().mockResolvedValue(null);
      const mockWhereILike = jest.fn().mockReturnValue({ first: mockFirst });
      mockUserRepository.query.mockReturnValue({ whereILike: mockWhereILike });

      mockAccountVerificationService.expireUnusedCode.mockResolvedValue(undefined);
      (UtilsService.hashPassword as jest.Mock).mockRejectedValueOnce(new Error('hash failed'));

      await expect(service.sendVerificationCode(mockAccountVerificationDto)).rejects.toThrow(
        new InternalServerErrorException('Error while creating the code'),
      );

      expect(mockAccountVerificationService.create).not.toHaveBeenCalled();
      expect(mockMailerService.send).not.toHaveBeenCalled();
    });
  });

  describe('checkUsernameExists', () => {
    it('should return exists: true when username exists', async () => {
      // Arrange
      const existingUser = { id: 'user-123', username: 'testuser' };
      const mockFirst = jest.fn().mockResolvedValue(existingUser);
      const mockWhereILike = jest.fn().mockReturnValue({ first: mockFirst });
      mockUserRepository.query.mockReturnValue({ whereILike: mockWhereILike });

      // Act
      const result = await service.checkUsernameExists('testuser');

      // Assert
      expect(mockWhereILike).toHaveBeenCalledWith('username', 'testuser');
      expect(result).toEqual({ exists: true });
    });

    it('should return exists: false when username does not exist', async () => {
      // Arrange
      const mockFirst = jest.fn().mockResolvedValue(null);
      const mockWhereILike = jest.fn().mockReturnValue({ first: mockFirst });
      mockUserRepository.query.mockReturnValue({ whereILike: mockWhereILike });

      // Act
      const result = await service.checkUsernameExists('testuser');

      // Assert
      expect(mockWhereILike).toHaveBeenCalledWith('username', 'testuser');
      expect(result).toEqual({ exists: false });
    });

    it('should throw BadRequestException when username is empty', async () => {
      // Act & Assert
      await expect(service.checkUsernameExists('')).rejects.toThrow(new BadRequestException('Username is required'));

      expect(mockUserRepository.query).not.toHaveBeenCalled();
    });
  });

  describe('checkEmailExists', () => {
    it('should return exists: true when email exists', async () => {
      // Arrange
      const existingUser = { id: 'user-123', email: 'test@example.com' };
      const mockFirst = jest.fn().mockResolvedValue(existingUser);
      const mockWhereILike = jest.fn().mockReturnValue({ first: mockFirst });
      mockUserRepository.query.mockReturnValue({ whereILike: mockWhereILike });

      // Act
      const result = await service.checkEmailExists('test@example.com');

      // Assert
      expect(mockWhereILike).toHaveBeenCalledWith('email', 'test@example.com');
      expect(result).toEqual({ exists: true });
    });

    it('should return exists: false when email does not exist', async () => {
      // Arrange
      const mockFirst = jest.fn().mockResolvedValue(null);
      const mockWhereILike = jest.fn().mockReturnValue({ first: mockFirst });
      mockUserRepository.query.mockReturnValue({ whereILike: mockWhereILike });

      // Act
      const result = await service.checkEmailExists('test@example.com');

      // Assert
      expect(mockWhereILike).toHaveBeenCalledWith('email', 'test@example.com');
      expect(result).toEqual({ exists: false });
    });

    it('should throw BadRequestException when email is empty', async () => {
      // Act & Assert
      await expect(service.checkEmailExists('')).rejects.toThrow(new BadRequestException('Email is required'));

      expect(mockUserRepository.query).not.toHaveBeenCalled();
    });
  });

  describe('validatePhoneNumber', () => {
    it('should return false when phone number is empty', async () => {
      // Act
      const result = await service.validatePhoneNumber('', 'US');

      // Assert
      expect(result).toBe(false);
    });

    it('should throw BadRequestException for invalid phone number format', async () => {
      // Arrange
      jest.doMock('libphonenumber-js', () => ({
        isPossiblePhoneNumber: jest.fn().mockReturnValue(false),
        isValidPhoneNumber: jest.fn().mockReturnValue(false),
      }));

      // Re-import the service to pick up the mocked libphonenumber-js
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { isPossiblePhoneNumber } = require('libphonenumber-js');
      isPossiblePhoneNumber.mockReturnValue(false);

      // Act & Assert
      await expect(service.validatePhoneNumber('invalid-phone', 'US')).rejects.toThrow(
        new BadRequestException('Invalid phone number'),
      );
    });
  });

  describe('checkRegister', () => {
    it('should throw BadRequestException when email is not provided', async () => {
      // Act & Assert
      await expect(service.checkRegister({ email: '' } as any)).rejects.toThrow(
        new BadRequestException('Email is required'),
      );
    });

    it('should throw BadRequestException when user with email already exists', async () => {
      // Arrange
      const existingUser = { id: 'user-123', email: 'test@example.com' };
      const mockFirst = jest.fn().mockResolvedValue(existingUser);
      const mockWhereILike = jest.fn().mockReturnValue({ first: mockFirst });
      mockUserRepository.query.mockReturnValue({ whereILike: mockWhereILike });

      // Act & Assert
      await expect(
        service.checkRegister({
          email: 'test@example.com',
          phone_number: '+1234567890',
          phone_number_country_code: 'US',
        }),
      ).rejects.toThrow(new BadRequestException('User with email already exists'));

      expect(mockUserRepository.query).toHaveBeenCalled();
      expect(mockWhereILike).toHaveBeenCalledWith('email', 'test@example.com');
    });

    it('should return true when email is valid and phone number validation passes', async () => {
      // Arrange
      const mockFirst = jest.fn().mockResolvedValue(null);
      const mockWhereILike = jest.fn().mockReturnValue({ first: mockFirst });
      mockUserRepository.query.mockReturnValue({ whereILike: mockWhereILike });
      mockUserRepository.findOne.mockResolvedValue(null);

      // Mock validatePhoneNumber to return true
      jest.spyOn(service, 'validatePhoneNumber').mockResolvedValue(true);

      // Act
      const result = await service.checkRegister({
        email: 'newuser@example.com',
        phone_number: '+1234567890',
        phone_number_country_code: 'US',
      });

      // Assert
      expect(result).toBe(true);
      expect(mockUserRepository.query).toHaveBeenCalled();
      expect(mockWhereILike).toHaveBeenCalledWith('email', 'newuser@example.com');
    });
  });

  describe('checkPhoneNoExists', () => {
    it('should throw BadRequestException when phone number is invalid', async () => {
      // Act & Assert
      await expect(
        service.checkPhoneNoExists({
          phone_number: '',
          phone_number_country_code: 'US',
        }),
      ).rejects.toThrow(new BadRequestException('Invalid phone number'));
    });

    it('should throw BadRequestException when phone number already exists', async () => {
      // Arrange
      const existingUser = { id: 'user-123', phone_number: '+1234567890' };
      mockUserRepository.findOne.mockResolvedValue(existingUser);

      // Mock validatePhoneNumber to return true
      jest.spyOn(service, 'validatePhoneNumber').mockResolvedValue(true);

      // Act & Assert
      await expect(
        service.checkPhoneNoExists({
          phone_number: '+1234567890',
          phone_number_country_code: 'US',
        }),
      ).rejects.toThrow(new BadRequestException('Phone number already in use'));

      expect(mockUserRepository.findOne).toHaveBeenCalledWith({ phone_number: '+1234567890' });
    });

    it('should not throw error when phone number does not exist and is valid', async () => {
      // Arrange
      mockUserRepository.findOne.mockResolvedValue(null);

      // Mock validatePhoneNumber to return true
      jest.spyOn(service, 'validatePhoneNumber').mockResolvedValue(true);

      // Act & Assert
      await expect(
        service.checkPhoneNoExists({
          phone_number: '+1234567890',
          phone_number_country_code: 'US',
        }),
      ).resolves.not.toThrow();
    });

    it('should validate phone number before checking repository', async () => {
      const validateSpy = jest.spyOn(service, 'validatePhoneNumber').mockResolvedValue(true);
      mockUserRepository.findOne.mockResolvedValue(null);

      await service.checkPhoneNoExists({
        phone_number: '+1987654321',
        phone_number_country_code: 'CA',
      });

      expect(validateSpy).toHaveBeenCalledWith('+1987654321', 'CA');
      expect(mockUserRepository.findOne).toHaveBeenCalledWith({ phone_number: '+1987654321' });
    });
  });

  describe('register', () => {
    const mockRegisterDto = {
      email: 'newuser@example.com',
      username: 'newuser',
      password: 'SecurePassword123!',
      first_name: 'John',
      last_name: 'Doe',
      middle_name: 'Michael',
      phone_number: '+1234567890',
      phone_number_country_code: 'US',
      country_id: 'country-123',
      verification_token: 'valid-token-123',
    };

    const mockSecurityContext = {
      clientIp: '192.168.1.1',
      fingerprint: 'device-fingerprint-123',
      userAgent: 'Mozilla/5.0',
    };

    const mockUser = {
      id: 'user-123',
      email: 'newuser@example.com',
      username: 'newuser',
      first_name: 'John',
      last_name: 'Doe',
      middle_name: 'Michael',
      phone_number: '+1234567890',
      status: 'active',
      is_email_verified: true,
      is_phone_verified: false,
      country_id: 'country-123',
      $fetchGraph: jest.fn().mockResolvedValue({
        id: 'user-123',
        email: 'newuser@example.com',
        country: { id: 'country-123', name: 'United States' },
      }),
    };

    const mockAccountVerification = {
      id: 'verification-123',
      email: 'newuser@example.com',
      code: 'hashed-code',
      expiration_time: '2025-12-31T23:59:59Z',
    };

    const mockTokenData = {
      decodedToken: {
        access_token: 'access-token-123',
        expiration: 3600,
      },
    };

    const mockRefreshToken = {
      refreshToken: {
        id: 'refresh-token-123',
        user_id: 'user-123',
        token: 'refresh-token-hash',
      },
      encodedToken: 'encoded-refresh-token-123',
    };

    const mockUserRole = { id: 'role-user-123', slug: 'user' };
    const mockActiveRole = { id: 'role-active-123', slug: 'active-user' };

    beforeEach(() => {
      // Reset all mocks
      jest.clearAllMocks();

      // Mock logger methods to capture error details
      jest.spyOn(service['logger'], 'log').mockImplementation((...args) => {
        console.log('Logger.log called with:', args);
      });
      jest.spyOn(service['logger'], 'error').mockImplementation((...args) => {
        console.error('Logger.error called with:', args);
      });

      // Setup default mock implementations
      mockAccountVerificationService.verifyRegistrationToken.mockResolvedValue(mockAccountVerification);
      mockCountryService.validateCountryExists.mockResolvedValue(true);
      mockLoginSecurityService.getCurrentLocation.mockResolvedValue(undefined);

      const mockQueryFindOne = jest.fn().mockResolvedValue(null);
      const mockFirst = jest.fn().mockResolvedValue(null);
      const mockWhereILike = jest.fn().mockReturnValue({ first: mockFirst });
      mockUserRepository.query.mockReturnValue({ findOne: mockQueryFindOne, whereILike: mockWhereILike });

      // Setup the user object with $fetchGraph method
      const userWithGraph = {
        ...mockUser,
        $fetchGraph: jest.fn().mockResolvedValue({
          id: 'user-123',
          email: 'newuser@example.com',
          username: 'newuser',
          first_name: 'John',
          last_name: 'Doe',
          country: { id: 'country-123', name: 'United States' },
        }),
      };

      // Setup repository mocks that will be used inside transaction
      mockUserRepository.create.mockResolvedValue(userWithGraph);
      mockUserProfileRepository.create.mockResolvedValue({ user_id: 'user-123' });
      mockAccessTokenService.create.mockResolvedValue(mockTokenData);
      mockRefreshTokenService.create.mockResolvedValue(mockRefreshToken);
      mockUserRoleRepository.create.mockResolvedValue({ user_id: 'user-123' });
      mockAccountVerificationService.markAccountVerificationAsUsed.mockResolvedValue(undefined);
      mockLoginDeviceService.registerDevice.mockResolvedValue(undefined);

      // Setup role repository query with proper mock chain
      const mockRoleFindOne = jest.fn().mockImplementation((filter) => {
        if (filter.slug === 'user') return Promise.resolve(mockUserRole);
        if (filter.slug === 'active-user') return Promise.resolve(mockActiveRole);
        return Promise.resolve(null);
      });
      mockRoleRepository.query.mockReturnValue({ findOne: mockRoleFindOne });

      // Setup transaction mock to execute callback and return the result
      mockUserRepository.transaction.mockImplementation(async (callback) => {
        const trx = {};
        return await callback(trx);
      });

      mockUserService.findByUserId.mockResolvedValue({
        id: 'user-123',
        email: 'newuser@example.com',
        username: 'newuser',
        first_name: 'John',
        last_name: 'Doe',
        phone_number: '+1234567890',
        account_verified: false,
        kyc_status: 'not_started',
      });
      mockInAppNotificationService.createNotification.mockResolvedValue(undefined);
      mockMailerService.send.mockResolvedValue(undefined);
    });

    it('should successfully register a user with valid details and security context', async () => {
      jest.spyOn(service, 'validatePhoneNumber').mockResolvedValue(true);

      const mockFirst = jest.fn().mockResolvedValue(null);
      const mockWhereILike = jest.fn().mockReturnValue({ first: mockFirst });
      const mockQueryFindOne = jest.fn().mockResolvedValue(null); // phone
      mockUserRepository.query.mockReturnValue({ whereILike: mockWhereILike, findOne: mockQueryFindOne });

      const result = await service.register(mockRegisterDto, mockSecurityContext);

      expect(mockAccountVerificationService.verifyRegistrationToken).toHaveBeenCalledWith('valid-token-123');
      expect(mockLoginSecurityService.getCurrentLocation).toHaveBeenCalledWith(
        'registration_check',
        mockSecurityContext,
      );
      expect(service.validatePhoneNumber).toHaveBeenCalledWith('+1234567890', 'US');
      expect(mockWhereILike).toHaveBeenCalledTimes(2); // email and username
      expect(mockUserRepository.transaction).toHaveBeenCalled();
      expect(mockUserRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          email: 'newuser@example.com',
          username: 'newuser',
          phone_number: '+1234567890',
          country_id: 'country-123',
        }),
        expect.any(Object),
      );
      expect(mockUserProfileRepository.create).toHaveBeenCalledWith({ user_id: 'user-123' }, expect.any(Object));
      expect(mockAccessTokenService.create).toHaveBeenCalledWith(
        { id: 'user-123', email: 'newuser@example.com', phone_number: '+1234567890', username: 'newuser' },
        expect.any(Object),
      );
      expect(mockRefreshTokenService.create).toHaveBeenCalledWith('user-123');
      expect(mockUserRoleRepository.create).toHaveBeenCalledTimes(2);
      expect(mockAccountVerificationService.markAccountVerificationAsUsed).toHaveBeenCalledWith(
        'user-123',
        'verification-123',
        expect.any(Object),
      );
      expect(mockLoginDeviceService.registerDevice).toHaveBeenCalledWith(
        'user-123',
        '192.168.1.1',
        'device-fingerprint-123',
        expect.any(Object),
      );
      expect(mockInAppNotificationService.createNotification).toHaveBeenCalledWith(
        expect.objectContaining({ user_id: 'user-123' }),
      );
      expect(mockMailerService.send).toHaveBeenCalledWith(expect.any(RegistrationSuccessfulMail));
      expect(mockUserService.findByUserId).toHaveBeenCalledWith('user-123');

      expect(result.message).toBe('Registration successful');
      expect(result.credentials).toEqual({
        access_token: 'access-token-123',
        expiration: 3600,
        refresh_token: 'encoded-refresh-token-123',
      });
      expect(result.user).toEqual(
        expect.objectContaining({
          id: 'user-123',
          email: 'newuser@example.com',
          username: 'newuser',
        }),
      );
    });

    it('should successfully register a user without phone number', async () => {
      const registerDtoWithoutPhone = {
        ...mockRegisterDto,
        phone_number: null,
        phone_number_country_code: null,
      };

      const mockFirst = jest.fn().mockResolvedValue(null);
      const mockWhereILike = jest.fn().mockReturnValue({ first: mockFirst });
      const mockQueryFindOne = jest.fn().mockResolvedValue(null);
      mockUserRepository.query.mockReturnValue({ whereILike: mockWhereILike, findOne: mockQueryFindOne });
      const validateSpy = jest.spyOn(service, 'validatePhoneNumber');

      const result = await service.register(registerDtoWithoutPhone, mockSecurityContext);

      expect(mockAccountVerificationService.verifyRegistrationToken).toHaveBeenCalledWith('valid-token-123');
      expect(mockUserRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          phone_number: null,
        }),
        expect.anything(),
      );
      expect(validateSpy).not.toHaveBeenCalled();
      expect(mockLoginDeviceService.registerDevice).toHaveBeenCalled();
      expect(result.message).toBe('Registration successful');
    });

    it('should successfully register a user without security context', async () => {
      jest.spyOn(service, 'validatePhoneNumber').mockResolvedValue(true);
      const mockFirst = jest.fn().mockResolvedValue(null);
      const mockWhereILike = jest.fn().mockReturnValue({ first: mockFirst });
      const mockQueryFindOne = jest.fn().mockResolvedValue(null);
      mockUserRepository.query.mockReturnValue({ whereILike: mockWhereILike, findOne: mockQueryFindOne });

      const result = await service.register(mockRegisterDto);

      expect(mockLoginSecurityService.getCurrentLocation).not.toHaveBeenCalled();
      expect(mockLoginDeviceService.registerDevice).not.toHaveBeenCalled();
      expect(mockUserRepository.transaction).toHaveBeenCalled();
      expect(result.message).toBe('Registration successful');
    });

    it('should throw when login security location check fails', async () => {
      jest.spyOn(service, 'validatePhoneNumber').mockResolvedValue(true);
      const mockFirst = jest.fn().mockResolvedValue(null);
      const mockWhereILike = jest.fn().mockReturnValue({ first: mockFirst });
      const mockQueryFindOne = jest.fn().mockResolvedValue(null);
      mockUserRepository.query.mockReturnValue({ whereILike: mockWhereILike, findOne: mockQueryFindOne });
      mockLoginSecurityService.getCurrentLocation.mockRejectedValue(new Error('Location blocked'));

      await expect(service.register(mockRegisterDto, mockSecurityContext)).rejects.toThrow('Location blocked');
      expect(mockLoginSecurityService.getCurrentLocation).toHaveBeenCalledWith(
        'registration_check',
        mockSecurityContext,
      );
      expect(mockUserRepository.transaction).not.toHaveBeenCalled();
    });

    it('should skip location check but register device when clientIp is missing', async () => {
      jest.spyOn(service, 'validatePhoneNumber').mockResolvedValue(true);
      const mockFirst = jest.fn().mockResolvedValue(null);
      const mockWhereILike = jest.fn().mockReturnValue({ first: mockFirst });
      const mockQueryFindOne = jest.fn().mockResolvedValue(null);
      mockUserRepository.query.mockReturnValue({ whereILike: mockWhereILike, findOne: mockQueryFindOne });
      const partialSecurityContext = {
        fingerprint: 'fingerprint-only',
        userAgent: 'Mozilla/5.0',
      } as any;

      const result = await service.register(mockRegisterDto, partialSecurityContext);

      expect(mockLoginSecurityService.getCurrentLocation).not.toHaveBeenCalled();
      expect(mockLoginDeviceService.registerDevice).toHaveBeenCalledWith(
        'user-123',
        undefined,
        'fingerprint-only',
        expect.any(Object),
      );
      expect(result.message).toBe('Registration successful');
    });

    it('should throw InternalServerErrorException when user role is missing', async () => {
      jest.spyOn(service, 'validatePhoneNumber').mockResolvedValue(true);
      const mockFirst = jest.fn().mockResolvedValue(null);
      const mockWhereILike = jest.fn().mockReturnValue({ first: mockFirst });
      const mockQueryFindOne = jest.fn().mockResolvedValue(null);
      mockUserRepository.query.mockReturnValue({ whereILike: mockWhereILike, findOne: mockQueryFindOne });

      const failingRoleFindOne = jest.fn().mockResolvedValueOnce(null).mockResolvedValueOnce(mockActiveRole);
      mockRoleRepository.query.mockReturnValue({ findOne: failingRoleFindOne });

      await expect(service.register(mockRegisterDto, mockSecurityContext)).rejects.toThrow(
        new InternalServerErrorException('Error while creating user'),
      );
      expect(mockRoleRepository.query).toHaveBeenCalled();
      expect(mockUserRepository.transaction).toHaveBeenCalled();
    });

    it('should throw BadRequestException when email already exists', async () => {
      // Arrange
      const existingUser = { id: 'existing-user-123', email: 'newuser@example.com' };
      const mockFirst = jest.fn().mockResolvedValue(existingUser);
      const mockWhereILike = jest.fn().mockReturnValue({ first: mockFirst });
      mockUserRepository.query.mockReturnValue({ whereILike: mockWhereILike });

      // Act & Assert
      await expect(service.register(mockRegisterDto, mockSecurityContext)).rejects.toThrow(
        new BadRequestException('Email already in use'),
      );

      expect(mockAccountVerificationService.verifyRegistrationToken).toHaveBeenCalled();
      expect(mockUserRepository.query).toHaveBeenCalled();
      expect(mockUserRepository.transaction).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException when verification token email does not match', async () => {
      // Arrange
      const mismatchedAccountVerification = {
        ...mockAccountVerification,
        email: 'different@example.com',
      };
      mockAccountVerificationService.verifyRegistrationToken.mockResolvedValue(mismatchedAccountVerification);

      // Act & Assert
      await expect(service.register(mockRegisterDto, mockSecurityContext)).rejects.toThrow(
        new BadRequestException('Invalid verification code'),
      );

      expect(mockAccountVerificationService.verifyRegistrationToken).toHaveBeenCalled();
      expect(mockUserRepository.transaction).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException when phone number is invalid', async () => {
      // Arrange
      jest.spyOn(service, 'validatePhoneNumber').mockRejectedValue(new BadRequestException('Invalid phone number'));

      // Act & Assert
      await expect(service.register(mockRegisterDto, mockSecurityContext)).rejects.toThrow(
        new BadRequestException('Invalid phone number'),
      );

      expect(service.validatePhoneNumber).toHaveBeenCalledWith('+1234567890', 'US');
      expect(mockUserRepository.transaction).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException when phone number already exists', async () => {
      // Arrange
      jest.spyOn(service, 'validatePhoneNumber').mockResolvedValue(true);
      const existingPhoneUser = { id: 'existing-user-123', phone_number: '+1234567890' };

      const mockFirst = jest.fn().mockResolvedValue(null); // email check passes
      const mockWhereILike = jest.fn().mockReturnValue({ first: mockFirst });
      const mockQueryFindOne = jest.fn().mockResolvedValue(existingPhoneUser); // phone check fails
      mockUserRepository.query.mockReturnValue({ whereILike: mockWhereILike, findOne: mockQueryFindOne });

      // Act & Assert
      await expect(service.register(mockRegisterDto, mockSecurityContext)).rejects.toThrow(
        new BadRequestException('Phone number already in use'),
      );

      expect(service.validatePhoneNumber).toHaveBeenCalled();
      expect(mockUserRepository.transaction).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException when username already taken', async () => {
      // Arrange
      jest.spyOn(service, 'validatePhoneNumber').mockResolvedValue(true);
      const existingUsernameUser = { id: 'existing-user-123', username: 'newuser' };

      // First call returns null (email check passes), second call returns existing user (username check fails)
      const mockFirst = jest
        .fn()
        .mockResolvedValueOnce(null) // email check
        .mockResolvedValueOnce(existingUsernameUser); // username check
      const mockWhereILike = jest.fn().mockReturnValue({ first: mockFirst });
      const mockQueryFindOne = jest.fn().mockResolvedValue(null); // phone check passes
      mockUserRepository.query.mockReturnValue({ whereILike: mockWhereILike, findOne: mockQueryFindOne });

      // Act & Assert
      await expect(service.register(mockRegisterDto, mockSecurityContext)).rejects.toThrow(
        new BadRequestException('Username already taken'),
      );

      expect(mockUserRepository.transaction).not.toHaveBeenCalled();
    });

    it('should throw error when country validation fails', async () => {
      // Arrange
      jest.spyOn(service, 'validatePhoneNumber').mockResolvedValue(true);
      mockCountryService.validateCountryExists.mockRejectedValue(new BadRequestException('Invalid country'));

      // Act & Assert
      await expect(service.register(mockRegisterDto, mockSecurityContext)).rejects.toThrow(
        new BadRequestException('Invalid country'),
      );

      expect(mockCountryService.validateCountryExists).toHaveBeenCalledWith('country-123');
      expect(mockUserRepository.transaction).not.toHaveBeenCalled();
    });

    it('should throw InternalServerErrorException when user creation fails', async () => {
      // Arrange
      jest.spyOn(service, 'validatePhoneNumber').mockResolvedValue(true);
      mockUserRepository.transaction.mockRejectedValue(new Error('Database error'));

      // Act & Assert
      await expect(service.register(mockRegisterDto, mockSecurityContext)).rejects.toThrow(
        new InternalServerErrorException('Error while creating user'),
      );

      expect(mockUserRepository.transaction).toHaveBeenCalled();
    });

    it('should throw InternalServerErrorException when user profile creation fails', async () => {
      // Arrange
      jest.spyOn(service, 'validatePhoneNumber').mockResolvedValue(true);
      mockUserProfileRepository.create.mockRejectedValue(new Error('Profile creation failed'));

      mockUserRepository.transaction.mockImplementation(async (callback) => {
        const trx = {};
        return callback(trx);
      });

      // Act & Assert
      await expect(service.register(mockRegisterDto, mockSecurityContext)).rejects.toThrow(
        new InternalServerErrorException('Error while creating user'),
      );
    });

    it('should throw InternalServerErrorException when access token creation fails', async () => {
      // Arrange
      jest.spyOn(service, 'validatePhoneNumber').mockResolvedValue(true);
      mockAccessTokenService.create.mockRejectedValue(new Error('Token creation failed'));

      mockUserRepository.transaction.mockImplementation(async (callback) => {
        const trx = {};
        return callback(trx);
      });

      // Act & Assert
      await expect(service.register(mockRegisterDto, mockSecurityContext)).rejects.toThrow(
        new InternalServerErrorException('Error while creating user'),
      );
    });

    it('should throw InternalServerErrorException when refresh token creation fails', async () => {
      // Arrange
      jest.spyOn(service, 'validatePhoneNumber').mockResolvedValue(true);
      mockRefreshTokenService.create.mockRejectedValue(new Error('Refresh token creation failed'));

      mockUserRepository.transaction.mockImplementation(async (callback) => {
        const trx = {};
        return callback(trx);
      });

      // Act & Assert
      await expect(service.register(mockRegisterDto, mockSecurityContext)).rejects.toThrow(
        new InternalServerErrorException('Error while creating user'),
      );
    });

    it('should throw InternalServerErrorException when role assignment fails', async () => {
      // Arrange
      jest.spyOn(service, 'validatePhoneNumber').mockResolvedValue(true);
      mockUserRoleRepository.create.mockRejectedValue(new Error('Role assignment failed'));

      mockUserRepository.transaction.mockImplementation(async (callback) => {
        const trx = {};
        return callback(trx);
      });

      // Act & Assert
      await expect(service.register(mockRegisterDto, mockSecurityContext)).rejects.toThrow(
        new InternalServerErrorException('Error while creating user'),
      );
    });

    it('should throw InternalServerErrorException when marking account verification as used fails', async () => {
      // Arrange
      jest.spyOn(service, 'validatePhoneNumber').mockResolvedValue(true);
      mockAccountVerificationService.markAccountVerificationAsUsed.mockRejectedValue(
        new Error('Mark verification failed'),
      );

      mockUserRepository.transaction.mockImplementation(async (callback) => {
        const trx = {};
        return callback(trx);
      });

      // Act & Assert
      await expect(service.register(mockRegisterDto, mockSecurityContext)).rejects.toThrow(
        new InternalServerErrorException('Error while creating user'),
      );
    });

    it('should throw InternalServerErrorException when device registration fails', async () => {
      // Arrange
      jest.spyOn(service, 'validatePhoneNumber').mockResolvedValue(true);
      mockLoginDeviceService.registerDevice.mockRejectedValue(new Error('Device registration failed'));

      mockUserRepository.transaction.mockImplementation(async (callback) => {
        const trx = {};
        return callback(trx);
      });

      // Act & Assert
      await expect(service.register(mockRegisterDto, mockSecurityContext)).rejects.toThrow(
        new InternalServerErrorException('Error while creating user'),
      );
    });
  });
});
