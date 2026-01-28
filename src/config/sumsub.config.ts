import { ConfigProvider } from './core/define-config';
import { EnvironmentService } from './environment/environment.service';

export interface SumsubConfig {
  appToken: string;
  secretKey: string;
  apiUrl: string;
  webhook_secret_key: string;
}

export class SumsubConfigProvider extends ConfigProvider<SumsubConfig> {
  getConfig(): SumsubConfig {
    return {
      appToken: EnvironmentService.getValue('SUMSUB_APP_TOKEN'),
      secretKey: EnvironmentService.getValue('SUMSUB_SECRET_KEY'),
      apiUrl: EnvironmentService.getValue('SUMSUB_API_URL'),
      webhook_secret_key: EnvironmentService.getValue('SUMSUB_WEBHOOK_SECRET_KEY'),
    };
  }
}
