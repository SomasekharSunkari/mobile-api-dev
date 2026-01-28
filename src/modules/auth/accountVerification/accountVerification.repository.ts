import { Injectable } from '@nestjs/common';
import { BaseRepository } from '../../../database/base';
import { AccountVerificationModel } from '../../../database/models/accountVerification/accountVerification.model';

@Injectable()
export class AccountVerificationRepository extends BaseRepository<AccountVerificationModel> {
  constructor() {
    super(AccountVerificationModel);
  }
}
