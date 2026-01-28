import { UserModel } from '../../database';
import { MailerManager } from '../../services/queue/processors/mailer/mailer.interface';

export class DeleteAccountRequestMail implements MailerManager {
  public subject = 'Delete Account Request';
  public view = 'account_delete_request';

  public to: string;

  constructor(
    public readonly user: UserModel,
    public readonly deletedOn: string,
  ) {
    this.to = user.email;
    this.deletedOn = deletedOn;
  }

  async prepare(): Promise<Record<string, any>> {
    return {
      name: this.user.first_name,
      deletedOn: this.deletedOn,
    };
  }
}
