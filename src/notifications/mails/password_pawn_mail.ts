import { UserModel } from '../../database';
import { PasswordPawnService } from '../../modules/auth/passwordPawn/passwordPawn.service';
import { MailerManager } from '../../services/queue/processors/mailer/mailer.interface';

export class PasswordPawnMail implements MailerManager {
  public subject = 'Password Security Notice';
  public view = 'password_pawn_notice';

  public to: string;

  constructor(
    public readonly user: UserModel,
    public readonly password: string,
    public readonly changePasswordUrl?: string,
    public readonly passwordPawnService?: PasswordPawnService,
  ) {
    this.to = user.email;
    this.changePasswordUrl = changePasswordUrl;
    this.passwordPawnService = new PasswordPawnService();
  }

  async prepare(): Promise<Record<string, any>> {
    const isPasswordPawned = await this.passwordPawnService.checkIfPasswordIsPawned(this.password);
    if (!isPasswordPawned) {
      return undefined;
    }

    return {
      name: this.user.username,
      changePasswordUrl: this.changePasswordUrl,
    };
  }
}
