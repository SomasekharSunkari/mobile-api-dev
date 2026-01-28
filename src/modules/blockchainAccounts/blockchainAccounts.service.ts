import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { BlockchainAccountRail } from '../../constants/blockchainAccountRails';
import {
  BlockchainAccountProvider,
  BlockchainAccountStatus,
} from '../../database/models/blockchain_account/blockchain_account.interface';
import { BlockchainAccountModel } from '../../database/models/blockchain_account/blockchain_account.model';
import { BlockchainAccountsRepository } from './blockchainAccounts.repository';

@Injectable()
export class BlockchainAccountsService {
  private readonly logger = new Logger(BlockchainAccountsService.name);

  constructor(private readonly blockchainAccountsRepository: BlockchainAccountsRepository) {}

  async createAccount(
    userId: string,
    providerRef: string,
    provider: BlockchainAccountProvider = BlockchainAccountProvider.FIREBLOCKS,
    rails: BlockchainAccountRail = 'crypto',
  ): Promise<BlockchainAccountModel> {
    try {
      this.logger.log(`Creating blockchain account for user ${userId} with provider ${provider}`);

      // Check if user already has an account for this specific rails (active or inactive)
      const existingAccounts = await this.blockchainAccountsRepository.findByUserId(userId);
      const existingAccountForRails = existingAccounts.find((acc) => acc.rails === rails);

      if (existingAccountForRails) {
        this.logger.log(
          `User ${userId} already has a ${existingAccountForRails.provider} account with rails ${rails} and status ${existingAccountForRails.status}`,
        );
        return existingAccountForRails;
      }

      const accountData = {
        user_id: userId,
        provider,
        provider_ref: providerRef,
        status: BlockchainAccountStatus.ACTIVE,
        rails,
        is_visible: rails === 'crypto',
      };

      const account = await this.blockchainAccountsRepository.create(accountData);
      this.logger.log(`Created blockchain account ${account.id} for user ${userId}`);

      return account;
    } catch (error) {
      this.logger.error(`Error creating blockchain account: ${error.message}`, error.stack);
      throw error;
    }
  }

  async getUserAccounts(userId: string): Promise<BlockchainAccountModel[]> {
    try {
      this.logger.log(`Fetching blockchain accounts for user ${userId}`);
      const accounts = await this.blockchainAccountsRepository.findByUserId(userId);
      this.logger.log(`Found ${accounts.length} blockchain accounts for user ${userId}`);
      return accounts;
    } catch (error) {
      this.logger.error(`Error fetching user accounts: ${error.message}`, error.stack);
      throw error;
    }
  }

  async getUserActiveAccounts(userId: string): Promise<BlockchainAccountModel[]> {
    try {
      this.logger.log(`Fetching active blockchain accounts for user ${userId}`);
      const accounts = await this.blockchainAccountsRepository.findActiveByUserId(userId);
      this.logger.log(`Found ${accounts.length} active blockchain accounts for user ${userId}`);
      return accounts;
    } catch (error) {
      this.logger.error(`Error fetching active user accounts: ${error.message}`, error.stack);
      throw error;
    }
  }

  async getAccountById(accountId: string): Promise<BlockchainAccountModel> {
    try {
      const account = (await this.blockchainAccountsRepository.findById(
        accountId,
      )) as unknown as BlockchainAccountModel;

      if (!account) {
        throw new NotFoundException(`Blockchain account with ID ${accountId} not found`);
      }
      return account;
    } catch (error) {
      this.logger.error(`Error fetching account by ID: ${error.message}`, error.stack);
      throw error;
    }
  }

  async getAccountByProviderRef(providerRef: string): Promise<BlockchainAccountModel> {
    try {
      const account = await this.blockchainAccountsRepository.findByProviderRef(providerRef);
      if (!account) {
        throw new NotFoundException(`Blockchain account with provider ref ${providerRef} not found`);
      }
      return account;
    } catch (error) {
      this.logger.error(`Error fetching account by provider ref: ${error.message}`, error.stack);
      throw error;
    }
  }

  async updateAccountStatus(accountId: string, status: BlockchainAccountStatus): Promise<BlockchainAccountModel> {
    try {
      this.logger.log(`Updating account ${accountId} status to ${status}`);

      const account = (await this.blockchainAccountsRepository.findById(
        accountId,
      )) as unknown as BlockchainAccountModel;
      if (!account) {
        throw new NotFoundException(`Blockchain account with ID ${accountId} not found`);
      }

      const updatedAccount = (await this.blockchainAccountsRepository.update(accountId, {
        status,
      })) as unknown as BlockchainAccountModel;
      this.logger.log(`Updated account ${accountId} status to ${status}`);

      return updatedAccount;
    } catch (error) {
      this.logger.error(`Error updating account status: ${error.message}`, error.stack);
      throw error;
    }
  }

  async deactivateAccount(accountId: string): Promise<BlockchainAccountModel> {
    return this.updateAccountStatus(accountId, BlockchainAccountStatus.INACTIVE);
  }

  async activateAccount(accountId: string): Promise<BlockchainAccountModel> {
    return this.updateAccountStatus(accountId, BlockchainAccountStatus.ACTIVE);
  }
}
