import { UserModel } from '../../database';
import { MailerManager } from '../../services/queue/processors/mailer/mailer.interface';

export class RegistrationSuccessfulMail implements MailerManager {
  public subject = 'You’re almost ready to start!';
  public view = 'registration_successful';

  public to: string;

  constructor(public readonly user: UserModel) {
    this.to = user.email;
  }

  async prepare(): Promise<Record<string, any>> {
    return {
      firstName: this.user.first_name,
    };
  }
}
