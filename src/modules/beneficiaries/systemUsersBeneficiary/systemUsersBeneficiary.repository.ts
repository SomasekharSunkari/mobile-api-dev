import { Injectable } from '@nestjs/common';
import { BaseRepository } from '../../../database/base';
import { SystemUsersBeneficiaryModel } from '../../../database/models';

@Injectable()
export class SystemUsersBeneficiaryRepository extends BaseRepository<SystemUsersBeneficiaryModel> {
  constructor() {
    super(SystemUsersBeneficiaryModel);
  }
}
