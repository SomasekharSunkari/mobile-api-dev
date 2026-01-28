import {
  Inject,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { Transaction } from 'objection';
import { TransactionMonitoringAdapter } from '../../../adapters/transaction-monitoring/transaction-monitoring-adapter';
import { UserModel, UserProfileModel, UserStatus } from '../../../database';
import { KycVerificationEnum } from '../../../database/models/kycVerification/kycVerification.interface';
import { SecurityContext } from '../../../decorators/http/http_context.interface';
import { PasswordPawnMail } from '../../../notifications/mails/password_pawn_mail';
import { MailerService } from '../../../services/queue/processors/mailer/mailer.service';
import { UtilsService } from '../../../utils/utils.service';
import { ExternalAccountRepository } from '../../externalAccount/external-account.repository';
import { UserTierService } from '../../userTier';
import { UserWithDetails } from '../auth.interface';
import { KycVerificationRepository } from '../kycVerification/kycVerification.repository';
import { KycVerificationService } from '../kycVerification/kycVerification.service';
import { UpdateUserDto } from '../userProfile/dto/updateUser.dto';
import { UserProfileService } from '../userProfile/userProfile.service';
import { VerificationTokenService } from '../verificationToken';
import { ChangePasswordDto } from './dtos/changePassword.dto';
import { SearchUserDto } from './dtos/searchUser.dto';
import { VerifyPasswordDto } from './dtos/verifiyPassword.dto';
import { UserRepository } from './user.repository';

@Injectable()
export class UserService {
  @Inject(UserProfileService)
  private readonly userProfileService: UserProfileService;

  @Inject(UserRepository)
  private readonly userRepository: UserRepository;

  @Inject(MailerService)
  private readonly mailerService: MailerService;

  @Inject(KycVerificationRepository)
  private readonly kycVerificationRepository: KycVerificationRepository;

  @Inject(KycVerificationService)
  private readonly kycVerificationService: KycVerificationService;

  private readonly logger = new Logger(UserService.name);

  @Inject(ExternalAccountRepository)
  private readonly externalAccountRepository: ExternalAccountRepository;

  @Inject(TransactionMonitoringAdapter)
  private readonly transactionMonitoringAdapter: TransactionMonitoringAdapter;

  @Inject(UserTierService)
  private readonly userTierService: UserTierService;

  @Inject(VerificationTokenService)
  private readonly verificationTokenService: VerificationTokenService;

  public async updateProfile(userId: string, updateUserDto: UpdateUserDto) {
    this.logger.log('updateProfile', 'UserService');

    try {
      const userProfile = await this.userProfileService.update(userId, updateUserDto);

      return userProfile;
    } catch (error) {
      this.logger.error(error.message, 'UserService');
      throw new InternalServerErrorException('Something went wrong while updating user profile');
    }
  }

  public async changePassword(userId: string, changePasswordDto: ChangePasswordDto) {
    this.logger.log('changePassword', 'UserService');

    const { old_password, new_password } = changePasswordDto;

    await this.throwIfNewPasswordIsSameAsOldPassword(new_password, old_password);

    const user = await this.throwIfOldPasswordDoNotMatch(old_password, userId);

    try {
      const hashedPassword = await UtilsService.hashPassword(new_password);

      await this.userRepository.update(userId, { password: hashedPassword });

      // send mail if password is pawned
      this.mailerService.send(new PasswordPawnMail(user, new_password));

      return { success: true, message: 'Password changed successfully' };
    } catch (error) {
      this.logger.error(error.message, 'UserService');
      throw new InternalServerErrorException('Something went wrong while changing password');
    }
  }

  private async throwIfNewPasswordIsSameAsOldPassword(newPassword: string, oldPassword: string) {
    if (newPassword === oldPassword) {
      throw new InternalServerErrorException('You have already used this password');
    }
    return true;
  }

  private async throwIfOldPasswordDoNotMatch(password: string, userId: string) {
    const user = await this.userRepository.findOne({ id: userId });

    if (!user) {
      throw new InternalServerErrorException('User not found');
    }

    const isPasswordSame = await UtilsService.comparePassword(password, user.password);

    if (!isPasswordSame) {
      throw new InternalServerErrorException('Old password do not match');
    }

    return user;
  }

  public async findActiveByEmail(email: string) {
    this.logger.log(`findActiveByEmail: ${email}`, 'UserService');

    try {
      const user = await this.userRepository.findOne({
        email,
        status: UserStatus.ACTIVE,
      });

      return user;
    } catch (error) {
      this.logger.error(error.message, 'UserService');
      throw new InternalServerErrorException('Something went wrong while finding user by email');
    }
  }

  public async findActiveByUsername(username: string) {
    this.logger.log(`findActiveByUsername: ${username}`, 'UserService');

    try {
      const user = await this.userRepository.findActiveByUsername(username);

      return user;
    } catch (error) {
      this.logger.error(error.message, 'UserService');
      throw new InternalServerErrorException('Something went wrong while finding user by username');
    }
  }

  public async findByUserId(userId: string) {
    this.logger.log(`findByUserId: ${userId}`, 'UserService');

    try {
      const user = await this.userRepository.findById(userId, '[country,userProfile]');

      if (!user) {
        throw new InternalServerErrorException('User not found');
      }

      // Get KYC tier
      const activeTier = await this.userTierService.getUserCurrentTier(userId);

      // Get kyc status
      const recentKyc = await this.kycVerificationService.getRecentKycStatus(userId);
      const kycStatus = recentKyc?.status || KycVerificationEnum.NOT_STARTED;

      const externalAccount = await this.externalAccountRepository.findOne({ user_id: userId });
      const externalAccountStatus = externalAccount?.status || null;

      // Transform user to include additional fields
      const userWithDetails = {
        ...user,
        account_verified: user.is_email_verified,
        current_tier: activeTier?.level,
        kyc_status: kycStatus,
        recent_kyc: recentKyc,
        linked_external_account_status: externalAccountStatus,
      };

      if (user.userProfile) {
        await this.userProfileService.populateAvatarUrl(user.userProfile as UserProfileModel);
      }

      return userWithDetails;
    } catch (error) {
      this.logger.error(error.message, 'UserService');
      throw new InternalServerErrorException('Something went wrong while finding user by id');
    }
  }

  public async getUserDetails(userId: string, securityContext: SecurityContext): Promise<UserWithDetails> {
    this.logger.log(`getUserDetails: ${userId}`, 'UserService');

    try {
      // Get user details
      const userWithDetails = await this.findByUserId(userId);

      // Check for blacklisted region using location data
      let isBlacklistedRegion = false;
      try {
        // Get user's KYC verification record
        const kycRecord = await this.kycVerificationRepository.findByUserId(userId);

        let locationData = null;
        if (kycRecord?.status !== 'approved') {
          // User is not KYC approved, use standard IP check
          locationData = await this.transactionMonitoringAdapter.ipCheck({
            ipAddress: securityContext.clientIp,
            userId: userId,
          });
        } else {
          // User is KYC approved, use applicant-specific endpoint
          const applicantId = kycRecord.provider_ref;
          if (applicantId) {
            locationData = await this.transactionMonitoringAdapter.ipCheckForApplicant({
              ipAddress: securityContext.clientIp,
              applicantId: applicantId,
            });
          }
        }

        // Check if user is in blacklisted region (US + New York)
        if (locationData?.country === 'US' && locationData?.region === 'New York') {
          isBlacklistedRegion = true;
        }
      } catch (error) {
        // If location check fails, default to false
        this.logger.warn(`Failed to check location for user ${userId}: ${error.message}`);
      }

      // Return properly typed user details with context, excluding password
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { password, ...userWithoutPassword } = userWithDetails;
      return {
        ...userWithoutPassword,
        isBlacklistedRegion,
      } as UserWithDetails;
    } catch (error) {
      this.logger.error(error.message, 'UserService');
      throw new InternalServerErrorException('Something went wrong while getting user details');
    }
  }

  public async findByUserName(userName: string) {
    this.logger.log(`findByUserName: ${userName}`, 'UserService');

    try {
      const user = await this.userRepository.query().whereILike('username', userName).first();

      if (!user) {
        throw new InternalServerErrorException('User not found');
      }

      return user;
    } catch (error) {
      this.logger.error(error.message, 'UserService');
      throw new InternalServerErrorException('Something went wrong while finding user by user name');
    }
  }

  public async deactivateUser(userId: string, trx?: Transaction) {
    this.logger.log(`deactivateUser: ${userId}`, 'UserService');

    const user = await this.userRepository.findById(userId, '', trx);

    if (!user) {
      throw new InternalServerErrorException('User not found');
    }

    await this.userRepository.update(userId, { is_deactivated: true }, { trx });

    return { success: true, message: 'User deactivated successfully' };
  }

  public async activateUser(userId: string, trx?: Transaction) {
    try {
      this.logger.log(`activateUser: ${userId}`, 'UserService');

      await this.userRepository.update(userId, { is_deactivated: false }, { trx });

      return { success: true, message: 'User activated successfully' };
    } catch (error) {
      this.logger.error(error.message, 'UserService');
      throw new InternalServerErrorException('Something went wrong while activating user');
    }
  }

  /**
   *
   * Search users and return them
   */
  public async searchUsers(_user: UserModel, searchDto: SearchUserDto) {
    this.logger.log(`searchUsers: ${searchDto.search}`, 'UserService');
    const { search, asset, network, wallet_id: walletId } = searchDto;

    try {
      let users = this.userRepository.findSync({});

      // Exclude the current user first
      users = users.where('users.id', '!=', _user.id);

      if (search) {
        // Group the OR search conditions properly
        users = users.where((builder) => {
          builder
            .whereILike('users.first_name', `%${search}%`)
            .orWhereILike('users.last_name', `%${search}%`)
            .orWhereILike('users.username', `%${search}%`)
            .orWhereILike('users.email', `%${search}%`)
            .orWhereILike('users.phone_number', `%${search}%`);
        });
      }

      // Join with KYC verification table and filter for approved status
      users = users
        .join('api_service.kyc_verifications', 'users.id', 'kyc_verifications.user_id')
        .where('kyc_verifications.status', KycVerificationEnum.APPROVED);

      // Use qualified column names to avoid ambiguity (always needed due to KYC join)
      // Include updated_at in select for ordering with DISTINCT
      const publicProps = UserModel.publicProperty().map((prop) => `users.${prop}`);
      users = users.select([...publicProps, 'users.updated_at']);

      // Include userProfile to get avatar_url
      users = users.withGraphFetched('userProfile');

      if (asset || network || walletId) {
        users = users.joinRelated('blockchainWallets').withGraphFetched('blockchainWallets');

        if (asset) {
          users = users.where('blockchainWallets.asset', asset);
        }
        if (network) {
          users = users.where('blockchainWallets.network', network);
        }

        if (walletId) {
          users = users.where('blockchainWallets.id', walletId);
        }
      }

      // Ensure distinct results to avoid duplicates from joins
      users = users.distinct('users.id');

      // Apply ordering once at the end
      users = users.clearOrder().orderBy('users.updated_at', 'desc');

      const LIMIT = 30; // we will only return the last 30 beneficiaries, no pagination included
      const PAGE = 1;
      const result = await this.userRepository.paginateData(users, LIMIT, PAGE);

      // Populate avatar URLs for each user's profile
      const usersList = result.users as UserModel[];
      await Promise.all(
        usersList.map(async (user) => {
          if (user.userProfile) {
            await this.userProfileService.populateAvatarUrl(user.userProfile as UserProfileModel);
          }
        }),
      );

      return result;
    } catch (error) {
      this.logger.error(error.message, 'UserService');
      throw new InternalServerErrorException('Something went wrong while searching users');
    }
  }

  public async verifyPassword(userId: string, data: VerifyPasswordDto) {
    const user = await this.findByUserId(userId);

    const isPasswordSame = await UtilsService.comparePassword(data.password, user.password);

    if (!isPasswordSame) {
      throw new UnauthorizedException('Incorrect password');
    }

    return await this.verificationTokenService.generateToken(userId, data.verification_type);
  }

  public async getUploadUrl(userId: string, contentType?: string) {
    return await this.userProfileService.getUploadUrl(userId, contentType);
  }

  public async updateDisableLoginRestrictions(userId: string, disableLoginRestrictions: boolean): Promise<UserModel> {
    this.logger.log(`Updating disable_login_restrictions for user ${userId}`, 'UserService');

    try {
      const user = await this.userRepository.findById(userId);
      if (!user) {
        throw new NotFoundException('User not found');
      }

      const updated = await this.userRepository.update(userId, {
        disable_login_restrictions: disableLoginRestrictions,
      });

      this.logger.log(
        `disable_login_restrictions ${disableLoginRestrictions ? 'enabled' : 'disabled'} for user ${userId}`,
        'UserService',
      );

      return updated;
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      this.logger.error(
        `Error updating disable_login_restrictions for user ${userId}: ${error.message}`,
        'UserService',
      );
      throw new InternalServerErrorException('Something went wrong while updating disable_login_restrictions');
    }
  }
}
