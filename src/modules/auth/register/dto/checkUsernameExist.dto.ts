import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsString } from 'class-validator';
import { NoSpaces } from '../../../../decorators/NoSpaces';

export class CheckUsernameExistDto {
  @ApiProperty({
    type: String,
    required: false,
    example: 'john',
    description: 'verify username',
  })
  @IsString()
  @NoSpaces({ message: 'Username cannot contain spaces' })
  @Transform(({ value }) => String(value).toLowerCase().trim())
  username?: string;
}
