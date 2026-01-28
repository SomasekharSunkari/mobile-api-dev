# AWS S3 Service

A robust and secure AWS S3 service implementation for OneDosh payments platform that provides file upload, download, deletion, and management capabilities.

## Features

- **File Upload**: Buffer, stream, and file path uploads
- **File Download**: Direct buffer download and signed URL generation
- **File Management**: Delete, copy, list, and metadata operations
- **Security**: File validation, MIME type checking, size limits
- **Multipart Upload**: Support for large files
- **Batch Operations**: Bulk delete operations
- **Bucket Management**: Bucket creation and policy management

## Configuration

Add the following environment variables to your `.env` file:

```env
# AWS S3 Configuration
AWS_S3_REGION=us-east-1
AWS_S3_ACCESS_KEY_ID=your_access_key_id
AWS_S3_SECRET_ACCESS_KEY=your_secret_access_key
AWS_S3_BUCKET_NAME=onedosh-files
AWS_S3_MAX_FILE_SIZE=52428800  # 50MB in bytes
AWS_S3_URL_EXPIRATION_TIME=3600  # 1 hour in seconds
AWS_S3_ENABLE_ENCRYPTION=true
AWS_S3_ENCRYPTION_ALGORITHM=AES256
AWS_S3_PUBLIC_READ_PATH=public
AWS_S3_PRIVATE_READ_PATH=private
AWS_S3_ALLOWED_MIME_TYPES=image/jpeg,image/png,image/gif,image/webp,application/pdf,text/plain,text/csv,application/json,application/zip
```

## Usage Examples

### Basic Module Import

```typescript
import { Module } from '@nestjs/common';
import { S3Module } from '../services/s3';

@Module({
  imports: [S3Module],
  // ... other module configuration
})
export class YourModule {}
```

### Service Injection

```typescript
import { Injectable } from '@nestjs/common';
import { S3Service } from '../services/s3';

@Injectable()
export class FileService {
  constructor(private readonly s3Service: S3Service) {}

  async uploadFile(buffer: Buffer, filename: string) {
    return this.s3Service.uploadBuffer(buffer, {
      key: this.s3Service.generateUniqueKey('uploads', 'jpg'),
      contentType: 'image/jpeg',
      isPublic: false,
    });
  }
}
```

### Upload Operations

#### Upload Buffer

```typescript
const buffer = Buffer.from('file content');
const result = await s3Service.uploadBuffer(buffer, {
  key: 'documents/my-file.pdf',
  contentType: 'application/pdf',
  metadata: {
    userId: '12345',
    originalName: 'document.pdf',
  },
  tags: {
    environment: 'production',
    department: 'compliance',
  },
  isPublic: false,
});
```

#### Upload Stream

```typescript
const stream = createReadStream('./local-file.jpg');
const result = await s3Service.uploadStream(stream, {
  key: s3Service.generateUniqueKey('images', 'jpg'),
  contentType: 'image/jpeg',
  cacheControl: 'max-age=31536000', // 1 year
});
```

#### Multipart Upload (Large Files)

```typescript
const largeBuffer = Buffer.alloc(100 * 1024 * 1024); // 100MB
const result = await s3Service.multipartUpload(largeBuffer, {
  key: 'videos/large-video.mp4',
  contentType: 'video/mp4',
  partSize: 10 * 1024 * 1024, // 10MB parts
  queueSize: 4, // Upload 4 parts concurrently
});
```

### Download Operations

#### Get File as Buffer

```typescript
const buffer = await s3Service.getObject({
  key: 'documents/my-file.pdf',
});
```

#### Get Signed Download URL

```typescript
const downloadUrl = await s3Service.getSignedUrl({
  key: 'documents/my-file.pdf',
  expiresIn: 3600, // 1 hour
  responseContentDisposition: 'attachment; filename="document.pdf"',
});
```

#### Get Signed Upload URL (for direct client uploads)

```typescript
const uploadUrl = await s3Service.getSignedUploadUrl(
  'user-uploads/profile-image.jpg',
  'image/jpeg',
  1800, // 30 minutes
);
```

### File Management

#### Check if File Exists

```typescript
const exists = await s3Service.objectExists('documents/my-file.pdf');
```

#### Get File Metadata

```typescript
const metadata = await s3Service.headObject('documents/my-file.pdf');
if (metadata.exists) {
  console.log(`File size: ${metadata.size} bytes`);
  console.log(`Last modified: ${metadata.lastModified}`);
}
```

#### List Files

```typescript
const result = await s3Service.listObjects({
  prefix: 'user-123/',
  maxKeys: 100,
});

result.objects.forEach((obj) => {
  console.log(`${obj.key}: ${obj.size} bytes`);
});
```

#### Copy File

```typescript
const copyResult = await s3Service.copyObject({
  sourceKey: 'temp/upload.jpg',
  destinationKey: 'permanent/image.jpg',
  metadata: {
    status: 'processed',
  },
  metadataDirective: 'REPLACE',
});
```

#### Delete File

```typescript
const deleteResult = await s3Service.deleteObject({
  key: 'temporary/old-file.pdf',
});
```

#### Batch Delete Files

```typescript
const batchResult = await s3Service.batchDeleteObjects({
  keys: [{ key: 'temp/file1.jpg' }, { key: 'temp/file2.jpg' }, { key: 'temp/file3.jpg' }],
  quiet: false, // Return details about each deletion
});
```

### File Validation

```typescript
const buffer = Buffer.from('file content');
const validation = await s3Service.validateFile(buffer, 'image/jpeg');

if (!validation.isValid) {
  throw new Error(validation.error);
}

console.log(`Detected MIME type: ${validation.detectedMimeType}`);
```

### Utility Functions

#### Generate Unique Key

```typescript
// Generate with prefix and extension
const key1 = s3Service.generateUniqueKey('user-uploads', 'jpg');
// Output: user-uploads/550e8400-e29b-41d4-a716-12345678/abcd1234.jpg

// Generate without prefix
const key2 = s3Service.generateUniqueKey();
// Output: 550e8400-e29b-41d4-a716-12345678/abcd1234

// Generate with only extension
const key3 = s3Service.generateUniqueKey(undefined, 'pdf');
// Output: 550e8400-e29b-41d4-a716-12345678/abcd1234.pdf
```

## Error Handling

The service throws NestJS standard exceptions:

```typescript
try {
  const result = await s3Service.uploadBuffer(buffer, options);
} catch (error) {
  if (error instanceof BadRequestException) {
    // Handle validation errors (file too large, invalid key, etc.)
  } else if (error instanceof InternalServerErrorException) {
    // Handle AWS S3 errors (permissions, network, etc.)
  }
}
```

## Security Features

- **File Size Limits**: Configurable maximum file size
- **MIME Type Validation**: Whitelist of allowed file types
- **File Signature Detection**: Detects actual file type from binary signature
- **Key Validation**: Prevents path traversal attacks
- **Encryption**: Server-side encryption support
- **Access Control**: Public/private file access control

## Best Practices

1. **Use Unique Keys**: Always use `generateUniqueKey()` to avoid conflicts
2. **Set Appropriate MIME Types**: Always specify content type for better browser handling
3. **Use Metadata**: Store relevant information in object metadata
4. **Implement Cleanup**: Use lifecycle policies or scheduled cleanup for temporary files
5. **Monitor Usage**: Track upload/download patterns for cost optimization
6. **Error Handling**: Implement proper error handling and retry logic
7. **Security**: Validate file types and sizes before upload
