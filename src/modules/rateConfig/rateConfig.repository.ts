import { Injectable } from '@nestjs/common';
import { Transaction } from 'objection';
import { BaseRepository } from '../../database/base/base.repository';
import { RateConfigModel } from '../../database/models/rateConfig/rateConfig.model';

@Injectable()
export class RateConfigRepository extends BaseRepository<RateConfigModel> {
  constructor() {
    super(RateConfigModel);
  }

  /**
   * Find a rate config by provider name
   */
  async findByProvider(provider: string, trx?: Transaction): Promise<RateConfigModel | undefined> {
    return this.findOne({ provider }, undefined, { trx });
  }
}
