import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ProviderLimitModel } from '../../database/models/providerLimit/providerLimit.model';
import { ProviderLimitRepository } from './providerLimit.repository';

@Injectable()
export class ProviderLimitService {
  private readonly logger = new Logger(ProviderLimitService.name);

  @Inject(ProviderLimitRepository)
  private readonly providerLimitRepository: ProviderLimitRepository;

  async getProviderLimitValue(provider: string, limitType: string, currency: string): Promise<number> {
    this.logger.log(`Fetching provider limit: provider=${provider}, type=${limitType}, currency=${currency}`);

    const limit = (await this.providerLimitRepository
      .query()
      .where('provider', provider)
      .where('limit_type', limitType)
      .where('currency', currency)
      .where('is_active', true)
      .modify('notDeleted')
      .first()) as ProviderLimitModel;

    if (!limit) {
      throw new NotFoundException(
        `Provider limit not found for provider=${provider}, type=${limitType}, currency=${currency}`,
      );
    }

    return limit.limit_value;
  }

  async getAllProviderLimits(provider?: string): Promise<ProviderLimitModel[]> {
    const logMessage = provider
      ? `Fetching all provider limits for provider=${provider}`
      : 'Fetching all provider limits';
    this.logger.log(logMessage);

    const query = this.providerLimitRepository.query().where('is_active', true).modify('notDeleted');

    if (provider) {
      query.where('provider', provider);
    }

    return (await query) as ProviderLimitModel[];
  }
}
