import { Injectable } from '@nestjs/common';
import { BaseRepository } from '../../database/base/base.repository';
import { SystemConfigModel } from '../../database/models/systemConfig/systemConfig.model';

@Injectable()
export class SystemConfigRepository extends BaseRepository<SystemConfigModel> {
  constructor() {
    super(SystemConfigModel);
  }
}
