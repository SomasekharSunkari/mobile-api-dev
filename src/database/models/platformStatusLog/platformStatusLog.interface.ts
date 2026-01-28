import { IBase } from '../../base';
import { PlatformStatusEnum } from '../platformStatus/platformStatus.interface';

export enum PlatformStatusTriggeredBy {
  SYSTEM = 'system',
  ADMIN = 'admin',
}

export interface IPlatformStatusLog extends Omit<IBase, 'deleted_at'> {
  platform_status_id: string;
  previous_status?: PlatformStatusEnum;
  new_status: PlatformStatusEnum;
  reason?: string;
  triggered_by: PlatformStatusTriggeredBy;
  admin_user_id?: string;
}
