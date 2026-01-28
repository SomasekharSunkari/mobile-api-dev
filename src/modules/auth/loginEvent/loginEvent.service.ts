import { Inject, Injectable, Logger } from '@nestjs/common';
import { LoginEventModel } from '../../../database/models/loginEvent/loginEvent.model';
import { LastKnownLocation } from './loginEvent.interface';
import { LoginEventRepository } from './loginEvent.repository';

@Injectable()
export class LoginEventService {
  private readonly logger = new Logger(LoginEventService.name);

  @Inject(LoginEventRepository)
  private readonly loginEventRepository: LoginEventRepository;

  /**
   * Get user's last known location from login events
   */
  async getLastKnownLocation(userId: string): Promise<LastKnownLocation | null> {
    try {
      const lastLoginEvent = (await this.loginEventRepository
        .query()
        .where({ user_id: userId })
        .whereNotNull('country')
        .orderBy('login_time', 'desc')
        .first()) as LoginEventModel;

      if (!lastLoginEvent || (!lastLoginEvent.country && !lastLoginEvent.region && !lastLoginEvent.city)) {
        return null;
      }

      return {
        country: lastLoginEvent.country,
        region: lastLoginEvent.region,
        city: lastLoginEvent.city,
      };
    } catch (error) {
      this.logger.error(`Failed to get last known location for user ${userId}: ${error.message}`);
      return null;
    }
  }

  /**
   * Create a new login event
   */
  async createLoginEvent(loginEventData: Partial<LoginEventModel>): Promise<LoginEventModel> {
    try {
      return await this.loginEventRepository.create(loginEventData);
    } catch (error) {
      this.logger.error(`Failed to create login event for user ${loginEventData.user_id}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get the latest login event for a user
   */
  async getLastLoginEvent(userId: string): Promise<LoginEventModel | null> {
    try {
      return (await this.loginEventRepository
        .query()
        .where({ user_id: userId })
        .orderBy('login_time', 'desc')
        .first()) as LoginEventModel;
    } catch (error) {
      this.logger.error(`Failed to get latest login event for user ${userId}: ${error.message}`);
      return null;
    }
  }
}
