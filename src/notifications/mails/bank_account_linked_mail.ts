import { UserModel } from '../../database';
import { MailerManager } from '../../services/queue/processors/mailer/mailer.interface';

export class BankAccountLinkedMail implements MailerManager {
  public subject = 'Your Bank Account Has Been Linked to OneDosh';
  public view = 'bank_account_linked';

  public to: string;

  constructor(
    public readonly user: UserModel,
    public readonly accountName?: string,
    public readonly institutionName?: string,
    public readonly accountType?: string,
    public readonly lastFourDigits?: string,
  ) {
    this.to = user.email;
  }

  async prepare(): Promise<Record<string, any>> {
    return {
      firstName: this.user.first_name || 'User',
      accountName: this.accountName || 'Your Bank Account',
      institutionName: this.institutionName || 'Your Bank',
      accountType: this.accountType || 'account',
      lastFourDigits: this.lastFourDigits || 'XXXX',
      supportEmail: 'support@onedosh.com',
    };
  }
}
