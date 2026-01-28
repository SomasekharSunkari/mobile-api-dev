import { UserModel } from '../../database';
import { MailerManager } from '../../services/queue/processors/mailer/mailer.interface';

export interface NgBankTransferSuccessData {
  amount: number;
  formattedAmount: string;
  fee: number;
  formattedFee: string;
  transactionReference: string;
  transactionDate: string;
  description?: string;
  senderName: string;
  recipientName: string;
  recipientBank: string;
  recipientAccountNumber: string;
}

export class NgBankTransferSuccessMail implements MailerManager {
  public subject = 'Bank Transfer Successful - OneDosh';
  public view = 'ng_bank_transfer_success';

  public to: string;

  constructor(
    public readonly user: Partial<UserModel>,
    public readonly transferData: NgBankTransferSuccessData,
  ) {
    this.to = user.email;
  }

  async prepare(): Promise<Record<string, any>> {
    return {
      username: this.user.first_name || this.user.username || 'Valued Customer',
      ...this.transferData,
    };
  }
}
