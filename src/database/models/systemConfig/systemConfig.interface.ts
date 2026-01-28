import { IBase } from '../../base';

export interface ISystemConfig extends IBase {
  key: string;
  type: string;
  is_enabled: boolean;
  description?: string;
  value?: string;
}
