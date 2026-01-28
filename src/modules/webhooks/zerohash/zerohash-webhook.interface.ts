// Participant Status Changed Webhook
export interface ZeroHashParticipantStatusChangedPayload {
  participant_code: string;
  participant_status: string;
}

// External Account Status Changed Webhook
export interface ZeroHashExternalAccountStatusChangedPayload {
  external_account_id: string;
  external_account_status: string;
}

// Participant Updated Webhook (currently only logged, not processed)
export interface ZeroHashParticipantUpdatedPayload {
  participant_code?: string;
  [key: string]: unknown;
}

// Account Balance Changed Webhook - Movement Types
export enum ZeroHashMovementType {
  FINAL_SETTLEMENT = 'final_settlement',
  FINAL_SETTLEMENT_OUTSTANDING = 'final_settlement_outstanding',
  TRANSFER = 'transfer',
  WITHDRAWAL_CONFIRMED = 'withdrawal_confirmed',
  WITHDRAWAL_PENDING = 'withdrawal_pending',
  DEPOSIT = 'deposit',
}

export interface ZeroHashBalanceMovement {
  movement_timestamp: number;
  account_id: string;
  movement_id: string;
  movement_type: ZeroHashMovementType;
  change: string;
  trade_id?: string;
  transfer_request_id?: string;
  client_transfer_id?: string;
  withdrawal_request_id?: string;
  deposit_reference_id?: string;
}

export interface ZeroHashAccountBalanceChangedPayload {
  participant_code: string;
  account_group: string;
  account_label: string;
  account_type: 'available' | 'collateral';
  asset: string;
  balance: string;
  run_id: string;
  run_type: string;
  timestamp: number;
  client_transfer_id?: string;
  movements: ZeroHashBalanceMovement[];
}

// Counterparty participant structure for multi-party transactions
export interface ZeroHashCounterparty {
  participant_code: string;
}

// Payment Status Changed Webhook
export interface ZeroHashPaymentStatusChangedPayload {
  participant_code?: string;
  obo_participant?: ZeroHashCounterparty;
  transaction_id: string;
  payment_status: string;
  type?: string;
  reason_code?: string;
  reason_description?: string;
  ach_failure_reason?: string;
  rejected_reason?: string;
  trade_id?: string;
  trade_status?: string;
  failure_reason?: string;
  timestamp: number;
}

// Trade Status Changed Webhook
export interface ZeroHashTradeParty {
  participant_code: string;
  account_group: string;
  [key: string]: unknown;
}

export interface ZeroHashTradeStatusChangedPayload {
  client_trade_id: string;
  trade_state: string;
  trade_id?: string;
  symbol?: string;
  trade_price?: string;
  trade_quantity?: string;
  total_notional?: string;
  parties?: ZeroHashTradeParty[];
  timestamp?: number;
  transaction_timestamp?: number;
}

// Union type for all webhook payloads
export type ZeroHashWebhookPayload =
  | ZeroHashParticipantStatusChangedPayload
  | ZeroHashExternalAccountStatusChangedPayload
  | ZeroHashParticipantUpdatedPayload
  | ZeroHashAccountBalanceChangedPayload
  | ZeroHashPaymentStatusChangedPayload
  | ZeroHashTradeStatusChangedPayload;

// Event type constants
export enum ZeroHashWebhookEventType {
  PARTICIPANT_STATUS_CHANGED = 'participant_status_changed',
  EXTERNAL_ACCOUNT_STATUS_CHANGED = 'external_account_status_changed',
  PARTICIPANT_UPDATED = 'participant_updated',
  ACCOUNT_BALANCE_CHANGED = 'account_balance.changed',
  PAYMENT_STATUS_CHANGED = 'payment_status_changed',
  TRADE_STATUS_CHANGED = 'trade.status_changed',
}

// Trade state constants
export enum ZeroHashTradeState {
  ACTIVE = 'active',
  PENDING = 'pending',
  ACCEPTED = 'accepted',
  TERMINATED = 'terminated',
  REJECTED = 'rejected',
  CANCELLED = 'cancelled',
  EXPIRED = 'expired',
  SETTLED = 'settled',
}

// Provider metadata structures
export interface ZeroHashProviderMetadata {
  zerohash_payment_status?: string;
  zerohash_trade_state?: string;
  reason_code?: string;
  reason_description?: string;
  ach_failure_reason?: string;
  rejected_reason?: string;
  trade_id?: string;
  symbol?: string;
  trade_price?: string;
  trade_quantity?: string;
  total_notional?: string;
  parties?: ZeroHashTradeParty[];
  timestamp?: number;
  transaction_timestamp?: number;
  settlement_trade_id?: string;
  settlement_balance?: string;
  settlement_asset?: string;
  settlement_timestamp?: number;
  movement_id?: string;
  withdrawal_status?: string;
  withdrawal_confirmed_at?: number;
  withdrawal_pending_at?: number;
}

// Metadata with webhook history
export interface WebhookPayloadHistory {
  timestamp: string;
  event_type: ZeroHashWebhookEventType;
  payload: ZeroHashWebhookPayload;
}

export interface MetadataWithWebhookHistory extends Record<string, unknown> {
  webhook_payloads?: WebhookPayloadHistory[];
}
