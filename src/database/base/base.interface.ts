import { DatabaseTables } from '../database.table';

export interface Pagination {
  page?: number;
  size?: number;
  limit?: number;
}

export type SumRelationship = {
  relationship: string;
  sumColumn: string;
};

export enum HttpRequestMethod {
  'POST' = 'POST',
  'GET' = 'GET',
  'DELETE' = 'DELETE',
  'PUT' = 'PUT',
  'PATCH' = 'PATCH',
}

export interface IBase {
  id?: string;

  created_at?: Date | string;
  updated_at?: Date | string;
  deleted_at?: Date | string;
}

export interface FetchQuery {
  search?: string;
  limit?: number;
  startDate?: string | Date;
  endDate?: string | Date;
  endDateCol?: string;
  filterBy?: string;
  page?: number;
  orderBy?: string;
  order?: 'asc' | 'desc';
}

export interface IPaginatedInterface {
  previous_page: number;
  current_page: number;
  next_page: number;
  limit: number;
  page_count: number;
  total: number;
}

export type TableNames = keyof typeof DatabaseTables;

export type IPaginatedResponse<T = any, K extends TableNames = TableNames> = {
  [P in K]: T[];
} & {
  pagination: IPaginatedInterface;
};
