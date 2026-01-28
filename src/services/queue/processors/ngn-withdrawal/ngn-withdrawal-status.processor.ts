import { Inject, Injectable, Logger, forwardRef } from '@nestjs/common';
import { DateTime } from 'luxon';
import { WaasAdapter } from '../../../../adapters/waas/waas.adapter';
import { WaasTransactionStatus } from '../../../../adapters/waas/waas.adapter.interface';
import { CurrencyUtility, SUPPORTED_CURRENCIES } from '../../../../currencies';
import { PlatformServiceKey } from '../../../../database/models/platformStatus/platformStatus.interface';
import { TransactionStatus } from '../../../../database/models/transaction';
import { UserRepository } from '../../../../modules/auth/user/user.repository';
import { FiatWalletWithdrawalService } from '../../../../modules/fiatWallet/fiatWalletWithdrawal.service';
import { FiatWalletTransactionRepository } from '../../../../modules/fiatWalletTransactions/fiatWalletTransactions.repository';
import { TransactionRepository } from '../../../../modules/transaction/transaction.repository';
import { MoneyTransferSuccessMail } from '../../../../notifications/mails/money_transfer_success_mail';
import { EventEmitterEventsEnum } from '../../../eventEmitter/eventEmitter.interface';
import { EventEmitterService } from '../../../eventEmitter/eventEmitter.service';
import { QueueService } from '../../queue.service';
import { MailerService } from '../mailer/mailer.service';

export interface NgnWithdrawalStatusJobData {
  transactionId: string;
  fiatWalletTransactionId: string;
  userId: string;
  providerReference: string;
  amount: number;
  recipientInfo: string;
  remark?: string;
}

/**
 * Processor for polling pending NGN withdrawal transaction statuses
 * This handles cases where Paga returns PENDING status and we need to
 * periodically check for the final status (COMPLETED or FAILED)
 */
@Injectable()
export class NgnWithdrawalStatusProcessor {
  private readonly logger = new Logger(NgnWithdrawalStatusProcessor.name);
  private readonly queueName = 'ngn-withdrawal-status';
  private readonly jobName = 'poll-status';
  private readonly MAX_CONCURRENT_POLLS = 5;
  private processorsRegistered = false;

  @Inject(QueueService)
  private readonly queueService: QueueService;

  @Inject(WaasAdapter)
  private readonly waasAdapter: WaasAdapter;

  @Inject(TransactionRepository)
  private readonly transactionRepository: TransactionRepository;

  @Inject(FiatWalletTransactionRepository)
  private readonly fiatWalletTransactionRepository: FiatWalletTransactionRepository;

  @Inject(UserRepository)
  private readonly userRepository: UserRepository;

  @Inject(EventEmitterService)
  private readonly eventEmitterService: EventEmitterService;

  @Inject(MailerService)
  private readonly mailerService: MailerService;

  @Inject(forwardRef(() => FiatWalletWithdrawalService))
  private readonly fiatWalletWithdrawalService: FiatWalletWithdrawalService;

  /**
   * Register queue processors (called when first job is queued)
   */
  private registerProcessors() {
    if (this.processorsRegistered) return;

    this.queueService.processJobs<NgnWithdrawalStatusJobData>(
      this.queueName,
      this.jobName,
      this.processStatusPoll.bind(this),
      this.MAX_CONCURRENT_POLLS,
    );

    this.processorsRegistered = true;
    this.logger.log('NGN withdrawal status processors registered');
  }

  /**
   * Queue a status poll job for a pending NGN withdrawal
   */
  async queueStatusPoll(data: NgnWithdrawalStatusJobData, attemptNumber = 1) {
    this.registerProcessors();

    // Calculate delay based on attempt number (linear progression)
    // Attempt 1: 1m, Attempt 2: 2m, Attempt 3: 3m, etc.
    const baseDelayMs = 60000; // 1 minute
    const delayMs = baseDelayMs * attemptNumber;
    const maxDelayMs = 1200000; // 20 minutes max
    const finalDelayMs = Math.min(delayMs, maxDelayMs);

    this.logger.log(
      `Queueing status poll for transaction ${data.transactionId}, attempt ${attemptNumber}, delay ${finalDelayMs}ms`,
    );

    return this.queueService.addJob(
      this.queueName,
      this.jobName,
      { ...data, attemptNumber },
      {
        delay: finalDelayMs,
        attempts: 1, // We handle retries manually with exponential backoff
        removeOnComplete: true,
        removeOnFail: false,
      },
    );
  }

  /**
   * Process the status poll job
   */
  private async processStatusPoll({
    data: jobData,
  }: {
    data: NgnWithdrawalStatusJobData & { attemptNumber?: number };
  }) {
    const { transactionId, fiatWalletTransactionId, providerReference, attemptNumber = 1 } = jobData;
    const maxAttempts = 10; // Max polling attempts before giving up

    this.logger.log(`Polling status for transaction ${transactionId}, attempt ${attemptNumber}/${maxAttempts}`);

    try {
      // Fetch current transaction status from DB
      const transaction = await this.transactionRepository.findById(transactionId);

      if (!transaction) {
        this.logger.warn(`Transaction ${transactionId} not found`);
        return;
      }

      // Skip if transaction is no longer pending
      if (transaction.status?.toLowerCase() !== TransactionStatus.PENDING.toLowerCase()) {
        this.logger.log(
          `Transaction ${transactionId} is no longer pending (status: ${transaction.status}), skipping poll`,
        );
        return;
      }

      // Get transaction status from Paga
      const transactionStatus = await this.waasAdapter.getTransactionStatus({
        transactionRef: providerReference,
      });

      this.logger.log(`Provider status for transaction ${transactionId}: ${transactionStatus.status}`);

      // Handle the status
      if (transactionStatus.status === WaasTransactionStatus.SUCCESS) {
        await this.handleCompletedWithdrawal(transaction.id, fiatWalletTransactionId, jobData);
      } else if (transactionStatus.status === WaasTransactionStatus.FAILED) {
        await this.handleFailedWithdrawal(transaction.id, fiatWalletTransactionId, transactionStatus.message);
      } else if (transactionStatus.status === WaasTransactionStatus.PENDING) {
        // Still pending - queue another poll if we haven't exceeded max attempts
        if (attemptNumber < maxAttempts) {
          await this.queueStatusPoll(jobData, attemptNumber + 1);
        } else {
          // Max attempts reached - mark as requiring manual review
          this.logger.warn(
            `Max poll attempts (${maxAttempts}) reached for transaction ${transactionId}. ` +
              `Marking for manual review.`,
          );
          await this.handleMaxAttemptsReached(transaction.id, fiatWalletTransactionId);
        }
      }
    } catch (error) {
      this.logger.error(`Error polling status for transaction ${transactionId}: ${error.message}`, error.stack);

      // Retry on error if under max attempts
      if (attemptNumber < maxAttempts) {
        await this.queueStatusPoll(jobData, attemptNumber + 1);
      }
    }
  }

  /**
   * Handle a completed withdrawal
   */
  private async handleCompletedWithdrawal(
    transactionId: string,
    fiatWalletTransactionId: string,
    jobData: NgnWithdrawalStatusJobData,
  ) {
    this.logger.log(`Withdrawal ${transactionId} completed successfully`);

    // Update transaction status
    await this.transactionRepository.update(transactionId, {
      status: TransactionStatus.COMPLETED,
      completed_at: DateTime.now().toSQL(),
    });

    // Update fiat wallet transaction status
    await this.fiatWalletTransactionRepository.update(fiatWalletTransactionId, {
      status: TransactionStatus.COMPLETED,
      completed_at: DateTime.now().toSQL(),
    });

    // Emit success event
    this.eventEmitterService.emit(EventEmitterEventsEnum.SERVICE_STATUS_SUCCESS, {
      serviceKey: PlatformServiceKey.NGN_TRANSFER_OUT,
    });

    // Send success email
    await this.sendSuccessEmail(jobData);
  }

  /**
   * Handle a failed withdrawal
   */
  private async handleFailedWithdrawal(transactionId: string, fiatWalletTransactionId: string, failureReason: string) {
    this.logger.error(`Withdrawal ${transactionId} failed: ${failureReason}`);

    // Update transaction status
    await this.transactionRepository.update(transactionId, {
      status: TransactionStatus.FAILED,
      failure_reason: failureReason,
      failed_at: DateTime.now().toSQL(),
    });

    // Update fiat wallet transaction status
    await this.fiatWalletTransactionRepository.update(fiatWalletTransactionId, {
      status: TransactionStatus.FAILED,
      failure_reason: failureReason,
      failed_at: DateTime.now().toSQL(),
    });

    // Emit failure event
    this.eventEmitterService.emit(EventEmitterEventsEnum.SERVICE_STATUS_FAILURE, {
      serviceKey: PlatformServiceKey.NGN_TRANSFER_OUT,
      reason: failureReason,
    });

    await this.fiatWalletWithdrawalService.revertWithdrawalBalance(transactionId);
  }

  /**
   * Handle max polling attempts reached - mark for manual review
   */
  private async handleMaxAttemptsReached(transactionId: string, fiatWalletTransactionId: string) {
    const reviewReason = 'Max polling attempts reached - requires manual review';

    // Update transaction to REVIEW status
    await this.transactionRepository.update(transactionId, {
      status: TransactionStatus.REVIEW,
      failure_reason: reviewReason,
    });

    // Update fiat wallet transaction
    await this.fiatWalletTransactionRepository.update(fiatWalletTransactionId, {
      status: TransactionStatus.REVIEW,
      failure_reason: reviewReason,
    });
  }

  /**
   * Send success email to user
   */
  private async sendSuccessEmail(jobData: NgnWithdrawalStatusJobData) {
    try {
      const user = await this.userRepository.findById(jobData.userId);

      if (!user) {
        this.logger.warn(`User ${jobData.userId} not found for success email`);
        return;
      }

      const transaction = await this.transactionRepository.findById(jobData.transactionId);

      const transactionDate = DateTime.now().toFormat('LLL dd, yyyy h:mma');

      this.mailerService.send(
        new MoneyTransferSuccessMail(user, {
          amount: jobData.amount,
          currency: SUPPORTED_CURRENCIES.NGN.code,
          formattedAmount: CurrencyUtility.formatCurrencyAmountToLocaleString(
            jobData.amount,
            SUPPORTED_CURRENCIES.NGN.code,
          ),
          formattedFee: CurrencyUtility.formatCurrencyAmountToLocaleString(0, SUPPORTED_CURRENCIES.NGN.code),
          transactionReference: transaction?.reference || jobData.providerReference,
          transactionDate: transactionDate,
          description: jobData.remark,
          senderName: `${user.first_name} ${user.last_name}`,
          recipientName: jobData.recipientInfo,
          walletName: 'Naira',
        }),
      );

      this.logger.log(`Success email sent for transaction ${jobData.transactionId}`);
    } catch (error) {
      this.logger.error(`Failed to send success email for transaction ${jobData.transactionId}: ${error.message}`);
    }
  }
}
