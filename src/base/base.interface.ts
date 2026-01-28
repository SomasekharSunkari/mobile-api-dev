import Objection from 'objection';

export interface IBaseError {
  statusCode: number;
  message: string;
  type: string;
  data: Record<string, any> | string;
  timestamp: string;
  path: string;
  modelClass?: Objection.ModelClass<Objection.Model>;
  restriction_type?: string;
}

export interface IExceptionResponse {
  statusCode: number;
  message: string | string[] | object;
  error: string;
}

export interface IResponse {
  statusCode: number;
  message: string;
  data: any;
  timestamp: string;
  path?: string;
  resource?: string;
}

export interface FilterDateRange {
  startDate?: Date | string | number;
  endDate?: Date | string | number;
}

export type AnyFunctionType = (...args: any[]) => any;
