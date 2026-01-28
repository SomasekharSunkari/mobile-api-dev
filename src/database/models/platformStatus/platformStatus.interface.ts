import { IBase } from '../../base';
import { PlatformStatusLogModel } from '../platformStatusLog/platformStatusLog.model';

export enum PlatformStatusEnum {
  OPERATIONAL = 'operational',
  DEGRADED = 'degraded',
  DOWN = 'down',
}

export enum PlatformServiceKey {
  AUTHENTICATION = 'authentication',
  EMAIL_SERVICE = 'email_service',
  REDIS = 'redis',
  PUSH_NOTIFICATION = 'push_notification',
  KYC_SERVICE = 'kyc_service',
  DATABASE = 'database',
  NGN_TRANSFER = 'ngn_transfer',
  USD_TRANSFER = 'usd_transfer',
  CURRENCY_EXCHANGE = 'currency_exchange',
  RATE_GENERATION = 'rate_generation',
  USD_WITHDRAWAL = 'usd_withdrawal',
  NGN_TRANSFER_OUT = 'ngn_transfer_out',
  CARD_SERVICE = 'card_service',
}

export interface IPlatformStatus extends IBase {
  service_key: string;
  service_name: string;
  status: PlatformStatusEnum;
  last_checked_at?: Date;
  last_failure_at?: Date;
  failure_reason?: string;
  is_manually_set: boolean;
  custom_message?: string;

  statusLogs?: PlatformStatusLogModel[];
}
