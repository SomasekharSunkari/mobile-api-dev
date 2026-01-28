import { DateTime } from 'luxon';
import { CurrencyUtility } from '../../currencies';
import { UserModel } from '../../database';
import { MailerManager } from '../../services/queue/processors/mailer/mailer.interface';
import { TransferDirection } from '../../constants/constants';

export class TransferSuccessfulMail implements MailerManager {
  public subject = 'Transfer Successful';
  public view = 'transfer_successful';

  public to: string;

  constructor(
    public readonly user: Partial<UserModel>,
    public readonly amount: number, // in main unit (e.g., dollars)
    public readonly currency: string,
    public readonly transactionId: string,
    public readonly description?: string,
    public readonly recipient?: string,
    public readonly transferFee?: string,
    public readonly status?: string,
    public readonly accountId?: string,
    public readonly senderName?: string,
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

    // Calculate fees and amount recipient will receive
    const feeAmount = this.providerFee
      ? CurrencyUtility.formatCurrencyAmountToMainUnit(this.providerFee, normalizedCurrency) || 0
      : 0;
    const fees =
      feeAmount === 0
        ? `$${feeAmount.toFixed(0)} USDC`
        : `$${feeAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USDC`;

    // For card funding, recipient (card) receives full amount since fee was already deducted from wallet
    const descriptionLower = (this.description ?? '').toLowerCase();
    const isCardFunding = descriptionLower.includes('card funding');
    const rawAmountRecipientWillReceive = isCardFunding ? Math.abs(this.amount) : Math.abs(this.amount) - feeAmount;
    const amountRecipientWillReceive = rawAmountRecipientWillReceive.toLocaleString(
      CurrencyUtility.getCurrencyLocale(normalizedCurrency),
      {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      },
    );

    // Format date funds will be available (today's date)
    const dateFundsAvailable = DateTime.now().toISODate(); // YYYY-MM-DD format

    // Set transferFromTo text - use "your virtual card" for card funding when recipientName is undefined
    const transferFromTo =
      isCardFunding && !this.recipientName ? 'to your virtual card' : `to ${this.recipientName || 'recipient'}`;

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
      transferDirection: TransferDirection.TO,
      recipient: this.recipient,
      transferFee: this.transferFee,
      status: this.status,
      recipientLabel: 'Recipient:',
      amountReceivedLabel: 'Amount Recipient will receive:',
      transferFromTo,
      accountId: this.accountId,
      senderName: this.senderName,
      recipientName: this.recipientName,
      recipientLocation: this.recipientLocation,
      fees,
      amountRecipientWillReceive,
      dateFundsAvailable,
      exchangeRate: '$1.00 = 1 USDC',
      orderNumber: this.orderNumber,
    };
  }
}
