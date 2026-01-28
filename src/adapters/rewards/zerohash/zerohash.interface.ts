// ZeroHash-specific request payload
export interface ZeroHashCreateRewardRequest {
  underlying: string;
  quoted_currency: string;
  quantity: string;
  participant_code: string;
}

// ZeroHash-specific quote in response
export interface ZeroHashCreateRewardQuote {
  request_id: string;
  participant_code: string;
  quoted_currency: string;
  side: string;
  quantity: string;
  price: string;
  quote_id: string;
  expire_ts: number;
  account_group: string;
  account_label: string;
  obo_participant_code: string;
  obo_account_group: string;
  obo_account_label: string;
  underlying: string;
  transaction_timestamp: number;
}

// ZeroHash-specific response payload
export interface ZeroHashCreateRewardResponse {
  request_id: string;
  quote: ZeroHashCreateRewardQuote;
  trade_id: string;
  status: string;
  trade_ids_list: string[];
  asset_cost_notional: string;
}

// Wrapped response from API
export interface ZeroHashCreateRewardWrappedResponse {
  message: ZeroHashCreateRewardResponse;
}
