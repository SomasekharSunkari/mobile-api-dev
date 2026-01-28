import { Injectable } from '@nestjs/common';

import { BaseRepository } from '../../../database/base/base.repository';
import { LoginDeviceModel } from '../../../database';

@Injectable()
export class LoginDeviceRepository extends BaseRepository<LoginDeviceModel> {
  constructor() {
    super(LoginDeviceModel);
  }

  /**
   * Find a device by user ID and device info, excluding soft-deleted records.
   */
  public async findActiveDevice(
    user_id: string,
    device_name: string,
    device_type: string,
    os: string,
    browser: string,
  ): Promise<LoginDeviceModel | undefined> {
    return (await this.query()
      .modify('notDeleted')
      .findOne({ user_id, device_name, device_type, os, browser })) as LoginDeviceModel;
  }
}
