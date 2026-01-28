import { AsyncLocalStorage } from 'node:async_hooks';

export interface RequestContextType {
  timezone: string;
  traceId?: string;
  userId?: string;
  method?: string;
  path?: string;
  url?: string;
  appVersion?: string;
  deviceType?: string;
}

export const RequestContext = new AsyncLocalStorage<RequestContextType>();
