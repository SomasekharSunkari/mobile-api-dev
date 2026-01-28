import { HttpStatus, InternalServerErrorException, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ThrottlerModule } from '@nestjs/throttler';
import { TransactionMonitoringAdapter } from '../../../adapters/transaction-monitoring/transaction-monitoring-adapter';
import { UserStatus } from '../../../database/models/user/user.interface';
import { UserModel } from '../../../database/models/user/user.model';
import { UserProfileModel } from '../../../database/models/userProfile/userProfile.model';
import { VerificationType } from '../../../database/models/verificationToken/verificationToken.interface';
import { AppLoggerService } from '../../../services/logger/logger.service';
import { MailerService } from '../../../services/queue/processors/mailer/mailer.service';
import { UtilsService } from '../../../utils/utils.service';
import { ExternalAccountRepository } from '../../externalAccount/external-account.repository';
import { UserTierService } from '../../userTier/userTier.service';
import { KycVerificationRepository } from '../kycVerification/kycVerification.repository';
import { KycVerificationService } from '../kycVerification/kycVerification.service';
import { JwtAuthGuard } from '../strategies/jwt-auth.guard';
import { UpdateUserDto } from '../userProfile/dto/updateUser.dto';
import { UserProfileService } from '../userProfile/userProfile.service';
import { VerificationTokenService } from '../verificationToken/verificationToken.service';
import { ChangePasswordDto } from './dtos/changePassword.dto';
import { SearchUserDto } from './dtos/searchUser.dto';
import { UserController } from './user.controller';
import { UserRepository } from './user.repository';
import { UserService } from './user.service';

describe('UserService', () => {
  let service: UserService;
  let userRepository: jest.Mocked<UserRepository>;
  let userProfileService: jest.Mocked<UserProfileService>;
  let mailerService: jest.Mocked<MailerService>;

  const mockUser = {
    id: 'user-1',
    first_name: 'Test',
    middle_name: undefined,
    last_name: 'User',
    username: 'testuser',
    email: 'test@example.com',
    password: 'hashedPassword123',
    is_email_verified: true,
    status: UserStatus.ACTIVE,
    country_id: 'country-1',
    created_at: new Date(),
    updated_at: new Date(),
  } as UserModel;

  const mockUserProfile = {
    id: 'profile-1',
    user_id: 'user-1',
    gender: 'male',
    address_line1: '123 Test St',
    address_line2: '',
    city: 'Test City',
    state_or_province: '',
    postal_code: '',
    dob: new Date(),
    created_at: new Date(),
    updated_at: new Date(),
  } as UserProfileModel;

  beforeEach(async () => {
    const mockUserRepository = {
      findOne: jest.fn(),
      findById: jest.fn(),
      update: jest.fn(),
      findSync: jest.fn(),
      paginateData: jest.fn(),
      findActiveByUsername: jest.fn(),
      query: jest.fn(),
    };

    const mockUserProfileService = {
      update: jest.fn(),
      getUploadUrl: jest.fn(),
      populateAvatarUrl: jest.fn(),
    };

    const mockMailerService = {
      send: jest.fn(),
    };

    const mockVerificationTokenService = {
      generateToken: jest.fn(),
      verifyToken: jest.fn(),
    };

    const mockKycVerificationService = {
      getRecentKycStatus: jest.fn().mockResolvedValue({ tier_level: 1, status: 'not_started' }),
      findByUserId: jest.fn(),
      initiateWidgetKyc: jest.fn(),
      updateKycStatus: jest.fn(),
      ensureUserTierRecord: jest.fn(),
      findUserKycVerifications: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        { provide: UserRepository, useValue: mockUserRepository },
        { provide: UserProfileService, useValue: mockUserProfileService },
        { provide: MailerService, useValue: mockMailerService },
        { provide: KycVerificationRepository, useValue: { findByUserId: jest.fn() } },
        { provide: KycVerificationService, useValue: mockKycVerificationService },
        { provide: ExternalAccountRepository, useValue: { findOne: jest.fn().mockResolvedValue(null) } },
        {
          provide: TransactionMonitoringAdapter,
          useValue: {
            ipCheck: jest.fn(),
            ipCheckForApplicant: jest.fn(),
          },
        },
        { provide: VerificationTokenService, useValue: mockVerificationTokenService },
        {
          provide: UserTierService,
          useValue: { getAssetLimits: jest.fn(), getUserCurrentTier: jest.fn().mockResolvedValue(undefined) },
        },
        {
          provide: UserService,
          useFactory: (
            userRepository,
            userProfileService,
            mailerService,
            kycVerificationRepository,
            kycVerificationService,
            externalAccountRepository,
            transactionMonitoringAdapter,
            verificationTokenService,
            userTierService,
          ) => {
            const service = new UserService();
            (service as any).userRepository = userRepository;
            (service as any).userProfileService = userProfileService;
            (service as any).mailerService = mailerService;
            (service as any).kycVerificationRepository = kycVerificationRepository;
            (service as any).kycVerificationService = kycVerificationService;
            (service as any).externalAccountRepository = externalAccountRepository;
            (service as any).transactionMonitoringAdapter = transactionMonitoringAdapter;
            (service as any).verificationTokenService = verificationTokenService;
            (service as any).userTierService = userTierService;
            return service;
          },
          inject: [
            UserRepository,
            UserProfileService,
            MailerService,
            KycVerificationRepository,
            KycVerificationService,
            ExternalAccountRepository,
            TransactionMonitoringAdapter,
            VerificationTokenService,
            UserTierService,
          ],
        },
      ],
    }).compile();

    service = module.get<UserService>(UserService);
    userRepository = module.get(UserRepository) as jest.Mocked<UserRepository>;
    userProfileService = module.get(UserProfileService) as jest.Mocked<UserProfileService>;
    mailerService = module.get(MailerService) as jest.Mocked<MailerService>;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getUserDetails', () => {
    const mockSecurityContext = {
      clientIp: '192.168.1.1',
      fingerprint: 'test-fingerprint',
      deviceInfo: {
        device_name: 'Test Device',
        device_type: 'mobile',
        os: 'iOS',
        browser: 'Safari',
      },
    };

    const mockUserWithDetails = {
      id: 'user-1',
      email: 'test@example.com',
      username: 'testuser',
      password: 'hashedPassword123',
      first_name: 'Test',
      last_name: 'User',
      phone_number: '1234567890',
      account_verified: true,
      kyc_status: 'verified',
      recent_kyc_status: {
        tier_level: 1,
        status: 'verified' as any,
      },
      linked_external_account_status: 'active',
      current_tier: 1,
    };

    it('should return user details without password and with isBlacklistedRegion flag', async () => {
      // Mock the findByUserId method
      jest.spyOn(service, 'findByUserId').mockResolvedValue(mockUserWithDetails as any);

      // Mock KYC repository
      const mockKycRecord = { status: 'approved', provider_ref: 'test-applicant-id' };
      (service as any).kycVerificationRepository.findByUserId.mockResolvedValue(mockKycRecord);

      // Mock transaction monitoring adapter
      const mockLocationData = { country: 'US', region: 'California' };
      (service as any).transactionMonitoringAdapter.ipCheckForApplicant.mockResolvedValue(mockLocationData);

      const result = await service.getUserDetails('user-1', mockSecurityContext);

      expect(result).toEqual({
        id: 'user-1',
        email: 'test@example.com',
        username: 'testuser',
        first_name: 'Test',
        last_name: 'User',
        phone_number: '1234567890',
        account_verified: true,
        kyc_status: 'verified',
        recent_kyc_status: {
          tier_level: 1,
          status: 'verified',
        },
        linked_external_account_status: 'active',
        current_tier: 1,
        isBlacklistedRegion: false,
      });

      // Ensure password is not included
      expect(result).not.toHaveProperty('password');
    });

    it('should return isBlacklistedRegion as true for New York IP', async () => {
      // Mock the findByUserId method
      jest.spyOn(service, 'findByUserId').mockResolvedValue(mockUserWithDetails as any);

      // Mock KYC repository
      const mockKycRecord = { status: 'approved', provider_ref: 'test-applicant-id' };
      (service as any).kycVerificationRepository.findByUserId.mockResolvedValue(mockKycRecord);

      // Mock transaction monitoring adapter with New York location
      const mockLocationData = { country: 'US', region: 'New York' };
      (service as any).transactionMonitoringAdapter.ipCheckForApplicant.mockResolvedValue(mockLocationData);

      const result = await service.getUserDetails('user-1', mockSecurityContext);

      expect(result.isBlacklistedRegion).toBe(true);
      expect(result).not.toHaveProperty('password');
    });

    it('should handle location check errors gracefully', async () => {
      // Mock the findByUserId method
      jest.spyOn(service, 'findByUserId').mockResolvedValue(mockUserWithDetails as any);

      // Mock KYC repository
      const mockKycRecord = { status: 'approved', provider_ref: 'test-applicant-id' };
      (service as any).kycVerificationRepository.findByUserId.mockResolvedValue(mockKycRecord);

      // Mock transaction monitoring adapter to throw error
      (service as any).transactionMonitoringAdapter.ipCheckForApplicant.mockRejectedValue(new Error('API Error'));

      const result = await service.getUserDetails('user-1', mockSecurityContext);

      expect(result.isBlacklistedRegion).toBe(false);
      expect(result).not.toHaveProperty('password');
    });

    it('should use ipCheck when KYC status is not approved', async () => {
      jest.spyOn(service, 'findByUserId').mockResolvedValue(mockUserWithDetails as any);

      const mockKycRecord = { status: 'pending', provider_ref: null };
      (service as any).kycVerificationRepository.findByUserId.mockResolvedValue(mockKycRecord);

      const mockLocationData = { country: 'US', region: 'California' };
      (service as any).transactionMonitoringAdapter.ipCheck.mockResolvedValue(mockLocationData);

      const result = await service.getUserDetails('user-1', mockSecurityContext);

      expect((service as any).transactionMonitoringAdapter.ipCheck).toHaveBeenCalledWith({
        ipAddress: '192.168.1.1',
        userId: 'user-1',
      });
      expect((service as any).transactionMonitoringAdapter.ipCheckForApplicant).not.toHaveBeenCalled();
      expect(result.isBlacklistedRegion).toBe(false);
    });

    it('should not call ipCheck when KYC is approved but no applicantId', async () => {
      jest.spyOn(service, 'findByUserId').mockResolvedValue(mockUserWithDetails as any);

      const mockKycRecord = { status: 'approved', provider_ref: null };
      (service as any).kycVerificationRepository.findByUserId.mockResolvedValue(mockKycRecord);

      const result = await service.getUserDetails('user-1', mockSecurityContext);

      expect((service as any).transactionMonitoringAdapter.ipCheck).not.toHaveBeenCalled();
      expect((service as any).transactionMonitoringAdapter.ipCheckForApplicant).not.toHaveBeenCalled();
      expect(result.isBlacklistedRegion).toBe(false);
    });

    it('should handle getUserDetails error gracefully', async () => {
      jest.spyOn(service, 'findByUserId').mockRejectedValue(new Error('Find failed'));

      await expect(service.getUserDetails('user-1', mockSecurityContext)).rejects.toThrow(InternalServerErrorException);
    });
  });

  describe('updateProfile', () => {
    const updateUserDto: UpdateUserDto = {
      gender: 'male',
      address_line1: '123 Test St',
      city: 'Test City',
    };

    it('should update user profile successfully', async () => {
      userProfileService.update.mockResolvedValue(mockUserProfile);

      const result = await service.updateProfile('user-1', updateUserDto);

      expect(userProfileService.update).toHaveBeenCalledWith('user-1', updateUserDto);
      expect(result).toEqual(mockUserProfile);
    });

    it('should throw InternalServerErrorException when update fails', async () => {
      userProfileService.update.mockRejectedValue(new Error('Update failed'));

      await expect(service.updateProfile('user-1', updateUserDto)).rejects.toThrow(InternalServerErrorException);
      expect(userProfileService.update).toHaveBeenCalledWith('user-1', updateUserDto);
    });
  });

  describe('changePassword', () => {
    const changePasswordDto: ChangePasswordDto = {
      old_password: 'oldPassword123',
      new_password: 'newPassword123',
      confirm_new_password: 'newPassword123',
    };

    beforeEach(() => {
      jest.spyOn(UtilsService, 'hashPassword').mockResolvedValue('hashedNewPassword123');
      jest.spyOn(UtilsService, 'comparePassword').mockResolvedValue(true);
    });

    it('should change password successfully', async () => {
      userRepository.findOne.mockResolvedValue(mockUser);
      userRepository.update.mockResolvedValue(mockUser);

      const result = await service.changePassword('user-1', changePasswordDto);

      expect(userRepository.findOne).toHaveBeenCalledWith({ id: 'user-1' });
      expect(UtilsService.comparePassword).toHaveBeenCalledWith('oldPassword123', 'hashedPassword123');
      expect(UtilsService.hashPassword).toHaveBeenCalledWith('newPassword123');
      expect(userRepository.update).toHaveBeenCalledWith('user-1', { password: 'hashedNewPassword123' });
      expect(mailerService.send).toHaveBeenCalled();
      expect(result).toEqual({ success: true, message: 'Password changed successfully' });
    });

    it('should throw InternalServerErrorException when new password is same as old password', async () => {
      const samePasswordDto = {
        ...changePasswordDto,
        old_password: 'samePassword',
        new_password: 'samePassword',
      };

      await expect(service.changePassword('user-1', samePasswordDto)).rejects.toThrow(InternalServerErrorException);
      expect(userRepository.findOne).not.toHaveBeenCalled();
    });

    it('should throw InternalServerErrorException when user not found', async () => {
      userRepository.findOne.mockResolvedValue(undefined);

      await expect(service.changePassword('user-1', changePasswordDto)).rejects.toThrow(InternalServerErrorException);
      expect(userRepository.findOne).toHaveBeenCalledWith({ id: 'user-1' });
    });

    it('should throw InternalServerErrorException when old password does not match', async () => {
      userRepository.findOne.mockResolvedValue(mockUser);
      jest.spyOn(UtilsService, 'comparePassword').mockResolvedValue(false);

      await expect(service.changePassword('user-1', changePasswordDto)).rejects.toThrow(InternalServerErrorException);
      expect(userRepository.findOne).toHaveBeenCalledWith({ id: 'user-1' });
      expect(UtilsService.comparePassword).toHaveBeenCalledWith('oldPassword123', 'hashedPassword123');
    });

    it('should throw InternalServerErrorException when password update fails', async () => {
      userRepository.findOne.mockResolvedValue(mockUser);
      userRepository.update.mockRejectedValue(new Error('Update failed'));

      await expect(service.changePassword('user-1', changePasswordDto)).rejects.toThrow(InternalServerErrorException);
      expect(userRepository.findOne).toHaveBeenCalledWith({ id: 'user-1' });
      expect(UtilsService.comparePassword).toHaveBeenCalledWith('oldPassword123', 'hashedPassword123');
      expect(UtilsService.hashPassword).toHaveBeenCalledWith('newPassword123');
      expect(userRepository.update).toHaveBeenCalledWith('user-1', { password: 'hashedNewPassword123' });
    });
  });

  describe('findActiveByEmail', () => {
    it('should find active user by email successfully', async () => {
      userRepository.findOne.mockResolvedValue(mockUser);

      const result = await service.findActiveByEmail('test@example.com');

      expect(userRepository.findOne).toHaveBeenCalledWith({
        email: 'test@example.com',
        status: 'active',
      });
      expect(result).toEqual(mockUser);
    });

    it('should throw InternalServerErrorException when find fails', async () => {
      userRepository.findOne.mockRejectedValue(new Error('Find failed'));

      await expect(service.findActiveByEmail('test@example.com')).rejects.toThrow(InternalServerErrorException);
      expect(userRepository.findOne).toHaveBeenCalledWith({
        email: 'test@example.com',
        status: 'active',
      });
    });
  });

  describe('findByUserId', () => {
    it('should find user by id successfully', async () => {
      userRepository.findById.mockResolvedValue(mockUser as any);
      (service as any).kycVerificationService.getRecentKycStatus.mockResolvedValue({ status: 'not_started' });

      const result = await service.findByUserId('user-1');

      expect(userRepository.findById).toHaveBeenCalledWith('user-1', '[country,userProfile]');
      expect((service as any).kycVerificationService.getRecentKycStatus).toHaveBeenCalledWith('user-1');
      expect(result).toMatchObject({
        ...mockUser,
        account_verified: true,
        kyc_status: 'not_started',
        current_tier: undefined,
      });
    });

    it('should find user by id with approved kyc status', async () => {
      userRepository.findById.mockResolvedValue(mockUser as any);
      (service as any).kycVerificationService.getRecentKycStatus.mockResolvedValue({ status: 'approved' });
      (service as any).userTierService.getUserCurrentTier.mockResolvedValue({ level: 1 });

      const result = await service.findByUserId('user-1');

      expect(userRepository.findById).toHaveBeenCalledWith('user-1', '[country,userProfile]');
      expect((service as any).kycVerificationService.getRecentKycStatus).toHaveBeenCalledWith('user-1');
      expect(result).toMatchObject({
        ...mockUser,
        account_verified: true,
        kyc_status: 'approved',
        current_tier: 1,
      });
    });

    it('should handle null kyc status and return not_started', async () => {
      userRepository.findById.mockResolvedValue(mockUser as any);
      (service as any).kycVerificationService.getRecentKycStatus.mockResolvedValue(null);

      const result = await service.findByUserId('user-1');

      expect(userRepository.findById).toHaveBeenCalledWith('user-1', '[country,userProfile]');
      expect((service as any).kycVerificationService.getRecentKycStatus).toHaveBeenCalledWith('user-1');
      expect(result).toMatchObject({
        ...mockUser,
        account_verified: true,
        kyc_status: 'not_started',
        current_tier: undefined,
      });
    });

    it('should throw InternalServerErrorException when user not found', async () => {
      userRepository.findById.mockResolvedValue(undefined);

      await expect(service.findByUserId('user-1')).rejects.toThrow(InternalServerErrorException);
      expect(userRepository.findById).toHaveBeenCalledWith('user-1', '[country,userProfile]');
    });

    it('should throw InternalServerErrorException when find fails', async () => {
      userRepository.findById.mockRejectedValue(new Error('Find failed'));

      await expect(service.findByUserId('user-1')).rejects.toThrow(InternalServerErrorException);
      expect(userRepository.findById).toHaveBeenCalledWith('user-1', '[country,userProfile]');
    });

    it('should populate avatar URL when user has userProfile', async () => {
      const userWithProfile = {
        ...mockUser,
        userProfile: mockUserProfile,
      };
      userRepository.findById.mockResolvedValue(userWithProfile as any);
      (service as any).kycVerificationService.getRecentKycStatus.mockResolvedValue({ status: 'not_started' });
      userProfileService.populateAvatarUrl.mockResolvedValue(undefined);

      await service.findByUserId('user-1');

      expect(userProfileService.populateAvatarUrl).toHaveBeenCalledWith(mockUserProfile);
    });

    it('should not populate avatar URL when user has no userProfile', async () => {
      userRepository.findById.mockResolvedValue(mockUser as any);
      (service as any).kycVerificationService.getRecentKycStatus.mockResolvedValue({ status: 'not_started' });

      await service.findByUserId('user-1');

      expect(userProfileService.populateAvatarUrl).not.toHaveBeenCalled();
    });
  });

  describe('findByUserName', () => {
    it('should find user by username successfully', async () => {
      const mockQueryBuilder = {
        whereILike: jest.fn().mockReturnThis(),
        first: jest.fn().mockResolvedValue(mockUser),
      };
      userRepository.query.mockReturnValue(mockQueryBuilder as any);

      const result = await service.findByUserName('testuser');

      expect(userRepository.query).toHaveBeenCalled();
      expect(mockQueryBuilder.whereILike).toHaveBeenCalledWith('username', 'testuser');
      expect(mockQueryBuilder.first).toHaveBeenCalled();
      expect(result).toEqual(mockUser);
    });

    it('should throw InternalServerErrorException when user not found', async () => {
      const mockQueryBuilder = {
        whereILike: jest.fn().mockReturnThis(),
        first: jest.fn().mockResolvedValue(undefined),
      };
      userRepository.query.mockReturnValue(mockQueryBuilder as any);

      await expect(service.findByUserName('testuser')).rejects.toThrow(InternalServerErrorException);
      expect(userRepository.query).toHaveBeenCalled();
      expect(mockQueryBuilder.whereILike).toHaveBeenCalledWith('username', 'testuser');
    });

    it('should throw InternalServerErrorException when find fails', async () => {
      const mockQueryBuilder = {
        whereILike: jest.fn().mockReturnThis(),
        first: jest.fn().mockRejectedValue(new Error('Find failed')),
      };
      userRepository.query.mockReturnValue(mockQueryBuilder as any);

      await expect(service.findByUserName('testuser')).rejects.toThrow(InternalServerErrorException);
      expect(userRepository.query).toHaveBeenCalled();
      expect(mockQueryBuilder.whereILike).toHaveBeenCalledWith('username', 'testuser');
    });
  });

  describe('deactivateUser', () => {
    it('should deactivate user successfully', async () => {
      userRepository.findById.mockResolvedValue(mockUser as any);
      userRepository.update.mockResolvedValue(mockUser as any);

      const result = await service.deactivateUser('user-1');

      expect(userRepository.findById).toHaveBeenCalledWith('user-1', '', undefined);
      expect(userRepository.update).toHaveBeenCalledWith('user-1', { is_deactivated: true }, { trx: undefined });
      expect(result).toEqual({ success: true, message: 'User deactivated successfully' });
    });

    it('should deactivate user with transaction', async () => {
      const mockTransaction = {} as any;
      userRepository.findById.mockResolvedValue(mockUser as any);
      userRepository.update.mockResolvedValue(mockUser as any);

      const result = await service.deactivateUser('user-1', mockTransaction);

      expect(userRepository.findById).toHaveBeenCalledWith('user-1', '', mockTransaction);
      expect(userRepository.update).toHaveBeenCalledWith('user-1', { is_deactivated: true }, { trx: mockTransaction });
      expect(result).toEqual({ success: true, message: 'User deactivated successfully' });
    });

    it('should throw InternalServerErrorException when user not found', async () => {
      userRepository.findById.mockResolvedValue(undefined);

      await expect(service.deactivateUser('user-1')).rejects.toThrow(InternalServerErrorException);
      expect(userRepository.findById).toHaveBeenCalledWith('user-1', '', undefined);
      expect(userRepository.update).not.toHaveBeenCalled();
    });
  });

  describe('activateUser', () => {
    it('should activate user successfully', async () => {
      userRepository.update.mockResolvedValue(mockUser as any);

      const result = await service.activateUser('user-1');

      expect(userRepository.update).toHaveBeenCalledWith('user-1', { is_deactivated: false }, { trx: undefined });
      expect(result).toEqual({ success: true, message: 'User activated successfully' });
    });

    it('should activate user with transaction', async () => {
      const mockTransaction = {} as any;
      userRepository.update.mockResolvedValue(mockUser as any);

      const result = await service.activateUser('user-1', mockTransaction);

      expect(userRepository.update).toHaveBeenCalledWith('user-1', { is_deactivated: false }, { trx: mockTransaction });
      expect(result).toEqual({ success: true, message: 'User activated successfully' });
    });

    it('should throw InternalServerErrorException when activation fails', async () => {
      userRepository.update.mockRejectedValue(new Error('Activation failed'));

      await expect(service.activateUser('user-1')).rejects.toThrow(InternalServerErrorException);
      expect(userRepository.update).toHaveBeenCalledWith('user-1', { is_deactivated: false }, { trx: undefined });
    });
  });

  describe('searchUsers', () => {
    const searchingUser = {
      id: 'searching-user-1',
      username: 'searchinguser',
    } as UserModel;

    const mockSearchResults = {
      users: [
        {
          id: 'user-2',
          username: 'testuser2',
          first_name: 'Test',
          last_name: 'User2',
          email: 'test2@example.com',
        },
        {
          id: 'user-3',
          username: 'testuser3',
          first_name: 'Test',
          last_name: 'User3',
          email: 'test3@example.com',
        },
      ],
      pagination: {
        current_page: 1,
        next_page: 0,
        previous_page: 0,
        limit: 30,
        page_count: 1,
        total: 2,
      },
    };

    const mockQueryBuilder = {
      join: jest.fn().mockReturnThis(),
      joinRelated: jest.fn().mockReturnThis(),
      withGraphFetched: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      clearOrder: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      where: jest.fn(function (arg1) {
        // Handle both where(column, operator, value) and where(callback)
        if (typeof arg1 === 'function') {
          // Call the callback with a mock builder for OR conditions
          arg1({
            whereILike: jest.fn().mockReturnThis(),
            orWhereILike: jest.fn().mockReturnThis(),
          });
        }
        return this;
      }),
      whereNot: jest.fn().mockReturnThis(),
      distinct: jest.fn().mockReturnThis(),
    };

    beforeEach(() => {
      jest.spyOn(UserModel, 'publicProperty').mockReturnValue(['id', 'username', 'first_name', 'last_name', 'email']);
    });

    it('should search users without asset/network filters successfully', async () => {
      userRepository.findSync.mockReturnValue(mockQueryBuilder as any);
      userRepository.paginateData.mockResolvedValue(mockSearchResults as any);

      const searchDto: SearchUserDto = { search: 'testuser' };
      const result = await service.searchUsers(searchingUser, searchDto);

      expect(userRepository.findSync).toHaveBeenCalledWith({});
      expect(mockQueryBuilder.where).toHaveBeenCalledWith('users.id', '!=', 'searching-user-1');
      expect(mockQueryBuilder.where).toHaveBeenCalledWith(expect.any(Function)); // Search callback
      expect(mockQueryBuilder.join).toHaveBeenCalledWith(
        'api_service.kyc_verifications',
        'users.id',
        'kyc_verifications.user_id',
      );
      expect(mockQueryBuilder.where).toHaveBeenCalledWith('kyc_verifications.status', 'approved');
      expect(mockQueryBuilder.select).toHaveBeenCalledWith([
        'users.id',
        'users.username',
        'users.first_name',
        'users.last_name',
        'users.email',
        'users.updated_at',
      ]);
      expect(mockQueryBuilder.withGraphFetched).toHaveBeenCalledWith('userProfile');
      expect(mockQueryBuilder.distinct).toHaveBeenCalledWith('users.id');
      expect(mockQueryBuilder.clearOrder).toHaveBeenCalled();
      expect(mockQueryBuilder.orderBy).toHaveBeenCalledWith('users.updated_at', 'desc');
      expect(userRepository.paginateData).toHaveBeenCalledWith(mockQueryBuilder, 30, 1);
      expect(result).toEqual(mockSearchResults);
    });

    it('should search users with asset filter', async () => {
      userRepository.findSync.mockReturnValue(mockQueryBuilder as any);
      userRepository.paginateData.mockResolvedValue(mockSearchResults as any);

      const searchDto: SearchUserDto = { search: 'testuser', asset: 'USDC' };
      const result = await service.searchUsers(searchingUser, searchDto);

      expect(userRepository.findSync).toHaveBeenCalledWith({});
      expect(mockQueryBuilder.where).toHaveBeenCalledWith('users.id', '!=', 'searching-user-1');
      expect(mockQueryBuilder.where).toHaveBeenCalledWith(expect.any(Function)); // Search callback
      expect(mockQueryBuilder.join).toHaveBeenCalledWith(
        'api_service.kyc_verifications',
        'users.id',
        'kyc_verifications.user_id',
      );
      expect(mockQueryBuilder.where).toHaveBeenCalledWith('kyc_verifications.status', 'approved');
      expect(mockQueryBuilder.select).toHaveBeenCalledWith([
        'users.id',
        'users.username',
        'users.first_name',
        'users.last_name',
        'users.email',
        'users.updated_at',
      ]);
      expect(mockQueryBuilder.joinRelated).toHaveBeenCalledWith('blockchainWallets');
      expect(mockQueryBuilder.withGraphFetched).toHaveBeenCalledWith('blockchainWallets');
      expect(mockQueryBuilder.where).toHaveBeenCalledWith('blockchainWallets.asset', 'USDC');
      expect(mockQueryBuilder.distinct).toHaveBeenCalledWith('users.id');
      expect(mockQueryBuilder.clearOrder).toHaveBeenCalled();
      expect(mockQueryBuilder.orderBy).toHaveBeenCalledWith('users.updated_at', 'desc');
      expect(userRepository.paginateData).toHaveBeenCalledWith(mockQueryBuilder, 30, 1);
      expect(result).toEqual(mockSearchResults);
    });

    it('should search users with network filter', async () => {
      userRepository.findSync.mockReturnValue(mockQueryBuilder as any);
      userRepository.paginateData.mockResolvedValue(mockSearchResults as any);

      const searchDto: SearchUserDto = { search: 'testuser', network: 'ethereum' };
      const result = await service.searchUsers(searchingUser, searchDto);

      expect(userRepository.findSync).toHaveBeenCalledWith({});
      expect(mockQueryBuilder.where).toHaveBeenCalledWith('users.id', '!=', 'searching-user-1');
      expect(mockQueryBuilder.where).toHaveBeenCalledWith(expect.any(Function)); // Search callback
      expect(mockQueryBuilder.join).toHaveBeenCalledWith(
        'api_service.kyc_verifications',
        'users.id',
        'kyc_verifications.user_id',
      );
      expect(mockQueryBuilder.where).toHaveBeenCalledWith('kyc_verifications.status', 'approved');
      expect(mockQueryBuilder.select).toHaveBeenCalledWith([
        'users.id',
        'users.username',
        'users.first_name',
        'users.last_name',
        'users.email',
        'users.updated_at',
      ]);
      expect(mockQueryBuilder.joinRelated).toHaveBeenCalledWith('blockchainWallets');
      expect(mockQueryBuilder.withGraphFetched).toHaveBeenCalledWith('blockchainWallets');
      expect(mockQueryBuilder.where).toHaveBeenCalledWith('blockchainWallets.network', 'ethereum');
      expect(mockQueryBuilder.distinct).toHaveBeenCalledWith('users.id');
      expect(mockQueryBuilder.clearOrder).toHaveBeenCalled();
      expect(mockQueryBuilder.orderBy).toHaveBeenCalledWith('users.updated_at', 'desc');
      expect(userRepository.paginateData).toHaveBeenCalledWith(mockQueryBuilder, 30, 1);
      expect(result).toEqual(mockSearchResults);
    });

    it('should search users with both asset and network filters', async () => {
      userRepository.findSync.mockReturnValue(mockQueryBuilder as any);
      userRepository.paginateData.mockResolvedValue(mockSearchResults as any);

      const searchDto: SearchUserDto = { search: 'testuser', asset: 'USDC', network: 'ethereum' };
      const result = await service.searchUsers(searchingUser, searchDto);

      expect(userRepository.findSync).toHaveBeenCalledWith({});
      expect(mockQueryBuilder.where).toHaveBeenCalledWith('users.id', '!=', 'searching-user-1');
      expect(mockQueryBuilder.where).toHaveBeenCalledWith(expect.any(Function)); // Search callback
      expect(mockQueryBuilder.join).toHaveBeenCalledWith(
        'api_service.kyc_verifications',
        'users.id',
        'kyc_verifications.user_id',
      );
      expect(mockQueryBuilder.where).toHaveBeenCalledWith('kyc_verifications.status', 'approved');
      expect(mockQueryBuilder.select).toHaveBeenCalledWith([
        'users.id',
        'users.username',
        'users.first_name',
        'users.last_name',
        'users.email',
        'users.updated_at',
      ]);
      expect(mockQueryBuilder.joinRelated).toHaveBeenCalledWith('blockchainWallets');
      expect(mockQueryBuilder.withGraphFetched).toHaveBeenCalledWith('blockchainWallets');
      expect(mockQueryBuilder.where).toHaveBeenCalledWith('blockchainWallets.asset', 'USDC');
      expect(mockQueryBuilder.where).toHaveBeenCalledWith('blockchainWallets.network', 'ethereum');
      expect(mockQueryBuilder.distinct).toHaveBeenCalledWith('users.id');
      expect(mockQueryBuilder.clearOrder).toHaveBeenCalled();
      expect(mockQueryBuilder.orderBy).toHaveBeenCalledWith('users.updated_at', 'desc');
      expect(userRepository.paginateData).toHaveBeenCalledWith(mockQueryBuilder, 30, 1);
      expect(result).toEqual(mockSearchResults);
    });

    it('should handle empty search term', async () => {
      userRepository.findSync.mockReturnValue(mockQueryBuilder as any);
      userRepository.paginateData.mockResolvedValue(mockSearchResults as any);

      const searchDto: SearchUserDto = { search: '' };
      const result = await service.searchUsers(searchingUser, searchDto);

      expect(userRepository.findSync).toHaveBeenCalledWith({});
      expect(mockQueryBuilder.where).toHaveBeenCalledWith('users.id', '!=', 'searching-user-1');
      expect(mockQueryBuilder.join).toHaveBeenCalledWith(
        'api_service.kyc_verifications',
        'users.id',
        'kyc_verifications.user_id',
      );
      expect(mockQueryBuilder.where).toHaveBeenCalledWith('kyc_verifications.status', 'approved');
      expect(mockQueryBuilder.select).toHaveBeenCalledWith([
        'users.id',
        'users.username',
        'users.first_name',
        'users.last_name',
        'users.email',
        'users.updated_at',
      ]);
      expect(mockQueryBuilder.distinct).toHaveBeenCalledWith('users.id');
      expect(mockQueryBuilder.clearOrder).toHaveBeenCalled();
      expect(mockQueryBuilder.orderBy).toHaveBeenCalledWith('users.updated_at', 'desc');
      expect(userRepository.paginateData).toHaveBeenCalledWith(mockQueryBuilder, 30, 1);
      expect(result).toEqual(mockSearchResults);
    });

    it('should throw InternalServerErrorException when repository findSync fails', async () => {
      userRepository.findSync.mockImplementation(() => {
        throw new Error('Database connection failed');
      });

      const searchDto: SearchUserDto = { search: 'testuser' };
      await expect(service.searchUsers(searchingUser, searchDto)).rejects.toThrow(InternalServerErrorException);
      await expect(service.searchUsers(searchingUser, searchDto)).rejects.toThrow(
        'Something went wrong while searching users',
      );
      expect(userRepository.findSync).toHaveBeenCalledWith({});
    });

    it('should throw InternalServerErrorException when repository paginateData fails', async () => {
      userRepository.findSync.mockReturnValue(mockQueryBuilder as any);
      userRepository.paginateData.mockRejectedValue(new Error('Pagination failed'));

      const searchDto: SearchUserDto = { search: 'testuser' };
      await expect(service.searchUsers(searchingUser, searchDto)).rejects.toThrow(InternalServerErrorException);
      await expect(service.searchUsers(searchingUser, searchDto)).rejects.toThrow(
        'Something went wrong while searching users',
      );
      expect(userRepository.findSync).toHaveBeenCalledWith({});
      expect(userRepository.paginateData).toHaveBeenCalledWith(mockQueryBuilder, 30, 1);
    });

    it('should use correct pagination parameters', async () => {
      userRepository.findSync.mockReturnValue(mockQueryBuilder as any);
      userRepository.paginateData.mockResolvedValue(mockSearchResults as any);

      const searchDto: SearchUserDto = { search: 'testuser' };
      await service.searchUsers(searchingUser, searchDto);

      expect(userRepository.paginateData).toHaveBeenCalledWith(mockQueryBuilder, 30, 1);
    });

    it('should search users with walletId filter', async () => {
      const searchDto: SearchUserDto = {
        search: 'test',
        wallet_id: 'wallet-123',
      };

      userRepository.findSync.mockReturnValue(mockQueryBuilder as any);
      userRepository.paginateData.mockResolvedValue(mockSearchResults as any);

      await service.searchUsers(searchingUser, searchDto);

      expect(mockQueryBuilder.joinRelated).toHaveBeenCalledWith('blockchainWallets');
      expect(mockQueryBuilder.withGraphFetched).toHaveBeenCalledWith('blockchainWallets');
      expect(mockQueryBuilder.where).toHaveBeenCalledWith('blockchainWallets.id', 'wallet-123');
    });

    it('should handle empty search results gracefully', async () => {
      const emptyResults = {
        users: [],
        pagination: {
          current_page: 1,
          next_page: 0,
          previous_page: 0,
          limit: 30,
          page_count: 0,
          total: 0,
        },
      };

      userRepository.findSync.mockReturnValue(mockQueryBuilder as any);
      userRepository.paginateData.mockResolvedValue(emptyResults as any);

      const searchDto: SearchUserDto = { search: 'nonexistentuser' };
      const result = await service.searchUsers(searchingUser, searchDto);

      expect(userRepository.findSync).toHaveBeenCalledWith({});
      expect(userRepository.paginateData).toHaveBeenCalledWith(mockQueryBuilder, 30, 1);
      expect(result).toEqual(emptyResults);
    });

    it('should populate avatar URLs for users with userProfile', async () => {
      const mockUserProfile = { user_id: 'user-2', image_key: 'profile-images/user-2.jpg', avatar_url: null };
      const resultsWithProfiles = {
        users: [
          {
            id: 'user-2',
            username: 'testuser2',
            first_name: 'Test',
            last_name: 'User2',
            email: 'test2@example.com',
            userProfile: mockUserProfile,
          },
          {
            id: 'user-3',
            username: 'testuser3',
            first_name: 'Test',
            last_name: 'User3',
            email: 'test3@example.com',
            userProfile: null,
          },
        ],
        pagination: mockSearchResults.pagination,
      };

      userRepository.findSync.mockReturnValue(mockQueryBuilder as any);
      userRepository.paginateData.mockResolvedValue(resultsWithProfiles as any);

      const searchDto: SearchUserDto = { search: 'testuser' };
      await service.searchUsers(searchingUser, searchDto);

      expect(userProfileService.populateAvatarUrl).toHaveBeenCalledTimes(1);
      expect(userProfileService.populateAvatarUrl).toHaveBeenCalledWith(mockUserProfile);
    });

    afterEach(() => {
      jest.clearAllMocks();
    });
  });

  describe('verifyPassword', () => {
    const mockVerificationTokenService = {
      generateToken: jest.fn(),
    };

    beforeEach(() => {
      (service as any).verificationTokenService = mockVerificationTokenService;
    });

    it('should return token for valid password', async () => {
      userRepository.findById = jest.fn().mockResolvedValue({ ...mockUser, password: 'hashed-password' });
      jest.spyOn(UtilsService, 'comparePassword').mockResolvedValue(true);

      const mockTokenResponse = {
        token: 'verification-token-123',
        tokenRecord: {
          id: 'token-id-123',
          user_id: 'user-1',
          token_identifier: 'token-identifier-abc',
          verification_type: VerificationType.CHANGE_PASSWORD,
          expires_at: new Date(),
          is_used: false,
          created_at: new Date(),
          updated_at: new Date(),
          deleted_at: null,
          used_at: null,
        } as any,
      };

      mockVerificationTokenService.generateToken.mockResolvedValue(mockTokenResponse);

      const result = await service.verifyPassword('user-1', {
        password: 'correct-password',
        verification_type: VerificationType.CHANGE_PASSWORD,
      });

      expect(userRepository.findById).toHaveBeenCalledWith('user-1', '[country,userProfile]');
      expect(UtilsService.comparePassword).toHaveBeenCalledWith('correct-password', 'hashed-password');
      expect(mockVerificationTokenService.generateToken).toHaveBeenCalledWith(
        'user-1',
        VerificationType.CHANGE_PASSWORD,
      );
      expect(result).toEqual(mockTokenResponse);
    });

    it('should throw UnauthorizedException for invalid password', async () => {
      userRepository.findById = jest.fn().mockResolvedValue({ ...mockUser, password: 'hashed-password' });
      jest.spyOn(UtilsService, 'comparePassword').mockResolvedValue(false);

      await expect(
        service.verifyPassword('user-1', {
          password: 'wrong-password',
          verification_type: VerificationType.CHANGE_PASSWORD,
        }),
      ).rejects.toThrow(UnauthorizedException);
      expect(userRepository.findById).toHaveBeenCalledWith('user-1', '[country,userProfile]');
      expect(UtilsService.comparePassword).toHaveBeenCalledWith('wrong-password', 'hashed-password');
    });
  });

  describe('findActiveByUsername', () => {
    it('should find active user by username successfully', async () => {
      userRepository.findActiveByUsername.mockResolvedValue(mockUser);

      const result = await service.findActiveByUsername('testuser');

      expect(userRepository.findActiveByUsername).toHaveBeenCalledWith('testuser');
      expect(result).toEqual(mockUser);
    });

    it('should return undefined when user not found', async () => {
      userRepository.findActiveByUsername.mockResolvedValue(undefined);

      const result = await service.findActiveByUsername('nonexistentuser');

      expect(userRepository.findActiveByUsername).toHaveBeenCalledWith('nonexistentuser');
      expect(result).toBeUndefined();
    });

    it('should throw InternalServerErrorException when find fails', async () => {
      userRepository.findActiveByUsername.mockRejectedValue(new Error('Database error'));

      await expect(service.findActiveByUsername('testuser')).rejects.toThrow(InternalServerErrorException);
      expect(userRepository.findActiveByUsername).toHaveBeenCalledWith('testuser');
    });
  });

  describe('getUploadUrl', () => {
    const mockGetUploadUrlResult = {
      uploadUrl: 'https://s3.amazonaws.com/bucket/profile.jpg?signed',
      key: 'profile-images/user-1/key.jpg',
      expiresIn: 3600,
    };

    it('should generate upload URL successfully', async () => {
      userProfileService.getUploadUrl.mockResolvedValue(mockGetUploadUrlResult);

      const result = await service.getUploadUrl(mockUser.id, 'image/jpeg');

      expect(userProfileService.getUploadUrl).toHaveBeenCalledWith(mockUser.id, 'image/jpeg');
      expect(result).toEqual(mockGetUploadUrlResult);
    });

    it('should throw error when generation fails', async () => {
      userProfileService.getUploadUrl.mockRejectedValue(new Error('Failed'));

      await expect(service.getUploadUrl(mockUser.id, 'image/jpeg')).rejects.toThrow('Failed');
    });
  });

  describe('updateDisableLoginRestrictions', () => {
    it('should update disable_login_restrictions successfully', async () => {
      const updatedUser = { ...mockUser, disable_login_restrictions: true } as UserModel;
      userRepository.findById.mockResolvedValue(mockUser as any);
      userRepository.update.mockResolvedValue(updatedUser);

      const result = await service.updateDisableLoginRestrictions('user-1', true);

      expect(userRepository.findById).toHaveBeenCalledWith('user-1');
      expect(userRepository.update).toHaveBeenCalledWith('user-1', { disable_login_restrictions: true });
      expect(result).toEqual(updatedUser);
    });

    it('should throw NotFoundException when user is not found', async () => {
      userRepository.findById.mockResolvedValue(undefined);

      await expect(service.updateDisableLoginRestrictions('user-1', true)).rejects.toThrow(NotFoundException);
      expect(userRepository.findById).toHaveBeenCalledWith('user-1');
      expect(userRepository.update).not.toHaveBeenCalled();
    });

    it('should throw InternalServerErrorException when update fails', async () => {
      userRepository.findById.mockResolvedValue(mockUser as any);
      userRepository.update.mockRejectedValue(new Error('Update failed'));

      await expect(service.updateDisableLoginRestrictions('user-1', false)).rejects.toThrow(
        InternalServerErrorException,
      );
      expect(userRepository.update).toHaveBeenCalledWith('user-1', { disable_login_restrictions: false });
    });
  });
});

describe('UserController', () => {
  let controller: UserController;
  let userService: jest.Mocked<UserService>;

  const mockUser = {
    id: 'user-1',
    first_name: 'Test',
    middle_name: undefined,
    last_name: 'User',
    username: 'testuser',
    email: 'test@example.com',
    password: 'hashedPassword123',
    is_email_verified: true,
    status: 'active',
    country_id: 'country-1',
    created_at: new Date(),
    updated_at: new Date(),
  } as UserModel;

  const mockUserProfile = {
    id: 'profile-1',
    user_id: 'user-1',
    gender: 'male',
    address_line1: '123 Test St',
    address_line2: '',
    city: 'Test City',
    state_or_province: '',
    postal_code: '',
    dob: new Date(),
    created_at: new Date(),
    updated_at: new Date(),
  } as UserProfileModel;

  beforeEach(async () => {
    const mockUserService = {
      updateProfile: jest.fn(),
      changePassword: jest.fn(),
      getUserDetails: jest.fn(),
      verifyPassword: jest.fn(),
      getUploadUrl: jest.fn(),
      updateDisableLoginRestrictions: jest.fn(),
    };

    const mockLoggerService = {
      logInfo: jest.fn(),
      logError: jest.fn(),
      logUserAction: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [UserController],
      providers: [
        { provide: UserService, useValue: mockUserService },
        { provide: AppLoggerService, useValue: mockLoggerService },
      ],
      imports: [
        ThrottlerModule.forRoot([
          {
            ttl: 10000,
            limit: 1,
          },
        ]),
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<UserController>(UserController);
    userService = module.get(UserService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getUser', () => {
    const mockSecurityContext = {
      clientIp: '192.168.1.1',
      fingerprint: 'test-fingerprint',
      deviceInfo: {
        device_name: 'Test Device',
        device_type: 'mobile',
        os: 'iOS',
        browser: 'Safari',
      },
    };

    const mockUserWithDetails = {
      id: 'user-1',
      email: 'test@example.com',
      username: 'testuser',
      first_name: 'Test',
      last_name: 'User',
      phone_number: '1234567890',
      password: 'hashedPassword123',
      is_email_verified: true,
      status: UserStatus.ACTIVE,
      is_deactivated: false,
      country_id: 'country-1',
      created_at: new Date(),
      updated_at: new Date(),
      account_verified: true,
      kyc_status: 'verified' as any,
      recent_kyc: {
        tier_level: 1,
        status: 'verified' as any,
      },
      linked_external_account_status: 'active',
      current_tier: 1,
      isBlacklistedRegion: false,
      userRoles: [],
      disable_login_restrictions: false,
    };

    it('should get user details successfully', async () => {
      userService.getUserDetails.mockResolvedValue(mockUserWithDetails);

      const result = await controller.getUser(mockUser, mockSecurityContext);

      expect(userService.getUserDetails).toHaveBeenCalledWith('user-1', mockSecurityContext);
      expect(result).toMatchObject({
        message: 'User fetched successfully',
        data: { user: mockUserWithDetails },
        statusCode: 200,
      });
      expect(result).toHaveProperty('timestamp');
    });
  });

  describe('updateProfile', () => {
    const updateUserDto: UpdateUserDto = {
      gender: 'male',
      address_line1: '123 Test St',
      city: 'Test City',
    };

    it('should update user profile successfully', async () => {
      userService.updateProfile.mockResolvedValue(mockUserProfile);

      const result = await controller.updateProfile(mockUser, updateUserDto);

      expect(userService.updateProfile).toHaveBeenCalledWith('user-1', updateUserDto);
      expect(result).toMatchObject({
        message: 'User Updated successfully',
        data: mockUserProfile,
        statusCode: HttpStatus.CREATED,
      });
      expect(result).toHaveProperty('timestamp');
    });

    it('should handle service errors gracefully', async () => {
      userService.updateProfile.mockRejectedValue(new InternalServerErrorException('Update failed'));

      await expect(controller.updateProfile(mockUser, updateUserDto)).rejects.toThrow(InternalServerErrorException);
      expect(userService.updateProfile).toHaveBeenCalledWith('user-1', updateUserDto);
    });
  });

  describe('changePassword', () => {
    const changePasswordDto: ChangePasswordDto = {
      old_password: 'oldPassword123',
      new_password: 'newPassword123',
      confirm_new_password: 'newPassword123',
    };

    const mockChangePasswordResponse = {
      success: true,
      message: 'Password changed successfully',
    };

    it('should change password successfully', async () => {
      userService.changePassword.mockResolvedValue(mockChangePasswordResponse);

      const result = await controller.changePassword(mockUser, changePasswordDto);

      expect(userService.changePassword).toHaveBeenCalledWith('user-1', changePasswordDto);
      expect(result).toMatchObject({
        message: 'Password changed successfully',
        data: mockChangePasswordResponse,
        statusCode: HttpStatus.OK,
      });
      expect(result).toHaveProperty('timestamp');
    });

    it('should handle service errors gracefully', async () => {
      userService.changePassword.mockRejectedValue(new InternalServerErrorException('Change failed'));

      await expect(controller.changePassword(mockUser, changePasswordDto)).rejects.toThrow(
        InternalServerErrorException,
      );
      expect(userService.changePassword).toHaveBeenCalledWith('user-1', changePasswordDto);
    });
  });

  describe('verifyPassword', () => {
    it('should verify password and return transformed response', async () => {
      const passwordData = { password: 'test-password', verification_type: VerificationType.CHANGE_PASSWORD };

      const mockTokenResponse = {
        token: 'verification-token-123',
        tokenRecord: {
          id: 'token-id-123',
          user_id: 'user-1',
          token_identifier: 'token-identifier-abc',
          verification_type: VerificationType.CHANGE_PASSWORD,
          expires_at: new Date(),
          is_used: false,
          created_at: new Date(),
          updated_at: new Date(),
          deleted_at: null,
          used_at: null,
        } as any,
      };

      userService.verifyPassword.mockResolvedValue(mockTokenResponse as any);

      const result = await controller.verifyPassword(mockUser, passwordData);

      expect(userService.verifyPassword).toHaveBeenCalledWith('user-1', passwordData);
      expect(result).toMatchObject({
        message: 'Password Verified',
        data: mockTokenResponse,
        statusCode: HttpStatus.CREATED,
      });
    });
  });

  describe('getBeneficiaries', () => {
    const mockSearchDto: SearchUserDto = {
      search: 'testuser',
    };

    const mockBeneficiaries = {
      users: [
        {
          id: 'user-2',
          username: 'testuser2',
          first_name: 'Test',
          last_name: 'User2',
          email: 'test2@example.com',
        },
      ],
      pagination: {
        current_page: 1,
        next_page: 0,
        previous_page: 0,
        limit: 30,
        page_count: 1,
        total: 1,
      },
    };

    it('should get beneficiaries successfully', async () => {
      (userService as any).searchUsers = jest.fn().mockResolvedValue(mockBeneficiaries);

      const result = await controller.getBeneficiaries(mockUser, mockSearchDto);

      expect((userService as any).searchUsers).toHaveBeenCalledWith(mockUser, mockSearchDto);
      expect(result).toMatchObject({
        message: 'Beneficiaries fetched successfully',
        data: mockBeneficiaries,
        statusCode: 200,
      });
      expect(result).toHaveProperty('timestamp');
    });

    it('should handle service errors gracefully', async () => {
      (userService as any).searchUsers = jest.fn().mockRejectedValue(new InternalServerErrorException('Search failed'));

      await expect(controller.getBeneficiaries(mockUser, mockSearchDto)).rejects.toThrow(InternalServerErrorException);
      expect((userService as any).searchUsers).toHaveBeenCalledWith(mockUser, mockSearchDto);
    });
  });

  describe('getUploadUrl', () => {
    const mockGetUploadUrlResult = {
      uploadUrl: 'https://s3.amazonaws.com/bucket/profile.jpg?signed',
      key: 'profile-images/user-1/key.jpg',
      expiresIn: 3600,
    };

    const contentTypeDto = { content_type: 'image/png' };

    it('should generate upload URL successfully', async () => {
      userService.getUploadUrl.mockResolvedValue(mockGetUploadUrlResult);

      const result = await controller.getUploadUrl(mockUser, contentTypeDto);

      expect(userService.getUploadUrl).toHaveBeenCalledWith(mockUser.id, contentTypeDto.content_type);
      expect(result).toMatchObject({
        message: 'Upload URL generated successfully',
        data: mockGetUploadUrlResult,
        statusCode: HttpStatus.OK,
      });
    });

    it('should handle service errors gracefully', async () => {
      userService.getUploadUrl.mockRejectedValue(new InternalServerErrorException('Failed to generate URL'));

      await expect(controller.getUploadUrl(mockUser, contentTypeDto)).rejects.toThrow(InternalServerErrorException);
    });
  });

  describe('updateDisableLoginRestrictions', () => {
    const userId = 'user-1';
    const updateDto = {
      disable_login_restrictions: true,
    };
    const updatedUser = {
      ...mockUser,
      disable_login_restrictions: true,
    } as UserModel;

    it('should update disable_login_restrictions successfully', async () => {
      userService.updateDisableLoginRestrictions.mockResolvedValue(updatedUser);

      const result = await controller.updateDisableLoginRestrictions(userId, updateDto);

      expect(userService.updateDisableLoginRestrictions).toHaveBeenCalledWith(userId, true);
      expect(result).toMatchObject({
        message: 'disable_login_restrictions updated successfully',
        data: updatedUser,
        statusCode: HttpStatus.OK,
      });
    });

    it('should disable login restrictions successfully', async () => {
      const disabledUser = {
        ...mockUser,
        disable_login_restrictions: false,
      } as UserModel;
      userService.updateDisableLoginRestrictions.mockResolvedValue(disabledUser);

      const result = await controller.updateDisableLoginRestrictions(userId, {
        disable_login_restrictions: false,
      });

      expect(userService.updateDisableLoginRestrictions).toHaveBeenCalledWith(userId, false);
      expect(result.data).toEqual(disabledUser);
    });

    it('should handle service errors gracefully', async () => {
      userService.updateDisableLoginRestrictions.mockRejectedValue(
        new InternalServerErrorException('Failed to update'),
      );

      await expect(controller.updateDisableLoginRestrictions(userId, updateDto)).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });
});
