import { PlatformServiceKey } from '../../database/models/platformStatus/platformStatus.interface';

export enum EventEmitterEventsEnum {
  REQUIRE_PASSWORD_RESET = 'require_password_reset',
  REQUIRE_TRANSACTION_PIN_RESET = 'require_transaction_pin_reset',
  FORGOT_PASSWORD = 'forgot_password',
  WALLET_BALANCE_CHANGED = 'wallet_balance_changed',
  IN_APP_NOTIFICATION_CREATED = 'in_app_notification_created',
  CIRCUIT_BREAKER_OPENED = 'circuit_breaker_opened',
  CIRCUIT_BREAKER_CLOSED = 'circuit_breaker_closed',
  SERVICE_STATUS_SUCCESS = 'service_status_success',
  SERVICE_STATUS_FAILURE = 'service_status_failure',
}

/**
 * Payload for service status events
 */
export interface ServiceStatusEventPayload {
  serviceKey: PlatformServiceKey;
  reason?: string;
}
