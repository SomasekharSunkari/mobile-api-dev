import { CurrencyUtility } from '../../currencies';
import { UserModel } from '../../database';
import { MailerManager } from '../../services/queue/processors/mailer/mailer.interface';

export class NgFundsReceivedMail implements MailerManager {
  public subject = 'Funds Received!';
  public view = 'ngn_funds_received';

  public to: string;

  constructor(
    public readonly user: Partial<UserModel>,
    public readonly sender: string,
    public readonly amount: number,
    public readonly currency: string,
  ) {
    this.to = this.user.email;
  }

  async prepare(): Promise<Record<string, any>> {
    const formattedAmount = CurrencyUtility.formatCurrencyAmountToLocaleString(this.amount, this.currency);

    return {
      username: this.user.first_name || 'User',
      amount: this.amount,
      formattedAmount,
      sender: this.sender,
    };
  }
}
