import { SumSubVerificationType } from '../../modules/auth/kycVerification/dto/generateSumsubAccessToken.dto';
import {
  OneDoshSupportedCountries,
  OneDoshSupportedCryptoCurrencies,
  OneDoshSupportedCryptoNetworks,
} from './onedosh.config.interface';
import { StableCoinsService } from './stablecoins.config';

export class OneDoshConfiguration {
  static getAllSupportedCryptoCurrencies(): OneDoshSupportedCryptoCurrencies[] {
    return StableCoinsService.getAllSupportedCryptoCurrencies() as OneDoshSupportedCryptoCurrencies[];
  }

  static getSupportedCryptoNetworks(): OneDoshSupportedCryptoNetworks[] {
    return [
      OneDoshSupportedCryptoNetworks.SOL,
      OneDoshSupportedCryptoNetworks.TRON,
      OneDoshSupportedCryptoNetworks.ETH,
      OneDoshSupportedCryptoNetworks.BTC,
    ];
  }

  static getActiveCryptoNetwork(): OneDoshSupportedCryptoNetworks {
    return OneDoshSupportedCryptoNetworks.ETH;
  }

  static getActiveCryptoCurrency(): OneDoshSupportedCryptoCurrencies {
    return OneDoshSupportedCryptoCurrencies.USDC;
  }

  static getLowestTierLevel(): number {
    return 0;
  }

  static getAllSupportedCountries(): OneDoshSupportedCountries[] {
    return [OneDoshSupportedCountries.US, OneDoshSupportedCountries.NG];
  }

  static getSumsubKycLevelWorkflows() {
    return [
      {
        level: SumSubVerificationType.TIER_ONE_VERIFICATION,
        workflows: [
          SumSubVerificationType.TIER_ONE_VERIFICATION,
          SumSubVerificationType.APPLICANT_INFO,
          SumSubVerificationType.ID_ONLY,
          SumSubVerificationType.LIVENESS_ONLY,
        ],
      },
    ];
  }

  static getStableCoinsConfiguration() {
    return StableCoinsService.getStableCoinsConfiguration();
  }
}
