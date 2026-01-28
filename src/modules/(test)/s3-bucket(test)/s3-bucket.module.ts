import { Module } from '@nestjs/common';
import { S3BucketController } from './s3-bucket.controller';
import { S3BucketService } from './s3-bucket.service';
import { S3Module } from '../../../services/s3';

@Module({
  controllers: [S3BucketController],
  providers: [S3BucketService],
  exports: [S3BucketService],
  imports: [S3Module],
})
export class S3BucketModule {}
