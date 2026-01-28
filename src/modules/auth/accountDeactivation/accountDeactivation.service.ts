import {
  BadRequestException,
  Inject,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';

import { DateTime } from 'luxon';
import { PartialModelObject } from 'objection';
import { UserModel } from '../../../database';
import { AccountDeactivationStatus } from '../../../database/models/accountDeactivationLog/accountDeactivationLog.interface';
import { AccountDeactivationLogModel } from '../../../database/models/accountDeactivationLog/accountDeactivationLog.model';
import { AccountActivationMail } from '../../../notifications/mails/account_activation_mail';
import { AccountDeactivationSuccessfulMail } from '../../../notifications/mails/account_deactivation_successful_mail';
import { MailerService } from '../../../services/queue/processors/mailer/mailer.service';
import { RedisCacheService } from '../../../services/redis/redis-cache.service';
import { S3Service } from '../../../services/s3';
import { IN_APP_NOTIFICATION_TYPE } from '../../inAppNotification/inAppNotification.enum';
import { InAppNotificationService } from '../../inAppNotification/inAppNotification.service';
import { AccountActionCodeService } from '../accountActionCode/accountActionCode.service';
import { ROLES } from '../guard';
import { UserService } from '../user/user.service';
import { AccountDeactivationRepository } from './accountDeactivation.repository';
import { ActivateAccountDto } from './dtos/activateAccount.dto';
import { CreateAccountDeactivationDto } from './dtos/createAccountDeactivation.dto';
import { ReactivateAccountDto } from './dtos/reactivateAccount.dto';

@Injectable()
export class AccountDeactivationService {
  @Inject(AccountDeactivationRepository)
  private readonly accountDeactivationRepository: AccountDeactivationRepository;

  @Inject(UserService)
  private readonly userService: UserService;

  @Inject(AccountActionCodeService)
  private readonly accountActionCodeService: AccountActionCodeService;

  @Inject(MailerService)
  private readonly mailerService: MailerService;

  @Inject(RedisCacheService)
  private readonly redisCacheService: RedisCacheService;

  @Inject(S3Service)
  private readonly s3Service: S3Service;

  @Inject(InAppNotificationService)
  private readonly inAppNotificationService: InAppNotificationService;

  private readonly logger = new Logger(AccountDeactivationService.name);

  public async createAccountDeactivation(loggedInUser: UserModel, data: CreateAccountDeactivationDto) {
    try {
      // Determine target user - if user_id provided, admin is restricting another user
      const isAdminRestrictingOther = data.user_id && data.user_id !== loggedInUser.id;
      let targetUser: UserModel;
      let restrictedByUserId: string;

      if (isAdminRestrictingOther) {
        // Admin restricting another user - verify admin role
        await loggedInUser.$fetchGraph('[userRoles]');
        const isAdmin = loggedInUser.userRoles?.some(
          (role) => role.slug === ROLES.ADMIN || role.slug === ROLES.SUPER_ADMIN,
        );

        if (!isAdmin) {
          throw new UnauthorizedException('You are not authorized to restrict other users');
        }

        targetUser = (await this.userService.findByUserId(data.user_id)) as unknown as UserModel;
        restrictedByUserId = loggedInUser.id;
        this.logger.log(
          `Admin ${loggedInUser.email} restricting account for user ${targetUser.email}`,
          'AccountDeactivationService',
        );
      } else {
        // User restricting their own account - verify with email code
        targetUser = loggedInUser;
        restrictedByUserId = loggedInUser.id;
        this.logger.log(`Creating account deactivation for user ${targetUser.email}`, 'AccountDeactivationService');

        if (data.email_verification_code) {
          const isCodeValid = await this.accountActionCodeService.verifyAccountActionCode(
            data.email_verification_code,
            targetUser,
          );
          if (!isCodeValid) {
            throw new UnauthorizedException('Invalid code');
          }
        }
      }

      // Check if the user has pending deactivation
      let accountDeactivation = await this.accountDeactivationRepository.findOne({
        user_id: targetUser.id,
        status: AccountDeactivationStatus.DEACTIVATED,
        is_active_log: true,
      });

      if (accountDeactivation) {
        throw new BadRequestException('User is already restricted');
      }

      accountDeactivation = await this.accountDeactivationRepository.transaction(async (trx) => {
        // Set all previous logs for this user to inactive
        await this.accountDeactivationRepository
          .query(trx)
          .where('user_id', targetUser.id)
          .patch({ is_active_log: false } as PartialModelObject<AccountDeactivationLogModel>);

        // Create new active deactivation log
        accountDeactivation = await this.accountDeactivationRepository.create(
          {
            user_id: targetUser.id,
            reasons: data.reasons,
            status: AccountDeactivationStatus.DEACTIVATED,
            is_active_log: true,
            deactivated_by_user_id: restrictedByUserId,
            deactivated_on: DateTime.now().toSQL(),
          },
          trx,
        );

        // Set the user to deactivated
        await this.userService.deactivateUser(targetUser.id, trx);

        // Send restriction notification email
        await this.mailerService.send(new AccountDeactivationSuccessfulMail(targetUser, accountDeactivation.reasons));

        // Send in-app notification for account restriction
        await this.inAppNotificationService.createNotification({
          user_id: targetUser.id,
          type: IN_APP_NOTIFICATION_TYPE.ACCOUNT_RESTRICTED,
          title: 'Account Restricted',
          message: isAdminRestrictingOther
            ? 'Your account has been restricted by an administrator. Please contact support for more information.'
            : 'Your account has been successfully restricted as requested.',
        });

        // Handle successful account action (only for self-restriction with verification)
        if (!isAdminRestrictingOther) {
          await this.accountActionCodeService.handleSuccessfulAccountAction(targetUser, trx);
        }

        await this.redisCacheService.del(`deactivation_status_${targetUser.id}`);

        return accountDeactivation;
      });

      return accountDeactivation;
    } catch (error) {
      this.logger.error(error);
      if (
        error instanceof BadRequestException ||
        error instanceof UnauthorizedException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }
      throw new InternalServerErrorException(error.message || 'Error creating account deactivation');
    }
  }

  public async activateAccount(data: ActivateAccountDto, loggedInUser: UserModel) {
    try {
      this.logger.log(`Activating account for user ${data.user_id}`, 'AccountDeactivationService');
      const user = (await this.userService.findByUserId(data.user_id)) as unknown as UserModel;
      let deactivationLog = await this.accountDeactivationRepository.findOne({
        user_id: user.id,
        status: AccountDeactivationStatus.DEACTIVATED,
        is_active_log: true,
      });

      if (!deactivationLog && !user.is_deactivated) {
        throw new BadRequestException('User is already activated');
      }

      const isOwner = data.user_id === loggedInUser.id;
      await loggedInUser.$fetchGraph('[userRoles]');
      const isAdmin = loggedInUser.userRoles?.some(
        (role) => role.slug === ROLES.ADMIN || role.slug === ROLES.SUPER_ADMIN,
      );

      // If user is trying to activate their own account, check if they were the one who restricted it
      if (isOwner && deactivationLog.deactivated_by_user_id !== loggedInUser.id) {
        throw new BadRequestException(
          'Your account was restricted by an administrator. Please contact support to request account unrestriction.',
        );
      }

      // If user is trying to activate someone else's account, they must be admin
      if (!isOwner && !isAdmin) {
        throw new UnauthorizedException('You are not authorized to perform this action');
      }

      deactivationLog = await this.accountDeactivationRepository.transaction(async (trx) => {
        await this.userService.activateUser(user.id, trx);

        // Set all previous logs for this user to inactive
        await this.accountDeactivationRepository
          .query(trx)
          .where('user_id', user.id)
          .patch({ is_active_log: false } as PartialModelObject<AccountDeactivationLogModel>);

        deactivationLog = await this.accountDeactivationRepository.create(
          {
            status: AccountDeactivationStatus.ACTIVATED,
            reactivated_by_user_id: loggedInUser.id,
            reactivated_on: DateTime.now().toSQL(),
            user_id: user.id,
            is_active_log: true,
            reasons: [],
          },
          trx,
        );

        await this.redisCacheService.del(`deactivation_status_${user.id}`);

        return deactivationLog;
      });

      await this.mailerService.send(new AccountActivationMail(user));
      return deactivationLog;
    } catch (error) {
      this.logger.error(error);
      if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
        throw error;
      }
      throw new InternalServerErrorException(error.message || 'Error activating account');
    }
  }

  public async getActiveDeactivationRecord(userId: string) {
    this.logger.log(`Getting active deactivation record for user: ${userId}`, 'AccountDeactivationService');

    const deactivationLog = await this.accountDeactivationRepository.findOne({
      user_id: userId,
      status: AccountDeactivationStatus.DEACTIVATED,
      is_active_log: true,
    });

    if (!deactivationLog) {
      throw new NotFoundException('No active deactivation record found for this user');
    }

    return deactivationLog;
  }

  /**
   * Get all deactivation logs for a user (admin only)
   */
  public async getDeactivationLogsForUser(userId: string) {
    this.logger.log(`Getting all deactivation logs for user: ${userId}`, 'AccountDeactivationService');

    const logs = await this.accountDeactivationRepository
      .query()
      .where('user_id', userId)
      .withGraphFetched('[deactivatedBy, reactivatedBy]')
      .orderBy('created_at', 'desc');

    return logs;
  }

  public async reactivateAccountWithDocument(
    data: ReactivateAccountDto,
    admin: UserModel,
    supportDocument?: Express.Multer.File,
  ) {
    this.logger.log(`Reactivating account for user ${data.user_id} with document`, 'AccountDeactivationService');

    const user = (await this.userService.findByUserId(data.user_id)) as unknown as UserModel;
    let deactivationLog = await this.accountDeactivationRepository.findOne({
      user_id: user.id,
      status: AccountDeactivationStatus.DEACTIVATED,
      is_active_log: true,
    });

    if (!deactivationLog && !user.is_deactivated) {
      throw new BadRequestException('User is already activated');
    }

    try {
      let supportDocumentUrl: string | undefined;

      // Upload support document to S3 if provided
      if (supportDocument) {
        const key = this.s3Service.generateUniqueKey(
          `reactivation-support-documents/${user.id}`,
          supportDocument.originalname.split('.').pop(),
        );

        const s3Result = await this.s3Service.uploadBuffer(supportDocument.buffer, {
          key,
          contentType: supportDocument.mimetype,
          metadata: {
            userId: user.id,
            adminId: admin.id,
            originalName: supportDocument.originalname,
            uploadedAt: new Date().toISOString(),
          },
        });

        supportDocumentUrl = s3Result.location;
      }

      deactivationLog = await this.accountDeactivationRepository.transaction(async (trx) => {
        await this.userService.activateUser(user.id, trx);

        // Set all previous logs for this user to inactive
        await this.accountDeactivationRepository
          .query(trx)
          .where('user_id', user.id)
          .patch({ is_active_log: false } as PartialModelObject<AccountDeactivationLogModel>);

        deactivationLog = await this.accountDeactivationRepository.create(
          {
            status: AccountDeactivationStatus.ACTIVATED,
            reactivated_by_user_id: admin.id,
            reactivated_on: DateTime.now().toSQL(),
            user_id: user.id,
            is_active_log: true,
            reasons: [],
            reactivation_description: data.reactivation_description,
            reactivation_support_document_url: supportDocumentUrl,
          },
          trx,
        );

        await this.redisCacheService.del(`deactivation_status_${user.id}`);

        return deactivationLog;
      });

      // send activation mail to the user
      await this.mailerService.send(new AccountActivationMail(user));

      return deactivationLog;
    } catch (error) {
      this.logger.error(error);
      throw new InternalServerErrorException(error.message || 'Error reactivating account with document');
    }
  }
}
