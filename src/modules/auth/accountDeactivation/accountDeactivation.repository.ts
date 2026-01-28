import { Injectable } from '@nestjs/common';
import { BaseRepository } from '../../../database/base';
import { AccountDeactivationLogModel } from '../../../database/models/accountDeactivationLog/accountDeactivationLog.model';

@Injectable()
export class AccountDeactivationRepository extends BaseRepository<AccountDeactivationLogModel> {
  constructor() {
    super(AccountDeactivationLogModel);
  }
}
