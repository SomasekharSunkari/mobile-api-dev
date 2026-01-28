import { CurrencyUtility, SUPPORTED_CURRENCIES } from '../../currencies';
import { UserModel } from '../../database';
import { MailerManager } from '../../services/queue/processors/mailer/mailer.interface';

export class NgDepositMail implements MailerManager {
  public subject = 'Wallet Funding Successful';
  public view = 'ng_deposit';

  public to: string;

  constructor(
    public readonly user: Partial<UserModel>,
    public readonly transactionId: string,
    public readonly amount: number,
    public readonly description?: string,
    public readonly bank?: string,
    public readonly transactionDate?: string,
  ) {
    this.to = this.user.email;
  }

  async prepare(): Promise<Record<string, any>> {
    const formattedAmount = CurrencyUtility.formatCurrencyAmountToLocaleString(
      CurrencyUtility.formatCurrencyAmountToMainUnit(this.amount, SUPPORTED_CURRENCIES.NGN.code),
      SUPPORTED_CURRENCIES.NGN.code,
    );

    return {
      username: this.user.first_name || 'User',
      amount: this.amount,
      formattedAmount,
      transactionId: this.transactionId,
      transactionDate: this.transactionDate,
      description: this.description,
      bank: this.bank,
    };
  }
}
