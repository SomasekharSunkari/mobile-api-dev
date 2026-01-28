import { UserModel } from '../../database';
import { MailerManager } from '../../services/queue/processors/mailer/mailer.interface';

export class CardTransactionDeclinedMail implements MailerManager {
  public subject = 'Payment Declined - Onedosh Card';
  public view = 'card_transaction_declined';

  public to: string;

  constructor(
    public readonly user: Partial<UserModel>,
    public readonly amount: number,
    public readonly currency: string,
    public readonly merchantName: string,
  ) {
    this.to = user.email;
  }

  async prepare(): Promise<Record<string, any>> {
    const formattedAmount = this.amount.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

    return {
      username: this.user.first_name || 'User',
      amount: this.amount,
      formattedAmount,
      currency: this.currency,
      merchantName: this.merchantName,
      transactionDate: new Date().toLocaleString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        timeZoneName: 'short',
      }),
    };
  }
}
