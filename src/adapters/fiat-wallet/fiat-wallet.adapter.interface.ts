// Transfer request payload
export interface FiatWalletTransferRequest {
  senderCode: string;
  receiverCode: string;
  asset: string;
  amount: string;
  transferId: string;
}

// Transfer response payload - simplified and generic
export interface FiatWalletTransferResponse {
  providerRequestRef: string;
  providerReference: string;
  status: string;
  amount: string;
  currency: string;
  createdAt: string;
}

// Transfer details response payload
export interface FiatWalletTransferDetailsResponse {
  providerRequestRef: string;
  providerReference: string;
  status: string;
  amount: string;
  currency: string;
  fromUserRef: string;
  toUserRef: string;
  createdAt: string;
  updatedAt: string;
}

// Withdrawal request payload
// Withdrawal response payload
export interface FiatWalletWithdrawalResponse {
  providerRequestRef: string;
  providerReference: string;
  status: string;
  amount: string;
  currency: string;
  externalReference?: string;
}

// Withdrawal quote request payload
export interface FiatWalletWithdrawalQuoteRequest {
  userRef: string;
  asset: string;
  amount: string;
  withdrawalAddress: string;
}

// Withdrawal quote response payload
export interface FiatWalletWithdrawalQuoteResponse {
  providerQuoteRef: string;
  providerFee: string;
  netWithdrawalQuantity: string;
  amount: string;
  currency: string;
}

// Withdrawal execute request payload
export interface FiatWalletWithdrawalExecuteRequest {
  providerQuoteRef: string;
  providerReference: string;
}

export interface FiatWalletWithdrawalRequestPayload {
  transactionRef: string;
  withdrawalAddress: string;
  providerUserRef: string;
  amount: string;
  asset: string;
}

export interface FiatWalletWithdrawalRequestWrappedResponse {
  providerRef: string;
  withdrawalAccountRef: string;
  providerUserRef: string;
  requestorUserRef: string;
  requestedAmount: string;
  settledAmount: string;
  status: string;
  asset: string;
  blockchainTransactionRef: string | null;
  blockchainStatus: string;
  gasPrice: string | null;
  feeAmount: string;
  withdrawalFee: string;
  quotedFeeAmount: string;
  quotedFeeNotional: string;
  clientWithdrawalRequestRef: string;
}

export interface FiatWalletAccountDetailsRequest {
  accountOwner: string;
  asset: string;
}

export interface FiatWalletAccountDetails {
  asset: string;
  accountOwner: string;
  accountType: string;
  accountGroup: string;
  accountLabel: string;
  balance: string;
  accountRef: string;
  lastUpdate: number;
}

export interface FiatWalletAccountDetailsResponse {
  accounts: FiatWalletAccountDetails[];
  page: number;
  totalPages: number;
}

// Main adapter interface
export interface IFiatWalletAdapter {
  transfer(request: FiatWalletTransferRequest): Promise<FiatWalletTransferResponse>;
  getTransferDetails(transferRequestId: string, provider: string): Promise<FiatWalletTransferDetailsResponse>;
  getWithdrawalQuote(
    request: FiatWalletWithdrawalQuoteRequest,
    provider: string,
  ): Promise<FiatWalletWithdrawalQuoteResponse>;
  executeWithdrawal(
    request: FiatWalletWithdrawalExecuteRequest,
    provider: string,
  ): Promise<FiatWalletWithdrawalResponse>;
  getWithdrawalDetails(withdrawalId: string, provider: string): Promise<FiatWalletWithdrawalResponse>;
  createWithdrawalRequest(
    request: FiatWalletWithdrawalRequestPayload,
    provider: string,
  ): Promise<FiatWalletWithdrawalRequestWrappedResponse>;
  getAccountDetails(request: FiatWalletAccountDetailsRequest): Promise<FiatWalletAccountDetailsResponse>;
}
