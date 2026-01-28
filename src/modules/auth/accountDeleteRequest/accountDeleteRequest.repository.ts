import { Injectable } from '@nestjs/common';
import { BaseRepository } from '../../../database/base';
import { AccountDeleteRequestModel } from '../../../database/models/accountDeleteRequest/accountDeleteRequest.model';

@Injectable()
export class AccountDeleteRequestRepository extends BaseRepository<AccountDeleteRequestModel> {
  constructor() {
    super(AccountDeleteRequestModel);
  }
}
