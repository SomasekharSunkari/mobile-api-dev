import {
  CardTransactionStatus,
  CardTransactionType,
} from '../../database/models/cardTransaction/cardTransaction.interface';
import { ICardStatus } from '../../database/models/card/card.interface';
import { CardStatus } from '../../adapters/card/card.adapter.interface';

export enum CardNotificationType {
  CARD_CREATED = 'card_created',
  CARD_FROZEN = 'card_frozen',
  CARD_UNFROZEN = 'card_unfrozen',
  CARD_BLOCKED = 'card_blocked',
  CARD_REISSUED = 'card_reissued',
  CARD_ISSUANCE_FEE = 'card_issuance_fee',
  CARD_DEBITED = 'card_debited',
  CARD_FUNDED = 'card_funded',
  INSUFFICIENT_FUNDS_FEE = 'insufficient_funds_fee',
  TRANSACTION_DECLINED_INSUFFICIENT_FUNDS = 'transaction_declined_insufficient_funds',
  DISPUTE_UPDATED = 'dispute_updated',
  TOKEN_WALLET_ADDED = 'token_wallet_added',
}

export const CardStatusToCardStatusMap: Record<CardStatus, ICardStatus> = {
  [CardStatus.LOCKED]: ICardStatus.BLOCKED,
  [CardStatus.ACTIVE]: ICardStatus.ACTIVE,
  [CardStatus.CANCELED]: ICardStatus.SUSPENDED,
  [CardStatus.NOT_ACTIVATED]: ICardStatus.INACTIVE,
};

export interface ICardTransactionFilters {
  page?: number;
  limit?: number;
  card_id?: string;
  transaction_type?: CardTransactionType;
  status?: CardTransactionStatus;
  currency?: string;
  provider_reference?: string;
  type?: string;
  start_date?: string;
  end_date?: string;
  search?: string;
}

export interface RestrictedCountry {
  code: string;
  name: string;
}

export interface RestrictedLocation {
  code: string;
  name: string;
}

export const RESTRICTED_COUNTRIES: RestrictedCountry[] = [
  { code: 'BY', name: 'Belarus' },
  { code: 'CN', name: 'China' },
  { code: 'CU', name: 'Cuba' },
  { code: 'IN', name: 'India' },
  { code: 'IR', name: 'Iran' },
  { code: 'IQ', name: 'Iraq' },
  { code: 'IL', name: 'Israel' },
  { code: 'MM', name: 'Myanmar' },
  { code: 'NP', name: 'Nepal' },
  { code: 'NI', name: 'Nicaragua' },
  { code: 'KP', name: 'North Korea' },
  { code: 'RU', name: 'Russia' },
  { code: 'SY', name: 'Syria' },
  { code: 'TR', name: 'Turkey' },
  { code: 'UA', name: 'Ukraine' },
  { code: 'VE', name: 'Venezuela' },
  { code: 'VN', name: 'Vietnam' },
];

export const RESTRICTED_US_STATES: RestrictedLocation[] = [
  { code: 'AZ', name: 'Arizona' },
  { code: 'DE', name: 'Delaware' },
  { code: 'GA', name: 'Georgia' },
  { code: 'ID', name: 'Idaho' },
  { code: 'LA', name: 'Louisiana' },
  { code: 'MD', name: 'Maryland' },
  { code: 'NV', name: 'Nevada' },
  { code: 'NM', name: 'New Mexico' },
  { code: 'ND', name: 'North Dakota' },
  { code: 'OH', name: 'Ohio' },
  { code: 'OR', name: 'Oregon' },
  { code: 'RI', name: 'Rhode Island' },
  { code: 'SD', name: 'South Dakota' },
  { code: 'VT', name: 'Vermont' },
  { code: 'WA', name: 'Washington' },
  { code: 'WI', name: 'Wisconsin' },
];

export const CARD_LOCATION_RESTRICTIONS = {
  restrictedCountries: RESTRICTED_COUNTRIES.flatMap((country) => [country.code, country.name]),
  restrictedLocation: RESTRICTED_US_STATES.flatMap((state) => [state.code, state.name]),
  customMessage: 'Card operations are not available in your current location due to regulatory requirements.',
  customType: 'CARD_RESTRICTED_REGION_EXCEPTION',
};

export interface ICardNotificationConfig {
  inApp?: boolean;
  email?: boolean;
  push?: boolean;
}

export interface IWalletBalanceChangeEvent {
  walletType: 'card';
  walletId: string;
  currency: string;
  balance: string;
  previousBalance: string;
  transactionId: string;
  wallet?: any;
}

export interface ICardNotificationData {
  userId: string;
  notificationType: CardNotificationType;
  metadata?: Record<string, any>;
  emailMail?: any;
  balanceChangeEvent?: IWalletBalanceChangeEvent;
}
