import { Injectable } from '@nestjs/common';
import { BaseRepository } from '../../../database/base';
import { BankBeneficiaryModel } from '../../../database/models';

@Injectable()
export class BankBeneficiaryRepository extends BaseRepository<BankBeneficiaryModel> {
  constructor() {
    super(BankBeneficiaryModel);
  }
}
