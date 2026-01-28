import { Inject, Injectable } from '@nestjs/common';
import { TierModel } from '../../database/models/tier/tier.model';
import { TierRepository } from './tier.repository';

@Injectable()
export class TierService {
  @Inject(TierRepository)
  private readonly tierRepository: TierRepository;

  /**
   * Retrieves all tiers in the system
   */
  async getAllTiers(): Promise<TierModel[]> {
    return this.tierRepository
      .query()
      .withGraphFetched('[tierConfigs.[country]]')
      .orderBy('level', 'asc') as unknown as TierModel[];
  }
}
