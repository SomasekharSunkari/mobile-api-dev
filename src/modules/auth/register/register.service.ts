import { BadRequestException, ConflictException, Inject, InternalServerErrorException, Logger } from '@nestjs/common';
import { genSalt, hash } from 'bcryptjs';

import { isPossiblePhoneNumber, isValidPhoneNumber } from 'libphonenumber-js';
import { DateTime } from 'luxon';
import { Timing } from '../../../constants/timing';
import { UserModel, UserStatus } from '../../../database/models/user';
import { SecurityContext } from '../../../decorators/http/http_context.interface';
import { RegistrationSuccessfulMail } from '../../../notifications/mails/registration_successful_mail';
import { VerifyAccountMail } from '../../../notifications/mails/verify_account.mail';
import { MailerService } from '../../../services/queue/processors/mailer/mailer.service';
import { UtilsService } from '../../../utils/utils.service';
import { CountryService } from '../../country/country.service';

import { DoshPointsTransactionService } from '../../doshPoints/doshPointsTransaction/doshPointsTransaction.service';
import { IN_APP_NOTIFICATION_TYPE, InAppNotificationService } from '../../inAppNotification';
import { AccessTokenService } from '../accessToken';
import { AccountVerificationService } from '../accountVerification/accountVerification.service';
import { AuthPayload, JwtTokenResponse } from '../auth.interface';
import { ROLES } from '../guard';
import { LoginDeviceService } from '../loginDevice/loginDevice.service';
import { LoginSecurityService } from '../loginSecurity/loginSecurity.service';
import { RefreshTokenService } from '../refreshToken';
import { RoleRepository } from '../role/role.repository';
import { UserRepository } from '../user/user.repository';
import { UserService } from '../user/user.service';
import { UserProfileRepository } from '../userProfile/userProfile.repository';
import { UserRoleRepository } from '../userRole/user_role.repository';
import { RegisterDto } from './dto';
import { CheckPhoneExistDto } from './dto/checkPhoneExist.dto';
import { RegisterCheckDto } from './dto/registerCheck.dto';
import { AccountVerificationDto } from './dto/sendVerificationCode.dto';

export class RegisterService {
  private readonly logger = new Logger(RegisterService.name);
  @Inject(UserProfileRepository)
  private readonly userProfileRepository: UserProfileRepository;

  @Inject(UserRoleRepository)
  private readonly userRoleRepository: UserRoleRepository;

  @Inject(UserRepository)
  private readonly userRepository: UserRepository;

  @Inject(UserService)
  private readonly userService: UserService;

  @Inject(LoginDeviceService)
  private readonly loginDeviceService: LoginDeviceService;

  @Inject(RoleRepository)
  private readonly roleRepository: RoleRepository;

  @Inject(AccountVerificationService)
  private readonly accountVerificationService: AccountVerificationService;

  @Inject(CountryService)
  private readonly countryService: CountryService;

  @Inject(AccessTokenService)
  private readonly accessTokenService: AccessTokenService;

  @Inject(RefreshTokenService)
  private readonly refreshTokenService: RefreshTokenService;

  @Inject(LoginSecurityService)
  private readonly loginSecurityService: LoginSecurityService;

  @Inject(MailerService)
  private readonly mailerService: MailerService;

  @Inject(InAppNotificationService)
  private readonly inAppNotificationService: InAppNotificationService;

  @Inject(DoshPointsTransactionService)
  private readonly doshPointsTransactionService: DoshPointsTransactionService;

  async register(registerDto: RegisterDto, securityContext?: SecurityContext): Promise<AuthPayload> {
    const {
      email,
      username,
      password,
      first_name,
      last_name,
      middle_name,
      phone_number,
      phone_number_country_code,
      country_id,
      verification_token,
    } = registerDto;

    const accountVerification = await this.accountVerificationService.verifyRegistrationToken(verification_token);

    // Check if registration is allowed from this location
    if (securityContext?.clientIp) {
      // Create a temporary user ID for location checking during registration
      const tempUserId = 'registration_check';
      await this.loginSecurityService.getCurrentLocation(tempUserId, securityContext);
    }

    const isEmailExists = await this.userRepository.query().whereILike('email', email).first();
    if (isEmailExists) {
      throw new BadRequestException('Email already in use');
    }

    if (accountVerification.email.toLowerCase() !== email.toLowerCase()) {
      throw new BadRequestException('Invalid verification code');
    }

    if (phone_number) {
      await this.validatePhoneNumber(phone_number, phone_number_country_code);
      const isPhoneNumberExists = await this.userRepository.query().findOne({ phone_number });
      if (isPhoneNumberExists) {
        throw new BadRequestException('Phone number already in use');
      }
    }

    const isUsernameExists = await this.userRepository.query().whereILike('username', username).first();
    if (isUsernameExists) {
      throw new BadRequestException('Username already taken');
    }

    //validate country_id exists
    await this.countryService.validateCountryExists(country_id);

    let tokenData: JwtTokenResponse;
    let refreshToken: {
      refreshToken: { user_id: string; identity: string; is_used: boolean; expiration_time: string };
      encodedToken: string;
    };
    try {
      const hashedPassword = await hash(password, await genSalt(10));

      const account = await this.userRepository.transaction(async (trx) => {
        const user = await this.userRepository.create(
          {
            email: email.toLowerCase(),
            username: username.toLowerCase(),
            password: hashedPassword,
            phone_number: phone_number ?? null,
            status: UserStatus.ACTIVE,
            is_email_verified: true,
            is_phone_verified: false,
            first_name,
            last_name,
            middle_name,
            country_id: country_id,
          },
          trx,
        );

        await this.userProfileRepository.create(
          {
            user_id: user.id,
          },
          trx,
        );

        tokenData = (
          await this.accessTokenService.create({ id: user.id, email, phone_number, username: user.username }, trx)
        ).decodedToken;

        refreshToken = await this.refreshTokenService.create(user.id);

        // Get all required roles
        const userRole = await this.roleRepository.query(trx).findOne({ slug: ROLES.USER });
        const activeRole = await this.roleRepository.query(trx).findOne({ slug: ROLES.ACTIVE_USER });

        // Create user roles
        await this.userRoleRepository.create(
          {
            user_id: user.id,
            role_id: userRole.id,
          },
          trx,
        );

        await this.userRoleRepository.create(
          {
            user_id: user.id,
            role_id: activeRole.id,
          },
          trx,
        );

        // Mark account verification as used
        await this.accountVerificationService.markAccountVerificationAsUsed(user.id, accountVerification.id, trx);

        // Register device with IP verification
        if (securityContext) {
          await this.loginDeviceService.registerDevice(
            user.id,
            securityContext.clientIp,
            securityContext.fingerprint,
            trx,
          );
        }

        return user.$fetchGraph('[country]');
      });

      // Get proper user details using the user service
      const userWithDetails = await this.userService.findByUserId(account.id);

      await this.inAppNotificationService.createNotification({
        user_id: account.id,
        type: IN_APP_NOTIFICATION_TYPE.WELCOME,
        title: 'Welcome to OneDosh 👋🏾',
        message: `Your account has been created successfully! Complete your verification to unlock deposits, transfers, and more.`,
      });

      this.mailerService.send(new RegistrationSuccessfulMail(userWithDetails as unknown as UserModel));

      // Credit registration bonus points
      try {
        await this.doshPointsTransactionService.creditPoints({
          user_id: account.id,
          event_code: 'REGISTRATION_BONUS',
          source_reference: account.id,
          description: 'Registration bonus for creating an account',
        });
        this.logger.log(`Successfully credited registration points for user ${account.id}`);
      } catch (error) {
        this.logger.error(`Failed to credit registration points for user ${account.id}: ${error.message}`, error);
        // Do not rethrow - registration should complete even if points credit fails
      }

      return {
        message: 'Registration successful',
        credentials: {
          access_token: tokenData.access_token,
          expiration: tokenData.expiration,
          refresh_token: refreshToken.encodedToken,
        },
        user: userWithDetails,
      };
    } catch (error) {
      this.logger.log(error);
      // Only log errors in non-test environments

      this.logger.error('Error while creating user', 'RegisterService.register', error.message);

      throw new InternalServerErrorException('Error while creating user');
    }
  }

  /**
   * Send a verification code to the user
   * @param data
   * @returns
   * @description This function will send a verification code to the email provided.
   * The function sends verification code to both registered or none registered users.
   * This allows users to verify their account even if they are not registered.
   * Last name is required for none registered users.
   */
  async sendVerificationCode(data: AccountVerificationDto) {
    this.logger.log('Initializing sending Verification');

    // check if the user exists
    const user = await this.userRepository.query().whereILike('email', data.email).first();
    if (user) {
      throw new ConflictException('User with this email already exists');
    }

    // check if the user has a code and then expire it.
    await this.accountVerificationService.expireUnusedCode(data.email);

    try {
      // create the code and save
      const code = UtilsService.generateCode();

      const expirationDate = DateTime.now().plus({ hours: Timing.HALF_HOUR }).toSQL();

      // hash the code
      const hashedCode = await UtilsService.hashPassword(code);

      await this.accountVerificationService.create({
        code: hashedCode,
        user_id: undefined,
        email: data.email.toLowerCase(),
        expiration_time: expirationDate,
      });

      await this.mailerService.send(
        new VerifyAccountMail(
          {
            email: data.email,
            last_name: '',
          },
          code,
        ),
      );

      return { success: true };
    } catch (error) {
      this.logger.error(error.message, 'AccountVerificationService');
      throw new InternalServerErrorException('Error while creating the code');
    }
  }

  async validatePhoneNumber(phone_number: string, country_code: string): Promise<boolean> {
    this.logger.log('Validating phone number', 'RegisterService.validatePhoneNumber');
    if (!phone_number) {
      return false;
    }

    if (!isPossiblePhoneNumber(phone_number, country_code as any)) {
      this.logger.error('Invalid phone number', 'RegisterService.validatePhoneNumber.isPossiblePhoneNumber');
      throw new BadRequestException('Invalid phone number');
    }

    if (!isValidPhoneNumber(phone_number, country_code as any)) {
      this.logger.error('Invalid phone number', 'RegisterService.validatePhoneNumber.isValidPhoneNumber');
      throw new BadRequestException('Invalid phone number');
    }

    return true;
  }

  async checkRegister(data: RegisterCheckDto): Promise<boolean> {
    this.logger.log('Checking email and sending verification', 'RegisterService.checkRegisterAndSendMail');
    if (!data.email) {
      throw new BadRequestException('Email is required');
    }

    const isEmailExists = await this.userRepository.query().whereILike('email', data.email).first();
    if (isEmailExists) {
      throw new BadRequestException('User with email already exists');
    }

    await this.checkPhoneNoExists({
      phone_number: data.phone_number,
      phone_number_country_code: data.phone_number_country_code,
    });

    return true;
  }

  async checkUsernameExists(username: string) {
    this.logger.log('Checking if username exists', 'RegisterService.checkUsernameExists');
    if (!username) {
      throw new BadRequestException('Username is required');
    }

    const isUsernameExists = await this.userRepository.query().whereILike('username', username).first();
    return { exists: !!isUsernameExists };
  }

  async checkEmailExists(email: string) {
    this.logger.log('Checking if email exists', 'RegisterService.checkEmailExists');
    if (!email) {
      throw new BadRequestException('Email is required');
    }

    const isEmailExists = await this.userRepository.query().whereILike('email', email).first();
    return { exists: !!isEmailExists };
  }

  async checkPhoneNoExists(data: CheckPhoneExistDto) {
    const { phone_number, phone_number_country_code } = data;

    const validPhoneNo = await this.validatePhoneNumber(phone_number, phone_number_country_code);

    if (!validPhoneNo) {
      throw new BadRequestException('Invalid phone number');
    }

    this.logger.log('Checking if phoneNo exists', 'RegisterService.checkPhoneNoExists');
    if (!phone_number) {
      throw new BadRequestException('phoneNumber is required');
    }

    const isPhoneNoExists = await this.userRepository.findOne({ phone_number });

    if (isPhoneNoExists) {
      throw new BadRequestException('Phone number already in use');
    }
  }
}
