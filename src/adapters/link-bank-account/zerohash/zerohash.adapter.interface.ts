export interface ZeroHashLinkBankAccountResponse {
  request_id: string;
  external_account_id: string;
  participant_code: string;
  platform_code: string;
  account_nickname: string;
  created_at: string;
  status: string;
}

export interface ZeroHashLinkBankAccountRequest {
  participant_code: string; //providerRef
  account_nickname: string; //name
  plaid_processor_token: string; //processorToken
}

export interface ZeroHashCloseAccountRequest {
  participant_code: string;
}

export interface ZeroHashCloseAccountResponse {
  request_id: string;
  external_account_id: string;
  status: string;
}
