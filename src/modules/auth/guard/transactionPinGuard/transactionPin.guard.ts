import {
  BadRequestException,
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { UserModel } from '../../../../database';
import { TransactionPinModel } from '../../../../database/models/transactionPin/transactionPin.model';
import { RestrictionErrorType, RestrictionException } from '../../../../exceptions/restriction_exception';
import { EventEmitterEventsEnum } from '../../../../services/eventEmitter/eventEmitter.interface';
import { EventEmitterService } from '../../../../services/eventEmitter/eventEmitter.service';
import { LockerService } from '../../../../services/locker';
import { RedisService } from '../../../../services/redis/redis.service';
import { TransactionPinRepository } from '../../transactionPin/transactionPin.repository';
import { TransactionPinService } from '../../transactionPin/transactionPin.service';
import { UserRepository } from '../../user/user.repository';

@Injectable()
export class TransactionPinGuard implements CanActivate {
  private readonly transactionPinService: TransactionPinService = new TransactionPinService(
    new TransactionPinRepository(),
    new UserRepository(),
    new RedisService(),
  );

  @Inject(LockerService)
  private readonly lockerService: LockerService;

  @Inject(EventEmitterService)
  private readonly eventEmitterService: EventEmitterService;

  @Inject(UserRepository)
  private readonly userRepository: UserRepository;

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();

    // get the logged in user
    if (!request.user?.id) {
      throw new UnauthorizedException('You are not authorize to access this resource');
    }

    const userId = request.user.id;
    // get the transaction  pin from the request body
    const lockKey = `transaction-pin:${userId}`;

    return await this.lockerService.withLock(lockKey, async () => {
      // check if the user requires a transaction pin reset
      const user = (await this.userRepository.findById(userId, '[transactionPin]')) as UserModel & {
        transactionPin: TransactionPinModel;
      };

      if (user?.require_transaction_pin_reset) {
        throw new BadRequestException('Your transaction pin has been locked. Reset your transaction pin to continue.');
      }

      if (!user?.transactionPin?.pin) {
        throw new BadRequestException(
          'Your transaction pin has not been set. Please set your transaction pin to continue.',
        );
      }

      // Step 1: Check if user is currently locked out (rate limit check)
      // This implements exponential backoff to prevent brute-force attacks
      // Progressive lockout: 3+ attempts = 15min, 5+ = 30min, 7+ = 1hr
      await this.transactionPinService.checkPinRateLimitAndLockout(userId);

      const transactionPin = request.body.transaction_pin;

      if (!transactionPin) {
        throw new BadRequestException('Transaction PIN is required');
      }

      // Step 2: Get current failed attempts count
      let failedAttempts = await this.transactionPinService.getFailedAttempts(userId);

      // Step 3: Verify the transaction PIN
      const isVerified = await this.transactionPinService.verifyTransactionPinWithoutThrowing(userId, transactionPin);
      const maxAttempts = 5;

      if (!isVerified) {
        // Step 4: Handle failed verification
        await this.transactionPinService.incrementFailedAttempts(userId);
        failedAttempts = await this.transactionPinService.getFailedAttempts(userId);
        const remainingAttempts = maxAttempts - failedAttempts;

        // Step 5: Apply progressive lockout based on failed attempts
        // This creates a time-based penalty that increases with each failure
        await this.transactionPinService.applyProgressiveLockout(userId, failedAttempts);

        // Step 6: Check if maximum attempts reached (requires transaction pin reset)
        if (failedAttempts >= maxAttempts) {
          await this.eventEmitterService.emitAsync(EventEmitterEventsEnum.REQUIRE_TRANSACTION_PIN_RESET, userId);
          throw new RestrictionException(RestrictionErrorType.ERR_USER_PIN_LOCKED);
        }

        // Step 7: Inform user about remaining attempts
        throw new BadRequestException(`Invalid transaction PIN. ${remainingAttempts} attempt(s) left.`);
      }

      // Step 8: Successful verification - clear all security penalties
      await this.transactionPinService.resetFailedAttempts(userId);
      await this.transactionPinService.clearLockout(userId);

      return isVerified;
    });
  }
}
