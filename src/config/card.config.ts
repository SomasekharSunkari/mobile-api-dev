import { ConfigProvider } from './core/define-config';
import { EnvironmentService } from './environment/environment.service';

export interface CardConfig {
  /** Default card provider */
  default_card_provider: string;
}

export class CardConfigProvider extends ConfigProvider<CardConfig> {
  getConfig(): CardConfig {
    return {
      default_card_provider: EnvironmentService.getValue('DEFAULT_CARD_PROVIDER'),
    };
  }
}

export const DefaultMonthlyCardLoadLimit = 20000; // $20,000 monthly load limit by default
export const DefaultCardLimit = 5000; // $5,000 daily limit by default
