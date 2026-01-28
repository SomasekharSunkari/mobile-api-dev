import { ApiProperty } from '@nestjs/swagger';

export class PagaDashboardAnalyticsDto {
  @ApiProperty({
    description: 'The actual Paga business account balance in kobo (smallest unit)',
    example: 500000000,
  })
  paga_business_balance: number;

  @ApiProperty({
    description: 'The actual Paga business account balance in Naira',
    example: 5000000,
  })
  paga_business_balance_naira: number;

  @ApiProperty({
    description: 'The sum of all user NGN balances in kobo (smallest unit)',
    example: 505000000,
  })
  total_user_balances: number;

  @ApiProperty({
    description: 'The sum of all user NGN balances in Naira',
    example: 5050000,
  })
  total_user_balances_naira: number;

  @ApiProperty({
    description: 'The difference between Paga balance and total user balances in kobo',
    example: -5000000,
  })
  balance_difference: number;

  @ApiProperty({
    description: 'The difference between Paga balance and total user balances in Naira',
    example: -50000,
  })
  balance_difference_naira: number;

  @ApiProperty({
    description: 'Whether a top-up is needed (true if Paga balance < total user balances)',
    example: true,
  })
  needs_top_up: boolean;

  @ApiProperty({
    description: 'Amount needed to top up in kobo to cover all user balances',
    example: 5000000,
  })
  top_up_amount_required: number;

  @ApiProperty({
    description: 'Amount needed to top up in Naira to cover all user balances',
    example: 50000,
  })
  top_up_amount_required_naira: number;

  @ApiProperty({
    description: 'Total number of paga ledger accounts',
    example: 1500,
  })
  total_accounts: number;

  @ApiProperty({
    description: 'Currency of the balances',
    example: 'NGN',
  })
  currency: string;

  @ApiProperty({
    description: 'Timestamp when the analytics was generated',
    example: '2025-01-20T10:00:00.000Z',
  })
  generated_at: string;
}
