import { Injectable } from '@nestjs/common';
import { BaseRepository } from '../../database/base/base.repository';
import { PlatformStatusLogModel } from '../../database/models/platformStatusLog/platformStatusLog.model';

@Injectable()
export class PlatformStatusLogRepository extends BaseRepository<PlatformStatusLogModel> {
  constructor() {
    super(PlatformStatusLogModel);
  }
}
