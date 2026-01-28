export interface IAccessBlockerAttempt {
  ipAddress: string;
  countryCode?: string;
  reason: string;
  path: string;
}
