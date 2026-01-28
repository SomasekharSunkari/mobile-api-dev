import { UserModel } from '../../database';
import { MailerManager } from '../../services/queue/processors/mailer/mailer.interface';

export class AccountRestrictionMail implements MailerManager {
  public subject = 'Account Restriction Code - OneDosh';
  public view = 'account_deactivation';

  public to: string;

  constructor(
    public readonly user: UserModel,
    public readonly restrictionCode: string,
    public readonly expiresAt: string,
  ) {
    this.to = user.email;
  }

  async prepare(): Promise<Record<string, any>> {
    return {
      username: this.user.username || this.user.first_name || 'User',
      restrictionCode: this.restrictionCode,
      expiresAt: this.expiresAt,
      userEmail: this.user.email,
    };
  }
}
