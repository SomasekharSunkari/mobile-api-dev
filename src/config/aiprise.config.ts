import { ConfigProvider } from './core/define-config';
import { EnvironmentService } from './environment/environment.service';

export interface AipriseConfig {
  apiKey: string;
  apiUrl: string;
}

export class AipriseConfigProvider extends ConfigProvider<AipriseConfig> {
  getConfig(): AipriseConfig {
    return {
      apiKey: EnvironmentService.getValue('AIPRISE_API_KEY'),
      apiUrl: EnvironmentService.getValue('AIPRISE_API_URL'),
    };
  }
}
