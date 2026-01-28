import {
  BadGatewayException,
  Inject,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import * as jwt from 'jsonwebtoken';
import { DateTime } from 'luxon';
import { Transaction } from 'objection';
import { EnvironmentService } from '../../../config';
import { Timing } from '../../../constants/timing';
import { UserModel, UserStatus } from '../../../database';
import { PasswordPawnMail } from '../../../notifications/mails/password_pawn_mail';
import { ResetPasswordMail } from '../../../notifications/mails/reset_password_mail';
import { MailerService } from '../../../services/queue/processors/mailer/mailer.service';
import { UtilsService } from '../../../utils/utils.service';
import { AccessTokenService } from '../accessToken';
import { TransactionPinService } from '../transactionPin/transactionPin.service';
import { UserRepository } from '../user/user.repository';
import { ForgotPasswordDto } from './dtos/forgot-password.dto';
import { ResetPasswordDto } from './dtos/reset-password.dto';
import { VerifyResetPasswordCodeDto } from './dtos/verity-reset-password-code.dto';
import { ResetPasswordRepository } from './reset-password.repository';

@Injectable()
export class ResetPasswordService {
  @Inject(UserRepository)
  private readonly userRepository: UserRepository;
  @Inject(ResetPasswordRepository)
  private readonly resetPasswordRepository: ResetPasswordRepository;

  @Inject(MailerService)
  private readonly mailerService: MailerService;

  @Inject(AccessTokenService)
  private readonly accessTokenService: AccessTokenService;

  @Inject(TransactionPinService)
  private readonly transactionPinService: TransactionPinService;

  private readonly logger = new Logger(ResetPasswordService.name);

  async forgotPassword(data: ForgotPasswordDto) {
    this.logger.log('Initializing forgot password', 'forgotPassword', 'ResetPasswordService');
    // check if the email or phone is registered
    const user = await this.findOrThrowIfNotUserNotFound({ email: data.email, phone: data.phone });

    // check if the user is scheduled for deletion
    await this.ThrowIfUserIsDeactivated(user);

    try {
      // check if the user has a code and then expire it.
      await this.expireUnusedCode(user.id);

      // create the code and save
      const code = UtilsService.generateCode();
      const expirationDate = DateTime.now().plus({ hour: Timing.HALF_HOUR }).toSQL();
      await this.resetPasswordRepository.transaction(async (trx) => {
        // hash the code
        const hashedCode = await UtilsService.hashPassword(code);

        const newCode = await this.resetPasswordRepository.create(
          {
            code: hashedCode,
            user_id: user.id,
            expiration_time: expirationDate,
          },
          trx,
        );

        //TODO: Send email notification or sms depending on the request body;
        if (data.email) {
          await this.mailerService.send(new ResetPasswordMail(user, code));
        } else {
        }
        return newCode;
      });
      return { success: true };
    } catch (error) {
      this.logger.error(error.message, 'ResetPasswordService');
      throw new InternalServerErrorException('Error while creating the code');
    }
  }

  private async ThrowIfUserIsDeactivated(user: UserModel) {
    if (
      user.status === UserStatus.PENDING_DEACTIVATION ||
      user.status === UserStatus.PENDING_ACCOUNT_DELETION ||
      user.status === UserStatus.DELETED
    ) {
      throw new NotFoundException('Your account is deactivated, please contact support');
    }
  }

  async verifyCode(data: VerifyResetPasswordCodeDto) {
    this.logger.log('Initializing Verification of Reset password code', 'verifyCode', 'ResetPasswordService');

    const code = data.code;
    const user = await this.findOrThrowIfNotUserNotFound(data);

    // check if the user is scheduled for deletion
    await this.ThrowIfUserIsDeactivated(user);

    await this.findOrThrowIfCodeIsInvalid(code, user);

    try {
      const resetPasswordToken = this.createResetPasswordToken(code, user.id);

      return { success: true, resetPasswordToken };
    } catch (error) {
      this.logger.error(error?.message, 'verifyCode', 'resetPasswordService');
      throw new InternalServerErrorException('Error Verifying the code');
    }
  }

  async resetPassword(data: ResetPasswordDto) {
    this.logger.log('Initializing Reset password', 'resetPassword', 'ResetPasswordService');

    // verifies the reset password token
    const resetPassword = await this.verifyResetPasswordToken(data.reset_password_token);

    const user = resetPassword?.user as UserModel;
    // check if the user is deactivated
    await this.ThrowIfUserIsDeactivated(user);

    await this.checkIfPasswordContainsUserDetailsAndThrow(data.password, user);

    // check if new password matches the current password
    await this.throwIfNewPasswordMatchesCurrentPassword(data.password, user.password);

    try {
      const password = await UtilsService.hashPassword(data.password);

      await this.resetPasswordRepository.transaction(async (trx) => {
        await this.resetPasswordRepository.update({ user_id: user.id }, { is_used: true }, { trx });
        await this.userRepository.update({ id: user.id }, { password, require_password_reset: false }, { trx });
        // delete all user sessions
        await this.accessTokenService.delete(user.id, trx);
      });

      // send mail if password is pawned
      this.mailerService.send(new PasswordPawnMail(user, data.password));

      // return success
      return { success: true };
    } catch (error) {
      this.logger.error(error?.message, 'resetPassword', 'resetPasswordService');
      throw new InternalServerErrorException('Error while resetting the password');
    }
  }

  /**
   * Throws an error if the new password matches the current password
   * @param newPassword The new plain text password
   * @param currentHashedPassword The current hashed password
   * @throws NotFoundException if the new password matches the current password
   */
  private async throwIfNewPasswordMatchesCurrentPassword(
    newPassword: string,
    currentHashedPassword: string,
  ): Promise<void> {
    const matchesCurrentPassword = await UtilsService.comparePassword(newPassword, currentHashedPassword);
    if (matchesCurrentPassword) {
      throw new NotFoundException('You cannot reuse an old password. Please choose a different password.');
    }
  }

  private async checkIfPasswordContainsUserDetailsAndThrow(password: string, user: UserModel) {
    const isPasswordContainsEmail = password.includes(user.email);
    const isPasswordContainsPhone = password.includes(user.phone_number);
    const isPasswordContainsName = password.includes(user.username);

    if (isPasswordContainsEmail || isPasswordContainsPhone || isPasswordContainsName) {
      throw new NotFoundException('Password should not contain your email, phone or username');
    }
    return true;
  }

  private async findOrThrowIfNotUserNotFound(data: Pick<VerifyResetPasswordCodeDto, 'email' | 'phone'>) {
    let user: UserModel;
    if (data.email) {
      user = await this.userRepository.findActiveByEmail(data.email);
    } else {
      user = await this.userRepository.findActiveByPhone(data.phone);
    }

    if (!user) {
      throw new NotFoundException('User Not found');
    }

    return user;
  }

  private async findOrThrowIfCodeIsInvalid(code: string, user: UserModel) {
    const resetPasswordCode = await this.resetPasswordRepository.findOne({
      user_id: user.id,
    });

    if (!resetPasswordCode) {
      throw new NotFoundException('Code not found');
    }

    // check if the code match
    const isCodeMatch = await UtilsService.comparePassword(code, resetPasswordCode.code);

    if (!isCodeMatch) {
      throw new NotFoundException('Invalid code, please try again');
    }

    const expirationTime = resetPasswordCode.expiration_time;
    const isUsed = resetPasswordCode.is_used;
    if (UtilsService.isDatePassed(expirationTime)) {
      throw new NotFoundException('Code has expired');
    }

    if (isUsed) {
      throw new NotFoundException('Code has already been used');
    }

    return resetPasswordCode;
  }

  private async expireUnusedCode(userId: string) {
    const now = DateTime.now().toSQL();
    const activeCode = await this.resetPasswordRepository
      .findSync({ user_id: userId })
      .andWhere('expiration_time', '>', now)
      .andWhere({ is_used: false })
      .first();

    if (activeCode) {
      const passedDate = DateTime.now().minus({ minutes: 2 }).toSQL();
      await activeCode.$query().patch({ expiration_time: passedDate });
    }
  }

  private createResetPasswordToken(code: string, userId: string) {
    const JWT_SECRET_TOKEN = EnvironmentService.getValue('JWT_SECRET_TOKEN');

    const resetPasswordToken = jwt.sign({ reset_password_token: code, user_id: userId }, JWT_SECRET_TOKEN, {
      expiresIn: '5m',
    });

    return resetPasswordToken;
  }

  /**
   * Verifies the reset password token
   * @param token The reset password token to be verified
   * @returns The account verification object
   * @throws NotFoundException If the code is invalid, expired or already used
   * @throws BadGatewayException If an unexpected error occurs
   */
  private async verifyResetPasswordToken(token: string) {
    this.logger.log(
      'Initializing Verification of Reset password token',
      'verifyResetPasswordToken',
      'ResetPasswordService',
    );
    try {
      const JWT_SECRET_TOKEN = EnvironmentService.getValue('JWT_SECRET_TOKEN');
      const decodedToken = jwt.verify(token, JWT_SECRET_TOKEN) as { reset_password_token: string; user_id: string };
      const { reset_password_token: code, user_id: userId } = decodedToken;

      const resetPassword = await this.resetPasswordRepository.findOne({ user_id: userId }, {}, { graphFetch: 'user' });

      if (!resetPassword) {
        throw new NotFoundException('Reset Password not found');
      }

      const isCodeMatch = await UtilsService.comparePassword(code, resetPassword.code);
      if (!isCodeMatch) {
        throw new NotFoundException('Invalid code, please try again');
      }

      if (resetPassword.is_used) {
        throw new NotFoundException('Reset Password already used');
      }

      if (!resetPassword?.user) {
        throw new NotFoundException('User not found');
      }

      const expirationTime = resetPassword.expiration_time;
      if (UtilsService.isDatePassed(expirationTime)) {
        throw new NotFoundException('Code has expired');
      }

      return resetPassword;
    } catch (error) {
      this.logger.error(error?.message, 'verifyResetPasswordToken', 'resetPasswordService');
      if (error.name === 'TokenExpiredError') {
        throw new NotFoundException('Reset password token has expired');
      } else if (error.name === 'JsonWebTokenError') {
        throw new NotFoundException('Invalid reset password token');
      } else if (error instanceof NotFoundException) {
        throw error;
      } else {
        throw new BadGatewayException('Error verifying reset password token');
      }
    }
  }

  public async requirePasswordReset(userId: string, trx?: Transaction) {
    this.logger.log(`requirePasswordReset: ${userId}`, 'UserService');

    try {
      await this.userRepository.update(userId, { require_password_reset: true }, { trx });
      await this.accessTokenService.delete(userId, trx);
    } catch (error) {
      this.logger.error(error.message, 'UserService');
      throw new InternalServerErrorException(error.message);
    }
  }
}
