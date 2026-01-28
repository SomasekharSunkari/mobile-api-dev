import { Injectable } from '@nestjs/common';
import { BaseRepository } from '../../../database/base';
import { BlockchainBeneficiaryModel } from '../../../database/models';

@Injectable()
export class BlockchainBeneficiaryRepository extends BaseRepository<BlockchainBeneficiaryModel> {
  constructor() {
    super(BlockchainBeneficiaryModel);
  }
}
