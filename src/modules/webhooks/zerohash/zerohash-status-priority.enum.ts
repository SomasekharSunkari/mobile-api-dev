export enum KycStatusPriority {
  submitted = 1,
  pending_approval = 2,
  approved = 3,
  rejected = 4,
  locked = 5,
  pending_unlock = 6,
  pending_disable = 7,
  disabled = 8,
  divested = 9,
  closed = 10,
}

export enum ExternalAccountStatusPriority {
  pending = 1,
  approved = 2,
  rejected = 3,
  closed = 4,
  locked = 5,
  disabled = 6,
}
