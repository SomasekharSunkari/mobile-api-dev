import { UserModel } from '../../database';
import { MailerManager } from '../../services/queue/processors/mailer/mailer.interface';

export class BankAccountUnlinkedMail implements MailerManager {
  public subject = 'Your Bank Account Has Been Unlinked from OneDosh';
  public view = 'bank_account_unlinked';

  public to: string;

  constructor(
    public readonly user: UserModel,
    public readonly accountName?: string,
    public readonly institutionName?: string,
    public readonly lastFourDigits?: string,
  ) {
    this.to = user.email;
  }

  async prepare(): Promise<Record<string, any>> {
    return {
      firstName: this.user.first_name || 'User',
      accountName: this.accountName || 'Your Bank Account',
      institutionName: this.institutionName || 'Your Bank',
      lastFourDigits: this.lastFourDigits || 'XXXX',
      supportEmail: 'support@onedosh.com',
    };
  }
}
