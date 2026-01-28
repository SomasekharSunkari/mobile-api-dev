import { UserModel } from '../../database';
import { MailerManager } from '../../services/queue/processors/mailer/mailer.interface';

export class ChangePasswordCodeMail implements MailerManager {
  public subject = 'Change Password Code - OneDosh';
  public view = 'change_password_code';

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
