import { IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';

export class SendMoneyToOneDoshUserDto {
  @IsString()
  @IsNotEmpty()
  username: string;

  @IsNumber()
  @IsNotEmpty()
  amount: number;

  @IsString()
  @IsNotEmpty()
  currency: string;

  @IsString()
  @IsOptional()
  remark?: string;
}
