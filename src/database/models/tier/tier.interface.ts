import { IBase } from '../../base';
import { ITierConfig } from '../tierConfig/tierConfig.interface';

export enum TierStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
}

export interface ITier extends IBase {
  name: string;
  level: number;
  description: string;
  status: TierStatus;

  // relations
  tierConfigs: ITierConfig[];
}
