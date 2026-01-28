export type EvaluationResult = 'ACCEPT' | 'REVIEW' | 'REROUTE';

export interface RiskSignalRequest {
  token: string;
  accountRef: string;
  amount: number;
  currency: string;
}

export interface RiskScore {
  riskTier: number;
  score: number;
}

export interface RuleDetails {
  note?: string;
  actionKey?: string;
}

export interface Ruleset {
  result: EvaluationResult;
  rulesetKey?: string;
  triggeredRuleDetails?: RuleDetails;
}

export interface SignalScores {
  bankInitiatedReturnRisk?: RiskScore;
  customerInitiatedReturnRisk?: RiskScore;
}

export interface EvaluationWarning {
  type: string;
  code: string;
  message: string;
}

export interface RiskSignalResponse {
  requestRef: string;
  ruleset: Ruleset;
  scores: SignalScores;
  warnings: EvaluationWarning[];
}

// Decision reporting interfaces
export interface DecisionReportRequest {
  clientTransactionRef: string;
  initiated: boolean;
  daysFundsOnHold?: number;
  amountInstantlyAvailable?: number;
}

export interface DecisionReportResponse {
  requestRef: string;
}

// Return reporting interfaces
export interface ReturnReportRequest {
  clientTransactionRef: string;
  returnCode: string;
  returnedAt?: string; // ISO 8601 format
}

export interface ReturnReportResponse {
  requestRef: string;
}

// Funding quote interfaces for requesting and receiving quotes
export interface FundingQuoteRequest {
  providerUserRef: string;
  targetCurrency: string;
  sourceCurrency: string;
  operation: 'buy' | 'sell';
  amount: string;
  quoteExpiry?: string; // e.g., "1m", "5m"
}

export interface FundingQuoteResponse {
  quoteRef: string;
  amount: string;
  rate: string;
  expiresAt: number;
}

// Execute payment interfaces
export interface ExecutePaymentRequest {
  providerUserRef: string;
  quoteRef: string;
  achSignedAgreement: number;
  externalAccountRef: string;
  description?: string;
}

export interface ExecutePaymentResponse {
  requestRef: string;
  transactionRef: string;
  status: string;
  warning?: string;
}

// Refresh auth data interfaces
export interface RefreshAuthDataRequest {
  accessToken: string;
  accountRef: string;
}

export interface RefreshAuthDataResponse {
  requestRef: string;
  accountNumber?: string;
  routingNumber?: string;
  mask?: string;
}

// Main adapter interface following the same pattern as IBankAccountLinkingAdapter
export interface IExternalAccountAdapter {
  evaluateRiskSignal(request: RiskSignalRequest, countryCode: string): Promise<RiskSignalResponse>;
  reportDecision(request: DecisionReportRequest, countryCode: string): Promise<DecisionReportResponse>;
  reportReturn(request: ReturnReportRequest, countryCode: string): Promise<ReturnReportResponse>;
  requestQuote(request: FundingQuoteRequest, countryCode: string): Promise<FundingQuoteResponse>;
  executePayment(request: ExecutePaymentRequest, countryCode: string): Promise<ExecutePaymentResponse>;
  refreshUserAuthData(request: RefreshAuthDataRequest, countryCode: string): Promise<RefreshAuthDataResponse>;
}
