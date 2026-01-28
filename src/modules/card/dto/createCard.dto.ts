import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, ValidateIf } from 'class-validator';
import { CardType } from '../../../adapters/card/card.adapter.interface';

export class CreateCardDto {
  @ApiProperty({ enum: CardType })
  @IsEnum(CardType)
  type: CardType;

  // Shipping address (required when type is PHYSICAL)
  @ApiPropertyOptional()
  @ValidateIf((o) => o.type === CardType.PHYSICAL)
  @IsString()
  shipping_line1?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  shipping_line2?: string;

  @ApiPropertyOptional()
  @ValidateIf((o) => o.type === CardType.PHYSICAL)
  @IsString()
  shipping_city?: string;

  @ApiPropertyOptional()
  @ValidateIf((o) => o.type === CardType.PHYSICAL)
  @IsString()
  shipping_region?: string;

  @ApiPropertyOptional()
  @ValidateIf((o) => o.type === CardType.PHYSICAL)
  @IsString()
  shipping_postal_code?: string;

  @ApiPropertyOptional()
  @ValidateIf((o) => o.type === CardType.PHYSICAL)
  @IsString()
  shipping_country_code?: string;
}
