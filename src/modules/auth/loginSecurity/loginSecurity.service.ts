import { Inject, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { DateTime } from 'luxon';
import { TransactionMonitoringAdapter } from '../../../adapters/transaction-monitoring/transaction-monitoring-adapter';
import { LoginSecurityConfig, LoginSecurityConfigProvider } from '../../../config/login-security.config';
import { SecurityContext } from '../../../decorators/http/http_context.interface';
import { OtpRequiredException } from '../../../exceptions/otp_required_exception';
import { RestrictionErrorType, RestrictionException } from '../../../exceptions/restriction_exception';
import { HighRiskLoginMail } from '../../../notifications/mails/high_risk_login_mail';
import { LoginOtpMail } from '../../../notifications/mails/login_otp_mail';
import { MailerService } from '../../../services/queue/processors/mailer/mailer.service';
import { RedisService } from '../../../services/redis/redis.service';
import { UtilsService } from '../../../utils/utils.service';
import { IpCountryBanService } from '../ipCountryBan/ipCountryBan.service';
import { KycVerificationService } from '../kycVerification/kycVerification.service';
import { LoginDeviceService } from '../loginDevice/loginDevice.service';
import { LoginEventService } from '../loginEvent/loginEvent.service';
import { UserRepository } from '../user/user.repository';
import {
  HighRiskLoginResult,
  LastKnownLocation,
  LocationData,
  LoginSecurityCheck,
  LoginSecurityResult,
  OtpVerificationResult,
  RiskAssessment,
  RiskCheckResult,
} from './loginSecurity.interface';

@Injectable()
export class LoginSecurityService {
  private readonly logger = new Logger(LoginSecurityService.name);
  private readonly redisKeyPrefix = 'login_security';

  @Inject(RedisService)
  private readonly redisService: RedisService;

  @Inject(LoginDeviceService)
  private readonly loginDeviceService: LoginDeviceService;

  @Inject(TransactionMonitoringAdapter)
  private readonly transactionMonitoringAdapter: TransactionMonitoringAdapter;

  @Inject(KycVerificationService)
  private readonly kycVerificationService: KycVerificationService;

  @Inject(LoginEventService)
  private readonly loginEventService: LoginEventService;

  @Inject(IpCountryBanService)
  private readonly ipCountryBanService: IpCountryBanService;

  @Inject(MailerService)
  private readonly mailerService: MailerService;

  @Inject(UserRepository)
  private readonly userRepository: UserRepository;

  @Inject(LoginSecurityConfigProvider)
  private readonly configProvider: LoginSecurityConfigProvider;

  private get config(): LoginSecurityConfig {
    return this.configProvider.getConfig();
  }

  /**
   * Check if login attempt is allowed based on identifier (email/phone/username) rate limiting
   */
  async checkIdentifierRateLimit(check: LoginSecurityCheck, userId?: string): Promise<LoginSecurityResult> {
    const { identifier } = check;
    const normalizedIdentifier = identifier.toLowerCase();

    this.logger.log(`Checking rate limit for identifier: ${normalizedIdentifier}`);

    try {
      if (userId) {
        const user = await this.userRepository.findById(userId);
        if (user?.disable_login_restrictions) {
          this.logger.log(`Login restrictions disabled for user ${userId} - bypassing rate limit check`);
          return { allowed: true };
        }
      }

      // First check if identifier is currently locked out
      const isLockedOut = await this.isIdentifierLockedOut(normalizedIdentifier);
      if (isLockedOut) {
        const lockoutMinutes = Math.round(this.config.lockoutDurationSeconds / 60);
        this.logger.warn(`Identifier ${normalizedIdentifier} is currently locked out for ${lockoutMinutes} minutes`);
        return {
          allowed: false,
          reason: `Account temporarily locked due to too many failed attempts`,
        };
      }

      // Record this attempt
      await this.recordAttempt(normalizedIdentifier);

      // Get current attempt count in the sliding window
      const attemptCount = await this.getAttemptCount(normalizedIdentifier);

      if (attemptCount > this.config.maxAttempts) {
        // Lock out the identifier for the configured duration
        await this.lockoutIdentifier(normalizedIdentifier);

        const windowHours = Math.round((this.config.windowSeconds / 3600) * 10) / 10; // Round to 1 decimal
        const lockoutMinutes = Math.round(this.config.lockoutDurationSeconds / 60);
        this.logger.warn(
          `Identifier ${normalizedIdentifier} exceeded rate limit: ${attemptCount}/${this.config.maxAttempts} attempts in last ${windowHours}h. Locked out for ${lockoutMinutes} minutes.`,
        );

        return {
          allowed: false,
          reason: `Too many login attempts. Account temporarily locked.`,
        };
      }

      const windowHours = Math.round((this.config.windowSeconds / 3600) * 10) / 10;
      this.logger.log(
        `Identifier ${normalizedIdentifier} allowed: ${attemptCount}/${this.config.maxAttempts} attempts in last ${windowHours}h`,
      );
      return {
        allowed: true,
      };
    } catch (error) {
      this.logger.error(`Error checking rate limit for identifier ${normalizedIdentifier}: ${error.message}`);
      // In case of Redis error, allow the attempt but log the error
      return { allowed: true };
    }
  }

  /**
   * Record a login attempt for an identifier (email/phone/username)
   */
  private async recordAttempt(identifier: string): Promise<void> {
    const now = Date.now().toString();
    const key = `${this.redisKeyPrefix}:attempts:${identifier}`;

    // Add timestamp to Redis list
    await this.redisService.lpush(key, now);

    // Set expiration for the key (window duration)
    await this.redisService.expire(key, this.config.windowSeconds);

    // Clean up old attempts
    await this.cleanupOldAttempts(identifier);
  }

  /**
   * Get the number of attempts for an identifier in the current sliding window
   */
  private async getAttemptCount(identifier: string): Promise<number> {
    await this.cleanupOldAttempts(identifier);

    const key = `${this.redisKeyPrefix}:attempts:${identifier}`;
    const length = await this.redisService.llen(key);

    return length || 0;
  }

  /**
   * Remove attempts older than the sliding window
   */
  private async cleanupOldAttempts(identifier: string): Promise<void> {
    const key = `${this.redisKeyPrefix}:attempts:${identifier}`;
    const cutoffTime = Date.now() - this.config.windowSeconds * 1000;

    try {
      // Get all attempts
      const attempts = await this.redisService.lrange(key, 0, -1);

      if (attempts.length === 0) return;

      // Filter valid attempts (within time window)
      const validAttempts = attempts.filter((timestamp) => {
        const attemptTime = Number.parseInt(timestamp, 10);
        return attemptTime > cutoffTime;
      });

      // Replace the list with only valid attempts
      if (validAttempts.length !== attempts.length) {
        await this.redisService.del(key);
        if (validAttempts.length > 0) {
          await this.redisService.lpush(key, ...validAttempts);
          await this.redisService.expire(key, this.config.windowSeconds);
        }
      }
    } catch (error) {
      this.logger.error(`Failed to cleanup old attempts for identifier ${identifier}: ${error.message}`);
    }
  }

  /**
   * Check if an identifier (email/phone/username) is currently locked out
   */
  private async isIdentifierLockedOut(identifier: string): Promise<boolean> {
    try {
      const lockoutKey = `${this.redisKeyPrefix}:lockout:${identifier}`;
      const redisClient = this.redisService.getClient();
      const lockoutTime = await redisClient.get(lockoutKey);

      if (!lockoutTime) return false;

      const lockoutExpiry = Number.parseInt(lockoutTime, 10);
      const now = Date.now();

      if (now < lockoutExpiry) {
        return true; // Still locked out
      } else {
        // Lockout expired, clean up
        await this.redisService.del(lockoutKey);
        return false;
      }
    } catch (error) {
      this.logger.error(`Failed to check lockout status for identifier ${identifier}: ${error.message}`);
      return false; // Allow on error
    }
  }

  /**
   * Lock out an identifier (email/phone/username) for the configured duration
   */
  private async lockoutIdentifier(identifier: string): Promise<void> {
    try {
      const lockoutKey = `${this.redisKeyPrefix}:lockout:${identifier}`;
      const lockoutExpiry = Date.now() + this.config.lockoutDurationSeconds * 1000;

      // Set current lockout
      await this.redisService.set(lockoutKey, lockoutExpiry.toString());
      await this.redisService.expire(lockoutKey, this.config.lockoutDurationSeconds);

      const lockoutMinutes = Math.round(this.config.lockoutDurationSeconds / 60);
      this.logger.log(`Identifier ${identifier} locked out for ${lockoutMinutes} minutes`);
    } catch (error) {
      this.logger.error(`Failed to lockout identifier ${identifier}: ${error.message}`);
    }
  }

  /**
   * Calculate risk score for successful login
   */
  async calculateRiskScore(
    userId: string,
    securityContext: SecurityContext,
    user?: { disable_login_restrictions: boolean },
  ): Promise<RiskAssessment> {
    let isRestrictionDisabled = false;
    if (user) {
      isRestrictionDisabled = user.disable_login_restrictions;
    } else {
      const userModel = await this.userRepository.findById(userId);
      isRestrictionDisabled = userModel?.disable_login_restrictions || false;
    }

    if (isRestrictionDisabled) {
      this.logger.log(`Login restrictions disabled for user ${userId} - skipping risk assessment`);
      return { score: 0, reasons: [], locationData: null };
    }

    // Check device and add to risk score
    const deviceResult = await this.checkDevice(userId, securityContext);

    // Get current location data once (includes VPN detection)
    const currentLocation = await this.getCurrentLocation(userId, securityContext);

    // Check location and add to risk score (pass existing data)
    const locationResult = await this.checkLocation(userId, securityContext, currentLocation);

    // Check VPN usage (pass existing data)
    const vpnResult = await this.checkVPN(userId, currentLocation);

    // Check time patterns and impossible travel (pass existing data)
    const timePatternResult = await this.checkTimePattern(userId, currentLocation);

    const totalRiskScore = deviceResult.score + locationResult.score + vpnResult.score + timePatternResult.score;

    // Collect all reasons
    const reasons: string[] = [];
    if (deviceResult.reason) reasons.push(deviceResult.reason);
    if (locationResult.reason) reasons.push(locationResult.reason);
    if (vpnResult.reason) reasons.push(vpnResult.reason);
    if (timePatternResult.reason) reasons.push(timePatternResult.reason);

    // Single consolidated risk score log
    this.logger.log(`Risk Score Calculation for User ${userId}:`, {
      deviceScore: deviceResult.score,
      locationScore: locationResult.score,
      vpnScore: vpnResult.score,
      timePatternScore: timePatternResult.score,
      totalScore: totalRiskScore,
      reasons: reasons,
      ip: securityContext.clientIp,
      fingerprint: securityContext.fingerprint,
    });

    return { score: totalRiskScore, reasons, locationData: currentLocation };
  }

  /**
   * Check if device exists for this user and return risk score and reason
   */
  private async checkDevice(userId: string, securityContext: SecurityContext): Promise<RiskCheckResult> {
    try {
      const existingDevice = await this.loginDeviceService.findDeviceByUserAndFingerprint(
        userId,
        securityContext.fingerprint,
      );

      if (existingDevice) {
        this.logger.log(`Device Check: Known device found for user ${userId} - 0 points added`);
        return { score: 0 };
      } else {
        this.logger.log(
          `Device Check: Unknown device for user ${userId} - ${this.config.riskScores.newDevice} points added (new device)`,
        );
        return { score: this.config.riskScores.newDevice, reason: 'new device' };
      }
    } catch (error) {
      this.logger.error(`Failed to check device for user ${userId}: ${error.message}`);
      return { score: 0 }; // Return 0 risk on error
    }
  }

  /**
   * Check location using Sumsub API based on user's KYC status and return risk score
   */
  private async checkLocation(
    userId: string,
    securityContext: SecurityContext,
    currentLocation?: LocationData,
  ): Promise<RiskCheckResult> {
    try {
      // Use provided location data or fetch from Sumsub API
      const locationData = currentLocation || (await this.getCurrentLocation(userId, securityContext));

      if (!locationData) {
        this.logger.log(`Location Check: Could not get current location for user ${userId} - 0 points added`);
        return { score: 0 };
      }

      // Get user's last known location from login events
      const lastLocation = await this.loginEventService.getLastKnownLocation(userId);

      if (!lastLocation) {
        this.logger.log(`Location Check: First login for user ${userId} - 0 points added (no previous location)`);
        return { score: 0 }; // First login, no previous location to compare
      }

      // Calculate location risk based on changes
      const locationRisk = this.calculateLocationRisk(lastLocation, locationData);

      // Log the specific reason for location risk and return with reason
      if (locationRisk === this.config.riskScores.countryChange) {
        this.logger.log(
          `Location Check: Country change detected for user ${userId} - ${locationRisk} points added (${lastLocation.country} → ${locationData.country})`,
        );
        return { score: locationRisk, reason: `new country (${locationData.country})` };
      } else if (locationRisk === this.config.riskScores.regionChange) {
        this.logger.log(
          `Location Check: Region change detected for user ${userId} - ${locationRisk} points added (${lastLocation.region} → ${locationData.region})`,
        );
        return { score: locationRisk, reason: `new region (${locationData.region})` };
      } else if (locationRisk === this.config.riskScores.cityChange) {
        this.logger.log(
          `Location Check: City change detected for user ${userId} - ${locationRisk} points added (${lastLocation.city} → ${locationData.city})`,
        );
        return { score: locationRisk, reason: `new city (${locationData.city})` };
      } else {
        this.logger.log(`Location Check: No location change for user ${userId} - 0 points added`);
        return { score: 0 };
      }
    } catch (error) {
      // Re-throw RestrictionException for banned countries, catch other errors
      if (error instanceof RestrictionException) {
        throw error;
      }
      this.logger.error(`Failed to check location for user ${userId}: ${error.message}`);
      return { score: 0 }; // Return 0 risk on other errors
    }
  }

  /**
   * Get current location from Sumsub API and check if country is banned
   */
  async getCurrentLocation(userId: string, securityContext: SecurityContext): Promise<LocationData | null> {
    try {
      let locationData: LocationData | null = null;

      // Get user's KYC verification record
      const kycRecord = await this.kycVerificationService.findByUserId(userId);

      if (!kycRecord || kycRecord.status !== 'approved') {
        // User is not KYC approved, use standard IP check
        const ipCheckResult = await this.transactionMonitoringAdapter.ipCheck({
          ipAddress: securityContext.clientIp,
          userId: userId,
        });
        locationData = ipCheckResult;
      } else {
        // User is KYC approved, use applicant-specific endpoint
        const applicantId = kycRecord.provider_ref;

        if (!applicantId) {
          return null;
        }

        const applicantIpCheckResult = await this.transactionMonitoringAdapter.ipCheckForApplicant({
          ipAddress: securityContext.clientIp,
          applicantId: applicantId,
        });
        locationData = applicantIpCheckResult;
      }

      // Check if the country is banned
      if (locationData?.country) {
        const bannedCountry = await this.ipCountryBanService.isCountryBanned(locationData.country);
        if (bannedCountry) {
          this.logger.error(
            `Location Check: BANNED COUNTRY DETECTED for user ${userId} - Country: ${locationData.country}, Reason: ${bannedCountry.reason}`,
          );
          throw new RestrictionException(
            RestrictionErrorType.ERR_COMPLIANCE_COUNTRY_BANNED,
            bannedCountry.reason || undefined,
            { country: locationData.country },
          );
        }
      }

      return locationData;
    } catch (error) {
      // Re-throw RestrictionException for banned countries, catch other errors
      if (error instanceof RestrictionException) {
        throw error;
      }
      this.logger.error(`Failed to get current location for user ${userId}: ${error.message}`);
      return null;
    }
  }

  /**
   * Calculate location risk score based on location changes
   */
  private calculateLocationRisk(lastLocation: LastKnownLocation, currentLocation: LocationData): number {
    // If country changes, it's automatically a new region and city too
    if (currentLocation.country && lastLocation.country && currentLocation.country !== lastLocation.country) {
      return this.config.riskScores.countryChange;
    }

    // If region changes within same country
    if (currentLocation.region && lastLocation.region && currentLocation.region !== lastLocation.region) {
      return this.config.riskScores.regionChange;
    }

    // If city changes within same region
    if (currentLocation.city && lastLocation.city && currentLocation.city !== lastLocation.city) {
      return this.config.riskScores.cityChange;
    }

    // Same location
    return 0;
  }

  /**
   * Check VPN usage and log
   */
  private async checkVPN(userId: string, currentLocation: LocationData): Promise<RiskCheckResult> {
    try {
      if (!currentLocation) {
        this.logger.log(`VPN Check: No location data provided for user ${userId}`);
        return { score: 0 };
      }

      // Check for VPN usage and log
      if (currentLocation.isVpn) {
        this.logger.log(
          `VPN Check: VPN detected for user ${userId} from ${currentLocation.country} (${currentLocation.city}) - ${this.config.riskScores.vpnUsage} points added`,
        );
        return { score: this.config.riskScores.vpnUsage, reason: 'VPN usage detected' };
      } else {
        this.logger.log(
          `VPN Check: No VPN detected for user ${userId} from ${currentLocation.country} (${currentLocation.city}) - 0 points added`,
        );
      }

      return { score: 0 };
    } catch (error) {
      this.logger.error(`Failed to check VPN for user ${userId}: ${error.message}`);
      return { score: 0 };
    }
  }

  /**
   * Check time patterns
   * TODO: Implement impossible travel detection based on geographic distance and time
   */
  private async checkTimePattern(userId: string, currentLocation: LocationData): Promise<RiskCheckResult> {
    try {
      if (!currentLocation) {
        this.logger.log(`Time Pattern Check: No location data provided for user ${userId}`);
        return { score: 0 };
      }

      return { score: 0 }; // No time pattern scoring for now
    } catch (error) {
      this.logger.error(`Failed to check time pattern for user ${userId}: ${error.message}`);
      return { score: 0 };
    }
  }

  /**
   * Check if there's already an active OTP for this user/device combination.
   * If an identifier is provided, we verify the OTP belongs to the same user
   * to prevent blocking authorized users when another user has a pending OTP.
   */
  async hasActiveOtp(securityContext: SecurityContext, identifier?: string): Promise<boolean> {
    const redisKey = `login_otp:${securityContext.clientIp}:${securityContext.fingerprint}`;
    try {
      const otpDataStr = await this.redisService.get(redisKey);
      if (!otpDataStr) {
        return false;
      }

      // If no identifier provided, an OTP exists so return true to block login
      if (!identifier) {
        return true;
      }

      // Look up user by identifier (email, username, or phone)
      let user = await this.userRepository.findActiveByEmail(identifier);
      if (!user) {
        user = await this.userRepository.findActiveByUsername(identifier);
      }
      if (!user) {
        user = await this.userRepository.findActiveByPhone(identifier);
      }

      // If user not found, let the login flow handle validation
      if (!user) {
        return false;
      }

      // Check if the OTP belongs to this user
      const otpData = JSON.parse(otpDataStr);
      if (otpData.user_id !== user.id) {
        // OTP belongs to a different user - don't block this user
        return false;
      }

      return true;
    } catch (error) {
      this.logger.error(`Failed to check for active OTP: ${error.message}`);
      return false;
    }
  }

  /**
   * Generate and send OTP to user via email only
   */
  private async generateAndSendOtp(userId: string, securityContext: SecurityContext): Promise<string> {
    const user = await this.userRepository.findActiveById(userId);
    if (!user) {
      this.logger.error(`User ${userId} not found`);
      throw new UnauthorizedException('User not found');
    }

    // Generate OTP code
    const otpCode = UtilsService.generateCode();
    const expirationTime = DateTime.now().plus({ minutes: this.config.otp.expirationMinutes }).toMillis();

    // Create masked email (show first 2 and last part after @)
    const emailParts = user.email.split('@');
    const username = emailParts[0];
    const domain = emailParts[1];
    const maskedUsername = username.length > 2 ? username.substring(0, 2) + '***' : '***';
    const maskedContact = `${maskedUsername}@${domain}`;

    // Store OTP in Redis using IP and fingerprint as key
    const redisKey = `login_otp:${securityContext.clientIp}:${securityContext.fingerprint}`;
    const otpData = {
      code: await UtilsService.hashPassword(otpCode),
      user_id: userId,
      expiration: expirationTime,
      attempts: 0,
      masked_contact: maskedContact,
    };

    // TTL in seconds
    await this.redisService.set(redisKey, JSON.stringify(otpData), this.config.otp.expirationMinutes * 60);

    // Send Email OTP
    try {
      const loginOtpMail = new LoginOtpMail(user, otpCode, this.config.otp.expirationMinutes);
      await this.mailerService.send(loginOtpMail);
      this.logger.log(`Email OTP sent to user ${userId}`);

      return maskedContact;
    } catch (error) {
      this.logger.error(`Failed to send Email OTP to user ${userId}: ${error.message}`);
      throw new UnauthorizedException('Unable to send verification code. Please try again.');
    }
  }

  async handleHighRiskLogin(
    riskScore: number,
    userId: string,
    securityContext: SecurityContext,
    reasons: string[],
  ): Promise<HighRiskLoginResult> {
    const user = await this.userRepository.findById(userId);
    const isRestrictionDisabled = user?.disable_login_restrictions || false;

    if (isRestrictionDisabled) {
      this.logger.log(`Login restrictions disabled for user ${userId} - skipping high-risk OTP requirement`);
      return { maskedContact: '', reasons: [] };
    }

    this.logger.warn(`High risk login (${riskScore} points) for user ${userId} - triggering OTP`);

    const maskedContact = await this.generateAndSendOtp(userId, securityContext);

    // Send security notification email (optional - failure won't stop login flow)
    try {
      const user = await this.userRepository.findActiveById(userId);
      const locationData = await this.getCurrentLocation(userId, securityContext);
      const highRiskLoginMail = new HighRiskLoginMail(user, reasons, securityContext.clientIp, locationData);
      await this.mailerService.send(highRiskLoginMail);
      this.logger.log(`High-risk login notification email sent to user ${userId}`);
    } catch (error) {
      this.logger.error(`Failed to send high-risk login email to user ${userId}: ${error.message}`);
      // Don't fail the login process if email fails - SMS is the primary security method
    }

    this.logger.log(`OTP sent to user ${userId} at ******${maskedContact}. Risk reasons: ${reasons.join(', ')}`);

    return { maskedContact, reasons };
  }

  /**
   * Resend OTP for high-risk login
   */
  async resendLoginOtp(securityContext: SecurityContext): Promise<{ maskedContact: string }> {
    // Check if there's an existing OTP session
    const redisKey = `login_otp:${securityContext.clientIp}:${securityContext.fingerprint}`;

    try {
      const otpDataStr = await this.redisService.get(redisKey);
      if (!otpDataStr) {
        const maskedContact = await this.getMaskedContactFromRedis(securityContext);
        throw new OtpRequiredException('No active OTP session found. Please try logging in again.', maskedContact);
      }

      const otpData = JSON.parse(otpDataStr);

      // Get user ID from the existing OTP session
      const userId = otpData.user_id;

      // Generate and send new OTP using shared method
      const maskedContact = await this.generateAndSendOtp(userId, securityContext);

      this.logger.log(`OTP resent to user ${userId} at ******${maskedContact}`);

      return { maskedContact };
    } catch (error) {
      this.logger.error(`OTP resend failed: ${error.message}`);
      // If it's already an OtpRequiredException, rethrow it
      if (error instanceof OtpRequiredException) {
        throw error;
      }
      // For other errors (like failed to send OTP), wrap in OtpRequiredException
      const maskedContact = await this.getMaskedContactFromRedis(securityContext);
      throw new OtpRequiredException('Failed to resend verification code. Please try again.', maskedContact);
    }
  }

  /**
   * Verify OTP for high-risk login
   */
  async verifyLoginOtp(otpCode: string, securityContext: SecurityContext): Promise<OtpVerificationResult> {
    // Direct lookup using IP and fingerprint
    const redisKey = `login_otp:${securityContext.clientIp}:${securityContext.fingerprint}`;

    try {
      const otpDataStr = await this.redisService.get(redisKey);
      if (!otpDataStr) {
        const maskedContact = await this.getMaskedContactFromRedis(securityContext);
        throw new OtpRequiredException('OTP expired or not found', maskedContact);
      }

      const otpData = JSON.parse(otpDataStr);
      const maskedContact = otpData.masked_contact || (await this.getMaskedContactFromRedis(securityContext));

      // Check expiration
      if (Date.now() > otpData.expiration) {
        await this.redisService.del(redisKey);
        throw new OtpRequiredException('OTP has expired', maskedContact);
      }

      // Check attempts limit
      if (otpData.attempts >= this.config.otp.maxAttempts) {
        await this.redisService.del(redisKey);
        throw new OtpRequiredException('Too many OTP attempts', maskedContact);
      }

      // Verify OTP code
      const isValidCode = await UtilsService.comparePassword(otpCode, otpData.code);
      if (!isValidCode) {
        // Increment attempts
        otpData.attempts += 1;
        await this.redisService.set(redisKey, JSON.stringify(otpData), this.config.otp.expirationMinutes * 60);
        throw new OtpRequiredException('Invalid OTP code', maskedContact);
      }

      // OTP verified successfully - clean up
      await this.redisService.del(redisKey);

      // Get user details
      const user = await this.userRepository.findActiveById(otpData.user_id);
      if (!user) {
        throw new UnauthorizedException('User not found');
      }

      this.logger.log(`OTP verified successfully for user ${otpData.user_id}`);
      return { success: true, user };
    } catch (error) {
      this.logger.error(`OTP verification failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get maskedContact from Redis OTP session or return a default
   */
  async getMaskedContactFromRedis(securityContext: SecurityContext): Promise<string> {
    try {
      const redisKey = `login_otp:${securityContext.clientIp}:${securityContext.fingerprint}`;
      const otpDataStr = await this.redisService.get(redisKey);

      if (otpDataStr) {
        const otpData = JSON.parse(otpDataStr);
        if (otpData.masked_contact) {
          return otpData.masked_contact;
        }
      }
    } catch (error) {
      this.logger.error(`Failed to get masked contact from Redis: ${error.message}`);
    }

    return '***@***.com';
  }

  /**
   * Clear all login-related Redis keys for an identifier (called on successful login)
   */
  async clearIdentifierAttempts(identifier: string, securityContext?: SecurityContext): Promise<void> {
    const normalizedIdentifier = identifier.toLowerCase();
    try {
      const attemptsKey = `${this.redisKeyPrefix}:attempts:${normalizedIdentifier}`;
      const lockoutKey = `${this.redisKeyPrefix}:lockout:${normalizedIdentifier}`;

      await this.redisService.del(attemptsKey);
      await this.redisService.del(lockoutKey);

      // Also clear OTP key if securityContext is provided
      if (securityContext?.clientIp && securityContext?.fingerprint) {
        const otpKey = `login_otp:${securityContext.clientIp}:${securityContext.fingerprint}`;
        await this.redisService.del(otpKey);
        this.logger.log(`Cleared all login keys for identifier: ${normalizedIdentifier} (including OTP)`);
      } else {
        this.logger.log(`Cleared rate limiting keys for identifier: ${normalizedIdentifier}`);
      }
    } catch (error) {
      this.logger.error(`Failed to clear login keys for identifier ${normalizedIdentifier}: ${error.message}`);
    }
  }
}
