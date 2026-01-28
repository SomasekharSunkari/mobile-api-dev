import { UserModel } from '../../database';
import { MailerManager } from '../../services/queue/processors/mailer/mailer.interface';

export class AccountDeleteCodeMail implements MailerManager {
  public subject = 'Account Deletion Code - OneDosh';
  public view = 'account_delete_code';

  public to: string;

  constructor(
    public readonly user: UserModel,
    public readonly deleteCode: string,
  ) {
    this.to = user.email;
  }

  async prepare(): Promise<Record<string, any>> {
    return {
      username: this.user.username || this.user.first_name || 'User',
      deleteCode: this.deleteCode,
      userEmail: this.user.email,
    };
  }
}
