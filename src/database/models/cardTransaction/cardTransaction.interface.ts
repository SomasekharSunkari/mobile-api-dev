import { IBase } from '../../base';
import { ICard } from '../card';
import { ICardUser } from '../cardUser';
import { IUser } from '../user';

export enum CardTransactionStatus {
  PENDING = 'pending',
  DECLINED = 'declined',
  SUCCESSFUL = 'successful',
}

export enum CardTransactionType {
  REVERSAL = 'reversal',
  SPEND = 'spend',
  REFUND = 'refund',
  DEPOSIT = 'deposit',
  TRANSFER = 'transfer',
  FEE = 'fee',
}

export enum CardTransactionDrCr {
  CREDIT = 'credit',
  DEBIT = 'debit',
}

export interface ICardTransaction extends IBase {
  user_id: string;
  card_user_id: string;
  card_id?: string;

  amount: number;
  provider_reference?: string;
  currency: string;
  transactionhash?: string;
  authorized_amount?: number;
  authorization_method?: string;
  merchant_name: string;
  merchant_id?: string;
  merchant_city?: string;
  merchant_country?: string;
  merchant_category?: string;
  merchant_category_code?: string;
  status: CardTransactionStatus;
  declined_reason?: string;
  authorized_at?: Date | string;

  balance_before?: number;
  balance_after?: number;
  transaction_type: CardTransactionType;
  type: CardTransactionDrCr;

  description?: string;
  fee?: number;
  provider_fee_reference?: string;
  is_fee_settled?: boolean;

  parent_exchange_transaction_id?: string;

  cardUser?: ICardUser;
  card?: ICard;
  user?: IUser;
}
