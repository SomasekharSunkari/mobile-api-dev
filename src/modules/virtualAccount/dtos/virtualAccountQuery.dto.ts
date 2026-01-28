import { IsOptional } from 'class-validator';

export class VirtualAccountQueryDto {
  @IsOptional()
  walletId?: string;
}
