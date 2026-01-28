import { Inject, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { compare } from 'bcryptjs';

import { UserRepository } from '../user/user.repository';
import { UserService } from '../user/user.service';
import { LoginDto } from './dto/login.dto';

import { JwtPayload, verify } from 'jsonwebtoken';
import { EnvironmentService } from '../../../config';
import { UserModel, UserStatus } from '../../../database';
import { SecurityContext } from '../../../decorators/http/http_context.interface';
import { OtpRequiredException } from '../../../exceptions/otp_required_exception';
import { RestrictionErrorType, RestrictionException } from '../../../exceptions/restriction_exception';
import { AccessTokenService } from '../accessToken';
import { LoginResponse } from '../auth.interface';
import { KycVerificationService } from '../kycVerification/kycVerification.service';
import { LoginDeviceRepository } from '../loginDevice/loginDevice.repository';
import { LoginEventService } from '../loginEvent/loginEvent.service';
import { RiskAssessment } from '../loginSecurity/loginSecurity.interface';
import { LoginSecurityService } from '../loginSecurity/loginSecurity.service';
import { RefreshTokenService } from '../refreshToken';
import { LoginRiskScore } from './login.interface';

@Injectable()
export class LoginService {
  private readonly logger = new Logger(LoginService.name);
  constructor(
    @Inject(UserRepository)
    private readonly userRepository: UserRepository,

    @Inject(LoginDeviceRepository)
    private readonly loginDeviceRepository: LoginDeviceRepository,

    @Inject(LoginEventService)
    private readonly loginEventService: LoginEventService,

    @Inject(LoginSecurityService)
    private readonly loginSecurityService: LoginSecurityService,

    @Inject(KycVerificationService)
    private readonly kycVerificationService: KycVerificationService,

    @Inject(AccessTokenService)
    private readonly accessTokenService: AccessTokenService,

    @Inject(RefreshTokenService)
    private readonly refreshTokenService: RefreshTokenService,

    @Inject(UserService)
    private readonly userService: UserService,
  ) {}

  /**
   * Validates a user using email, username, or phone number.
   */
  private async validateUser(identifier: string, password: string) {
    let user = await this.userRepository.findActiveByEmail(identifier);

    if (!user) {
      user = await this.userRepository.findActiveByUsername(identifier);
    }

    if (!user) {
      user = await this.userRepository.findActiveByPhone(identifier);
    }

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const passwordMatches = await compare(password, user.password);
    if (!passwordMatches) {
      throw new UnauthorizedException('Invalid credentials');
    }

    return user;
  }

  /**
   * Finds a user by identifier without password validation (for feature flag checks)
   */
  private async findUserByIdentifier(identifier: string): Promise<UserModel | null> {
    let user = await this.userRepository.findActiveByEmail(identifier);

    if (!user) {
      user = await this.userRepository.findActiveByUsername(identifier);
    }

    if (!user) {
      user = await this.userRepository.findActiveByPhone(identifier);
    }

    return user || null;
  }

  /**
   * Track login event and manage device trust
   */
  private async trackLoginAndDevice(
    userId: string,
    securityContext: SecurityContext,
    riskScore: number,
  ): Promise<void> {
    const { clientIp, fingerprint } = securityContext;
    const currentTime = new Date().toISOString();

    // Find or create device
    let device = await this.loginDeviceRepository.findOne({
      user_id: userId,
      device_fingerprint: fingerprint,
    });

    if (!device) {
      // Create new device - always trusted since high risk would have been blocked
      device = await this.loginDeviceRepository.create({
        user_id: userId,
        device_fingerprint: fingerprint,
        device_name: securityContext.deviceInfo?.device_name,
        device_type: securityContext.deviceInfo?.device_type,
        os: securityContext.deviceInfo?.os,
        browser: securityContext.deviceInfo?.browser,
        is_trusted: true,
        last_verified_at: currentTime,
        last_login: currentTime,
      });
    } else {
      // Update existing device - mark as trusted since this is a successful low-risk login
      const updateData: any = { last_login: currentTime };

      if (!device.is_trusted) {
        updateData.is_trusted = true;
        updateData.last_verified_at = currentTime;
      }

      await this.loginDeviceRepository.update(device.id, updateData);
    }

    // Get location and create login event
    const locationData = (await this.loginSecurityService.getCurrentLocation(userId, securityContext)) || {};

    await this.loginEventService.createLoginEvent({
      user_id: userId,
      device_id: device.id,
      ip_address: clientIp,
      login_time: currentTime,
      city: locationData.city || '',
      region: locationData.region || '',
      country: locationData.country || '',
      is_vpn: locationData.isVpn || false,
      risk_score: riskScore,
    });
  }

  /**
   * Pre-validation security checks - identifier rate limiting and active OTP check
   * Returns true if OTP is pending, false otherwise
   */
  private async performPreValidationSecurityChecks(
    securityContext: SecurityContext,
    identifier?: string,
    userId?: string,
  ): Promise<boolean> {
    // Bypass security checks for users with disable_login_restrictions enabled
    let isRestrictionDisabledForUser = false;

    if (identifier) {
      const userForFlagCheck = await this.findUserByIdentifier(identifier);
      if (userForFlagCheck) {
        isRestrictionDisabledForUser = userForFlagCheck.disable_login_restrictions;
      } else if (userId) {
        const user = await this.userRepository.findById(userId);
        if (user) {
          isRestrictionDisabledForUser = user.disable_login_restrictions;
        }
      }
    } else if (userId) {
      const user = await this.userRepository.findById(userId);
      if (user) {
        isRestrictionDisabledForUser = user.disable_login_restrictions;
      }
    }

    const shouldBypassChecks = isRestrictionDisabledForUser;

    // Check rate limit based on identifier (email/phone/username) if provided
    if (identifier) {
      const securityCheck = await this.loginSecurityService.checkIdentifierRateLimit(
        {
          identifier,
        },
        userId,
      );

      if (!securityCheck.allowed && !shouldBypassChecks) {
        throw new RestrictionException(RestrictionErrorType.ERR_USER_ACCOUNT_LOCKED, securityCheck.reason || undefined);
      }
    }

    // Check if there's already an active OTP for this device
    const disableLoginRegionCheck = EnvironmentService.getValue('DISABLE_LOGIN_REGION_CHECK');
    if (!disableLoginRegionCheck && !shouldBypassChecks) {
      const hasActiveOtp = await this.loginSecurityService.hasActiveOtp(securityContext, identifier);
      if (hasActiveOtp) {
        return true;
      }
    }

    return false;
  }

  /**
   * Post-validation security flow - risk assessment, OTP handling, and successful login
   */
  private async performPostValidationSecurityFlow(
    user: UserModel,
    securityContext: SecurityContext,
  ): Promise<LoginResponse> {
    const isRestrictionDisabled = user.disable_login_restrictions;

    // Calculate risk score for this login
    const riskAssessment = await this.loginSecurityService.calculateRiskScore(user.id, securityContext, user);

    // Bypass location and device checks for users with disable_login_restrictions enabled
    const shouldBypassChecks = isRestrictionDisabled;

    if (isRestrictionDisabled) {
      return await this.successfulLogin(user, securityContext, { score: 0, reasons: [], locationData: null });
    }

    // Handle high risk logins (≥30 points)
    if (
      !shouldBypassChecks &&
      riskAssessment.score >= LoginRiskScore.HIGH &&
      !EnvironmentService.getValue('DISABLE_LOGIN_REGION_CHECK')
    ) {
      const otpResult = await this.loginSecurityService.handleHighRiskLogin(
        riskAssessment.score,
        user.id,
        securityContext,
        riskAssessment.reasons,
      );
      const isEmail = otpResult.maskedContact.includes('@');
      const otpMessage = isEmail
        ? `Code sent to ${otpResult.maskedContact}`
        : `Code sent to ******${otpResult.maskedContact}`;

      throw new OtpRequiredException(otpMessage, otpResult.maskedContact);
    }

    // Low risk - complete successful login
    return await this.successfulLogin(user, securityContext, riskAssessment);
  }

  /**
   * Handle successful login completion - tracking, token generation, and response formatting
   */
  async successfulLogin(
    user: UserModel,
    securityContext: SecurityContext,
    riskAssessment: RiskAssessment,
  ): Promise<LoginResponse> {
    // Track login and manage device
    await this.trackLoginAndDevice(user.id, securityContext, riskAssessment.score);

    // Clear all login-related Redis keys since login is successful (using email as identifier)
    await this.loginSecurityService.clearIdentifierAttempts(user.email, securityContext);

    // Generate tokens and get KYC status
    const { tokenData, refreshToken } = await this.getAllTokenAndKYCDetails(user, user.email, user.phone_number);

    // Get user details with blacklisted region check
    const userWithDetails = await this.userService.getUserDetails(user.id, securityContext);

    // Return user format
    return {
      message: 'Login successful',
      credentials: {
        access_token: tokenData.decodedToken.access_token,
        expiration: tokenData.decodedToken.expiration,
        refresh_token: refreshToken.encodedToken,
      },
      user: userWithDetails,
    };
  }

  /**
   * Logs in a user and returns access_token + user object.
   */
  async login(loginDto: LoginDto, securityContext: SecurityContext): Promise<LoginResponse> {
    const { email, phone_number, username, password } = loginDto;
    const identifier = email ?? phone_number ?? username;

    // Find user by identifier (without password check) to get userId for feature flag check
    const userForFlagCheck = await this.findUserByIdentifier(identifier);
    const userId = userForFlagCheck?.id;

    const hasActiveOtp = await this.performPreValidationSecurityChecks(securityContext, identifier, userId);

    // If there's an active OTP, throw OTP required exception
    if (hasActiveOtp) {
      const maskedContact = await this.loginSecurityService.getMaskedContactFromRedis(securityContext);
      throw new OtpRequiredException(
        'A verification code is already pending. Please check your messages before requesting a new one.',
        maskedContact,
      );
    }

    // Validate user credentials
    const user = await this.validateUser(identifier, password);

    // throw error if user is pending deletion
    if (user.status === UserStatus.PENDING_ACCOUNT_DELETION || user.status === UserStatus.PENDING_DEACTIVATION) {
      throw new RestrictionException(RestrictionErrorType.ERR_USER_PENDING_DELETION);
    }

    return await this.performPostValidationSecurityFlow(user, securityContext);
  }

  public async getAllTokenAndKYCDetails(user: UserModel, email: string, phone_number: string) {
    const tokenData = await this.accessTokenService.create({
      id: user.id,
      email,
      phone_number,
      username: user.username,
    });
    const refreshToken = await this.refreshTokenService.create(user.id);

    const kycRecord = await this.kycVerificationService.findByUserId(user.id);
    const kycStatus = kycRecord?.status;
    return { tokenData, refreshToken, kycStatus };
  }

  /**
   * Logs in a user using biometric credentials and returns access_token + user object.
   */
  async loginWithBiometrics(refreshToken: string, securityContext: SecurityContext): Promise<LoginResponse> {
    this.logger.log('Login with biometrics', 'LoginService');

    const JWT_SECRET_TOKEN = EnvironmentService.getValue('JWT_SECRET_TOKEN');

    const existingRefreshToken = verify(refreshToken, JWT_SECRET_TOKEN, (err, value) => {
      if (err) {
        throw new UnauthorizedException('Invalid Biometric Credentials');
      }
      return value;
    }) as any as JwtPayload;

    if (!existingRefreshToken) {
      throw new UnauthorizedException('Invalid Biometric Credentials');
    }

    // check if the user exist
    const user = await this.userRepository.findActiveById(existingRefreshToken.userId);

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    // Verify the refresh token against the database to prevent use of invalidated tokens
    const isValidRefreshToken = await this.refreshTokenService.verify(user.id, refreshToken);
    if (!isValidRefreshToken) {
      throw new UnauthorizedException('Session expired. Please login again.');
    }

    const hasActiveOtp = await this.performPreValidationSecurityChecks(securityContext, user.email, user.id);

    // If there's an active OTP, throw OTP required exception
    if (hasActiveOtp) {
      const maskedContact = await this.loginSecurityService.getMaskedContactFromRedis(securityContext);
      throw new OtpRequiredException(
        'A verification code is already pending. Please check your messages before requesting a new one.',
        maskedContact,
      );
    }

    return await this.performPostValidationSecurityFlow(user, securityContext);
  }
}
