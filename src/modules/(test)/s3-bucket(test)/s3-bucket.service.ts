import { Inject, Injectable } from '@nestjs/common';
import { S3Service } from '../../../services/s3';

@Injectable()
export class S3BucketService {
  @Inject(S3Service)
  private readonly s3: S3Service;

  async uploadFile(file: Express.Multer.File) {
    const result = await this.s3.uploadMulterFile(file);

    return result;
  }
}
