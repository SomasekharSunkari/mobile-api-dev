import { Injectable } from '@nestjs/common';
import { BaseRepository } from '../../../database/base/base.repository';
import { DoshPointsAccountModel } from '../../../database/models/doshPointsAccount/doshPointsAccount.model';

@Injectable()
export class DoshPointsAccountRepository extends BaseRepository<DoshPointsAccountModel> {
  constructor() {
    super(DoshPointsAccountModel);
  }
}
