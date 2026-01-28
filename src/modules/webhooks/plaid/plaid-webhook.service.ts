import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ExternalAccountAdapter } from '../../../adapters/external-account/external-account.adapter';
import { LinkBankAccountAdapter } from '../../../adapters/link-bank-account/link-bank-account.adapter';
import { CreateTokenRequest } from '../../../adapters/link-bank-account/link-bank-account.adapter.interface';
import { ExternalAccountStatus } from '../../../database/models/externalAccount/externalAccount.interface';
import { RedisCacheService } from '../../../services/redis/redis-cache.service';
import { UserRepository } from '../../auth/user/user.repository';
import { ExternalAccountService } from '../../externalAccount/external-account.service';
import { IN_APP_NOTIFICATION_TYPE } from '../../inAppNotification/inAppNotification.enum';
import { InAppNotificationService } from '../../inAppNotification/inAppNotification.service';

@Injectable()
export class PlaidWebhookService {
  private readonly logger = new Logger(PlaidWebhookService.name);

  @Inject(ExternalAccountService)
  private readonly externalAccountService: ExternalAccountService;

  @Inject(LinkBankAccountAdapter)
  private readonly linkBankAccountAdapter: LinkBankAccountAdapter;

  @Inject(RedisCacheService)
  private readonly redisCacheService: RedisCacheService;

  @Inject(UserRepository)
  private readonly userRepository: UserRepository;

  @Inject(ExternalAccountAdapter)
  private readonly externalAccountAdapter: ExternalAccountAdapter;

  @Inject(InAppNotificationService)
  private readonly inAppNotificationService: InAppNotificationService;

  /**
   * Handle Plaid webhook payload
   */
  async handleWebhook(payload: any): Promise<void> {
    this.logger.log(`Processing Plaid webhook: type=${payload.webhook_type}, code=${payload.webhook_code}`);

    // Handle ITEM webhook types
    if (payload.webhook_type === 'ITEM') {
      await this.handleItemWebhook(payload);
    }

    // Handle AUTH webhook types
    if (payload.webhook_type === 'AUTH') {
      await this.handleAuthWebhook(payload);
    }

    // Add other webhook type handlers here as needed
  }

  /**
   * Handle ITEM webhook events
   */
  private async handleItemWebhook(payload: any): Promise<void> {
    const { webhook_code, item_id, error } = payload;

    // Handle ERROR webhook codes
    if (webhook_code === 'ERROR' && error?.error_code) {
      await this.handleItemError(item_id, error.error_code);
    }

    // Handle PENDING_DISCONNECT webhook code
    if (webhook_code === 'PENDING_DISCONNECT') {
      await this.handlePendingDisconnect(item_id);
    }

    // Handle USER_PERMISSION_REVOKED webhook code
    if (webhook_code === 'USER_PERMISSION_REVOKED') {
      await this.handleUserPermissionRevoked(item_id);
    }

    // Handle USER_ACCOUNT_REVOKED webhook code
    if (webhook_code === 'USER_ACCOUNT_REVOKED') {
      await this.handleUserAccountRevoked(item_id);
    }

    // Add other ITEM webhook code handlers here as needed
  }

  /**
   * Handle AUTH webhook events
   */
  private async handleAuthWebhook(payload: any): Promise<void> {
    const { webhook_code, item_id } = payload;

    // Handle DEFAULT_UPDATE webhook codes
    if (webhook_code === 'DEFAULT_UPDATE') {
      await this.handleAuthDefaultUpdate(item_id, payload);
    }

    // Add other AUTH webhook code handlers here as needed
  }

  /**
   * Handle ITEM_ERROR by updating external account status
   */
  private async handleItemError(itemId: string, errorCode: string): Promise<void> {
    try {
      this.logger.log(`Handling ITEM_ERROR for item_id=${itemId}, error_code=${errorCode}`);

      // Find external account by linked_item_ref
      const externalAccount = await this.externalAccountService.findOne({
        linked_item_ref: itemId,
      });

      if (!externalAccount) {
        this.logger.warn(`No external account found for item_id=${itemId}`);
        throw new NotFoundException(`External account with item_id ${itemId} not found`);
      }

      // Convert error code to lowercase for database storage
      const statusValue: ExternalAccountStatus = errorCode.toLowerCase() as ExternalAccountStatus;

      // Update status to the error code
      await this.externalAccountService.update({ id: externalAccount.id }, { status: statusValue });

      this.logger.log(`Updated external account ${externalAccount.id} status to ${statusValue} for item_id=${itemId}`);

      // Handle login required case - generate update link token
      if (errorCode === 'ITEM_LOGIN_REQUIRED') {
        await this.handleLoginRequired(externalAccount, itemId);
      }
    } catch (error) {
      this.logger.error(`Failed to handle ITEM_ERROR for item_id=${itemId}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Handle PENDING_DISCONNECT by updating external account status
   */
  private async handlePendingDisconnect(itemId: string): Promise<void> {
    try {
      this.logger.log(`Handling PENDING_DISCONNECT for item_id=${itemId}`);

      // Find external account by linked_item_ref
      const externalAccount = await this.externalAccountService.findOne({
        linked_item_ref: itemId,
      });

      if (!externalAccount) {
        this.logger.warn(`No external account found for item_id=${itemId}`);
        throw new NotFoundException(`External account with item_id ${itemId} not found`);
      }

      // Update status to PENDING_DISCONNECT
      await this.externalAccountService.update(
        { id: externalAccount.id },
        { status: ExternalAccountStatus.PENDING_DISCONNECT },
      );

      this.logger.log(
        `Updated external account ${externalAccount.id} status to pending_disconnect for item_id=${itemId}`,
      );
    } catch (error) {
      this.logger.error(`Failed to handle PENDING_DISCONNECT for item_id=${itemId}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Handle USER_PERMISSION_REVOKED by soft deleting external account
   */
  private async handleUserPermissionRevoked(itemId: string): Promise<void> {
    try {
      this.logger.log(`Handling USER_PERMISSION_REVOKED for item_id=${itemId}`);

      // Find external account by linked_item_ref
      const externalAccount = await this.externalAccountService.findOne({
        linked_item_ref: itemId,
      });

      if (!externalAccount) {
        this.logger.warn(`No external account found for item_id=${itemId}`);
        throw new NotFoundException(`External account with item_id ${itemId} not found`);
      }

      // Soft delete first by setting deleted_at timestamp
      // Keep tokens for potential recovery via update mode, but mark as deleted
      await this.externalAccountService.update(
        { id: externalAccount.id },
        {
          status: ExternalAccountStatus.USER_PERMISSION_REVOKED,
          // Keep all tokens and refs for potential restoration via update mode
        },
      );
      await this.externalAccountService.delete({ id: externalAccount.id });

      // Clear cached update token since the account is no longer valid
      const redisKey = `link_token_update:${externalAccount.user_id}:plaid`;
      await this.redisCacheService.del(redisKey);

      // Then create duplicate record (now that original is soft-deleted)
      await this.externalAccountService.createDuplicateRecord(externalAccount);

      this.logger.log(
        `Soft deleted external account ${externalAccount.id} for item_id=${itemId} - set status to user_permission_revoked`,
      );
    } catch (error) {
      this.logger.error(`Failed to handle USER_PERMISSION_REVOKED for item_id=${itemId}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Handle USER_ACCOUNT_REVOKED by soft deleting external account
   * Since users are only allowed one account per item, we only need to lookup by item_id
   */
  private async handleUserAccountRevoked(itemId: string): Promise<void> {
    try {
      this.logger.log(`Handling USER_ACCOUNT_REVOKED for item_id=${itemId}`);

      // Find external account by linked_item_ref (only one account per item allowed)
      const externalAccount = await this.externalAccountService.findOne({
        linked_item_ref: itemId,
      });

      if (!externalAccount) {
        this.logger.warn(`No external account found for item_id=${itemId}`);
        throw new NotFoundException(`External account with item_id ${itemId} not found`);
      }

      // Soft delete first by setting deleted_at timestamp
      // Keep tokens for potential recovery via update mode, but mark as deleted
      await this.externalAccountService.update(
        { id: externalAccount.id },
        {
          status: ExternalAccountStatus.USER_ACCOUNT_REVOKED,
          // Keep all tokens and refs for potential restoration via update mode
        },
      );
      await this.externalAccountService.delete({ id: externalAccount.id });

      // Clear cached update token since the account is no longer valid
      const redisKey = `link_token_update:${externalAccount.user_id}:plaid`;
      await this.redisCacheService.del(redisKey);

      // Then create duplicate record (now that original is soft-deleted)
      await this.externalAccountService.createDuplicateRecord(externalAccount);

      this.logger.log(
        `Soft deleted external account ${externalAccount.id} for item_id=${itemId} - set status to user_account_revoked`,
      );
    } catch (error) {
      this.logger.error(`Failed to handle USER_ACCOUNT_REVOKED for item_id=${itemId}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Handle AUTH DEFAULT_UPDATE by refreshing account and routing numbers
   */
  private async handleAuthDefaultUpdate(itemId: string, payload: any): Promise<void> {
    try {
      this.logger.log(`Handling AUTH DEFAULT_UPDATE for item_id=${itemId}`);

      // Check if there are accounts with updated auth data first
      const accountsWithUpdatedAuth = payload.account_ids_with_updated_auth || {};
      const updatedAccountIds = Object.keys(accountsWithUpdatedAuth);
      const hasUpdatedAuth = updatedAccountIds.length > 0;

      if (!hasUpdatedAuth) {
        this.logger.log(`No accounts with updated auth data for item_id=${itemId}, no action needed`);
        return;
      }

      // Find external account by linked_item_ref
      const externalAccount = await this.externalAccountService.findOne({
        linked_item_ref: itemId,
      });

      if (!externalAccount) {
        this.logger.warn(`No external account found for item_id=${itemId}`);
        throw new NotFoundException(`External account with item_id ${itemId} not found`);
      }

      if (!externalAccount.linked_access_token) {
        this.logger.warn(`No access token found for external account ${externalAccount.id}`);
        throw new NotFoundException(`No access token found for external account ${externalAccount.id}`);
      }

      // Check if our linked account is in the list of updated accounts
      const ourAccountUpdated = updatedAccountIds.includes(externalAccount.linked_account_ref);
      if (!ourAccountUpdated) {
        this.logger.log(
          `Our account ${externalAccount.linked_account_ref} not in updated accounts list [${updatedAccountIds.join(', ')}] for item_id=${itemId}, no action needed`,
        );
        return;
      }

      const updatedFields = accountsWithUpdatedAuth[externalAccount.linked_account_ref] || [];
      this.logger.log(
        `Refreshing auth data for external account ${externalAccount.id} - account ${externalAccount.linked_account_ref} has updated fields: ${updatedFields.join(', ')}`,
      );

      // Call external account adapter to refresh auth data
      const refreshResponse = await this.externalAccountAdapter.refreshUserAuthData(
        {
          accessToken: externalAccount.linked_access_token,
          accountRef: externalAccount.linked_account_ref,
        },
        'US',
      );

      // Update external account with new account and routing numbers (only if available)
      const updateData: {
        updated_at: string;
        account_number?: string;
        routing_number?: string;
      } = { updated_at: new Date().toISOString() };

      if (refreshResponse.mask) {
        updateData.account_number = refreshResponse.mask;
      }

      if (refreshResponse.routingNumber) {
        updateData.routing_number = refreshResponse.routingNumber;
      }

      await this.externalAccountService.update({ id: externalAccount.id }, updateData);

      this.logger.log(
        `Updated auth data for external account ${externalAccount.id}: account_number=${updateData.account_number || 'unchanged'}, routing_number=${updateData.routing_number || 'unchanged'}`,
      );
    } catch (error) {
      this.logger.error(`Failed to handle AUTH DEFAULT_UPDATE for item_id=${itemId}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Handle ITEM_LOGIN_REQUIRED by generating update link token
   */
  private async handleLoginRequired(externalAccount: any, itemId: string): Promise<void> {
    try {
      this.logger.log(`Handling ITEM_LOGIN_REQUIRED for external account ${externalAccount.id}`);

      if (!externalAccount.linked_access_token) {
        this.logger.warn(`No access token found for external account ${externalAccount.id}`);
        return;
      }

      // Generate update link token using link bank account adapter directly
      const createTokenRequest: CreateTokenRequest = {
        clientName: 'OneDosh',
        language: 'en',
        user: {
          userRef: externalAccount.user_id,
        },
        accessToken: externalAccount.linked_access_token, // This makes it update mode
      };

      const updateLinkResponse = await this.linkBankAccountAdapter.createLinkToken(createTokenRequest, 'US');

      this.logger.log(
        `Generated update link token for external account ${externalAccount.id}: ${updateLinkResponse.token}`,
      );

      // Store link token in Redis with 1-hour TTL (3600 seconds)
      const redisKey = `link_token_update:${externalAccount.user_id}:plaid`;
      await this.redisCacheService.set(
        redisKey,
        {
          token: updateLinkResponse.token,
          expiration: updateLinkResponse.expiration,
          requestRef: updateLinkResponse.requestRef,
          externalAccountId: externalAccount.id,
          itemId: itemId,
          createdAt: new Date().toISOString(),
        },
        3600,
      ); // 1 hour TTL

      this.logger.log(`Stored link token in Redis with key: ${redisKey}`);

      // Create in-app notification
      await this.inAppNotificationService.createNotification({
        user_id: externalAccount.user_id,
        type: IN_APP_NOTIFICATION_TYPE.ALERT,
        title: 'Bank Account Update Required',
        message: `Your ${externalAccount.bank_name || 'bank'} account needs to be reconnected. Please update your login credentials to continue using this account.`,
        metadata: {
          bankName: externalAccount.bank_name,
          accountId: externalAccount.id,
          accountType: externalAccount.account_type,
        },
      });

      this.logger.log(
        `Created in-app notification for user ${externalAccount.user_id} regarding external account ${externalAccount.id}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to handle ITEM_LOGIN_REQUIRED for external account ${externalAccount.id}: ${error.message}`,
      );
      throw error;
    }
  }
}
