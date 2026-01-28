import { UserModel } from '../../database';
import { MailerManager } from '../../services/queue/processors/mailer/mailer.interface';

export class LoginOtpMail implements MailerManager {
  public subject = 'OneDosh Login Verification Code';
  public view = 'login_otp';

  public to: string;

  constructor(
    public readonly user: UserModel,
    public readonly code: string,
    public readonly expirationMinutes: number = 10,
  ) {
    this.to = user.email;
  }

  async prepare(): Promise<Record<string, any>> {
    return {
      name: this.user.first_name || this.user.username,
      code: this.code,
      expirationMinutes: this.expirationMinutes,
    };
  }
}
