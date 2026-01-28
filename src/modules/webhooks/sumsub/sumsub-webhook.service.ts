import { Inject, Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { DateTime } from 'luxon';
import { UniqueViolationError } from 'objection';
import { KYCAdapter } from '../../../adapters/kyc/kyc-adapter';
import {
  GetKycDetailsPayload,
  GetKycDetailsResponse,
  KycBaseResponse,
} from '../../../adapters/kyc/kyc-adapter.interface';
import { SumsubWebhookPayload } from '../../../adapters/kyc/sumsub/sumsub.interface';
import { OneDoshConfiguration } from '../../../config/onedosh/onedosh.config';
import { FiatWalletModel, UserModel } from '../../../database';
import { KycVerificationEnum } from '../../../database/models/kycVerification/kycVerification.interface';
import { KycVerificationModel } from '../../../database/models/kycVerification/kycVerification.model';
import { KycRejectedMail } from '../../../notifications/mails/kyc_rejectecd_mail';
import { KycSuccessMail } from '../../../notifications/mails/kyc_success_mail';
import { KycUnderReviewMail } from '../../../notifications/mails/kyc_under_review_mail';
import { LockerService } from '../../../services/locker';
import { MailerService } from '../../../services/queue/processors/mailer/mailer.service';
import { UtilsService } from '../../../utils/utils.service';
import { KycStatusLogService } from '../../auth/kycStatusLog/kycStatusLog.service';
import { SumSubVerificationType } from '../../auth/kycVerification/dto/generateSumsubAccessToken.dto';
import { KycVerificationRepository } from '../../auth/kycVerification/kycVerification.repository';
import { KycVerificationService } from '../../auth/kycVerification/kycVerification.service';
import { UserRepository } from '../../auth/user/user.repository';
import { UserProfileRepository } from '../../auth/userProfile';
import { BlockchainWalletService } from '../../blockchainWallet/blockchainWallet.service';
import { FiatWalletService } from '../../fiatWallet';

import { EnvironmentService } from '../../../config';
import { TierConfigModel } from '../../../database/models/tierConfig/tierConfig.model';
import { VirtualAccountType } from '../../../database/models/virtualAccount';
import { DoshPointsTransactionService } from '../../doshPoints/doshPointsTransaction/doshPointsTransaction.service';
import { ExternalAccountService } from '../../externalAccount/external-account.service';
import { IN_APP_NOTIFICATION_TYPE } from '../../inAppNotification/inAppNotification.enum';
import { InAppNotificationService } from '../../inAppNotification/inAppNotification.service';
import { ParticipantService } from '../../participant';
import { TierConfigRepository } from '../../tierConfig';
import { UserTierService } from '../../userTier';
import { VirtualAccountService } from '../../virtualAccount';
import { CreateVirtualAccountDto } from '../../virtualAccount/dtos/createVirtualAccount.dto';

@Injectable()
export class SumsubWebhookService {
  @Inject(KycVerificationService)
  private readonly kycVerificationService: KycVerificationService;

  @Inject(KycStatusLogService)
  private readonly kycStatusLogService: KycStatusLogService;

  @Inject(KYCAdapter)
  private readonly kycAdapter: KYCAdapter;

  @Inject(UserProfileRepository)
  private readonly userProfileRepository: UserProfileRepository;

  @Inject(UserRepository)
  private readonly userRepository: UserRepository;

  @Inject(FiatWalletService)
  private readonly fiatWalletService: FiatWalletService;

  @Inject(VirtualAccountService)
  private readonly virtualAccountService: VirtualAccountService;

  @Inject(MailerService)
  private readonly mailerService: MailerService;

  @Inject(ParticipantService)
  private readonly participantService: ParticipantService;

  @Inject(KycVerificationRepository)
  private readonly kycVerificationRepository: KycVerificationRepository;

  @Inject(TierConfigRepository)
  private readonly tierConfigRepository: TierConfigRepository;

  @Inject(UserTierService)
  private readonly userTierService: UserTierService;

  @Inject(BlockchainWalletService)
  private readonly blockchainWalletService: BlockchainWalletService;

  @Inject(LockerService)
  private readonly lockerService: LockerService;

  @Inject(InAppNotificationService)
  private readonly inAppNotificationService: InAppNotificationService;

  @Inject(ExternalAccountService)
  private readonly externalAccountService: ExternalAccountService;

  @Inject(DoshPointsTransactionService)
  private readonly doshPointsTransactionService: DoshPointsTransactionService;

  private readonly logger = new Logger(SumsubWebhookService.name);

  async processWebhook(payload: SumsubWebhookPayload) {
    this.logger.log('SumsubWebhookService.processWebhook', payload);
    this.logger.log(`Processing Webhook for user ${payload.externalUserId}`, 'SumsubWebhookService.processWebhook');

    const isTierOneLastLevel = payload.levelName?.toLowerCase() === this.getTierOneWorkflowLastLevel()?.toLowerCase();

    switch (payload.type) {
      case 'applicantCreated':
        this.logger.log(`${payload.applicantId} applicantCreated`, 'SumsubWebhookService');

        this.logger.log('SumsubWebhookService.processWebhook', 'applicantCreated');
        await this.handleApplicantCreated(payload);
        break;
      case 'applicantPending':
        this.logger.log(`${payload.applicantId} applicantPending`, 'SumsubWebhookService');
        await this.handleApplicantPending(payload);
        break;
      case 'applicantOnHold':
        this.logger.log(`${payload.applicantId} applicantOnHold`, 'SumsubWebhookService');
        await this.handleKycOnHold(payload);
        break;
      case 'applicantReset':
        this.logger.log(`${payload.applicantId} applicantReset`, 'SumsubWebhookService');
        await this.handleApplicantReset(payload);
        break;
      case 'applicantReviewed': {
        const isRed = payload.reviewResult?.reviewAnswer?.toLowerCase() === 'red';
        const isGreen = payload.reviewResult?.reviewAnswer?.toLowerCase() === 'green';
        const lockKey = `applicantReviewed:${payload.externalUserId}`;
        const isResubmissionRequired =
          payload?.reviewStatus?.toLowerCase() === 'completed' &&
          payload?.reviewResult?.reviewRejectType?.toLowerCase() === 'retry' &&
          isRed;

        await this.lockerService.runWithLock(lockKey, async () => {
          this.logger.log(`${payload.applicantId} applicantReviewed`, 'SumsubWebhookService');
          if (isRed) {
            if (isResubmissionRequired) {
              await this.handleResubmissionRequired(payload);
            } else {
              await this.handleKycFailure(payload);
            }
          } else if (isTierOneLastLevel && isGreen) {
            // user has completed tier one verification flows, we need to handle the success and failure cases
            await this.handleKycSuccessAndCreateWallets(payload);
          }
        });
        break;
      }
      case 'applicantKytTxnApproved':
        Logger.log(`${payload.applicantId} applicantKytTxnApproved`, 'SumsubWebhookService');
        await this.handleKytTxnApproved(payload);
        break;
      case 'applicantKytTxnRejected':
        Logger.log(`${payload.applicantId} applicantKytTxnRejected`, 'SumsubWebhookService');
        await this.handleKytTxnRejected(payload);
        break;
      case 'applicantKytOnHold':
        Logger.log(`${payload.applicantId} applicantKytOnHold`, 'SumsubWebhookService');
        await this.handleKytOnHold(payload);
        break;
    }
  }

  private async handleKytTxnApproved(payload: SumsubWebhookPayload) {
    const kytPayload = payload as any;
    this.logger.log(`Transaction monitoring approved for kytDataTxnId: ${kytPayload.kytDataTxnId}`);

    // Only process finance transactions (deposits)
    if (kytPayload.kytTxnType !== 'finance') {
      this.logger.log(`Skipping non-finance transaction type: ${kytPayload.kytTxnType}`);
      return;
    }

    try {
      await this.externalAccountService.continueDepositFromWebhook(kytPayload.kytDataTxnId);
      this.logger.log(`Successfully continued deposit for transaction: ${kytPayload.kytDataTxnId}`);
    } catch (error) {
      this.logger.error(`Failed to continue deposit for transaction ${kytPayload.kytDataTxnId}:`, error);
    }
  }

  private async handleKytTxnRejected(payload: SumsubWebhookPayload) {
    const kytPayload = payload as any;
    this.logger.log(`Transaction monitoring rejected for kytDataTxnId: ${kytPayload.kytDataTxnId}`);

    // Only process finance transactions (deposits)
    if (kytPayload.kytTxnType !== 'finance') {
      this.logger.log(`Skipping non-finance transaction type: ${kytPayload.kytTxnType}`);
      return;
    }

    try {
      const rejectionReason = kytPayload.reviewResult?.reviewRejectType || 'Transaction monitoring rejection';
      await this.externalAccountService.failDepositFromWebhook(kytPayload.kytDataTxnId, rejectionReason);
      this.logger.log(`Successfully failed deposit for transaction: ${kytPayload.kytDataTxnId}`);
    } catch (error) {
      this.logger.error(`Failed to reject deposit for transaction ${kytPayload.kytDataTxnId}:`, error);
    }
  }

  private async handleKytOnHold(payload: SumsubWebhookPayload) {
    const kytPayload = payload as any;
    this.logger.log(`Transaction monitoring put on hold for kytDataTxnId: ${kytPayload.kytDataTxnId}`);

    // Only process finance transactions (deposits)
    if (kytPayload.kytTxnType !== 'finance') {
      this.logger.log(`Skipping non-finance transaction type: ${kytPayload.kytTxnType}`);
      return;
    }

    try {
      await this.externalAccountService.holdDepositFromWebhook(kytPayload.kytDataTxnId);
      this.logger.log(`Successfully put deposit on hold for transaction: ${kytPayload.kytDataTxnId}`);
    } catch (error) {
      this.logger.error(`Failed to put deposit on hold for transaction ${kytPayload.kytDataTxnId}:`, error);
    }
  }

  private async handleKycSuccessAndCreateWallets(payload: SumsubWebhookPayload) {
    try {
      this.logger.log('handleKycSuccessAndCreateWallets', 'SumsubWebhookService');
      this.logger.log('Handling KYC success and creating wallets for user', payload.externalUserId);
      const kycDetailsPayload: GetKycDetailsPayload = {
        applicantId: payload.applicantId,
      };
      const kycDetails: KycBaseResponse<GetKycDetailsResponse> = await this.kycAdapter.getKycDetails(kycDetailsPayload);

      // OPTIMIZATION: Get user once and reuse throughout the flow
      const user = (await this.updateUserDetails(kycDetails.data)) as UserModel;

      // update the US user kyc details
      await this.updateKycAndKycLog(kycDetails.data, payload.levelName, KycVerificationEnum.APPROVED);

      // create the user tier record
      await this.createUserTier(user.id, payload.levelName as SumSubVerificationType);

      try {
        // TODO: add this to a job queue
        await this.blockchainWalletService.createInternalBlockchainAccount(user, 'crypto');
      } catch (error) {
        // if there is an error do nothing
        this.logger.error(error?.message);
        this.logger.error(error?.stack);
      }

      await this.ensureUSDFiatWallet(user.id);

      await Promise.allSettled([
        this.createNGNProviderWalletInJobQueue(payload.applicantId, kycDetails.data, user),
        this.createUSDProviderWalletInJobQueue(payload.applicantId, kycDetails.data, user),
      ]);

      await this.mailerService.send(new KycSuccessMail(user));

      await this.inAppNotificationService.createNotification({
        user_id: user.id,
        type: IN_APP_NOTIFICATION_TYPE.KYC_SUCCESS,
        title: 'KYC Verification Successful',
        message: 'Your identity verification has been approved. You can now access all features.',
        metadata: { levelName: payload.levelName },
      });
    } catch (error) {
      this.logger.error(error?.message);
      throw new InternalServerErrorException(error?.message);
    }
  }

  private async handleApplicantCreated(payload: SumsubWebhookPayload) {
    this.logger.log('handleApplicantCreated', 'SumsubWebhookService');
    this.logger.log('Handling applicant created for user', payload.externalUserId);

    const kycVerifications = await this.getKycVerificationsByLevelName(payload.externalUserId, payload.levelName);

    for (const kyc of kycVerifications) {
      await this.kycVerificationRepository.transaction(async (trx) => {
        await this.kycVerificationService.updateKycStatus(
          kyc.id,
          {
            status: KycVerificationEnum.PENDING,
            provider_ref: payload.applicantId,
          },
          trx,
        );
        await this.kycStatusLogService.logStatusChange(kyc.id, kyc.status, KycVerificationEnum.PENDING, null, trx);
      });
    }
  }

  private async handleApplicantReset(payload: SumsubWebhookPayload) {
    this.logger.log('handleApplicantReset', 'SumsubWebhookService');
    this.logger.log('Handling applicant reset for user', payload.externalUserId);

    const kycVerifications = await this.getKycVerificationsByLevelName(payload.externalUserId, payload.levelName);

    // get the kyc details from the user
    for (const kyc of kycVerifications) {
      await this.kycVerificationRepository.transaction(async (trx) => {
        await this.kycVerificationService.updateKycStatus(
          kyc.id,
          {
            status: KycVerificationEnum.RESTARTED,
            provider_ref: payload.applicantId,
          },
          trx,
        );
        await this.kycStatusLogService.logStatusChange(kyc.id, kyc.status, KycVerificationEnum.RESTARTED, null, trx);
      });
    }
  }

  private async handleApplicantPending(payload: SumsubWebhookPayload) {
    this.logger.log('handleApplicantPending', 'SumsubWebhookService');
    this.logger.log('Handling applicant pending for user', payload.externalUserId);

    const kycVerifications = await this.getKycVerificationsByLevelName(payload.externalUserId, payload.levelName);

    for (const kyc of kycVerifications) {
      if (payload.levelName?.toLowerCase() === SumSubVerificationType.LIVENESS_ONLY.toLowerCase()) {
        await this.kycVerificationRepository.transaction(async (trx) => {
          await this.kycVerificationService.updateKycStatus(
            kyc.id,
            {
              status: KycVerificationEnum.SUBMITTED,
              provider_ref: payload.applicantId,
            },
            trx,
          );
          await this.kycStatusLogService.logStatusChange(kyc.id, kyc.status, KycVerificationEnum.SUBMITTED, null, trx);
        });
      } else {
        await this.kycVerificationRepository.transaction(async (trx) => {
          await this.kycVerificationService.updateKycStatus(
            kyc.id,
            {
              status: KycVerificationEnum.PENDING,
              provider_ref: payload.applicantId,
            },
            trx,
          );
          await this.kycStatusLogService.logStatusChange(kyc.id, kyc.status, KycVerificationEnum.PENDING, null, trx);
        });
      }
    }
  }

  private async handleResubmissionRequired(payload: SumsubWebhookPayload) {
    this.logger.log('handleResubmissionRequired', 'SumsubWebhookService');
    this.logger.log('Handling resubmission required for user', payload.externalUserId);

    const kycDetails = await this.kycAdapter.getKycDetails({ applicantId: payload.applicantId });

    await this.updateKycAndKycLog(kycDetails.data, payload.levelName, KycVerificationEnum.RESUBMISSION_REQUESTED);

    // INTENTIONAL DB CALL: Use our authoritative user data, not potentially mismatched Sumsub data
    const user = await this.userRepository.findById(kycDetails.data.userId);

    const failureReasons = this.parseFailureReasons(kycDetails.data.failureReason);
    const failureCorrections = kycDetails.data.failureCorrection
      ? this.parseFailureReasons(kycDetails.data.failureCorrection)
      : [];

    // Send KYC failure notification
    await this.inAppNotificationService.createNotification({
      user_id: user.id,
      type: IN_APP_NOTIFICATION_TYPE.KYC_FAILED,
      title: 'KYC Verification Failed',
      message: `Your identity verification was not approved. Reason: ${kycDetails.data.failureReason}, Check your email for more details.`,
      metadata: { levelName: payload.levelName, failureReason: kycDetails.data.failureReason },
    });

    await this.mailerService.send(
      new KycRejectedMail(user, failureReasons, failureCorrections, 'KYC Verification - Resubmission Required'),
    );
  }

  private async updateKycAndKycLog(data: GetKycDetailsResponse, verificationType: string, status: KycVerificationEnum) {
    this.logger.log('updateKycAndKycLog', 'SumsubWebhookService');
    this.logger.log('Updating KYC and KYC log for user', data.userId);

    // Get all verification records for this user and level
    const kycVerifications = await this.getKycVerificationsByLevelName(data.userId, verificationType);

    if (kycVerifications.length === 0) {
      this.logger.warn(`No KYC verifications found for user ${data.userId} and level ${verificationType}`);
      return;
    }

    const tierConfigs = Array.from(
      new Map(kycVerifications.map((kyc) => [kyc.tierConfig.id, kyc.tierConfig])).values(),
    );

    const identityValue = data?.idDocument?.number
      ? await UtilsService.hashPassword(data?.idNumber ?? data.idDocument.number)
      : null;

    const metadata: Record<string, any> = {
      ...data?.address,
      identity_type: data?.idDocument?.type,
      identity_value: identityValue,
    };

    if (status?.toLowerCase() === KycVerificationEnum.RESUBMISSION_REQUESTED.toLowerCase()) {
      metadata.failure_correction = data?.failureCorrection;
    }

    // Process verification requirements for each unique tier config
    for (const tierConfig of tierConfigs) {
      if (!tierConfig?.tierConfigVerificationRequirements) {
        this.logger.warn(`No verification requirements found for tier config ${tierConfig.id}`);
        continue;
      }

      await this.processVerificationRequirements(tierConfig, data, verificationType, status, metadata);
    }
  }

  private async processVerificationRequirements(
    tierConfig: TierConfigModel,
    data: GetKycDetailsResponse,
    verificationType: string,
    status: KycVerificationEnum,
    metadata: any,
  ) {
    // Process each verification requirement
    for (const verificationReq of tierConfig.tierConfigVerificationRequirements) {
      await this.kycVerificationRepository.transaction(async (trx) => {
        // Check if kyc_verification record exists for this requirement
        let kycRecord = (await this.kycVerificationRepository.query(trx).findOne({
          user_id: data.userId,
          tier_config_verification_requirement_id: verificationReq.id,
        })) as KycVerificationModel | undefined;

        // If record exists, update it
        if (kycRecord) {
          this.logger.log(
            `Updating KYC verification record for user ${data.userId} and requirement ${verificationReq.id}`,
          );

          await this.kycVerificationService.updateKycStatus(
            kycRecord.id,
            {
              attempt: kycRecord.attempt + 1,
              error_message: data?.failureReason,
              metadata,
              provider_ref: data?.id,
              provider_status: data?.status,
              reviewed_at: data?.reviewedAt,
              status: status,
              submitted_at: DateTime.fromFormat(data.submittedAt, 'YYYY-MM-DD').toSQL(),
            },
            trx,
          );

          await this.kycStatusLogService.logStatusChange(
            kycRecord.id,
            kycRecord.status,
            status,
            data?.errorMessage,
            trx,
          );
        } else {
          // Record doesn't exist, create it
          this.logger.log(
            `Creating KYC verification record for user ${data.userId} and requirement ${verificationReq.id}`,
          );

          kycRecord = await this.kycVerificationRepository.create(
            {
              user_id: data.userId,
              provider: 'sumsub',
              status: status,
              provider_verification_type: verificationType,
              attempt: 1,
              tier_config_id: tierConfig.id,
              tier_config_verification_requirement_id: verificationReq.id,
              provider_ref: data?.id,
              metadata,
              provider_status: data?.status,
              reviewed_at: data?.reviewedAt,
              submitted_at: DateTime.fromFormat(data.submittedAt, 'YYYY-MM-DD').toSQL(),
              error_message: data?.failureReason,
            },
            trx,
          );

          await this.kycStatusLogService.logStatusChange(
            kycRecord.id,
            KycVerificationEnum.NOT_STARTED,
            status,
            data?.errorMessage,
            trx,
          );
        }

        // Create user_tier record if verification is approved
        if (status === KycVerificationEnum.APPROVED) {
          await this.kycVerificationService.ensureUserTierRecord(kycRecord);
        }
      });
    }
  }

  /**
   * KYC FAILURE HANDLING
   *
   * Note: Database call here is intentional and NOT redundant
   * We need actual user data from our DB (not Sumsub data) because:
   * - KYC might have failed due to data mismatch
   * - We want to email the real registered user
   * - Failure email should use authoritative user data
   */
  private async handleKycFailure(payload: SumsubWebhookPayload) {
    this.logger.log('handleKycFailure', 'SumsubWebhookService');
    this.logger.log('Handling KYC failure for user', payload.externalUserId);
    const kycDetailsPayload: GetKycDetailsPayload = {
      applicantId: payload.applicantId,
    };
    const kycDetails: KycBaseResponse<GetKycDetailsResponse> = await this.kycAdapter.getKycDetails(kycDetailsPayload);

    await this.updateKycAndKycLog(kycDetails.data, payload.levelName, KycVerificationEnum.REJECTED);

    // INTENTIONAL DB CALL: Use our authoritative user data, not potentially mismatched Sumsub data
    const user = await this.userRepository.findById(kycDetails.data.userId);

    const failureReason =
      kycDetails.data.failureReason || 'Unable to verify your identity. Please try again or contact support.';
    const failureReasons = this.parseFailureReasons(failureReason);

    await this.inAppNotificationService.createNotification({
      user_id: user.id,
      type: IN_APP_NOTIFICATION_TYPE.KYC_FAILED,
      title: 'KYC Verification Failed',
      message: `Your identity verification was not approved. Reason: ${failureReason}`,
      metadata: { levelName: payload.levelName, failureReason },
    });

    await this.mailerService.send(new KycRejectedMail(user, failureReasons));
  }

  private async handleKycOnHold(payload: SumsubWebhookPayload) {
    this.logger.log('handleKycOnHold', 'SumsubWebhookService');
    this.logger.log('Handling KYC on hold for user', payload.externalUserId);

    const kycVerifications = await this.getKycVerificationsByLevelName(payload.externalUserId, payload.levelName);

    for (const kyc of kycVerifications) {
      await this.kycVerificationRepository.transaction(async (trx) => {
        await this.kycVerificationService.updateKycStatus(
          kyc.id,
          {
            status: KycVerificationEnum.IN_REVIEW,
            provider_ref: payload.applicantId,
          },
          trx,
        );
        await this.kycStatusLogService.logStatusChange(kyc.id, kyc.status, KycVerificationEnum.IN_REVIEW, null, trx);
      });
    }

    const user = await this.userRepository.findById(payload.externalUserId);
    if (user) {
      await this.mailerService.send(new KycUnderReviewMail(user));

      await this.inAppNotificationService.createNotification({
        user_id: user.id,
        type: IN_APP_NOTIFICATION_TYPE.KYC_IN_REVIEW,
        title: 'KYC Verification in Progress',
        message:
          "We've received your verification details. Our compliance team is reviewing your submission — you'll be notified once it's approved.",
        metadata: { levelName: payload.levelName },
      });
    }
  }

  /**
   * ENHANCED FIAT WALLET & VIRTUAL ACCOUNT CREATION
   *
   * Major improvements:
   * 1. Multi-currency support (USD for US users, USD + NGN for NG users)
   * 2. Creates appropriate fiat wallets based on user country
   * 3. Optimized: Receives user object to avoid redundant DB call
   * 4. Passes fiat wallet to child methods to avoid re-fetching
   */
  private async handleCreateNGNBankAccount(data: GetKycDetailsResponse, user: any) {
    this.logger.log('handleCreateNGNBankAccount', 'SumsubWebhookService');
    this.logger.log('Creating fiat wallets and virtual accounts for user', data.userId);

    const isNgUser = data.country?.toUpperCase() === 'NGA';

    // Create NGN wallet within a transaction to prevent duplicates
    const ngnWallet = await this.userRepository.transaction(async (trx) => {
      return await this.fiatWalletService.getUserWallet(data.userId, 'NGN', trx);
    });

    if (!ngnWallet) {
      throw new InternalServerErrorException(`Failed to create/get NGN fiat wallet for user ${data.userId}`);
    }
    this.logger.log(`Created/got NGN fiat wallet with ID: ${ngnWallet.id} for user ${data.userId}`);

    // NG-specific virtual account creation with BVN (uses NGN wallet)

    const payload: {
      bvn?: string;
      dob: string;
      fiatWallet: any;
    } = {
      dob: data.dob,
      fiatWallet: ngnWallet,
    };

    if (isNgUser && data.idNumber) {
      payload.bvn = data.idNumber;
    }

    // OPTIMIZED: Pass user object and NGN fiat wallet to avoid DB calls
    await this.createNGVirtualAccount(user, payload);
  }

  private async ensureUSDFiatWallet(userId: any) {
    // Create USD wallet for all users (US and NG) within a transaction to prevent duplicates
    const usdWallet = await this.userRepository.transaction(async (trx) => {
      return await this.fiatWalletService.getUserWallet(userId, 'USD', trx);
    });

    if (!usdWallet) {
      throw new InternalServerErrorException(`Failed to create/get USD fiat wallet for user ${userId}`);
    }

    this.logger.log(`Created USD fiat wallet with ID: ${usdWallet.id} for user ${userId}`);
  }

  private async createUSDProviderWalletInJobQueue(applicantId: string, data: GetKycDetailsResponse, user: UserModel) {
    this.logger.log('createWalletsInAJobQueue', 'SumsubWebhookService');
    this.logger.log('Creating wallets in a job queue for user', data.userId);

    // Create external provider participant with complete onboarding (includes document processing, upload, updates)
    // i want this to retry after 10 seconds, 20 seconds, 30 seconds
    // const jobName = `createUSAWalletsAndExternalAccount:${data.userId}:${applicantId}`;

    // this.queueService.processJobs(
    //   'webhooks',
    //   jobName,
    //   async () => {
    //   },
    //   1,
    // );

    // this is to temporarily remove the job queue and run the function directly to debug ZH issues
    await this.createUSAWalletsAndExternalAccount(applicantId, user, data);

    // await this.queueService.addJob('webhooks', jobName, applicantId, {
    //   attempts: 3,
    //   backoff: {
    //     type: 'exponential',
    //     delay: 4000,
    //   },
    // });
  }

  private async createNGNProviderWalletInJobQueue(_applicantId: string, data: GetKycDetailsResponse, user: UserModel) {
    this.logger.log('createNGNProviderWalletInJobQueue', 'SumsubWebhookService');
    this.logger.log('Creating NG wallets in a job queue for user', data.userId);

    await this.handleCreateNGNBankAccount(data, user);
  }

  private async updateUserDetails(data: GetKycDetailsResponse) {
    this.logger.log('updateUserDetails', 'SumsubWebhookService');
    this.logger.log('Updating user details for user', data.userId);
    let user: UserModel;

    try {
      user = (await this.userRepository.findById(data.userId, 'country')) as UserModel;
    } catch (error) {
      this.logger.error(error, 'SumsubWebhookService');
      throw new InternalServerErrorException(`User to perform KYC not found: ${data.userId}`);
    }

    try {
      const address = data?.address;

      if (!user) {
        throw new InternalServerErrorException('User not found');
      }
      //we should verify the first and last name match up with what they entered when they registered
      const details = {
        phone_number: data.phone,
      };

      if (user.phone_number) {
        delete details.phone_number;
      }

      await this.userRepository.transaction(async (trx) => {
        await this.userRepository.update(user.id, details, { trx });

        // if it's on production, we update the user first names, last name and middle name
        //  (So as to avoid data mismatch)
        if (EnvironmentService.isProduction()) {
          await this.userRepository.update(
            user.id,
            {
              first_name: data.firstName,
              last_name: data.lastName,
              middle_name: data.middleName,
            },
            { trx },
          );
        }

        const userProfile = await this.userProfileRepository.findByUserId(user.id);

        const userProfileData = {
          dob: DateTime.fromFormat(data.dob, 'yyyy-MM-dd').toSQL(),
          address_line1: address?.address,
          address_line2: address?.address2,
          city: address?.city,
          postal_code: address?.postalCode,
          state_or_province: address?.state,
        };

        if (userProfile) {
          await this.userProfileRepository.update({ user_id: user.id }, userProfileData, { trx });
        } else {
          await this.userProfileRepository.create(
            {
              user_id: user.id,
              ...userProfileData,
            },
            trx,
          );
        }
      });

      return user;
    } catch (error) {
      // Handle duplicate phone number error specifically
      if (error instanceof UniqueViolationError && error.columns?.includes('phone_number')) {
        this.logger.error(
          `Duplicate phone number detected for user ${data.userId}: ${data.phone}`,
          'SumsubWebhookService',
        );

        // Reject all KYC verifications for this user due to duplicate phone number
        await this.rejectKycVerificationsForUser(data.userId, 'duplicate phone number');

        // Throw specific error that will be caught by parent handler
        throw new InternalServerErrorException('Duplicate phone number detected');
      }

      this.logger.error(error, 'SumsubWebhookService');
      throw new InternalServerErrorException('Something went wrong while updating user profile');
    }
  }

  private async rejectKycVerificationsForUser(userId: string, errorMessage: string): Promise<void> {
    this.logger.log('rejectKycVerificationsForUser', 'SumsubWebhookService');

    const kycVerifications = (await this.kycVerificationRepository
      .query()
      .where({ user_id: userId })
      .whereNotIn('status', [KycVerificationEnum.APPROVED, KycVerificationEnum.REJECTED])) as KycVerificationModel[];

    for (const kyc of kycVerifications) {
      await this.kycVerificationRepository.transaction(async (trx) => {
        await this.kycVerificationService.updateKycStatus(
          kyc.id,
          {
            status: KycVerificationEnum.REJECTED,
            error_message: errorMessage,
          },
          trx,
        );
        await this.kycStatusLogService.logStatusChange(
          kyc.id,
          kyc.status,
          KycVerificationEnum.REJECTED,
          errorMessage,
          trx,
        );
      });
    }
  }

  /**
   * OPTIMIZED NG VIRTUAL ACCOUNT CREATION
   *
   * Improvements:
   * 1. Receives user object (no DB call needed)
   * 2. Receives fiat wallet (no re-fetching needed)
   * 3. Uses BVN from Sumsub for virtual account creation
   * 4. Proper validation and error handling
   */
  private async createNGVirtualAccount(
    user: UserModel,
    data: { bvn?: string; dob: string; fiatWallet: FiatWalletModel },
  ) {
    this.logger.log('createNGVirtualAccount', 'SumsubWebhookService');

    // Add proper validation
    if (!user) {
      throw new InternalServerErrorException('User is required for virtual account creation');
    }

    if (!data.fiatWallet) {
      throw new InternalServerErrorException('Fiat wallet is required for virtual account creation');
    }

    this.logger.log('Creating NG virtual account for user', user.id);
    try {
      const payload: CreateVirtualAccountDto = {
        fiat_wallet_id: data.fiatWallet.id,
      };

      if (data.bvn) {
        payload.bvn = data.bvn;
      }

      // Create virtual account within a transaction to prevent duplicates
      const virtualAccount = await this.userRepository.transaction(async (trx) => {
        return await this.virtualAccountService.findOrCreateVirtualAccount(
          user.id,
          payload,
          VirtualAccountType.MAIN_ACCOUNT,
          trx,
        );
      });

      this.logger.log(`Created NG virtual account with ID: ${virtualAccount.id} for user ${user.id}`);
      return virtualAccount;
    } catch (error) {
      this.logger.error(error, 'SumsubWebhookService');
      throw new InternalServerErrorException('Error Went Wrong while Creating a virtual account');
    }
  }

  private async createUSAWalletsAndExternalAccount(
    applicantId: string,
    user: UserModel,
    kycDetails: GetKycDetailsResponse,
  ) {
    this.logger.log('createUSAccounts', 'SumsubWebhookService');
    this.logger.log('Creating US accounts for user', kycDetails.userId);

    // get the participant code from the user

    await this.participantService.createParticipant(kycDetails, user, applicantId);

    // create the external account
  }

  private async createUserTier(userId: string, levelName: SumSubVerificationType) {
    this.logger.log('createUserTier', 'SumsubWebhookService');
    this.logger.log('Creating user tier for user', userId);
    try {
      const kycVerifications = await this.getKycVerificationsByLevelName(userId, levelName);

      if (kycVerifications.length === 0) {
        return;
      }

      const tierConfigs = Array.from(
        new Map(kycVerifications.map((kyc) => [kyc.tierConfig.id, kyc.tierConfig])).values(),
      );

      for (const tierConfig of tierConfigs) {
        const tier = tierConfig?.tier;

        if (!tier) {
          throw new InternalServerErrorException('Tier not found');
        }

        const userTier = await this.userTierService.findOrCreate(userId, tier.id);

        // Credit onboarding bonus points only for tier1
        if (tier.level === 1) {
          try {
            await this.doshPointsTransactionService.creditPoints({
              user_id: userId,
              event_code: 'ONBOARDING_BONUS',
              source_reference: userTier.id,
            });
          } catch (error) {
            // Log but don't fail the KYC flow if points credit fails
            this.logger.error(`Failed to credit onboarding points for user ${userId}: ${error.message}`);
          }
        }
      }
    } catch (error) {
      this.logger.error(error, 'SumsubWebhookService');
      throw new InternalServerErrorException('Error while creating user tier');
    }
  }

  private async getKycVerificationsByLevelName(userId: string, levelName: string) {
    this.logger.log('getKycVerificationsByLevelName', 'SumsubWebhookService');
    this.logger.log('Getting KYC verifications by level name', levelName);
    const workFlowName = OneDoshConfiguration.getSumsubKycLevelWorkflows().find((kycLevel) =>
      kycLevel.workflows?.find((workflow) => workflow?.toLowerCase() === levelName?.toLowerCase()),
    );

    if (!workFlowName) {
      return [];
    }

    const kycVerifications = await this.kycVerificationRepository
      .query()
      .where({ user_id: userId })
      .where('provider_verification_type', workFlowName.level)
      .withGraphFetched('tierConfig.[tier, tierConfigVerificationRequirements.verificationRequirement]');

    return (kycVerifications ?? []) as KycVerificationModel[];
  }

  private getTierOneWorkflowLastLevel(): SumSubVerificationType | null {
    const workflows = OneDoshConfiguration.getSumsubKycLevelWorkflows();
    if (!workflows || workflows.length === 0) {
      return null;
    }

    const firstWorkflow = workflows[0];
    if (!firstWorkflow.workflows || firstWorkflow.workflows.length === 0) {
      return null;
    }

    const lastLevel = firstWorkflow.workflows[firstWorkflow.workflows.length - 1];

    return lastLevel;
  }

  /**
   * Parse failure reasons/corrections from Sumsub format
   * Handles newline-separated items with bullet points
   */
  private parseFailureReasons(text: string): string[] {
    if (!text) {
      return [];
    }

    // Split by newlines and clean up each item
    const items = text
      .split('\n')
      .map((item) => item.trim())
      .filter((item) => item.length > 0)
      .map((item) => {
        // Remove leading bullet points and dashes
        return item.replace(/^[-•]\s*/, '').trim();
      })
      .filter((item) => item.length > 0);

    return items;
  }
}
