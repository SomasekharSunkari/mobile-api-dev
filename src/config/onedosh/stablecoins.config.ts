import { IStableAsset } from '../../adapters/blockchain-waas/blockchain-waas-adapter.interface';
import { OneDoshSupportedCryptoNetworks } from './onedosh.config.interface';
import { EnvironmentService } from '../environment/environment.service';

const DEFAULT_STABLECOIN_SYMBOL = 'USDC';
const DEFAULT_NETWORK = EnvironmentService.isProduction()
  ? OneDoshSupportedCryptoNetworks.SOL
  : OneDoshSupportedCryptoNetworks.ETH;

export interface StableCoinConfig {
  name: string;
  symbol: string;
  type: string;
  decimals: number;
  image_url: string;
  provider_mappings: {
    [provider: string]: {
      asset_id: string;
      name?: string;
      symbol?: string;
      native_asset?: string;
    };
  };
  network: OneDoshSupportedCryptoNetworks;
  is_active: boolean;
}

// use in development
const DevStableCoinsConfiguration: StableCoinConfig[] = [
  {
    name: 'USD Coin',
    symbol: 'USDC',
    type: 'ERC20',
    decimals: 6,
    image_url: '/public/images/usdc_erc20.png',
    provider_mappings: {
      fireblocks: {
        asset_id: 'USDC_ETH_TEST5_0GER',
        name: 'USDC',
        symbol: 'USDC',
        native_asset: 'ETH_TEST5',
      },
      rain: {
        asset_id: 'USDC',
        name: 'USDC',
        symbol: 'USDC',
        native_asset: '11155111',
      },
      custom: {
        asset_id: 'USDC',
        name: 'USDC',
        symbol: 'USDC',
        native_asset: 'eth_test',
      },
    },
    network: OneDoshSupportedCryptoNetworks.ETH,
    is_active: true,
  },
  {
    name: 'USD Coin',
    symbol: 'USDC',
    type: 'ERC20',
    decimals: 6,
    image_url: '/public/images/usdc_erc20.png',
    provider_mappings: {
      fireblocks: {
        asset_id: 'USDC_BASECHAIN_ETH_TEST5_8SH8',
        name: 'USDT',
        symbol: 'USDT',
        native_asset: 'BASECHAIN_ETH_TEST5',
      },
      custom: {
        asset_id: 'USDC',
        name: 'USDC',
        symbol: 'USDC',
        native_asset: 'base_eth',
      },
    },
    network: OneDoshSupportedCryptoNetworks.BASECHAIN,
    is_active: true,
  },
  {
    name: 'USD Coin',
    symbol: 'USDC',
    type: 'SPL',
    decimals: 6,
    image_url: '/public/images/usdc_solana.png',
    provider_mappings: {
      fireblocks: {
        asset_id: 'USDC_SOL_TEST5_ABC123',
        name: 'USDC',
        symbol: 'USDC',
        native_asset: 'SOL_TEST',
      },
      rain: {
        asset_id: 'USDC',
        name: 'USDC',
        symbol: 'USDC',
        native_asset: '901',
      },
      custom: {
        asset_id: 'USDC',
        name: 'USDC',
        symbol: 'USDC',
        native_asset: 'sol_test',
      },
    },
    network: OneDoshSupportedCryptoNetworks.SOL,
    is_active: true,
  },
];

// use in production
const ProdStableCoinsConfiguration: StableCoinConfig[] = [
  {
    name: 'USD Coin',
    symbol: 'USDC',
    type: 'ERC20',
    decimals: 6,
    image_url: '/public/images/usdc_erc20.png',
    provider_mappings: {
      rain: {
        asset_id: 'USDC',
        name: 'USDC',
        symbol: 'USDC',
        native_asset: '1',
      },
      custom: {
        asset_id: 'USDC',
        name: 'USDC',
        symbol: 'USDC',
        native_asset: 'eth',
      },
    },
    network: OneDoshSupportedCryptoNetworks.ETH,
    is_active: true,
  },
  {
    name: 'USD Coin',
    symbol: 'USDC',
    type: 'SPL',
    decimals: 6,
    image_url: '/public/images/usdc_solana.png',
    provider_mappings: {
      rain: {
        asset_id: 'USDC',
        name: 'USDC',
        symbol: 'USDC',
        native_asset: '900',
      },
      custom: {
        asset_id: 'USDC',
        name: 'USDC',
        symbol: 'USDC',
        native_asset: 'sol',
      },
    },
    network: OneDoshSupportedCryptoNetworks.SOL,
    is_active: true,
  },
];

export const StableCoinsConfiguration: StableCoinConfig[] = EnvironmentService.isProduction()
  ? ProdStableCoinsConfiguration
  : DevStableCoinsConfiguration;

export class StableCoinsService {
  /**
   * Get all supported stable coins from configuration
   */
  static getSupportedStableCoins(provider?: string): IStableAsset[] {
    const resolvedProvider = provider || (EnvironmentService.isProduction() ? 'rain' : 'fireblocks');
    const stableAssets: IStableAsset[] = StableCoinsConfiguration.filter((coin) => coin.is_active).map((coin) => ({
      id: coin.provider_mappings[resolvedProvider]?.asset_id || coin.symbol.toLowerCase(),
      name: coin.name,
      symbol: coin.symbol,
      type: coin.type,
      nativeAsset: coin.provider_mappings[resolvedProvider]?.native_asset || 'USD',
      imageUrl: coin.image_url,
      decimals: coin.decimals,
      network: coin.network,
    }));

    return stableAssets;
  }

  /**
   * Get stable coin configuration by symbol
   */
  static getStableCoinConfigBySymbol(symbol: string): StableCoinConfig | undefined {
    return StableCoinsConfiguration.find((coin) => coin.symbol === symbol.toUpperCase() && coin.is_active);
  }

  /**
   * Get provider-specific asset ID for a stable coin
   */
  static getProviderAssetId(symbol: string, provider?: string): string | undefined {
    const resolvedProvider = provider || (EnvironmentService.isProduction() ? 'rain' : 'fireblocks');
    const coin = this.getStableCoinConfigBySymbol(symbol);
    return coin?.provider_mappings[resolvedProvider]?.asset_id;
  }

  /**
   * Get provider-specific native asset for a stable coin
   */
  static getProviderNativeAsset(symbol: string, provider?: string): string | undefined {
    const resolvedProvider = provider || (EnvironmentService.isProduction() ? 'rain' : 'fireblocks');
    const coin = this.getStableCoinConfigBySymbol(symbol);
    return coin?.provider_mappings[resolvedProvider]?.native_asset;
  }

  /**
   * Get stable coin configuration by provider asset ID
   */
  static getStableCoinByProviderAssetId(provider: string, assetId: string): StableCoinConfig | undefined {
    return StableCoinsConfiguration.find(
      (coin) => coin.is_active && coin.provider_mappings[provider]?.asset_id === assetId,
    );
  }

  /**
   * Get stable coins supported on a specific network
   */
  static getStableCoinsByNetwork(network: string): StableCoinConfig[] {
    return StableCoinsConfiguration.filter((coin) => coin.is_active && coin.network === network);
  }

  /**
   * Get stable coins available for a specific provider
   */
  static getStableCoinsByProvider(provider: string): StableCoinConfig[] {
    return StableCoinsConfiguration.filter((coin) => coin.is_active && coin.provider_mappings[provider]);
  }

  /**
   * Map external assets to stable coins
   */
  static mapExternalAssetsToStableCoins(externalAssets: any[], provider?: string): IStableAsset[] {
    const resolvedProvider = provider || (EnvironmentService.isProduction() ? 'rain' : 'fireblocks');
    const mappedAssets: IStableAsset[] = [];

    for (const externalAsset of externalAssets) {
      const stableCoinConfig = this.getStableCoinByProviderAssetId(resolvedProvider, externalAsset.id);
      if (stableCoinConfig) {
        mappedAssets.push({
          id: stableCoinConfig.provider_mappings[resolvedProvider]?.asset_id || stableCoinConfig.symbol.toLowerCase(),
          name: stableCoinConfig.name,
          symbol: stableCoinConfig.symbol,
          type: stableCoinConfig.type,
          nativeAsset: stableCoinConfig.provider_mappings[resolvedProvider]?.native_asset || 'USD',
          imageUrl: stableCoinConfig.image_url,
          decimals: stableCoinConfig.decimals,
        });
      }
    }

    return mappedAssets;
  }

  /**
   * Get all supported crypto currencies from configuration
   */
  static getAllSupportedCryptoCurrencies(): string[] {
    return StableCoinsConfiguration.filter((coin) => coin.is_active).map((coin) => coin.symbol);
  }

  /**
   * Get stable coins configuration
   */
  static getStableCoinsConfiguration(): StableCoinConfig[] {
    return StableCoinsConfiguration.filter((coin) => coin.is_active);
  }

  /**
   * Get default stablecoin symbol
   */
  static getDefaultStablecoinSymbol(): string {
    return DEFAULT_STABLECOIN_SYMBOL;
  }

  /**
   * Get default network
   */
  static getDefaultNetwork(): OneDoshSupportedCryptoNetworks {
    return DEFAULT_NETWORK;
  }

  /**
   * Get default stablecoin for the default network
   */
  static getDefaultStableCoin(provider?: string): IStableAsset | undefined {
    const resolvedProvider = provider || (EnvironmentService.isProduction() ? 'rain' : 'fireblocks');
    // Find the default stablecoin on the default network
    const defaultCoin = StableCoinsConfiguration.find(
      (coin) => coin.is_active && coin.symbol === DEFAULT_STABLECOIN_SYMBOL && coin.network === DEFAULT_NETWORK,
    );

    if (!defaultCoin) {
      // Fallback to first available stablecoin with default symbol if default network not found
      const fallbackCoin = StableCoinsConfiguration.find(
        (coin) => coin.is_active && coin.symbol === DEFAULT_STABLECOIN_SYMBOL,
      );

      if (!fallbackCoin) {
        return undefined;
      }

      return {
        id: fallbackCoin.provider_mappings[resolvedProvider]?.asset_id || fallbackCoin.symbol.toLowerCase(),
        name: fallbackCoin.name,
        symbol: fallbackCoin.symbol,
        type: fallbackCoin.type,
        nativeAsset: fallbackCoin.provider_mappings[resolvedProvider]?.native_asset || 'USD',
        imageUrl: fallbackCoin.image_url,
        decimals: fallbackCoin.decimals,
      };
    }

    return {
      id: defaultCoin.provider_mappings[resolvedProvider]?.asset_id || defaultCoin.symbol.toLowerCase(),
      name: defaultCoin.name,
      symbol: defaultCoin.symbol,
      type: defaultCoin.type,
      nativeAsset: defaultCoin.provider_mappings[resolvedProvider]?.native_asset || 'USD',
      imageUrl: defaultCoin.image_url,
      decimals: defaultCoin.decimals,
    };
  }
}
