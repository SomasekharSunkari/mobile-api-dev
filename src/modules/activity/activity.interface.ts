export interface IActivityLog {
  id: string;
  user_id: string;
  activity_type: ActivityType;
  action: string;
  description: string;
  activity_date: Date;
  metadata: Record<string, any>;
}

export enum ActivityType {
  TRANSACTION = 'transaction',
  KYC_STATUS = 'kyc_status',
  EXTERNAL_ACCOUNT = 'external_account',
  BLOCKCHAIN_ACCOUNT = 'blockchain_account',
  VIRTUAL_ACCOUNT = 'virtual_account',
}

export interface IActivityFilters {
  activity_type?: ActivityType | ActivityType[];
  start_date?: string;
  end_date?: string;
  page?: number;
  limit?: number;
}

/**
 * Custom pagination response for activities.
 * Cannot use IPaginatedResponse<T> because it generates keys for ALL database tables
 * (users, transactions, external_accounts, etc.) but we need a single 'activities' key
 * for our multi-table UNION query results.
 */
export interface IActivityPaginatedResponse {
  activities: IActivityLog[];
  pagination: {
    previous_page: number;
    current_page: number;
    next_page: number;
    limit: number;
    page_count: number;
    total: number;
  };
}
