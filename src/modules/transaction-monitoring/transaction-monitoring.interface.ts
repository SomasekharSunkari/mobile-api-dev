// Request and response interfaces for deposit transaction monitoring

export interface MonitorDepositRequest {
  fiatWalletTransactionId: string;
}

export interface MonitorDepositResponse {
  reviewAnswer?: string;
  reviewStatus?: string;
  failureReason?: string;
}
