import {
  BadRequestException,
  Inject,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import * as jwt from 'jsonwebtoken';
import { DateTime } from 'luxon';
import { EnvironmentService } from '../../../config';
import { Timing } from '../../../constants/timing';
import { UserModel, UserStatus } from '../../../database';
import { ResetTransactionPinMail } from '../../../notifications/mails/reset_transaction_pin_mail';
import { MailerService } from '../../../services/queue/processors/mailer/mailer.service';
import { UtilsService } from '../../../utils/utils.service';
import { TransactionPinRepository } from '../transactionPin/transactionPin.repository';
import { TransactionPinService } from '../transactionPin/transactionPin.service';
import { UserRepository } from '../user/user.repository';
import { ResetPinWithTokenDto } from './dtos/resetPinWithToken.dto';
import { VerifyResetPinCodeDto } from './dtos/verifyResetPinCode.dto';
import { ResetTransactionPinRepository } from './resetTransactionPin.repository';

@Injectable()
export class ResetTransactionPinService {
  private readonly logger = new Logger(ResetTransactionPinService.name);
  @Inject(ResetTransactionPinRepository)
  private readonly resetTransactionPinRepository: ResetTransactionPinRepository;

  @Inject(UserRepository)
  private readonly userRepository: UserRepository;

  @Inject(TransactionPinRepository)
  private readonly transactionPinRepository: TransactionPinRepository;

  @Inject(MailerService)
  private readonly mailerService: MailerService;

  @Inject(TransactionPinService)
  private readonly transactionPinService: TransactionPinService;

  async initiateResetPin(email: string) {
    // check if the email
    const user = await this.findOrThrowIfNotUserNotFound(email);

    // check if the user is deactivated
    await this.ThrowIfUserIsDeactivated(user);
    try {
      // check if the user has a code and then expire it.
      await this.expireUnusedCode(user.id);

      // create the code and save
      const code = UtilsService.generateCode();
      this.logger.log(`Generated code: ${code}`);
      this.logger.log(`Initiating PIN reset for userId=${user.id}, email=${email}`);
      const expirationDate = DateTime.now().plus({ hours: Timing.HALF_HOUR }).toSQL();

      await this.resetTransactionPinRepository.transaction(async (trx) => {
        // hash the code
        const hashedCode = await UtilsService.hashPassword(code);

        const newCode = await this.resetTransactionPinRepository.create(
          {
            code: hashedCode,
            user_id: user.id,
            expiration_time: expirationDate,
          },
          trx,
        );

        await this.mailerService.send(new ResetTransactionPinMail(user, code));

        this.logger.log(`PIN reset code created for userId=${user.id}, codeId=${newCode.id}`);
        return newCode;
      });

      return { success: true };
    } catch (error) {
      this.logger.error(error.message, 'ResetPinService');
      throw new InternalServerErrorException('Error while creating the code');
    }
  }

  async resetPinWithToken(dto: ResetPinWithTokenDto, userId: string) {
    const { token, pin } = dto;

    if (token) {
      const resetPinVerification = await this.verifyResetPinToken(token);
      if (resetPinVerification.user_id !== userId) {
        this.logger.warn(`PIN reset attempt failed: token userId mismatch for userId=${userId}`);
        throw new BadRequestException('Invalid verification code');
      }
    }

    const salt = await bcrypt.genSalt(12);
    const hashedPin = await bcrypt.hash(pin, salt);

    await this.transactionPinRepository.updatePin(userId, hashedPin);

    await this.userRepository.update(userId, { require_transaction_pin_reset: false });

    // Step 8: Successful verification - clear all security penalties
    await this.transactionPinService.resetFailedAttempts(userId);
    await this.transactionPinService.clearLockout(userId);

    this.logger.log(`PIN updated for userId=${userId}`);
    return true;
  }

  async verifyCode(data: VerifyResetPinCodeDto, userId: string) {
    this.logger.log(`PIN code verification attempt for userId=${userId}`);
    await this.findOrThrowIfCodeIsInvalid(data.code, userId);

    try {
      const verificationCode = await this.resetTransactionPinRepository.findOne({ user_id: userId });

      const JWT_SECRET_TOKEN = EnvironmentService.getValue('JWT_SECRET_TOKEN');

      /**
       *
       * this token will be used to reset pin
       */
      const resetPinToken = jwt.sign({ verification_token: verificationCode.code }, JWT_SECRET_TOKEN);
      // return success
      return { success: true, resetPinToken };
    } catch (error) {
      this.logger.error(error?.message, 'verifyAccount', 'AccountVerificationService');
      throw new InternalServerErrorException('Error while verifying the account');
    }
  }

  async ThrowIfUserIsDeactivated(user: UserModel) {
    if (
      user.status === UserStatus.PENDING_DEACTIVATION ||
      user.status === UserStatus.PENDING_ACCOUNT_DELETION ||
      user.status === UserStatus.DELETED
    ) {
      throw new NotFoundException('Your account is deactivated, please contact support');
    }
  }

  private async findOrThrowIfNotUserNotFound(email: string) {
    const user = await this.userRepository.findActiveByEmail(email);

    if (!user) {
      throw new NotFoundException('User Not found');
    }

    return user;
  }

  private async expireUnusedCode(userId: string) {
    const now = DateTime.now().toSQL();
    const activeCode = await this.resetTransactionPinRepository
      .findSync({ user_id: userId })
      .andWhere('expiration_time', '>', now)
      .andWhere({ is_used: false })
      .first();

    if (activeCode) {
      const passedDate = DateTime.now().minus({ minutes: 2 }).toSQL();
      await activeCode.$query().patch({ expiration_time: passedDate });
    }
  }

  private async findOrThrowIfCodeIsInvalid(code: string, userId: string) {
    this.logger.log(`Verifying PIN reset code for userId=${userId}`);
    const resetPinCode = await this.resetTransactionPinRepository.findOne({
      user_id: userId,
      is_used: false,
    });

    if (!resetPinCode) {
      this.logger.warn(`PIN reset code not found for userId=${userId}`);
      throw new NotFoundException('Code not found');
    }

    // check if the code match
    const isCodeMatch = await UtilsService.comparePassword(code, resetPinCode.code);
    if (!isCodeMatch) {
      this.logger.warn(`Invalid PIN reset code attempt for userId=${userId}`);
      throw new NotFoundException('Invalid code, please try again');
    }

    const expirationTime = resetPinCode.expiration_time;
    const isUsed = resetPinCode.is_used;
    if (UtilsService.isDatePassed(expirationTime)) {
      this.logger.warn(`Expired PIN reset code attempt for userId=${userId}`);
      throw new NotFoundException('Code has expired');
    }

    if (isUsed) {
      this.logger.warn(`Used PIN reset code attempt for userId=${userId}`);
      throw new NotFoundException('Code has already been used');
    }

    return resetPinCode;
  }

  /**
   * Verify the resetpin token
   * @param token
   * @returns
   * @description This function will verify the reset pin token and return the account verification object
   */
  public async verifyResetPinToken(token: string) {
    const JWT_SECRET_TOKEN = EnvironmentService.getValue('JWT_SECRET_TOKEN');
    const decodedToken = jwt.verify(token, JWT_SECRET_TOKEN) as { verification_token: string };
    const { verification_token: code } = decodedToken;

    const accountVerification = await this.resetTransactionPinRepository.findOne({ code });

    if (!accountVerification) {
      this.logger.warn(`PIN reset token verification failed: code not found`);
      throw new NotFoundException('Account verification not found');
    }

    if (accountVerification.is_used) {
      this.logger.warn(
        `PIN reset token verification failed: code already used for userId=${accountVerification.user_id}`,
      );
      throw new NotFoundException('Account verification already used');
    }

    this.logger.log(`PIN reset token verified for userId=${accountVerification.user_id}`);
    return accountVerification;
  }

  public async requireTransactionPinReset(userId: string) {
    this.logger.log(`requireTransactionPinReset: ${userId}`, 'ResetTransactionPinService');

    try {
      await this.userRepository.update(userId, { require_transaction_pin_reset: true });
    } catch (error) {
      this.logger.error(error.message, 'ResetTransactionPinService');
      throw new InternalServerErrorException(error.message);
    }
  }
}
