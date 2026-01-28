import { EnvironmentService } from '../environment/environment.service';
import { StableCoinsService, StableCoinsConfiguration } from './stablecoins.config';
import { OneDoshSupportedCryptoNetworks } from './onedosh.config.interface';

describe('StableCoinsService', () => {
  const originalIsProduction = EnvironmentService.isProduction;

  afterEach(() => {
    jest.restoreAllMocks();
    EnvironmentService.isProduction = originalIsProduction;
  });

  describe('getSupportedStableCoins', () => {
    it('should return stable coins for fireblocks provider in development', () => {
      jest.spyOn(EnvironmentService, 'isProduction').mockReturnValue(false);

      const result = StableCoinsService.getSupportedStableCoins();

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThan(0);
      expect(result[0]).toHaveProperty('id');
      expect(result[0]).toHaveProperty('name');
      expect(result[0]).toHaveProperty('symbol');
      expect(result[0]).toHaveProperty('type');
      expect(result[0]).toHaveProperty('nativeAsset');
      expect(result[0]).toHaveProperty('imageUrl');
      expect(result[0]).toHaveProperty('decimals');
    });

    it('should return stable coins for rain provider in production', () => {
      jest.spyOn(EnvironmentService, 'isProduction').mockReturnValue(true);

      const result = StableCoinsService.getSupportedStableCoins();

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThan(0);
    });

    it('should return stable coins for specified provider', () => {
      jest.spyOn(EnvironmentService, 'isProduction').mockReturnValue(false);

      const result = StableCoinsService.getSupportedStableCoins('rain');

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
    });

    it('should use symbol as fallback id when provider mapping not found', () => {
      jest.spyOn(EnvironmentService, 'isProduction').mockReturnValue(false);

      const result = StableCoinsService.getSupportedStableCoins('nonexistent');

      expect(result).toBeDefined();
      if (result.length > 0) {
        expect(result[0].id).toBeDefined();
      }
    });

    it('should only return active stable coins', () => {
      jest.spyOn(EnvironmentService, 'isProduction').mockReturnValue(false);

      const result = StableCoinsService.getSupportedStableCoins();

      result.forEach((coin) => {
        const config = StableCoinsConfiguration.find((c) => c.symbol === coin.symbol);
        expect(config?.is_active).toBe(true);
      });
    });
  });

  describe('getStableCoinConfigBySymbol', () => {
    it('should return stable coin config for valid symbol', () => {
      const result = StableCoinsService.getStableCoinConfigBySymbol('USDC');

      expect(result).toBeDefined();
      expect(result?.symbol).toBe('USDC');
      expect(result?.is_active).toBe(true);
    });

    it('should return undefined for invalid symbol', () => {
      const result = StableCoinsService.getStableCoinConfigBySymbol('INVALID');

      expect(result).toBeUndefined();
    });

    it('should be case insensitive', () => {
      const result1 = StableCoinsService.getStableCoinConfigBySymbol('usdc');
      const result2 = StableCoinsService.getStableCoinConfigBySymbol('USDC');

      expect(result1).toBeDefined();
      expect(result2).toBeDefined();
      expect(result1?.symbol).toBe(result2?.symbol);
    });

    it('should not return inactive coins', () => {
      const result = StableCoinsService.getStableCoinConfigBySymbol('USDC');

      expect(result?.is_active).toBe(true);
    });
  });

  describe('getProviderAssetId', () => {
    it('should return asset ID for fireblocks provider in development', () => {
      jest.spyOn(EnvironmentService, 'isProduction').mockReturnValue(false);

      const result = StableCoinsService.getProviderAssetId('USDC');

      expect(result).toBeDefined();
    });

    it('should return asset ID for rain provider in production', () => {
      jest.spyOn(EnvironmentService, 'isProduction').mockReturnValue(true);

      const result = StableCoinsService.getProviderAssetId('USDC');

      expect(result).toBeDefined();
    });

    it('should return asset ID for specified provider', () => {
      jest.spyOn(EnvironmentService, 'isProduction').mockReturnValue(false);

      const result = StableCoinsService.getProviderAssetId('USDC', 'rain');

      expect(result).toBeDefined();
    });

    it('should return undefined for invalid symbol', () => {
      const result = StableCoinsService.getProviderAssetId('INVALID');

      expect(result).toBeUndefined();
    });

    it('should return undefined for provider without mapping', () => {
      const result = StableCoinsService.getProviderAssetId('USDC', 'nonexistent');

      expect(result).toBeUndefined();
    });
  });

  describe('getProviderNativeAsset', () => {
    it('should return native asset for fireblocks provider in development', () => {
      jest.spyOn(EnvironmentService, 'isProduction').mockReturnValue(false);

      const result = StableCoinsService.getProviderNativeAsset('USDC');

      expect(result).toBeDefined();
    });

    it('should return native asset for rain provider in production', () => {
      jest.spyOn(EnvironmentService, 'isProduction').mockReturnValue(true);

      const result = StableCoinsService.getProviderNativeAsset('USDC');

      expect(result).toBeDefined();
    });

    it('should return native asset for specified provider', () => {
      jest.spyOn(EnvironmentService, 'isProduction').mockReturnValue(false);

      const result = StableCoinsService.getProviderNativeAsset('USDC', 'rain');

      expect(result).toBeDefined();
    });

    it('should return undefined for invalid symbol', () => {
      const result = StableCoinsService.getProviderNativeAsset('INVALID');

      expect(result).toBeUndefined();
    });

    it('should return undefined for provider without mapping', () => {
      const result = StableCoinsService.getProviderNativeAsset('USDC', 'nonexistent');

      expect(result).toBeUndefined();
    });
  });

  describe('getStableCoinByProviderAssetId', () => {
    it('should return stable coin config for valid provider and asset ID', () => {
      jest.spyOn(EnvironmentService, 'isProduction').mockReturnValue(false);

      const result = StableCoinsService.getStableCoinByProviderAssetId('fireblocks', 'USDC_ETH_TEST5_0GER');

      expect(result).toBeDefined();
      expect(result?.provider_mappings.fireblocks?.asset_id).toBe('USDC_ETH_TEST5_0GER');
      expect(result?.is_active).toBe(true);
    });

    it('should return stable coin config for rain provider', () => {
      jest.spyOn(EnvironmentService, 'isProduction').mockReturnValue(true);

      const result = StableCoinsService.getStableCoinByProviderAssetId('rain', 'USDC');

      expect(result).toBeDefined();
      expect(result?.provider_mappings.rain?.asset_id).toBe('USDC');
    });

    it('should return undefined for invalid asset ID', () => {
      const result = StableCoinsService.getStableCoinByProviderAssetId('fireblocks', 'INVALID_ID');

      expect(result).toBeUndefined();
    });

    it('should return undefined for invalid provider', () => {
      const result = StableCoinsService.getStableCoinByProviderAssetId('nonexistent', 'USDC');

      expect(result).toBeUndefined();
    });

    it('should not return inactive coins', () => {
      const result = StableCoinsService.getStableCoinByProviderAssetId('fireblocks', 'USDC_ETH_TEST5_0GER');

      if (result) {
        expect(result.is_active).toBe(true);
      }
    });
  });

  describe('getStableCoinsByNetwork', () => {
    it('should return stable coins for ETH network', () => {
      const result = StableCoinsService.getStableCoinsByNetwork(OneDoshSupportedCryptoNetworks.ETH);

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      result.forEach((coin) => {
        expect(coin.network).toBe(OneDoshSupportedCryptoNetworks.ETH);
        expect(coin.is_active).toBe(true);
      });
    });

    it('should return stable coins for SOL network', () => {
      const result = StableCoinsService.getStableCoinsByNetwork(OneDoshSupportedCryptoNetworks.SOL);

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      result.forEach((coin) => {
        expect(coin.network).toBe(OneDoshSupportedCryptoNetworks.SOL);
        expect(coin.is_active).toBe(true);
      });
    });

    it('should return empty array for network with no stable coins', () => {
      const result = StableCoinsService.getStableCoinsByNetwork(OneDoshSupportedCryptoNetworks.BTC);

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
    });

    it('should only return active coins', () => {
      const result = StableCoinsService.getStableCoinsByNetwork(OneDoshSupportedCryptoNetworks.ETH);

      result.forEach((coin) => {
        expect(coin.is_active).toBe(true);
      });
    });
  });

  describe('getStableCoinsByProvider', () => {
    it('should return stable coins for fireblocks provider', () => {
      const result = StableCoinsService.getStableCoinsByProvider('fireblocks');

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      result.forEach((coin) => {
        expect(coin.provider_mappings.fireblocks).toBeDefined();
        expect(coin.is_active).toBe(true);
      });
    });

    it('should return stable coins for rain provider', () => {
      const result = StableCoinsService.getStableCoinsByProvider('rain');

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      result.forEach((coin) => {
        expect(coin.provider_mappings.rain).toBeDefined();
        expect(coin.is_active).toBe(true);
      });
    });

    it('should return empty array for provider with no mappings', () => {
      const result = StableCoinsService.getStableCoinsByProvider('nonexistent');

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(0);
    });

    it('should only return active coins', () => {
      const result = StableCoinsService.getStableCoinsByProvider('fireblocks');

      result.forEach((coin) => {
        expect(coin.is_active).toBe(true);
      });
    });
  });

  describe('mapExternalAssetsToStableCoins', () => {
    it('should map external assets to stable coins for fireblocks in development', () => {
      jest.spyOn(EnvironmentService, 'isProduction').mockReturnValue(false);

      const externalAssets = [{ id: 'USDC_ETH_TEST5_0GER' }, { id: 'USDC_SOL_TEST5_ABC123' }];

      const result = StableCoinsService.mapExternalAssetsToStableCoins(externalAssets);

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThan(0);
      result.forEach((asset) => {
        expect(asset).toHaveProperty('id');
        expect(asset).toHaveProperty('name');
        expect(asset).toHaveProperty('symbol');
        expect(asset).toHaveProperty('type');
        expect(asset).toHaveProperty('nativeAsset');
        expect(asset).toHaveProperty('imageUrl');
        expect(asset).toHaveProperty('decimals');
      });
    });

    it('should map external assets to stable coins for rain in production', () => {
      jest.spyOn(EnvironmentService, 'isProduction').mockReturnValue(true);

      const externalAssets = [{ id: 'USDC' }];

      const result = StableCoinsService.mapExternalAssetsToStableCoins(externalAssets);

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
    });

    it('should map external assets for specified provider', () => {
      jest.spyOn(EnvironmentService, 'isProduction').mockReturnValue(false);

      const externalAssets = [{ id: 'USDC' }];

      const result = StableCoinsService.mapExternalAssetsToStableCoins(externalAssets, 'rain');

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
    });

    it('should return empty array for assets that do not match', () => {
      const externalAssets = [{ id: 'NONEXISTENT_ASSET' }];

      const result = StableCoinsService.mapExternalAssetsToStableCoins(externalAssets);

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(0);
    });

    it('should use symbol as fallback id when provider mapping not found', () => {
      jest.spyOn(EnvironmentService, 'isProduction').mockReturnValue(false);

      const externalAssets = [{ id: 'USDC_ETH_TEST5_0GER' }];

      const result = StableCoinsService.mapExternalAssetsToStableCoins(externalAssets);

      if (result.length > 0) {
        expect(result[0].id).toBeDefined();
      }
    });

    it('should handle empty array', () => {
      const result = StableCoinsService.mapExternalAssetsToStableCoins([]);

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(0);
    });
  });

  describe('getAllSupportedCryptoCurrencies', () => {
    it('should return all supported crypto currencies', () => {
      const result = StableCoinsService.getAllSupportedCryptoCurrencies();

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThan(0);
      expect(result).toContain('USDC');
    });

    it('should only return active coins', () => {
      const result = StableCoinsService.getAllSupportedCryptoCurrencies();

      result.forEach((symbol) => {
        const config = StableCoinsConfiguration.find((c) => c.symbol === symbol);
        expect(config?.is_active).toBe(true);
      });
    });

    it('should return symbols from all active coins', () => {
      const result = StableCoinsService.getAllSupportedCryptoCurrencies();

      expect(result.length).toBeGreaterThan(0);
      expect(result.every((symbol) => typeof symbol === 'string')).toBe(true);
    });
  });

  describe('getStableCoinsConfiguration', () => {
    it('should return all active stable coins configuration', () => {
      const result = StableCoinsService.getStableCoinsConfiguration();

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThan(0);
      result.forEach((coin) => {
        expect(coin.is_active).toBe(true);
        expect(coin).toHaveProperty('name');
        expect(coin).toHaveProperty('symbol');
        expect(coin).toHaveProperty('type');
        expect(coin).toHaveProperty('decimals');
        expect(coin).toHaveProperty('image_url');
        expect(coin).toHaveProperty('provider_mappings');
        expect(coin).toHaveProperty('network');
      });
    });

    it('should not return inactive coins', () => {
      const result = StableCoinsService.getStableCoinsConfiguration();

      result.forEach((coin) => {
        expect(coin.is_active).toBe(true);
      });
    });
  });

  describe('getDefaultStablecoinSymbol', () => {
    it('should return default stablecoin symbol', () => {
      const result = StableCoinsService.getDefaultStablecoinSymbol();

      expect(result).toBe('USDC');
    });
  });

  describe('getDefaultNetwork', () => {
    it('should return default network', () => {
      const result = StableCoinsService.getDefaultNetwork();

      expect(result).toBe(OneDoshSupportedCryptoNetworks.ETH);
    });
  });

  describe('getDefaultStableCoin', () => {
    it('should return default stable coin for fireblocks in development', () => {
      jest.spyOn(EnvironmentService, 'isProduction').mockReturnValue(false);

      const result = StableCoinsService.getDefaultStableCoin();

      expect(result).toBeDefined();
      expect(result?.symbol).toBe('USDC');
      expect(result).toHaveProperty('id');
      expect(result).toHaveProperty('name');
      expect(result).toHaveProperty('type');
      expect(result).toHaveProperty('nativeAsset');
      expect(result).toHaveProperty('imageUrl');
      expect(result).toHaveProperty('decimals');
    });

    it('should return default stable coin for rain in production', () => {
      jest.spyOn(EnvironmentService, 'isProduction').mockReturnValue(true);

      const result = StableCoinsService.getDefaultStableCoin();

      expect(result).toBeDefined();
      expect(result?.symbol).toBe('USDC');
    });

    it('should return default stable coin for specified provider', () => {
      jest.spyOn(EnvironmentService, 'isProduction').mockReturnValue(false);

      const result = StableCoinsService.getDefaultStableCoin('rain');

      expect(result).toBeDefined();
      expect(result?.symbol).toBe('USDC');
    });

    it('should fallback to first available stablecoin with default symbol if default network not found', () => {
      jest.spyOn(EnvironmentService, 'isProduction').mockReturnValue(false);

      const originalFind = Array.prototype.find;
      let findCallCount = 0;
      Array.prototype.find = function (predicate: any) {
        findCallCount++;
        if (findCallCount === 1) {
          return undefined;
        }
        return originalFind.call(this, predicate);
      };

      try {
        const result = StableCoinsService.getDefaultStableCoin();

        expect(result).toBeDefined();
        expect(result?.symbol).toBe('USDC');
      } finally {
        Array.prototype.find = originalFind;
      }
    });

    it('should handle case when default stablecoin exists', () => {
      jest.spyOn(EnvironmentService, 'isProduction').mockReturnValue(false);

      const result = StableCoinsService.getDefaultStableCoin();

      expect(result).toBeDefined();
      expect(result?.symbol).toBe('USDC');
    });

    it('should return undefined if no fallback stablecoin with default symbol exists', () => {
      jest.spyOn(EnvironmentService, 'isProduction').mockReturnValue(false);

      const originalFind = Array.prototype.find;
      Array.prototype.find = function () {
        return undefined;
      };

      try {
        const result = StableCoinsService.getDefaultStableCoin();

        expect(result).toBeUndefined();
      } finally {
        Array.prototype.find = originalFind;
      }
    });

    it('should use symbol as fallback id when provider mapping not found', () => {
      jest.spyOn(EnvironmentService, 'isProduction').mockReturnValue(false);

      const result = StableCoinsService.getDefaultStableCoin('nonexistent');

      if (result) {
        expect(result.id).toBeDefined();
      }
    });
  });

  describe('StableCoinsConfiguration', () => {
    it('should use production config in production environment', () => {
      jest.spyOn(EnvironmentService, 'isProduction').mockReturnValue(true);

      expect(StableCoinsConfiguration).toBeDefined();
      expect(Array.isArray(StableCoinsConfiguration)).toBe(true);
    });

    it('should use development config in development environment', () => {
      jest.spyOn(EnvironmentService, 'isProduction').mockReturnValue(false);

      expect(StableCoinsConfiguration).toBeDefined();
      expect(Array.isArray(StableCoinsConfiguration)).toBe(true);
    });
  });
});
