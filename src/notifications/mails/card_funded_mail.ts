import { CurrencyUtility } from '../../currencies';
import { UserModel } from '../../database';
import { MailerManager } from '../../services/queue/processors/mailer/mailer.interface';

export class CardFundedMail implements MailerManager {
  public subject = 'Card Funding Successful';
  public view = 'card_funded';

  public to: string;

  constructor(
    public readonly user: Partial<UserModel>,
    public readonly amount: number,
    public readonly currency: string,
    public readonly transactionId: string,
    public readonly newBalance: number,
    public readonly cardId?: string,
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
      currency: this.currency.toUpperCase(),
      currencySymbol,
      transactionId: this.transactionId,
      newBalance: this.newBalance,
      formattedNewBalance,
      cardId: this.cardId,
      hasPositiveBalance: this.newBalance >= 0,
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
