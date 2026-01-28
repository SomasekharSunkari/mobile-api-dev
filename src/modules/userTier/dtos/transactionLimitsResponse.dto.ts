import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class LimitDetailDto {
  @ApiProperty({ description: 'Maximum allowed limit', example: 300000000 })
  limit: number;

  @ApiProperty({ description: 'Amount spent in the period', example: 0 })
  spent: number;

  @ApiProperty({ description: 'Remaining amount available', example: 300000000 })
  remaining: number;
}

export class CountLimitDetailDto {
  @ApiProperty({ description: 'Maximum allowed count', example: 3 })
  limit: number;

  @ApiProperty({ description: 'Current count used', example: 1 })
  current: number;

  @ApiProperty({ description: 'Remaining count available', example: 2 })
  remaining: number;
}

export class TransactionLimitsDto {
  @ApiProperty({ description: 'Single transaction limit', example: 300000000 })
  single_transaction_limit: number;

  @ApiProperty({ type: LimitDetailDto, description: 'Daily limit details' })
  daily: LimitDetailDto;

  @ApiProperty({ type: LimitDetailDto, description: 'Weekly limit details' })
  weekly: LimitDetailDto;

  @ApiProperty({ type: LimitDetailDto, description: 'Monthly limit details' })
  monthly: LimitDetailDto;

  @ApiPropertyOptional({ type: CountLimitDetailDto, description: 'Pending transaction count limit (US users only)' })
  pending_count?: CountLimitDetailDto;

  @ApiPropertyOptional({ type: CountLimitDetailDto, description: 'Weekly transaction count limit (US users only)' })
  weekly_count?: CountLimitDetailDto;
}

export class CurrencyLimitsDto {
  @ApiProperty({ description: 'Currency code', example: 'USD' })
  currency: string;

  @ApiProperty({ type: TransactionLimitsDto, description: 'Send/withdrawal limits' })
  send: TransactionLimitsDto;

  @ApiProperty({ type: TransactionLimitsDto, description: 'Receive/deposit limits' })
  receive: TransactionLimitsDto;
}

export class UserTransactionLimitsResponseDto {
  @ApiProperty({ type: [CurrencyLimitsDto], description: 'Transaction limits for all currencies' })
  limits: CurrencyLimitsDto[];
}
