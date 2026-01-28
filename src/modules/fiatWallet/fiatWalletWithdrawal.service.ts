import {
  BadRequestException,
  Inject,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  forwardRef,
} from '@nestjs/common';
import { DateTime } from 'luxon';
import { add, subtract } from 'mathjs';
import { FiatWalletTransferRequest } from '../../adapters/fiat-wallet/fiat-wallet.adapter.interface';
import { VerifyBankAccountResponse, WaasTransferToSameBankResponse } from '../../adapters/waas/waas.adapter.interface';
import { CurrencyUtility, SUPPORTED_CURRENCIES } from '../../currencies/currencies';
import {
  TransactionCategory,
  TransactionModel,
  TransactionScope,
  TransactionStatus,
  TransactionType,
  UserModel,
} from '../../database';
import { FiatWalletModel } from '../../database/models/fiatWallet/fiatWallet.model';
import { FiatWalletTransactionType } from '../../database/models/fiatWalletTransaction/fiatWalletTransaction.interface';
import { FiatWalletTransactionModel } from '../../database/models/fiatWalletTransaction/fiatWalletTransaction.model';
import { PlatformServiceKey } from '../../database/models/platformStatus/platformStatus.interface';
import { VirtualAccountModel } from '../../database/models/virtualAccount';
import { MoneyTransferSuccessMail } from '../../notifications/mails/money_transfer_success_mail';
import { NgBankTransferSuccessMail } from '../../notifications/mails/ng_bank_transfer_success_mail';
import { NgFundsReceivedMail } from '../../notifications/mails/ngn_funds_received_mail';
import { WithdrawalInitiatedMail } from '../../notifications/mails/withdrawal_initiated_mail';
import { EventEmitterEventsEnum } from '../../services/eventEmitter/eventEmitter.interface';
import { PushNotificationService } from '../../services/pushNotification/pushNotification.service';
import { MailerService } from '../../services/queue/processors/mailer/mailer.service';
import { NgnWithdrawalStatusProcessor } from '../../services/queue/processors/ngn-withdrawal/ngn-withdrawal-status.processor';
import { UtilsService } from '../../utils/utils.service';
import { KycVerificationService } from '../auth/kycVerification/kycVerification.service';
import { UserService } from '../auth/user/user.service';
import { UserProfileService } from '../auth/userProfile/userProfile.service';
import { BankService } from '../bank';
import { ExternalAccountService } from '../externalAccount/external-account.service';
import { FiatWalletTransactionService } from '../fiatWalletTransactions/fiatWalletTransactions.service';
import { InAppNotificationService } from '../inAppNotification/inAppNotification.service';
import { IRecipientTransactionMetadata, ISenderTransactionMetadata } from '../transaction/transaction.interface';
import { TransactionService } from '../transaction/transaction.service';
import { UserTierService } from '../userTier';
import { VirtualAccountRepository } from '../virtualAccount/virtualAccount.repository';
import { CircuitBreakerService } from './circuitBreaker.service';
import { SendMoneyToOneDoshUserDto } from './dto/send-money-to-onedosh-user.dto';
import { TransferFiatWalletDto } from './dto/transfer-fiat-wallet.dto';
import { WithdrawToExternalNGAccountDto } from './dto/withdraw-to-external-ng-account.dto';
import { FiatWalletService } from './fiatWallet.service';
import { FiatWalletEscrowService } from './fiatWalletEscrow.service';
import { WithdrawalCounterService } from './withdrawalCounter.service';
import { WithdrawalSessionService } from './withdrawalSession.service';

/**
 * Service handling all withdrawal and transfer operations for fiat wallets.
 * Extends FiatWalletService to inherit base wallet operations.
 */
@Injectable()
export class FiatWalletWithdrawalService extends FiatWalletService {
  @Inject(UserService)
  private readonly userService: UserService;

  @Inject(FiatWalletTransactionService)
  private readonly fiatWalletTransactionService: FiatWalletTransactionService;

  @Inject(forwardRef(() => TransactionService))
  private readonly transactionService: TransactionService;

  @Inject(BankService)
  private readonly bankService: BankService;

  @Inject(ExternalAccountService)
  private readonly externalAccountService: ExternalAccountService;

  @Inject(VirtualAccountRepository)
  private readonly virtualAccountRepository: VirtualAccountRepository;

  @Inject(MailerService)
  private readonly mailerService: MailerService;

  @Inject(PushNotificationService)
  private readonly pushNotificationService: PushNotificationService;

  @Inject(UserProfileService)
  private readonly userProfileService: UserProfileService;

  @Inject(KycVerificationService)
  private readonly kycVerificationService: KycVerificationService;

  @Inject(UserTierService)
  private readonly userTierService: UserTierService;

  @Inject(InAppNotificationService)
  private readonly inAppNotificationService: InAppNotificationService;

  @Inject(WithdrawalCounterService)
  private readonly withdrawalCounterService: WithdrawalCounterService;

  @Inject(WithdrawalSessionService)
  private readonly withdrawalSessionService: WithdrawalSessionService;

  @Inject(CircuitBreakerService)
  private readonly circuitBreakerService: CircuitBreakerService;

  @Inject(forwardRef(() => NgnWithdrawalStatusProcessor))
  private readonly ngnWithdrawalStatusProcessor: NgnWithdrawalStatusProcessor;

  @Inject(FiatWalletEscrowService)
  private readonly fiatWalletEscrowService: FiatWalletEscrowService;

  private readonly MAX_DAILY_WITHDRAWAL_ATTEMPTS = 10;

  async transfer(sender: UserModel, transferDto: TransferFiatWalletDto) {
    const { username, amount, asset, remark } = transferDto;
    this.logger.log(`Processing transfer: ${amount} ${asset} from ${sender.username} to ${username}`);

    // Validate tier limits for all transfer types
    const amountInSmallestUnit = CurrencyUtility.formatCurrencyAmountToSmallestUnit(amount, asset);
    await this.userTierService.validateLimit(
      sender.id,
      amountInSmallestUnit,
      asset,
      FiatWalletTransactionType.TRANSFER_OUT,
    );

    if (asset?.toLowerCase() === SUPPORTED_CURRENCIES.USD.code?.toLowerCase()) {
      return this.transferUSDToOneDoshUser(sender, transferDto);
    } else if (asset?.toLowerCase() === SUPPORTED_CURRENCIES.NGN.code?.toLowerCase()) {
      return this.sendNairaToOneDoshUser(sender, {
        username,
        amount,
        currency: asset,
        remark,
      });
    } else {
      throw new BadRequestException('Currency is not supported');
    }
  }

  async transferUSDToOneDoshUser(sender: UserModel, transferDto: TransferFiatWalletDto) {
    const { username, amount, asset, remark } = transferDto;

    // KYC verification check for USD transactions
    const kycVerification = await this.kycVerificationService.findByUserId(sender.id);
    if (!kycVerification?.provider_ref) {
      throw new BadRequestException('KYC verification required for USD transactions');
    }

    // Find recipient by username
    const recipient = await this.userService.findActiveByUsername(username);
    if (!recipient) {
      throw new NotFoundException(`Recipient is deactivated or not found`);
    }

    // Prevent self-transfer
    if (sender.id === recipient.id) {
      throw new BadRequestException('Cannot transfer to yourself');
    }

    // Get fiat wallet config
    const config = this.fiatWalletConfig.getConfig();
    const defaultFiatWalletProvider = config.default_usd_fiat_wallet_provider;

    // Get sender's external account with validation
    const senderExternalAccount = await this.externalAccountService.getExternalAccountForTransaction(
      sender.id,
      defaultFiatWalletProvider,
    );

    // Get recipient's external account with validation
    const recipientExternalAccount = await this.externalAccountService.getExternalAccountForTransaction(
      recipient.id,
      defaultFiatWalletProvider,
    );

    // Generate unique client_transfer_id for provider
    const clientTransferId = UtilsService.generateTransactionReference();

    // Generate unique references for each transaction
    const senderTransactionRef = `${clientTransferId}-OUT`;
    const recipientTransactionRef = `${clientTransferId}-IN`;

    // Convert amount to smallest unit (cents)
    const amountInCents = CurrencyUtility.formatCurrencyAmountToSmallestUnit(amount, asset);

    // Get sender's fiat wallet
    const senderWallet = await this.getUserWallet(sender.id, asset);
    const senderBalanceBefore = Number(senderWallet.balance);

    // Check if sender has sufficient balance
    if (senderBalanceBefore < amountInCents) {
      throw new BadRequestException('Insufficient balance');
    }

    // Get recipient's fiat wallet
    const recipientWallet = await this.getUserWallet(recipient.id, asset);
    const recipientBalanceBefore = Number(recipientWallet.balance);

    // Create sender transaction record
    this.logger.log(`Creating sender transaction with reference: ${senderTransactionRef}`);
    const senderTransaction = await this.transactionRepository.create({
      user_id: sender.id,
      reference: senderTransactionRef,
      external_reference: null, // Will be set by webhook
      asset: asset,
      amount: -amountInCents, // Negative for outgoing transfer
      balance_before: senderBalanceBefore,
      balance_after: senderBalanceBefore, // Will be updated by successful transfer
      transaction_type: TransactionType.TRANSFER_OUT,
      category: TransactionCategory.FIAT,
      transaction_scope: TransactionScope.INTERNAL,
      status: TransactionStatus.PENDING,
      description: remark || `Transfer to ${username}`,
      metadata: {
        recipient_user_id: recipient.id,
        recipient_username: username,
        recipient_first_name: recipient.first_name,
        recipient_last_name: recipient.last_name,
      } as ISenderTransactionMetadata,
    });

    // Create recipient transaction record
    this.logger.log(
      `Creating recipient transaction with reference: ${recipientTransactionRef} for user: ${recipient.id}`,
    );
    const recipientTransaction = await this.transactionRepository.create({
      user_id: recipient.id,
      reference: recipientTransactionRef,
      external_reference: null, // Will be set by webhook
      asset: asset,
      amount: amountInCents, // Positive for incoming transfer
      balance_before: recipientBalanceBefore,
      balance_after: recipientBalanceBefore, // Will be updated by successful transfer
      transaction_type: TransactionType.TRANSFER_IN,
      category: TransactionCategory.FIAT,
      transaction_scope: TransactionScope.INTERNAL,
      status: TransactionStatus.PENDING,
      parent_transaction_id: senderTransaction.id,
      description: remark || `Transfer from ${sender.username}`,
      metadata: {
        sender_user_id: sender.id,
        sender_username: sender.username,
        sender_first_name: sender.first_name,
        sender_last_name: sender.last_name,
      } as IRecipientTransactionMetadata,
    });

    // Update sender transaction with linked transaction ID
    await this.transactionRepository.update(senderTransaction.id, {
      metadata: {
        ...senderTransaction.metadata,
        linked_transaction_id: recipientTransaction.id,
      },
    });

    // Create sender fiat wallet transaction
    const senderFiatWalletTransaction = await this.fiatWalletTransactionRepository.create({
      transaction_id: senderTransaction.id,
      fiat_wallet_id: senderWallet.id,
      user_id: sender.id,
      transaction_type: FiatWalletTransactionType.TRANSFER_OUT,
      amount: -amountInCents, // Negative for outgoing transfer
      balance_before: senderBalanceBefore,
      balance_after: senderBalanceBefore,
      currency: asset,
      status: TransactionStatus.PENDING,
      description: remark || `Transfer to ${username}`,
      provider: defaultFiatWalletProvider,
      provider_reference: senderTransactionRef,
      source: `${sender.first_name} ${sender.last_name}`,
      destination: `${recipient.first_name} ${recipient.last_name}`,
      provider_metadata: {
        client_transfer_id: clientTransferId,
        linked_fiat_wallet_transaction_id: null, // Will be set after recipient transaction is created
      },
    });

    // Create recipient fiat wallet transaction
    const recipientFiatWalletTransaction = await this.fiatWalletTransactionRepository.create({
      transaction_id: recipientTransaction.id,
      fiat_wallet_id: recipientWallet.id,
      user_id: recipient.id,
      transaction_type: FiatWalletTransactionType.TRANSFER_IN,
      amount: amountInCents, // Positive for incoming transfer
      balance_before: recipientBalanceBefore,
      balance_after: recipientBalanceBefore,
      currency: asset,
      status: TransactionStatus.PENDING,
      description: remark || `Transfer from ${sender.username}`,
      provider: defaultFiatWalletProvider,
      provider_reference: recipientTransactionRef,
      source: `${sender.first_name} ${sender.last_name}`,
      destination: `${recipient.first_name} ${recipient.last_name}`,
      provider_metadata: {
        client_transfer_id: clientTransferId,
        linked_fiat_wallet_transaction_id: senderFiatWalletTransaction.id,
      },
    });

    // Update sender fiat wallet transaction with linked transaction ID
    await this.fiatWalletTransactionRepository.update(senderFiatWalletTransaction.id, {
      provider_metadata: {
        ...senderFiatWalletTransaction.provider_metadata,
        linked_fiat_wallet_transaction_id: recipientFiatWalletTransaction.id,
      },
    });

    // Call the fiat-wallet adapter to make the transfer request to provider
    try {
      await sender.$fetchGraph('[country]');

      // Create transfer request using interface
      const transferRequest: FiatWalletTransferRequest = {
        senderCode: senderExternalAccount.participant_code,
        receiverCode: recipientExternalAccount.participant_code,
        asset: config.default_underlying_currency,
        amount: amount.toString(),
        transferId: clientTransferId,
      };

      const transferResponse = await this.fiatWalletAdapter.transfer(transferRequest);

      this.logger.log(
        `Transfer initiated: ${transferResponse.providerRequestRef} with status: ${transferResponse.status}`,
      );

      this.eventEmitterService.emit(EventEmitterEventsEnum.SERVICE_STATUS_SUCCESS, {
        serviceKey: PlatformServiceKey.USD_TRANSFER,
      });

      return {
        senderTransactionId: senderTransaction.id,
        recipientTransactionId: recipientTransaction.id,
        clientTransferId: clientTransferId,
        transferId: transferResponse.providerRequestRef,
        amount: amount,
        asset: asset,
        recipient: username,
        status: transferResponse.status,
        message: 'Transfer initiated successfully',
      };
    } catch (error) {
      this.logger.error(`Transfer adapter call failed: ${error.message}`);

      this.eventEmitterService.emit(EventEmitterEventsEnum.SERVICE_STATUS_FAILURE, {
        serviceKey: PlatformServiceKey.USD_TRANSFER,
        reason: error.message,
      });

      // Update sender transaction status to failed
      await this.transactionRepository.update(senderTransaction.id, {
        status: TransactionStatus.FAILED,
        failure_reason: 'Transfer adapter call failed',
      });

      // Update recipient transaction status to failed
      await this.transactionRepository.update(recipientTransaction.id, {
        status: TransactionStatus.FAILED,
        failure_reason: 'Transfer adapter call failed',
      });

      await this.fiatWalletTransactionRepository.update(senderFiatWalletTransaction.id, {
        status: TransactionStatus.FAILED,
        failure_reason: 'Transfer adapter call failed',
      });

      await this.fiatWalletTransactionRepository.update(recipientFiatWalletTransaction.id, {
        status: TransactionStatus.FAILED,
        failure_reason: 'Transfer adapter call failed',
      });

      throw new InternalServerErrorException('Transfer failed to initiate');
    }
  }

  /**
   * Transfer USD from a user to a provided Rain card deposit address (crypto underlying)
   */
  async transferUSDToRainDepositAddress(
    sender: UserModel,
    params: {
      amount: number;
      fee: number;
      asset: string;
      rain_deposit_address: string;
      card_last_four_digits?: string;
    },
  ) {
    const { amount, fee, asset, rain_deposit_address, card_last_four_digits } = params;
    const totalAmount = add(amount, fee);

    const amountInCents = CurrencyUtility.formatCurrencyAmountToSmallestUnit(amount, asset);
    const feeInCents = CurrencyUtility.formatCurrencyAmountToSmallestUnit(fee, asset);

    // Tier check for USD transactions - user must have at least tier one
    const currentTier = await this.userTierService.getUserCurrentTier(sender.id);
    if (!currentTier || currentTier.level < 1) {
      throw new BadRequestException('You must complete tier one verification to perform USD transactions');
    }

    if ((asset || '').toUpperCase() !== SUPPORTED_CURRENCIES.USD.code) {
      throw new BadRequestException('Only USD transfers are supported');
    }

    if (!rain_deposit_address) {
      throw new BadRequestException('Rain deposit address is required');
    }

    // Get fiat wallet config
    const config = this.fiatWalletConfig.getConfig();
    const defaultFiatWalletProvider = config.default_usd_fiat_wallet_provider;
    const defaultUnderlyingCurrency = config.default_underlying_currency;

    if (!defaultUnderlyingCurrency) {
      throw new InternalServerErrorException('Default underlying currency not configured');
    }

    // Get sender's external account with validation
    const senderExternalAccount = await this.externalAccountService.getExternalAccountForTransaction(
      sender.id,
      defaultFiatWalletProvider,
    );

    // Convert total amount to smallest unit (cents)
    const totalAmountInCents = CurrencyUtility.formatCurrencyAmountToSmallestUnit(totalAmount, asset);

    // Get sender's fiat wallet and check balance
    const senderWallet = await this.getUserWallet(sender.id, asset);
    const senderBalanceBefore = Number(senderWallet.balance);
    if (senderBalanceBefore < totalAmountInCents) {
      throw new BadRequestException('Insufficient balance');
    }

    // Generate unique client reference
    const clientTransferId = UtilsService.generateTransactionReference();

    // Create sender transaction record (outgoing)
    const senderTransaction = await this.transactionRepository.create({
      user_id: sender.id,
      reference: `${clientTransferId}-RAIN-OUT`,
      external_reference: null,
      asset: asset,
      amount: -amountInCents,
      balance_before: senderBalanceBefore,
      balance_after: senderBalanceBefore,
      transaction_type: TransactionType.TRANSFER_OUT,
      category: TransactionCategory.FIAT,
      transaction_scope: TransactionScope.EXTERNAL,
      status: TransactionStatus.PENDING,
      description: `Card funding from ${asset} wallet`,
      metadata: {
        destination_type: 'rain_deposit_address',
        rain_deposit_address,
        underlying_asset: defaultUnderlyingCurrency,
        ...(card_last_four_digits && { destination_name: `Card ****${card_last_four_digits}` }),
      },
    });

    // Create fiat wallet transaction (debit)
    const senderFiatWalletTransaction = await this.fiatWalletTransactionRepository.create({
      transaction_id: senderTransaction.id,
      fiat_wallet_id: senderWallet.id,
      user_id: sender.id,
      transaction_type: FiatWalletTransactionType.TRANSFER_OUT,
      amount: -amountInCents,
      balance_before: senderBalanceBefore,
      balance_after: senderBalanceBefore,
      currency: asset,
      status: TransactionStatus.PENDING,
      description: `Card funding from ${asset} wallet`,
      provider: defaultFiatWalletProvider,
      provider_reference: senderTransaction.reference,
      source: `${sender.first_name} ${sender.last_name}`,
      destination: rain_deposit_address,
      provider_metadata: {
        client_transfer_id: clientTransferId,
      },
    });

    try {
      await sender.$fetchGraph('[country]');

      // Create withdrawal request (executes transaction in one request without quote)
      const withdrawalRequestPayload = {
        transactionRef: senderTransaction.reference,
        withdrawalAddress: rain_deposit_address,
        providerUserRef: senderExternalAccount.participant_code,
        amount: totalAmount.toString(),
        asset: defaultUnderlyingCurrency,
      };

      const withdrawalRequest = await this.fiatWalletAdapter.createWithdrawalRequest(
        withdrawalRequestPayload,
        defaultFiatWalletProvider,
      );

      // Move transactions to PROCESSING and persist provider_request_ref for webhook correlation
      await this.transactionRepository.update(senderTransaction.id, {
        status: TransactionStatus.PROCESSING,
        processed_at: new Date().toISOString(),
      });

      const updatedFiatTx = await this.fiatWalletTransactionRepository.update(senderFiatWalletTransaction.id, {
        status: TransactionStatus.PROCESSING,
        processed_at: new Date().toISOString(),
        provider_request_ref: withdrawalRequest.providerRef,
        provider_reference: withdrawalRequest.providerRef,
        provider_fee: feeInCents,
        provider_metadata: {
          ...(senderFiatWalletTransaction.provider_metadata || {}),
          withdrawal_fee: withdrawalRequest.withdrawalFee,
          quoted_fee_amount: withdrawalRequest.quotedFeeAmount,
          quoted_fee_notional: withdrawalRequest.quotedFeeNotional,
          settled_amount: withdrawalRequest.settledAmount,
          withdrawal_status: withdrawalRequest.status,
          blockchain_transaction_ref: withdrawalRequest.blockchainTransactionRef,
          blockchain_status: withdrawalRequest.blockchainStatus,
          client_withdrawal_request_ref: withdrawalRequest.clientWithdrawalRequestRef,
        },
      });

      this.eventEmitterService.emit(EventEmitterEventsEnum.SERVICE_STATUS_SUCCESS, {
        serviceKey: PlatformServiceKey.USD_WITHDRAWAL,
      });

      return {
        senderTransactionId: senderTransaction.id,
        fiatWalletTransactionId: updatedFiatTx.id,
        clientTransferId,
        withdrawalRequestId: withdrawalRequest.providerRef,
        amount,
        asset,
        rain_deposit_address,
        status: 'processing',
        message: 'Withdrawal executed. Awaiting provider confirmation.',
      };
    } catch (error) {
      this.logger.error(`Rain deposit withdrawal request failed: ${error.message}`);

      this.eventEmitterService.emit(EventEmitterEventsEnum.SERVICE_STATUS_FAILURE, {
        serviceKey: PlatformServiceKey.USD_WITHDRAWAL,
        reason: error.message,
      });

      // Mark transaction failed
      await this.transactionRepository.update(senderTransaction.id, {
        status: TransactionStatus.FAILED,
        failure_reason: 'Withdrawal request failed',
      });

      await this.fiatWalletTransactionRepository.update(senderFiatWalletTransaction.id, {
        status: TransactionStatus.FAILED,
        failure_reason: 'Withdrawal request failed',
      });

      throw new InternalServerErrorException('Transfer failed to initiate');
    }
  }

  async sendNairaToOneDoshUser(user: UserModel, sendToOnedoshDto: SendMoneyToOneDoshUserDto) {
    try {
      this.logger.log(
        `user: ${user.username} is sending money to onedosh with amount: ${sendToOnedoshDto.amount} to username: ${sendToOnedoshDto.username}`,
      );

      const { username, amount, currency, remark } = sendToOnedoshDto;
      // check if the currency is in nigeria
      if (currency?.toLowerCase() !== SUPPORTED_CURRENCIES.NGN.code?.toLowerCase()) {
        throw new BadRequestException('Currency is not supported');
      }

      const amountInSmallestUnit = CurrencyUtility.formatCurrencyAmountToSmallestUnit(amount, currency);

      // check if the user has enough balance
      const userWallet = (await this.fiatWalletRepository.findOne(
        {
          user_id: user.id,
          asset: SUPPORTED_CURRENCIES.NGN.code,
        },
        {},
        { graphFetch: 'virtualAccounts' },
      )) as FiatWalletModel & { virtualAccounts: VirtualAccountModel[] };

      if (!userWallet) {
        throw new NotFoundException('User wallet not found');
      }

      if (userWallet.balance < amountInSmallestUnit) {
        throw new BadRequestException('Insufficient balance');
      }

      const receiver = await this.userService.findActiveByUsername(username);

      if (!receiver) {
        throw new NotFoundException(`User with username '${username}' not found`);
      }

      if (user.id === receiver.id) {
        throw new BadRequestException('Cannot send money to yourself');
      }

      // GET THE RECEIVER NG VIRTUAL ACCOUNT
      const receiverVirtualAccount = await this.virtualAccountRepository.findOne({
        user_id: receiver.id,
        provider: this.waasAdapter.getProviderName(),
      });

      if (!receiverVirtualAccount) {
        throw new BadRequestException(`${username} virtual account not found`);
      }

      const allRelatedTransactions = await this.createAllRequiredTransactionsForSendNG(
        user,
        receiver,
        userWallet,
        amount,
        receiverVirtualAccount,
        remark,
      );

      let response: WaasTransferToSameBankResponse;
      try {
        response = await this.waasAdapter.transferToSameBank({
          amount: amount,
          transactionReference: allRelatedTransactions.senderTransaction.reference,
          transactionType: 'INTRA_BANK',
          description: `Transfer to ${receiver.first_name} ${receiver.last_name}` + (remark ? ` - ${remark}` : ''),
          currency: SUPPORTED_CURRENCIES.NGN.code,
          sender: {
            accountNumber: userWallet.virtualAccounts[0].account_number,
            accountName: userWallet.virtualAccounts[0].account_name,
          },
          receiver: {
            accountNumber: receiverVirtualAccount.account_number,
            accountName: receiverVirtualAccount.account_name,
          },
        });

        // update all the transactions to completed
        await this.updateAllTransactionsToCompleted(allRelatedTransactions);

        // Create in-app notifications for sender and receiver using dynamic config
        const formattedAmount = CurrencyUtility.formatCurrencyAmountToLocaleString(
          amount,
          SUPPORTED_CURRENCIES.NGN.code,
        );
        const senderName = `${user.first_name} ${user.last_name}`;
        const recipientName = `${receiver.first_name} ${receiver.last_name}`;

        // Sender notification (transfer_out)
        const senderNotificationConfig = this.inAppNotificationService.getTransactionNotificationConfig(
          TransactionType.TRANSFER_OUT,
          formattedAmount,
          SUPPORTED_CURRENCIES.NGN.code,
          recipientName,
          senderName,
        );

        await this.inAppNotificationService.createNotification({
          user_id: user.id,
          type: senderNotificationConfig.type,
          title: senderNotificationConfig.title,
          message: senderNotificationConfig.message,
          metadata: {
            amount: formattedAmount,
            description: allRelatedTransactions.senderTransaction.description,
            recipient_name: recipientName,
            recipient_id: receiver.id,
            sender_name: senderName,
            sender_id: user.id,
          },
        });

        // Receiver notification (transfer_in)
        const receiverNotificationConfig = this.inAppNotificationService.getTransactionNotificationConfig(
          TransactionType.TRANSFER_IN,
          formattedAmount,
          SUPPORTED_CURRENCIES.NGN.code,
          recipientName,
          senderName,
        );

        await this.inAppNotificationService.createNotification({
          user_id: receiver.id,
          type: receiverNotificationConfig.type,
          title: receiverNotificationConfig.title,
          message: receiverNotificationConfig.message,
          metadata: {
            amount: formattedAmount,
            description: allRelatedTransactions.senderTransaction.description,
            recipient_name: recipientName,
            recipient_id: receiver.id,
            sender_name: senderName,
            sender_id: user.id,
          },
        });

        this.eventEmitterService.emit(EventEmitterEventsEnum.SERVICE_STATUS_SUCCESS, {
          serviceKey: PlatformServiceKey.NGN_TRANSFER,
        });
      } catch (error) {
        this.logger.error(`Send money to one dosh user failed for user ${user.username} with error`, error);
        await this.updateAllTransactionsToFailedForSender(
          allRelatedTransactions.senderTransaction.id,
          allRelatedTransactions.senderFiatWalletTransaction.id,
          error.message,
        );

        this.eventEmitterService.emit(EventEmitterEventsEnum.SERVICE_STATUS_FAILURE, {
          serviceKey: PlatformServiceKey.NGN_TRANSFER,
          reason: error.message,
        });

        throw new InternalServerErrorException(error.message);
      }

      // send the email to the sender
      const transactionDate = DateTime.now().toFormat('LLL dd, yyyy h:mma');
      this.mailerService.send(
        new MoneyTransferSuccessMail(user, {
          amount: amount,
          currency: SUPPORTED_CURRENCIES.NGN.code,
          formattedAmount: CurrencyUtility.formatCurrencyAmountToLocaleString(amount, SUPPORTED_CURRENCIES.NGN.code),
          formattedFee: CurrencyUtility.formatCurrencyAmountToLocaleString(0, SUPPORTED_CURRENCIES.NGN.code),
          transactionReference: allRelatedTransactions.senderTransaction.id,
          transactionDate: transactionDate,
          description: allRelatedTransactions.senderTransaction.description,
          senderName: `${user.first_name} ${user.last_name}`,
          recipientName: `${receiver.first_name} ${receiver.last_name}`,
          walletName: 'Naira',
        }),
      );

      this.mailerService.send(
        new NgFundsReceivedMail(receiver, user.first_name, amount, SUPPORTED_CURRENCIES.NGN.code),
      );

      const receiverProfile = await this.userProfileService.findByUserId(receiver.id);
      const senderProfile = await this.userProfileService.findByUserId(user.id);
      const mainAmount = CurrencyUtility.formatCurrencyAmountToMainUnit(
        CurrencyUtility.formatCurrencyAmountToSmallestUnit(amount, SUPPORTED_CURRENCIES.NGN.code),
        SUPPORTED_CURRENCIES.NGN.code,
      );
      const formattedAmount = CurrencyUtility.formatCurrencyAmountToLocaleString(
        mainAmount,
        SUPPORTED_CURRENCIES.NGN.code,
      );

      // Send push notifications using dynamic config
      const pushSenderName = `${user.first_name} ${user.last_name}`;
      const pushRecipientName = `${receiver.first_name} ${receiver.last_name}`;

      if (receiverProfile.notification_token) {
        const receiverPushConfig = this.pushNotificationService.getTransactionPushNotificationConfig(
          TransactionType.TRANSFER_IN,
          formattedAmount,
          SUPPORTED_CURRENCIES.NGN.code,
          pushRecipientName,
          pushSenderName,
        );

        this.pushNotificationService.sendPushNotification([receiverProfile.notification_token], {
          title: receiverPushConfig.title,
          body: receiverPushConfig.body,
        });
      }

      if (senderProfile.notification_token) {
        const senderPushConfig = this.pushNotificationService.getTransactionPushNotificationConfig(
          TransactionType.TRANSFER_OUT,
          formattedAmount,
          SUPPORTED_CURRENCIES.NGN.code,
          pushRecipientName,
          pushSenderName,
        );

        this.pushNotificationService.sendPushNotification([senderProfile.notification_token], {
          title: senderPushConfig.title,
          body: senderPushConfig.body,
        });
      }

      return response;
    } catch (error) {
      this.logger.error('Send money to one dosh user failed', error);
      throw new InternalServerErrorException(error.message);
    }
  }

  private async createAllRequiredTransactionsForSendNG(
    user: UserModel,
    receiver: UserModel,
    userWallet: FiatWalletModel & { virtualAccounts: VirtualAccountModel[] },
    amount: number,
    receiverVirtualAccount: VirtualAccountModel,
    remark?: string,
  ) {
    try {
      const amountInSmallestUnit = CurrencyUtility.formatCurrencyAmountToSmallestUnit(
        amount,
        SUPPORTED_CURRENCIES.NGN.code,
      );
      const receiverWallet = await this.getUserWallet(receiver.id, SUPPORTED_CURRENCIES.NGN.code);

      const username = user.username;
      const receiverUsername = receiver.username;

      // create the ng transactions and the fiat wallet transactions for the sender
      const senderBalanceBefore = Number(userWallet.balance);
      const senderBalanceAfter = subtract(senderBalanceBefore, amountInSmallestUnit);

      const allRelatedTransactions = await this.transactionRepository.transaction(async (trx) => {
        const senderTransaction = await this.transactionService.create(
          user.id,
          {
            amount: amountInSmallestUnit,
            asset: SUPPORTED_CURRENCIES.NGN.code,
            status: TransactionStatus.PENDING,
            reference: UtilsService.generateTransactionReference(),
            balance_before: senderBalanceBefore,
            balance_after: senderBalanceAfter,
            transaction_type: TransactionType.TRANSFER_OUT,
            category: TransactionCategory.FIAT,
            transaction_scope: TransactionScope.INTERNAL,
            description: remark || `Transfer to ${receiverUsername}`,
            metadata: {
              recipient_user_id: receiver.id,
              recipient_username: receiver.username,
              recipient_first_name: receiver.first_name,
              recipient_last_name: receiver.last_name,
              sender_name: `${user.first_name} ${user.last_name}`,
              recipient: `${receiver.first_name} ${receiver.last_name}`,
            } as ISenderTransactionMetadata,
          },
          trx,
        );

        const senderFiatWalletTransaction = await this.fiatWalletTransactionService.create(
          user.id,
          {
            amount: amountInSmallestUnit,
            currency: SUPPORTED_CURRENCIES.NGN.code,
            status: TransactionStatus.PENDING,
            fiat_wallet_id: userWallet.id,
            transaction_id: senderTransaction.id,
            transaction_type: FiatWalletTransactionType.TRANSFER_OUT,
            source: `${user.first_name} ${user.last_name}`,
            destination: `${receiver.first_name} ${receiver.last_name}`,
            description: remark || `Transfer to ${receiverUsername}`,
            provider: this.waasAdapter.getProviderName(),
            provider_reference: senderTransaction.reference,
            balance_before: senderBalanceBefore,
            balance_after: senderBalanceAfter,
            provider_metadata: {
              source: userWallet.virtualAccounts[0].account_number,
              source_name: `${user.first_name} ${user.last_name}`,
              source_account_number: userWallet.virtualAccounts[0].account_number,
              source_account_name: userWallet.virtualAccounts[0].account_name,
              destination: receiverVirtualAccount.account_number,
              sender_name: `${user.first_name} ${user.last_name}`,
              recipient: `${receiver.first_name} ${receiver.last_name}`,
              description: remark || `Transfer to ${receiverUsername}`,
              source_bank: this.waasAdapter.getBankCode(),
              destination_bank: this.waasAdapter.getBankCode(),
              destination_name: `${receiver.first_name} ${receiver.last_name}`,
              destination_account_number: receiverVirtualAccount.account_number,
              destination_account_name: receiverVirtualAccount.account_name,
            },
          },
          trx,
        );

        const receiverBalanceBefore = Number(receiverWallet.balance);
        const receiverBalanceAfter = add(receiverBalanceBefore, amountInSmallestUnit);

        // create the receiver transaction and the receiver fiat wallet transaction
        const receiverTransaction = await this.transactionService.create(
          receiver.id,
          {
            amount: amountInSmallestUnit,
            asset: SUPPORTED_CURRENCIES.NGN.code,
            status: TransactionStatus.PENDING,
            parent_transaction_id: senderTransaction.id,
            reference: UtilsService.generateTransactionReference(),
            balance_before: receiverBalanceBefore,
            balance_after: receiverBalanceAfter,
            transaction_type: TransactionType.TRANSFER_IN,
            category: TransactionCategory.FIAT,
            transaction_scope: TransactionScope.INTERNAL,
            description: remark || `Transfer from ${username}`,
            metadata: {
              sender_user_id: user.id,
              sender_username: user.username,
              sender_first_name: user.first_name,
              sender_last_name: user.last_name,
              sender_name: `${user.first_name} ${user.last_name}`,
              recipient: `${receiver.first_name} ${receiver.last_name}`,
            } as IRecipientTransactionMetadata,
          },
          trx,
        );

        const receiverFiatWalletTransaction = await this.fiatWalletTransactionService.create(
          receiver.id,
          {
            amount: amountInSmallestUnit,
            currency: SUPPORTED_CURRENCIES.NGN.code,
            status: TransactionStatus.PENDING,
            fiat_wallet_id: receiverWallet.id,
            transaction_id: receiverTransaction.id,
            transaction_type: FiatWalletTransactionType.TRANSFER_IN,
            source: `${receiver.first_name} ${receiver.last_name}`,
            destination: `${user.first_name} ${user.last_name}`,
            description: remark || `Transfer from ${username}`,
            provider: this.waasAdapter.getProviderName(),
            provider_reference: receiverTransaction.reference,
            provider_metadata: {
              source: receiverVirtualAccount.account_number,
              destination: userWallet.virtualAccounts[0].account_number,
              source_name: `${receiver.first_name} ${receiver.last_name}`,
              destination_name: `${user.first_name} ${user.last_name}`,
              source_account_number: receiverVirtualAccount.account_number,
              destination_account_number: userWallet.virtualAccounts[0].account_number,
              source_account_name: receiverVirtualAccount.account_name,
              destination_account_name: userWallet.virtualAccounts[0].account_name,
              sender_name: `${user.first_name} ${user.last_name}`,
              recipient: `${receiver.first_name} ${receiver.last_name}`,
            },
            balance_before: receiverBalanceBefore,
            balance_after: receiverBalanceAfter,
          },
          trx,
        );

        return {
          senderTransaction,
          senderFiatWalletTransaction,
          receiverTransaction,
          receiverFiatWalletTransaction,
        };
      });

      return allRelatedTransactions;
    } catch (error) {
      this.logger.error(error.message);
      throw new BadRequestException(error.message);
    }
  }

  private async updateAllTransactionsToCompleted(allRelatedTransactions: {
    senderTransaction: TransactionModel;
    senderFiatWalletTransaction: FiatWalletTransactionModel;
    receiverTransaction: TransactionModel;
    receiverFiatWalletTransaction: FiatWalletTransactionModel;
  }) {
    const { senderFiatWalletTransaction, receiverFiatWalletTransaction, senderTransaction, receiverTransaction } =
      allRelatedTransactions;

    await this.transactionRepository.transaction(async (trx) => {
      await this.updateBalance(
        senderFiatWalletTransaction.fiat_wallet_id,
        -Number(senderFiatWalletTransaction.amount),
        senderTransaction.id,
        senderFiatWalletTransaction.transaction_type,
        TransactionStatus.COMPLETED,
        {
          description: `Transfer to ${receiverTransaction.description}`,
          source: senderFiatWalletTransaction.source,
          destination: receiverFiatWalletTransaction.destination,
          provider: senderFiatWalletTransaction.provider,
          fiat_wallet_transaction_id: senderFiatWalletTransaction.id,
        },
        trx,
      );

      await this.transactionService.updateStatus(senderTransaction.id, TransactionStatus.COMPLETED, undefined, trx, {
        shouldSendEmail: false,
        shouldSendPushNotification: false,
        shouldSendInAppNotification: false,
      });

      await this.updateBalance(
        receiverFiatWalletTransaction.fiat_wallet_id,
        receiverFiatWalletTransaction.amount,
        receiverTransaction.id,
        receiverFiatWalletTransaction.transaction_type,
        TransactionStatus.COMPLETED,
        {
          description: `Transfer to ${receiverTransaction.description}`,
          source: receiverFiatWalletTransaction.source,
          destination: receiverFiatWalletTransaction.destination,
          provider: receiverFiatWalletTransaction.provider,
          fiat_wallet_transaction_id: receiverFiatWalletTransaction.id,
        },
        trx,
      );

      await this.transactionService.updateStatus(receiverTransaction.id, TransactionStatus.COMPLETED, undefined, trx, {
        shouldSendEmail: false,
        shouldSendPushNotification: false,
        shouldSendInAppNotification: false,
      });
    });
  }

  private async updateAllTransactionsToFailedForSender(
    transactionId: string,
    fiatWalletTransactionId: string,
    errorMessage: string,
  ) {
    await this.transactionRepository.transaction(async (trx) => {
      await this.transactionService.updateStatus(
        transactionId,
        TransactionStatus.FAILED,
        {
          failure_reason: errorMessage,
        },
        trx,
      );

      await this.fiatWalletTransactionService.updateStatus(
        fiatWalletTransactionId,
        TransactionStatus.FAILED,
        { failure_reason: errorMessage },
        trx,
      );
    });
  }

  async sendMoneyToBeneficiary(user: UserModel, beneficiary_id: string, amount: number, remark: string) {
    this.logger.log(
      `user: ${user.id} is sending money to beneficiary: ${beneficiary_id} with amount: ${amount} and remark: ${remark}`,
    );
  }

  /**
   * Withdraw funds to an external Nigerian bank account with comprehensive security measures
   */
  async withdrawToExternalNGAccount(
    user: UserModel,
    idempotencyKey: string,
    withdrawDto: WithdrawToExternalNGAccountDto,
  ) {
    const { amount, beneficiary_id, remark } = withdrawDto;
    const idempotency_key = idempotencyKey;

    this.logger.log(
      `Withdrawal request from user ${user.id} with idempotency_key: ${idempotency_key}, amount: ${amount}`,
    );

    // Step 1: Idempotency Check - Check if this request has already been processed
    const existingTransaction = await this.fiatWalletTransactionRepository.findByUserIdAndIdempotencyKey(
      user.id,
      idempotency_key,
    );

    if (existingTransaction) {
      this.logger.log(
        `Found existing transaction with idempotency_key: ${idempotency_key}, status: ${existingTransaction.status}`,
      );

      if (
        existingTransaction.status === TransactionStatus.COMPLETED ||
        existingTransaction.status === TransactionStatus.PENDING ||
        existingTransaction.status === TransactionStatus.INITIATED
      ) {
        this.logger.log(
          `Returning existing transaction ${existingTransaction.id} for idempotency_key: ${idempotency_key}`,
        );
        return existingTransaction;
      }

      if (existingTransaction.status === TransactionStatus.FAILED) {
        this.logger.log(
          `Previous transaction ${existingTransaction.id} failed with idempotency_key: ${idempotency_key}. Retry requires new key.`,
        );
        throw new BadRequestException(
          'Previous transaction with this idempotency key failed. Please use a new idempotency key to retry.',
        );
      }
    }

    // Step 2: Get user wallet with virtual accounts
    const userWallet = (await this.fiatWalletRepository.findOne(
      {
        user_id: user.id,
        asset: SUPPORTED_CURRENCIES.NGN.code,
      },
      {},
      { graphFetch: 'virtualAccounts' },
    )) as FiatWalletModel & { virtualAccounts: VirtualAccountModel[] };

    if (!userWallet) {
      throw new NotFoundException('User wallet not found');
    }

    // Step 3: Validate withdrawal amount
    const amountInSmallestUnit = CurrencyUtility.formatCurrencyAmountToSmallestUnit(
      amount,
      SUPPORTED_CURRENCIES.NGN.code,
    );

    // validate the transaction limit
    await this.userTierService.validateLimit(
      user.id,
      amountInSmallestUnit,
      SUPPORTED_CURRENCIES.NGN.code,
      FiatWalletTransactionType.WITHDRAWAL,
    );

    // Pre-validation: Check balance before entering lock
    if (userWallet.balance < amountInSmallestUnit) {
      throw new BadRequestException('Insufficient balance');
    }

    // Step 4.5: Check daily withdrawal attempt limit
    if (this.MAX_DAILY_WITHDRAWAL_ATTEMPTS) {
      await this.withdrawalCounterService.checkDailyLimit(user.id, this.MAX_DAILY_WITHDRAWAL_ATTEMPTS);
    }

    // Step 4.6: Increment daily withdrawal attempt counter
    await this.withdrawalCounterService.incrementDailyAttempts(user.id);

    // Step 5: Route to appropriate handler
    if (beneficiary_id) {
      return await this.sendMoneyToBeneficiary(user, beneficiary_id, amountInSmallestUnit, remark);
    }

    return await this.sendMoneyToExternalNGAccount(user, idempotency_key, withdrawDto, userWallet);
  }

  /**
   * Process withdrawal to external Nigerian bank account
   */
  async sendMoneyToExternalNGAccount(
    user: UserModel,
    idempotencyKey: string,
    withdrawDto: WithdrawToExternalNGAccountDto,
    wallet: FiatWalletModel & { virtualAccounts: VirtualAccountModel[] },
  ) {
    const { bank_ref, account_number, amount, remark } = withdrawDto;
    const idempotency_key = idempotencyKey;

    this.logger.log(
      `Processing withdrawal for user ${user.id}, amount: ${amount}, idempotency_key: ${idempotency_key}`,
    );

    // validate the transaction limit
    const amountInSmallestUnit = CurrencyUtility.formatCurrencyAmountToSmallestUnit(
      amount,
      SUPPORTED_CURRENCIES.NGN.code,
    );
    await this.userTierService.validateLimit(
      user.id,
      amountInSmallestUnit,
      SUPPORTED_CURRENCIES.NGN.code,
      FiatWalletTransactionType.WITHDRAWAL,
    );

    // Step 1: Verify recipient bank account
    const bank = await this.bankService.verifyBankAccount({
      account_number,
      bank_ref,
      country_code: 'NG',
    });

    if (!bank) {
      throw new BadRequestException('Invalid bank account');
    }

    const activeVirtualAccount = await this.getActiveVirtualAccount(wallet.virtualAccounts);

    // Step 2: Check for concurrent withdrawals BEFORE acquiring lock
    await this.withdrawalSessionService.checkAndBlockConcurrent(user.id);

    // Step 3: Create distributed lock with idempotency_key
    const lockKey = `withdraw-ng-account:${user.id}:${wallet.id}:${idempotency_key}`;

    this.logger.log(`Acquiring lock for key: ${lockKey}`);

    return this.lockerService.withLock(
      lockKey,
      async () => {
        let mainTransaction: { transaction: TransactionModel; fiatWalletTransaction: FiatWalletTransactionModel };

        try {
          // Step 3: Create transaction records with INITIATED status
          this.logger.log(`Creating transaction records for idempotency_key: ${idempotency_key}`);

          mainTransaction = await this.createNGTransactionAndFiatWalletTransaction(
            user,
            idempotency_key,
            withdrawDto,
            wallet,
            amount,
            bank,
          );

          // Step 3.5: Start withdrawal session
          await this.withdrawalSessionService.startSession(user.id, mainTransaction.transaction.id);

          this.logger.log(
            `Transaction records created: transaction_id=${mainTransaction.transaction.id}, fiat_wallet_transaction_id=${mainTransaction.fiatWalletTransaction.id}`,
          );

          // Step 3.6: Verify ledger has sufficient balance BEFORE reserving user balance
          const ledgerBalanceCheck = await this.waasAdapter.checkLedgerBalance({
            accountNumber: activeVirtualAccount.account_number,
            amount,
            currency: SUPPORTED_CURRENCIES.NGN.code,
          });

          if (!ledgerBalanceCheck.hasSufficientBalance) {
            this.logger.error(
              `Ledger insufficient balance for account ${activeVirtualAccount.account_number}. ` +
                `Requested: ${ledgerBalanceCheck.requestedAmount}, Available: ${ledgerBalanceCheck.availableBalance}`,
            );
            throw new BadRequestException('Service temporarily unavailable. Please try again later.');
          }

          // Step 4: CRITICAL SECURITY STEP - Reserve balance immediately
          await this.reserveWithdrawalBalance({
            amount,
            mainTransaction,
            withdrawDto,
            activeVirtualAccount,
            bank,
            remark,
          });

          // Step 4.5: Send real-time notifications for withdrawal initiation
          await this.sendWithdrawalInitiatedNotification(
            user,
            amount,
            `${bank.bankName} - ****${account_number.slice(-4)}`,
            mainTransaction.transaction,
            mainTransaction.fiatWalletTransaction,
          );

          // Step 5: Update status to PENDING before calling external provider
          mainTransaction.transaction = await this.transactionRepository.update(mainTransaction.transaction.id, {
            status: TransactionStatus.PENDING,
          });

          mainTransaction.fiatWalletTransaction = await this.fiatWalletTransactionRepository.update(
            mainTransaction.fiatWalletTransaction.id,
            {
              status: TransactionStatus.PENDING,
            },
          );

          this.logger.log(`Transaction status updated to PENDING, calling external provider`);

          // Step 5.5: Check circuit breaker before calling provider
          const providerName = this.waasAdapter.getProviderName();
          const circuitCheck = await this.circuitBreakerService.canProceed(providerName);

          if (!circuitCheck.allowed) {
            this.logger.warn(`Circuit breaker blocking withdrawal for user ${user.id}: ${circuitCheck.reason}`);

            mainTransaction.transaction = await this.transactionRepository.update(mainTransaction.transaction.id, {
              status: TransactionStatus.FAILED,
              failure_reason: 'Service temporarily unavailable',
              failed_at: DateTime.now().toSQL(),
            });

            mainTransaction.fiatWalletTransaction = await this.fiatWalletTransactionRepository.update(
              mainTransaction.fiatWalletTransaction.id,
              {
                status: TransactionStatus.FAILED,
                failure_reason: 'Service temporarily unavailable',
                failed_at: DateTime.now().toSQL(),
              },
            );

            await this.revertWithdrawalBalance(mainTransaction.transaction.id);

            throw new BadRequestException(circuitCheck.reason);
          }

          // Step 6: Call external provider to process the withdrawal
          let response;
          try {
            response = await this.waasAdapter.transferToOtherBank({
              amount,
              receiver: {
                accountNumber: account_number,
                accountName: bank.accountName,
                bankRef: bank_ref,
              },
              sender: {
                accountNumber: activeVirtualAccount.account_number,
                accountName: activeVirtualAccount.account_name,
                bankCode: this.waasAdapter.getBankCode(),
              },
              transactionReference: mainTransaction.transaction.reference,
              transactionType: 'WITHDRAWAL',
              description: `Transfer from ${user.first_name} ${user.last_name} - ****${account_number.slice(-4)}`,
              currency: SUPPORTED_CURRENCIES.NGN.code,
            });

            this.logger.log(
              `External provider responded for transaction ${mainTransaction.transaction.reference}: ${response.transactionReference}`,
            );
          } catch (providerError) {
            // Check if this is a pre-API validation error that definitely didn't reach the provider
            if (this.isPreApiValidationError(providerError)) {
              this.logger.error(`Pre-API validation error: ${providerError.message}`);
              await this.circuitBreakerService.recordAttempt(providerName, false);
              await this.revertWithdrawalBalance(mainTransaction.transaction.id);
              throw providerError;
            }

            // For all other errors, queue status poll
            this.logger.warn(
              `Provider error during withdrawal for transaction ${mainTransaction.transaction.id}. ` +
                `Error: ${providerError.message}. Transaction status unknown - queueing status poll.`,
            );

            await this.ngnWithdrawalStatusProcessor.queueStatusPoll({
              transactionId: mainTransaction.transaction.id,
              fiatWalletTransactionId: mainTransaction.fiatWalletTransaction.id,
              userId: user.id,
              providerReference: mainTransaction.transaction.reference,
              amount: amount,
              recipientInfo: `${bank.accountName} - ****${account_number.slice(-4)}`,
              remark: remark,
            });

            return mainTransaction.fiatWalletTransaction;
          }

          // Step 7: Confirm the transaction status from provider
          let transactionStatus;
          try {
            transactionStatus = await this.waasAdapter.getTransactionStatus({
              transactionRef: response.transactionReference,
            });

            this.logger.log(
              `Fetched transaction status from external provider: ${transactionStatus.status}, message: ${transactionStatus.message} for transaction ${mainTransaction.transaction.id}, for user ${user.id}`,
            );
          } catch (statusError) {
            if (this.isTimeoutOrNetworkError(statusError)) {
              this.logger.warn(
                `Timeout/network error while checking transaction status for ${mainTransaction.transaction.id}. ` +
                  `Transfer was sent. Queueing status poll.`,
              );

              await this.ngnWithdrawalStatusProcessor.queueStatusPoll({
                transactionId: mainTransaction.transaction.id,
                fiatWalletTransactionId: mainTransaction.fiatWalletTransaction.id,
                userId: user.id,
                providerReference: response.transactionReference,
                amount: amount,
                recipientInfo: `${bank.accountName} - ****${account_number.slice(-4)}`,
                remark: remark,
              });

              return mainTransaction.fiatWalletTransaction;
            }

            throw statusError;
          }

          const status = this.mapWaasTransactionStatusToTransactionStatus(transactionStatus.status);

          this.logger.log(`Provider transaction status: ${status} for transaction ${mainTransaction.transaction.id}`);

          // Step 8: Handle provider response based on status
          if (status?.toLowerCase() === TransactionStatus.FAILED?.toLowerCase()) {
            await this.circuitBreakerService.recordAttempt(providerName, false);

            this.logger.error(
              `Provider failed transaction ${mainTransaction.transaction.id}: ${transactionStatus.message}`,
            );

            mainTransaction.transaction = await this.transactionRepository.update(mainTransaction.transaction.id, {
              status: TransactionStatus.FAILED,
              failure_reason: transactionStatus.message,
              failed_at: DateTime.now().toSQL(),
            });

            mainTransaction.fiatWalletTransaction = await this.fiatWalletTransactionRepository.update(
              mainTransaction.fiatWalletTransaction.id,
              {
                status: TransactionStatus.FAILED,
                failure_reason: transactionStatus.message,
                failed_at: DateTime.now().toSQL(),
              },
            );

            await this.revertWithdrawalBalance(mainTransaction.transaction.id);
          } else if (status?.toLowerCase() === TransactionStatus.COMPLETED.toLowerCase()) {
            await this.circuitBreakerService.recordAttempt(providerName, true);

            this.logger.log(`Provider completed transaction ${mainTransaction.transaction.id} successfully`);

            mainTransaction.transaction = await this.transactionRepository.update(mainTransaction.transaction.id, {
              status: TransactionStatus.COMPLETED,
              completed_at: DateTime.now().toSQL(),
            });

            mainTransaction.fiatWalletTransaction = await this.fiatWalletTransactionRepository.update(
              mainTransaction.fiatWalletTransaction.id,
              {
                status: TransactionStatus.COMPLETED,
                completed_at: DateTime.now().toSQL(),
              },
            );

            this.eventEmitterService.emit(EventEmitterEventsEnum.SERVICE_STATUS_SUCCESS, {
              serviceKey: PlatformServiceKey.NGN_TRANSFER_OUT,
            });

            // Send transfer successful email only when status is COMPLETED
            const transactionDate = DateTime.now().toFormat('LLL dd, yyyy h:mma');
            this.mailerService.send(
              new NgBankTransferSuccessMail(user, {
                amount: amount,
                formattedAmount: CurrencyUtility.formatCurrencyAmountToLocaleString(
                  amount,
                  SUPPORTED_CURRENCIES.NGN.code,
                ),
                fee: 0,
                formattedFee: CurrencyUtility.formatCurrencyAmountToLocaleString(0, SUPPORTED_CURRENCIES.NGN.code),
                transactionReference: mainTransaction.transaction.id,
                transactionDate: transactionDate,
                description: remark,
                senderName: `${user.first_name} ${user.last_name}`,
                recipientName: bank.accountName,
                recipientBank: bank.bankName,
                recipientAccountNumber: account_number,
              }),
            );

            // Send in-app notification for completed withdrawal
            const formattedAmount = CurrencyUtility.formatCurrencyAmountToLocaleString(
              amount,
              SUPPORTED_CURRENCIES.NGN.code,
            );

            const notificationConfig = this.inAppNotificationService.getTransactionNotificationConfig(
              TransactionType.WITHDRAWAL,
              formattedAmount,
              SUPPORTED_CURRENCIES.NGN.code,
              bank.accountName,
              undefined,
              bank.bankName,
              account_number,
            );

            await this.inAppNotificationService.createNotification({
              user_id: user.id,
              type: notificationConfig.type,
              title: notificationConfig.title,
              message: notificationConfig.message,
              metadata: {
                transaction_id: mainTransaction.transaction.id,
                transaction_reference: mainTransaction.transaction.reference,
                amount: formattedAmount,
                bank_name: bank.bankName,
                account_number: account_number,
                recipient_name: bank.accountName,
              },
            });

            // Send push notification for completed withdrawal
            const userProfile = await this.userProfileService.findByUserId(user.id);
            if (userProfile?.notification_token) {
              const pushConfig = this.pushNotificationService.getTransactionPushNotificationConfig(
                TransactionType.WITHDRAWAL,
                formattedAmount,
                SUPPORTED_CURRENCIES.NGN.code,
                bank.accountName,
              );

              await this.pushNotificationService.sendPushNotification([userProfile.notification_token], {
                title: pushConfig.title,
                body: pushConfig.body,
              });
            }
          } else if (status?.toLowerCase() === TransactionStatus.PENDING.toLowerCase()) {
            this.logger.log(
              `Transaction ${mainTransaction.transaction.id} is still pending at provider. ` +
                `Queueing background job to poll for final status.`,
            );

            await this.circuitBreakerService.recordAttempt(providerName, true);

            await this.ngnWithdrawalStatusProcessor.queueStatusPoll({
              transactionId: mainTransaction.transaction.id,
              fiatWalletTransactionId: mainTransaction.fiatWalletTransaction.id,
              userId: user.id,
              providerReference: response.transactionReference,
              amount: amount,
              recipientInfo: `${bank.accountName} - ****${account_number.slice(-4)}`,
              remark: remark,
            });
          }

          this.logger.log(
            `Withdrawal processing completed for transaction ${mainTransaction.transaction.id} with status: ${status}`,
          );

          return mainTransaction.fiatWalletTransaction;
        } catch (error) {
          this.logger.error(`Withdraw to external NG account failed for user ${user.id}`, error);

          if (mainTransaction) {
            this.logger.log(
              `Updating transaction ${mainTransaction.transaction.id} to FAILED due to error: ${error.message}`,
            );

            mainTransaction.transaction = await this.transactionRepository.update(mainTransaction.transaction.id, {
              status: TransactionStatus.FAILED,
              failure_reason: error.message,
              failed_at: DateTime.now().toSQL(),
            });

            mainTransaction.fiatWalletTransaction = await this.fiatWalletTransactionRepository.update(
              mainTransaction.fiatWalletTransaction.id,
              {
                status: TransactionStatus.FAILED,
                failure_reason: error.message,
                failed_at: DateTime.now().toSQL(),
              },
            );

            this.eventEmitterService.emit(EventEmitterEventsEnum.SERVICE_STATUS_FAILURE, {
              serviceKey: PlatformServiceKey.NGN_TRANSFER_OUT,
              reason: error.message,
            });

            await this.revertWithdrawalBalance(mainTransaction.transaction.id);
          }

          throw new InternalServerErrorException('Withdraw to external NG account failed');
        } finally {
          if (mainTransaction?.transaction?.id) {
            await this.withdrawalSessionService.endSession(user.id, mainTransaction.transaction.id);
            this.logger.log(`Withdrawal session ended for transaction ${mainTransaction.transaction.id}`);
          }
        }
      },
      { ttl: 30000, retryCount: 5, retryDelay: 500 },
    );
  }

  /**
   * Check if an error is a pre-API validation error
   */
  private isPreApiValidationError(error: any): boolean {
    const errorMessage = (error?.message || '').toLowerCase();

    const preApiErrorPatterns = [
      'paga ledger account not found',
      'insufficient balance',
      'invalid bank account',
      'account not found',
      'ledger account not found',
    ];

    for (const pattern of preApiErrorPatterns) {
      if (errorMessage.includes(pattern)) {
        return true;
      }
    }

    if (error?.name === 'BadRequestException' || error?.status === 400) {
      return true;
    }

    return false;
  }

  /**
   * Check if an error is a timeout or network error
   */
  private isTimeoutOrNetworkError(error: any): boolean {
    if (error?.code === 'ECONNABORTED' || error?.code === 'ETIMEDOUT' || error?.code === 'ECONNRESET') {
      return true;
    }

    if (error?.response === undefined && error?.request) {
      return true;
    }

    const status = error?.response?.status || error?.status;
    if (status >= 500 && status < 600) {
      return true;
    }

    const errorMessage = (error?.message || '').toLowerCase();
    if (
      errorMessage.includes('timeout') ||
      errorMessage.includes('econnaborted') ||
      errorMessage.includes('network error') ||
      errorMessage.includes('socket hang up')
    ) {
      return true;
    }

    return false;
  }

  /**
   * Create transaction records for Nigerian withdrawal
   */
  private async createNGTransactionAndFiatWalletTransaction(
    user: UserModel,
    idempotencyKey: string,
    withdrawDto: WithdrawToExternalNGAccountDto,
    wallet: FiatWalletModel & { virtualAccounts: VirtualAccountModel[] },
    amountWithFee: number,
    receiverBankDetails: VerifyBankAccountResponse,
  ) {
    const mainTransaction = await this.transactionRepository.transaction(async (trx) => {
      const amountInSmallestUnit = CurrencyUtility.formatCurrencyAmountToSmallestUnit(
        amountWithFee,
        SUPPORTED_CURRENCIES.NGN.code,
      );

      const freshWallet = await this.fiatWalletRepository.findById(wallet.id, undefined, trx);
      const initiatorBalanceBefore = Number(freshWallet.balance);
      const initiatorBalanceAfter = subtract(initiatorBalanceBefore, amountInSmallestUnit);

      if (initiatorBalanceBefore < amountInSmallestUnit) {
        throw new BadRequestException('Insufficient balance for withdrawal');
      }

      const feeInSmallestUnit = CurrencyUtility.formatCurrencyAmountToSmallestUnit(
        subtract(amountWithFee, withdrawDto.amount),
        SUPPORTED_CURRENCIES.NGN.code,
      );

      const parentTransactionReference = UtilsService.generateTransactionReference();

      const transaction = await this.transactionService.create(
        user.id,
        {
          amount: amountInSmallestUnit,
          asset: SUPPORTED_CURRENCIES.NGN.code,
          category: TransactionCategory.FIAT,
          transaction_scope: TransactionScope.EXTERNAL,
          status: TransactionStatus.INITIATED,
          balance_before: initiatorBalanceBefore,
          balance_after: initiatorBalanceAfter,
          reference: parentTransactionReference,
          transaction_type: TransactionType.TRANSFER_OUT,
          description: withdrawDto.remark || `Transfer of ${withdrawDto.amount} NGN to external account`,
          external_reference: parentTransactionReference,
          metadata: {
            source_user_id: user.id,
            source_currency: SUPPORTED_CURRENCIES.NGN.code,
            source_name: `${user.first_name} ${user.last_name}`,
            destination_bank: receiverBankDetails.bankName,
            destination_name: receiverBankDetails.accountName,
            destination_account_number: receiverBankDetails.accountNumber,
            destination_bank_code: receiverBankDetails.bankCode,
            destination_bank_ref: receiverBankDetails.bankRef,
            idempotency_key: idempotencyKey,
          },
        },
        trx,
      );

      const fiatWalletTransaction = await this.fiatWalletTransactionService.create(
        user.id,
        {
          amount: amountInSmallestUnit,
          currency: SUPPORTED_CURRENCIES.NGN.code,
          status: TransactionStatus.INITIATED,
          fiat_wallet_id: wallet.id,
          transaction_id: transaction.id,
          transaction_type: FiatWalletTransactionType.WITHDRAWAL,
          provider_reference: transaction.reference,
          balance_before: initiatorBalanceBefore,
          balance_after: initiatorBalanceAfter,
          idempotency_key: idempotencyKey,
          provider_metadata: {
            source_user_id: user.id,
            source_currency: SUPPORTED_CURRENCIES.NGN.code,
            source_name: `${user.first_name} ${user.last_name}`,
            destination_bank: receiverBankDetails.bankName,
            destination_name: receiverBankDetails.accountName,
            destination_account_number: receiverBankDetails.accountNumber,
            destination_bank_code: receiverBankDetails.bankCode,
          },
          destination: `${receiverBankDetails.bankName} / ${receiverBankDetails.accountName} / ${receiverBankDetails.accountNumber}`,
          source: `${user.first_name} ${user.last_name}`,
          description: withdrawDto.remark || `Transfer of ${withdrawDto.amount} NGN to external account`,
          provider_fee: feeInSmallestUnit,
          provider: this.waasAdapter.getProviderName(),
        },
        trx,
      );

      return {
        transaction,
        fiatWalletTransaction,
      };
    });

    return mainTransaction;
  }

  /**
   * Send real-time notifications when withdrawal is initiated
   */
  private async sendWithdrawalInitiatedNotification(
    user: UserModel,
    amount: number,
    destination: string,
    transaction: TransactionModel,
    fiatWalletTransaction: FiatWalletTransactionModel,
  ): Promise<void> {
    try {
      const currency = fiatWalletTransaction.currency;
      const formattedAmount = CurrencyUtility.formatCurrencyAmountToMainUnit(
        fiatWalletTransaction.amount,
        currency,
      ).toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });

      // Send in-app notification
      const notificationConfig = this.inAppNotificationService.getTransactionNotificationConfig(
        'withdrawal_initiated',
        formattedAmount,
        currency,
      );

      await this.inAppNotificationService.createNotification({
        user_id: user.id,
        type: notificationConfig.type,
        title: notificationConfig.title,
        message: notificationConfig.message,
        metadata: {
          transaction_id: transaction.id,
          transaction_reference: transaction.reference,
          amount: fiatWalletTransaction.amount,
          currency: currency,
          destination: destination,
          status: TransactionStatus.INITIATED,
        },
      });

      // Send push notification
      const userProfile = await this.userProfileService.findByUserId(user.id);
      if (userProfile?.notification_token) {
        const pushConfig = this.pushNotificationService.getTransactionPushNotificationConfig(
          'withdrawal_initiated',
          formattedAmount,
          currency,
        );

        await this.pushNotificationService.sendPushNotification([userProfile.notification_token], {
          title: pushConfig.title,
          body: pushConfig.body,
          data: {
            type: 'withdrawal_initiated',
            transaction_id: transaction.id,
            transaction_reference: transaction.reference,
            amount: formattedAmount,
            currency: currency,
            destination: destination,
          },
        });
      }

      // Send email notification
      await this.mailerService.send(
        new WithdrawalInitiatedMail(
          user,
          amount,
          currency,
          transaction.id,
          destination,
          fiatWalletTransaction.provider_fee,
        ),
      );

      this.logger.log(`Withdrawal initiation notifications sent successfully for transaction ${transaction.id}`);
    } catch (error) {
      this.logger.error(
        `Failed to send withdrawal initiation notifications for transaction ${transaction.id}: ${error.message}`,
        error,
      );
    }
  }

  /**
   * Reserve withdrawal balance by deducting from wallet and moving to escrow
   */
  private async reserveWithdrawalBalance(params: {
    amount: number;
    mainTransaction: { transaction: TransactionModel; fiatWalletTransaction: FiatWalletTransactionModel };
    withdrawDto: WithdrawToExternalNGAccountDto;
    activeVirtualAccount: VirtualAccountModel;
    bank: VerifyBankAccountResponse;
    remark?: string;
  }): Promise<number> {
    const { amount, mainTransaction, withdrawDto, activeVirtualAccount, bank, remark } = params;
    const { account_number } = withdrawDto;

    const amountInSmallestUnit = CurrencyUtility.formatCurrencyAmountToSmallestUnit(
      amount,
      SUPPORTED_CURRENCIES.NGN.code,
    );

    this.logger.log(`Reserving balance: -${amountInSmallestUnit} for transaction ${mainTransaction.transaction.id}`);

    await this.updateBalance(
      mainTransaction.fiatWalletTransaction.fiat_wallet_id,
      -amountInSmallestUnit,
      mainTransaction.transaction.id,
      FiatWalletTransactionType.WITHDRAWAL,
      TransactionStatus.INITIATED,
      {
        description:
          `Withdrawal of ${withdrawDto.amount} from NGN to external account` + (remark ? ` - ${remark}` : ''),
        source: activeVirtualAccount.account_number,
        destination: account_number,
        fiat_wallet_transaction_id: mainTransaction.fiatWalletTransaction.id,
        provider: this.waasAdapter.getProviderName(),
        provider_reference: mainTransaction.transaction.reference,
        provider_metadata: {
          source: activeVirtualAccount.account_number,
          destination: account_number,
          description:
            `Withdrawal of ${withdrawDto.amount} from NGN to external account` + (remark ? ` - ${remark}` : ''),
          source_bank: this.waasAdapter.getBankCode(),
          source_name: activeVirtualAccount.account_name,
          destination_bank: bank.bankName,
          destination_name: bank.accountName,
          destination_account_number: account_number,
        },
      },
    );

    await this.fiatWalletEscrowService.moveMoneyToEscrow(mainTransaction.transaction.id, amountInSmallestUnit);

    this.logger.log(`Balance reserved successfully for transaction ${mainTransaction.transaction.id}`);

    return amountInSmallestUnit;
  }

  public async revertWithdrawalBalance(transactionId: string): Promise<number> {
    this.logger.log(`Reverting withdrawal balance for transaction ${transactionId}`);
    // verify if the transaction is failed
    const transaction = await this.transactionRepository.findById(transactionId);
    if (transaction.status !== TransactionStatus.FAILED) {
      this.logger.error(`Transaction ${transactionId} is not failed, skipping revert`);
      return;
    }

    const fiatWalletTransaction = await this.fiatWalletTransactionRepository.findOne({
      transaction_id: transactionId,
    });

    if (!fiatWalletTransaction) {
      this.logger.error(`Fiat wallet transaction not found for transaction ${transactionId}, skipping revert`);
      return;
    }

    const escrowAmount = await this.fiatWalletEscrowService.getEscrowAmount(transactionId);

    if (escrowAmount === 0) {
      this.logger.error(`No escrow amount found for transaction ${transactionId}, skipping revert`);
      return;
    }

    await this.updateBalance(
      fiatWalletTransaction.fiat_wallet_id,
      escrowAmount,
      transactionId,
      FiatWalletTransactionType.WITHDRAWAL,
      TransactionStatus.FAILED,
      {
        description: `Withdrawal of ${transaction.amount} from NGN to external account`,
        source: fiatWalletTransaction.source,
        destination: fiatWalletTransaction.destination,
        fiat_wallet_transaction_id: fiatWalletTransaction.id,
        provider: this.waasAdapter.getProviderName(),
        provider_reference: transaction.reference,
      },
    );

    await this.fiatWalletEscrowService.releaseMoneyFromEscrow(transactionId);

    this.logger.log(`Withdrawal balance reverted successfully for transaction ${transactionId}`);

    return escrowAmount;
  }
}
