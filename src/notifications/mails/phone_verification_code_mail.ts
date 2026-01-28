import { UserModel } from '../../database';
import { MailerManager } from '../../services/queue/processors/mailer/mailer.interface';

export class PhoneVerificationCodeMail implements MailerManager {
  public subject = 'Phone Verification Code - OneDosh';
  public view = 'phone_verification_code';

  public to: string;

  constructor(
    public readonly user: UserModel,
    public readonly code: string,
    public readonly expiresAt: string,
  ) {
    this.to = user.email;
  }

  async prepare(): Promise<Record<string, any>> {
    return {
      username: this.user.username || this.user.first_name || 'User',
      code: this.code,
      expiresAt: this.expiresAt,
      userEmail: this.user.email,
    };
  }
}
