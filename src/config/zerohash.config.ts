import { ConfigProvider } from './core/define-config';
import { EnvironmentService } from './environment/environment.service';

export interface ZerohashConfig {
  apiKey: string;
  apiUrl: string;
  apiSecret: string;
  apiPassphrase: string;
  accountGroup: string;
  rsaPublicKey: string;
}

export class ZerohashConfigProvider extends ConfigProvider<ZerohashConfig> {
  getConfig(): ZerohashConfig {
    return {
      apiKey: EnvironmentService.getValue('ZEROHASH_API_KEY'),
      apiUrl: EnvironmentService.getValue('ZEROHASH_API_URL'),
      apiSecret: EnvironmentService.getValue('ZEROHASH_API_SECRET'),
      apiPassphrase: EnvironmentService.getValue('ZEROHASH_API_PASSPHRASE'),
      accountGroup: EnvironmentService.getValue('ZEROHASH_ACCOUNT_GROUP'),
      rsaPublicKey: EnvironmentService.getValue('ZEROHASH_RSA_PUBLIC_KEY'),
    };
  }
}
