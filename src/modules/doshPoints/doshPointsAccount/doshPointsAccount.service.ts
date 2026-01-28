import { Inject, Injectable, Logger } from '@nestjs/common';
import { Transaction } from 'objection';
import { DoshPointsAccountModel } from '../../../database/models/doshPointsAccount/doshPointsAccount.model';
import { DoshPointsAccountStatus } from '../../../database/models/doshPointsAccount/doshPointsAccount.interface';
import { DoshPointsAccountRepository } from './doshPointsAccount.repository';

@Injectable()
export class DoshPointsAccountService {
  private readonly logger = new Logger(DoshPointsAccountService.name);

  @Inject(DoshPointsAccountRepository)
  private readonly accountRepository: DoshPointsAccountRepository;

  /**
   * Find existing Dosh Points account for user or create a new one
   * @param user_id - The user's ID
   * @returns The user's Dosh Points account
   */
  public async findOrCreate(user_id: string): Promise<DoshPointsAccountModel> {
    this.logger.log(`Finding or creating Dosh Points account for user: ${user_id}`);

    const existingAccount = await this.accountRepository.findOne({ user_id });

    if (existingAccount) {
      this.logger.log(`Found existing Dosh Points account: ${existingAccount.id}`);
      return existingAccount;
    }

    const newAccount = await this.accountRepository.create({
      user_id,
      balance: 0,
      status: DoshPointsAccountStatus.ACTIVE,
    });

    this.logger.log(`Created new Dosh Points account: ${newAccount.id}`);
    return newAccount;
  }

  /**
   * Update account balance within a transaction
   * @param account_id - The account ID
   * @param new_balance - The new balance to set
   * @param trx - Database transaction
   * @returns The updated account
   */
  public async updateBalance(
    account_id: string,
    new_balance: number,
    trx: Transaction,
  ): Promise<DoshPointsAccountModel> {
    return this.accountRepository.update(account_id, { balance: new_balance }, { trx });
  }

  /**
   * Update the usd_fiat_rewards_enabled flag for a user's Dosh Points account
   * @param user_id - The user's ID
   * @param enabled - Whether USD fiat rewards should be enabled
   * @returns The updated account
   */
  public async updateUsdFiatRewardsEnabled(user_id: string, enabled: boolean): Promise<DoshPointsAccountModel> {
    this.logger.log(`Updating usd_fiat_rewards_enabled to ${enabled} for user: ${user_id}`);

    const account = await this.findOrCreate(user_id);
    const updatedAccount = await this.accountRepository.update(account.id, { usd_fiat_rewards_enabled: enabled });

    this.logger.log(`Updated usd_fiat_rewards_enabled to ${enabled} for account: ${account.id}`);
    return updatedAccount;
  }
}
