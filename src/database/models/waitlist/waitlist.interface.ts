import { IBase } from '../../base';

export interface IWaitlist extends IBase {
  user_id: string;
  user_email: string;
  reason: IWaitlistReason;
  feature: IWaitlistFeature;
}

export const WaitlistReason = {
  PHYSICAL_CARDS: 'physical_cards',
  LOCATION_UNBLOCKED: 'location_unblocked',
} as const;

export type IWaitlistReason = (typeof WaitlistReason)[keyof typeof WaitlistReason];

export const WaitlistFeature = {
  CARD: 'card',
  TRANSFER: 'transfer',
} as const;

export type IWaitlistFeature = (typeof WaitlistFeature)[keyof typeof WaitlistFeature];
