import { CurrencyUtility } from '../../currencies';
import { UserModel } from '../../database';
import { MailerManager } from '../../services/queue/processors/mailer/mailer.interface';

export class WithdrawalProcessedMail implements MailerManager {
  public subject = 'Sale & Withdrawal Processed';
  public view = 'withdrawal_processed';

  public to: string;

  constructor(
    public readonly user: Partial<UserModel>,
    public readonly amount: number, // in main unit (e.g., dollars)
    public readonly currency: string,
    public readonly transactionId: string,
    public readonly description?: string,
    public readonly destination?: string,
    public readonly accountId?: string,
    public readonly orderNumber?: string,
    public readonly providerFee?: number, // in smallest unit (cents)
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

    // Calculate fees using the same pattern as transfer_successful
    const feeAmount = this.providerFee
      ? CurrencyUtility.formatCurrencyAmountToMainUnit(this.providerFee, this.currency) || 0
      : 0;
    const fees =
      feeAmount === 0
        ? `$${feeAmount.toFixed(0)}`
        : `${feeAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${this.currency}`;

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
      description: this.description,
      bank: this.destination,
      accountId: this.accountId,
      orderNumber: this.orderNumber,
      fees,
      totalAmount: formattedTotal,
    };
  }
}
