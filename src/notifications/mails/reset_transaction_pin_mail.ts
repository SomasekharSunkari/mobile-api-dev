import { UserModel } from '../../database';
import { MailerManager } from '../../services/queue/processors/mailer/mailer.interface';

export class ResetTransactionPinMail implements MailerManager {
  public subject = 'Reset your OneDosh transaction PIN';
  public view = 'reset_transaction_pin';

  public to: string;

  constructor(
    public readonly user: UserModel,
    public readonly code: string,
  ) {
    this.to = user.email;
    this.code = code;
  }

  async prepare(): Promise<Record<string, any>> {
    return {
      name: this.user.username,
      code: this.code,
    };
  }
}
