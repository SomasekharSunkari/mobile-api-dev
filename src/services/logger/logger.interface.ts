/**
 * Performance Metrics Interface
 */
export interface PerformanceMetrics {
  operation: string;
  duration: number;
  success: boolean;
  metadata?: Record<string, any>;
}

/**
 * Security Event Interface
 */
export interface SecurityEvent {
  type: 'auth_failure' | 'permission_denied' | 'suspicious_activity' | 'data_breach_attempt';
  userId?: string;
  ipAddress?: string;
  userAgent?: string;
  details: Record<string, any>;
}

/**
 * Business Event Interface
 */
export interface BusinessEvent {
  type:
    | 'payment_initiated'
    | 'payment_completed'
    | 'payment_failed'
    | 'kyc_updated'
    | 'wallet_created'
    | 'transaction_approved';
  userId?: string;
  amount?: number;
  currency?: string;
  details: Record<string, any>;
}
