import { IBase } from '../../base';
import {
  CardTransactionDisputeStatus,
  ICardTransactionDispute,
} from '../cardTransactionDispute/cardTransactionDispute.interface';
import { IUser } from '../user';

export enum CardTransactionDisputeEventType {
  CREATED = 'created',
  STATUS_CHANGED = 'status_changed',
}

export enum CardTransactionDisputeTriggeredBy {
  USER = 'user',
  WEBHOOK = 'webhook',
  SYSTEM = 'system',
}

export interface ICardTransactionDisputeEvent extends IBase {
  dispute_id: string;
  previous_status?: CardTransactionDisputeStatus;
  new_status: CardTransactionDisputeStatus;
  event_type: CardTransactionDisputeEventType;
  triggered_by: CardTransactionDisputeTriggeredBy;
  user_id?: string;
  reason?: string;

  dispute?: ICardTransactionDispute;
  user?: IUser;
}
