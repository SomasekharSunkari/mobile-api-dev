// Common Types
export type FireblocksFeeLevel = 'LOW' | 'MEDIUM' | 'HIGH';

// Response Interfaces
export interface IFireblocksResponse<T = any> {
  data: T;
  status: number;
  statusText: string;
}

export interface IFireblocksPaginatedResponse<T = any> {
  data: {
    transactions: T;
    pageDetails?: {
      prevPage?: string;
      nextPage?: string;
    };
  };
  status: number;
  statusText: string;
}

// Asset Interfaces
export interface IFireblocksAsset {
  id: string;
  name: string;
  type: string;
  contractAddress?: string;
  nativeAsset: string;
  decimals?: number;
}

export interface IFireblocksVaultAsset {
  id: string;
  total: string;
  balance?: string;
  available: string;
  pending: string;
  frozen: string;
  lockedAmount: string;
  blockHeight?: string;
  blockHash?: string;
  rewardsInfo?: IFireblocksRewardsInfo;
}

export interface IFireblocksRewardsInfo {
  [key: string]: any;
}

export enum VaultType {
  MPC = 'MPC',
  MULTISIG = 'MULTISIG',
}

export interface IFireblocksCreateAccountRequest {
  name: string;
  customerRefId?: string;
  hiddenOnUI: boolean;
  autoFuel?: boolean;
  vaultType: VaultType;
  decimals?: number;
  idempotencyKey?: string;
}

export interface IFireblocksCreateAccountResponse {
  id: string;
  name: string;
  assets: IFireblocksVaultAsset[];
  hiddenOnUI: boolean;
  customerRefId?: string;
  autoFuel: boolean;
}

export interface IFireblocksVaultAccount {
  id: string;
  name: string;
  hiddenOnUI: boolean;
  customerRefId?: string;
  autoFuel: boolean;
  assets: IFireblocksVaultAsset[];
}

// Wallet Interfaces
export interface IFireBlocksCreateWalletRequest {
  customerRefId?: string;
  idempotencyKey?: string;
}

export interface IFireBlocksCreateWalletResponse {
  address: string;
  legacyAddress?: string;
  enterpriseAddress?: string;
  tag?: string;
  bip44AddressIndex?: number;
  description?: string;
  customerRefId?: string;
}

// Transaction Source/Destination Interfaces
export interface IFireblocksEndpointBase {
  type: string;
  id?: string;
  walletId?: string;
  name?: string;
}

export interface FireblocksSource extends IFireblocksEndpointBase {}

export interface FireblocksOneTimeAddress {
  address: string;
  tag?: string;
}

export interface FireblocksDestination extends IFireblocksEndpointBase {
  oneTimeAddress?: FireblocksOneTimeAddress;
}

export interface IFireblocksTransactionSource extends IFireblocksEndpointBase {
  type:
    | 'VAULT_ACCOUNT'
    | 'EXCHANGE_ACCOUNT'
    | 'INTERNAL_WALLET'
    | 'EXTERNAL_WALLET'
    | 'FIAT_ACCOUNT'
    | 'NETWORK_CONNECTION'
    | 'COMPOUND'
    | 'GAS_STATION';
}

export interface IFireblocksTransactionDestination extends IFireblocksEndpointBase {
  type:
    | 'VAULT_ACCOUNT'
    | 'EXCHANGE_ACCOUNT'
    | 'INTERNAL_WALLET'
    | 'EXTERNAL_WALLET'
    | 'CONTRACT'
    | 'NETWORK_CONNECTION'
    | 'FIAT_ACCOUNT'
    | 'COMPOUND'
    | 'GAS_STATION'
    | 'ONE_TIME_ADDRESS'
    | 'UNKNOWN'
    | 'END_USER_WALLET'
    | 'PROGRAM_CALL'
    | 'MULTI_DESTINATION';
  oneTimeAddress?: FireblocksOneTimeAddress;
}

// Fee Interfaces
export interface FireblocksFeeEstimate {
  gasPrice?: string;
  maxFeePerGas?: string;
  maxPriorityFeePerGas?: string;
  networkFee: string;
}

export interface IFireblocksEstimateFeeRequest {
  assetId: string;
  amount: string;
  source: FireblocksSource;
  destination: FireblocksDestination;
  operation?: string;
  feeLevel?: FireblocksFeeLevel;
  gasPrice?: string;
  networkFee?: string;
  priorityFee?: string;
  maxFee?: string;
  gasLimit?: string;
  note?: string;
}

export interface IFireblocksEstimateFeeResponse {
  low: FireblocksFeeEstimate;
  medium: FireblocksFeeEstimate;
  high: FireblocksFeeEstimate;
}

// Transaction Interfaces
export interface IFireblocksCreateTransactionRequest {
  operation?: string;
  note?: string;
  externalTxId?: string;
  assetId: string;
  source: IFireblocksTransactionSource;
  destination: IFireblocksTransactionDestination;
  amount: string | number;
  treatAsGrossAmount?: boolean;
  forceSweep?: boolean;
  feeLevel?: FireblocksFeeLevel;
  fee?: string | number;
  priorityFee?: string | number;
  failOnLowFee?: boolean;
  maxFee?: string;
  gasLimit?: string | number;
  gasPrice?: string | number;
  networkFee?: string | number;
  replaceTxByHash?: string;
  extraParameters?: Record<string, any>;
  customerRefId?: string;
  travelRuleMessage?: IFireblocksTravelRuleMessage;
  useGasless?: boolean;
}

export interface IFireblocksCreateTransactionResponse {
  id: string;
  status: string;
  externalTxId?: string;
  systemMessages?: {
    type: 'WARN' | 'BLOCK';
    message: string;
  };
}

export interface IFireblocksTransactionAmountInfo {
  amount: string;
  requestedAmount?: string;
  netAmount?: string;
  amountUSD?: string;
}

export interface IFireblocksTransactionFeeInfo {
  networkFee?: string;
  serviceFee?: string;
  feeCurrency?: string;
}

export interface IFireblocksTransactionBlockInfo {
  blockHash?: string;
  blockHeight?: number;
}

export interface IFireblocksTransactionDestinationDetail {
  destinationAddress: string;
  destinationAddressDescription?: string;
  amount: string;
  amountUSD?: string;
}

export interface IFireblocksTransaction {
  id: string;
  externalTxId?: string;
  status: string;
  subStatus?: string;
  txHash?: string;
  operation: string;
  note?: string;
  assetId: string;
  source: IFireblocksTransactionSource & {
    sourceAddress?: string;
    tag?: string;
  };
  destination?: IFireblocksTransactionDestination & {
    destinationAddress?: string;
    destinationTag?: string;
  };
  destinations?: IFireblocksTransactionDestinationDetail[];
  amountInfo: IFireblocksTransactionAmountInfo;
  feeInfo: IFireblocksTransactionFeeInfo;
  createdAt: number;
  lastUpdated: number;
  createdBy: string;
  signedBy?: string[];
  rejectedBy?: string;
  blockInfo?: IFireblocksTransactionBlockInfo;
}

export interface IFireblocksTransactionsResponse {
  transactions: IFireblocksTransaction[];
  pageDetails: {
    prevPage?: string;
    nextPage?: string;
  };
}

// Travel Rule Interfaces
export interface IFireblocksTravelRuleMessage {
  originatorVASPdid: string;
  beneficiaryVASPdid: string;
  originatorVASPname?: string;
  beneficiaryVASPname?: string;
  beneficiaryVASPwebsite?: string;
  transactionBlockchainInfo?: IFireblocksTravelRuleBlockchainInfo;
  encrypted?: string;
  protocol?: string;
  skipBeneficiaryDataValidation?: boolean;
  travelRuleBehavior?: boolean;
  originatorRef?: string;
  beneficiaryRef?: string;
  travelRuleBehaviorRef?: string;
  originatorProof?: IFireblocksTravelRuleProof;
  beneficiaryProof?: IFireblocksTravelRuleProof;
  beneficiaryDid?: string;
  originatorDid?: string;
  isNonCustodial?: boolean;
}

export interface IFireblocksTravelRuleBlockchainInfo {
  originator: IFireblocksTravelRuleBlockchainOriginator;
  beneficiary: IFireblocksTravelRuleBlockchainBeneficiary;
}

export interface IFireblocksTravelRuleBlockchainOriginator {
  originatorPersons?: IFireblocksTravelRulePerson[];
}

export interface IFireblocksTravelRuleBlockchainBeneficiary {
  beneficiaryPersons?: IFireblocksTravelRulePerson[];
  accountNumber?: string[];
}

export interface IFireblocksTravelRulePerson {
  naturalPerson?: IFireblocksTravelRuleNaturalPerson;
  legalPerson?: IFireblocksTravelRuleLegalPerson;
}

export interface IFireblocksTravelRuleNaturalPerson {
  name?: IFireblocksTravelRuleNaturalPersonName[];
  geographicAddress?: IFireblocksTravelRuleGeographicAddress[];
  nationalIdentification?: IFireblocksTravelRuleNationalIdentification;
  dateAndPlaceOfBirth?: IFireblocksTravelRuleDateAndPlaceOfBirth;
  customerIdentification?: string;
  countryOfResidence?: string;
  customerNumber?: string;
}

export interface IFireblocksTravelRuleLegalPerson {
  name?: string;
  geographicAddress?: IFireblocksTravelRuleGeographicAddress[];
  customerIdentification?: string;
  nationalIdentification?: IFireblocksTravelRuleNationalIdentification;
  countryOfRegistration?: string;
}

export interface IFireblocksTravelRuleProof {
  type?: string;
  proof?: string;
  attestation?: string;
  address?: string;
  wallet_provider?: string;
  url?: string;
  confirmed?: boolean;
}

export interface IFireblocksTravelRuleNaturalPersonName {
  nameIdentifier?: string;
  localNameIdentifier?: string;
  phoneticNameIdentifier?: string;
}

export interface IFireblocksTravelRuleGeographicAddress {
  streetName?: string;
  townName?: string;
  country?: string;
  buildingNumber?: string;
  postCode?: string;
  addressType?: 'HOME' | 'BIZZ' | 'GEOG';
  department?: string;
  subDepartment?: string;
  buildingName?: string;
  floor?: string;
  postBox?: string;
  room?: string;
  townLocationName?: string;
  districtName?: string;
  countrySubDivision?: string;
  addressLine?: string[];
}

export interface IFireblocksTravelRuleNationalIdentification {
  nationalIdentifier?: string;
  nationalIdentifierType?: string;
  countryOfIssue?: string;
  registrationAuthority?: string;
}

export interface IFireblocksTravelRuleDateAndPlaceOfBirth {
  dateOfBirth?: string;
  placeOfBirth?: string;
}

// Event type enums
export enum FireblocksV1EventType {
  TRANSACTION_CREATED = 'TRANSACTION_CREATED',
  TRANSACTION_STATUS_UPDATED = 'TRANSACTION_STATUS_UPDATED',
  TRANSACTIONS_APPROVAL_STATUS_UPDATED = 'TRANSACTIONS_APPROVAL_STATUS_UPDATED',
  VAULT_ACCOUNT_ADDED = 'VAULT_ACCOUNT_ADDED',
  VAULT_ACCOUNT_ASSET_ADDED = 'VAULT_ACCOUNT_ASSET_ADDED',
  VAULT_ACCOUNT_ASSET_BALANCE_UPDATED = 'VAULT_ACCOUNT_ASSET_BALANCE_UPDATED',
}

export enum FireblocksV2EventType {
  TRANSACTION_CREATED = 'transaction.created',
  TRANSACTION_STATUS_UPDATED = 'transaction.status.updated',
  TRANSACTION_APPROVAL_STATUS_UPDATED = 'transaction.approval_status.updated',
  VAULT_ACCOUNT_CREATED = 'vault_account.created',
  VAULT_ACCOUNT_ASSET_ADDED = 'vault_account.asset.added',
  VAULT_ACCOUNT_ASSET_BALANCE_UPDATED = 'vault_account.asset.balance_updated',
}

// Event type mappings
export const FIREBLOCKS_V1_TO_V2_EVENT_TYPES: Record<FireblocksV1EventType, FireblocksV2EventType> = {
  [FireblocksV1EventType.TRANSACTION_CREATED]: FireblocksV2EventType.TRANSACTION_CREATED,
  [FireblocksV1EventType.TRANSACTION_STATUS_UPDATED]: FireblocksV2EventType.TRANSACTION_STATUS_UPDATED,
  [FireblocksV1EventType.TRANSACTIONS_APPROVAL_STATUS_UPDATED]:
    FireblocksV2EventType.TRANSACTION_APPROVAL_STATUS_UPDATED,
  [FireblocksV1EventType.VAULT_ACCOUNT_ADDED]: FireblocksV2EventType.VAULT_ACCOUNT_CREATED,
  [FireblocksV1EventType.VAULT_ACCOUNT_ASSET_ADDED]: FireblocksV2EventType.VAULT_ACCOUNT_ASSET_ADDED,
  [FireblocksV1EventType.VAULT_ACCOUNT_ASSET_BALANCE_UPDATED]:
    FireblocksV2EventType.VAULT_ACCOUNT_ASSET_BALANCE_UPDATED,
} as const;

export const FIREBLOCKS_V2_TO_V1_EVENT_TYPES: Record<FireblocksV2EventType, FireblocksV1EventType> = {
  [FireblocksV2EventType.TRANSACTION_CREATED]: FireblocksV1EventType.TRANSACTION_CREATED,
  [FireblocksV2EventType.TRANSACTION_STATUS_UPDATED]: FireblocksV1EventType.TRANSACTION_STATUS_UPDATED,
  [FireblocksV2EventType.TRANSACTION_APPROVAL_STATUS_UPDATED]:
    FireblocksV1EventType.TRANSACTIONS_APPROVAL_STATUS_UPDATED,
  [FireblocksV2EventType.VAULT_ACCOUNT_CREATED]: FireblocksV1EventType.VAULT_ACCOUNT_ADDED,
  [FireblocksV2EventType.VAULT_ACCOUNT_ASSET_ADDED]: FireblocksV1EventType.VAULT_ACCOUNT_ASSET_ADDED,
  [FireblocksV2EventType.VAULT_ACCOUNT_ASSET_BALANCE_UPDATED]:
    FireblocksV1EventType.VAULT_ACCOUNT_ASSET_BALANCE_UPDATED,
} as const;

// Webhook Interfaces
export interface IFireblocksWebhookV1Payload {
  type: FireblocksV1EventType;
  tenantId: string;
  timestamp: number;
  data: IFireblocksWebhookV1DataUnion;
}

export interface IFireblocksWebhookV2Payload {
  id: string;
  eventType: FireblocksV2EventType;
  eventVersion: number;
  resourceId?: string;
  data: IFireblocksWebhookV2Data;
  createdAt: number;
  workspaceId: string;
}

export interface IFireblocksWebhookV1Data {
  id: string;
  createdAt: number;
  lastUpdated: number;
  assetId: string;
  source: IFireblocksWebhookSource;
  destination: IFireblocksWebhookDestination;
  amount: number;
  sourceAddress: string;
  destinationAddress: string;
  destinationAddressDescription: string;
  destinationTag: string;
  status: string;
  txHash: string;
  subStatus: string;
  signedBy: string[];
  createdBy: string;
  rejectedBy: string;
  amountUSD: number;
  addressType: string;
  note: string;
  exchangeTxId: string;
  requestedAmount: number;
  feeCurrency: string;
  operation: string;
  customerRefId: string | null;
  amountInfo: IFireblocksWebhookAmountInfo;
  feeInfo: IFireblocksWebhookFeeInfo;
  destinations: any[];
  externalTxId: string | null;
  blockInfo: IFireblocksWebhookBlockInfo;
  signedMessages: any[];
  assetType: string;
  networkFee?: number;
  netAmount?: number;
  numOfConfirmations?: number;
  index?: number;
  blockchainIndex?: string;
}

export type IFireblocksWebhookV1DataUnion =
  | IFireblocksWebhookV1Data
  | IFireblocksVaultAccountWebhookData
  | IFireblocksVaultAccountAssetWebhookData;

export interface IFireblocksWebhookV2Data {
  id: string;
  externalTxId: string;
  status: string;
  subStatus: string;
  txHash: string;
  operation: string;
  note: string;
  assetId: string;
  assetType: string;
  source: IFireblocksTransferPeerPath;
  sourceAddress: string;
  destination: IFireblocksTransferPeerPath;
  destinations: IFireblocksDestinationResponse[];
  destinationAddress: string;
  destinationAddressDescription: string;
  destinationTag: string;
  amountInfo: IFireblocksAmountInfo;
  treatAsGrossAmount: boolean;
  feeInfo: IFireblocksFeeInfo;
  feeCurrency: string;
  networkRecords: any[];
  createdAt: number;
  lastUpdated: number;
  createdBy: string;
  signedBy: string[];
  rejectedBy: string;
  authorizationInfo: any;
  exchangeTxId: string;
  customerRefId: string;
  amlScreeningResult: any;
  replacedTxHash: string;
  extraParameters: any;
  signedMessages: any[];
  numOfConfirmations: number;
  blockInfo: IFireblocksBlockInfo;
  index: number;
  blockchainIndex: string;
  rewardsInfo: any;
  systemMessages: IFireblocksSystemMessageInfo[];
  addressType: string;
  requestedAmount: number;
  amount: number;
  netAmount: number;
  amountUSD: number;
  serviceFee: number;
  networkFee: number;
}

export interface IFireblocksWebhookSource {
  id: string;
  type: string;
  name: string;
  subType: string;
}

export interface IFireblocksWebhookDestination {
  id: string;
  type: string;
  name: string;
  subType: string;
}

export interface IFireblocksTransferPeerPath {
  type: string;
  id?: string;
  name?: string;
  address?: string;
  subType?: string;
}

export interface IFireblocksDestinationResponse {
  amount: string;
  destination: IFireblocksTransferPeerPath;
  amountUSD?: number;
  destinationAddressDescription?: string;
  amlScreeningResult?: any;
  customerRefId?: string;
}

export interface IFireblocksWebhookAmountInfo {
  amount: string;
  requestedAmount: string;
  amountUSD: string;
  netAmount?: string;
}

export interface IFireblocksAmountInfo {
  amount: string;
  requestedAmount: string;
  netAmount: string;
  amountUSD: string;
}

export interface IFireblocksWebhookFeeInfo {
  networkFee?: string;
  gasPrice?: string;
}

export interface IFireblocksFeeInfo {
  networkFee: string;
  serviceFee: string;
}

export interface IFireblocksWebhookBlockInfo {
  blockHash?: string;
  blockHeight?: string;
}

export interface IFireblocksBlockInfo {
  blockHash: string;
  blockHeight: number;
}

export interface IFireblocksSystemMessageInfo {
  type: 'WARN' | 'BLOCK';
  message: string;
}

export interface IFireblocksVaultAccountWebhookData {
  id: string;
  name: string;
  hiddenOnUI: boolean;
  assets: string[];
  customerRefId?: string;
  autoFuel?: boolean;
}

export interface IFireblocksVaultAccountAssetWebhookData {
  accountId: string;
  accountName: string;
  assetId: string;
}

export interface IFireblocksResendWebhookRequest {
  txId: string;
  webhookIds?: string[];
}

export interface IFireblocksResendWebhookResponse {
  success: boolean;
  message?: string;
}
