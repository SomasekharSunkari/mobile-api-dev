import { DateTime } from 'luxon';
import { CurrencyUtility } from '../../currencies';
import { UserModel } from '../../database';
import { MailerManager } from '../../services/queue/processors/mailer/mailer.interface';

export class UsdFundsReceivedMail implements MailerManager {
  public subject = 'Funds Received!';
  public view = 'usd_funds_received';

  public to: string;

  constructor(
    public readonly user: Partial<UserModel>,
    public readonly amount: number, // in main unit (e.g., dollars)
    public readonly currency: string,
    public readonly transactionId: string,
    public readonly description?: string,
    public readonly senderName?: string,
    public readonly accountId?: string,
    public readonly recipientName?: string,
    public readonly recipientLocation?: string,
    public readonly providerFee?: number, // in smallest unit (cents)
    public readonly orderNumber?: string,
  ) {
    this.to = user.email;
  }

  async prepare(): Promise<Record<string, any>> {
    // Normalize USDC to USD for currency formatting (USDC uses same decimal places as USD)
    const normalizedCurrency = this.currency.toUpperCase() === 'USDC' ? 'USD' : this.currency.toUpperCase();

    const currency = CurrencyUtility.getCurrency(normalizedCurrency);
    const currencySymbol = currency?.symbol || this.currency;

    const formattedAmount = Math.abs(this.amount).toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

    // Calculate fees and amount received
    const feeAmount = this.providerFee
      ? CurrencyUtility.formatCurrencyAmountToMainUnit(this.providerFee, normalizedCurrency) || 0
      : 0;
    const fees =
      feeAmount === 0
        ? `$${feeAmount.toFixed(0)} USDC`
        : `$${feeAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USDC`;
    const amountReceived = (Math.abs(this.amount) - feeAmount).toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

    // Format date funds will be available (today's date)
    const dateFundsAvailable = DateTime.now().toISODate(); // YYYY-MM-DD format

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
      senderName: this.senderName,
      accountId: this.accountId,
      recipientName: this.recipientName,
      recipientLocation: this.recipientLocation,
      fees,
      amountReceived,
      dateFundsAvailable,
      exchangeRate: '$1.00 = 1 USDC',
      orderNumber: this.orderNumber,
    };
  }
}
