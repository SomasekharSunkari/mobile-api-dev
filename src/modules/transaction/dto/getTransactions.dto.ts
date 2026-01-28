import { ApiProperty } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsArray, IsBoolean, IsEnum, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import {
  TransactionCategory,
  TransactionScope,
  TransactionStatus,
  TransactionType,
} from '../../../database/models/transaction/transaction.interface';

export class GetTransactionsDto {
  @ApiProperty({
    description: 'Page number for pagination',
    example: 1,
    required: false,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number = 1;

  @ApiProperty({
    description: 'Number of items per page',
    example: 10,
    required: false,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  limit?: number = 10;

  @ApiProperty({
    description: 'Filter by user ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
    required: false,
  })
  @IsOptional()
  @IsString()
  user_id?: string;

  @ApiProperty({
    description: 'Filter by asset',
    example: 'USD',
    required: false,
  })
  @IsOptional()
  @IsString()
  asset?: string;

  @ApiProperty({
    description: 'Filter by transaction type (comma-separated for multiple values)',
    enum: TransactionType,
    example: 'deposit,withdrawal',
    required: false,
  })
  @IsOptional()
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      return value.split(',').map((v) => v.trim());
    }
    return value;
  })
  @IsArray()
  @IsEnum(TransactionType, { each: true })
  transaction_type?: TransactionType[];

  @ApiProperty({
    description: 'Filter by status (comma-separated for multiple values)',
    enum: TransactionStatus,
    example: 'pending,completed',
    required: false,
  })
  @IsOptional()
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      return value.split(',').map((v) => v.trim());
    }
    return value;
  })
  @IsArray()
  @IsEnum(TransactionStatus, { each: true })
  status?: TransactionStatus[];

  @ApiProperty({
    description: 'Filter by category (comma-separated for multiple values)',
    enum: TransactionCategory,
    example: 'fiat,blockchain,card',
    required: false,
  })
  @IsOptional()
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      return value.split(',').map((v) => v.trim());
    }
    return value;
  })
  @IsArray()
  @IsEnum(TransactionCategory, { each: true })
  category?: TransactionCategory[];

  @ApiProperty({
    description: 'Filter transactions created on or after this date (YYYY-MM-DD format)',
    example: '2025-01-01',
    required: false,
  })
  @IsOptional()
  @IsString()
  start_date?: string;

  @ApiProperty({
    description: 'Filter transactions created on or before this date (YYYY-MM-DD format)',
    example: '2025-12-31',
    required: false,
  })
  @IsOptional()
  @IsString()
  end_date?: string;

  @ApiProperty({
    description: 'Filter by transaction scope (comma-separated for multiple values)',
    enum: TransactionScope,
    example: 'internal,external',
    required: false,
  })
  @IsOptional()
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      return value.split(',').map((v) => v.trim());
    }
    return value;
  })
  @IsArray()
  @IsEnum(TransactionScope, { each: true })
  transaction_scope?: TransactionScope[];

  @ApiProperty({
    description: 'Search term to search across transaction fields and related records',
    example: 'transfer',
    required: false,
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiProperty({
    description: 'Filter by fiat wallet ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
    required: false,
  })
  @IsOptional()
  @IsString()
  fiat_wallet_id?: string;

  @ApiProperty({
    description: 'When true, returns only one transaction per unique beneficiary (useful for recent transactions list)',
    example: true,
    required: false,
  })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  unique_beneficiary?: boolean;
}
