import { Injectable } from '@nestjs/common';
import { ConfigProvider } from './core/define-config';
import { EnvironmentService } from './environment/environment.service';

export interface FiatWalletConfig {
  default_usd_fiat_wallet_provider: string;
  default_ngn_fiat_wallet_provider: string;
  default_underlying_currency: string;
}

@Injectable()
export class FiatWalletConfigProvider extends ConfigProvider<FiatWalletConfig> {
  getConfig(): FiatWalletConfig {
    return {
      default_usd_fiat_wallet_provider: EnvironmentService.getValue('DEFAULT_USD_FIAT_WALLET_PROVIDER'),
      default_ngn_fiat_wallet_provider: EnvironmentService.getValue('DEFAULT_NGN_FIAT_WALLET_PROVIDER'),
      default_underlying_currency: EnvironmentService.getValue('DEFAULT_UNDERLYING_CURRENCY'),
    };
  }
}
