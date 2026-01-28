import {
  BadRequestException,
  Inject,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { DateTime } from 'luxon';
import { UserModel, UserStatus } from '../../../database';
import { AccountDeleteRequestCancelledMail } from '../../../notifications/mails/account_delete_request_cancelled_mail';
import { DeleteAccountRequestMail } from '../../../notifications/mails/delete_acccont_request.mail';
import { MailerService } from '../../../services/queue/processors/mailer/mailer.service';
import { AccessTokenService } from '../accessToken/accessToken.service';
import { AccountActionCodeService } from '../accountActionCode/accountActionCode.service';
import { AccountActionType } from '../accountActionCode/dtos/sendAccountActionCodeMail.dto';
import { LoginDeviceRepository } from '../loginDevice/loginDevice.repository';
import { LoginEventRepository } from '../loginEvent';
import { RefreshTokenService } from '../refreshToken/refreshToken.service';
import { UserRepository } from '../user/user.repository';
import { AccountDeleteRequestRepository } from './accountDeleteRequest.repository';
import { AccountDeleteRequestDto } from './dtos/accountDeleteRequest.dto';
import { VerifyAccountDeleteRequestDto } from './dtos/verifyAccountDeleteRequest.dto';

@Injectable()
export class AccountDeleteRequestService {
  @Inject(UserRepository)
  private readonly userRepository: UserRepository;
  @Inject(AccountDeleteRequestRepository)
  private readonly accountDeleteRequestRepository: AccountDeleteRequestRepository;
  @Inject(AccessTokenService)
  private readonly accessTokenService: AccessTokenService;
  @Inject(RefreshTokenService)
  private readonly refreshTokenService: RefreshTokenService;
  @Inject(MailerService)
  private readonly mailerService: MailerService;
  @Inject(LoginDeviceRepository)
  private readonly loginDeviceRepository: LoginDeviceRepository;
  @Inject(LoginEventRepository)
  private readonly loginEventRepository: LoginEventRepository;

  @Inject(AccountActionCodeService)
  private readonly accountActionCodeService: AccountActionCodeService;
  private readonly logger = new Logger(AccountDeleteRequestService.name);

  public async sendAccountDeleteRequestMail(user: UserModel) {
    try {
      this.logger.log(
        `Sending verification mail for account deactivation for user ${user.email}`,
        'AccountDeactivationService',
      );

      await this.accountActionCodeService.createAccountActionCode(user, AccountActionType.DELETE);

      // we want to send the email code to the user
      return true;
    } catch (error) {
      this.logger.error(error);
      throw new InternalServerErrorException(error.message || 'Error sending email code for account delete request');
    }
  }

  public async verifyAccountDeleteRequestCode(user: UserModel, data: VerifyAccountDeleteRequestDto) {
    try {
      this.logger.log(`Verifying account delete request code for user ${user.email}`, 'AccountDeleteRequestService');

      // we want to verify the code
      const isCodeValid = await this.accountActionCodeService.verifyAccountActionCode(data.code, user);

      if (!isCodeValid) {
        throw new BadRequestException('Invalid code, please try again');
      }

      return true;
    } catch (error) {
      this.logger.error(error);
      throw new InternalServerErrorException(error.message || 'Error verifying account delete request code');
    }
  }

  async createDeleteRequest(user: UserModel, data: AccountDeleteRequestDto) {
    this.logger.log('createDeleteRequest', 'AccountDeleteRequestService');
    // check if there is a delete request already
    await this.findOrThrowIfAccountDeleteRequestExists(user.id);

    try {
      const deletedOnDate = DateTime.now().plus({ days: 30 }).toSQL();
      const deleteRequest = await this.accountDeleteRequestRepository.transaction(async (trx) => {
        const request = await this.accountDeleteRequestRepository.create(
          { reasons: data.reasons, user_id: user.id, deleted_on: deletedOnDate },
          trx,
        );

        await this.userRepository.update({ id: user.id }, { status: UserStatus.PENDING_ACCOUNT_DELETION }, { trx });

        // delete refresh token from Redis
        await this.refreshTokenService.delete(user.id);

        // delete all access tokens from Redis
        await this.accessTokenService.delete(user.id);

        // delete all account deactivation codes (soft delete)
        await this.loginDeviceRepository.query(trx).where('user_id', user.id).delete();

        // delete all login locations (soft delete)
        await this.loginEventRepository.query(trx).where('user_id', user.id).delete();

        // send email to user
        this.mailerService.send(new DeleteAccountRequestMail(user, new Date(request.deleted_on).toDateString()));

        return request;
      });

      return deleteRequest;
    } catch (error) {
      this.logger.error(error.message, 'AccountDeleteRequestService');
      throw new InternalServerErrorException('Error while creating the code');
    }
  }

  private async findOrThrowIfAccountDeleteRequestExists(userId: string) {
    const deleteRequest = await this.accountDeleteRequestRepository.findOne({ user_id: userId });

    if (deleteRequest) {
      // check if the deleted on is passed
      const deletedOn = DateTime.fromSQL(deleteRequest.deleted_on as string);
      const now = DateTime.now();

      if (deletedOn && deletedOn <= now) {
        // delete the request
        await this.accountDeleteRequestRepository.hardDelete(deleteRequest.id);
      } else {
        throw new NotFoundException('Account delete already requested for this user');
      }

      throw new NotFoundException('Account delete already requested for this user');
    }

    return deleteRequest;
  }

  /**
   * Get active delete request for a user (Admin use)
   * Considers both: AccountDeleteRequest record exists OR user has PENDING_ACCOUNT_DELETION status
   */
  async getActiveDeleteRequest(userId: string) {
    this.logger.log(`Getting active delete request for user ${userId}`, 'AccountDeleteRequestService');

    const [user, deleteRequest] = await Promise.all([
      this.userRepository.findOne({ id: userId }),
      this.accountDeleteRequestRepository.findOne({ user_id: userId }),
    ]);

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const hasPendingDeletionStatus = user.status === UserStatus.PENDING_ACCOUNT_DELETION;
    const hasDeleteRequest = !!deleteRequest;
    const hasActiveRequest = hasDeleteRequest || hasPendingDeletionStatus;

    return {
      hasActiveRequest,
      deleteRequest: deleteRequest
        ? {
            id: deleteRequest.id,
            reasons: deleteRequest.reasons,
            deleted_on: deleteRequest.deleted_on,
            created_at: deleteRequest.created_at,
          }
        : null,
      userStatus: user.status || null,
      hasPendingDeletionStatus,
    };
  }

  /**
   * Cancel an active account delete request (Admin use)
   * Updates both: soft-deletes the AccountDeleteRequest AND resets user status to ACTIVE
   * Sends an email notification to the user
   */
  async cancelDeleteRequest(userId: string) {
    this.logger.log(`Cancelling delete request for user ${userId}`, 'AccountDeleteRequestService');

    const user = await this.userRepository.findOne({ id: userId });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    try {
      await this.accountDeleteRequestRepository.transaction(async (trx) => {
        // Soft delete the account delete request if it exists
        const deleteRequest = await this.accountDeleteRequestRepository.findOne({ user_id: userId });

        if (deleteRequest) {
          await this.accountDeleteRequestRepository.delete(deleteRequest.id, trx);
        }

        // Update user status back to ACTIVE
        await this.userRepository.update({ id: userId }, { status: UserStatus.ACTIVE }, { trx });
      });

      // Send email notification to user
      this.mailerService.send(new AccountDeleteRequestCancelledMail(user));

      return {
        success: true,
        message: 'Account deletion request has been cancelled successfully',
      };
    } catch (error) {
      this.logger.error(`Error cancelling delete request: ${error.message}`, 'AccountDeleteRequestService');
      throw new InternalServerErrorException('Error cancelling account deletion request');
    }
  }
}
