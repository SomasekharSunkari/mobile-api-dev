import { UserModel } from '../../database';
import { MailerManager } from '../../services/queue/processors/mailer/mailer.interface';

export class KycRejectedMail implements MailerManager {
  public subject = 'KYC Verification Rejected';
  public view = 'kyc_rejected';

  public to: string;

  constructor(
    public readonly user: Partial<UserModel>,
    public readonly issues: string[],
    public readonly failureCorrections?: string[],
    public readonly subjectName?: string,
  ) {
    this.to = user.email;
    this.subject = subjectName ?? 'KYC Verification Rejected';
  }

  async prepare(): Promise<Record<string, any>> {
    return {
      username: this.user.first_name,
      issues: this.issues,
      failureCorrections: this.failureCorrections ?? [],
      subjectName: this.subjectName ?? 'KYC Verification Rejected',
    };
  }
}
