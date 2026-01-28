// Base stream data interface
export interface StreamData {
  userId: string;
  type: string;
  data: any;
  timestamp: Date;
}

// Balance-specific data interface
export interface BalanceUpdateData {
  userId: string;
  walletType: 'fiat' | 'blockchain' | 'card';
  walletId: string;
  currency: string;
  balance: string;
  previousBalance?: string;
  transactionId?: string;
  timestamp: Date;
  wallet: any;
}

// Transaction-specific data interface
export interface TransactionUpdateData {
  userId: string;
  transactionId: string;
  status: string;
  amount: string;
  currency: string;
  type: 'fiat' | 'blockchain';
  timestamp: Date;
}

// Notification-specific data interface
export interface NotificationData {
  userId: string;
  title: string;
  message: string;
  type: 'info' | 'warning' | 'error' | 'success';
  timestamp: Date;
}

// Activity-specific data interface (for future use)
export interface ActivityData {
  userId: string;
  activityType: 'login' | 'transaction' | 'wallet_operation' | 'profile_update';
  description: string;
  metadata?: Record<string, any>;
  timestamp: Date;
}

// Payment-specific data interface (for future use)
export interface PaymentData {
  userId: string;
  paymentId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
  amount: string;
  currency: string;
  paymentMethod: string;
  timestamp: Date;
}

// KYC-specific data interface (for future use)
export interface KycData {
  userId: string;
  status: 'pending' | 'approved' | 'rejected' | 'under_review';
  level: 'basic' | 'intermediate' | 'advanced';
  documents?: string[];
  timestamp: Date;
}

// Exchange-specific data interface (for future use)
export interface ExchangeData {
  userId: string;
  exchangeId: string;
  fromCurrency: string;
  toCurrency: string;
  fromAmount: string;
  toAmount: string;
  rate: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  timestamp: Date;
}

// Generic stream event interface
export interface StreamEvent {
  type: string;
  data: any;
  timestamp: string;
}

// Redis message interface
export interface RedisMessage {
  type: string;
  data: any;
  channel?: string;
}

// Stream subscription options
export interface StreamSubscriptionOptions {
  userId: string;
  streamType: string;
  autoReconnect?: boolean;
  reconnectDelay?: number;
  maxReconnectAttempts?: number;
}

// Stream error interface
export interface StreamError {
  code: string;
  message: string;
  timestamp: Date;
  userId?: string;
  streamType?: string;
}
