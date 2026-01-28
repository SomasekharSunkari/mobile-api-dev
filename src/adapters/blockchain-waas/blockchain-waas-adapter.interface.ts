import { IFireblocksTravelRuleMessage } from './fireblocks/fireblocks_interface';

// Common Types
export type TFeeLevel = 'LOW' | 'MEDIUM' | 'HIGH';
export const STABLE_COIN_KEYWORDS = ['usd'];

// Account Interfaces
export interface IAccount {
  id: string;
  name: string;
  user_id?: string;
}

export interface ICreateAccountParams {
  user_name: string;
  user_id: string;
  idempotencyKey?: string;
}

export interface ICreateAccountResponse extends IAccount {}

// Wallet Interfaces
export interface IWalletAddress {
  asset_id: string;
  address: string;
  provider_account_ref: string;
  user_id?: string;
}

export interface IWalletError {
  asset_id: string;
  error: string;
}

export interface IAssetId {
  asset_id: string;
  base_asset_id?: string;
  name?: string;
  decimal?: number;
  type?: string;
}

export interface ICreateWalletParams {
  provider_account_ref: string;
  asset_ids: IAssetId[];
  user_id: string;
  idempotencyKey?: string;
}

export interface ICreateWalletResponse {
  successful: IWalletAddress[];
  failed: IWalletError[];
}

// Asset Interfaces
export interface IStableAsset {
  id: string;
  name: string;
  type: string;
  nativeAsset: string;
  imageUrl?: string;
  symbol?: string;
  decimals?: number;
}

export interface IVaultAsset {
  id: string;
  total: string;
  available: string;
  pending?: string;
  lockedAmount?: string;
}

export interface IVaultAccount extends IAccount {
  assets?: IVaultAsset[];
}

// Transaction Source/Destination Interfaces
export interface ITransactionEndpoint {
  type: string;
  id?: string;
  walletId?: string;
  name?: string;
}

export interface ISource extends ITransactionEndpoint {
  // Specific to source if needed
}

export interface IDestination extends ITransactionEndpoint {
  address?: string;
  tag?: string;
}

export interface ITransactionSource extends ITransactionEndpoint {
  type: 'VAULT_ACCOUNT' | 'GAS_STATION';
}

export interface ITransactionDestination extends ITransactionEndpoint {
  type: 'VAULT_ACCOUNT' | 'INTERNAL_WALLET' | 'GAS_STATION' | 'ONE_TIME_ADDRESS';
  address?: string;
  tag?: string;
}

// Fee Interfaces
export interface IFeeEstimate {
  gasPrice?: string;
  maxFeePerGas?: string;
  maxPriorityFeePerGas?: string;
  networkFee: string;
}

export interface IFeeEstimateResponse {
  low: IFeeEstimate;
  medium: IFeeEstimate;
  high: IFeeEstimate;
}

// Transaction Interfaces
export interface ITransactionBaseParams {
  assetId: string;
  amount: string;
  feeLevel?: TFeeLevel;
  idempotencyKey?: string;
}

export interface IEstimateTransactionFeeParams extends ITransactionBaseParams {
  source: ISource;
  destination: IDestination;
  operation?: string;
}

export interface IEstimateInternalTransferFeeParams extends ITransactionBaseParams {
  sourceVaultId: string;
  destinationVaultId: string;
}

export interface IEstimateExternalFeeParams extends ITransactionBaseParams {
  sourceVaultId: string;
  destinationAddress: string;
  destinationTag?: string;
}

export interface ICreateTransactionParams extends ITransactionBaseParams {
  operation?: string;
  note?: string;
  externalTxId?: string;
  source: ITransactionSource;
  destination: ITransactionDestination;
  treatAsGrossAmount?: boolean;
  forceSweep?: boolean;
  fee?: string | number;
  priorityFee?: string | number;
  failOnLowFee?: boolean;
  maxFee?: string;
  gasLimit?: string | number;
  gasPrice?: string | number;
  networkFee?: string | number;
  replaceTxByHash?: string;
  customerRefId?: string;
  travelRuleMessage?: IFireblocksTravelRuleMessage;
  useGasless?: boolean;
}

export interface ISysteMessages {
  type: 'WARN' | 'BLOCK';
  message: string;
}

export interface ICreateTransactionResponse {
  id: string;
  status: string;
  externalTxId?: string;
  systemMessages?: ISysteMessages;
}

export interface ITransferBaseParams extends ITransactionBaseParams {
  note?: string;
  externalTxId?: string;
}

export interface IInternalTransferParams extends ITransferBaseParams {
  sourceVaultId: string;
  destinationVaultId: string;
}

export interface IExternalTransferParams extends ITransferBaseParams {
  sourceVaultId: string;
  destinationAddress: string;
  destinationTag?: string;
  travelRuleMessage?: IFireblocksTravelRuleMessage;
}

export interface ISystemMessage {
  type: 'WARN' | 'BLOCK';
  message: string;
}

export interface ITransferResponse {
  transactionId: string;
  status: string;
  externalTxId?: string;
  systemMessages?: ISystemMessage;
}

// Transaction History Interfaces
export interface ITransactionHistoryItem {
  id: string;
  externalTxId?: string;
  status: string;
  operation: string;
  assetId: string;
  source: ISource & { address?: string };
  destination?: IDestination;
  amount: string;
  fee?: string;
  txHash?: string;
  createdAt: Date;
  lastUpdated: Date;
}

export interface ITransactionHistoryBaseParams {
  before?: Date | number;
  after?: Date | number;
  status?: string;
  limit?: number;
  nextPageToken?: string;
}

export interface ITransactionHistoryParams extends ITransactionHistoryBaseParams {
  orderBy?: 'createdAt' | 'lastUpdated';
  sort?: 'ASC' | 'DESC';
  sourceType?: string;
  destType?: string;
  assetId?: string;
  sourceId?: string;
}

export interface IVaultAssetTransactionHistoryParams extends ITransactionHistoryBaseParams {
  vaultAccountId: string;
  assetId?: string;
}

export interface ITransactionHistoryResponse {
  transactions: ITransactionHistoryItem[];
  nextPageToken?: string;
}

export interface IVaultAssetTransactionHistoryResponse extends ITransactionHistoryResponse {}

export interface IBlockchainWebhookSource {
  type: string;
  id: string;
  sourceAddress?: string;
}

export interface IBlockchainWebhookDestination {
  type: string;
  id: string;
  destinationAddress?: string;
  destinationTag?: string;
}

export interface IBlockchainWebhookAmountInfo {
  amount: string;
}

export interface IBlockchainWebhookFeeInfo {
  networkFee?: string;
}

export interface IBlockchainWebhookData {
  id: string;
  status: string;
  subStatus?: string;
  externalTxId?: string;
  txHash?: string;
  operation: string;
  assetId: string;
  source: IBlockchainWebhookSource;
  destination?: IBlockchainWebhookDestination;
  amountInfo: IBlockchainWebhookAmountInfo;
  feeInfo?: IBlockchainWebhookFeeInfo;
  createdAt: number;
  createdBy?: string;
  lastUpdated: number;
  metadata?: Record<string, any>;
}

// Vault Account Webhook Data Interfaces
export interface IBlockchainVaultAccountWebhookData {
  id: string;
  name: string;
  hiddenOnUI: boolean;
  assets: string[];
  customerRefId?: string;
  autoFuel?: boolean;
  metadata?: Record<string, any>;
}

export interface IBlockchainVaultAccountAssetWebhookData {
  accountId: string;
  accountName: string;
  assetId: string;
  metadata?: Record<string, any>;
}

// Union type for webhook data to support both transaction and vault account events
export type IBlockchainWebhookDataUnion =
  | IBlockchainWebhookData
  | IBlockchainVaultAccountWebhookData
  | IBlockchainVaultAccountAssetWebhookData;

export interface IBlockchainWebhookPayload {
  type?: string;
  eventType?: string;
  id?: string;
  eventVersion?: number;
  resourceId?: string;
  tenantId?: string;
  timestamp?: number;
  createdAt?: number;
  workspaceId?: string;
  createdBy?: string;
  data: IBlockchainWebhookDataUnion;
}

export interface IBlockchainWebhookHeaders {
  signature: string;
  timestamp: string;
  version?: 'v1' | 'v2';
}

export interface IBlockchainWebhookResponse {
  success: boolean;
  message?: string;
  transactionId?: string;
  status?: string;
}

export interface IBlockchainResendWebhookRequest {
  txId?: string;
  resendCreated?: boolean;
  resendStatusUpdated?: boolean;
}

export interface IBlockchainResendWebhookResponse {
  success?: boolean;
  messagesCount?: number;
  message?: string;
}

export interface IBlockchainWaasManagement {
  getAvailableStableAssets(): Promise<IStableAsset[]>;
  createAccount(params: ICreateAccountParams): Promise<ICreateAccountResponse>;
  createWallet(params: ICreateWalletParams): Promise<ICreateWalletResponse>;
  getVaultAccount(vaultAccountId: string): Promise<IVaultAccount>;
  getAssetBalance(vaultAccountId: string, assetId: string): Promise<IVaultAsset>;
  estimateTransactionFee(params: IEstimateTransactionFeeParams): Promise<IFeeEstimateResponse>;
  estimateInternalTransferFee(params: IEstimateInternalTransferFeeParams): Promise<IFeeEstimateResponse>;
  estimateExternalTransactionFee(params: IEstimateExternalFeeParams): Promise<IFeeEstimateResponse>;
  internalTransfer(params: IInternalTransferParams): Promise<ITransferResponse>;
  externalTransfer(params: IExternalTransferParams): Promise<ITransferResponse>;
  createTransaction(params: ICreateTransactionParams): Promise<ICreateTransactionResponse>;
  getTransactionHistory(params: ITransactionHistoryParams): Promise<ITransactionHistoryResponse>;
  getTransaction(params: { txId?: string; externalTxId?: string }): Promise<ITransactionHistoryItem>;
  handleWebhook(
    payload: string,
    signature: string,
    timestamp: string,
    version?: 'v1' | 'v2',
  ): Promise<IBlockchainWebhookPayload>;
  resendWebhook(params?: IBlockchainResendWebhookRequest): Promise<IBlockchainResendWebhookResponse>;
}
