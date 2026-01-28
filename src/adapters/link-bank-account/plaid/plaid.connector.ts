import { InternalServerErrorException } from '@nestjs/common';
import { Configuration, PlaidApi, PlaidEnvironments } from 'plaid';
import { EnvironmentService } from '../../../config/environment/environment.service';
import { PlaidConfigProvider } from '../../../config/plaid.config';

export class PlaidConnector extends PlaidApi {
  protected readonly configProvider: PlaidConfigProvider;

  constructor() {
    const configProvider = new PlaidConfigProvider();
    const plaidConfig = configProvider.getConfig();

    // Validate required Plaid configuration
    if ((!plaidConfig.clientId || !plaidConfig.secret || !plaidConfig.env) && !EnvironmentService.isTest()) {
      throw new InternalServerErrorException(
        'Plaid configuration is incomplete. Missing required fields: clientId, secret, or env',
      );
    }

    // Validate Plaid environment
    if (!PlaidEnvironments[plaidConfig.env] && !EnvironmentService.isTest()) {
      throw new InternalServerErrorException(
        `Invalid Plaid environment: ${plaidConfig.env}. Must be one of: ${Object.keys(PlaidEnvironments).join(', ')}`,
      );
    }

    const configuration = new Configuration({
      basePath: PlaidEnvironments[plaidConfig.env],
      baseOptions: {
        headers: {
          PLAID_CLIENT_ID: plaidConfig.clientId,
          PLAID_SECRET: plaidConfig.secret,
          PLAID_WEBHOOK: plaidConfig.webhook,
          PLAID_REDIRECT_URI: plaidConfig.redirect_uri,
        },
      },
    });
    super(configuration);

    this.configProvider = configProvider;
  }
}
