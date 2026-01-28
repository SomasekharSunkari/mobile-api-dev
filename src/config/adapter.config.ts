import { Injectable } from '@nestjs/common';
import { ConfigProvider } from './core/define-config';
import { EnvironmentService } from './environment/environment.service';

export interface AdapterConfig {
  kyc: {
    default_us_kyc_provider: string;
    default_ng_kyc_provider: string;
    default_kyc_provider: string;
  };
  default_participant_countries: string;
  default_underlying_currency: string;
}

@Injectable()
export class AdapterConfigProvider extends ConfigProvider<AdapterConfig> {
  getConfig(): AdapterConfig {
    return {
      kyc: {
        default_us_kyc_provider: EnvironmentService.getValue('DEFAULT_US_KYC_PROVIDER'),
        default_ng_kyc_provider: EnvironmentService.getValue('DEFAULT_NG_KYC_PROVIDER'),
        default_kyc_provider: EnvironmentService.getValue('DEFAULT_KYC_PROVIDER'),
      },
      default_participant_countries: EnvironmentService.getValue('DEFAULT_PARTICIPANT_COUNTRIES'),
      default_underlying_currency: EnvironmentService.getValue('DEFAULT_UNDERLYING_CURRENCY'),
    };
  }
}
