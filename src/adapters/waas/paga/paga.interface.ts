export interface PagaGetBankListPayload {
  referenceNumber: string;
}

export interface PagaGetBankListBank {
  name: string;
  uuid: string;
  interInstitutionCode: string;
  sortCode: string;
  ussdCode: string;
}

export interface PagaGetBankListResponse {
  referenceNumber: string;
  statusCode: string;
  statusMessage: string;
  banks: PagaGetBankListBank[];
}

export interface PagaCreatePersistentPaymentAccountPayload {
  referenceNumber: string;
  phoneNumber?: string;
  accountName: string;
  firstName: string;
  lastName: string;
  financialIdentificationNumber?: string;
  email?: string;
  accountReference: string;
  creditBankId?: string;
  creditBankAccountNumber?: string;
  callbackUrl?: string;
  fundingTransactionLimit?: number;
}

export interface PagaCreatePersistentPaymentAccountResponse {
  referenceNumber: string;
  statusCode: string;
  statusMessage: string;
  accountReference: string;
  accountNumber: string;
}

export interface PagaUpdateVirtualAccountPayload {
  referenceNumber: string;
  accountIdentifier: string;
  phoneNumber?: string;
  firstName?: string;
  lastName?: string;
  accountName?: string;
  financialIdentificationNumber?: string;
  callbackUrl?: string;
  creditBankId?: string;
  creditBankAccountNumber?: string;
}

export interface PagaUpdateVirtualAccountResponse {
  referenceNumber: string;
  statusCode: string;
  statusMessage: string;
}

export interface PagaGetVirtualAccountPayload {
  referenceNumber: string;
  accountIdentifier: string;
}

export interface PagaGetVirtualAccountResponse {
  referenceNumber: string;
  statusCode: string;
  statusMessage: string;
  accountReference: string;
  accountNumber: string;
  accountName: string;
  phoneNumber: string;
  firstName: string;
  lastName: string;
  financialIdentificationNumber: string;
  creditBankId: string;
  creditBankAccountNumber: string;
  callbackUrl: string;
}

export interface PagaDeletePersistentAccountPayload {
  referenceNumber: string;
  accountIdentifier: string;
  reason?: string;
}

export interface PagaDeletePersistentAccountResponse {
  referenceNumber: string;
  statusCode: string;
  statusMessage: string;
}

export interface PagaGetTransactionStatusPayload {
  referenceNumber: string;
  locale?: string;
}

export interface PagaGetTransactionStatusData {
  referenceNumber: string;
  statusCode: string;
  statusMessage: string;
  requestAmount: number;
  totalPaymentAmount: number;
  currency: string;
  expiryDateTimeUTC: string;
  refundStatus: string;
}

export interface PagaGetTransactionStatusResponse {
  responseCode: number;
  responseCategoryCode: number | null;
  message: string | null;
  referenceNumber: string;
  currency: string;
  status: string;
  transactionReference: string;
  transactionId: string;
  reversalId: string | null;
  transactionType: string;
  dateUTC: number;
  amount: number;
  merchantTransactionReference: string;
  exchangeRate: number | null;
  fee: number;
  integrationStatus: string;
  additionalProperties: Record<string, any> | null;
}

export enum PagaTransactionStatusEnum {
  SUCCESSFUL = 'SUCCESSFUL',
  PENDING = 'PENDING',
  FAILED = 'FAILED',
}

export enum PagaWebhookTransactionStatusEnum {
  SUCCESS = 'SUCCESS',
  PENDING = 'PENDING',
  FAILED = 'FAILED',
}

export interface PagaVerifyBankAccountPayload {
  referenceNumber: string;
  amount: string;
  currency?: string;
  destinationBankUUID: string;
  destinationBankAccountNumber: string;
}

export interface PagaVerifyBankAccountResponse {
  responseCode: number;
  responseCategoryCode: number;
  message: string;
  referenceNumber: string;
  fee: number;
  vat: number;
  destinationAccountHolderNameAtBank: string;
}

export interface PagaDepositToBankPayload {
  referenceNumber: string;
  amount: number;
  currency?: string;
  destinationBankAccountNumber: string;
  destinationBankUUID: string;
  sendWithdrawalCode?: boolean;
  sourceOfFunds?: string;
  transferReference?: string;
  recipientPhoneNumber?: string;
  recipientMobileOperatorCode?: string;
  recipientEmail?: string;
  recipientName?: string;
  remarks?: string;
  suppressRecipientMessage?: boolean;
  locale?: string;
  alternateSenderName?: string;
  holdingPeriod?: number;
  miniRecipentKYCLevel?: string;
  //TODO: verify if this is required for withdrawing money
  senderFormalName?: string;
  senderGender?: string;
  senderOccupation?: string;
  senderAge?: number;
  senderAddress?: string;
  recipientAddress?: string;
  sourceCurrency?: string;
  sourceAmount?: number;
  effectiveExchangeRate?: number;
}

export interface PagaDepositToBankResponse {
  referenceNumber: string;
  exchangeRate: number;
  destinationAccountHolderNameAtBank: string;
  fee: number;
  vat: number;
  currency: string;
  message: string;
  transactionId: string;
  responseCode: number;
  sessionId: string;
}

export interface PagaMoneyTransferPayload {
  referenceNumber: string;
  amount: number; // Amount to transfer
  currency?: string; // Currency of the operation (optional)
  destinationAccount: string; // Recipient's account identifier
  destinationBank?: string; // Destination bank code (optional)
  sendWithdrawalCode?: boolean; // Include withdrawal code in recipient message (optional, default true)
  sourceOfFunds?: string; // Source account for funds (optional)
  transferReference?: string; // Alternate transaction reference for reconciliation (optional)
  suppressRecipientMessage?: boolean; // Suppress SMS to recipient (optional, default false)
  locale?: string; // Language/locale for messaging (optional)
  alternateSenderName?: string; // Alternate sender name (optional, max 16 chars)
  holdingPeriod?: number; // Days before funds returned if KYC not upgraded (optional)
  miniRecipentKYCLevel?: string; // Minimum KYC level for recipient (optional)
  senderFormalName?: string; // Sender's full name (IMTO, optional)
  senderGender?: string; // Sender's gender (IMTO, optional)
  senderOccupation?: string; // Sender's occupation (IMTO, optional)
  senderAge?: number; // Sender's age (IMTO, optional)
  senderAddress?: string; // Sender's address (IMTO, optional)
  recipientAddress?: string; // Recipient's address (IMTO, optional)
  sourceCurrency?: string; // Source currency (IMTO, optional)
  sourceAmount?: number; // Original amount before exchange (IMTO, optional)
  effectiveExchangeRate?: number; // Exchange rate used (IMTO, optional)
}

export interface PagaMoneyTransferResponse {
  responseCode: number;
  responseCategoryCode: number | null;
  message: string;
  referenceNumber: string;
  withdrawalCode: string | null;
  transactionId: string;
  reversalId: string | null;
  currency: string;
  exchangeRate: number | null;
  fee: number;
  receiverRegistrationStatus: string;
  recipientAccountHolderName: string;
}

export interface PagaGetTransactionHistoryPayload {
  referenceNumber: string;
  accountPrincipal?: string;
  accountCredentials?: string;
  startDateUTC: string;
  endDateUTC: string;
  Locale?: string;
}

export interface PagaGetTransactionHistoryItem {
  itemNumber: number;
  dateUTC: number;
  description: null;
  amount: number;
  status: string;
  transactionId: string;
  referenceNumber: string;
  transactionReference: string;
  sourceAccountName: string;
  sourceAccountOrganizationName: string;
  balance: number;
  tax: number;
  fee: number;
  transactionType: string;
  transactionChannel: string;
  reversalId: string | null;
  currency: string;
}
export interface PagaGetTransactionHistoryResponse {
  responseCode: number;
  responseCategoryCode: number | null;
  message: string;
  referenceNumber: string | null;
  recordCount: number;
  items: PagaGetTransactionHistoryItem[];
}

export interface PagaPersistentAccountWebhookPayerDetails {
  paymentReferenceNumber: string;
  narration: string;
  payerBankName: string;
  payerName: string;
  paymentMethod: string;
  payerBankAccountNumber: string;
}

export interface PagaPersistentAccountWebhookPayload {
  statusCode: string;
  statusMessage: string;
  transactionReference: string;
  fundingTransactionReference: string;
  fundingPaymentReference: string;
  accountNumber: string;
  accountName: string;
  financialIdentificationNumber: string;
  amount: string;
  clearingFeeAmount: string;
  payerDetails: PagaPersistentAccountWebhookPayerDetails;
  instantSettlementStatus: string;
  narration: string;
  hash: string;
}

export enum PagaTransactionType {
  PLATFORM_MAINTENANCE_FEE = 'PLATFORM_MAINTENANCE_FEE',
  MERCHANT_PAYMENT_VIRTUAL_ACCOUNT_TRANSFER = 'MERCHANT_PAYMENT_VIRTUAL_ACCOUNT_TRANSFER',
  TAX_REBATE = 'TAX_REBATE',
  MONEY_TRANSFER_TO_BANK_FEE_REBATE = 'MONEY_TRANSFER_TO_BANK_FEE_REBATE',
  USER_SEND_CASH_TO_BANK_ACCOUNT_SETTLED = 'USER_SEND_CASH_TO_BANK_ACCOUNT_SETTLED',
  USER_DEPOSIT_FROM_BANK_ACCOUNT = 'USER_DEPOSIT_FROM_BANK_ACCOUNT',
}

export interface PagaDepositToBankFromCompanyPayload {
  referenceNumber: string;
  amount: number;
  currency?: string;
  destinationBankAccountNumber: string;
  destinationBankUUID: string;
}

export interface PagaGetAccountBalancePayload {
  referenceNumber: string;
}

export interface PagaGetAccountBalanceResponse {
  responseCode: number;
  responseCategoryCode: number | null;
  message: string;
  referenceNumber: string;
  totalBalance: number;
  availableBalance: number;
  currency: string;
}
