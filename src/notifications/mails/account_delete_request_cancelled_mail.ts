import { UserModel } from '../../database';
import { MailerManager } from '../../services/queue/processors/mailer/mailer.interface';

export class AccountDeleteRequestCancelledMail implements MailerManager {
  public subject = 'Account Deletion Request Cancelled - OneDosh';
  public view = 'account_delete_request_cancelled';

  public to: string;

  constructor(public readonly user: UserModel) {
    this.to = user.email;
  }

  async prepare(): Promise<Record<string, any>> {
    return {
      username: this.user.first_name || 'User',
      userEmail: this.user.email,
    };
  }
}
