import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotImplementedException,
} from '@nestjs/common';
import { AxiosError } from 'axios';

import { CountryCode, DepositoryAccountSubtype, ProcessorTokenCreateRequestProcessorEnum, Products } from 'plaid';
import {
  AccountsRequest,
  AccountsResponse,
  CloseAccountRequest,
  CloseAccountResponse,
  CreateTokenRequest,
  CreateTokenResponse,
  IBankAccountLinkingAdapter,
  LinkAccountRequest,
  LinkAccountResponse,
  LinkProduct,
  ProcessorTokenRequest,
  ProcessorTokenResponse,
  TokenExchangeRequest,
  TokenExchangeResponse,
  UnlinkAccountRequest,
  UnlinkAccountResponse,
} from '../link-bank-account.adapter.interface';
import { PlaidConnector } from './plaid.connector';

@Injectable()
export class PlaidAdapter extends PlaidConnector implements IBankAccountLinkingAdapter {
  private readonly logger = new Logger(PlaidAdapter.name);

  async linkBankAccount(req: LinkAccountRequest): Promise<LinkAccountResponse> {
    this.logger.debug(`Linking bank account for participant ${req.externalRef}`);
    throw new NotImplementedException('PlaidAdapter does not support linkBankAccount; use ZerohashAdapter');
  }

  async createLinkToken(req: CreateTokenRequest): Promise<CreateTokenResponse> {
    this.logger.debug(`Creating Plaid link token for user ${req.user.userRef}`);
    const plaidConfig = this.configProvider.getConfig();

    const baseRequest = {
      client_id: plaidConfig.clientId,
      secret: plaidConfig.secret,
      client_name: req.clientName,
      country_codes: [CountryCode.Us],
      language: 'en',
      webhook: plaidConfig.webhook,
      link_customization_name: 'onedosh',
      redirect_uri: req.androidPackageName ? undefined : plaidConfig.redirect_uri,
      android_package_name: req.androidPackageName,
    };

    let linkTokenRequest;

    if (req.accessToken) {
      // Update mode - simplified request
      this.logger.debug('Creating link token in UPDATE mode');
      linkTokenRequest = {
        ...baseRequest,
        user: {
          client_user_id: req.user.userRef,
        },
        access_token: req.accessToken,
        update: { account_selection_enabled: false },
      };
    } else {
      // New linking mode - full request
      this.logger.debug('Creating link token in NEW LINKING mode');
      linkTokenRequest = {
        ...baseRequest,
        user: this.mapPlaidUser(req),
        products: [Products.Auth, Products.Identity, Products.Signal],
        account_filters: {
          depository: {
            account_subtypes: [DepositoryAccountSubtype.Checking],
          },
        },
      };
    }

    this.logger.debug(
      `Plaid linkTokenCreate request:\n${JSON.stringify(
        {
          ...linkTokenRequest,
          client_id: linkTokenRequest.client_id?.substring(0, 10) + '...',
          secret: '***REDACTED***',
          access_token: linkTokenRequest.access_token
            ? linkTokenRequest.access_token.substring(0, 15) + '...'
            : undefined,
        },
        null,
        2,
      )}`,
    );

    try {
      const response = await this.linkTokenCreate(linkTokenRequest);

      if (!response) {
        this.logger.error('Plaid linkTokenCreate returned undefined response');
        throw new InternalServerErrorException('Plaid API returned no response. Please check Plaid configuration.');
      }

      const responseData = response.data;

      if (!responseData) {
        this.logger.error('Plaid linkTokenCreate response has no data');
        throw new BadRequestException('Malformed API Response from Plaid');
      }

      if (!responseData.link_token || !responseData.expiration || !responseData.request_id) {
        this.logger.error('Plaid linkTokenCreate response missing required fields', responseData);
        throw new BadRequestException('Incomplete API Response from Plaid');
      }

      return {
        token: responseData.link_token,
        expiration: responseData.expiration,
        requestRef: responseData.request_id,
      };
    } catch (err) {
      const e = err as AxiosError;
      this.logger.error('Plaid linkTokenCreate failed', e.response?.data || e.message);
      throw new InternalServerErrorException(JSON.stringify(e.response?.data || e.message));
    }
  }

  async exchangeToken(req: TokenExchangeRequest): Promise<TokenExchangeResponse> {
    this.logger.debug(`Exchanging public_token: ${req.publicToken?.substring(0, 10)}...`);
    const plaidConfig = this.configProvider.getConfig();

    this.logger.debug(`Plaid config - clientId: ${plaidConfig.clientId?.substring(0, 10)}..., env: ${plaidConfig.env}`);

    // Validate essential config
    if (!plaidConfig.clientId || !plaidConfig.secret) {
      this.logger.error('Missing Plaid configuration - clientId or secret not set');
      throw new InternalServerErrorException('Plaid configuration is incomplete');
    }

    let timeoutId: NodeJS.Timeout | undefined;

    try {
      this.logger.debug('About to call Plaid itemPublicTokenExchange...');

      // Add timeout wrapper to prevent hanging
      const timeoutPromise = new Promise((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error('Plaid API call timed out after 30 seconds')), 30000);
      });

      const apiPromise = this.itemPublicTokenExchange({
        client_id: plaidConfig.clientId,
        secret: plaidConfig.secret,
        public_token: req.publicToken,
      });

      const res = (await Promise.race([apiPromise, timeoutPromise])) as any;

      this.logger.debug('Plaid itemPublicTokenExchange successful');
      return {
        accessToken: res.data.access_token,
        itemId: res.data.item_id,
        requestRef: res.data.request_id,
      };
    } catch (err) {
      const e = err as AxiosError;
      this.logger.error('Plaid itemPublicTokenExchange failed', e.response?.data || e.message);
      this.logger.error('Error details:', {
        message: e.message,
        code: e.code,
        status: e.response?.status,
        statusText: e.response?.statusText,
      });
      throw new InternalServerErrorException(JSON.stringify(e.response?.data || e.message));
    } finally {
      // Clear the timeout to prevent open handles
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    }
  }

  async getAccounts(req: AccountsRequest): Promise<AccountsResponse> {
    this.logger.debug(`Fetching accounts for access_token=${req.accessToken}`);
    const plaidConfig = this.configProvider.getConfig();

    try {
      const res = await this.accountsGet({
        client_id: plaidConfig.clientId,
        secret: plaidConfig.secret,
        access_token: req.accessToken,
      });

      return {
        accounts: res.data.accounts.map((a) => ({
          ref: a.account_id,
          balances: this.mapAccountBalances(a),
          holderCategory: a.holder_category,
          mask: a.mask,
          name: a.name,
          officialName: a.official_name,
          persistentRef: a.persistent_account_id,
          subtype: a.subtype,
          type: a.type,
        })),
        item: this.mapPlaidItem(res.data.item),
        requestRef: res.data.request_id,
      };
    } catch (err) {
      const e = err as AxiosError;
      this.logger.error('Plaid accountsGet failed', e.response?.data ?? e.message);
      throw new InternalServerErrorException(JSON.stringify(e.response?.data ?? e.message));
    }
  }

  async createProcessorToken(req: ProcessorTokenRequest): Promise<ProcessorTokenResponse> {
    this.logger.debug(`Creating processor token for account ${req.accountRef}`);
    const plaidConfig = this.configProvider.getConfig();

    try {
      const res = await this.processorTokenCreate({
        client_id: plaidConfig.clientId,
        secret: plaidConfig.secret,
        access_token: req.accessToken,
        account_id: req.accountRef,
        processor: ProcessorTokenCreateRequestProcessorEnum.ZeroHash,
      });
      return {
        processorToken: res.data.processor_token,
        requestRef: res.data.request_id,
      };
    } catch (err) {
      const e = err as AxiosError;
      this.logger.error('Plaid processorTokenCreate failed', e.response?.data || e.message);
      throw new InternalServerErrorException(JSON.stringify(e.response?.data || e.message));
    }
  }

  supportedCountries(): string[] {
    return ['US'];
  }

  private mapPlaidUser(req: CreateTokenRequest) {
    const user: any = {
      client_user_id: req.user.userRef,
    };

    // Only include optional fields if they're provided and not empty
    if (req.user.phone?.trim()) user.phone_number = req.user.phone;
    if (req.user.email?.trim()) user.email_address = req.user.email;
    if (req.user.fullName?.trim()) user.legal_name = req.user.fullName;
    if (req.user.dob?.trim()) user.date_of_birth = req.user.dob;

    if (req.user.address) {
      user.address = {
        street: req.user.address.street,
        city: req.user.address.city,
        region: req.user.address.region,
        postal_code: req.user.address.postalCode,
        country: req.user.address.country,
      };

      // Include street2 if provided
      if (req.user.address.street2?.trim()) {
        user.address.street += ` ${req.user.address.street2}`;
      }
    }

    return user;
  }

  private mapAccountBalances(a: any) {
    return {
      available: a.balances.available,
      current: a.balances.current,
      currencyIso: a.balances.iso_currency_code,
      limit: a.balances.limit,
      unofficialCurrencyIso: a.balances.unofficial_currency_code,
    };
  }

  private mapPlaidItem(item: any): AccountsResponse['item'] {
    return {
      authMethod: item.auth_method ?? null,
      availableProducts: item.available_products as LinkProduct[],
      billedProducts: item.billed_products as LinkProduct[],
      consentExpirationTime: item.consent_expiration_time ?? null,
      error: item.error ?? null,
      institutionRef: item.institution_id ?? null,
      institutionName: item.institution_name ?? null,
      itemId: item.item_id,
      products: item.products as LinkProduct[],
      updateType: item.update_type,
      webhook: item.webhook ?? null,
    };
  }

  async unlinkAccount(req: UnlinkAccountRequest): Promise<UnlinkAccountResponse> {
    this.logger.debug(`Unlinking Plaid account with access token`);
    const plaidConfig = this.configProvider.getConfig();

    try {
      const response = await this.itemRemove({
        client_id: plaidConfig.clientId,
        secret: plaidConfig.secret,
        access_token: req.accessToken,
      });

      this.logger.debug(`Successfully unlinked Plaid account`);

      return {
        requestRef: response.data.request_id,
        removed: true,
      };
    } catch (err) {
      const e = err as AxiosError;
      this.logger.error('Plaid itemRemove failed', e.response?.data ?? e.message);
      throw new InternalServerErrorException(JSON.stringify(e.response?.data ?? e.message));
    }
  }

  async closeAccount(req: CloseAccountRequest): Promise<CloseAccountResponse> {
    this.logger.debug(`closeAccount not supported by Plaid: ${JSON.stringify(req)}`);
    throw new NotImplementedException('PlaidAdapter does not support closeAccount; use ZerohashAdapter instead.');
  }
}
