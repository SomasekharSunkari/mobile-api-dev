export interface IRainApplicationCompletionLink {
  url: string;
  params: Record<string, string>;
}

export interface IRainUserWebhookBody {
  id: string; // userId
  email: string;
  firstName: string;
  lastName: string;
  applicationStatus:
    | 'approved'
    | 'pending'
    | 'needsInformation'
    | 'needsVerification'
    | 'manualReview'
    | 'denied'
    | 'locked'
    | 'canceled';
  applicationReason: string;
  applicationCompletionLink?: IRainApplicationCompletionLink;
}

export interface IRainUserWebhookPayload {
  id: string; // webhookId
  resource: 'user';
  action: 'updated';
  body: IRainUserWebhookBody;
}

export type RainApplicationStatus = IRainUserWebhookBody['applicationStatus'];

import { ICard, ICardStatus } from '../../../database/models/card/card.interface';
import { ICardTransaction } from '../../../database/models/cardTransaction/cardTransaction.interface';
import { ICardUser } from '../../../database/models/cardUser/cardUser.interface';
import { ITransaction } from '../../../database/models/transaction/transaction.interface';

export const RainCardStatusToCardStatusMap: Record<string, ICardStatus> = {
  // Provider status -> OneDosh internal card status
  // notActivated: treat as pending until activated
  notActivated: ICardStatus.PENDING,
  // active: card is live and usable
  active: ICardStatus.ACTIVE,
  // locked: card is temporarily locked (e.g. frozen) but not permanently blocked
  locked: ICardStatus.INACTIVE,
  // canceled: card has been permanently canceled
  canceled: ICardStatus.CANCELED,
};

export enum RainTransactionStatus {
  PENDING = 'pending',
  DECLINED = 'declined',
  REVERSED = 'reversed',
  COMPLETED = 'completed',
  SUCCESSFUL = 'successful',
}

export const RAIN_FAILED_STATUSES = [RainTransactionStatus.DECLINED, RainTransactionStatus.REVERSED];

export const VALID_STATUS_TRANSITIONS: Record<RainTransactionStatus, RainTransactionStatus[]> = {
  [RainTransactionStatus.PENDING]: [
    RainTransactionStatus.PENDING,
    RainTransactionStatus.SUCCESSFUL,
    RainTransactionStatus.DECLINED,
    RainTransactionStatus.REVERSED,
  ],
  [RainTransactionStatus.SUCCESSFUL]: [RainTransactionStatus.SUCCESSFUL],
  [RainTransactionStatus.DECLINED]: [RainTransactionStatus.DECLINED],
  [RainTransactionStatus.REVERSED]: [RainTransactionStatus.REVERSED],
  [RainTransactionStatus.COMPLETED]: [RainTransactionStatus.COMPLETED],
};

export interface IRainContractWebhookBody {
  id: string; // contractId
  userAddress: string;
  chainId: string;
  proxyAddress: string;
  depositAddress: string;
  controllerAddress: string;
  contractVersion: number;
}

export interface IRainContractWebhookPayload {
  id: string; // webhookId
  resource: 'contract';
  action: 'created';
  body: IRainContractWebhookBody;
}

export interface IRainCollateral {
  amount: number;
  currency: string; // e.g., rusd
  chainId: number;
  walletAddress: string;
  transactionHash: string;
  userId: string; // Rain user id
  postedAt: string;
}

export interface IRainTransactionCollateralBody {
  id: string; // transactionId
  type: 'collateral';
  collateral: IRainCollateral;
}

export interface IRainTransactionWebhookPayload {
  id: string; // webhookId
  resource: 'transaction';
  action: 'created';
  body: IRainTransactionCollateralBody;
}

export interface IRainCardLimit {
  amount: number;
  frequency: 'per24HourPeriod' | 'per7DayPeriod' | 'per30DayPeriod' | 'perYearPeriod' | 'allTime' | 'perAuthorization';
}

export interface IRainCardUpdatedBody {
  id: string; // cardId
  userId: string;
  type: 'physical' | 'virtual';
  status: 'notActivated' | 'active' | 'locked' | 'canceled' | 'inactive';
  limit: IRainCardLimit;
  last4: string;
  expirationMonth: string;
  expirationYear: string;
  tokenWallets: ['Apple'] | ['Google Pay'] | undefined;
}

export interface IRainCardUpdatedWebhookPayload {
  id: string; // webhookId
  resource: 'card';
  action: 'updated';
  body: IRainCardUpdatedBody;
}

export interface IRainCardNotificationCard {
  id: string; // cardId
  userId: string | null;
}

export interface IRainCardNotificationDecisionReason {
  code:
    | 'WALLET_PROVIDER_RISK_THRESHOLD_EXCEEDED'
    | 'DEVICE_SCORE_TOO_LOW'
    | 'CVC_NOT_VALID'
    | 'EXCESSIVE_PROVISIONING_ATTEMPTS_ACROSS_ACCOUNTS'
    | 'EXCESSIVE_CARDS_AND_PROVISIONING_ATTEMPTS'
    | 'EXPIRY_DATE_INVALID'
    | 'UNKNOWN';
  description?: string;
}

export interface IRainCardNotificationBody {
  id: string; // notificationId
  card: IRainCardNotificationCard;
  tokenWallet: string;
  reasonCode: 'PROVISIONING_DECLINED';
  decisionReason?: IRainCardNotificationDecisionReason;
}

export interface IRainCardNotificationWebhookPayload {
  id: string; // webhookId
  resource: 'card';
  action: 'notification';
  body: IRainCardNotificationBody;
}

export interface IRainSpend {
  amount: number;
  currency: string;
  localAmount?: number;
  localCurrency?: string;
  authorizedAmount: number;
  previouslyAuthorizedAmount: number;
  merchantName: string;
  merchantId?: string;
  merchantCity: string;
  merchantCountry: string;
  merchantCategory: string;
  merchantCategoryCode: string;
  cardId: string;
  cardType: 'physical' | 'virtual';
  companyId?: string;
  userId: string;
  userFirstName: string;
  userLastName: string;
  userEmail: string;
  status: 'pending';
  authorizedAt?: Date;
}

export interface IRainSpendTransactionBody {
  id?: string; // transactionId
  type: 'spend';
  spend: IRainSpend;
}

export interface IRainSpendTransactionWebhookPayload {
  id: string; // webhookId
  resource: 'transaction';
  action: 'requested';
  body: IRainSpendTransactionBody;
}

export interface ICardUpdateNeeds {
  needsStatusUpdate: boolean;
  needsLimitUpdate: boolean;
  needsExpirationUpdate: boolean;
  needsTokenWalletsUpdate: boolean;
}

export interface IBuildCardUpdateDataParams {
  card: ICard;
  status: string;
  mappedStatus: ICardStatus;
  updateNeeds: ICardUpdateNeeds;
  limit?: IRainCardLimit;
  expirationMonth?: string;
  expirationYear?: string;
  tokenWallets?: string[];
}

export interface IProcessSpendTransactionUpdateParams {
  card: ICard;
  cardUser: ICardUser;
  existingCardTransaction: ICardTransaction;
  mainTransaction: ITransaction;
  txData: any;
  amount: number;
  currency: string;
  status: string;
  authorizedAmount: number;
  authorizationMethod: string;
  merchantName: string;
  merchantId: string;
  merchantCity: string;
  merchantCountry: string;
  merchantCategory: string;
  merchantCategoryCode: string;
  enrichedMerchantIcon: string;
  enrichedMerchantName: string;
  enrichedMerchantCategory: string;
  localAmount: number;
  localCurrency: string;
  authorizationUpdateAmount: number;
  declinedReason: string;
  authorizedAt: Date;
  cardId: string;
  cardType: string;
}

export interface IRainSpendCreated {
  amount: number;
  currency: string;
  localAmount?: number;
  localCurrency?: string;
  authorizedAmount?: number;
  authorizationMethod?: string;
  merchantName: string;
  merchantId?: string;
  merchantCity: string;
  merchantCountry: string;
  merchantCategory: string;
  merchantCategoryCode: string;
  cardId: string;
  cardType: 'physical' | 'virtual';
  companyId?: string;
  userId: string;
  userFirstName: string;
  userLastName: string;
  userEmail: string;
  status: 'pending' | 'declined';
  declinedReason?: string;
  authorizedAt?: Date;
}

export interface IRainSpendTransactionCreatedBody {
  id: string; // transactionId
  type: 'spend';
  spend: IRainSpendCreated;
}

export interface IRainSpendTransactionCreatedWebhookPayload {
  id: string; // webhookId
  resource: 'transaction';
  action: 'created';
  body: IRainSpendTransactionCreatedBody;
}

export interface IRainSpendUpdated {
  amount: number;
  currency: string;
  localAmount: number;
  localCurrency: string;
  authorizedAmount?: number;
  authorizationUpdateAmount?: number;
  authorizationMethod?: string;
  merchantName: string;
  merchantId?: string;
  merchantCity: string;
  merchantCountry: string;
  merchantCategory: string;
  merchantCategoryCode: string;
  enrichedMerchantIcon?: string;
  enrichedMerchantName?: string;
  enrichedMerchantCategory?: string;
  cardId: string;
  cardType: 'physical' | 'virtual';
  companyId?: string;
  userId: string;
  userFirstName: string;
  userLastName: string;
  userEmail: string;
  status: 'pending' | 'reversed' | 'declined';
  declinedReason?: string;
  authorizedAt: Date;
}

export interface IRainSpendTransactionUpdatedBody {
  id: string; // transactionId
  type: 'spend';
  spend: IRainSpendUpdated;
}

export interface IRainSpendTransactionUpdatedWebhookPayload {
  id: string; // webhookId
  resource: 'transaction';
  action: 'updated';
  body: IRainSpendTransactionUpdatedBody;
}

export interface IRainSpendCompleted {
  amount: number;
  currency: string;
  localAmount: number;
  localCurrency: string;
  authorizedAmount?: number;
  authorizationMethod?: string;
  merchantName: string;
  merchantId?: string;
  merchantCity: string;
  merchantCountry: string;
  merchantCategory: string;
  merchantCategoryCode: string;
  enrichedMerchantIcon?: string;
  enrichedMerchantName?: string;
  enrichedMerchantCategory?: string;
  cardId: string;
  cardType: 'physical' | 'virtual';
  companyId?: string;
  userId: string;
  userFirstName: string;
  userLastName: string;
  userEmail: string;
  status: 'completed';
  authorizedAt: Date;
  postedAt: Date;
}

export interface IRainSpendTransactionCompletedBody {
  id: string; // transactionId
  type: 'spend';
  spend: IRainSpendCompleted;
}

export interface IRainSpendTransactionCompletedWebhookPayload {
  id: string; // webhookId
  resource: 'transaction';
  action: 'completed';
  body: IRainSpendTransactionCompletedBody;
}

/**
 * Blockchain Chain ID Mapping
 * Maps chain names to their development/testnet and production/mainnet chain IDs
 */
export const CHAIN_IDS = {
  ethereum: {
    dev: 11155111, // Sepolia
    prod: 1,
  },
  polygon: {
    dev: 80002, // Amoy
    prod: 137,
  },
  optimism: {
    dev: 11155420, // Sepolia
    prod: 10,
  },
  arbitrum: {
    dev: 421614, // Sepolia
    prod: 42161,
  },
  avalanche: {
    dev: 43113, // Fuji
    prod: 43114,
  },
  base: {
    dev: 84532, // Sepolia
    prod: 8453,
  },
  zkSync: {
    dev: 300, // Sepolia
    prod: 324,
  },
  bnbSmartChain: {
    dev: 97, // Testnet
    prod: 56,
  },
  solana: {
    dev: 901, // Devnet
    prod: 900,
  },
} as const;

export interface IRainDisputeWebhookBody {
  id: string; // disputeId
  transactionId: string;
  status: 'pending' | 'inReview' | 'accepted' | 'rejected' | 'canceled';
  textEvidence?: string;
  createdAt: string; // ISO-8601 timestamp
  resolvedAt?: string; // ISO-8601 timestamp, present for canceled or accepted disputes
}

export interface IRainDisputeCreatedWebhookPayload {
  id: string; // webhookId
  resource: 'dispute';
  action: 'created';
  version: string;
  body: IRainDisputeWebhookBody;
  eventReceivedAt?: string; // ISO-8601 timestamp
}

export interface IRainDisputeUpdatedWebhookPayload {
  id: string; // webhookId
  resource: 'dispute';
  action: 'updated';
  version: string;
  body: IRainDisputeWebhookBody;
  eventReceivedAt?: string; // ISO-8601 timestamp
}

export enum RainDisputeAction {
  CREATED = 'created',
  UPDATED = 'updated',
}

export enum RainWebhookProcessingStatus {
  PROCESSED = 'processed',
  IGNORED = 'ignored',
}

export enum RainWebhookDisputeAction {
  DISPUTE_CREATED = 'dispute_created',
  DISPUTE_UPDATED = 'dispute_updated',
}

export enum RainWebhookDisputeReason {
  TRANSACTION_NOT_FOUND = 'transaction_not_found',
  ALREADY_EXISTS = 'already_exists',
  DISPUTE_NOT_FOUND = 'dispute_not_found',
}

export interface IRainDisputeUpdatedResult {
  status: RainWebhookProcessingStatus;
  action: RainWebhookDisputeAction;
  disputeId: string;
  transactionId: string;
  disputeUpdated: boolean;
  providerDisputeId?: string;
  newStatus?: IRainDisputeWebhookBody['status'];
  reason?: RainWebhookDisputeReason;
  error?: string;
}

export type ChainName = keyof typeof CHAIN_IDS;
export type ChainEnvironment = 'dev' | 'prod';

/**
 * Reverse lookup function to get chain name and environment from chain ID
 * @param chainId - The chain ID to look up
 * @returns Object with chain name and environment, or null if not found
 */
export function getChainInfoFromId(chainId: number): { chainName: ChainName; environment: ChainEnvironment } | null {
  for (const [chainName, environments] of Object.entries(CHAIN_IDS)) {
    for (const [environment, id] of Object.entries(environments)) {
      if (id === chainId) {
        return {
          chainName: chainName as ChainName,
          environment: environment as ChainEnvironment,
        };
      }
    }
  }
  return null;
}
