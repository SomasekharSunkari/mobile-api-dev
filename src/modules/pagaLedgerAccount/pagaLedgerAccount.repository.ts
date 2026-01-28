import { Injectable } from '@nestjs/common';
import { BaseRepository } from '../../database/base/base.repository';
import { PagaLedgerAccountModel } from '../../database/models/pagaLedgerAccount/pagaLedgerAccount.model';

@Injectable()
export class PagaLedgerAccountRepository extends BaseRepository<PagaLedgerAccountModel> {
  constructor() {
    super(PagaLedgerAccountModel);
  }

  /**
   * Get the sum of all user NGN balances across all paga ledger accounts
   * Returns the total in kobo (smallest unit)
   */
  async getTotalUserBalances(): Promise<number> {
    const result = (await this.model.query().sum('available_balance as total').first()) as unknown as {
      total: string | null;
    };

    return Number(result?.total) || 0;
  }

  /**
   * Get the count of all paga ledger accounts
   */
  async getTotalAccountsCount(): Promise<number> {
    const result = (await this.model.query().count('id as count').first()) as unknown as { count: string | null };

    return Number(result?.count) || 0;
  }
}
