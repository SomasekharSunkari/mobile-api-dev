/**
 * Log Levels Configuration
 */
export enum LogLevel {
  ERROR = 'error',
  WARN = 'warn',
  INFO = 'info',
  DEBUG = 'debug',
  VERBOSE = 'verbose',
}

/**
 * Log Context Interface
 */
export interface LogContext {
  requestId?: string;
  userId?: string;
  operation?: string;
  module?: string;
  metadata?: Record<string, any>;
  [key: string]: any;
}
