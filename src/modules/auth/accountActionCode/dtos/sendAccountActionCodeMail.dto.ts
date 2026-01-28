import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';

export enum AccountActionType {
  DELETE = 'delete',
  DEACTIVATE = 'deactivate',
  CHANGE_TRANSACTION_PIN = 'change_transaction_pin',
  CHANGE_PASSWORD = 'change_password',
  EMAIL_VERIFICATION = 'email_verification',
  PHONE_VERIFICATION = 'phone_verification',
  TWO_FACTOR_AUTH = 'two_factor_auth',
  ACCOUNT_DEACTIVATION = 'account_deactivation',
  WITHDRAW_FUNDS = 'withdraw_funds',
  RESET_PASSWORD = 'reset_password',
  RESET_TRANSACTION_PIN = 'reset_transaction_pin',
}

export class SendAccountActionCodeMailDto {
  @IsEnum(AccountActionType)
  @IsOptional()
  @ApiProperty({
    enum: AccountActionType,
    required: false,
    example: AccountActionType.DEACTIVATE,
    description: 'Action type - delete or deactivate',
    default: AccountActionType.DEACTIVATE,
  })
  action?: AccountActionType;
}
