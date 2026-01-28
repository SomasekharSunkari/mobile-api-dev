import { UserModel } from '../../database';
import { MailerManager } from '../../services/queue/processors/mailer/mailer.interface';

export class NgWalletUpgradePendingMail implements MailerManager {
  public subject = 'Nigerian Wallet Upgrade Under Review';
  public view = 'ng_wallet_upgrade_pending';

  public to: string;

  constructor(
    public readonly user: Partial<UserModel>,
    public readonly accountNumber: string,
    public readonly tier: string,
  ) {
    this.to = user.email;
    this.accountNumber = accountNumber;
    this.tier = tier;
  }

  async prepare(): Promise<Record<string, any>> {
    return {
      username: this.user.first_name,
      account_number: this.accountNumber,
      tier: this.tier,
    };
  }
}
