import {
  BucketLocationConstraint,
  CopyObjectCommand,
  CopyObjectCommandInput,
  CreateBucketCommand,
  DeleteObjectCommand,
  DeleteObjectCommandInput,
  DeleteObjectsCommand,
  DeleteObjectsCommandInput,
  GetBucketPolicyCommand,
  GetObjectCommand,
  GetObjectCommandInput,
  HeadBucketCommand,
  HeadObjectCommand,
  HeadObjectCommandInput,
  ListObjectsV2Command,
  ListObjectsV2CommandInput,
  PutBucketPolicyCommand,
  PutObjectCommand,
  PutObjectCommandInput,
  S3Client,
  ServerSideEncryption,
  StorageClass,
} from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { BadRequestException, Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import * as crypto from 'crypto';
import { createReadStream, statSync } from 'fs';
import { DateTime } from 'luxon';
import { Readable } from 'stream';
import { v4 as uuidv4 } from 'uuid';
import { AwsS3Config } from '../../config/aws-s3.config';
import {
  IS3Service,
  S3BatchDeleteOptions,
  S3BatchDeleteResult,
  S3CopyObjectOptions,
  S3CopyObjectResult,
  S3DeleteOptions,
  S3DeleteResult,
  S3GetObjectOptions,
  S3GetUrlOptions,
  S3HeadObjectResult,
  S3ListObjectsOptions,
  S3ListObjectsResult,
  S3MultipartUploadOptions,
  S3MultipartUploadResult,
  S3ObjectInfo,
  S3UploadOptions,
  S3UploadResult,
} from './s3.interface';

@Injectable()
export class S3Service implements IS3Service {
  private readonly logger = new Logger(S3Service.name);
  private readonly s3Client: S3Client;
  private readonly config: AwsS3Config;

  constructor(config: AwsS3Config) {
    this.config = config;

    /**
     * Initialize AWS S3 Client with comprehensive configuration
     *
     * This creates a new S3Client instance that handles all communication with AWS S3.
     * The client is configured with:
     *
     * - region: AWS region where the S3 bucket is located (e.g., 'us-east-1', 'eu-west-1')
     *   This determines the physical location of your data and affects latency and compliance
     *   This is the region of the S3 bucket
     *
     * - credentials: AWS access credentials for authentication
     *   This is the access key and secret key for the AWS account
     *   - accessKeyId: AWS IAM user access key with S3 permissions
     *   - secretAccessKey: Corresponding secret key for the access key
     *   These credentials must have appropriate S3 permissions (GetObject, PutObject, DeleteObject, etc.)
     *
     * - endpoint: Optional custom S3 endpoint URL
     *   If not specified, uses the default AWS S3 endpoint for the region
     *
     * - forcePathStyle: Controls URL format for S3 requests
     *   true: Uses path-style URLs (https://s3.region.amazonaws.com/bucket/key)
     *   false: Uses virtual-hosted style URLs (https://bucket.s3.region.amazonaws.com/key)
     *   Required for some S3-compatible services and local development
     *
     * - signatureVersion: AWS signature version for request signing
     *   Defaults to 'v4' which is the current standard for AWS API requests
     *   Ensures requests are properly authenticated and haven't been tampered with
     */
    this.s3Client = new S3Client({
      region: this.config.region,
      credentials: this.config.accessKeyId
        ? {
            accessKeyId: this.config.accessKeyId,
            secretAccessKey: this.config.secretAccessKey,
          }
        : undefined, // if running in ECS with task role, SDK picks creds automatically,
      endpoint: this.config.endpoint,
      forcePathStyle: this.config.forcePathStyle,
      ...(this.config.signatureVersion && { signatureVersion: this.config.signatureVersion }),
    });

    this.logger.log(`S3Service initialized for bucket: ${this.config.bucketName} in region: ${this.config.region}`);
  }

  /**
   * Upload buffer to S3
   *
   * This method uploads a Buffer (binary data in memory) directly to AWS S3.
   * It performs comprehensive validation, security checks, and configures
   * all necessary S3 object properties for secure and efficient storage.
   *
   *
   * @param buffer - The binary data to upload (file content in memory)
   * @param options - Upload configuration including key, content type, metadata, etc.
   * @returns Promise<S3UploadResult> - Detailed result with location, etag, size, etc.
   * @throws BadRequestException - For validation errors (invalid key, oversized file, etc.)
   * @throws InternalServerErrorException - For AWS S3 errors (permissions, network, etc.)
   */
  async uploadBuffer(buffer: Buffer, options: S3UploadOptions): Promise<S3UploadResult> {
    const startTime = Date.now();
    this.logger.log(`[uploadBuffer] Starting upload for key: ${options.key}, size: ${buffer.length} bytes`);

    try {
      // Validate upload options (key format, required fields, security checks)
      this.logger.debug(`[uploadBuffer] Validating upload options for key: ${options.key}`);
      this.validateUploadOptions(options);
      this.logger.debug(`[uploadBuffer] Upload options validated for key: ${options.key}`);

      // Validate file content (size, MIME type, file signature detection)
      this.logger.debug(`[uploadBuffer] Validating file content for key: ${options.key}`);
      const validationResult = await this.validateFile(buffer, options.contentType);
      this.logger.debug(
        `[uploadBuffer] File validation result for key: ${options.key}, isValid: ${validationResult.isValid}, detectedMimeType: ${validationResult.detectedMimeType}`,
      );

      if (!validationResult.isValid) {
        this.logger.warn(
          `[uploadBuffer] File validation failed for key: ${options.key}, error: ${validationResult.error}`,
        );
        throw new BadRequestException(validationResult.error || 'File validation failed');
      }

      /**
       * Configure S3 PutObject parameters
       */
      this.logger.debug(`[uploadBuffer] Preparing PutObject params for key: ${options.key}`);
      const putObjectParams: PutObjectCommandInput = {
        Bucket: this.config.bucketName,
        Key: options.key,
        Body: buffer,
        ContentType: options.contentType || 'application/octet-stream',
        Metadata: options.metadata,
        Tagging: options.tags ? this.formatTagsAsString(options.tags) : undefined,
        CacheControl: options.cacheControl,
        Expires: options.expires,
        StorageClass: options.storageClass as StorageClass,
        ServerSideEncryption:
          this.config.enableEncryption && options.enableEncryption !== false
            ? (this.config.encryptionAlgorithm as ServerSideEncryption)
            : undefined,
        ACL: options.isPublic ? 'public-read' : 'private',
      };

      this.logger.debug(
        `[uploadBuffer] PutObject params prepared - bucket: ${putObjectParams.Bucket}, key: ${putObjectParams.Key}, contentType: ${putObjectParams.ContentType}`,
      );

      // Create and execute the S3 PutObject command
      this.logger.debug(`[uploadBuffer] Sending PutObject command to S3 for key: ${options.key}`);
      const command = new PutObjectCommand(putObjectParams);

      let result;
      try {
        result = await this.s3Client.send(command);
        this.logger.debug(`[uploadBuffer] S3 PutObject successful for key: ${options.key}, ETag: ${result.ETag}`);
      } catch (s3Error) {
        this.logger.error(
          `[uploadBuffer] S3 PutObject failed for key: ${options.key}, error: ${s3Error.message}`,
          'S3Service',
        );
        const serializedError = this.serializeError(s3Error);
        this.logger.error(
          `[uploadBuffer] S3 PutObject failed for key: ${options.key}, error: ${JSON.stringify(serializedError)}`,
        );
        throw s3Error;
      }

      // Generate pre-signed URL for accessing the uploaded object
      this.logger.debug(`[uploadBuffer] Generating signed URL for key: ${options.key}`);
      let signedUrl: string;
      try {
        signedUrl = await this.getSignedUrl({ key: options.key });
        this.logger.debug(`[uploadBuffer] Signed URL generated successfully for key: ${options.key}`);
      } catch (signedUrlError) {
        this.logger.error(
          `[uploadBuffer] Failed to generate signed URL for key: ${options.key}, error: ${signedUrlError.message}`,
          'S3Service',
        );
        const serializedError = this.serializeError(signedUrlError);
        this.logger.error(
          `[uploadBuffer] Failed to generate signed URL for key: ${options.key}, error: ${JSON.stringify(serializedError)}`,
        );
        throw signedUrlError;
      }

      /**
       * Build comprehensive upload result
       */
      const uploadResult: S3UploadResult = {
        key: options.key,
        etag: result.ETag?.replaceAll('"', '') || '',
        location: `https://${this.config.bucketName}.s3.${this.config.region}.amazonaws.com/${options.key}`,
        bucket: this.config.bucketName,
        versionId: result.VersionId,
        size: buffer.length,
        contentType: options.contentType || 'application/octet-stream',
        uploadedAt: DateTime.now().toJSDate(),
        signedUrl,
      };

      const duration = Date.now() - startTime;
      this.logger.log(
        `[uploadBuffer] Successfully uploaded buffer to S3: ${options.key} (${buffer.length} bytes) in ${duration}ms`,
      );
      return uploadResult;
    } catch (error) {
      this.logger.error(
        `[uploadBuffer] Failed to upload buffer to S3: ${options.key}, error: ${error.message}`,
        'S3Service',
      );
      const duration = Date.now() - startTime;
      const serializedError = this.serializeError(error);
      this.logger.error(
        `[uploadBuffer] Failed to upload buffer to S3: ${options.key}, duration: ${duration}ms, error: ${JSON.stringify(serializedError)}`,
      );
      throw new InternalServerErrorException(`Failed to upload file: ${error.message}`);
    }
  }

  async uploadMulterFile(file: Express.Multer.File, options?: S3UploadOptions) {
    const { buffer, originalname, mimetype } = file;

    this.logger.log(
      `[uploadMulterFile] Starting multer file upload - originalName: ${originalname}, size: ${buffer.length}, mimetype: ${mimetype}`,
    );

    // Generate unique key using S3Service method
    const key = this.generateUniqueKey('test-uploads', originalname.split('.').pop());
    this.logger.debug(`[uploadMulterFile] Generated key: ${key}`);

    try {
      // Upload buffer using S3Service uploadBuffer method
      const result = await this.uploadBuffer(buffer, {
        key,
        contentType: mimetype,
        metadata: {
          originalName: originalname,
          uploadedAt: new Date().toISOString(),
          fileSize: buffer.length.toString(),
        },
        tags: {
          category: 'test-upload',
          source: 's3-bucket-test',
        },
        ...options,
      });

      this.logger.log(`[uploadMulterFile] Successfully uploaded multer file: ${originalname} as ${key}`);
      return result;
    } catch (error) {
      const serializedError = this.serializeError(error);
      this.logger.error(
        `[uploadMulterFile] Failed to upload multer file: ${originalname}, error: ${JSON.stringify(serializedError)}`,
      );
      throw error;
    }
  }

  /**
   * Upload stream to S3
   *
   * This method uploads a Readable stream (file content in memory) directly to AWS S3.
   * It performs comprehensive validation, security checks, and configures
   * all necessary S3 object properties for secure and efficient storage.
   *
   *
   * @param stream - The readable stream to upload (file content in memory)
   * @param options - Upload configuration including key, content type, metadata, etc.
   * @returns Promise<S3UploadResult> - Detailed result with location, etag, size, etc.
   * @throws BadRequestException - For validation errors (invalid key, oversized file, etc.)
   * @throws InternalServerErrorException - For AWS S3 errors (permissions, network, etc.)
   */
  async uploadStream(stream: Readable, options: S3UploadOptions): Promise<S3UploadResult> {
    const startTime = Date.now();
    this.logger.log(`[uploadStream] Starting stream upload for key: ${options.key}`);

    try {
      // Validate upload options (key format, required fields, security checks)
      this.logger.debug(`[uploadStream] Validating upload options for key: ${options.key}`);
      this.validateUploadOptions(options);

      /**
       * Configure S3 Upload parameters
       */
      this.logger.debug(`[uploadStream] Preparing Upload params for key: ${options.key}`);
      const upload = new Upload({
        client: this.s3Client,
        params: {
          Bucket: this.config.bucketName,
          Key: options.key,
          Body: stream,
          ContentType: options.contentType || 'application/octet-stream',
          Metadata: options.metadata,
          Tagging: options.tags ? this.formatTagsAsString(options.tags) : undefined,
          CacheControl: options.cacheControl,
          Expires: options.expires,
          StorageClass: options.storageClass as StorageClass,
          ServerSideEncryption:
            this.config.enableEncryption && options.enableEncryption !== false
              ? (this.config.encryptionAlgorithm as ServerSideEncryption)
              : undefined,
          ACL: options.isPublic ? 'public-read' : 'private',
        },
      });

      this.logger.debug(`[uploadStream] Executing upload for key: ${options.key}`);
      const result = await upload.done();
      this.logger.debug(`[uploadStream] Upload completed for key: ${options.key}, ETag: ${result.ETag}`);

      // Get file size
      this.logger.debug(`[uploadStream] Getting file size for key: ${options.key}`);
      const headResult = await this.headObject(options.key);
      const size = headResult.size || 0;

      // Generate pre-signed URL for accessing the uploaded object
      this.logger.debug(`[uploadStream] Generating signed URL for key: ${options.key}`);
      const signedUrl = await this.getSignedUrl({ key: options.key });

      const uploadResult: S3UploadResult = {
        key: options.key,
        etag: result.ETag?.replaceAll('"', '') || '',
        location:
          result.Location || `https://${this.config.bucketName}.s3.${this.config.region}.amazonaws.com/${options.key}`,
        bucket: result.Bucket || this.config.bucketName,
        versionId: result.VersionId,
        size,
        contentType: options.contentType || 'application/octet-stream',
        uploadedAt: new Date(),
        signedUrl,
      };

      const duration = Date.now() - startTime;
      this.logger.log(
        `[uploadStream] Successfully uploaded stream to S3: ${options.key} (${size} bytes) in ${duration}ms`,
      );
      return uploadResult;
    } catch (error) {
      const duration = Date.now() - startTime;
      const serializedError = this.serializeError(error);
      this.logger.error(
        `[uploadStream] Failed to upload stream to S3: ${options.key}, duration: ${duration}ms, error: ${JSON.stringify(serializedError)}`,
      );
      throw new InternalServerErrorException(`Failed to upload stream: ${error.message}`);
    }
  }

  /**
   * Upload file from path to S3
   */
  async uploadFile(filePath: string, options: S3UploadOptions): Promise<S3UploadResult> {
    const startTime = Date.now();
    this.logger.log(`[uploadFile] Starting file upload from path: ${filePath}, key: ${options.key}`);

    try {
      this.logger.debug(`[uploadFile] Validating upload options for path: ${filePath}`);
      this.validateUploadOptions(options);

      this.logger.debug(`[uploadFile] Getting file stats for path: ${filePath}`);
      const stats = statSync(filePath);
      this.logger.debug(`[uploadFile] File size: ${stats.size} bytes`);

      if (stats.size > this.config.maxFileSize) {
        this.logger.warn(
          `[uploadFile] File size exceeds limit: ${stats.size} > ${this.config.maxFileSize} bytes, path: ${filePath}`,
        );
        throw new BadRequestException(`File size exceeds maximum allowed size of ${this.config.maxFileSize} bytes`);
      }

      this.logger.debug(`[uploadFile] Creating read stream for path: ${filePath}`);
      const stream = createReadStream(filePath);
      return this.uploadStream(stream, options);
    } catch (error) {
      const duration = Date.now() - startTime;
      const serializedError = this.serializeError(error);
      this.logger.error(
        `[uploadFile] Failed to upload file to S3: ${filePath}, duration: ${duration}ms, error: ${JSON.stringify(serializedError)}`,
      );
      throw new InternalServerErrorException(`Failed to upload file: ${error.message}`);
    }
  }

  /**
   * Multipart upload for large files
   */
  async multipartUpload(buffer: Buffer, options: S3MultipartUploadOptions): Promise<S3MultipartUploadResult> {
    const startTime = Date.now();
    this.logger.log(
      `[multipartUpload] Starting multipart upload for key: ${options.key}, size: ${buffer.length} bytes`,
    );

    try {
      this.logger.debug(`[multipartUpload] Validating upload options for key: ${options.key}`);
      this.validateUploadOptions(options);

      this.logger.debug(`[multipartUpload] Validating file content for key: ${options.key}`);
      const validationResult = await this.validateFile(buffer, options.contentType);
      if (!validationResult.isValid) {
        this.logger.warn(
          `[multipartUpload] File validation failed for key: ${options.key}, error: ${validationResult.error}`,
        );
        throw new BadRequestException(validationResult.error || 'File validation failed');
      }

      /*
        Configure S3 Upload parameters
      */
      const partSize = options.partSize || 5 * 1024 * 1024;
      const queueSize = options.queueSize || 4;
      this.logger.debug(
        `[multipartUpload] Preparing multipart upload - partSize: ${partSize}, queueSize: ${queueSize}`,
      );

      const upload = new Upload({
        client: this.s3Client,
        params: {
          Bucket: this.config.bucketName,
          Key: options.key,
          Body: buffer,
          ContentType: options.contentType || 'application/octet-stream',
          Metadata: options.metadata,
          Tagging: options.tags ? this.formatTagsAsString(options.tags) : undefined,
          CacheControl: options.cacheControl,
          Expires: options.expires,
          StorageClass: options.storageClass as StorageClass,
          ServerSideEncryption:
            this.config.enableEncryption && options.enableEncryption !== false
              ? (this.config.encryptionAlgorithm as ServerSideEncryption)
              : undefined,
          ACL: options.isPublic ? 'public-read' : 'private',
        },
        partSize,
        queueSize,
      });

      this.logger.debug(`[multipartUpload] Executing multipart upload for key: ${options.key}`);
      const result = await upload.done();
      this.logger.debug(`[multipartUpload] Multipart upload completed for key: ${options.key}, ETag: ${result.ETag}`);

      const endTime = DateTime.now().toMillis();

      // Calculate number of parts
      const partsUploaded = Math.ceil(buffer.length / partSize);

      // Generate pre-signed URL for accessing the uploaded object
      this.logger.debug(`[multipartUpload] Generating signed URL for key: ${options.key}`);
      const signedUrl = await this.getSignedUrl({ key: options.key });

      const uploadResult: S3MultipartUploadResult = {
        key: options.key,
        etag: result.ETag?.replaceAll('"', '') || '',
        location:
          result.Location || `https://${this.config.bucketName}.s3.${this.config.region}.amazonaws.com/${options.key}`,
        bucket: result.Bucket || this.config.bucketName,
        versionId: result.VersionId,
        size: buffer.length,
        contentType: options.contentType || 'application/octet-stream',
        uploadedAt: DateTime.now().toJSDate(),
        signedUrl,
        partsUploaded,
        uploadDuration: endTime - startTime,
      };

      this.logger.log(
        `[multipartUpload] Successfully completed multipart upload: ${options.key} (${partsUploaded} parts, ${endTime - startTime}ms)`,
      );
      return uploadResult;
    } catch (error) {
      const duration = Date.now() - startTime;
      const serializedError = this.serializeError(error);
      this.logger.error(
        `[multipartUpload] Failed multipart upload: ${options.key}, duration: ${duration}ms, error: ${JSON.stringify(serializedError)}`,
      );
      throw new InternalServerErrorException(`Failed multipart upload: ${error.message}`);
    }
  }

  /**
   * Get object as buffer
   *
   * This method retrieves an object from AWS S3 as a Buffer (binary data in memory).
   *
   * @param options - GetObject configuration including key, range, versionId, etc.
   * @returns Promise<Buffer> - The object content as a Buffer
   * @throws InternalServerErrorException - For AWS S3 errors (permissions, network, etc.)
   */
  async getObject(options: S3GetObjectOptions): Promise<Buffer> {
    this.logger.debug(`[getObject] Getting object from S3: ${options.key}`);

    try {
      /**
       * Configure S3 GetObject parameters
       */
      const getObjectParams: GetObjectCommandInput = {
        Bucket: this.config.bucketName,
        Key: options.key,
        Range: options.range,
        IfModifiedSince: options.ifModifiedSince,
        IfUnmodifiedSince: options.ifUnmodifiedSince,
        IfMatch: options.ifMatch,
        IfNoneMatch: options.ifNoneMatch,
        VersionId: options.versionId,
      };

      const command = new GetObjectCommand(getObjectParams);
      const result = await this.s3Client.send(command);

      if (!result.Body) {
        this.logger.error(`[getObject] No body returned from S3 for key: ${options.key}`);
        throw new InternalServerErrorException('No body returned from S3');
      }

      const chunks: Buffer[] = [];
      const stream = result.Body as Readable;

      return new Promise((resolve, reject) => {
        stream.on('data', (chunk) => chunks.push(chunk));
        stream.on('end', () => {
          this.logger.debug(`[getObject] Successfully retrieved object: ${options.key}`);
          resolve(Buffer.concat(chunks));
        });
        stream.on('error', (streamError) => {
          const serializedError = this.serializeError(streamError);
          this.logger.error(
            `[getObject] Stream error while reading object: ${options.key}, error: ${JSON.stringify(serializedError)}`,
          );
          reject(streamError);
        });
      });
    } catch (error) {
      const serializedError = this.serializeError(error);
      this.logger.error(
        `[getObject] Failed to get object from S3: ${options.key}, error: ${JSON.stringify(serializedError)}`,
      );
      throw new InternalServerErrorException(`Failed to get object: ${error.message}`);
    }
  }

  /**
   * Get object as stream
   *
   * This method retrieves an object from AWS S3 as a Readable stream (file content in memory).
   *
   * @param options - GetObject configuration including key, range, versionId, etc.
   * @returns Promise<Readable> - The object content as a Readable stream
   * @throws InternalServerErrorException - For AWS S3 errors (permissions, network, etc.)
   */
  async getObjectStream(options: S3GetObjectOptions): Promise<Readable> {
    this.logger.debug(`[getObjectStream] Getting object stream from S3: ${options.key}`);

    try {
      const getObjectParams: GetObjectCommandInput = {
        Bucket: this.config.bucketName,
        Key: options.key,
        Range: options.range,
        IfModifiedSince: options.ifModifiedSince,
        IfUnmodifiedSince: options.ifUnmodifiedSince,
        IfMatch: options.ifMatch,
        IfNoneMatch: options.ifNoneMatch,
        VersionId: options.versionId,
      };

      const command = new GetObjectCommand(getObjectParams);
      const result = await this.s3Client.send(command);

      if (!result.Body) {
        this.logger.error(`[getObjectStream] No body returned from S3 for key: ${options.key}`);
        throw new InternalServerErrorException('No body returned from S3');
      }

      this.logger.debug(`[getObjectStream] Successfully got object stream: ${options.key}`);
      return result.Body as Readable;
    } catch (error) {
      const serializedError = this.serializeError(error);
      this.logger.error(
        `[getObjectStream] Failed to get object stream from S3: ${options.key}, error: ${JSON.stringify(serializedError)}`,
      );
      throw new InternalServerErrorException(`Failed to get object stream: ${error.message}`);
    }
  }

  /**
   * Get signed URL for download
   *
   * This method generates a signed URL for a specific S3 object that allows temporary access to the object.
   * The URL is valid for a specified duration and can be used to download the object.
   *
   * @param options - GetUrl configuration including key, expiresIn, responseContentType, responseContentDisposition
   * @returns Promise<string> - The signed URL for the object
   * @throws InternalServerErrorException - For AWS S3 errors (permissions, network, etc.)
   */
  async getSignedUrl(options: S3GetUrlOptions): Promise<string> {
    this.logger.debug(`[getSignedUrl] Generating signed URL for key: ${options.key}`);

    try {
      const command = new GetObjectCommand({
        Bucket: this.config.bucketName,
        Key: options.key,
        ResponseContentType: options.responseContentType,
        ResponseContentDisposition: options.responseContentDisposition,
      });

      const expiresIn = options.expiresIn || this.config.urlExpirationTime;
      this.logger.debug(`[getSignedUrl] Creating signed URL with expiration: ${expiresIn}s`);

      const signedUrl = await getSignedUrl(this.s3Client, command, { expiresIn });

      this.logger.debug(`[getSignedUrl] Successfully generated signed URL for: ${options.key}`);
      return signedUrl;
    } catch (error) {
      const serializedError = this.serializeError(error);
      this.logger.error(
        `[getSignedUrl] Failed to generate signed URL for: ${options.key}, error: ${JSON.stringify(serializedError)}`,
      );
      throw new InternalServerErrorException(`Failed to generate signed URL: ${error.message}`);
    }
  }

  /**
   * Get signed URL for upload
   *
   * This method generates a signed URL for a specific S3 object that allows temporary access to the object.
   * The URL is valid for a specified duration and can be used to upload the object.
   * The URL is signed with the AWS credentials of the user who generated the URL.
   *
   * @param key - The key of the S3 object to upload
   * @param contentType - The content type of the S3 object to upload
   * @param expiresIn - The duration of the signed URL in seconds (default is 60 seconds)
   * @returns Promise<string> - The signed URL for the object
   * @throws InternalServerErrorException - For AWS S3 errors (permissions, network, etc.)
   */
  async getSignedUploadUrl(key: string, contentType?: string, expiresIn?: number): Promise<string> {
    this.logger.debug(`[getSignedUploadUrl] Generating signed upload URL for key: ${key}`);

    try {
      const command = new PutObjectCommand({
        Bucket: this.config.bucketName,
        Key: key,
        ContentType: contentType,
      });

      const expires = expiresIn || this.config.urlExpirationTime;
      this.logger.debug(`[getSignedUploadUrl] Creating signed upload URL with expiration: ${expires}s`);

      const signedUrl = await getSignedUrl(this.s3Client, command, { expiresIn: expires });

      this.logger.debug(`[getSignedUploadUrl] Successfully generated signed upload URL for: ${key}`);
      return signedUrl;
    } catch (error) {
      const serializedError = this.serializeError(error);
      this.logger.error(
        `[getSignedUploadUrl] Failed to generate signed upload URL for: ${key}, error: ${JSON.stringify(serializedError)}`,
      );
      throw new InternalServerErrorException(`Failed to generate signed upload URL: ${error.message}`);
    }
  }

  /**
   * Delete object
   *
   * This method deletes a specific S3 object.
   *
   * @param options - DeleteObject configuration including key, versionId
   * @returns Promise<S3DeleteResult> - The result of the delete operation
   * @throws InternalServerErrorException - For AWS S3 errors (permissions, network, etc.)
   */
  async deleteObject(options: S3DeleteOptions): Promise<S3DeleteResult> {
    this.logger.debug(`[deleteObject] Deleting object from S3: ${options.key}`);

    try {
      const deleteParams: DeleteObjectCommandInput = {
        Bucket: this.config.bucketName,
        Key: options.key,
        VersionId: options.versionId,
      };

      const command = new DeleteObjectCommand(deleteParams);
      const result = await this.s3Client.send(command);

      const deleteResult: S3DeleteResult = {
        key: options.key,
        deleted: true,
        versionId: result.VersionId,
        deletedAt: new Date(),
      };

      this.logger.log(`[deleteObject] Successfully deleted object: ${options.key}`);
      return deleteResult;
    } catch (error) {
      const serializedError = this.serializeError(error);
      this.logger.error(
        `[deleteObject] Failed to delete object: ${options.key}, error: ${JSON.stringify(serializedError)}`,
      );
      throw new InternalServerErrorException(`Failed to delete object: ${error.message}`);
    }
  }

  /**
   * Batch delete objects
   *
   * This method deletes multiple S3 objects in a single operation.
   *
   * @param options - BatchDeleteObjects configuration including keys, quiet
   * @returns Promise<S3BatchDeleteResult> - The result of the batch delete operation
   * @throws BadRequestException - For validation errors (too many objects, etc.)
   * @throws InternalServerErrorException - For AWS S3 errors (permissions, network, etc.)
   */
  async batchDeleteObjects(options: S3BatchDeleteOptions): Promise<S3BatchDeleteResult> {
    this.logger.debug(`[batchDeleteObjects] Starting batch delete for ${options.keys.length} objects`);

    try {
      if (options.keys.length === 0) {
        this.logger.debug('[batchDeleteObjects] No objects to delete');
        return { deleted: [], errors: [] };
      }

      if (options.keys.length > 1000) {
        this.logger.warn(`[batchDeleteObjects] Too many objects to delete: ${options.keys.length}`);
        throw new BadRequestException('Cannot delete more than 1000 objects at once');
      }

      const deleteParams: DeleteObjectsCommandInput = {
        Bucket: this.config.bucketName,
        Delete: {
          Objects: options.keys.map(({ key, versionId }) => ({
            Key: key,
            VersionId: versionId,
          })),
          Quiet: options.quiet,
        },
      };

      const command = new DeleteObjectsCommand(deleteParams);
      const result = await this.s3Client.send(command);

      const batchResult: S3BatchDeleteResult = {
        deleted:
          result.Deleted?.map((item) => ({
            key: item.Key || '',
            versionId: item.VersionId,
            deleteMarker: item.DeleteMarker,
          })) || [],
        errors:
          result.Errors?.map((error) => ({
            key: error.Key || '',
            code: error.Code || '',
            message: error.Message || '',
            versionId: error.VersionId,
          })) || [],
      };

      this.logger.log(
        `[batchDeleteObjects] Batch deleted ${batchResult.deleted.length} objects, ${batchResult.errors.length} errors`,
      );
      return batchResult;
    } catch (error) {
      const serializedError = this.serializeError(error);
      this.logger.error(
        `[batchDeleteObjects] Failed to batch delete objects, error: ${JSON.stringify(serializedError)}`,
      );
      throw new InternalServerErrorException(`Failed to batch delete objects: ${error.message}`);
    }
  }

  /**
   * Get object metadata
   *
   * This method retrieves metadata about a specific S3 object.
   *
   * @param key - The key of the S3 object to get metadata for
   * @param versionId - The version ID of the S3 object to get metadata for
   * @returns Promise<S3HeadObjectResult> - The metadata of the object
   * @throws InternalServerErrorException - For AWS S3 errors (permissions, network, etc.)
   */
  async headObject(key: string, versionId?: string): Promise<S3HeadObjectResult> {
    this.logger.debug(`[headObject] Getting object metadata for key: ${key}`);

    try {
      const headParams: HeadObjectCommandInput = {
        Bucket: this.config.bucketName,
        Key: key,
        VersionId: versionId,
      };

      const command = new HeadObjectCommand(headParams);
      const result = await this.s3Client.send(command);

      this.logger.debug(`[headObject] Object exists: ${key}, size: ${result.ContentLength}`);
      return {
        exists: true,
        size: result.ContentLength,
        lastModified: result.LastModified,
        etag: result.ETag?.replaceAll('"', ''),
        contentType: result.ContentType,
        metadata: result.Metadata,
        versionId: result.VersionId,
        storageClass: result.StorageClass,
      };
    } catch (error: any) {
      if (error.name === 'NotFound' || error.$metadata?.httpStatusCode === 404) {
        this.logger.debug(`[headObject] Object not found: ${key}`);
        return { exists: false };
      }

      const serializedError = this.serializeError(error);
      this.logger.error(
        `[headObject] Failed to get object metadata: ${key}, error: ${JSON.stringify(serializedError)}`,
      );
      throw new InternalServerErrorException(`Failed to get object metadata: ${error.message}`);
    }
  }

  /**
   * List objects in bucket
   *
   * This method lists all objects in a specific S3 bucket.
   *
   * @param options - ListObjects configuration including prefix, delimiter, maxKeys, continuationToken, startAfter
   * @returns Promise<S3ListObjectsResult> - The list of objects in the bucket
   * @throws InternalServerErrorException - For AWS S3 errors (permissions, network, etc.)
   */
  async listObjects(options: S3ListObjectsOptions = {}): Promise<S3ListObjectsResult> {
    this.logger.debug(`[listObjects] Listing objects with prefix: ${options.prefix || '(none)'}`);

    try {
      const listParams: ListObjectsV2CommandInput = {
        Bucket: this.config.bucketName,
        Prefix: options.prefix,
        Delimiter: options.delimiter,
        MaxKeys: options.maxKeys,
        ContinuationToken: options.continuationToken,
        StartAfter: options.startAfter,
      };

      const command = new ListObjectsV2Command(listParams);
      const result = await this.s3Client.send(command);

      const objects: S3ObjectInfo[] =
        result.Contents?.map((obj) => ({
          key: obj.Key || '',
          size: obj.Size || 0,
          lastModified: obj.LastModified || new Date(),
          etag: obj.ETag?.replaceAll('"', '') || '',
          contentType: '', // Not available in list operation
          storageClass: obj.StorageClass,
        })) || [];

      this.logger.debug(`[listObjects] Found ${objects.length} objects`);
      return {
        objects,
        isTruncated: result.IsTruncated || false,
        nextContinuationToken: result.NextContinuationToken,
        keyCount: result.KeyCount || 0,
        maxKeys: result.MaxKeys || 1000,
        prefix: result.Prefix,
        delimiter: result.Delimiter,
      };
    } catch (error) {
      const serializedError = this.serializeError(error);
      this.logger.error(`[listObjects] Failed to list objects, error: ${JSON.stringify(serializedError)}`);
      throw new InternalServerErrorException(`Failed to list objects: ${error.message}`);
    }
  }

  /**
   * Copy object
   *
   * This method copies a specific S3 object to a new location.
   *
   * @param options - CopyObject configuration including sourceKey, destinationKey, sourceBucket,
   * metadata, metadataDirective, tagDirective, tags, storageClass
   * @returns Promise<S3CopyObjectResult> - The result of the copy operation
   * @throws InternalServerErrorException - For AWS S3 errors (permissions, network, etc.)
   */
  async copyObject(options: S3CopyObjectOptions): Promise<S3CopyObjectResult> {
    this.logger.debug(`[copyObject] Copying object: ${options.sourceKey} -> ${options.destinationKey}`);

    try {
      const sourceBucket = options.sourceBucket || this.config.bucketName;
      const copySource = `${sourceBucket}/${options.sourceKey}`;

      const copyParams: CopyObjectCommandInput = {
        Bucket: this.config.bucketName,
        Key: options.destinationKey,
        CopySource: copySource,
        Metadata: options.metadata,
        MetadataDirective: options.metadataDirective,
        TaggingDirective: options.tagDirective,
        Tagging: options.tags ? this.formatTagsAsString(options.tags) : undefined,
        StorageClass: options.storageClass as StorageClass,
      };

      const command = new CopyObjectCommand(copyParams);
      const result = await this.s3Client.send(command);

      const copyResult: S3CopyObjectResult = {
        key: options.destinationKey,
        etag: result.CopyObjectResult?.ETag?.replaceAll('"', '') || '',
        lastModified: result.CopyObjectResult?.LastModified || new Date(),
        versionId: result.VersionId,
      };

      this.logger.log(`[copyObject] Successfully copied object: ${options.sourceKey} -> ${options.destinationKey}`);
      return copyResult;
    } catch (error) {
      const serializedError = this.serializeError(error);
      this.logger.error(
        `[copyObject] Failed to copy object: ${options.sourceKey} -> ${options.destinationKey}, error: ${JSON.stringify(serializedError)}`,
      );
      throw new InternalServerErrorException(`Failed to copy object: ${error.message}`);
    }
  }

  /**
   * Check if object exists
   *
   * This method checks if a specific S3 object exists.
   *
   * @param key - The key of the S3 object to check
   * @param versionId - The version ID of the S3 object to check
   * @returns Promise<boolean> - True if the object exists, false otherwise
   * @throws InternalServerErrorException - For AWS S3 errors (permissions, network, etc.)
   */
  async objectExists(key: string, versionId?: string): Promise<boolean> {
    const result = await this.headObject(key, versionId);
    return result.exists;
  }

  /**
   * Generate unique key
   *
   * This method generates a unique key for a specific S3 object.
   *
   * @param prefix - The prefix of the key
   * @param extension - The extension of the key
   * @returns string - The unique key
   */
  generateUniqueKey(prefix?: string, extension?: string): string {
    const uuid = uuidv4();
    const timestamp = Date.now();
    const randomSuffix = crypto.randomBytes(4).toString('hex');

    let key = `${uuid}-${timestamp}-${randomSuffix}`;

    if (prefix) {
      key = `${prefix}/${key}`;
    }

    if (extension) {
      key += `.${extension.replace(/^\./, '')}`;
    }

    return key;
  }

  /**
   * Validate file
   */
  async validateFile(
    buffer: Buffer,
    mimeType?: string,
  ): Promise<{ isValid: boolean; detectedMimeType?: string; error?: string }> {
    this.logger.debug(
      `[validateFile] Validating file - size: ${buffer.length} bytes, mimeType: ${mimeType || '(not provided)'}`,
    );

    try {
      // Check file size
      if (buffer.length > this.config.maxFileSize) {
        this.logger.warn(`[validateFile] File size exceeds limit: ${buffer.length} > ${this.config.maxFileSize}`);
        return {
          isValid: false,
          error: `File size exceeds maximum allowed size of ${this.config.maxFileSize} bytes`,
        };
      }

      // Check minimum file size (1 byte)
      if (buffer.length === 0) {
        this.logger.warn('[validateFile] File is empty');
        return {
          isValid: false,
          error: 'File is empty',
        };
      }

      // Detect MIME type from file signature
      const detectedMimeType = this.detectMimeType(buffer);
      this.logger.debug(`[validateFile] Detected MIME type: ${detectedMimeType || '(unknown)'}`);

      // If mime type is provided, validate it matches
      if (mimeType && detectedMimeType && detectedMimeType !== mimeType) {
        this.logger.warn(`[validateFile] MIME type mismatch: expected ${mimeType}, detected ${detectedMimeType}`);
        return {
          isValid: false,
          detectedMimeType,
          error: `MIME type mismatch: expected ${mimeType}, detected ${detectedMimeType}`,
        };
      }

      // Check if detected or provided MIME type is allowed
      const typeToCheck = detectedMimeType || mimeType;
      if (typeToCheck && !this.config.allowedMimeTypes.includes(typeToCheck)) {
        this.logger.warn(`[validateFile] MIME type not allowed: ${typeToCheck}`);
        return {
          isValid: false,
          detectedMimeType,
          error: `MIME type ${typeToCheck} is not allowed`,
        };
      }

      this.logger.debug('[validateFile] File validation passed');
      return {
        isValid: true,
        detectedMimeType,
      };
    } catch (error) {
      const serializedError = this.serializeError(error);
      this.logger.error(`[validateFile] File validation error: ${JSON.stringify(serializedError)}`);
      return {
        isValid: false,
        error: `File validation failed: ${error.message}`,
      };
    }
  }

  /**
   * Ensure bucket exists
   */
  async ensureBucketExists(): Promise<boolean> {
    this.logger.debug(`[ensureBucketExists] Checking if bucket exists: ${this.config.bucketName}`);

    try {
      const headCommand = new HeadBucketCommand({ Bucket: this.config.bucketName });
      await this.s3Client.send(headCommand);
      this.logger.debug(`[ensureBucketExists] Bucket exists: ${this.config.bucketName}`);
      return true;
    } catch (error: any) {
      if (error.name === 'NotFound' || error.$metadata?.httpStatusCode === 404) {
        this.logger.debug(`[ensureBucketExists] Bucket not found, creating: ${this.config.bucketName}`);
        try {
          const createCommand = new CreateBucketCommand({
            Bucket: this.config.bucketName,
            CreateBucketConfiguration:
              this.config.region !== 'us-east-1'
                ? {
                    LocationConstraint: this.config.region as BucketLocationConstraint,
                  }
                : undefined,
          });

          await this.s3Client.send(createCommand);
          this.logger.log(`[ensureBucketExists] Created S3 bucket: ${this.config.bucketName}`);
          return true;
        } catch (createError: any) {
          const serializedError = this.serializeError(createError);
          this.logger.error(
            `[ensureBucketExists] Failed to create S3 bucket: ${this.config.bucketName}, error: ${JSON.stringify(serializedError)}`,
          );
          throw new InternalServerErrorException(`Failed to create bucket: ${createError.message}`);
        }
      }

      const serializedError = this.serializeError(error);
      this.logger.error(
        `[ensureBucketExists] Failed to check bucket existence: ${this.config.bucketName}, error: ${JSON.stringify(serializedError)}`,
      );
      throw new InternalServerErrorException(`Failed to check bucket: ${error.message}`);
    }
  }

  /**
   * Get bucket policy
   */
  async getBucketPolicy(): Promise<any> {
    this.logger.debug(`[getBucketPolicy] Getting bucket policy for: ${this.config.bucketName}`);

    try {
      const command = new GetBucketPolicyCommand({ Bucket: this.config.bucketName });
      const result = await this.s3Client.send(command);
      this.logger.debug(`[getBucketPolicy] Successfully retrieved bucket policy`);
      return result.Policy ? JSON.parse(result.Policy) : null;
    } catch (error: any) {
      if (error.name === 'NoSuchBucketPolicy') {
        this.logger.debug(`[getBucketPolicy] No bucket policy found`);
        return null;
      }
      const serializedError = this.serializeError(error);
      this.logger.error(`[getBucketPolicy] Failed to get bucket policy, error: ${JSON.stringify(serializedError)}`);
      throw new InternalServerErrorException(`Failed to get bucket policy: ${error.message}`);
    }
  }

  /**
   * Set bucket policy
   */
  async setBucketPolicy(policy: any): Promise<void> {
    this.logger.debug(`[setBucketPolicy] Setting bucket policy for: ${this.config.bucketName}`);

    try {
      const command = new PutBucketPolicyCommand({
        Bucket: this.config.bucketName,
        Policy: JSON.stringify(policy),
      });

      await this.s3Client.send(command);
      this.logger.log('[setBucketPolicy] Successfully set bucket policy');
    } catch (error) {
      const serializedError = this.serializeError(error);
      this.logger.error(`[setBucketPolicy] Failed to set bucket policy, error: ${JSON.stringify(serializedError)}`);
      throw new InternalServerErrorException(`Failed to set bucket policy: ${error.message}`);
    }
  }

  /**
   * Private helper methods
   */
  private validateUploadOptions(options: S3UploadOptions): void {
    this.logger.debug(`Validating upload options for key: ${options.key}`);

    if (!options.key || options.key.trim() === '') {
      this.logger.warn('Upload validation failed: Key is required');
      throw new BadRequestException('Key is required');
    }

    if (options.key.includes('..') || options.key.startsWith('/')) {
      this.logger.warn(`Upload validation failed: Invalid key format - ${options.key}`);
      throw new BadRequestException('Invalid key format');
    }

    this.logger.debug(`Upload options validated successfully for key: ${options.key}`);
  }

  private formatTagsAsString(tags: Record<string, string>): string {
    return Object.entries(tags)
      .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
      .join('&');
  }

  private detectMimeType(buffer: Buffer): string | undefined {
    const signatures: Record<string, string> = {
      ffd8ff: 'image/jpeg',
      '89504e47': 'image/png',
      '47494638': 'image/gif',
      '52494646': 'image/webp',
      '25504446': 'application/pdf',
      '504b0304': 'application/zip',
      '504b0506': 'application/zip',
      '504b0708': 'application/zip',
    };

    const hex = buffer.subarray(0, 8).toString('hex');

    for (const [signature, mimeType] of Object.entries(signatures)) {
      if (hex.startsWith(signature)) {
        return mimeType;
      }
    }

    return undefined;
  }

  /**
   * Safely serialize error objects to avoid circular reference issues
   * AWS SDK errors contain circular references (TLSSocket, ClientRequest, Agent)
   * that cannot be JSON-serialized directly
   */
  private serializeError(error: any): Record<string, any> {
    if (!error) {
      return { message: 'Unknown error' };
    }

    const serialized: Record<string, any> = {
      message: error.message || 'Unknown error',
      name: error.name || 'Error',
    };

    // AWS SDK specific error properties
    if (error.$metadata) {
      serialized.httpStatusCode = error.$metadata.httpStatusCode;
      serialized.requestId = error.$metadata.requestId;
      serialized.attempts = error.$metadata.attempts;
      serialized.totalRetryDelay = error.$metadata.totalRetryDelay;
    }

    // AWS error code
    if (error.Code) {
      serialized.code = error.Code;
    }

    if (error.code) {
      serialized.code = error.code;
    }

    // Stack trace (truncated)
    if (error.stack) {
      serialized.stack = error.stack.split('\n').slice(0, 5).join('\n');
    }

    return serialized;
  }
}
