import { ConfigProvider } from './core/define-config';
import { EnvironmentService } from './environment/environment.service';

export interface AwsS3Config {
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucketName: string;
  endpoint?: string;
  forcePathStyle?: boolean;
  signatureVersion?: string;
  maxFileSize: number; // in bytes
  allowedMimeTypes: string[];
  urlExpirationTime: number; // in seconds
  enableEncryption: boolean;
  encryptionAlgorithm?: string;
  publicReadPath?: string;
  privateReadPath?: string;
}

export class AwsS3ConfigProvider extends ConfigProvider<AwsS3Config> {
  getConfig(): AwsS3Config {
    return {
      region: EnvironmentService.getValue('AWS_S3_REGION'),
      accessKeyId: EnvironmentService.getValue('AWS_S3_ACCESS_KEY_ID'),
      secretAccessKey: EnvironmentService.getValue('AWS_S3_SECRET_ACCESS_KEY'),
      bucketName: EnvironmentService.getValue('AWS_S3_BUCKET_NAME'),
      endpoint: EnvironmentService.getValue('AWS_S3_ENDPOINT'),
      forcePathStyle: EnvironmentService.getValue('AWS_S3_FORCE_PATH_STYLE') === 'true',
      signatureVersion: EnvironmentService.getValue('AWS_S3_SIGNATURE_VERSION'),
      maxFileSize: Number(EnvironmentService.getValue('AWS_S3_MAX_FILE_SIZE')) || 50 * 1024 * 1024, // 50MB default
      allowedMimeTypes: EnvironmentService.getValue('AWS_S3_ALLOWED_MIME_TYPES')
        ? EnvironmentService.getValue('AWS_S3_ALLOWED_MIME_TYPES').split(',')
        : [
            'image/jpeg',
            'image/png',
            'image/gif',
            'image/webp',
            'application/pdf',
            'text/plain',
            'text/csv',
            'application/json',
            'application/zip',
          ],
      urlExpirationTime: Number(EnvironmentService.getValue('AWS_S3_URL_EXPIRATION_TIME') || 3600), // 1 hour default
      enableEncryption: EnvironmentService.getValue('AWS_S3_ENABLE_ENCRYPTION') !== 'false',
      encryptionAlgorithm: EnvironmentService.getValue('AWS_S3_ENCRYPTION_ALGORITHM') || 'AES256',
      publicReadPath: EnvironmentService.getValue('AWS_S3_PUBLIC_READ_PATH') || 'public',
      privateReadPath: EnvironmentService.getValue('AWS_S3_PRIVATE_READ_PATH') || 'private',
    };
  }
}
