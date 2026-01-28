import { ApiProperty } from '@nestjs/swagger';

export class UpdateUserResponseDto {
  @ApiProperty({ example: 201 })
  statusCode: number;

  @ApiProperty({ example: 'User Updated successfully' })
  message: string;

  @ApiProperty({
    example: {
      id: 'lt8ebg7o6mzts4y88kiqdv41',
      user_id: 'yhsqdgry5vqvj9qe9o0a0b14',
      address_line1: 'address_line1',
      address_line2: 'address_line2',
      city: 'city',
      state_or_province: 'state_or_province',
      postal_code: 'postal_code',
      gender: 'male',
      dob: null,
      deleted_at: null,
      created_at: '2025-05-06T22:47:36.367Z',
      updated_at: '2025-05-07T15:51:51.994Z',
    },
  })
  user: {
    id: string;
    user_id: string;
    address_line1: string | null;
    address_line2: string | null;
    city: string | null;
    state_or_province: string | null;
    postal_code: string | null;
    gender: string | null;
    dob: string | null;
    deleted_at: string | null;
    created_at: string;
    updated_at: string;
  };

  @ApiProperty({ example: '2025-05-07T15:51:52.002Z' })
  timestamp: string;
}
