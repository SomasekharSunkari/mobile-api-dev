import { EnvironmentService } from './environment';

export interface ExchangeConfig {
  default_exchange_provider: string;
}

export class ExchangeConfigProvider {
  getConfig(): ExchangeConfig {
    return {
      default_exchange_provider: EnvironmentService.getValue('DEFAULT_EXCHANGE_PROVIDER'),
    };
  }
}
