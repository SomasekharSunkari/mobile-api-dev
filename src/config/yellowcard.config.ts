import { ConfigProvider } from './core/define-config';
import { EnvironmentService } from './environment/environment.service';

export interface YellowCardConfig {
  apiKey: string;
  secretKey: string;
  apiUrl: string;
  webhookSecretKey: string;
}

export class YellowCardConfigProvider extends ConfigProvider<YellowCardConfig> {
  getConfig(): YellowCardConfig {
    return {
      apiKey: EnvironmentService.getValue('YELLOWCARD_PUBLIC_KEY'),
      secretKey: EnvironmentService.getValue('YELLOWCARD_SECRET_KEY'),
      apiUrl: EnvironmentService.getValue('YELLOWCARD_API_URL'),
      webhookSecretKey: EnvironmentService.getValue('YELLOWCARD_WEBHOOK_SECRET_KEY'),
    };
  }
}
