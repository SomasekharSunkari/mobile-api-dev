import { CurrencyUtility } from '../../currencies';
import { UserModel } from '../../database';
import { MailerManager } from '../../services/queue/processors/mailer/mailer.interface';

export class WithdrawalInitiatedMail implements MailerManager {
  public subject = 'Withdrawal Initiated - Action Required';
  public view = 'withdrawal_initiated';

  public to: string;

  constructor(
    public readonly user: Partial<UserModel>,
    public readonly amount: number, // in main unit (e.g., naira)
    public readonly currency: string,
    public readonly transactionId: string,
    public readonly destination: string, // Bank name and masked account number
    public readonly providerFee?: number, // in smallest unit (kobo)
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

    // Calculate fees
    const feeAmount = this.providerFee
      ? CurrencyUtility.formatCurrencyAmountToMainUnit(this.providerFee, this.currency) || 0
      : 0;
    const fees =
      feeAmount === 0
        ? `${currencySymbol}${feeAmount.toFixed(0)}`
        : `${currencySymbol}${feeAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

    const totalAmount = Math.abs(this.amount) + feeAmount;
    const formattedTotal = `${totalAmount.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;

    return {
      username: this.user.first_name || 'User',
      amount: this.amount,
      formattedAmount,
      currency: this.currency,
      currencySymbol,
      transactionId: this.transactionId,
      transactionDate: new Date().toLocaleString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        timeZoneName: 'short',
      }),
      destination: this.destination,
      fees,
      totalAmount: formattedTotal,
      supportEmail: 'support@onedosh.com',
    };
  }
}
