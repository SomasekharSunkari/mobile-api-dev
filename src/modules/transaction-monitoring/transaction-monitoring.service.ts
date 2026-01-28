import { Inject, Injectable, Logger } from '@nestjs/common';
import { TransactionMonitoringAdapter } from '../../adapters/transaction-monitoring/transaction-monitoring-adapter';
import {
  TransactionDirection,
  TransactionType,
} from '../../adapters/transaction-monitoring/transaction-monitoring-adapter.interface';
import { CurrencyUtility } from '../../currencies/currencies';
import { UtilsService } from '../../utils/utils.service';
import { KycVerificationService } from '../auth/kycVerification/kycVerification.service';
import { LoginDeviceService } from '../auth/loginDevice/loginDevice.service';
import { LoginEventService } from '../auth/loginEvent/loginEvent.service';
import { UserService } from '../auth/user/user.service';
import { UserProfileService } from '../auth/userProfile/userProfile.service';
import { ExternalAccountRepository } from '../externalAccount/external-account.repository';
import { FiatWalletTransactionService } from '../fiatWalletTransactions/fiatWalletTransactions.service';
import { MonitorDepositRequest, MonitorDepositResponse } from './transaction-monitoring.interface';

@Injectable()
export class TransactionMonitoringService {
  private readonly logger = new Logger(TransactionMonitoringService.name);

  @Inject(TransactionMonitoringAdapter)
  private readonly transactionMonitoringAdapter: TransactionMonitoringAdapter;

  @Inject(UserService)
  private readonly userService: UserService;

  @Inject(UserProfileService)
  private readonly userProfileService: UserProfileService;

  @Inject(LoginEventService)
  private readonly loginEventService: LoginEventService;

  @Inject(LoginDeviceService)
  private readonly loginDeviceService: LoginDeviceService;

  @Inject(KycVerificationService)
  private readonly kycVerificationService: KycVerificationService;

  @Inject(FiatWalletTransactionService)
  private readonly fiatWalletTransactionService: FiatWalletTransactionService;

  @Inject(ExternalAccountRepository)
  private readonly externalAccountRepository: ExternalAccountRepository;

  /**
   * Monitor a deposit transaction using fiat wallet transaction ID
   * This method gathers all required data from the fiat wallet transaction and user details
   */
  async monitorDeposit(request: MonitorDepositRequest): Promise<MonitorDepositResponse> {
    this.logger.log(
      `Monitoring fiat wallet transaction ${request.fiatWalletTransactionId} for external account funding`,
    );

    try {
      // Step 1: Get fiat wallet transaction
      const fiatWalletTransaction = await this.fiatWalletTransactionService.findById(request.fiatWalletTransactionId);

      if (!fiatWalletTransaction) {
        throw new Error(`No fiat wallet transaction found for ID ${request.fiatWalletTransactionId}`);
      }

      const userId = fiatWalletTransaction.user_id;
      const amount = CurrencyUtility.formatCurrencyAmountToMainUnit(
        Number(fiatWalletTransaction.amount),
        fiatWalletTransaction.currency,
      );
      const currency = fiatWalletTransaction.currency;

      // Step 2: Get user details
      const user = await this.userService.findByUserId(userId);
      const userProfile = await this.userProfileService.findByUserId(userId);

      // Step 3: Get KYC verification for Sumsub applicant ID
      const kycVerification = await this.kycVerificationService.findByUserId(userId);

      // Step 4: Get device information
      const loginDevice = await this.loginDeviceService.getLastLoginDevice(userId);
      const loginEvent = await this.loginEventService.getLastLoginEvent(userId);

      // Step 5: Build transaction payload in Sumsub format
      const transactionDate =
        new Date(fiatWalletTransaction.created_at).toISOString().replace('T', ' ').slice(0, 19) + '+0000';
      const timeZone = 'UTC';

      // Step 6: Get external account for payment method and institution info
      const externalAccount = await this.externalAccountRepository.findOne({ user_id: userId });

      // Step 7: Submit to Sumsub for monitoring
      this.logger.log(`Submitting fiat wallet transaction ${request.fiatWalletTransactionId} to Sumsub for monitoring`);
      const response = await this.transactionMonitoringAdapter.submitTransaction({
        applicantId: kycVerification.provider_ref,
        transactionId: request.fiatWalletTransactionId,
        transactionDate,
        timeZone,
        transactionType: TransactionType.FINANCE,
        direction: TransactionDirection.IN,
        amount,
        currency,
        description: fiatWalletTransaction.description,
        participant: {
          type: 'individual',
          externalUserId: userId,
          fullName: `${user.first_name} ${user.last_name}`,
          dateOfBirth: new Date(userProfile.dob).toISOString().split('T')[0],
          address: {
            countryCode: UtilsService.convertTo3LetterCountryCode(user.country?.code),
            postal: userProfile.postal_code,
            city: userProfile.city,
            state: userProfile.state_or_province,
            addressLine1: userProfile.address_line1,
            addressLine2: userProfile.address_line2,
          },
        },
        counterparty: {
          type: 'individual',
          externalUserId: userId,
          fullName: `${user.first_name} ${user.last_name}`,
          dateOfBirth: new Date(userProfile.dob).toISOString().split('T')[0],
          address: {
            countryCode: UtilsService.convertTo3LetterCountryCode(user.country?.code),
            postal: userProfile.postal_code,
            city: userProfile.city,
            state: userProfile.state_or_province,
            addressLine1: userProfile.address_line1,
            addressLine2: userProfile.address_line2,
          },
          bankAccount: externalAccount?.account_number
            ? {
                accountType: 'account',
                accountNumber: externalAccount.account_number,
                countryCode: user.country?.code
                  ? UtilsService.convertTo3LetterCountryCode(user.country.code)
                  : undefined,
              }
            : undefined,
          bankInfo: externalAccount?.bank_name
            ? {
                bankName: externalAccount.bank_name,
              }
            : undefined,
        },
        device: {
          deviceFingerprint: loginDevice?.device_fingerprint,
          ipInfo: {
            ipAddress: loginEvent?.ip_address,
          },
        },
      });

      // Step 7: Process response
      const reviewStatus = response.data?.review?.reviewStatus;
      const reviewAnswer = response.data?.review?.reviewResult?.reviewAnswer;

      if (reviewStatus === 'onHold') {
        // Get holding reasons from failed rules
        const holdingRules = response.data?.scoringResult?.failedRules;
        const holdingReasons = holdingRules?.map((rule: { title: string }) => rule.title).filter(Boolean) || [];
        const failureReason =
          holdingReasons.length > 0 ? holdingReasons.join('; ') : 'Transaction monitoring review required';

        this.logger.warn(`Fiat wallet transaction ${request.fiatWalletTransactionId} placed on hold: ${failureReason}`);
        return { reviewStatus, failureReason };
      }

      if (reviewAnswer === 'GREEN') {
        this.logger.log(`Fiat wallet transaction ${request.fiatWalletTransactionId} approved by monitoring`);
        return { reviewAnswer: 'GREEN', reviewStatus };
      }

      // Default case - log response for debugging
      this.logger.warn(
        `Unexpected monitoring response for fiat wallet transaction ${request.fiatWalletTransactionId}:`,
        response.data,
      );
      return { reviewStatus, failureReason: 'Unexpected monitoring response' };
    } catch (error) {
      this.logger.error(`Failed to monitor fiat wallet transaction ${request.fiatWalletTransactionId}:`, error);
      throw error;
    }
  }
}
