import { IsArray, IsNotEmpty, IsString } from 'class-validator';

export class CreatePushNotificationDto {
  @IsArray()
  @IsString({ each: true })
  @IsNotEmpty()
  tokens: string[];

  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsNotEmpty()
  body: string;
}
