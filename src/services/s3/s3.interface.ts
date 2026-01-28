import { Readable } from 'stream';

export interface S3UploadOptions {
  key: string;
  contentType?: string;
  metadata?: Record<string, string>;
  tags?: Record<string, string>;
  isPublic?: boolean;
  cacheControl?: string;
  expires?: Date;
  enableEncryption?: boolean;
  storageClass?:
    | 'STANDARD'
    | 'REDUCED_REDUNDANCY'
    | 'STANDARD_IA'
    | 'ONEZONE_IA'
    | 'INTELLIGENT_TIERING'
    | 'GLACIER'
    | 'DEEP_ARCHIVE';
}

export interface S3UploadResult {
  key: string;
  etag: string;
  location: string;
  bucket: string;
  versionId?: string;
  size: number;
  contentType: string;
  uploadedAt: Date;
  signedUrl: string;
}

export interface S3DeleteOptions {
  key: string;
  versionId?: string;
}

export interface S3DeleteResult {
  key: string;
  deleted: boolean;
  versionId?: string;
  deletedAt: Date;
}

export interface S3GetUrlOptions {
  key: string;
  expiresIn?: number; // seconds
  responseContentType?: string;
  responseContentDisposition?: string;
}

export interface S3GetObjectOptions {
  key: string;
  range?: string;
  ifModifiedSince?: Date;
  ifUnmodifiedSince?: Date;
  ifMatch?: string;
  ifNoneMatch?: string;
  versionId?: string;
}

export interface S3ObjectInfo {
  key: string;
  size: number;
  lastModified: Date;
  etag: string;
  contentType: string;
  metadata?: Record<string, string>;
  versionId?: string;
  storageClass?: string;
}

export interface S3ListObjectsOptions {
  prefix?: string;
  delimiter?: string;
  maxKeys?: number;
  continuationToken?: string;
  startAfter?: string;
}

export interface S3ListObjectsResult {
  objects: S3ObjectInfo[];
  isTruncated: boolean;
  nextContinuationToken?: string;
  keyCount: number;
  maxKeys: number;
  prefix?: string;
  delimiter?: string;
}

export interface S3CopyObjectOptions {
  sourceKey: string;
  destinationKey: string;
  sourceBucket?: string;
  metadata?: Record<string, string>;
  metadataDirective?: 'COPY' | 'REPLACE';
  tagDirective?: 'COPY' | 'REPLACE';
  tags?: Record<string, string>;
  storageClass?: string;
}

export interface S3CopyObjectResult {
  key: string;
  etag: string;
  lastModified: Date;
  versionId?: string;
}

export interface S3MultipartUploadOptions extends Omit<S3UploadOptions, 'key'> {
  key: string;
  partSize?: number; // in bytes, minimum 5MB
  queueSize?: number; // number of parts to upload concurrently
}

export interface S3MultipartUploadResult extends S3UploadResult {
  partsUploaded: number;
  uploadDuration: number; // in milliseconds
}

export interface S3BatchDeleteOptions {
  keys: Array<{ key: string; versionId?: string }>;
  quiet?: boolean;
}

export interface S3BatchDeleteResult {
  deleted: Array<{ key: string; versionId?: string; deleteMarker?: boolean }>;
  errors: Array<{ key: string; code: string; message: string; versionId?: string }>;
}

export interface S3HeadObjectResult {
  exists: boolean;
  size?: number;
  lastModified?: Date;
  etag?: string;
  contentType?: string;
  metadata?: Record<string, string>;
  versionId?: string;
  storageClass?: string;
}

export interface IS3Service {
  // Upload operations
  uploadBuffer(buffer: Buffer, options: S3UploadOptions): Promise<S3UploadResult>;
  uploadStream(stream: Readable, options: S3UploadOptions): Promise<S3UploadResult>;
  uploadFile(filePath: string, options: S3UploadOptions): Promise<S3UploadResult>;
  multipartUpload(buffer: Buffer, options: S3MultipartUploadOptions): Promise<S3MultipartUploadResult>;

  // Download operations
  getObject(options: S3GetObjectOptions): Promise<Buffer>;
  getObjectStream(options: S3GetObjectOptions): Promise<Readable>;
  getSignedUrl(options: S3GetUrlOptions): Promise<string>;
  getSignedUploadUrl(key: string, contentType?: string, expiresIn?: number): Promise<string>;

  // Delete operations
  deleteObject(options: S3DeleteOptions): Promise<S3DeleteResult>;
  batchDeleteObjects(options: S3BatchDeleteOptions): Promise<S3BatchDeleteResult>;

  // Object information
  headObject(key: string, versionId?: string): Promise<S3HeadObjectResult>;
  listObjects(options?: S3ListObjectsOptions): Promise<S3ListObjectsResult>;

  // Copy operations
  copyObject(options: S3CopyObjectOptions): Promise<S3CopyObjectResult>;

  // Utility operations
  objectExists(key: string, versionId?: string): Promise<boolean>;
  generateUniqueKey(prefix?: string, extension?: string): string;
  validateFile(
    buffer: Buffer,
    mimeType?: string,
  ): Promise<{ isValid: boolean; detectedMimeType?: string; error?: string }>;

  // Bucket operations
  ensureBucketExists(): Promise<boolean>;
  getBucketPolicy(): Promise<any>;
  setBucketPolicy(policy: any): Promise<void>;
}
