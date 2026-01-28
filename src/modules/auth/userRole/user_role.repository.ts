import { Injectable } from '@nestjs/common';
import { UserRoleModel } from '../../../database/models/userRole/userRole.model';
import { BaseRepository } from '../../../database/base/base.repository';

@Injectable()
export class UserRoleRepository extends BaseRepository<UserRoleModel> {
  constructor() {
    super(UserRoleModel);
  }
}
