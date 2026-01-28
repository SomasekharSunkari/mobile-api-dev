import { BadRequestException, Inject, Injectable, Logger } from '@nestjs/common';
import { ProcessorTokenCreateRequestProcessorEnum } from 'plaid';
import { LinkBankAccountAdapter } from '../../../adapters/link-bank-account/link-bank-account.adapter';
import { PROVIDERS } from '../../../constants/constants';
import { UserModel } from '../../../database/models/user/user.model';
import { RedisCacheService } from '../../../services/redis/redis-cache.service';

import { ExternalAccountService } from '../external-account.service';
import { PlaidLinkTokenExchangeDto } from './dto/link_external_account.dto';
import { InAppNotificationService } from '../../inAppNotification/inAppNotification.service';
import { IN_APP_NOTIFICATION_TYPE } from '../../inAppNotification/inAppNotification.enum';
import { MailerService } from '../../../services/queue/processors/mailer/mailer.service';
import { BankAccountLinkedMail } from '../../../notifications/mails/bank_account_linked_mail';
import { ExternalAccountStatus } from '../../../database/models/externalAccount/externalAccount.interface';

@Injectable()
export class LinkExternalAccountService {
  private readonly logger = new Logger(LinkExternalAccountService.name);

  @Inject(LinkBankAccountAdapter)
  private readonly linkBankAccountAdapter: LinkBankAccountAdapter;

  @Inject(ExternalAccountService)
  private readonly externalAccountService: ExternalAccountService;

  @Inject(RedisCacheService)
  private readonly redisCacheService: RedisCacheService;

  @Inject(InAppNotificationService)
  private readonly inAppNotificationService: InAppNotificationService;

  @Inject(MailerService)
  private readonly mailerService: MailerService;

  public async handleTokenExchangeAndAccountLink(
    body: PlaidLinkTokenExchangeDto,
    user: UserModel,
  ): Promise<{ success: boolean; message: string }> {
    this.logger.debug(`Starting handleTokenExchangeAndAccountLink for user ${user.id}`);

    try {
      const { public_token, metadata } = body;
      const countryCode = 'US';

      this.logger.debug('Step 1: Exchanging public_token for access_token...');
      const { accessToken, itemId } = await this.exchangePublicTokenForAccessToken(public_token, countryCode);
      this.logger.debug(`Step 1 completed - accessToken: ${accessToken?.substring(0, 10)}..., itemId: ${itemId}`);

      this.logger.debug('Step 3: Reading selected accounts and institution from metadata...');
      const selectedAccounts = metadata?.accounts || [];
      const institution = metadata?.institution;

      if (!selectedAccounts.length) {
        throw new BadRequestException('No accounts selected');
      }

      this.logger.debug('Step 4: Fetching accounts from Plaid /accounts/get...');
      const plaidAccountsResponse = await this.linkBankAccountAdapter.getAccounts({ accessToken }, countryCode);
      const plaidAccounts = plaidAccountsResponse.accounts;
      const plaidItemIdFromAccounts = plaidAccountsResponse.item?.itemId;

      if (plaidItemIdFromAccounts !== itemId) {
        throw new BadRequestException('Item ID mismatch between Plaid /accounts/get and token exchange');
      }

      this.logger.debug('Step 5: Validating selected account IDs match Plaid account IDs...');
      const selectedAccountIds = new Set(selectedAccounts.map((a) => a.id));
      const plaidAccountIds = new Set(plaidAccounts.map((a) => a.ref));

      const allMatch =
        selectedAccounts.length === plaidAccounts.length && selectedAccounts.every((a) => plaidAccountIds.has(a.id));

      if (!allMatch) {
        const selectedIds = [...selectedAccountIds].join(', ');
        const plaidIds = [...plaidAccountIds].join(', ');
        throw new BadRequestException(`Mismatch in account IDs. Selected: [${selectedIds}] vs Plaid: [${plaidIds}]`);
      }

      // All validation (KYC + ExternalAccount) already performed in createLinkToken endpoint
      this.logger.debug(`Step 6: Fetching Zerohash ExternalAccount for user ${user.id}...`);
      const existingExternalAccount = await this.externalAccountService.findOne({
        user_id: user.id,
        provider: PROVIDERS.ZEROHASH,
      });

      const userRef = existingExternalAccount.participant_code;

      for (const account of selectedAccounts) {
        this.logger.debug('Step 7: Creating processor token...');
        const { processorToken } = await this.linkBankAccountAdapter.createProcessorToken(
          {
            accessToken,
            accountRef: account.id,
            provider: ProcessorTokenCreateRequestProcessorEnum.ZeroHash,
          },
          countryCode,
        );

        this.logger.debug('Step 8: Calling Zero Hash linkBankAccount...');
        const linkResult = await this.linkBankAccountAdapter.linkBankAccount(
          {
            externalRef: userRef,
            alias: account.name,
            processorToken: processorToken,
          },
          countryCode,
        );

        const externalAccountRef = linkResult?.accountRef;
        if (!externalAccountRef) {
          throw new BadRequestException('Missing external_account_id from Zero Hash');
        }

        this.logger.debug('Step 9: Updating Zerohash ExternalAccount record...');
        await this.externalAccountService.update(
          { id: existingExternalAccount.id },
          {
            external_account_ref: externalAccountRef,
            linked_provider: PROVIDERS.PLAID,
            linked_item_ref: itemId,
            linked_account_ref: account.id,
            linked_access_token: accessToken,
            linked_processor_token: processorToken,
            bank_name: institution?.name,
            bank_ref: institution?.id,
            account_name: account.name,
            account_type: account.type,
            account_number: account.mask,
          },
        );

        this.logger.log(
          `ExternalAccount id=${existingExternalAccount.id} successfully linked to bank account: ${account.id}`,
        );

        // Send email notification about successful linking
        try {
          const emailNotification = new BankAccountLinkedMail(
            user,
            account.name,
            institution?.name,
            account.type,
            account.mask,
          );

          await this.mailerService.send(emailNotification);
          this.logger.log(
            `Sent bank account linked notification email to ${user.email} for external account ${existingExternalAccount.id}`,
          );
        } catch (emailError) {
          this.logger.error(`Failed to send bank account linked email to ${user.email}: ${emailError.message}`);
          // Don't throw error - email failure shouldn't fail the linking process
        }

        // Send account linking success notification for each account
        await this.inAppNotificationService.createNotification({
          user_id: user.id,
          type: IN_APP_NOTIFICATION_TYPE.ACCOUNT_LINKED,
          title: 'Bank Account Linked Successfully',
          message: `Your ${institution?.name || ''} account has been successfully linked to your OneDosh account.`,
          metadata: { bankName: institution?.name, accountType: account.type, accountId: account.id },
        });
      }

      this.logger.debug('Step 10: Returning final response...');

      return {
        success: true,
        message: 'Bank accounts linked successfully',
      };
    } catch (error) {
      this.logger.error('Error in handleTokenExchangeAndAccountLink:', error);
      this.logger.error('Error stack:', error.stack);
      throw error;
    }
  }

  public async handleCredentialUpdate(
    body: PlaidLinkTokenExchangeDto,
    user: UserModel,
  ): Promise<{ success: boolean; message: string }> {
    this.logger.debug(`Starting handleCredentialUpdate for user ${user.id}`);

    try {
      const { public_token } = body;
      const countryCode = 'US';

      // Step 1: Check if this is a valid update flow by looking for Redis marker
      const redisKey = `link_token_update:${user.id}:plaid`;
      const cachedTokenData = await this.redisCacheService.get<any>(redisKey);

      if (!cachedTokenData) {
        this.logger.warn(`No update token found in Redis for user ${user.id}`);
        throw new BadRequestException('Invalid update request. Please start the update flow from the beginning.');
      }

      this.logger.debug(`Found update token data for user ${user.id}, proceeding with credential update`);

      // Step 2: Exchange public_token for access_token
      this.logger.debug('Step 2: Exchanging public_token for access_token...');
      const { accessToken, itemId } = await this.exchangePublicTokenForAccessToken(public_token, countryCode);
      this.logger.debug(`Step 2 completed - accessToken: ${accessToken?.substring(0, 10)}..., itemId: ${itemId}`);

      // Step 3: Verify this matches the expected item from Redis
      if (cachedTokenData.itemId && cachedTokenData.itemId !== itemId) {
        throw new BadRequestException('Item ID mismatch. This token is for a different bank account.');
      }

      // Step 4: Test the new access token works
      this.logger.debug('Step 4: Testing new access token...');
      const testAccountsResponse = await this.linkBankAccountAdapter.getAccounts({ accessToken }, countryCode);

      if (!testAccountsResponse?.accounts?.length) {
        throw new BadRequestException('Failed to access bank account with new credentials');
      }

      // Step 5: Update the existing external account with new access token
      this.logger.debug('Step 5: Updating external account with new credentials...');
      const existingExternalAccount = await this.externalAccountService.findOne({
        user_id: user.id,
        linked_item_ref: itemId,
        linked_provider: PROVIDERS.PLAID,
      });

      await this.externalAccountService.update(
        { id: existingExternalAccount.id },
        {
          linked_access_token: accessToken,
          status: ExternalAccountStatus.APPROVED,
          updated_at: new Date(),
        },
      );

      // Step 6: Clean up Redis key
      await this.redisCacheService.del(redisKey);
      this.logger.debug(`Cleaned up Redis key: ${redisKey}`);

      this.logger.log(`ExternalAccount id=${existingExternalAccount.id} credentials updated successfully`);

      return {
        success: true,
        message: 'Bank account credentials updated successfully',
      };
    } catch (error) {
      this.logger.error('Error in handleCredentialUpdate:', error);
      throw error;
    }
  }

  /**
   * Extract public token exchange logic into reusable private method
   */
  private async exchangePublicTokenForAccessToken(
    publicToken: string,
    countryCode: string,
  ): Promise<{ accessToken: string; itemId: string }> {
    this.logger.debug(
      `About to call linkBankAccountAdapter.exchangeToken with public_token: ${publicToken?.substring(0, 10)}...`,
    );

    const { accessToken, itemId } = await this.linkBankAccountAdapter.exchangeToken({ publicToken }, countryCode);

    return { accessToken, itemId };
  }
}
