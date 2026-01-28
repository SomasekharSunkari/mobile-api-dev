export interface ZeroHashFundingQuoteRequest {
  participant_code: string;
  quoted_currency: string;
  underlying_currency: string;
  side: 'buy' | 'sell';
  total: string;
  quote_expiry?: string;
}

export interface ZeroHashFundingQuoteResponse {
  request_id: string;
  participant_code: string;
  quoted_currency: string;
  underlying_currency: string;
  side: string;
  quantity: string;
  price: string;
  quote_id: string;
  expire_ts: number;
  account_group: string;
  account_label: string;
  quote_notional: string;
  disclosed_spread?: string;
  disclosed_spread_rate?: string;
}

export interface ZeroHashFundingQuoteWrappedResponse {
  message: ZeroHashFundingQuoteResponse;
}

export interface ZeroHashExecutePaymentRequest {
  participant_code: string;
  quote_id: string;
  ach_signed_agreement: number;
  external_account_id: string;
  description?: string;
}

export interface ZeroHashExecutePaymentResponse {
  request_id: string;
  transaction_id: string;
  status: string;
  warning?: string;
}

export interface ZeroHashExecutePaymentWrappedResponse {
  message: ZeroHashExecutePaymentResponse;
}
