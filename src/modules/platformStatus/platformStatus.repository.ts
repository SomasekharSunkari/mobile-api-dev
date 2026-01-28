import { Injectable } from '@nestjs/common';
import { BaseRepository } from '../../database/base/base.repository';
import { PlatformStatusModel } from '../../database/models/platformStatus/platformStatus.model';

@Injectable()
export class PlatformStatusRepository extends BaseRepository<PlatformStatusModel> {
  constructor() {
    super(PlatformStatusModel);
  }
}
