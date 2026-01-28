import { Injectable } from '@nestjs/common';
import { BaseRepository } from '../../database/base/base.repository';
import { InAppNotificationModel } from '../../database/models/InAppNotification/InAppNotification.model';

@Injectable()
export class InAppNotificationRepository extends BaseRepository<InAppNotificationModel> {
  constructor() {
    super(InAppNotificationModel);
  }

  async findAllByUserId(userId: string): Promise<InAppNotificationModel[]> {
    return (await this.query().where('user_id', userId)) as InAppNotificationModel[];
  }

  async countUnreadByUserId(userId: string): Promise<number> {
    const result = await this.query().where({ user_id: userId, is_read: false }).count().first();

    const countValue = (result as unknown as Record<string, any>)[Object.keys(result as any)[0]];
    return typeof countValue === 'string' ? Number.parseInt(countValue, 10) : Number(countValue || 0);
  }

  async markNotificationsAsRead(userId: string, notificationIds: string[]): Promise<void> {
    if (!notificationIds || notificationIds.length === 0) {
      return;
    }

    await this.model
      .query()
      .where({ user_id: userId, is_read: false })
      .whereIn('id', notificationIds)
      .patch({ is_read: true } as any);
  }
}
