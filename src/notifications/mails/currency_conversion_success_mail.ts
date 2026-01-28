import { UserModel } from '../../database';
import { MailerManager } from '../../services/queue/processors/mailer/mailer.interface';

export interface CurrencyConversionSuccessData {
  fromCurrency?: string;
  toCurrency?: string;
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

export class CurrencyConversionSuccessMail implements MailerManager {
  public subject = 'Withdrawal & Exchange Processed';
  public view = 'currency_conversion_success';

  public to: string;

  constructor(
    public readonly user: Partial<UserModel>,
    public readonly conversionData: CurrencyConversionSuccessData,
  ) {
    this.to = user.email;
  }

  async prepare(): Promise<Record<string, any>> {
    return {
      username: this.user.first_name || this.user.username || 'Valued Customer',
      ...this.conversionData,
      receivingInstitution: this.conversionData.receivingInstitution || 'YC Financial Inc.',
    };
  }
}
