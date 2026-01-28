import { Inject, Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { ParticipantAdapter } from '../../adapters/participant/participant.adapter';
import {
  DepositAddressCreateRequest,
  DepositAddressCreateResponse,
  DepositAddressFetchRequest,
} from '../../adapters/participant/participant.adapter.interface';
import { DepositAddressModel } from '../../database/models/depositAddress/depositAddress.model';
import { UserModel } from '../../database/models/user/user.model';
import { EnvironmentService } from '../../config/environment/environment.service';
import { ExternalAccountRepository } from '../externalAccount/external-account.repository';
import { DepositAddressRepository } from './depositAddress.repository';

@Injectable()
export class DepositAddressService {
  private readonly logger = new Logger(DepositAddressService.name);

  @Inject(ParticipantAdapter)
  private readonly participantAdapter: ParticipantAdapter;

  @Inject(DepositAddressRepository)
  private readonly depositAddressRepository: DepositAddressRepository;

  @Inject(ExternalAccountRepository)
  private readonly externalAccountRepository: ExternalAccountRepository;

  /**
   * Create a deposit address for a user with a specific asset
   */
  async createDepositAddress(
    user: UserModel,
    userRef: string,
    asset?: string,
    provider?: string,
  ): Promise<DepositAddressModel> {
    this.logger.log(`Creating deposit address for user ${user.id}, asset: ${asset}, participant: ${userRef}`);

    try {
      // Check if deposit address already exists for this user and asset
      const existingDepositAddress = await this.depositAddressRepository.findByUserIdAndAsset(user.id, asset);

      if (existingDepositAddress) {
        this.logger.log(`Deposit address already exists for user ${user.id} and asset ${asset}`);
        return existingDepositAddress;
      }

      // Create deposit address via adapter
      const adapterRequest: DepositAddressCreateRequest = {
        userRef,
        asset, // Include the asset parameter
      };

      const adapterResponse: DepositAddressCreateResponse = await this.participantAdapter.createDepositAddress(
        adapterRequest,
        user.country?.code, // Use user's country code directly
      );

      // Save to database
      const depositAddress = await this.depositAddressRepository.create({
        user_id: user.id,
        provider,
        asset: adapterResponse.asset,
        address: adapterResponse.address,
      });

      this.logger.log(`Created deposit address ${depositAddress.id} for user ${user.id}`);

      return depositAddress;
    } catch (error) {
      this.logger.error(`Error creating deposit address for user ${user.id}:`, error);
      throw new InternalServerErrorException('Failed to create deposit address');
    }
  }

  /**
   * Get all deposit addresses for a user
   * Checks for default provider/currency deposit address, fetches from provider if needed
   */
  async getDepositAddresses(user: UserModel): Promise<DepositAddressModel[]> {
    this.logger.log(`Fetching deposit addresses for user ${user.id}`);

    try {
      const defaultProvider = EnvironmentService.getValue('DEFAULT_USD_FIAT_WALLET_PROVIDER');
      const defaultCurrency = EnvironmentService.getValue('DEFAULT_UNDERLYING_CURRENCY');

      // Fetch all existing deposit addresses for the user
      const depositAddresses = await this.depositAddressRepository.findByUserId(user.id);

      // Check if default provider/currency deposit address exists
      const hasDefaultAddress = depositAddresses.some(
        (address) => address.provider === defaultProvider && address.asset === defaultCurrency,
      );

      if (hasDefaultAddress) {
        this.logger.log(
          `Found existing deposit address for user ${user.id}, provider: ${defaultProvider}, asset: ${defaultCurrency}`,
        );
        return depositAddresses;
      }

      // Default deposit address doesn't exist in DB, try to fetch from provider
      this.logger.log(
        `No deposit address found in DB for user ${user.id}, provider: ${defaultProvider}, asset: ${defaultCurrency}. Checking provider...`,
      );

      // Load user's country if not already loaded (needed for provider check)
      if (!user.country) {
        await user.$fetchGraph('country');
      }

      // Check if user has a country before proceeding
      if (!user.country?.code) {
        this.logger.warn(`User ${user.id} does not have a country code, skipping provider check`);
        return depositAddresses;
      }

      // Get user's external account with participant_code
      const externalAccounts = await this.externalAccountRepository.findByUserId(user.id);
      const externalAccount = externalAccounts.find(
        (account) => account.participant_code && account.provider === defaultProvider,
      );

      if (!externalAccount?.participant_code) {
        this.logger.warn(`No external account with participant_code found for user ${user.id}`);
        return depositAddresses;
      }

      // Try to fetch deposit address from provider
      try {
        const getDepositAddressRequest: DepositAddressFetchRequest = {
          participantCode: externalAccount.participant_code,
          asset: defaultCurrency,
        };

        const providerDepositAddress = await this.participantAdapter.getDepositAddress(
          getDepositAddressRequest,
          user.country?.code,
        );

        if (providerDepositAddress.address) {
          // Save the fetched deposit address to DB
          this.logger.log(
            `Found deposit address in provider for user ${user.id}, saving to DB: ${providerDepositAddress.address}`,
          );

          const newDepositAddress = await this.depositAddressRepository.create({
            user_id: user.id,
            provider: defaultProvider,
            asset: providerDepositAddress.asset,
            address: providerDepositAddress.address,
          });

          depositAddresses.push(newDepositAddress);
          this.logger.log(`Saved deposit address to DB for user ${user.id}`);
        } else {
          // Not found in provider, create new deposit address
          this.logger.log(`No deposit address found in provider for user ${user.id}, creating new one...`);

          const newDepositAddress = await this.createDepositAddress(
            user,
            externalAccount.participant_code,
            defaultCurrency,
            defaultProvider,
          );

          depositAddresses.push(newDepositAddress);
        }
      } catch (error) {
        this.logger.error(
          `Error fetching/creating deposit address from provider for user ${user.id}: ${error.message}`,
        );
        // Continue and return existing addresses even if fetch/create fails
      }

      this.logger.log(`Returning ${depositAddresses.length} deposit addresses for user ${user.id}`);
      return depositAddresses;
    } catch (error) {
      this.logger.error(`Error fetching deposit addresses for user ${user.id}:`, error);
      throw new InternalServerErrorException('Failed to fetch deposit addresses');
    }
  }

  /**
   * Get Rain deposit address for the default chain
   */
  async getRainDepositAddressForDefaultChain(user: UserModel): Promise<DepositAddressModel | null> {
    this.logger.log(`Fetching Rain deposit address for default chain for user ${user.id}`);

    // TODO: use the staablecoin config to get the default + query with rain
    try {
      const rainAddress = await this.depositAddressRepository.findLatestRainDepositAddressByUserId(user.id);

      if (!rainAddress) {
        this.logger.warn(`No Rain deposit addresses found for user ${user.id}`);
        return null;
      }

      this.logger.log(`Found Rain deposit address ${rainAddress.id} for user ${user.id} on chain ${rainAddress.asset}`);

      return rainAddress;
    } catch (error) {
      this.logger.error(`Error fetching Rain deposit address for user ${user.id}:`, error);
      throw new InternalServerErrorException('Failed to fetch Rain deposit address');
    }
  }
}
