import { Injectable } from '@nestjs/common';
import { BaseRepository } from '../../../database/base/base.repository';
import { RoleModel } from '../../../database/models/role/role.model';

@Injectable()
export class RoleRepository extends BaseRepository<RoleModel> {
  constructor() {
    super(RoleModel);
  }
}
