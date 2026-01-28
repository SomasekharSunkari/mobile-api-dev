import { UserModel } from '../../database';
import { MailerManager } from '../../services/queue/processors/mailer/mailer.interface';

export class CardManagementMail implements MailerManager {
  public subject: string;
  public view = 'card_management';

  public to: string;

  constructor(
    public readonly user: Partial<UserModel>,
    public readonly action: 'freeze' | 'unfreeze' | 'limit_updated' | 'blocked' | 'reissue',
    public readonly cardId?: string,
    public readonly limitAmount?: number,
    public readonly limitFrequency?: string,
  ) {
    this.to = user.email;
    this.subject = this.getSubject();
  }

  private getSubject(): string {
    switch (this.action) {
      case 'freeze':
        return 'Your OneDosh Card Was Frozen';
      case 'unfreeze':
        return 'Card Unlocked';
      case 'limit_updated':
        return 'Card Limit Updated';
      case 'blocked':
        return 'Card Blocked';
      case 'reissue':
        return 'Card Reissued Successfully';
      default:
        return 'Card Management Update';
    }
  }

  async prepare(): Promise<Record<string, any>> {
    const formattedLimit = this.limitAmount
      ? this.limitAmount.toLocaleString('en-US', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })
      : null;

    return {
      username: this.user.first_name || 'User',
      action: this.action,
      actionText: this.getActionText(),
      cardId: this.cardId,
      limitAmount: this.limitAmount,
      formattedLimit,
      limitFrequency: this.limitFrequency,
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

  private getActionText(): string {
    switch (this.action) {
      case 'freeze':
        return 'You froze your OneDosh virtual card.';
      case 'unfreeze':
        return 'Your OneDosh virtual card is active again and ready for use.';
      case 'limit_updated':
        return 'Your card spending limit has been updated';
      case 'blocked':
        return 'Your card has been blocked';
      case 'reissue':
        return 'Your OneDosh card has been successfully reissued.';
      default:
        return 'Your card settings have been updated';
    }
  }
}
