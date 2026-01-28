export interface ZeroHashTransferRequest {
  from_participant_code: string;
  from_account_group: string;
  to_participant_code: string;
  to_account_group: string;
  asset: string;
  amount: string;
  client_transfer_id: string;
}

export interface ZeroHashTransferResponse {
  id: number;
  client_transfer_id: string;
  status: string;
  amount: string;
  asset: string;
  created_at: string;
  from_participant_code: string;
  from_account_group: string;
  to_participant_code: string;
  to_account_group: string;
}

export interface ZeroHashTransferWrappedResponse {
  message: ZeroHashTransferResponse;
}

export interface ZeroHashTransferDetailsResponse {
  id: number;
  client_transfer_id: string;
  transfer_type: string | null;
  created_at: string;
  updated_at: string;
  status: string;
  from_account_label: string | null;
  to_account_label: string | null;
  from_participant_code: string;
  to_participant_code: string;
  amount: string;
  movement_id: string;
  admin_transfer: boolean;
  parent_link_id: string | null;
  parent_link_id_source: string | null;
  from_account_group: string;
  to_account_group: string;
  asset: string;
}

export interface ZeroHashTransferDetailsWrappedResponse {
  message: ZeroHashTransferDetailsResponse;
}

export interface ZeroHashWithdrawalRequest {
  client_withdrawal_request_id: string;
  address: string;
  participant_code: string;
  amount: string;
  asset: string;
  account_group: string;
}

export interface ZeroHashWithdrawalResponse {
  id: string;
  withdrawal_account_id: number;
  participant_code: string;
  beneficiary_participant_code: string | null;
  sender_participant_code: string | null;
  account_group: string;
  account_label: string | null;
  requestor_participant_code: string;
  asset: string;
  requested_amount: string;
  settled_amount: string | null;
  gas_price: string | null;
  status: string;
  on_chain_status: string | null;
  client_withdrawal_request_id: string;
  requested_timestamp: number;
  transaction_id: string | null;
  input_data: string | null;
  fee_amount: string | null;
  quoted_fee_amount: string | null;
  quoted_fee_notional: string | null;
  trade_id: string | null;
  quoted_fee_asset: string | null;
  withdrawal_fee: string;
  parent_link_id: string | null;
  parent_link_id_source: string | null;
  amount_in_usd: number;
  contract_validation_id: string | null;
}

export interface ZeroHashWithdrawalWrappedResponse {
  message: ZeroHashWithdrawalResponse;
}

export interface ZeroHashWithdrawalDetailsResponse {
  id: string;
  withdrawal_account_id: number;
  participant_code: string;
  beneficiary_participant_code: string | null;
  sender_participant_code: string | null;
  account_group: string;
  account_label: string | null;
  requestor_participant_code: string;
  asset: string;
  requested_amount: string;
  settled_amount: string;
  gas_price: string | null;
  status: string;
  on_chain_status: string;
  client_withdrawal_request_id: string;
  requested_timestamp: number;
  transaction_id: string;
  input_data: string | null;
  fee_amount: string;
  quoted_fee_amount: string | null;
  quoted_fee_notional: string | null;
  trade_id: string | null;
  quoted_fee_asset: string | null;
  withdrawal_fee: string;
  parent_link_id: string | null;
  parent_link_id_source: string | null;
  contract_validation_id: string | null;
}

export interface ZeroHashWithdrawalDetailsWrappedResponse {
  message: ZeroHashWithdrawalDetailsResponse[];
}

export interface ZeroHashWithdrawalQuoteRequest {
  participant_code: string;
  asset: string;
  withdrawal_address: string;
  amount: string;
}

export interface ZeroHashWithdrawalQuoteResponse {
  withdrawal_quote_id: string;
  withdrawal_account_id: string;
  withdrawal_address: string;
  destination_tag: string;
  no_destination_tag: boolean;
  amount: string;
  amount_notional: string;
  max_amount: boolean;
  network_fee: string;
  network_fee_notional: string;
  net_withdrawal_quantity: string;
  net_withdrawal_notional: string;
  asset: string;
  participant_code: string;
  account_group: string;
  account_label: string;
  withdrawal_fee: string;
}

export interface ZeroHashWithdrawalQuoteWrappedResponse {
  message: ZeroHashWithdrawalQuoteResponse;
}

export interface ZeroHashWithdrawalExecuteRequest {
  withdrawal_quote_id: string;
  client_withdrawal_request_id: string;
}

export interface ZeroHashWithdrawalExecuteResponse {
  request_id: string;
  withdrawal_quote_id: string;
  withdrawal_request_id: string;
  participant_code: string;
  account_group: string;
  account_label: string;
  withdrawal_address: string;
  destination_tag: string;
  no_destination_tag: boolean;
  asset: string;
  amount: string;
  amount_notional: string;
  network_fee: string;
  network_fee_notional: string;
  on_chain_status: string;
  withdrawal_fee: string;
  client_withdrawal_request_id: string;
}

export interface ZeroHashWithdrawalExecuteWrappedResponse {
  message: ZeroHashWithdrawalExecuteResponse;
}

export interface ZerohashWithdrawalMovement {
  movement_timestamp: number;
  account_id: string;
  movement_id: string;
  movement_type: string;
  withdrawal_request_id: string;
  change: string;
}

export interface ZerohashWithdrawalConfirmedWebhookPayload {
  participant_code: string;
  account_group: string;
  account_label: string;
  account_type: string;
  asset: string;
  balance: string;
  run_id: string;
  run_type: string;
  timestamp: number;
  movements: ZerohashWithdrawalMovement[];
}

export interface ZeroHashWithdrawalRequestPayload {
  client_withdrawal_request_id: string;
  address: string;
  participant_code: string;
  account_group: string;
  amount: string;
  asset: string;
}

export interface ZeroHashWithdrawalRequestWrappedResponse {
  id: string;
  withdrawal_account_id: number;
  participant_code: string;
  requestor_participant_code: string;
  requested_amount: string;
  settled_amount: string;
  status: string;
  asset: string;
  account_group: string;
  account_label: string;
  transaction_id: string | null;
  requested_timestamp: number;
  gas_price: string | null;
  client_withdrawal_request_id: string | null;
  on_chain_status: string;
  fee_amount: string;
  withdrawal_fee: string;
  quoted_fee_amount: string;
  quoted_fee_notional: string;
}

export interface ZeroHashAccountDetailsRequest {
  account_owner: string;
  asset: string;
}

export interface ZeroHashAccountDetails {
  asset: string;
  account_owner: string;
  account_type: string;
  account_group: string;
  account_label: string;
  balance: string;
  account_id: string;
  last_update: number;
}

export interface ZeroHashAccountDetailsWrappedResponse {
  message: ZeroHashAccountDetails[];
  page: number;
  total_pages: number;
}
