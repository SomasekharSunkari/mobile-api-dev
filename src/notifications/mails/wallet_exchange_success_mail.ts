import { UserModel } from '../../database';
import { MailerManager } from '../../services/queue/processors/mailer/mailer.interface';

export interface WalletExchangeSuccessData {
  fromCurrency?: string;
  toCurrency?: string;
  toCountry?: string;
  formattedAmount?: string;
  formattedLocalAmount?: string;
  transactionId?: string;
  transactionDate?: string;
  description?: string;
  accountId?: string;
  orderNumber?: string;
  walletAddress?: string;
  receivingInstitution?: string;
  senderName?: string;
  recipientName?: string;
  recipientLocation?: string;
  exchangeRate?: string;
  formattedFee?: string;
  formattedTotal?: string;
  availableDate?: string;
}

export class WalletExchangeSuccessMail implements MailerManager {
  public subject = 'Withdrawal & Exchange Processed - OneDosh';
  public view = 'wallet_exchange_success';

  public to: string;

  constructor(
    public readonly user: Partial<UserModel>,
    public readonly exchangeData: WalletExchangeSuccessData,
  ) {
    this.to = user.email;
  }

  async prepare(): Promise<Record<string, any>> {
    // Format exchange rate as "$1 → ₦1,580.00"
    const formattedExchangeRate = this.exchangeData.exchangeRate ? `$1 ~ ${this.exchangeData.exchangeRate}` : undefined;

    return {
      username: this.user.first_name || this.user.username || 'Valued Customer',
      ...this.exchangeData,
      exchangeRate: formattedExchangeRate,
      receivingInstitution: this.exchangeData.receivingInstitution || 'YC Financial Inc.',
    };
  }
}
