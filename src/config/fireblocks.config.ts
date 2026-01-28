import { ConfigProvider } from './core/define-config';
import { EnvironmentService } from './environment/environment.service';

export interface IFireblocksConfig {
  apiKey: string;
  privateKey: string;
  baseUrl?: string;
  timeout?: number;
  webhookPublicKey?: string;
  default_blockchain_waas_adapter: string;
}

export class FireblocksConfigProvider extends ConfigProvider<IFireblocksConfig> {
  getConfig(): IFireblocksConfig {
    return {
      apiKey: EnvironmentService.getValue('FIREBLOCKS_API_KEY'),
      privateKey: EnvironmentService.getValue('FIREBLOCKS_PRIVATE_KEY'),
      baseUrl: EnvironmentService.getValue('FIREBLOCKS_BASE_URL'),
      timeout: Number(EnvironmentService.getValue('FIREBLOCKS_TIMEOUT')) || 60000,
      webhookPublicKey: EnvironmentService.getValue('FIREBLOCKS_WEBHOOK_PUBLIC_KEY'),
      default_blockchain_waas_adapter: EnvironmentService.getValue('DEFAULT_BLOCKCHAIN_WAAS_ADAPTER') || 'fireblocks',
    };
  }
}
