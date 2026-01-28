import { Injectable } from '@nestjs/common';
import { BaseRepository } from '../../../database/base';
import { AccountActionCodeModel } from '../../../database/models/accountActionCode/accountActionCode.model';

@Injectable()
export class AccountActionCodeRepository extends BaseRepository<AccountActionCodeModel> {
  constructor() {
    super(AccountActionCodeModel);
  }
}
