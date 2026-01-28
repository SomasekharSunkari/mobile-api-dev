import { Injectable } from '@nestjs/common';
import { BaseRepository } from '../../database/base/base.repository';
import { DepositAddressModel } from '../../database/models/depositAddress/depositAddress.model';

@Injectable()
export class DepositAddressRepository extends BaseRepository<DepositAddressModel> {
  constructor() {
    super(DepositAddressModel);
  }

  /**
   * Find all deposit addresses for a user, ordered by creation date (newest first).
   */
  public async findByUserId(user_id: string): Promise<DepositAddressModel[]> {
    return (await this.query().where({ user_id }).orderBy('created_at', 'desc')) as DepositAddressModel[];
  }

  /**
   * Find deposit address for a specific user and asset combination.
   */
  public async findByUserIdAndAsset(user_id: string, asset: string): Promise<DepositAddressModel | undefined> {
    return (await this.query().where({ user_id, asset }).first()) as DepositAddressModel;
  }

  /**
   * Find the most recent Rain deposit address for a user.
   */
  public async findLatestRainDepositAddressByUserId(user_id: string): Promise<DepositAddressModel | undefined> {
    return (await this.query()
      .where({ user_id, provider: 'rain' })
      .orderBy('created_at', 'desc')
      .first()) as DepositAddressModel;
  }
}
