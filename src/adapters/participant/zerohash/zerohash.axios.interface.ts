/* eslint-disable @typescript-eslint/no-unused-vars */
export interface GenerateSignatureParams {
  method: 'GET' | 'POST' | 'PATCH';
  pathWithQuery: string;
  body: any;
  timestamp: number;
  secret: string;
}
