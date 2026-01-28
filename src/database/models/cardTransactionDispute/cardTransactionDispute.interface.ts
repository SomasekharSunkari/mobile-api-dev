import { IBase } from '../../base';
import { ICardTransaction } from '../cardTransaction';

export enum CardTransactionDisputeStatus {
  PENDING = 'pending',
  IN_REVIEW = 'inReview',
  ACCEPTED = 'accepted',
  REJECTED = 'rejected',
  CANCELED = 'canceled',
}

export interface ICardTransactionDispute extends IBase {
  transaction_id: string;
  provider_dispute_ref: string;
  transaction_ref: string;
  status: CardTransactionDisputeStatus;
  text_evidence?: string;
  resolved_at?: Date | string;

  cardTransaction?: ICardTransaction;
}
