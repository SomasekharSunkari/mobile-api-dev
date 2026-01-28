import { DateTime } from 'luxon';
import { UserModel } from '../../database';
import { MailerManager } from '../../services/queue/processors/mailer/mailer.interface';
import { LocationData } from '../../modules/auth/loginSecurity/loginSecurity.interface';

export class HighRiskLoginMail implements MailerManager {
  public subject = 'Security Alert: Verification Required for Your Login';
  public view = 'high_risk_login';

  public to: string;

  constructor(
    public readonly user: UserModel,
    public readonly reasons: string[],
    public readonly ipAddress: string,
    public readonly locationData?: LocationData,
  ) {
    this.to = user.email;
  }

  async prepare(): Promise<Record<string, any>> {
    // Format reasons for display
    const formattedReasons = this.reasons.map((reason) => {
      if (reason === 'new device') {
        return 'Login from a new or unrecognized device';
      }
      if (reason.startsWith('new country')) {
        const country = reason.replace('new country (', '').replace(')', '');
        return `Login from a new country: ${country}`;
      }
      if (reason.startsWith('new region')) {
        const region = reason.replace('new region (', '').replace(')', '');
        return `Login from a new region: ${region}`;
      }
      if (reason.startsWith('new city')) {
        const city = reason.replace('new city (', '').replace(')', '');
        return `Login from a new city: ${city}`;
      }
      if (reason === 'VPN usage detected') {
        return 'VPN or proxy usage detected';
      }
      return reason;
    });

    // Try simple text formatting first to debug
    const reasonsList = formattedReasons.join('\n• ');

    return {
      name: this.user.first_name || this.user.username,
      reasons: reasonsList,
      ipAddress: this.ipAddress,
      location: this.formatLocationForEmail(),
      timestamp: DateTime.now().toLocaleString({
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        timeZoneName: 'short',
      }),
    };
  }

  /**
   * Format location information for email display
   */
  private formatLocationForEmail(): string {
    if (!this.locationData) {
      return 'Unknown location';
    }

    const parts: string[] = [];
    if (this.locationData.city) parts.push(this.locationData.city);
    if (this.locationData.region) parts.push(this.locationData.region);
    if (this.locationData.country) parts.push(this.locationData.country);

    let location = parts.join(', ') || 'Unknown location';

    if (this.locationData.isVpn) {
      location += ' (via VPN/Proxy)';
    }

    return location;
  }
}
