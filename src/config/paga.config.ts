import { ConfigProvider } from './core/define-config';
import { EnvironmentService } from './environment/environment.service';

export interface PagaConfig {
  collectApiUrl: string;
  username: string;
  credential: string;
  hmac: string;
  businessApiUrl: string;
  webhookUsername: string;
  webhookPassword: string;
}

export class PagaConfigProvider extends ConfigProvider<PagaConfig> {
  getConfig(): PagaConfig {
    return {
      username: EnvironmentService.getValue('PAGA_USERNAME'),
      credential: EnvironmentService.getValue('PAGA_CREDENTIAL'),
      hmac: EnvironmentService.getValue('PAGA_HMAC'),
      collectApiUrl: EnvironmentService.getValue('PAGA_COLLECT_API_URL'),
      businessApiUrl: EnvironmentService.getValue('PAGA_BUSINESS_API_URL'),
      webhookUsername: EnvironmentService.getValue('PAGA_WEBHOOK_USERNAME'),
      webhookPassword: EnvironmentService.getValue('PAGA_WEBHOOK_PASSWORD'),
    };
  }
}
