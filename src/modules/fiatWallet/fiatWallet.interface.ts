export interface IFiatWalletTransactionMetadata {
  description?: string;
  provider?: string;
  provider_reference?: string;
  provider_fee?: number;
  provider_metadata?: Record<string, any>;
  source?: string;
  destination?: string;
  fiat_wallet_transaction_id?: string;
}
