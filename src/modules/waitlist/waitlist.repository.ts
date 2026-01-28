import { Injectable } from '@nestjs/common';
import { BaseRepository } from '../../database/base';
import { WaitlistModel } from '../../database/models/waitlist';
import { IWaitlistFeature, IWaitlistReason } from '../../database/models/waitlist/waitlist.interface';

@Injectable()
export class WaitlistRepository extends BaseRepository<WaitlistModel> {
  constructor() {
    super(WaitlistModel);
  }

  async findByUser(
    userId: string,
    filters?: { reason?: IWaitlistReason; feature?: IWaitlistFeature },
  ): Promise<WaitlistModel[]> {
    const query = this.query().where({ user_id: userId }).skipUndefined();

    if (filters?.reason) {
      query.where('reason', filters.reason);
    }

    if (filters?.feature) {
      query.where('feature', filters.feature);
    }

    const results = (await query) as WaitlistModel[];

    return results;
  }
}
