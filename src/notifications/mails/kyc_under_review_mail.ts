import { UserModel } from '../../database';
import { MailerManager } from '../../services/queue/processors/mailer/mailer.interface';

export class KycUnderReviewMail implements MailerManager {
  public subject = 'Your KYC Verification is Under Review';
  public view = 'kyc_under_review';

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
