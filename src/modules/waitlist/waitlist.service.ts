import { Inject, Injectable, Logger } from '@nestjs/common';
import { WaitlistModel } from '../../database/models/waitlist';
import {
  IWaitlist,
  IWaitlistFeature,
  IWaitlistReason,
  WaitlistFeature,
  WaitlistReason,
} from '../../database/models/waitlist/waitlist.interface';
import { WaitlistRepository } from './waitlist.repository';

@Injectable()
export class WaitlistService {
  private readonly logger = new Logger(WaitlistService.name);

  constructor(@Inject(WaitlistRepository) private readonly waitlistRepository: WaitlistRepository) {}

  async joinWaitlist(
    userId: string,
    userEmail: string,
    reason: IWaitlistReason,
    feature: IWaitlistFeature,
  ): Promise<WaitlistModel> {
    this.logger.log(`User ${userId} attempting to join waitlist for reason: ${reason}, feature: ${feature}`);

    const existingWaitlist = await this.waitlistRepository.findOne({
      user_id: userId,
      feature,
      reason,
    });

    if (existingWaitlist) {
      this.logger.log(`User ${userId} already on waitlist for reason: ${reason}, feature: ${feature}`);
      return existingWaitlist;
    }

    const waitlistData: Partial<IWaitlist> = {
      user_id: userId,
      user_email: userEmail,
      reason,
      feature,
    };

    const waitlist = await this.waitlistRepository.create(waitlistData);
    this.logger.log(`User ${userId} successfully joined waitlist for reason: ${reason}, feature: ${feature}`);

    return waitlist;
  }

  async getUserWaitlists(
    userId: string,
    filters?: { reason?: IWaitlistReason; feature?: IWaitlistFeature },
  ): Promise<WaitlistModel[]> {
    this.logger.log(
      `Fetching waitlists for user ${userId} with filters reason: ${filters?.reason}, feature: ${filters?.feature}`,
    );

    return this.waitlistRepository.findByUser(userId, filters);
  }

  async getWaitlistOptions(): Promise<{ reasons: IWaitlistReason[]; features: IWaitlistFeature[] }> {
    this.logger.log('Fetching supported waitlist reasons and features');

    const reasons = Object.values(WaitlistReason);
    const features = Object.values(WaitlistFeature);

    return { reasons, features };
  }
}
