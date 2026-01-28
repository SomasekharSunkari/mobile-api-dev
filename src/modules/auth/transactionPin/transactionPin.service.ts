import { BadRequestException, ConflictException, Inject, Injectable, Logger } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { ONE_DAY_IN_SECONDS } from '../../../constants/constants';
import { RedisService } from '../../../services/redis/redis.service';
import { UserRepository } from '../user/user.repository';
import { ChangePinDto } from './dtos/changePin.dto';
import { SetPinDto } from './dtos/setPin.dto';
import { TransactionPinRepository } from './transactionPin.repository';

/**
 * Service for user security operations (e.g., setting transaction PIN).
 * Handles business logic and validation for user security features.
 */
@Injectable()
export class TransactionPinService {
  @Inject(TransactionPinRepository)
  private readonly transactionPinRepository: TransactionPinRepository;

  @Inject(UserRepository)
  private readonly userRepository: UserRepository;

  @Inject(RedisService)
  private readonly redisService: RedisService;

  /**
   *
   * @description - We did this so that we can inject the dependencies in the guard and not in the service,
   * check transactionPinGuard.ts for more details
   */
  constructor(
    transactionPinRepository?: TransactionPinRepository,
    userRepository?: UserRepository,
    redisService?: RedisService,
  ) {
    if (transactionPinRepository) {
      this.transactionPinRepository = transactionPinRepository;
    }
    if (userRepository) {
      this.userRepository = userRepository;
    }
    if (redisService) {
      this.redisService = redisService;
    }
  }
  private readonly logger = new Logger(TransactionPinService.name);

  /**
   * Set a transaction PIN for a user, ensuring it is not already set and both PINs match.
   * @param userId - The user's unique identifier
   * @param pin - The PIN to set
   * @param confirmPin - The confirmation PIN
   * @throws BadRequestException if PINs do not match
   * @throws ConflictException if a PIN is already set
   */
  async setPin(userId: string, dto: SetPinDto) {
    const { pin } = dto;

    const existing = await this.transactionPinRepository.findByUserId(userId);

    if (existing && existing.pin) {
      throw new ConflictException('Transaction PIN already set');
    }

    const salt = await bcrypt.genSalt(12);
    const hashedPin = await bcrypt.hash(pin, salt);

    if (existing) {
      throw new BadRequestException('Transaction PIN already set');
    }
    // No record exists, create a new one
    await this.transactionPinRepository.createPin(userId, hashedPin);

    this.logger.log(`PIN created for userId=${userId}`);
    return true;
  }

  /**
   * Verify a user's transaction PIN by comparing the input PIN with the stored hash.
   * @param userId - The user's unique identifier
   * @param inputPin - The PIN to verify
   * @returns true if the PIN matches, false otherwise
   * @throws BadRequestException if no PIN is set for the user
   */
  async verifyTransactionPin(userId: string, inputPin: string): Promise<boolean> {
    const userSecurity = await this.transactionPinRepository.findByUserId(userId);
    if (!userSecurity) {
      throw new BadRequestException('Transaction PIN not set for this user');
    }
    const isMatch = await bcrypt.compare(inputPin, userSecurity.pin);
    if (!isMatch) {
      throw new BadRequestException('Invalid transaction PIN');
    }
    this.logger.log(`PIN verification attempt for userId=${userId}, result=${isMatch}`);
    return isMatch;
  }

  /**
   * Change a user's transaction PIN after verifying password and old PIN.
   * @param userId - The user's unique identifier
   * @param dto - ChangePinDto containing password, oldPin, newPin, confirmNewPin
   */
  async changePin(userId: string, dto: ChangePinDto) {
    const { old_pin, pin } = dto;

    // Verify old PIN
    const userSecurity = await this.transactionPinRepository.findByUserId(userId);
    if (!userSecurity?.pin) {
      throw new BadRequestException('Transaction PIN not set for this user');
    }
    const isOldPinValid = await bcrypt.compare(old_pin, userSecurity.pin);
    if (!isOldPinValid) throw new BadRequestException('Old PIN is incorrect');

    if (old_pin === pin) {
      throw new BadRequestException('New PIN must be different from old PIN');
    }

    // Update PIN
    const salt = await bcrypt.genSalt(12);
    const hashedNewPin = await bcrypt.hash(pin, salt);
    await this.transactionPinRepository.updatePin(userId, hashedNewPin);
    this.logger.log(`PIN updated for userId=${userId}`);
    return true;
  }

  async verifyTransactionPinWithoutThrowing(userId: string, inputPin: string): Promise<boolean> {
    const userSecurity = await this.transactionPinRepository.findByUserId(userId);
    if (!userSecurity) {
      return false;
    }
    const isMatch = await bcrypt.compare(inputPin, userSecurity.pin);
    if (!isMatch) {
      return false;
    }
    this.logger.log(`PIN verification attempt for userId=${userId}, result=${isMatch}`);
    return isMatch;
  }

  /**
   * Validate a user's transaction PIN and return validation result
   * @param userId - The user's unique identifier
   * @param inputPin - The PIN to validate
   * @returns Object containing isValid property indicating if PIN is valid
   */
  async validateTransactionPin(userId: string, inputPin: string): Promise<{ isValid: boolean }> {
    try {
      const userSecurity = await this.transactionPinRepository.findByUserId(userId);
      if (!userSecurity) {
        return { isValid: false };
      }
      const isMatch = await bcrypt.compare(inputPin, userSecurity.pin);
      this.logger.log(`PIN validation for userId=${userId}, result=${isMatch}`);
      return { isValid: isMatch };
    } catch (error) {
      this.logger.error(`Error validating transaction PIN for userId=${userId}: ${error}`);
      throw new BadRequestException('Failed to validate transaction PIN');
    }
  }

  async incrementFailedAttempts(userId: string): Promise<number> {
    const key = `transaction_pin_failed_attempts:${userId}`;
    const attempts = await this.redisService.getClient().incr(key);

    // Set expiry to 24 hours
    if (attempts === 1) {
      await this.redisService.expire(key, ONE_DAY_IN_SECONDS);
    }

    return attempts;
  }

  async resetFailedAttempts(userId: string): Promise<void> {
    const key = `transaction_pin_failed_attempts:${userId}`;
    await this.redisService.getClient().del(key);
  }

  async getFailedAttempts(userId: string): Promise<number> {
    const key = `transaction_pin_failed_attempts:${userId}`;
    const attempts = await this.redisService.getClient().get(key);
    return attempts ? Number.parseInt(attempts) : 0;
  }

  /**
   * Check if user is currently locked out from transaction PIN attempts
   * Implements progressive exponential backoff based on failed attempts:
   * - 3-4 attempts: 15 minute lockout
   * - 5-6 attempts: 30 minute lockout
   * - 7+ attempts: 1 hour lockout
   * This prevents brute-force attacks while allowing legitimate users to retry after timeout
   *
   * @param userId - The user's unique identifier
   * @throws BadRequestException if user is currently locked out
   */
  async checkPinRateLimitAndLockout(userId: string): Promise<void> {
    const lockoutKey = `transaction-pin-lockout:${userId}`;
    const lockoutExpiry = await this.redisService.get(lockoutKey);

    if (lockoutExpiry) {
      const expiryTimestamp = Number.parseInt(lockoutExpiry);
      const now = Date.now();
      const remainingSeconds = Math.ceil((expiryTimestamp - now) / 1000);

      if (remainingSeconds > 0) {
        const remainingMinutes = Math.ceil(remainingSeconds / 60);
        this.logger.warn(
          `User ${userId} is locked out from transaction PIN attempts. ${remainingMinutes} minutes remaining.`,
        );
        throw new BadRequestException(
          `Too many failed attempts. Your account is temporarily locked. Please try again in ${remainingMinutes} minute(s).`,
        );
      }

      // Lockout has expired, remove the key
      await this.redisService.del(lockoutKey);
    }
  }

  /**
   * Apply progressive lockout based on number of failed attempts
   * Uses exponential backoff to discourage brute-force attacks:
   * - 3-4 attempts: 15 minutes (900 seconds)
   * - 5-6 attempts: 30 minutes (1800 seconds)
   * - 7+ attempts: 1 hour (3600 seconds)
   *
   * @param userId - The user's unique identifier
   * @param failedAttempts - Current number of failed attempts
   */
  async applyProgressiveLockout(userId: string, failedAttempts: number): Promise<void> {
    let lockoutDurationSeconds = 0;

    if (failedAttempts >= 7) {
      // 7+ attempts: 1 hour lockout
      lockoutDurationSeconds = 3600;
    } else if (failedAttempts >= 5) {
      // 5-6 attempts: 30 minute lockout
      lockoutDurationSeconds = 1800;
    } else if (failedAttempts >= 3) {
      // 3-4 attempts: 15 minute lockout
      lockoutDurationSeconds = 900;
    }

    if (lockoutDurationSeconds > 0) {
      const lockoutKey = `transaction-pin-lockout:${userId}`;
      const expiryTimestamp = Date.now() + lockoutDurationSeconds * 1000;

      // Store the expiry timestamp
      await this.redisService.set(lockoutKey, expiryTimestamp.toString(), lockoutDurationSeconds);

      const lockoutMinutes = lockoutDurationSeconds / 60;
      this.logger.warn(
        `Applied ${lockoutMinutes}-minute lockout for user ${userId} after ${failedAttempts} failed attempts.`,
      );
    }
  }

  /**
   * Clear the lockout when user successfully verifies PIN
   * This is part of the security flow - successful authentication clears any penalties
   *
   * @param userId - The user's unique identifier
   */
  async clearLockout(userId: string): Promise<void> {
    const lockoutKey = `transaction-pin-lockout:${userId}`;
    await this.redisService.del(lockoutKey);
  }
}
