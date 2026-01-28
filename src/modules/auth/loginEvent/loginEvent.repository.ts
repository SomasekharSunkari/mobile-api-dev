import { Injectable } from '@nestjs/common';

import { BaseRepository } from '../../../database/base/base.repository';
import { LoginEventModel } from '../../../database/models/loginEvent/loginEvent.model';

@Injectable()
export class LoginEventRepository extends BaseRepository<LoginEventModel> {
  constructor() {
    super(LoginEventModel);
  }
}
