import { UserModel } from '../../database';
import { MailerManager } from '../../services/queue/processors/mailer/mailer.interface';

export class AccountDeactivationSuccessfulMail implements MailerManager {
  public subject = 'Account Restriction Notice';
  public view = 'account_deactivation_successful';
  public to: string;

  constructor(
    public readonly user: Partial<UserModel>,
    readonly reasons: string[],
  ) {
    this.to = user.email;
  }

  async prepare(): Promise<Record<string, any>> {
    return {
      username: this.user.first_name,
      reasons: this.reasons,
    };
  }
}
