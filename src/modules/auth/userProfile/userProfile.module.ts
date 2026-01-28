import { Module } from '@nestjs/common';
import { S3Module } from '../../../services/s3';
import { UserProfileRepository } from './userProfile.repository';
import { UserProfileService } from './userProfile.service';

@Module({
  providers: [UserProfileRepository, UserProfileService],
  exports: [UserProfileRepository, UserProfileService],
  imports: [S3Module],
})
export class UserProfileModule {}
