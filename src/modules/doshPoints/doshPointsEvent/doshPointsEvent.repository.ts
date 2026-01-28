import { Injectable } from '@nestjs/common';
import { BaseRepository } from '../../../database/base/base.repository';
import { DoshPointsEventModel } from '../../../database/models/doshPointsEvent/doshPointsEvent.model';

@Injectable()
export class DoshPointsEventRepository extends BaseRepository<DoshPointsEventModel> {
  constructor() {
    super(DoshPointsEventModel);
  }
}
