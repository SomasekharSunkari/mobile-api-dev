import { UserModel } from '../../database';
import { MailerManager } from '../../services/queue/processors/mailer/mailer.interface';

export class KycSuccessMail implements MailerManager {
  public subject = 'KYC Verification Successful';
  public view = 'kyc_success';

  public to: string;

  constructor(public readonly user: Partial<UserModel>) {
    this.to = user.email;
  }

  async prepare(): Promise<Record<string, any>> {
    return {
      username: this.user.first_name,
    };
  }
}
