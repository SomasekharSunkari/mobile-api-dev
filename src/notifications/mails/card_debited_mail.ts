import { CurrencyUtility } from '../../currencies';
import { UserModel } from '../../database';
import { MailerManager } from '../../services/queue/processors/mailer/mailer.interface';

export class CardDebitedMail implements MailerManager {
  public subject = 'Payment Successful- OneDosh Card';
  public view = 'card_debited';

  public to: string;

  constructor(
    public readonly user: Partial<UserModel>,
    public readonly amount: number,
    public readonly currency: string,
    public readonly transactionId: string,
    public readonly newBalance: number,
    public readonly merchantName: string,
    public readonly cardId?: string,
    public readonly merchantLocation?: string,
  ) {
    this.to = user.email;
  }

  async prepare(): Promise<Record<string, any>> {
    const currency = CurrencyUtility.getCurrency(this.currency);
    const currencySymbol = currency?.symbol || this.currency;

    const formattedAmount = Math.abs(this.amount).toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

    const formattedNewBalance = this.newBalance.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

    return {
      username: this.user.first_name || 'User',
      amount: this.amount,
      formattedAmount,
      currency: this.currency,
      currencySymbol,
      transactionId: this.transactionId,
      newBalance: this.newBalance,
      formattedNewBalance,
      cardId: this.cardId,
      merchantName: this.merchantName,
      merchantLocation: this.merchantLocation,
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
