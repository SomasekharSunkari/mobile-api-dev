import { Injectable } from '@nestjs/common';
import { BaseRepository } from '../../../database/base';
import { KycStatusLogModel } from '../../../database/models/kycStatusLog/kycStatusLog.model';

@Injectable()
export class KycStatusLogRepository extends BaseRepository<KycStatusLogModel> {
  constructor() {
    super(KycStatusLogModel);
  }
}
