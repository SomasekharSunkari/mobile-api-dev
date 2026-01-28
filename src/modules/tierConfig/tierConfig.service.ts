import { Inject, Injectable, InternalServerErrorException, Logger, NotFoundException } from '@nestjs/common';

import { FetchQuery } from '../../database';
import {
  sumsubTierOneWorkFlow,
  SumSubVerificationType,
} from '../auth/kycVerification/dto/generateSumsubAccessToken.dto';
import { CreateTierConfigDto } from './dtos/createTierConfig.dto';
import { UpdateTierConfigDto } from './dtos/udpateTierConfig.dto';
import { TierConfigRepository } from './tierConfig.repository';

@Injectable()
export class TierConfigService {
  @Inject(TierConfigRepository)
  private readonly tierConfigRepository: TierConfigRepository;

  private readonly logger = new Logger(TierConfigService.name);

  async create(data: CreateTierConfigDto) {
    this.logger.log('create', 'TierConfigService');

    if (data.update_remittance_automatically) {
      await this.updateRemittanceAutomatically(data);
    }

    try {
      const tierConfig = await this.tierConfigRepository.create({ ...data });

      return tierConfig;
    } catch (error) {
      this.logger.error(error.message, 'TierConfigService.create');
      throw new InternalServerErrorException('Error while creating TierConfig');
    }
  }

  private async updateRemittanceAutomatically(data: CreateTierConfigDto) {
    const newData = { ...data };

    newData.remittance_minimum_per_deposit = data.minimum_deposit;
    newData.remittance_maximum_per_deposit = data.maximum_single_deposit;
    newData.remittance_maximum_daily_deposit = data.maximum_daily_deposit;
    newData.remittance_maximum_monthly_deposit = data.maximum_monthly_deposit;
    newData.remittance_minimum_transaction_amount = data.minimum_transaction_amount;
    newData.remittance_maximum_transaction_amount = data.maximum_transaction_amount;
    newData.remittance_maximum_daily_transaction = data.maximum_daily_transaction;
    newData.remittance_maximum_monthly_transaction = data.maximum_monthly_transaction;
    newData.total_spendable = data.total_spendable;
    newData.total_receivable = data.total_receivable;

    return newData;
  }

  async update(id: string, data: UpdateTierConfigDto) {
    this.logger.log('update', 'TierConfigService');

    const tierConfig = await this.tierConfigRepository.findById(id);
    if (!tierConfig) {
      throw new NotFoundException('TierConfig not found');
    }

    try {
      const dataToUpdate = {
        ...data,
      };

      const tierConfig = await this.tierConfigRepository.update(id, dataToUpdate as any);

      return tierConfig;
    } catch (error) {
      this.logger.error(error.message, 'TierConfigService.create');
      throw new InternalServerErrorException('Error while creating TierConfig');
    }
  }

  async findAll(query: FetchQuery & { countryId?: string }) {
    this.logger.log('findAll', 'TierConfigService');
    const countryId = query.countryId;
    delete query.countryId;

    const tierConfigs = await this.tierConfigRepository.findAll({ country_id: countryId }, query);

    return tierConfigs;
  }

  async findOne(id: string) {
    this.logger.log('findOne', 'TierConfigService');
    const tierConfig = await this.tierConfigRepository.findOne({ id });

    if (!tierConfig) {
      throw new NotFoundException('TierConfig not found');
    }

    return tierConfig;
  }

  mapSumsubVerificationTypeToTierLevel(verification_type: SumSubVerificationType): number {
    if (sumsubTierOneWorkFlow.includes(verification_type)) {
      return 1;
    }
    if (verification_type === SumSubVerificationType.TIER_TWO_VERIFICATION) {
      return 2;
    }
    if (verification_type === SumSubVerificationType.TIER_THREE_VERIFICATION) {
      return 3;
    }
    return 1;
  }

  isTierOneVerification(verification_type: SumSubVerificationType): boolean {
    return sumsubTierOneWorkFlow.includes(verification_type);
  }

  async delete(id: string) {
    this.logger.log('delete', 'TierConfigService');
    const tierConfig = await this.tierConfigRepository.findById(id);
    if (!tierConfig) {
      throw new NotFoundException('TierConfig not found');
    }

    await this.tierConfigRepository.delete(id);
    return tierConfig;
  }
}
