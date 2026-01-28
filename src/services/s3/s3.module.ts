import { Module } from '@nestjs/common';
import { AwsS3ConfigProvider } from '../../config/aws-s3.config';
import { S3Service } from './s3.service';

@Module({
  providers: [
    {
      provide: 'AWS_S3_CONFIG',
      useFactory: () => {
        const configProvider = new AwsS3ConfigProvider();
        return configProvider.getConfig();
      },
    },
    {
      /**
       * This is a workaround to avoid the issue of circular dependency
       * https://github.com/nestjs/nest/issues/10211
       * Basically, we need to provide the config before the S3Service is instantiated
       * but the S3Service needs the config to be instantiated
       */
      inject: ['AWS_S3_CONFIG'],
      provide: S3Service,
      useFactory: (config) => new S3Service(config),
    },
  ],
  exports: [S3Service],
})
export class S3Module {}
