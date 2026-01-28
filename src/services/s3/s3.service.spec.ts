import { BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Readable } from 'stream';
import { AwsS3ConfigProvider } from '../../config/aws-s3.config';
import { S3MultipartUploadOptions, S3UploadOptions } from './s3.interface';
import { S3Service } from './s3.service';

// Mock AWS SDK
// eslint-disable-next-line @typescript-eslint/no-var-requires
jest.mock('@aws-sdk/client-s3');
// eslint-disable-next-line @typescript-eslint/no-var-requires
jest.mock('@aws-sdk/lib-storage');
// eslint-disable-next-line @typescript-eslint/no-var-requires
jest.mock('@aws-sdk/s3-request-presigner');

const mockS3Client = {
  send: jest.fn(),
};

const mockUpload = {
  done: jest.fn(),
};

const mockGetSignedUrl = jest.fn();

describe('S3Service', () => {
  let service: S3Service;
  let config: any;

  beforeEach(async () => {
    jest.clearAllMocks();

    const configProvider = new AwsS3ConfigProvider();
    config = configProvider.getConfig();

    // Mock S3Client constructor
    // eslint-disable-next-line @typescript-eslint/no-var-requires, @typescript-eslint/no-require-imports
    const { S3Client } = require('@aws-sdk/client-s3');
    S3Client.mockImplementation(() => mockS3Client);

    // Mock Upload constructor
    // eslint-disable-next-line @typescript-eslint/no-var-requires, @typescript-eslint/no-require-imports
    const { Upload } = require('@aws-sdk/lib-storage');
    Upload.mockImplementation(() => mockUpload);

    // Mock getSignedUrl
    // eslint-disable-next-line @typescript-eslint/no-var-requires, @typescript-eslint/no-require-imports
    const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
    getSignedUrl.mockImplementation(mockGetSignedUrl);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        {
          provide: S3Service,
          useFactory: () => new S3Service(config),
        },
      ],
    }).compile();

    service = module.get<S3Service>(S3Service);
  });

  describe('Constructor', () => {
    it('should be defined', () => {
      expect(service).toBeDefined();
    });

    it('should initialize S3Client with correct configuration', () => {
      // eslint-disable-next-line @typescript-eslint/no-var-requires, @typescript-eslint/no-require-imports
      const { S3Client } = require('@aws-sdk/client-s3');
      expect(S3Client).toHaveBeenCalledWith({
        region: config.region,
        credentials: config.accessKeyId
          ? {
              accessKeyId: config.accessKeyId,
              secretAccessKey: config.secretAccessKey,
            }
          : undefined,
        endpoint: config.endpoint,
        forcePathStyle: config.forcePathStyle,
        ...(config.signatureVersion && { signatureVersion: config.signatureVersion }),
      });
    });
  });

  describe('generateUniqueKey', () => {
    it('should generate unique key without prefix and extension', () => {
      const key = service.generateUniqueKey();
      expect(key).toMatch(/^[a-f0-9-]+$/);
    });

    it('should generate unique key with prefix', () => {
      const key = service.generateUniqueKey('uploads');
      expect(key).toMatch(/^uploads\/[a-f0-9-]+$/);
    });

    it('should generate unique key with extension', () => {
      const key = service.generateUniqueKey(undefined, 'jpg');
      expect(key).toMatch(/^[a-f0-9-]+\.jpg$/);
    });

    it('should generate unique key with prefix and extension', () => {
      const key = service.generateUniqueKey('uploads', 'jpg');
      expect(key).toMatch(/^uploads\/[a-f0-9-]+\.jpg$/);
    });

    it('should handle extension with dot prefix', () => {
      const key = service.generateUniqueKey('uploads', '.jpg');
      expect(key).toMatch(/^uploads\/[a-f0-9-]+\.jpg$/);
    });
  });

  describe('validateFile', () => {
    it('should validate file buffer successfully', async () => {
      const buffer = Buffer.from('test content');
      const result = await service.validateFile(buffer, 'text/plain');
      expect(result.isValid).toBe(true);
    });

    it('should reject empty buffer', async () => {
      const buffer = Buffer.alloc(0);
      const result = await service.validateFile(buffer);
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('empty');
    });

    it('should reject oversized buffer', async () => {
      const largeBuffer = Buffer.alloc(config.maxFileSize + 1);
      const result = await service.validateFile(largeBuffer);
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('exceeds maximum');
    });

    it('should detect MIME type from file signature', async () => {
      const jpegBuffer = Buffer.from([0xff, 0xd8, 0xff, 0xe0]);
      const result = await service.validateFile(jpegBuffer);
      expect(result.isValid).toBe(true);
      expect(result.detectedMimeType).toBe('image/jpeg');
    });

    it('should reject MIME type mismatch', async () => {
      const jpegBuffer = Buffer.from([0xff, 0xd8, 0xff, 0xe0]);
      const result = await service.validateFile(jpegBuffer, 'image/png');
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('MIME type mismatch');
    });

    it('should reject disallowed MIME type', async () => {
      const originalAllowedTypes = service['config'].allowedMimeTypes;
      service['config'].allowedMimeTypes = ['image/jpeg'];

      const buffer = Buffer.from('test content');
      const result = await service.validateFile(buffer, 'application/pdf');
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('not allowed');

      // Restore original value
      service['config'].allowedMimeTypes = originalAllowedTypes;
    });
  });

  describe('uploadBuffer', () => {
    const mockUploadOptions: S3UploadOptions = {
      key: 'test-file.txt',
      contentType: 'text/plain',
    };

    it('should upload buffer successfully', async () => {
      const buffer = Buffer.from('test content');
      const mockSignedUrl = 'https://signed-url.com/test-file.txt';
      mockS3Client.send.mockResolvedValue({
        ETag: '"abc123"',
        VersionId: 'v1',
      });
      mockGetSignedUrl.mockResolvedValue(mockSignedUrl);

      const result = await service.uploadBuffer(buffer, mockUploadOptions);

      expect(result).toEqual({
        key: 'test-file.txt',
        etag: 'abc123',
        location: `https://${config.bucketName}.s3.${config.region}.amazonaws.com/test-file.txt`,
        bucket: config.bucketName,
        versionId: 'v1',
        size: 12,
        contentType: 'text/plain',
        uploadedAt: expect.any(Date),
        signedUrl: mockSignedUrl,
      });
    });

    it('should throw BadRequestException for invalid key', async () => {
      const buffer = Buffer.from('test content');
      const invalidOptions = { ...mockUploadOptions, key: '' };

      await expect(service.uploadBuffer(buffer, invalidOptions)).rejects.toThrow(InternalServerErrorException);
    });

    it('should throw BadRequestException for key with invalid characters', async () => {
      const buffer = Buffer.from('test content');
      const invalidOptions = { ...mockUploadOptions, key: '../test-file.txt' };

      await expect(service.uploadBuffer(buffer, invalidOptions)).rejects.toThrow(InternalServerErrorException);
    });

    it('should throw InternalServerErrorException on AWS error', async () => {
      const buffer = Buffer.from('test content');
      mockS3Client.send.mockRejectedValue(new Error('AWS Error'));

      await expect(service.uploadBuffer(buffer, mockUploadOptions)).rejects.toThrow(InternalServerErrorException);
    });
  });

  describe('uploadMulterFile', () => {
    it('should upload multer file successfully', async () => {
      const mockFile: Express.Multer.File = {
        buffer: Buffer.from('test content'),
        originalname: 'test.txt',
        mimetype: 'text/plain',
        fieldname: 'file',
        encoding: '7bit',
        size: 12,
        stream: new Readable(),
        destination: '',
        filename: '',
        path: '',
      };

      const mockSignedUrl = 'https://signed-url.com/test.txt';
      mockS3Client.send.mockResolvedValue({
        ETag: '"abc123"',
        VersionId: 'v1',
      });
      mockGetSignedUrl.mockResolvedValue(mockSignedUrl);

      const result = await service.uploadMulterFile(mockFile);

      expect(result.key).toMatch(/^test-uploads\/[a-f0-9-]+\.txt$/);
      expect(result.contentType).toBe('text/plain');
      expect(result.size).toBe(12);
      expect(result.signedUrl).toBe(mockSignedUrl);
    });
  });

  describe('uploadStream', () => {
    it('should upload stream successfully', async () => {
      const stream = new Readable();
      stream.push('test content');
      stream.push(null);

      const mockUploadOptions: S3UploadOptions = {
        key: 'test-stream.txt',
        contentType: 'text/plain',
      };

      const mockSignedUrl = 'https://signed-url.com/test-stream.txt';
      mockUpload.done.mockResolvedValue({
        ETag: '"abc123"',
        Location: 'https://bucket.s3.region.amazonaws.com/test-stream.txt',
        Bucket: 'test-bucket',
        VersionId: 'v1',
      });

      mockS3Client.send.mockResolvedValue({
        ContentLength: 12,
      });
      mockGetSignedUrl.mockResolvedValue(mockSignedUrl);

      const result = await service.uploadStream(stream, mockUploadOptions);

      expect(result.key).toBe('test-stream.txt');
      expect(result.etag).toBe('abc123');
      expect(result.size).toBe(12);
      expect(result.signedUrl).toBe(mockSignedUrl);
    });

    it('should throw InternalServerErrorException on upload error', async () => {
      const stream = new Readable();
      const mockUploadOptions: S3UploadOptions = {
        key: 'test-stream.txt',
      };

      mockUpload.done.mockRejectedValue(new Error('Upload Error'));

      await expect(service.uploadStream(stream, mockUploadOptions)).rejects.toThrow(InternalServerErrorException);
    });
  });

  describe('uploadFile', () => {
    it('should throw InternalServerErrorException for non-existent file', async () => {
      const mockUploadOptions: S3UploadOptions = {
        key: 'test-file.txt',
      };

      await expect(service.uploadFile('/non-existent-file.txt', mockUploadOptions)).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });

  describe('multipartUpload', () => {
    it('should perform multipart upload successfully', async () => {
      const buffer = Buffer.alloc(10 * 1024 * 1024); // 10MB
      const mockUploadOptions: S3MultipartUploadOptions = {
        key: 'large-file.bin',
        partSize: 5 * 1024 * 1024,
        queueSize: 4,
      };

      const mockSignedUrl = 'https://signed-url.com/large-file.bin';

      // Add delay to simulate upload time
      mockUpload.done.mockImplementation(
        () =>
          new Promise((resolve) =>
            setTimeout(
              () =>
                resolve({
                  ETag: '"abc123"',
                  Location: 'https://bucket.s3.region.amazonaws.com/large-file.bin',
                  Bucket: 'test-bucket',
                  VersionId: 'v1',
                }),
              10,
            ),
          ),
      );
      mockGetSignedUrl.mockResolvedValue(mockSignedUrl);

      const result = await service.multipartUpload(buffer, mockUploadOptions);

      expect(result.key).toBe('large-file.bin');
      expect(result.partsUploaded).toBe(2);
      expect(result.uploadDuration).toBeGreaterThanOrEqual(0);
      expect(result.signedUrl).toBe(mockSignedUrl);
    });
  });

  describe('getObject', () => {
    it('should get object as buffer successfully', async () => {
      const mockStream = new Readable();
      mockStream.push('test content');
      mockStream.push(null);

      mockS3Client.send.mockResolvedValue({
        Body: mockStream,
      });

      const result = await service.getObject({ key: 'test-file.txt' });

      expect(result).toBeInstanceOf(Buffer);
      expect(result.toString()).toBe('test content');
    });

    it('should throw InternalServerErrorException when no body returned', async () => {
      mockS3Client.send.mockResolvedValue({});

      await expect(service.getObject({ key: 'test-file.txt' })).rejects.toThrow(InternalServerErrorException);
    });

    it('should throw InternalServerErrorException on AWS error', async () => {
      mockS3Client.send.mockRejectedValue(new Error('AWS Error'));

      await expect(service.getObject({ key: 'test-file.txt' })).rejects.toThrow(InternalServerErrorException);
    });
  });

  describe('getObjectStream', () => {
    it('should get object as stream successfully', async () => {
      const mockStream = new Readable();
      mockS3Client.send.mockResolvedValue({
        Body: mockStream,
      });

      const result = await service.getObjectStream({ key: 'test-file.txt' });

      expect(result).toBe(mockStream);
    });

    it('should throw InternalServerErrorException when no body returned', async () => {
      mockS3Client.send.mockResolvedValue({});

      await expect(service.getObjectStream({ key: 'test-file.txt' })).rejects.toThrow(InternalServerErrorException);
    });
  });

  describe('getSignedUrl', () => {
    it('should generate signed URL successfully', async () => {
      const mockUrl = 'https://signed-url.com';
      mockGetSignedUrl.mockResolvedValue(mockUrl);

      const result = await service.getSignedUrl({ key: 'test-file.txt' });

      expect(result).toBe(mockUrl);
      expect(mockGetSignedUrl).toHaveBeenCalled();
    });

    it('should use custom expiration time', async () => {
      const mockUrl = 'https://signed-url.com';
      mockGetSignedUrl.mockResolvedValue(mockUrl);

      await service.getSignedUrl({ key: 'test-file.txt', expiresIn: 3600 });

      expect(mockGetSignedUrl).toHaveBeenCalledWith(mockS3Client, expect.any(Object), { expiresIn: 3600 });
    });

    it('should throw InternalServerErrorException on error', async () => {
      mockGetSignedUrl.mockRejectedValue(new Error('Signing Error'));

      await expect(service.getSignedUrl({ key: 'test-file.txt' })).rejects.toThrow(InternalServerErrorException);
    });
  });

  describe('getSignedUploadUrl', () => {
    it('should generate signed upload URL successfully', async () => {
      const mockUrl = 'https://signed-upload-url.com';
      mockGetSignedUrl.mockResolvedValue(mockUrl);

      const result = await service.getSignedUploadUrl('test-file.txt', 'text/plain', 3600);

      expect(result).toBe(mockUrl);
    });

    it('should use default expiration time', async () => {
      const mockUrl = 'https://signed-upload-url.com';
      mockGetSignedUrl.mockResolvedValue(mockUrl);

      await service.getSignedUploadUrl('test-file.txt');

      expect(mockGetSignedUrl).toHaveBeenCalledWith(mockS3Client, expect.any(Object), {
        expiresIn: config.urlExpirationTime,
      });
    });
  });

  describe('deleteObject', () => {
    it('should delete object successfully', async () => {
      mockS3Client.send.mockResolvedValue({
        VersionId: 'v1',
      });

      const result = await service.deleteObject({ key: 'test-file.txt' });

      expect(result).toEqual({
        key: 'test-file.txt',
        deleted: true,
        versionId: 'v1',
        deletedAt: expect.any(Date),
      });
    });

    it('should throw InternalServerErrorException on AWS error', async () => {
      mockS3Client.send.mockRejectedValue(new Error('AWS Error'));

      await expect(service.deleteObject({ key: 'test-file.txt' })).rejects.toThrow(InternalServerErrorException);
    });
  });

  describe('batchDeleteObjects', () => {
    it('should return empty result for empty keys array', async () => {
      const result = await service.batchDeleteObjects({ keys: [] });

      expect(result).toEqual({ deleted: [], errors: [] });
    });

    it('should batch delete objects successfully', async () => {
      const keys = [{ key: 'file1.txt' }, { key: 'file2.txt' }];
      mockS3Client.send.mockResolvedValue({
        Deleted: [
          { Key: 'file1.txt', VersionId: 'v1' },
          { Key: 'file2.txt', VersionId: 'v2' },
        ],
        Errors: [],
      });

      const result = await service.batchDeleteObjects({ keys });

      expect(result.deleted).toHaveLength(2);
      expect(result.errors).toHaveLength(0);
    });

    it('should handle batch delete with errors', async () => {
      const keys = [{ key: 'file1.txt' }, { key: 'file2.txt' }];
      mockS3Client.send.mockResolvedValue({
        Deleted: [{ Key: 'file1.txt', VersionId: 'v1' }],
        Errors: [{ Key: 'file2.txt', Code: 'NoSuchKey', Message: 'The specified key does not exist.' }],
      });

      const result = await service.batchDeleteObjects({ keys });

      expect(result.deleted).toHaveLength(1);
      expect(result.errors).toHaveLength(1);
    });

    it('should throw BadRequestException for too many objects', async () => {
      const keys = Array.from({ length: 1001 }, (_, i) => ({ key: `file${i}.txt` }));

      await expect(service.batchDeleteObjects({ keys })).rejects.toThrow(InternalServerErrorException);
    });
  });

  describe('headObject', () => {
    it('should get object metadata successfully', async () => {
      mockS3Client.send.mockResolvedValue({
        ContentLength: 12,
        LastModified: new Date(),
        ETag: '"abc123"',
        ContentType: 'text/plain',
        Metadata: { custom: 'value' },
        VersionId: 'v1',
        StorageClass: 'STANDARD',
      });

      const result = await service.headObject('test-file.txt');

      expect(result.exists).toBe(true);
      expect(result.size).toBe(12);
      expect(result.etag).toBe('abc123');
    });

    it('should return exists false for non-existent object', async () => {
      const error: any = new Error('NotFound');
      error.name = 'NotFound';
      mockS3Client.send.mockRejectedValue(error);

      const result = await service.headObject('non-existent-file.txt');

      expect(result.exists).toBe(false);
    });

    it('should return exists false for 404 error', async () => {
      const error: any = new Error('NotFound');
      error.$metadata = { httpStatusCode: 404 };
      mockS3Client.send.mockRejectedValue(error);

      const result = await service.headObject('non-existent-file.txt');

      expect(result.exists).toBe(false);
    });

    it('should throw InternalServerErrorException for other errors', async () => {
      mockS3Client.send.mockRejectedValue(new Error('AWS Error'));

      await expect(service.headObject('test-file.txt')).rejects.toThrow(InternalServerErrorException);
    });
  });

  describe('listObjects', () => {
    it('should list objects successfully', async () => {
      mockS3Client.send.mockResolvedValue({
        Contents: [
          {
            Key: 'file1.txt',
            Size: 10,
            LastModified: new Date(),
            ETag: '"abc123"',
            StorageClass: 'STANDARD',
          },
        ],
        IsTruncated: false,
        KeyCount: 1,
        MaxKeys: 1000,
      });

      const result = await service.listObjects();

      expect(result.objects).toHaveLength(1);
      expect(result.objects[0].key).toBe('file1.txt');
      expect(result.isTruncated).toBe(false);
    });

    it('should list objects with options', async () => {
      mockS3Client.send.mockResolvedValue({
        Contents: [],
        IsTruncated: false,
        KeyCount: 0,
        MaxKeys: 50,
        Prefix: 'uploads/',
      });

      const result = await service.listObjects({
        prefix: 'uploads/',
        maxKeys: 50,
      });

      expect(result.prefix).toBe('uploads/');
      expect(result.maxKeys).toBe(50);
    });

    it('should throw InternalServerErrorException on AWS error', async () => {
      mockS3Client.send.mockRejectedValue(new Error('AWS Error'));

      await expect(service.listObjects()).rejects.toThrow(InternalServerErrorException);
    });
  });

  describe('copyObject', () => {
    it('should copy object successfully', async () => {
      mockS3Client.send.mockResolvedValue({
        CopyObjectResult: {
          ETag: '"abc123"',
          LastModified: new Date(),
        },
        VersionId: 'v1',
      });

      const result = await service.copyObject({
        sourceKey: 'source-file.txt',
        destinationKey: 'dest-file.txt',
      });

      expect(result.key).toBe('dest-file.txt');
      expect(result.etag).toBe('abc123');
    });

    it('should copy object with custom source bucket', async () => {
      mockS3Client.send.mockResolvedValue({
        CopyObjectResult: {
          ETag: '"abc123"',
          LastModified: new Date(),
        },
      });

      await service.copyObject({
        sourceKey: 'source-file.txt',
        destinationKey: 'dest-file.txt',
        sourceBucket: 'other-bucket',
      });

      expect(mockS3Client.send).toHaveBeenCalled();
    });

    it('should throw InternalServerErrorException on AWS error', async () => {
      mockS3Client.send.mockRejectedValue(new Error('AWS Error'));

      await expect(
        service.copyObject({
          sourceKey: 'source-file.txt',
          destinationKey: 'dest-file.txt',
        }),
      ).rejects.toThrow(InternalServerErrorException);
    });
  });

  describe('objectExists', () => {
    it('should return true for existing object', async () => {
      mockS3Client.send.mockResolvedValue({
        ContentLength: 12,
      });

      const result = await service.objectExists('test-file.txt');

      expect(result).toBe(true);
    });

    it('should return false for non-existent object', async () => {
      const error: any = new Error('NotFound');
      error.name = 'NotFound';
      mockS3Client.send.mockRejectedValue(error);

      const result = await service.objectExists('non-existent-file.txt');

      expect(result).toBe(false);
    });
  });

  describe('ensureBucketExists', () => {
    it('should return true for existing bucket', async () => {
      mockS3Client.send.mockResolvedValue({});

      const result = await service.ensureBucketExists();

      expect(result).toBe(true);
    });

    it('should create bucket if not exists', async () => {
      const error: any = new Error('NotFound');
      error.name = 'NotFound';

      mockS3Client.send.mockRejectedValueOnce(error).mockResolvedValueOnce({});

      const result = await service.ensureBucketExists();

      expect(result).toBe(true);
      expect(mockS3Client.send).toHaveBeenCalledTimes(2);
    });

    it('should create bucket with location constraint for non-us-east-1 regions', async () => {
      const error: any = new Error('NotFound');
      error.$metadata = { httpStatusCode: 404 };

      const originalRegion = service['config'].region;
      service['config'].region = 'eu-west-1';

      mockS3Client.send.mockRejectedValueOnce(error).mockResolvedValueOnce({});

      await service.ensureBucketExists();

      expect(mockS3Client.send).toHaveBeenCalledTimes(2);

      // Restore original value
      service['config'].region = originalRegion;
    });

    it('should throw InternalServerErrorException on creation error', async () => {
      const notFoundError: any = new Error('NotFound');
      notFoundError.name = 'NotFound';
      const creationError = new Error('Creation Error');

      mockS3Client.send.mockRejectedValueOnce(notFoundError).mockRejectedValueOnce(creationError);

      await expect(service.ensureBucketExists()).rejects.toThrow(InternalServerErrorException);
    });

    it('should throw InternalServerErrorException on head bucket error', async () => {
      mockS3Client.send.mockRejectedValue(new Error('AWS Error'));

      await expect(service.ensureBucketExists()).rejects.toThrow(InternalServerErrorException);
    });
  });

  describe('getBucketPolicy', () => {
    it('should get bucket policy successfully', async () => {
      const mockPolicy = { Version: '2012-10-17', Statement: [] };
      mockS3Client.send.mockResolvedValue({
        Policy: JSON.stringify(mockPolicy),
      });

      const result = await service.getBucketPolicy();

      expect(result).toEqual(mockPolicy);
    });

    it('should return null for no bucket policy', async () => {
      const error: any = new Error('NoSuchBucketPolicy');
      error.name = 'NoSuchBucketPolicy';
      mockS3Client.send.mockRejectedValue(error);

      const result = await service.getBucketPolicy();

      expect(result).toBeNull();
    });

    it('should return null when policy is empty', async () => {
      mockS3Client.send.mockResolvedValue({});

      const result = await service.getBucketPolicy();

      expect(result).toBeNull();
    });

    it('should throw InternalServerErrorException on AWS error', async () => {
      mockS3Client.send.mockRejectedValue(new Error('AWS Error'));

      await expect(service.getBucketPolicy()).rejects.toThrow(InternalServerErrorException);
    });
  });

  describe('setBucketPolicy', () => {
    it('should set bucket policy successfully', async () => {
      const mockPolicy = { Version: '2012-10-17', Statement: [] };
      mockS3Client.send.mockResolvedValue({});

      await service.setBucketPolicy(mockPolicy);

      expect(mockS3Client.send).toHaveBeenCalled();
    });

    it('should throw InternalServerErrorException on AWS error', async () => {
      const mockPolicy = { Version: '2012-10-17', Statement: [] };
      mockS3Client.send.mockRejectedValue(new Error('AWS Error'));

      await expect(service.setBucketPolicy(mockPolicy)).rejects.toThrow(InternalServerErrorException);
    });
  });

  describe('Private Methods', () => {
    describe('validateUploadOptions', () => {
      it('should throw BadRequestException for empty key', () => {
        expect(() => service['validateUploadOptions']({ key: '' })).toThrow(BadRequestException);
      });

      it('should throw BadRequestException for key with double dots', () => {
        expect(() => service['validateUploadOptions']({ key: '../test.txt' })).toThrow(BadRequestException);
      });

      it('should throw BadRequestException for key starting with slash', () => {
        expect(() => service['validateUploadOptions']({ key: '/test.txt' })).toThrow(BadRequestException);
      });
    });

    describe('formatTagsAsString', () => {
      it('should format tags as URL encoded string', () => {
        const tags = { key1: 'value1', key2: 'value 2' };
        const result = service['formatTagsAsString'](tags);
        expect(result).toBe('key1=value1&key2=value%202');
      });
    });

    describe('detectMimeType', () => {
      it('should detect JPEG MIME type', () => {
        const buffer = Buffer.from([0xff, 0xd8, 0xff, 0xe0]);
        const result = service['detectMimeType'](buffer);
        expect(result).toBe('image/jpeg');
      });

      it('should detect PNG MIME type', () => {
        const buffer = Buffer.from([0x89, 0x50, 0x4e, 0x47]);
        const result = service['detectMimeType'](buffer);
        expect(result).toBe('image/png');
      });

      it('should detect PDF MIME type', () => {
        const buffer = Buffer.from([0x25, 0x50, 0x44, 0x46]);
        const result = service['detectMimeType'](buffer);
        expect(result).toBe('application/pdf');
      });

      it('should return undefined for unknown file type', () => {
        const buffer = Buffer.from([0x00, 0x00, 0x00, 0x00]);
        const result = service['detectMimeType'](buffer);
        expect(result).toBeUndefined();
      });

      it('should detect GIF MIME type', () => {
        const buffer = Buffer.from([0x47, 0x49, 0x46, 0x38]);
        const result = service['detectMimeType'](buffer);
        expect(result).toBe('image/gif');
      });

      it('should detect WebP MIME type', () => {
        const buffer = Buffer.from([0x52, 0x49, 0x46, 0x46]);
        const result = service['detectMimeType'](buffer);
        expect(result).toBe('image/webp');
      });

      it('should detect ZIP MIME type (0304)', () => {
        const buffer = Buffer.from([0x50, 0x4b, 0x03, 0x04]);
        const result = service['detectMimeType'](buffer);
        expect(result).toBe('application/zip');
      });

      it('should detect ZIP MIME type (0506)', () => {
        const buffer = Buffer.from([0x50, 0x4b, 0x05, 0x06]);
        const result = service['detectMimeType'](buffer);
        expect(result).toBe('application/zip');
      });

      it('should detect ZIP MIME type (0708)', () => {
        const buffer = Buffer.from([0x50, 0x4b, 0x07, 0x08]);
        const result = service['detectMimeType'](buffer);
        expect(result).toBe('application/zip');
      });
    });

    describe('serializeError', () => {
      it('should return unknown error message for null error', () => {
        const result = service['serializeError'](null);
        expect(result).toEqual({ message: 'Unknown error' });
      });

      it('should return unknown error message for undefined error', () => {
        const result = service['serializeError'](undefined);
        expect(result).toEqual({ message: 'Unknown error' });
      });

      it('should serialize basic error with message and name', () => {
        const error = new Error('Test error');
        const result = service['serializeError'](error);

        expect(result.message).toBe('Test error');
        expect(result.name).toBe('Error');
        expect(result.stack).toBeDefined();
      });

      it('should include AWS SDK metadata when present', () => {
        const awsError: any = new Error('AWS Error');
        awsError.$metadata = {
          httpStatusCode: 403,
          requestId: 'test-request-id',
          attempts: 3,
          totalRetryDelay: 1000,
        };

        const result = service['serializeError'](awsError);

        expect(result.message).toBe('AWS Error');
        expect(result.httpStatusCode).toBe(403);
        expect(result.requestId).toBe('test-request-id');
        expect(result.attempts).toBe(3);
        expect(result.totalRetryDelay).toBe(1000);
      });

      it('should include error Code (uppercase) when present', () => {
        const errorWithCode: any = new Error('Access denied');
        errorWithCode.Code = 'AccessDenied';

        const result = service['serializeError'](errorWithCode);

        expect(result.message).toBe('Access denied');
        expect(result.code).toBe('AccessDenied');
      });

      it('should include error code (lowercase) when present', () => {
        const errorWithCode: any = new Error('Access denied');
        errorWithCode.code = 'ECONNREFUSED';

        const result = service['serializeError'](errorWithCode);

        expect(result.message).toBe('Access denied');
        expect(result.code).toBe('ECONNREFUSED');
      });

      it('should truncate stack trace to first 5 lines', () => {
        const error = new Error('Test error');

        const result = service['serializeError'](error);

        const stackLines = result.stack.split('\n');
        expect(stackLines.length).toBeLessThanOrEqual(5);
      });

      it('should handle error without stack trace', () => {
        const errorWithoutStack = { message: 'No stack', name: 'CustomError' };

        const result = service['serializeError'](errorWithoutStack);

        expect(result.message).toBe('No stack');
        expect(result.name).toBe('CustomError');
        expect(result.stack).toBeUndefined();
      });

      it('should use default message when error.message is empty', () => {
        const errorWithoutMessage = { name: 'EmptyError' };

        const result = service['serializeError'](errorWithoutMessage);

        expect(result.message).toBe('Unknown error');
        expect(result.name).toBe('EmptyError');
      });

      it('should use default name when error.name is empty', () => {
        const errorWithoutName = { message: 'Test message' };

        const result = service['serializeError'](errorWithoutName);

        expect(result.message).toBe('Test message');
        expect(result.name).toBe('Error');
      });
    });
  });
});
