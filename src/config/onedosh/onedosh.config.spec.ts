import { OneDoshConfiguration } from './onedosh.config';
import {
  OneDoshSupportedCountries,
  OneDoshSupportedCryptoCurrencies,
  OneDoshSupportedCryptoNetworks,
} from './onedosh.config.interface';
import { SumSubVerificationType } from '../../modules/auth/kycVerification/dto/generateSumsubAccessToken.dto';
import { StableCoinsService } from './stablecoins.config';

describe('OneDoshConfiguration', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should delegate getAllSupportedCryptoCurrencies to StableCoinsService', () => {
    const mockCurrencies = [OneDoshSupportedCryptoCurrencies.USDC, OneDoshSupportedCryptoCurrencies.USDT];
    const spy = jest.spyOn(StableCoinsService, 'getAllSupportedCryptoCurrencies').mockReturnValue(mockCurrencies);

    const result = OneDoshConfiguration.getAllSupportedCryptoCurrencies();

    expect(result).toEqual(mockCurrencies);
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('should return configured crypto networks', () => {
    expect(OneDoshConfiguration.getSupportedCryptoNetworks()).toEqual([
      OneDoshSupportedCryptoNetworks.SOL,
      OneDoshSupportedCryptoNetworks.TRON,
      OneDoshSupportedCryptoNetworks.ETH,
      OneDoshSupportedCryptoNetworks.BTC,
    ]);
  });

  it('should expose the active network and currency', () => {
    expect(OneDoshConfiguration.getActiveCryptoNetwork()).toBe(OneDoshSupportedCryptoNetworks.ETH);
    expect(OneDoshConfiguration.getActiveCryptoCurrency()).toBe(OneDoshSupportedCryptoCurrencies.USDC);
  });

  it('should expose the lowest tier level', () => {
    expect(OneDoshConfiguration.getLowestTierLevel()).toBe(0);
  });

  it('should list supported countries', () => {
    expect(OneDoshConfiguration.getAllSupportedCountries()).toEqual([
      OneDoshSupportedCountries.US,
      OneDoshSupportedCountries.NG,
    ]);
  });

  it('should provide Sumsub workflow configuration', () => {
    const workflows = OneDoshConfiguration.getSumsubKycLevelWorkflows();

    expect(workflows).toHaveLength(1);
    expect(workflows[0]).toEqual({
      level: SumSubVerificationType.TIER_ONE_VERIFICATION,
      workflows: [
        SumSubVerificationType.TIER_ONE_VERIFICATION,
        SumSubVerificationType.APPLICANT_INFO,
        SumSubVerificationType.ID_ONLY,
        SumSubVerificationType.LIVENESS_ONLY,
      ],
    });
  });

  it('should delegate stable coin configuration retrieval to StableCoinsService', () => {
    const mockConfig = [{ symbol: 'USDC' }] as any;
    const spy = jest.spyOn(StableCoinsService, 'getStableCoinsConfiguration').mockReturnValue(mockConfig);

    const result = OneDoshConfiguration.getStableCoinsConfiguration();

    expect(result).toEqual(mockConfig);
    expect(spy).toHaveBeenCalledTimes(1);
  });
});
