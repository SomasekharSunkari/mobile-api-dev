import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class TransactionResponseDto {
  // Transaction fields
  @ApiProperty({ description: 'Transaction ID', example: 'cb6nrxbo5s11qvnwyiwct05r' })
  id: string;

  @ApiProperty({ description: 'User ID', example: 'n5kjo33wrartsbnxt7hg54cy' })
  user_id: string;

  @ApiProperty({ description: 'Asset/Currency', example: 'USD' })
  asset: string;

  @ApiProperty({ description: 'Transaction amount', example: '3000' })
  amount: string;

  @ApiProperty({ description: 'Transaction type', example: 'deposit' })
  transaction_type: string;

  @ApiProperty({ description: 'Transaction status', example: 'pending' })
  status: string;

  @ApiProperty({ description: 'Transaction category', example: 'fiat' })
  category: string;

  @ApiProperty({ description: 'Transaction scope', example: 'external' })
  transaction_scope: string;

  @ApiPropertyOptional({ description: 'Transaction description', example: 'COMPANY0' })
  description?: string;

  @ApiPropertyOptional({
    description: 'Failure reason',
    example: 'TM21 - Dormant Account Spike; Transaction monitoring hold',
  })
  failure_reason?: string;

  @ApiProperty({ description: 'Created timestamp', example: '2025-10-08 02:16:28.225+00' })
  created_at: string;

  @ApiProperty({ description: 'Updated timestamp', example: '2025-10-08 02:17:00.604+00' })
  updated_at: string;

  @ApiPropertyOptional({ description: 'Completed timestamp', example: '2025-10-08 02:16:54.553+00' })
  completed_at?: string;

  @ApiPropertyOptional({ description: 'Failed timestamp' })
  failed_at?: string;

  @ApiPropertyOptional({ description: 'Deleted timestamp' })
  deleted_at?: string;

  @ApiProperty({ description: 'Processed timestamp', example: '2025-10-08 02:16:40.598+00' })
  processed_at: string;

  // Fiat wallet transaction fields (flattened)
  @ApiPropertyOptional({ description: 'Provider fee' })
  provider_fee?: number;

  @ApiPropertyOptional({ description: 'Transaction source', example: 'Chase' })
  source?: string;

  @ApiPropertyOptional({ description: 'Transaction destination', example: 'USD Fiat Wallet' })
  destination?: string;

  // Unified account fields (populated from external account or virtual account)
  @ApiPropertyOptional({ description: 'Bank name', example: 'Chase' })
  bank_name?: string;

  @ApiPropertyOptional({ description: 'Account number', example: '0000' })
  account_number?: string;

  @ApiPropertyOptional({ description: 'Account holder name', example: 'Plaid Checking' })
  account_name?: string;

  @ApiPropertyOptional({ description: 'Routing number or bank code' })
  routing_number?: string;

  @ApiPropertyOptional({ description: 'Bank reference or identifier' })
  bank_ref?: string;

  @ApiPropertyOptional({ description: 'Account type', example: 'depository' })
  account_type?: string;

  // Additional fields for specific regions
  @ApiPropertyOptional({ description: 'NUBAN (for Nigerian accounts)' })
  nuban?: string;

  @ApiPropertyOptional({ description: 'SWIFT code (for international transfers)' })
  swift_code?: string;

  @ApiPropertyOptional({ description: 'Card expiration date (for card accounts)' })
  expiration_date?: string;

  @ApiPropertyOptional({ description: 'IBAN (for European accounts)' })
  iban?: string;

  // Destination details from metadata (for external transfers)
  @ApiPropertyOptional({ description: 'Destination bank name', example: 'Access Bank' })
  destination_bank?: string;

  @ApiPropertyOptional({ description: 'Destination account holder name', example: 'Test Customer' })
  destination_name?: string;

  @ApiPropertyOptional({ description: 'Destination account number', example: '8451178690' })
  destination_account_number?: string;

  @ApiPropertyOptional({ description: 'Destination bank code', example: '044' })
  destination_bank_code?: string;

  @ApiPropertyOptional({ description: 'Destination bank reference', example: 'access_bank_ng' })
  destination_bank_ref?: string;

  // Recipient information from metadata (for internal transfers)
  @ApiPropertyOptional({ description: 'Recipient user ID', example: 'n5kjo33wrartsbnxt7hg54cy' })
  recipient_user_id?: string;

  @ApiPropertyOptional({ description: 'Recipient username', example: 'johndoe' })
  recipient_username?: string;

  @ApiPropertyOptional({ description: 'Recipient first name', example: 'John' })
  recipient_first_name?: string;

  @ApiPropertyOptional({ description: 'Recipient last name', example: 'Doe' })
  recipient_last_name?: string;

  @ApiPropertyOptional({ description: 'Recipient avatar URL (signed S3 URL)', example: 'https://s3.amazonaws.com/...' })
  recipient_avatar_url?: string | null;

  // Sender information from metadata (for transfer transactions)
  @ApiPropertyOptional({ description: 'Sender user ID', example: 'n5kjo33wrartsbnxt7hg54cy' })
  sender_user_id?: string;

  @ApiPropertyOptional({ description: 'Sender username', example: 'janedoe' })
  sender_username?: string;

  @ApiPropertyOptional({ description: 'Sender first name', example: 'Jane' })
  sender_first_name?: string;

  @ApiPropertyOptional({ description: 'Sender last name', example: 'Doe' })
  sender_last_name?: string;

  // Card transaction fields
  @ApiPropertyOptional({ description: 'Card merchant name', example: 'AMAZON' })
  card_merchant_name?: string;

  @ApiPropertyOptional({ description: 'Card last four digits', example: '1234' })
  card_last_four_digits?: string;
}

export class TransactionPaginationDto {
  @ApiProperty({ description: 'Current page number', example: 1 })
  current_page: number;

  @ApiProperty({ description: 'Next page number', example: 2 })
  next_page: number;

  @ApiProperty({ description: 'Previous page number', example: 0 })
  previous_page: number;

  @ApiProperty({ description: 'Items per page', example: 10 })
  limit: number;

  @ApiProperty({ description: 'Total number of pages', example: 5 })
  page_count: number;

  @ApiProperty({ description: 'Total number of items', example: 50 })
  total: number;
}

export class GetTransactionsResponseDto {
  @ApiProperty({ type: [TransactionResponseDto], description: 'List of transactions' })
  transactions: TransactionResponseDto[];

  @ApiProperty({ type: TransactionPaginationDto, description: 'Pagination information' })
  pagination: TransactionPaginationDto;
}
