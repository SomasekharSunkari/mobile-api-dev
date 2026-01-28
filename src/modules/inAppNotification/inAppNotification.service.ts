import { Inject, Injectable, Logger } from '@nestjs/common';
import { Currency, CurrencyCode, CurrencyUtility } from '../../currencies/currencies';
import { IPaginatedResponse, Pagination } from '../../database/base/base.interface';
import { InAppNotificationModel } from '../../database/models/InAppNotification/InAppNotification.model';
import { TransactionType } from '../../database/models/transaction/transaction.interface';
import { EventEmitterEventsEnum } from '../../services/eventEmitter/eventEmitter.interface';
import { EventEmitterService } from '../../services/eventEmitter/eventEmitter.service';
import { CreateInAppNotificationDto } from './dtos/createUserNotification.dto';
import { IN_APP_NOTIFICATION_TYPE } from './inAppNotification.enum';
import { InAppNotificationRepository } from './inAppNotification.repository';

@Injectable()
export class InAppNotificationService {
  @Inject(InAppNotificationRepository)
  private readonly notificationRepository: InAppNotificationRepository;

  private readonly logger = new Logger(InAppNotificationService.name);

  @Inject(EventEmitterService)
  private readonly eventEmitterService: EventEmitterService;

  async createNotification(data: CreateInAppNotificationDto): Promise<InAppNotificationModel> {
    this.logger.log(`Creating notification for userId: ${data.user_id}`);
    const notification = await this.notificationRepository.create(data);

    // Compute unread count here (source of truth) and emit via event emitter
    let unreadCount = 0;
    try {
      unreadCount = await this.notificationRepository.countUnreadByUserId(notification.user_id);
    } catch {
      this.logger.warn('Failed to compute unreadCount, defaulting to 0');
    }

    // Emit event after creation
    try {
      this.logger.log(
        `[NOTIFICATION] Emitting IN_APP_NOTIFICATION_CREATED event for user ${notification.user_id} with unread_count: ${unreadCount}`,
      );
      const emitResult = this.eventEmitterService.emit(EventEmitterEventsEnum.IN_APP_NOTIFICATION_CREATED, {
        userId: notification.user_id,
        notificationId: notification.id,
        unread_count: unreadCount,
        timestamp: new Date(),
      });
      this.logger.log(`[NOTIFICATION] Event emission result: ${emitResult}`);
    } catch (e) {
      this.logger.error(
        `[NOTIFICATION] Failed to emit IN_APP_NOTIFICATION_CREATED for notification ${notification.id}`,
        e as Error,
      );
    }

    return notification;
  }

  async findNotificationById(notificationId: string): Promise<InAppNotificationModel | undefined> {
    this.logger.log(`Finding notification by id: ${notificationId}`);
    const notification = (await this.notificationRepository.findById(notificationId)) as unknown as
      | InAppNotificationModel
      | undefined;
    if (notification && !notification.is_read) {
      this.logger.log(`Marking notification as read: ${notificationId}`);
      // Update in background
      this.notificationRepository.update(notificationId, { is_read: true } as any).catch((error) => {
        this.logger.error(`Failed to mark notification ${notificationId} as read`, error);
      });
    }
    return notification;
  }

  async findAllNotificationsByUser(
    userId: string,
    pagination: Pagination,
  ): Promise<IPaginatedResponse<InAppNotificationModel>> {
    this.logger.log(`Finding all notifications for userId: ${userId}`);

    // Handle pagination - convert to numbers since query params come as strings
    // Support both 'size' and 'limit' parameters for backward compatibility
    const page = Number(pagination.page) || 1;
    const limit = Number(pagination.limit || pagination.size) || 10;
    const offset = (page - 1) * limit;

    const notifications = this.notificationRepository
      .query()
      .where({ user_id: userId })
      .orderBy('created_at', 'desc')
      .limit(limit)
      .offset(offset);

    const paginatedNotifications = await this.notificationRepository.paginateData(notifications as any, limit, page);

    const unreadNotificationIds = paginatedNotifications.in_app_notifications
      .filter((notification) => !notification.is_read)
      .map((notification) => notification.id);

    if (unreadNotificationIds.length > 0) {
      this.logger.log(`Marking ${unreadNotificationIds.length} unread notifications as read for userId: ${userId}`);
      await this.notificationRepository.markNotificationsAsRead(userId, unreadNotificationIds);
    }
    return paginatedNotifications;
  }

  public getTransactionNotificationConfig(
    transactionType: string,
    formattedAmount: string,
    asset: string,
    recipientName?: string,
    senderName?: string,
    bankName?: string,
    accountNumber?: string,
  ): {
    type: IN_APP_NOTIFICATION_TYPE;
    title: string;
    message: string;
  } {
    const currencyInfo = CurrencyUtility.getCurrency(asset) || {
      code: asset?.toUpperCase() || '',
      numericCode: '',
      name: asset || '',
      symbol: '',
      minorUnit: 100,
      country: '',
      countryCode: '',
      displayName: asset?.toUpperCase() || '',
      walletName: 'Wallet',
    };

    // Check if symbol is already present in formattedAmount and strip it out
    let cleanAmount = formattedAmount;
    if (currencyInfo?.symbol && formattedAmount.startsWith(currencyInfo.symbol)) {
      cleanAmount = formattedAmount.substring(currencyInfo.symbol.length);
    }

    // Each transaction type is extracted into its own method to reduce cognitive complexity
    switch (transactionType) {
      case TransactionType.DEPOSIT:
        return this.getDepositConfig(currencyInfo, cleanAmount, bankName, accountNumber);

      case TransactionType.WITHDRAWAL:
        return this.getWithdrawalConfig(currencyInfo, cleanAmount, recipientName, bankName, accountNumber);

      case 'withdrawal_initiated':
        return this.getWithdrawalInitiatedConfig(currencyInfo, cleanAmount);

      case TransactionType.TRANSFER_IN:
        return this.getTransferInConfig(currencyInfo, cleanAmount, senderName);

      case TransactionType.TRANSFER_OUT:
        return this.getTransferOutConfig(currencyInfo, cleanAmount, recipientName);

      case TransactionType.EXCHANGE:
        return this.getExchangeConfig(currencyInfo, cleanAmount);

      case TransactionType.REWARD:
        return this.getRewardConfig(cleanAmount);

      default:
        return this.getDefaultConfig(currencyInfo, cleanAmount);
    }
  }

  private getDepositConfig(currencyInfo: Currency, formattedAmount: string, bankName?: string, accountNumber?: string) {
    const bankInfo = bankName && accountNumber ? ` via ${bankName} (**${accountNumber.slice(-4)})` : '';

    if (currencyInfo.code === CurrencyCode.NGN) {
      return {
        type: IN_APP_NOTIFICATION_TYPE.TRANSACTION_SUCCESS,
        title: 'Funding Successful',
        message: `${currencyInfo.symbol}${formattedAmount} was successfully added to your ${currencyInfo.walletName}${bankInfo}. A receipt has also been sent to your email`,
      };
    }

    // Handles USD and all other currencies
    return {
      type: IN_APP_NOTIFICATION_TYPE.TRANSACTION_SUCCESS,
      title: 'Transaction Completed',
      message: `${currencyInfo.symbol}${formattedAmount} ${currencyInfo.displayName} added to your ${currencyInfo.walletName}${bankInfo}. A receipt has also been sent to your email`,
    };
  }

  private getWithdrawalConfig(
    currencyInfo: Currency,
    formattedAmount: string,
    recipientName?: string,
    bankName?: string,
    accountNumber?: string,
  ) {
    if (currencyInfo.code === CurrencyCode.NGN) {
      // NGN format: "to {recipientName}'s {bankName}" - no "bank account" text, no account number
      const ngnBankInfo = bankName && recipientName ? ` to ${recipientName}'s ${bankName}` : '';
      return {
        type: IN_APP_NOTIFICATION_TYPE.TRANSACTION_SUCCESS,
        title: 'Transfer Completed',
        message: `You sent ${currencyInfo.symbol}${formattedAmount}${ngnBankInfo} successfully. A receipt has also been sent to your email`,
      };
    }

    // Handles USD and all other currencies: include "bank account" and account number
    let withdrawalBankInfo = '';
    if (bankName && accountNumber) {
      const accountPrefix = recipientName ? `${recipientName}'s ` : 'your linked ';
      const accountSuffix = `(**${accountNumber.slice(-4)})`;
      withdrawalBankInfo = ` to ${accountPrefix}${bankName} bank account ${accountSuffix}`;
    }

    return {
      type: IN_APP_NOTIFICATION_TYPE.TRANSACTION_SUCCESS,
      title: 'Withdrawal Completed',
      message: `${currencyInfo.symbol}${formattedAmount} has been successfully withdrawn${withdrawalBankInfo}. A receipt has also been sent to your email.`,
    };
  }

  private getWithdrawalInitiatedConfig(currencyInfo: Currency, formattedAmount: string) {
    // Handles all currencies
    const assetDisplay = currencyInfo.symbol ? '' : currencyInfo.displayName;
    return {
      type: IN_APP_NOTIFICATION_TYPE.WITHDRAWAL_INITIATED,
      title: 'Withdrawal Initiated',
      message: `Your withdrawal of ${currencyInfo.symbol}${formattedAmount}${assetDisplay} has been initiated and funds have been reserved. If you didn't make this request, contact support immediately.`,
    };
  }

  private getTransferInConfig(currencyInfo: Currency, formattedAmount: string, senderName?: string) {
    if (currencyInfo.code === CurrencyCode.USD) {
      return {
        type: IN_APP_NOTIFICATION_TYPE.TRANSACTION_SUCCESS,
        title: "You've Received Money",
        message: `You just received ${currencyInfo.symbol}${formattedAmount} ${currencyInfo.displayName} from ${senderName || 'another user'}. The funds are now available in your OneDosh wallet. A receipt has also been sent to your email`,
      };
    }

    // Handles NGN and all other currencies
    return {
      type: IN_APP_NOTIFICATION_TYPE.TRANSACTION_SUCCESS,
      title: "You've Received Money",
      message: `You just received ${currencyInfo.symbol}${formattedAmount} from ${senderName || 'another user'}. The funds are now available in your OneDosh wallet. A receipt has also been sent to your email`,
    };
  }

  private getTransferOutConfig(currencyInfo: Currency, formattedAmount: string, recipientName?: string) {
    if (currencyInfo.code === CurrencyCode.USD) {
      return {
        type: IN_APP_NOTIFICATION_TYPE.TRANSACTION_SUCCESS,
        title: 'Transaction Completed',
        message: `You sent ${currencyInfo.symbol}${formattedAmount} ${currencyInfo.displayName} to ${recipientName || 'another user'} successfully. A receipt has also been sent to your email`,
      };
    }

    // Handles NGN and all other currencies
    return {
      type: IN_APP_NOTIFICATION_TYPE.TRANSACTION_SUCCESS,
      title: 'Transaction Completed',
      message: `You sent ${currencyInfo.symbol}${formattedAmount} to ${recipientName || 'another user'} successfully. A receipt has also been sent to your email`,
    };
  }

  private getExchangeConfig(currencyInfo: Currency, formattedAmount: string) {
    if (currencyInfo.code === CurrencyCode.USD) {
      return {
        type: IN_APP_NOTIFICATION_TYPE.TRANSACTION_SUCCESS,
        title: 'Withdrawal & Exchange Processed',
        message: `${currencyInfo.symbol}${formattedAmount} ${currencyInfo.displayName} withdrawal & exchange has been successfully processed, and the funds have been deposited into your NGN wallet. A receipt has also been sent to your email.`,
      };
    }

    if (currencyInfo.code === CurrencyCode.NGN) {
      return {
        type: IN_APP_NOTIFICATION_TYPE.TRANSACTION_SUCCESS,
        title: 'Withdrawal & Exchange Processed',
        message: `${currencyInfo.symbol}${formattedAmount} withdrawal & exchange has been successfully processed, and the funds have been deposited into your US wallet. A receipt has also been sent to your email.`,
      };
    }

    // Handles all other currencies (default)
    return {
      type: IN_APP_NOTIFICATION_TYPE.TRANSACTION_SUCCESS,
      title: 'Withdrawal & Exchange Processed',
      message: `${currencyInfo.symbol}${formattedAmount} withdrawal & exchange has been successfully processed. A receipt has also been sent to your email.`,
    };
  }

  private getRewardConfig(formattedAmount: string) {
    return {
      type: IN_APP_NOTIFICATION_TYPE.REWARDS,
      title: 'Reward Received!',
      message: `You received a $${formattedAmount} USDC deposit reward for your first deposit. A receipt has been sent to your email.`,
    };
  }

  private getDefaultConfig(currencyInfo: Currency, formattedAmount: string) {
    return {
      type: IN_APP_NOTIFICATION_TYPE.TRANSACTION_SUCCESS,
      title: 'Transaction Completed Successfully',
      message: `Your ${currencyInfo.symbol}${formattedAmount} ${currencyInfo.displayName} transaction has been completed successfully. A receipt has also been sent to your email.`,
    };
  }
}
