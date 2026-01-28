import { UserModel } from '../../database';
import { MailerManager } from '../../services/queue/processors/mailer/mailer.interface';

export interface MoneyTransferSuccessData {
  amount: number;
  currency: string;
  currencySymbol?: string;
  formattedAmount?: string;
  fee?: number;
  formattedFee?: string;
  transactionReference?: string;
  transactionDate?: string;
  description?: string;
  senderName?: string;
  recipientName?: string;
  recipientAccount?: string;
  walletName?: string;
}

export class MoneyTransferSuccessMail implements MailerManager {
  public subject = 'Money Transfer Successful - OneDosh';
  public view = 'money_transfer_success';

  public to: string;

  constructor(
    public readonly user: Partial<UserModel>,
    public readonly transferData: MoneyTransferSuccessData,
  ) {
    this.to = user.email;
  }

  async prepare(): Promise<Record<string, any>> {
    return {
      username: this.user.first_name || this.user.username || 'Valued Customer',
      ...this.transferData,
      formattedAmount: this.transferData.formattedAmount || this.transferData.amount,
    };
  }
}
