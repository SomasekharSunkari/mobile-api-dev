export interface ExchangeManagementInterface {
  getProviderName(countryCode?: string): string;
  getExchangeRates(payload: GetExchangeRatesPayload): Promise<GetExchangeRatesResponse[]>;
  getChannels(payload: GetExchangeChannelsPayload): Promise<GetExchangeChannelsResponse[]>;
  getBanks(payload: GetBanksPayload): Promise<GetBanksResponse[]>;
  validateBankAccount(payload: ValidateBankAccountPayload): Promise<ValidateBankAccountResponse>;
  getCryptoChannels(): Promise<ExchangeCryptoChannel[]>;
  createPayOutRequest(payload: ExchangeCreatePayOutRequestPayload): Promise<ExchangePayOutRequest>;
  acceptPayOutRequest(payload: ExchangeAcceptPayOutRequestPayload): Promise<ExchangePayOutRequest>;

  rejectPayOutRequest(payload: ExchangeRejectPayOutRequestPayload): Promise<ExchangePayOutRequest>;
  getPayOutRequest(payload: ExchangeGetPayOutRequestPayload): Promise<ExchangePayOutRequest>;
  getPayOutRequestByTransactionRef(transactionRef: string): Promise<ExchangePayOutRequest>;
  getAllPayOutRequests(params: ExchangeGetAllPayOutRequestsQueryParams): Promise<ExchangePayOutRequest[]>;
  createPayInRequest(payload: ExchangeCreatePayInRequestPayload): Promise<ExchangePayInRequest>;
  acceptPayInRequest(payload: ExchangeAcceptPayInRequestPayload): Promise<ExchangePayInRequest>;
  rejectPayInRequest(payload: ExchangeRejectPayInRequestPayload): Promise<ExchangePayInRequest>;
  cancelPayInRequest(payload: ExchangeCancelPayInRequestPayload): Promise<ExchangePayInRequest>;
  refundPayInRequest(payload: ExchangeRefundPayInRequestPayload): Promise<ExchangePayInRequest>;
  getPayInRequest(payload: ExchangeGetPayInRequestPayload): Promise<ExchangePayInRequest>;
  getPayInRequestByTransactionRef(transactionRef: string): Promise<ExchangePayInRequest>;
  getAllPayInRequests(params: ExchangeGetAllPayInRequestsQueryParams): Promise<ExchangePayInRequest[]>;
  createWebhook(payload: ExchangeCreateWebhookPayload): Promise<ExchangeCreateWebhookResponse>;
  getWebhooks(): Promise<ExchangeWebhookResponse[]>;
  deleteWebhook(payload: ExchangeDeleteWebhookPayload): Promise<ExchangeDeleteWebhookResponse>;
}

export interface GetExchangeChannelsPayload {
  countryCode?: string;
}

export enum ExchangeChannelType {
  BANK = 'bank',
  P2P = 'p2p',
  MOMO = 'momo',
  EFT = 'eft',
}
export enum ExchangeChannelStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
}

export enum ExchangeChannelRampType {
  DEPOSIT = 'deposit',
  WITHDRAW = 'withdraw',
}

export interface ExchangeChannelSettlementInfo {
  cryptoCurrency: string;
  cryptoNetwork: string;
  cryptoAmount: number;
}

export interface GetExchangeChannelsResponse {
  ref: string;
  max: number;
  currency: string;
  localCurrency: string;
  status: ExchangeChannelStatus;
  localFee?: number;
  vendorRef: string;
  countryCode: string;
  feeUSD?: number;
  min: number;
  type: ExchangeChannelType;
  rampType: ExchangeChannelRampType;
  settlementType: string;
  settlementTime: number;
}

export interface GetBanksPayload {
  countryCode?: string;
}

export enum BankStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
}

export interface GetBanksResponse {
  ref: string;
  name: string;
  code: string;
  status: BankStatus;
  countryCode: string;
  accountNumberType: string;
  countryAccountNumberType: string;
  channelRefs: string[];
  createdAt: string;
  updatedAt: string;
}

export interface GetExchangeRatesPayload {
  currencyCode: string;
}

export interface GetExchangeRatesResponse {
  buy: number;
  sell: number;
  locale: string;
  rateRef: string;
  code: string;
  updatedAt: string;
}

export interface ValidateBankAccountPayload {
  bankRef: string;
  accountNumber: string;
}

export interface ValidateBankAccountResponse {
  accountNumber: string;
  accountName: string;
  bankName: string;
}

export interface ExchangeGetCryptoChannelsResponse {
  ref: string;
  name: string;
  code: string;
  status: string;
  countryCode: string;
  createdAt: string;
  updatedAt: string;
}

export interface ExchangeCryptoChannelNetwork {
  chainCurrencyRef: string;
  addressRegex?: string;
  requiresMemo?: boolean;
  explorerUrl?: string;
  name: string;
  isEnabled: boolean;
  network: string;
  nativeAsset?: string;
}

export interface ExchangeCryptoChannelCurrencyLimits {
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

export interface ExchangeCryptoChannel {
  code: string;
  ref: string;
  name: string;
  defaultNetwork?: string;
  enabled: boolean;
  networks?: ExchangeCryptoChannelNetwork[];
  minLocalBuy?: ExchangeCryptoChannelCurrencyLimits;
  maxLocalBuy?: ExchangeCryptoChannelCurrencyLimits;
  minLocalSell?: ExchangeCryptoChannelCurrencyLimits;
  maxLocalSell?: ExchangeCryptoChannelCurrencyLimits;
}

export interface ExchangeGetCryptoChannelsResponse {
  channels: ExchangeCryptoChannel[];
}

export interface ExchangeCreatePayOutRequestPayloadSender {
  fullName: string;
  email: string;
  phoneNumber: string;
  countryCode: string;
  dob: string;
  idNumber: string;
  idType: string;
  additionalIdType?: string;
  additionalIdNumber?: string;
  address: string;
}

export interface ExchangeCreatePayOutRequestPayloadDestination {
  accountNumber: string;
  transferType: ExchangeChannelType;
  bankRef: string;
  accountName: string;
}

export interface ReceiverWalletInfo {
  cryptoCurrency: string;
  cryptoNetwork: string;
}

export interface ExchangeCreatePayOutRequestPayloadCryptoInfo {
  cryptoCurrency: string;
  cryptoNetwork: string;
  cryptoAmount: number;
}

export interface ExchangeCreatePayOutRequestPayload {
  channelRef: string;
  transactionRef: string;
  narration: string;
  sender: ExchangeCreatePayOutRequestPayloadSender;
  destination: ExchangeCreatePayOutRequestPayloadDestination;
  userType?: string;
  userId: string;
  cryptoInfo: ExchangeCreatePayOutRequestPayloadCryptoInfo;
}

export interface ExchangeCreatePayOutRequestResponseSender {
  name: string;
  email?: string;
  phone?: string;
  country?: string;
  idNumber?: string;
  idType?: string;
}

export interface ExchangeCreatePayOutRequestResponseDestination {
  accountName?: string;
  accountNumber?: string;
  accountType?: string;
  networkRef?: string;
}

export interface ExchangePayOutRequestCryptoDetailsInfo {
  walletAddress: string;
  cryptoAmount: number;
  cryptoCurrency: string;
  cryptoNetwork: string;
  rate: number;
  expiresAt: string;
}

export interface ExchangePayOutRequest {
  ref: string;
  channelRef: string;
  sequenceRef: string;
  currency: string;
  country: string;
  amount: number;
  reason: string;
  providerRef: string;
  convertedAmount: number;
  status: string;
  rate: number;
  sender: ExchangeCreatePayOutRequestResponseSender;
  destination: ExchangeCreatePayOutRequestResponseDestination;
  userId: string;
  createdAt: string;
  updatedAt: string;
  expiresAt: string;
  cryptoInfo?: ExchangePayOutRequestCryptoDetailsInfo;
}

export interface ExchangeAcceptPayOutRequestPayload {
  paymentRef: string;
}

export interface ExchangeRejectPayOutRequestPayload {
  paymentRef: string;
  reason?: string;
}

export interface ExchangeGetPayOutRequestPayload {
  paymentRef: string;
}

export interface ExchangeGetAllPayOutRequestsQueryParams {
  startDate: string;
  endDate: string;
  page: number;
  limit: number;
  filterBy: string;
}

export interface ExchangeCreateWebhookPayload {
  url: string;
  event?: string;
}

export interface ExchangeCreateWebhookResponse {
  id: string;
  url: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ExchangeCreatePayInRequestPayloadRecipient {
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
  businessIdNumber?: string;
}

export interface ExchangeCreatePayInRequestPayloadSource {
  accountNumber: string;
  accountType: ExchangeChannelType;
  networkRef: string;
}

export interface ExchangeCreatePayInRequestPayloadReceiver {
  walletAddress: string;
  cryptoCurrency: string;
  cryptoNetwork: string;
}

export interface ExchangeCreatePayInRequestPayload {
  localAmount?: number;
  channelRef: string;
  transactionRef: string;
  amount?: number;
  sender: ExchangeCreatePayInRequestPayloadRecipient;
  transferType: ExchangeChannelType;
  userId: string;
  redirectUrl?: string;
  networkRef?: string;
  currencyCode: string;
  receiver: ExchangeCreatePayInRequestPayloadReceiver;
  forceAccept?: boolean;
  customerType: 'retail' | 'institution';
}

export interface ExchangePayInRequestBankInfo {
  name: string;
  accountNumber: string;
  accountName: string;
  paymentLink: string;
}

export interface ExchangeCreatePayInRequestPayloadReceiverCryptoInfo {
  walletAddress: string;
  cryptoCurrency: string;
  cryptoNetwork: string;
  cryptoAmount?: number;
  cryptoUSDRate?: number;
  cryptoLocalRate?: number;
}

export interface ExchangePayInRequest {
  sender: ExchangeCreatePayInRequestPayloadRecipient;
  bankInfo: ExchangePayInRequestBankInfo;
  source: ExchangeCreatePayInRequestPayloadSource;
  channelRef: string;
  transactionRef: string;
  amount: number;
  currency: string;
  country: string;
  ref: string;
  status: string;
  userId: string;
  convertedAmount: number;
  rate: number;
  expiresAt: string;
  createdAt: string;
  updatedAt: string;
  feeLocal: number;
  feeUSD: number;
  networkFeeLocal: number;
  networkFeeUSD: number;
  partnerFeeLocal: number;
  partnerFeeUSD: number;
  receiverCryptoInfo: ExchangeCreatePayInRequestPayloadReceiverCryptoInfo;
}

export interface ExchangeAcceptPayInRequestPayload {
  ref: string;
}

export interface ExchangeRejectPayInRequestPayload {
  ref: string;
}

export interface ExchangeCancelPayInRequestPayload {
  ref: string;
}

export interface ExchangeRefundPayInRequestPayload {
  ref: string;
}

export interface ExchangeGetPayInRequestPayload {
  ref: string;
}

export interface ExchangeGetPayInRequestByTransactionRefPayload {
  transactionRef: string;
}

export interface ExchangeGetAllPayInRequestsQueryParams {
  startDate?: string;
  endDate?: string;
  page?: number;
  limit?: number;
  filterBy?: string;
}

export interface ExchangeWebhookResponse {
  ref: string;
  url: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  event?: string;
}

export interface ExchangeDeleteWebhookPayload {
  ref: string;
}

export interface ExchangeDeleteWebhookResponse {
  ok: number;
}
