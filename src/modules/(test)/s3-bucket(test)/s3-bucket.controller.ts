import { Controller, Inject, Post, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { BaseController } from '../../../base';
import { S3BucketService } from './s3-bucket.service';

@Controller('s3-bucket')
export class S3BucketController extends BaseController {
  @Inject(S3BucketService)
  private readonly s3BucketService: S3BucketService;

  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  async uploadFile(@UploadedFile() file: Express.Multer.File) {
    const result = await this.s3BucketService.uploadFile(file);
    return this.transformResponse('File uploaded successfully', result);
  }
}
