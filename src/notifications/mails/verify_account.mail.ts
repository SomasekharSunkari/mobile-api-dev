import { UserModel } from '../../database';
import { MailerManager } from '../../services/queue/processors/mailer/mailer.interface';

export class VerifyAccountMail implements MailerManager {
  public subject = 'Verify your OneDosh account';
  public view = 'verify_account';

  public to: string;

  constructor(
    public readonly user: Partial<UserModel>,
    public readonly code: string,
  ) {
    this.to = user.email;
    this.code = code;
  }

  async prepare(): Promise<Record<string, any>> {
    return {
      code: this.code,
    };
  }
}
