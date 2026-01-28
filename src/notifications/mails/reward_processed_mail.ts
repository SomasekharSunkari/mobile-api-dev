import { CurrencyUtility } from '../../currencies';
import { UserModel } from '../../database';
import { MailerManager } from '../../services/queue/processors/mailer/mailer.interface';

export class RewardProcessedMail implements MailerManager {
  public subject = 'Crypto Rewards Receipt';
  public view = 'reward_processed';

  public to: string;

  constructor(
    public readonly user: Partial<UserModel>,
    public readonly amount: number, // in main unit (e.g., dollars)
    public readonly currency: string,
    public readonly transactionId: string,
    public readonly newBalance: number,
    public readonly description?: string,
    public readonly accountId?: string,
    public readonly orderNumber?: string,
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
      transactionDate: new Date().toLocaleString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      }),
      description: this.description || 'First deposit match reward',
      accountId: this.accountId,
      orderNumber: this.orderNumber,
    };
  }
}
