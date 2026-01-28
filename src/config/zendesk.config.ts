import { ConfigProvider } from './core/define-config';
import { EnvironmentService } from './environment/environment.service';

export interface ZendeskConfig {
  /** Zendesk API base URL */
  apiUrl: string;

  /** Zendesk API email/username */
  email: string;

  /** Zendesk API token */
  apiToken: string;

  /** Zendesk subdomain */
  subdomain: string;

  /** Zendesk JWT signing key id */
  jwtKeyId?: string;

  /** Zendesk JWT signing shared secret */
  jwtSharedSecret?: string;
}

export class ZendeskConfigProvider extends ConfigProvider<ZendeskConfig> {
  getConfig(): ZendeskConfig {
    return {
      apiUrl:
        EnvironmentService.getValue('ZENDESK_API_URL') ||
        `https://${EnvironmentService.getValue('ZENDESK_SUBDOMAIN')}.zendesk.com/api/v2`,
      email: EnvironmentService.getValue('ZENDESK_EMAIL'),
      apiToken: EnvironmentService.getValue('ZENDESK_API_TOKEN'),
      subdomain: EnvironmentService.getValue('ZENDESK_SUBDOMAIN'),
      jwtKeyId: EnvironmentService.getValue('ZENDESK_JWT_KEY_ID'),
      jwtSharedSecret: EnvironmentService.getValue('ZENDESK_JWT_SHARED_SECRET'),
    };
  }
}
