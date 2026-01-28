import { ConfigProvider } from './core/define-config';
import { EnvironmentService } from './environment/environment.service';

export interface PlaidConfig {
  clientId: string;
  secret: string;
  env: string;
  webhook: string;
  redirect_uri: string;
  signalRulesetKey: string;
}

export class PlaidConfigProvider extends ConfigProvider<PlaidConfig> {
  getConfig(): PlaidConfig {
    return {
      clientId: EnvironmentService.getValue('PLAID_CLIENT_ID'),
      secret: EnvironmentService.getValue('PLAID_SECRET'),
      env: EnvironmentService.getValue('PLAID_ENV'),
      webhook: EnvironmentService.getValue('PLAID_WEBHOOK'),
      redirect_uri: EnvironmentService.getValue('PLAID_REDIRECT_URI'),
      signalRulesetKey: EnvironmentService.getValue('PLAID_SIGNAL_RULESET_KEY'),
    };
  }
}
