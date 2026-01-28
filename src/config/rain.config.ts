import { ConfigProvider } from './core/define-config';
import { EnvironmentService } from './environment/environment.service';

/**
 * Rain Card Configuration
 *
 * This configuration module handles the setup and management of Rain card services
 * within the OneDosh cross-border payment platform. Rain provides both physical
 * and virtual card issuance capabilities that integrate seamlessly with our
 * stablecoin-powered payment infrastructure.
 *
 * Key Features:
 * - Virtual Card Issuance: Instant digital card creation for online transactions
 * - Physical Card Issuance: Traditional plastic cards for in-person payments
 * - Real-time Transaction Processing: Immediate authorization and settlement
 * - Spending Controls: Configurable limits and restrictions per card
 *
 *
 * Environment Variables Required:
 * - RAIN_API_KEY: Authentication key provided by Rain for API access
 * - RAIN_API_URL: Base URL for Rain's card management API endpoints
 * - RAIN_WEBHOOK_SIGNING_KEY: Signing key for Rain webhook validation
 *
 * @see src/adapters/card/rain/ - Rain card adapter implementation
 * @see src/adapters/card/card.adapter.interface.ts - Card adapter interface
 */
export interface RainConfig {
  /** Rain API authentication key for secure service access */
  apiKey: string;
  /** Base URL for Rain's card management API endpoints */
  apiUrl: string;
  /** Rain PEM for encryption */
  pem: string;
  /** Rain secret for encryption */
  secret: string;
  /** Rain for client id */
  clientId: string;
  /** Rain webhook signing key for webhook validation */
  webhookSigningKey: string;
}

export class RainConfigProvider extends ConfigProvider<RainConfig> {
  getConfig(): RainConfig {
    return {
      apiKey: EnvironmentService.getValue('RAIN_API_KEY'),
      apiUrl: EnvironmentService.getValue('RAIN_BASE_URL'),
      pem: EnvironmentService.getValue('RAIN_PEM'),
      secret: EnvironmentService.getValue('RAIN_SECRET'),
      clientId: EnvironmentService.getValue('RAIN_CLIENT_ID'),
      webhookSigningKey: EnvironmentService.getValue('RAIN_WEBHOOK_SIGNING_KEY'),
    };
  }
}
