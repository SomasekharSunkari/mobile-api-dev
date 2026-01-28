import { ExchangeChannelRampType, ExchangeChannelStatus, ExchangeChannelType } from '../exchange.interface';

export interface YellowCardSignRequest {
  method: string;
  path: string;
  body?: string | Record<any, any>;
  timestamp: string;
}

export interface YellowCardGetChannelPayload {
  country?: string;
}

export interface YellowcardChannels {
  id: string;
  max: number;
  currency: string;
  countryCurrency: string;
  status: ExchangeChannelStatus;
  widgetStatus: string;
  feeLocal: number;
  createdAt: string;
  vendorId: string;
  country: string;
  feeUSD: number;
  min: number;
  channelType: ExchangeChannelType;
  rampType: ExchangeChannelRampType;
  apiStatus: ExchangeChannelStatus;
  settlementType: string;
  estimatedSettlementTime: number;
  updatedAt: string;
  balancer: Record<string, any>;
  widgetMin: number;
  widgetMax: number;
}

export interface YellowCardGetChannelResponse {
  channels: YellowcardChannels[];
}

export interface YellowCardGetBanksPayload {
  country?: string;
}

export interface YellowCardGetNetworksResponse {
  networks: YellowCardGetNetworks[];
}

export enum NetworkStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
}

export interface YellowCardGetNetworks {
  id: string;
  code: string;
  updatedAt: string;
  status: NetworkStatus;
  createdAt: string;
  accountNumberType: string;
  country: string;
  name: string;
  channelIds: string[];
  countryAccountNumberType: string;
}

export interface YellowCardGetExchangeRatesResponseData {
  buy: number;
  sell: number;
  locale: string;
  rateId: string;
  code: string;
  updatedAt: string;
}

export interface YellowCardGetExchangeRatesResponse {
  rates: YellowCardGetExchangeRatesResponseData[];
}

export interface YellowCardGetExchangeRatesPayload {
  currency: string;
}

export interface YellowCardValidateBankAccountPayload {
  networkId: string;
  accountNumber: string;
}

export interface YellowCardValidateBankAccountResponse {
  accountNumber: string;
  accountName: string;
  accountBank: string;
}

export interface YellowCardResource {
  type: string;
  content: string;
  id: string;
}

export interface YellowCardNetwork {
  nativeAsset: string;
  chainCurrencyId: string;
  addressRegex: string;
  requiresMemo: boolean;
  activities: string[];
  explorerUrl: string;
  name: string;
  enabled: boolean;
  network: string;
  contractAddress?: string;
}

export interface YellowCardCurrencyLimits {
  XAF?: number;
  ZAR?: number;
  ZMW?: number;
  NGN?: number;
  KES?: number;
  TZS?: number;
  RWF?: number;
  MWK?: number;
  UGX?: number;
  BWP?: number;
  XOF?: number;
}

export interface YellowCardNetworks {
  [key: string]: YellowCardNetwork;
}

export interface YellowCardChannel {
  code: string;
  resources?: YellowCardResource[];
  zones: string[];
  updatedAt: string;
  networks?: YellowCardNetworks;
  createdAt: string;
  isUTXOBased?: boolean;
  description?: string;
  id: string;
  name: string;
  defaultNetwork?: string;
  enabled: boolean;
  buyMinLocal?: YellowCardCurrencyLimits;
  buyMaxLocal?: YellowCardCurrencyLimits;
  sellMinLocal?: YellowCardCurrencyLimits;
  sellMaxLocal?: YellowCardCurrencyLimits;
}

export interface YellowCardGetCryptoChannelsResponse {
  channels: YellowCardChannel[];
}

export interface YellowCardSubmitPayOutRequestPayloadSender {
  name: string;
  country: string;
  phone: string;
  address: string;
  dob: string;
  email: string;
  idNumber: string;
  idType: string;
  additionalIdType?: string;
  additionalIdNumber?: string;
}

export interface YellowCardSubmitPayOutRequestPayloadDestination {
  accountNumber: string;
  accountType: ExchangeChannelType;
  accountName: string;
  networkId: string;
  accountBank?: string;
  networkName?: string;
  country?: string;
  phoneNumber?: string;
}

export interface YellowCardSubmitPayoutRequestPayloadSettlementInfo {
  cryptoAmount: number;
  cryptoCurrency: string;
  cryptoNetwork: string;
}

export interface YellowCardSubmitPayOutRequestPayload {
  channelId: string;
  amount?: number;
  localAmount?: number;
  reason: string;
  sender: YellowCardSubmitPayOutRequestPayloadSender;
  destination: YellowCardSubmitPayOutRequestPayloadDestination;
  forceAccept: boolean;
  customerUID: string;
  sequenceId: string;
  directSettlement: boolean;
  settlementInfo: YellowCardSubmitPayoutRequestPayloadSettlementInfo;
}

export interface YellowCardSubmitPayOutRequestResponseSender {
  name: string;
  country: string;
  phone: string;
  address: string;
  dob: string;
  email: string;
  idNumber: string;
  idType: string;
}

export interface YellowCardSubmitPayOutRequestResponseDestination {
  accountName: string;
  accountNumber: string;
  accountType: string;
  networkId: string;
}

export interface YellowCardSubmitPayOutRequestResponseSettlementInfo {
  cryptoCurrency: string;
  cryptoNetwork: string;
  cryptoAmount: number;
  walletAddress: string;
  cryptoUSDRate: number;
  expiresAt: string;
}

export interface YellowCardAcceptPayOutRequestPayload {
  id: string;
}

export interface YellowCardRejectPayOutRequestPayload {
  id: string;
}

export interface YellowCardGetPayOutRequestPayload {
  id: string;
}

export interface YellowCardPayOutRequest {
  id: string;
  channelId: string;
  sequenceId: string;
  currency: string;
  country: string;
  amount: number;
  reason: string;
  convertedAmount: number;
  status: string;
  rate: number;
  sender: YellowCardSubmitPayOutRequestResponseSender;
  destination: YellowCardSubmitPayOutRequestResponseDestination;
  customerUID: string;
  createdAt: string;
  updatedAt: string;
  expiresAt: string;
  settlementInfo?: YellowCardSubmitPayOutRequestResponseSettlementInfo;
}

export interface YellowCardGetAllPayOutRequestsQueryParams {
  startDate: string;
  endDate: string;
  startAt: number;
  perPage: number;
  rangeBy: string;
  sortBy: string;
  orderBy: 'asc' | 'desc';
}

export interface YellowCardPayOutRequestResponse {
  payments: YellowCardPayOutRequest[];
}

export interface YellowCardCreateWebhookPayload {
  url: string;
  state?: string;
  active: boolean;
}

export interface YellowCardCreateWebhookResponse {
  partnerId: string;
  url: string;
  state: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
  id: string;
}

export interface YellowCardSubmitCollectionRequestPayloadRecipient {
  name?: string;
  country?: string;
  address?: string;
  dob?: string;
  email?: string;
  idNumber?: string;
  idType?: string;
  additionalIdType?: string;
  additionalIdNumber?: string;
  phone?: string;
  businessName?: string;
  businessId?: string;
}

export interface YellowCardSubmitCollectionRequestPayloadSource {
  accountNumber?: string;
  accountType: ExchangeChannelType;
  networkId?: string;
}

export interface YellowCardSubmitCollectionRequestPayloadSettlementInfo {
  walletAddress: string;
  cryptoCurrency: string;
  cryptoNetwork: string;
  cryptoAmount?: number;
  cryptoUSDRate?: number;
  cryptoLocalRate?: number;
}

export interface YellowCardSubmitCollectionRequestPayloadTravelRuleData {
  firstName: string;
  lastName: string;
}

export interface YellowCardSubmitCollectionRequestPayload {
  channelId: string;
  sequenceId: string;
  amount?: number;
  localAmount?: number;
  recipient: YellowCardSubmitCollectionRequestPayloadRecipient;
  source: YellowCardSubmitCollectionRequestPayloadSource;
  forceAccept: boolean;
  customerType: 'retail' | 'institution';
  redirectUrl: string;
  customerUID: string;
  currency: string;
  country: string;
  reason: string;
  directSettlement: boolean;
  settlementInfo: YellowCardSubmitCollectionRequestPayloadSettlementInfo;
}

export interface YellowCardSubmitCollectionRequestResponseBankInfo {
  name: string;
  accountNumber: string;
  accountName: string;
  paymentLink: string;
}

export interface YellowCardSubmitCollectionRequest {
  recipient: YellowCardSubmitCollectionRequestPayloadRecipient;
  bankInfo: YellowCardSubmitCollectionRequestResponseBankInfo;
  source: YellowCardSubmitCollectionRequestPayloadSource;
  channelId: string;
  sequenceId: string;
  amount: number;
  currency: string;
  country: string;
  partnerId: string;
  apiKey: string;
  id: string;
  status: string;
  customerUID: string;
  convertedAmount: number;
  rate: number;
  expiresAt: string;
  createdAt: string;
  updatedAt: string;
  settlementInfo: YellowCardSubmitCollectionRequestPayloadSettlementInfo;
  serviceFeeAmountUSD: number;
  partnerFeeAmountLocal: number;
  fiatWallet: string;
  reference: string;
  requestSource: string;
  directSettlement: boolean;
  partnerFeeId: string;
  refundRetry: number;
  travelRuleData?: YellowCardSubmitCollectionRequestPayloadTravelRuleData;
  serviceFeeId: string;
  tier0Active: boolean;
  forceAccept: boolean;
  reason: string;
  sessionId: string;
  serviceFeeAmountLocal: number;
  partnerFeeAmountUSD: number;
  depositId: string;
  networkFeeAmountUSD: number;
  networkFeeAmountLocal: number;
}

export interface YellowCardAcceptCollectionRequestPayload {
  id: string;
}

export interface YellowCardRejectCollectionRequestPayload {
  id: string;
}

export interface YellowCardCancelCollectionRequestPayload {
  id: string;
}

export interface YellowCardRefundCollectionRequestPayload {
  id: string;
}

export interface YellowCardGetCollectionRequestPayload {
  id: string;
}

export interface YellowCardGetCollectionRequestByTransactionIdPayload {
  transactionId: string;
}

export interface YellowCardGetAllCollectionRequestsQueryParams {
  startDate: string;
  endDate: string;
  startAt: number;
  perPage: number;
  rangeBy: string;
  sortBy: string;
  orderBy: 'asc' | 'desc';
}

export interface YellowCardGetAllCollectionRequestsResponse {
  collections: YellowCardSubmitCollectionRequest[];
}

export interface YellowCardWebhookResponseData {
  partnerId: string;
  active: boolean;
  updatedAt: string;
  createdAt: string;
  url: string;
  id: string;
  state: string;
}

export interface YellowCardWebhookResponse {
  webhooks: YellowCardWebhookResponseData[];
}

export interface YellowCardDeleteWebhookPayload {
  id: string;
}

export interface YellowCardDeleteWebhookResponse {
  ok: number;
}

export enum YellowCardWebhookEventCategory {
  COLLECTION = 'collection',
  PAYMENT = 'payment',
  SETTLEMENT = 'settlement',
}

export enum YellowCardWebhookEvents {
  // Collection events
  COLLECTION_CREATED = 'COLLECTION.CREATED',
  COLLECTION_PENDING_APPROVAL = 'COLLECTION.PENDING_APPROVAL',
  COLLECTION_PROCESSING = 'COLLECTION.PROCESSING',
  COLLECTION_PENDING_CONFIRMATION = 'COLLECTION.PENDING_CONFIRMATION',
  COLLECTION_FAILED = 'COLLECTION.FAILED',
  COLLECTION_COMPLETE = 'COLLECTION.COMPLETE',
  COLLECTION_PENDING_REFUND = 'COLLECTION.PENDING_REFUND',
  COLLECTION_REFUND_PROCESSING = 'COLLECTION.REFUND_PROCESSING',
  COLLECTION_REFUND_FAILED = 'COLLECTION.REFUND_FAILED',
  COLLECTION_REFUNDED = 'COLLECTION.REFUNDED',
  COLLECTION_CANCELLED = 'COLLECTION.CANCELLED',
  COLLECTION_EXPIRED = 'COLLECTION.EXPIRED',
  COLLECTION_SETTLEMENT_PENDING = 'COLLECTION.SETTLEMENT_PENDING',
  COLLECTION_SETTLEMENT_COMPLETE = 'COLLECTION.SETTLEMENT_COMPLETE',
  // Settlement events
  SETTLEMENT_PENDING = 'SETTLEMENT.PENDING',
  SETTLEMENT_PROCESSING = 'SETTLEMENT.PROCESSING',
  SETTLEMENT_COMPLETE = 'SETTLEMENT.COMPLETE',
  SETTLEMENT_FAILED = 'SETTLEMENT.FAILED',

  // Payment events
  PAYMENT_CREATED = 'PAYMENT.CREATED',
  PAYMENT_PENDING_APPROVAL = 'PAYMENT.PENDING_APPROVAL',
  PAYMENT_PROCESSING = 'PAYMENT.PROCESSING',
  PAYMENT_PENDING_CONFIRMATION = 'PAYMENT.PENDING_CONFIRMATION',
  PAYMENT_PENDING_LIQUIDITY = 'PAYMENT.PENDING_LIQUIDITY',
  PAYMENT_PENDING = 'PAYMENT.PENDING',
  PAYMENT_FAILED = 'PAYMENT.FAILED',
  PAYMENT_COMPLETE = 'PAYMENT.COMPLETE',
  PAYMENT_CANCELLED = 'PAYMENT.CANCELLED',
  PAYMENT_EXPIRED = 'PAYMENT.EXPIRED',
  PAYMENT_PENDING_SETTLEMENT = 'PAYMENT.PENDING_SETTLEMENT',
}

export interface YellowCardWebhookSettlementInfo {
  cryptoNetwork?: string;
  cryptoLocalRate?: number;
  cryptoUSDRate?: number;
  walletAddress: string;
  cryptoAmount: number;
  cryptoCurrency: string;
  txHash?: string;
}

export interface YellowCardWebhookCollectionPayload {
  id: string;
  status: string;
  sequenceId: string;
  apiKey: string;
  event:
    | YellowCardWebhookEvents.COLLECTION_CREATED
    | YellowCardWebhookEvents.COLLECTION_PENDING_APPROVAL
    | YellowCardWebhookEvents.COLLECTION_PROCESSING
    | YellowCardWebhookEvents.COLLECTION_PENDING_CONFIRMATION
    | YellowCardWebhookEvents.COLLECTION_FAILED
    | YellowCardWebhookEvents.COLLECTION_COMPLETE
    | YellowCardWebhookEvents.COLLECTION_PENDING_REFUND
    | YellowCardWebhookEvents.COLLECTION_REFUND_PROCESSING
    | YellowCardWebhookEvents.COLLECTION_REFUND_FAILED
    | YellowCardWebhookEvents.COLLECTION_REFUNDED
    | YellowCardWebhookEvents.COLLECTION_CANCELLED
    | YellowCardWebhookEvents.COLLECTION_EXPIRED
    | YellowCardWebhookEvents.COLLECTION_SETTLEMENT_PENDING
    | YellowCardWebhookEvents.COLLECTION_SETTLEMENT_COMPLETE;
  executedAt: string;
  sessionId: string;
  settlementInfo: YellowCardWebhookSettlementInfo;
  transactionHash?: string;
}

export interface YellowCardWebhookSettlementPayload {
  id: string;
  status: string;
  type: 'payout' | 'topup' | 'payin';
  cryptoCurrency: string;
  cryptoAmount: number;
  network: string;
  fiatAmountUSD: number;
  apiKey: string;
  event:
    | YellowCardWebhookEvents.SETTLEMENT_PENDING
    | YellowCardWebhookEvents.SETTLEMENT_PROCESSING
    | YellowCardWebhookEvents.SETTLEMENT_COMPLETE
    | YellowCardWebhookEvents.SETTLEMENT_FAILED;
  executedAt: number;
  transactionHash: string;
}

export interface YellowCardPaymentWebhookPayload {
  id: string;
  sequenceId: string;
  status: string;
  apiKey: string;
  settlementInfo?: YellowCardWebhookSettlementInfo | {};
  event:
    | YellowCardWebhookEvents.PAYMENT_CREATED
    | YellowCardWebhookEvents.PAYMENT_PENDING_APPROVAL
    | YellowCardWebhookEvents.PAYMENT_PROCESSING
    | YellowCardWebhookEvents.PAYMENT_PENDING_CONFIRMATION
    | YellowCardWebhookEvents.PAYMENT_PENDING_LIQUIDITY
    | YellowCardWebhookEvents.PAYMENT_PENDING
    | YellowCardWebhookEvents.PAYMENT_FAILED
    | YellowCardWebhookEvents.PAYMENT_COMPLETE
    | YellowCardWebhookEvents.PAYMENT_CANCELLED
    | YellowCardWebhookEvents.PAYMENT_EXPIRED
    | YellowCardWebhookEvents.PAYMENT_PENDING_SETTLEMENT;
  executedAt: number;
  sessionId: string;
}

export interface YellowCardWebhookProcessResponse {
  success: boolean;
  message?: string;
}

export type YellowCardWebhookPayload =
  | YellowCardWebhookCollectionPayload
  | YellowCardWebhookSettlementPayload
  | YellowCardPaymentWebhookPayload;
