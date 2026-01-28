export interface WaasManagement {
  createBank(payload: VirtualPermanentAccountPayload): Promise<VirtualPermanentAccountResponse>;
  getProviderName(): string;
  findOrCreateVirtualAccount(payload: VirtualPermanentAccountPayload): Promise<VirtualPermanentAccountResponse>;
  debitBank(payload: DebitTransactionPayload<any>): Promise<any>;
  creditBank(payload: CreditTransactionPayload<any>): Promise<any>;
  getVirtualAccount(payload: GetWalletPayload): Promise<GetWalletResponse | undefined>;
  getWalletDetails(payload: GetWalletDetailsPayload): Promise<GetWalletDetailsResponse>;
  processTransferInflowWebhook(payload: WaasProcessWebhookPayload): Promise<WaasProcessWebhookResponse>;
  upgradeVirtualAccount(payload: WaasUpgradeVirtualAccountPayload): Promise<WaasUpgradeVirtualAccountResponse>;
  checkUpgradeStatus(payload: WaasCheckUpgradeStatusPayload): Promise<WaasCheckUpgradeStatusResponse>;
  upgradeAccountToTierThreeMultipart(
    payload: WaasUpgradeAccountToTierThreePayload,
  ): Promise<WaasUpgradeAccountToTierThreeResponse>;
  getTransactions(payload: GetBankTransactionsPayload): Promise<BankTransaction[]>;
  transferToOtherBank(payload: TransferToOtherBankPayload): Promise<WaasTransferToOtherBankResponse>;
  transferToSameBank(payload: TransferToSameBankPayload): Promise<WaasTransferToSameBankResponse>;
  getBankList(payload?: WaasGetBankListPayload): Promise<WaasGetBankListResponse[]>;
  getTransactionStatus(payload: GetTransactionStatusPayload): Promise<GetTransactionStatusResponse>;
  verifyBankAccount(payload: VerifyBankAccountPayload): Promise<VerifyBankAccountResponse>;
  getBankCode(): string;
  updateVirtualAccount(payload: UpdateVirtualAccountPayload): Promise<UpdateVirtualAccountResponse>;
  deleteVirtualAccount(payload: DeleteVirtualAccountPayload): Promise<DeleteVirtualAccountResponse>;
  checkLedgerBalance(payload: CheckLedgerBalancePayload): Promise<CheckLedgerBalanceResponse>;
  getBusinessAccountBalance(): Promise<GetTotalBusinessAccountBalanceResponse>;
}
export interface GetTotalBusinessAccountBalanceResponse {
  totalBalance: number;
  availableBalance: number;
  currency: string;
}

export interface CheckLedgerBalancePayload {
  accountNumber: string;
  amount: number;
  currency: string;
}

export interface CheckLedgerBalanceResponse {
  hasSufficientBalance: boolean;
  availableBalance: number;
  requestedAmount: number;
}

export enum WaasTransactionStatus {
  SUCCESS = 'SUCCESS',
  PENDING = 'PENDING',
  FAILED = 'FAILED',
}

export interface VirtualPermanentAccountPayload {
  bvn?: string;
  first_name: string;
  last_name: string;
  email?: string;
  phone_number: string;
  date_of_birth: string;
  gender: string;
  address: string;
  ref?: string;
  funding_limit?: number;
}

export interface VirtualPermanentAccountResponse {
  account_number: string;
  account_name: string;
  bank_name: string;
  account_type?: string;
  account_sub_type?: string;
  amount?: number;
  order_ref?: string;
  provider_ref: string;
  provider_id: number | string;
  provider_name: string;
  provider_balance?: number | string;
}

export interface GetWalletPayload {
  bvn?: string;
  accountNumber?: string;
  ref?: string;
}

export interface GetWalletResponse {
  accountName: string;
  accountNumber: string;
  status?: string;
  merchantId?: string;
  bvn?: string;
  phoneNumber?: string;
  dateOfBirth?: string;
  address?: string;
  email?: string;
  bankName?: string;
  bankCode?: string;
  ref?: string;
  callBackUrl?: string;
}

export interface CreditTransactionPayload<T = Record<string, string | number | boolean>> {
  accountNo: string | number;
  narration?: string;
  totalAmount: number;
  transactionId: string;
  metadata: T;
}

export interface DebitTransactionPayload<T = Record<string, string | number | boolean>> {
  accountId: string | number;
  narration?: string;
  amount: number;
  transactionId: string;
  metadata: T;
}

export interface CreditOrDebitBankResponseData {
  responseCode: string;
  reference: string;
}

export interface CreditBankResponse {
  data: CreditOrDebitBankResponseData;
}

export interface DebitBankResponse {
  data: CreditOrDebitBankResponseData;
}

export interface ExternalBankAccountDetailsPayload {
  bank: string;
  accountId: string | number;
}

export interface ExternalBankAccountDetailsResponse {
  bankId: string;
  bankName: string;
  bankLogoUrl?: string;
  accountName: string;
  accountNumber: string | number;
  accountType?: string;
}

export interface OtherBankTransferPayload {
  bank: string;
  accountName: string;
  accountNumber: string;
  senderAccountNumber: string;
  senderName: string;
  narration: string;
  amount: string;
  country: string;
  currency: string;
  description: string;
  isFee: boolean;
  merchantFeeAccount: string;
  merchantFeeAmount: string;
  reference: string;
}

export interface OtherBankTransferResponse {
  bank: string;
  accountNumber: string;
  accountName: string;
  senderAccountNumber: string;
  senderName: string;
  amount: string;
  currency: string;
  description: string;
  country: string;
  narration: string;
}

export interface BankEnquiryPayload {
  accountNo: string;
}

export interface BankEnquiryData {
  pndstatus: string;
  status: string;
  name: string;
  bvn: string;
  availableBalance: number;
  ledgerBalance: number;
  maximumBalance: number;
  phoneNo: string;
  tier: string;
  isSuccessful: boolean;
}

export interface BankEnquiryResponse {
  data: BankEnquiryData;
}

export interface GetBankPayload {
  bvn: string;
}

export interface BankDetails {
  accountName: string;
  accountNumber: string;
  bvn: string;
  phoneNumber: string;
  dateOfBirth: string;
  address: string;
  email?: string;
}

export interface GetBankData {
  bank: BankDetails[];
}

export interface GetBankResponse {
  data: GetBankData;
}

export interface GetBankTransactionsPayload {
  accountNumber: string;
  fromDate?: string;
  ref?: string;
  toDate?: string;
  numberOfItems?: string;
}

export interface BankTransaction {
  isReversed: boolean;
  isCard?: boolean;
  reversalReferenceNo?: string | null;
  uniqueIdentifier?: string;
  postingType?: string;
  currentDate?: string;
  creditAmount?: string;
  debitAmount?: string;
  balanceAfter: number;
  balanceBefore?: number;
  accountNumber: string | null;
  referenceNo: string;
  narration: string;
  amount: number;
  transactionDate: string;
  isCredit?: boolean;
  isDebit?: boolean;
}

export interface GetBankTransactionsData {
  responseCode: string;
  message: BankTransaction[];
}

export interface GetBankTransactionsResponse {
  data: GetBankTransactionsData;
}

export interface BankList {
  bankName: string;
  bankCode: string;
  nibssBankCode: string;
}

export interface BankListResponse {
  bankName: string;
  bankCode: string;
  nibssBankCode: string;
}

export enum ProcessWebhookResponseStatus {
  SUCCESS = 'SUCCESS',
  PENDING = 'PENDING',
  FAILED = 'FAILED',
}

export interface ProcessWebhookPayload<T = Record<string, any>> {
  event: string;
  data: T;
  status?: string;
}

export interface ProcessWebhookResponse<T = Record<string, any>> {
  message: string;
  status: string;
  data: T;
}

export interface WaasUpgradeVirtualAccountPayload {
  accountNumber: string;
  bvn: string;
  nin: string;
  tier: string | number;
  idType: string | number;
  phoneNumber: string;
  email: string;
  userPhoto: string;
  idNumber: string;
  idCardFront: string;
  streetName: string;
  state: string;
  city: string;
  localGovernment: string;
  pep: string;
  utilityBill: string;
  accountName?: string;
  channelType?: string;
  idIssueDate?: string;
  idExpiryDate?: string;
  idCardBack?: string;
  houseNumber?: string;
  approvalStatus?: string;
  customerSignature?: string;
  nearestLandmark?: string;
  placeOfBirth?: string;
  proofOfAddressVerification?: Express.Multer.File;
}

export interface WaasUpgradeVirtualAccountResponse {
  message: string;
  status: string;
}

export interface WaasUpgradeAccountToTierThreePayload {
  accountNumber: string;
  bvn: string;
  nin: string;
  proofOfAddressVerification: Express.Multer.File;
}

export interface WaasUpgradeAccountToTierThreeResponse {
  message: string;
  status: string;
}

export interface WaasCheckUpgradeStatusPayload {
  accountNumber: string;
}

export interface WaasCheckUpgradeStatusResponse {
  message: string;
  status: string;
}

export interface WaasProcessWebhookPayload {
  transactionId: string;
  accountNumber?: string;
}

interface WaasProcessWebhookResponseSender {
  accountName?: string;
  accountNumber?: string;
  bankName?: string;
  bankCode?: string;
  bankLogoUrl?: string;
  country?: string;
  currency?: string;
  email?: string;
}

export interface WaasProcessWebhookResponse {
  transactionId: string;
  accountNumber?: string;
  amount: string;
  status: 'SUCCESS' | 'FAILED' | 'PENDING' | 'REVERSED';
  narration?: string;
  currency?: string;
  sender: WaasProcessWebhookResponseSender;
}

export interface TransferToOtherBankSender {
  accountName?: string;
  accountNumber: string;
  bankCode?: string;
  bankName?: string;
  address?: string;
  occupation?: string;
  gender?: string;
  age?: string;
  fullName?: string;
  bankRef?: string;
}

export interface TransferToOtherBankPayload {
  transactionReference: string;
  amount: number;
  currency?: string;
  description?: string;
  sender: TransferToOtherBankSender;
  receiver: TransferToOtherBankSender;
  transactionType: string;
}

export interface TransferFromCompanyToOtherBankPayload {
  transactionReference: string;
  amount: number;
  currency?: string;
  description?: string;
  sender?: TransferToOtherBankSender;
  receiver: TransferToOtherBankSender;
  transactionType: string;
}

export interface WaasTransferToOtherBankResponse {
  transactionReference: string;
  sender: TransferToOtherBankSender;
  receiver: TransferToOtherBankSender;
  transactionType: string;
  narration: string;
  amount: number;
  currency: string;
  country: string;
}

export interface WaasGetBankListPayload {
  country?: string;
  ref?: string;
}

export interface WaasGetBankListResponse {
  bankName: string;
  bankCode: string;
  nibssBankCode: string;
  bankRef?: string;
}
export interface GetTransactionStatusPayload {
  transactionRef: string;
}

export interface GetTransactionStatusResponse {
  message: string;
  status: WaasTransactionStatus;
}

export interface VerifyBankAccountPayload {
  accountNumber: string;
  bankCode?: string;
  amount?: string;
  bankRef: string;
}

export interface VerifyBankAccountResponse {
  accountName: string;
  accountNumber: string;
  bankName: string;
  bankCode: string;
  bvn?: string;
  bankRef?: string;
}

export interface GetWalletDetailsPayload {
  accountNo: string;
  ref?: string;
}

export interface GetWalletDetailsResponse {
  accountName: string;
  accountNumber: string;
  bankName: string;
  bankCode: string;
  ref?: string;
  dateOfBirth?: string;
  address?: string;
  email?: string;
  gender?: string;
  placeOfBirth?: string;
  accountStatus?: string;
  productCode?: string;
  lienStatus?: string;
  bvn?: string;
  availableBalance?: number;
  freezeStatus?: string;
  ledgerBalance?: number;
  maximumBalance?: number;
  nuban?: string;
  phoneNumber?: string;
  tier?: string;
  status?: string;
  description?: string;
  isActive?: boolean;
  isVerified?: boolean;
  isBlocked?: boolean;
  isFrozen?: boolean;
  callbackUrl?: string;
}

export interface UpdateVirtualAccountPayload {
  accountNumber?: string;
  accountName?: string;
  bankName?: string;
  bankCode?: string;
  bvn?: string;
  firstName?: string;
  lastName?: string;
  ref?: string;
  phoneNumber?: string;
  callbackUrl?: string;
  creditBankId?: string;
  creditBankAccountNumber?: string;
}

export interface UpdateVirtualAccountResponse {
  message: string;
  status: string;
  ref?: string;
}

export interface DeleteVirtualAccountPayload {
  accountNumber: string;
  ref?: string;
  reason?: string;
  isMainAccount: boolean;
}

export interface DeleteVirtualAccountResponse {
  message: string;
  status: string;
}

export interface TransferToSameBankSender {
  accountNumber: string;
  accountName?: string;
  bankName?: string;
  bankRef?: string;
}

export interface TransferToSameBankPayload {
  transactionReference: string;
  amount: number;
  currency?: string;
  description?: string;
  sender: TransferToSameBankSender;
  receiver: TransferToSameBankSender;
  transactionType: string;
}

export interface WaasTransferToSameBankResponse {
  transactionReference: string;
  sender: TransferToSameBankSender;
  receiver: TransferToSameBankSender;
  amount: number;
  currency: string;
  country: string;
  providerRef: string;
}
