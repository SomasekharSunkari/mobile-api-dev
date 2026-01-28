import { TransactionStatus } from '../../../../database/models/transaction';

export interface NgToUsdExchangeExecutionResponse {
  status: TransactionStatus;
  transactionRef: string;
  message: string;
  jobId: string | number;
}
