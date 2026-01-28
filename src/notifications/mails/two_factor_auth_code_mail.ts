import { UserModel } from '../../database';
import { MailerManager } from '../../services/queue/processors/mailer/mailer.interface';

export class TwoFactorAuthCodeMail implements MailerManager {
  public subject = 'Two-Factor Authentication Code - OneDosh';
  public view = 'two_factor_auth_code';

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
