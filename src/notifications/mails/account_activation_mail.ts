import { UserModel } from '../../database';
import { MailerManager } from '../../services/queue/processors/mailer/mailer.interface';

export class AccountActivationMail implements MailerManager {
  public subject = 'Account Activation - OneDosh';
  public view = 'account_activation';

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
