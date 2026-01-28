import { UserModel } from '../../database';
import { MailerManager } from '../../services/queue/processors/mailer/mailer.interface';

export class CardCreatedMail implements MailerManager {
  public subject = 'Your OneDosh Virtual Card is Ready';
  public view = 'card_created';

  public to: string;

  constructor(
    public readonly user: Partial<UserModel>,
    public readonly cardId: string,
    public readonly cardType: string,
    public readonly lastFourDigits?: string,
  ) {
    this.to = user.email;
  }

  async prepare(): Promise<Record<string, any>> {
    return {
      username: this.user.first_name || 'User',
      cardId: this.cardId,
      cardType: this.cardType === 'virtual' ? 'Virtual' : 'Physical',
      lastFourDigits: this.lastFourDigits || '****',
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
