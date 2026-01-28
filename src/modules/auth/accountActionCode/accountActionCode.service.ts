import {
  BadRequestException,
  Inject,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';

import { DateTime } from 'luxon';
import { Transaction } from 'objection';
import { UserModel } from '../../../database';
import { AccountRestrictionMail } from '../../../notifications/mails/account_deactivation_mail';
import { AccountDeleteCodeMail } from '../../../notifications/mails/account_delete_code_mail';
import { ChangePasswordCodeMail } from '../../../notifications/mails/change_password_code_mail';
import { ChangeTransactionPinCodeMail } from '../../../notifications/mails/change_transaction_pin_code_mail';
import { EmailVerificationCodeMail } from '../../../notifications/mails/email_verification_code_mail';
import { PhoneVerificationCodeMail } from '../../../notifications/mails/phone_verification_code_mail';
import { ResetPasswordMail } from '../../../notifications/mails/reset_password_mail';
import { ResetTransactionPinMail } from '../../../notifications/mails/reset_transaction_pin_mail';
import { TwoFactorAuthCodeMail } from '../../../notifications/mails/two_factor_auth_code_mail';
import { WithdrawFundsCodeMail } from '../../../notifications/mails/withdraw_funds_code_mail';
import { MailerManager } from '../../../services/queue/processors/mailer/mailer.interface';
import { MailerService } from '../../../services/queue/processors/mailer/mailer.service';
import { UtilsService } from '../../../utils/utils.service';
import { AccountActionCodeRepository } from './accountActionCode.repository';
import { AccountActionType } from './dtos/sendAccountActionCodeMail.dto';

@Injectable()
export class AccountActionCodeService {
  @Inject(AccountActionCodeRepository)
  private readonly accountActionCodeRepository: AccountActionCodeRepository;

  @Inject(MailerService)
  private readonly mailerService: MailerService;

  private readonly logger = new Logger(AccountActionCodeService.name);

  public async createAccountActionCode(user: UserModel, action: AccountActionType = AccountActionType.DEACTIVATE) {
    try {
      this.logger.log(`Creating account action code for user ${user.email}`, 'AccountActionCodeService');

      // check if the user has an existing account action code
      const existingAccountActionCode = await this.accountActionCodeRepository.findSync({
        user_id: user.id,
        is_used: false,
      });

      if (existingAccountActionCode) {
        // update the expiration date
        await this.accountActionCodeRepository.update(user.id, {
          expires_at: DateTime.now().plus({ minutes: -5 }).toSQL(),
        });
      }

      const code = UtilsService.generateCode(6);
      const hashedCode = await UtilsService.hashPassword(code);
      // 5 minutes
      const expiresAt = DateTime.now().plus({ minutes: 5 }).toSQL();

      const accountActionCode = await this.accountActionCodeRepository.create({
        user_id: user.id,
        email: user.email,
        code: hashedCode,
        expires_at: expiresAt,
        type: action,
      });

      // send email to the user with the code
      const mail = this.getMailForAction(action, user, code, expiresAt);
      if (mail) {
        this.mailerService.send(mail);
      }

      return accountActionCode;
    } catch (error) {
      this.logger.error(error);
      throw new InternalServerErrorException('Error creating account action code', error);
    }
  }

  public async verifyAccountActionCode(code: string, user: UserModel) {
    try {
      this.logger.log(`Verifying account action code for user ${user.email}`, 'AccountActionCodeService');

      // get the user action code
      const accountActionCode = await this.accountActionCodeRepository.findOne({
        user_id: user.id,
      });

      if (!accountActionCode) {
        throw new NotFoundException('Code not found');
      }

      // check if the code is expired
      const now = DateTime.now().toISO();

      const expiresAt = DateTime.fromJSDate(new Date(accountActionCode.expires_at as string)).toISO();

      if (DateTime.fromISO(expiresAt) < DateTime.fromISO(now)) {
        throw new BadRequestException('Code expired');
      }

      // check if the code is not yet used
      if (accountActionCode.used_at || accountActionCode.is_used) {
        throw new BadRequestException('Code already used');
      }

      const isCodeValid = await UtilsService.comparePassword(code, accountActionCode.code);
      if (!isCodeValid) {
        throw new BadRequestException('Invalid code');
      }

      return true;
    } catch (error) {
      this.logger.error(error);
      throw new InternalServerErrorException(error.message || 'Error verifying code');
    }
  }

  public async handleSuccessfulAccountAction(user: UserModel, trx: Transaction) {
    try {
      this.logger.log(`Handling successful code`, 'AccountActionCodeService');

      // update the account action code to be used
      await this.accountActionCodeRepository.update(
        user.id,
        {
          is_used: true,
          used_at: DateTime.now().toSQL(),
        },
        { trx },
      );
    } catch (error) {
      this.logger.error(error);
      throw new InternalServerErrorException('Error handling successful code', error);
    }
  }

  private getMailForAction(
    action: AccountActionType,
    user: UserModel,
    code: string,
    expiresAt: string,
  ): MailerManager | null {
    switch (action) {
      case AccountActionType.DELETE:
        return new AccountDeleteCodeMail(user, code);
      case AccountActionType.DEACTIVATE:
      case AccountActionType.ACCOUNT_DEACTIVATION:
        return new AccountRestrictionMail(user, code, expiresAt);
      case AccountActionType.CHANGE_TRANSACTION_PIN:
        return new ChangeTransactionPinCodeMail(user, code, expiresAt);
      case AccountActionType.CHANGE_PASSWORD:
        return new ChangePasswordCodeMail(user, code, expiresAt);
      case AccountActionType.EMAIL_VERIFICATION:
        return new EmailVerificationCodeMail(user, code, expiresAt);
      case AccountActionType.PHONE_VERIFICATION:
        return new PhoneVerificationCodeMail(user, code, expiresAt);
      case AccountActionType.TWO_FACTOR_AUTH:
        return new TwoFactorAuthCodeMail(user, code, expiresAt);
      case AccountActionType.WITHDRAW_FUNDS:
        return new WithdrawFundsCodeMail(user, code, expiresAt);
      case AccountActionType.RESET_PASSWORD:
        return new ResetPasswordMail(user, code);
      case AccountActionType.RESET_TRANSACTION_PIN:
        return new ResetTransactionPinMail(user, code);
      default:
        return null;
    }
  }
}
