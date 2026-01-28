import { Inject, Injectable } from '@nestjs/common';
import { Notification } from '@notifee/react-native';
import { Currency, CurrencyCode, CurrencyUtility } from '../../currencies/currencies';
import { TransactionType } from '../../database/models/transaction/transaction.interface';
import { FirebaseService } from './firebase/firebase.service';

@Injectable()
export class PushNotificationService {
  @Inject(FirebaseService)
  private readonly pushNotificationAdapter: FirebaseService;

  public async sendPushNotification(tokens: string[], notification: Notification) {
    tokens = tokens.filter((token) => typeof token === 'string');
    return this.pushNotificationAdapter.sendPushNotification(tokens, notification);
  }

  // Get push notification config - shorter messages than in-app notifications
  public getTransactionPushNotificationConfig(
    transactionType: string,
    formattedAmount: string,
    asset: string,
    recipientName?: string,
    senderName?: string,
  ): {
    title: string;
    body: string;
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

    // Strip symbol if already present in formattedAmount
    let cleanAmount = formattedAmount;
    if (currencyInfo?.symbol && formattedAmount.startsWith(currencyInfo.symbol)) {
      cleanAmount = formattedAmount.substring(currencyInfo.symbol.length);
    }

    switch (transactionType) {
      case TransactionType.DEPOSIT:
        return this.getDepositPushConfig(currencyInfo, cleanAmount);

      case TransactionType.WITHDRAWAL:
        return this.getWithdrawalPushConfig(currencyInfo, cleanAmount, recipientName);

      case 'withdrawal_initiated':
        return this.getWithdrawalInitiatedPushConfig(currencyInfo, cleanAmount);

      case TransactionType.TRANSFER_IN:
        return this.getTransferInPushConfig(currencyInfo, cleanAmount, senderName);

      case TransactionType.TRANSFER_OUT:
        return this.getTransferOutPushConfig(currencyInfo, cleanAmount, recipientName);

      case TransactionType.EXCHANGE:
        return this.getExchangePushConfig(currencyInfo, cleanAmount);

      case TransactionType.REWARD:
        return this.getRewardPushConfig(cleanAmount);

      default:
        return this.getDefaultPushConfig(currencyInfo, cleanAmount);
    }
  }

  private getDepositPushConfig(currencyInfo: Currency, formattedAmount: string) {
    if (currencyInfo.code === CurrencyCode.USD) {
      return {
        title: 'USD Deposit',
        body: `Added ${currencyInfo.symbol}${formattedAmount} ${currencyInfo.displayName} to your US wallet.`,
      };
    }

    if (currencyInfo.code === CurrencyCode.NGN) {
      return {
        title: 'NGN Deposit',
        body: `Added ${currencyInfo.symbol}${formattedAmount} to your NGN wallet.`,
      };
    }

    return {
      title: 'Deposit',
      body: `Added ${currencyInfo.symbol}${formattedAmount} to your wallet.`,
    };
  }

  private getWithdrawalPushConfig(currencyInfo: Currency, formattedAmount: string, recipientName?: string) {
    if (currencyInfo.code === CurrencyCode.USD) {
      return {
        title: 'USD Withdraw',
        body: `You have withdrawn ${currencyInfo.symbol}${formattedAmount} to your bank`,
      };
    }

    if (currencyInfo.code === CurrencyCode.NGN) {
      const recipientInfo = recipientName ? ` to ${recipientName}'s bank account` : ' to your bank';
      return {
        title: 'NGN withdraw',
        body: `You sent ${currencyInfo.symbol}${formattedAmount}${recipientInfo}`,
      };
    }

    // Handles all other currencies (default)
    return {
      title: 'Withdrawal',
      body: `You have withdrawn ${currencyInfo.symbol}${formattedAmount} to your bank`,
    };
  }

  private getWithdrawalInitiatedPushConfig(currencyInfo: Currency, formattedAmount: string) {
    // Handles all currencies
    return {
      title: 'Withdrawal Initiated',
      body: `Your withdrawal of ${currencyInfo.symbol}${formattedAmount} has been initiated and funds have been reserved.`,
    };
  }

  private getTransferInPushConfig(
    currencyInfo: Currency,
    formattedAmount: string,
    senderName: string = 'another user',
  ) {
    if (currencyInfo.code === CurrencyCode.USD) {
      return {
        title: 'Transfer',
        body: `You've received ${currencyInfo.symbol}${formattedAmount} ${currencyInfo.displayName} from ${senderName}`,
      };
    }

    // Handles NGN and all other currencies
    return {
      title: 'Transfer',
      body: `You've received ${currencyInfo.symbol}${formattedAmount} from ${senderName}`,
    };
  }

  private getTransferOutPushConfig(
    currencyInfo: Currency,
    formattedAmount: string,
    recipientName: string = 'another user',
  ) {
    if (currencyInfo.code === CurrencyCode.USD) {
      return {
        title: 'Transfer',
        body: `You sent ${currencyInfo.symbol}${formattedAmount} ${currencyInfo.displayName} to ${recipientName}`,
      };
    }

    // Handles NGN and all other currencies
    return {
      title: 'Transfer',
      body: `You sent ${currencyInfo.symbol}${formattedAmount} to ${recipientName}`,
    };
  }

  private getExchangePushConfig(currencyInfo: Currency, formattedAmount: string) {
    // Handles USD, NGN, and all other currencies
    return {
      title: 'Exchange',
      body: `${currencyInfo.symbol}${formattedAmount} ${currencyInfo.displayName} has been successfully exchanged`,
    };
  }

  private getRewardPushConfig(formattedAmount: string) {
    return {
      title: 'Reward Received!',
      body: `You received a $${formattedAmount} USDC deposit reward for your first deposit.`,
    };
  }

  private getDefaultPushConfig(currencyInfo: Currency, formattedAmount: string) {
    return {
      title: 'Transaction Completed',
      body: `Your ${currencyInfo.symbol}${formattedAmount} transaction has been completed successfully.`,
    };
  }
}
