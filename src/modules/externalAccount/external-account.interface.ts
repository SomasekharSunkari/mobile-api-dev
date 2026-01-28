import { EvaluationResult, RiskScore } from '../../adapters/external-account/external-account.adapter.interface';

export interface ExternalAccountFilterInterface {
  id: string;
  userId?: string;
}

export interface SignalEvaluationResponse {
  result: EvaluationResult;
  rulesetKey?: string;
  requestRef: string;
  scores: SignalScoresResponse;
}

export interface SignalScoresResponse {
  bankInitiatedReturnRisk?: RiskScore;
  customerInitiatedReturnRisk?: RiskScore;
}

export interface FundResponse {
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'approved';
  signalEvaluation: SignalEvaluationResponse;
  transactionRef?: string;
  message?: string;
}
