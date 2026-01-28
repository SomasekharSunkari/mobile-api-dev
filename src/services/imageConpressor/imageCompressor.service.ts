import { Injectable, Logger } from '@nestjs/common';
import { divide, multiply } from 'mathjs';
import * as sharp from 'sharp';
import { Readable } from 'stream';
import { CompressionResult, ImageCompressionOptions } from './imageCompressor.interface';
import { ONE_HUNDRED_KILOBYTES } from '../../constants/constants';

@Injectable()
export class ImageCompressorService {
  private readonly logger = new Logger(ImageCompressorService.name);

  /**
   * Compress an image from buffer
   */
  async compressFromBuffer(buffer: Buffer, options: ImageCompressionOptions = {}): Promise<CompressionResult> {
    try {
      const originalSize = buffer.length;
      let sharpInstance = sharp(buffer);

      // Apply transformations
      sharpInstance = this.applyTransformations(sharpInstance, options);

      // Get image metadata
      const metadata = await sharpInstance.metadata();
      const { width = metadata.width, height = metadata.height } = options;

      // Compress the image
      const compressedBuffer = await sharpInstance.toBuffer();

      const result: CompressionResult = {
        originalSize,
        compressedSize: compressedBuffer.length,
        compressionRatio: ((originalSize - compressedBuffer.length) / originalSize) * 100,
        format: options.format || metadata.format || 'unknown',
        width: width || 0,
        height: height || 0,
        buffer: compressedBuffer,
      };

      this.logger.log(
        `Image compressed: ${originalSize} -> ${compressedBuffer.length} bytes (${result.compressionRatio.toFixed(2)}% reduction)`,
      );

      return result;
    } catch (error) {
      this.logger.error('Error compressing image from buffer:', error);
      throw new Error(`Failed to compress image: ${error.message}`);
    }
  }

  /**
   * Compress an image from file path
   */
  async compressFromFile(filePath: string, options: ImageCompressionOptions = {}): Promise<CompressionResult> {
    try {
      const originalBuffer = await sharp(filePath).toBuffer();
      return this.compressFromBuffer(originalBuffer, options);
    } catch (error) {
      this.logger.error(`Error compressing image from file ${filePath}:`, error);
      throw new Error(`Failed to compress image from file: ${error.message}`);
    }
  }

  /**
   * Compress an image from stream
   */
  async compressFromStream(stream: Readable, options: ImageCompressionOptions = {}): Promise<CompressionResult> {
    try {
      const chunks: Buffer[] = [];
      const originalBuffer = await new Promise<Buffer>((resolve, reject) => {
        stream.on('data', (chunk) => chunks.push(chunk));
        stream.on('end', () => resolve(Buffer.concat(chunks)));
        stream.on('error', reject);
      });

      return this.compressFromBuffer(originalBuffer, options);
    } catch (error) {
      this.logger.error('Error compressing image from stream:', error);
      throw new Error(`Failed to compress image from stream: ${error.message}`);
    }
  }

  /**
   * Resize image to specific dimensions
   */
  async resize(
    buffer: Buffer,
    width: number,
    height: number,
    options: Omit<ImageCompressionOptions, 'width' | 'height'> = {},
  ): Promise<CompressionResult> {
    return this.compressFromBuffer(buffer, { ...options, width, height });
  }

  /**
   * Convert image to different format
   */
  async convertFormat(
    buffer: Buffer,
    format: 'jpeg' | 'png' | 'webp' | 'avif',
    options: Omit<ImageCompressionOptions, 'format'> = {},
  ): Promise<CompressionResult> {
    return this.compressFromBuffer(buffer, { ...options, format });
  }

  /**
   * Create thumbnail from image
   */
  async createThumbnail(
    buffer: Buffer,
    width: number = 150,
    height: number = 150,
    options: Omit<ImageCompressionOptions, 'width' | 'height'> = {},
  ): Promise<CompressionResult> {
    return this.compressFromBuffer(buffer, {
      ...options,
      width,
      height,
      fit: 'cover',
      quality: options.quality || 80,
    });
  }

  /**
   * Optimize image for web (WebP format with good compression)
   */
  async optimizeForWeb(buffer: Buffer, quality: number = 85): Promise<CompressionResult> {
    return this.compressFromBuffer(buffer, {
      format: 'webp',
      quality,
    });
  }

  /**
   * Get image metadata without processing
   */
  async getMetadata(buffer: Buffer): Promise<sharp.Metadata> {
    try {
      return await sharp(buffer).metadata();
    } catch (error) {
      this.logger.error('Error getting image metadata:', error);
      throw new Error(`Failed to get image metadata: ${error.message}`);
    }
  }

  /**
   * Check if image is valid
   */
  async isValidImage(buffer: Buffer): Promise<boolean> {
    try {
      await sharp(buffer).metadata();
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Apply transformations to sharp instance
   */
  private applyTransformations(sharpInstance: sharp.Sharp, options: ImageCompressionOptions): sharp.Sharp {
    let instance = sharpInstance;

    // Resize
    if (options.width || options.height) {
      instance = instance.resize({
        width: options.width,
        height: options.height,
        fit: options.fit || 'inside',
        position: options.position || 'center',
        background: options.background,
      });
    }

    // Rotate
    if (options.rotate !== undefined) {
      instance = instance.rotate(options.rotate);
    }

    // Flip
    if (options.flip) {
      instance = instance.flip();
    }

    // Flop (horizontal flip)
    if (options.flop) {
      instance = instance.flop();
    }

    // Blur
    if (options.blur !== undefined) {
      instance = instance.blur(options.blur);
    }

    // Sharpen
    if (options.sharpen !== undefined) {
      instance = instance.sharpen(options.sharpen);
    }

    // Grayscale
    if (options.grayscale) {
      instance = instance.grayscale();
    }

    // Format and quality
    if (options.format) {
      switch (options.format) {
        case 'jpeg':
          instance = instance.jpeg({ quality: options.quality || 80 });
          break;
        case 'png':
          instance = instance.png({ quality: options.quality || 80 });
          break;
        case 'webp':
          instance = instance.webp({ quality: options.quality || 80 });
          break;
        case 'avif':
          instance = instance.avif({ quality: options.quality || 80 });
          break;
      }
    } else if (options.quality) {
      // Apply quality to current format
      instance = instance.jpeg({ quality: options.quality });
    }

    return instance;
  }

  /**
   * Batch compress multiple images
   */
  async batchCompress(
    images: Array<{ buffer: Buffer; options?: ImageCompressionOptions }>,
  ): Promise<CompressionResult[]> {
    const results: CompressionResult[] = [];

    for (let i = 0; i < images.length; i++) {
      try {
        const result = await this.compressFromBuffer(images[i].buffer, images[i].options);
        results.push(result);
      } catch (error) {
        this.logger.error(`Error compressing image ${i + 1}:`, error);
        throw new Error(`Failed to compress image ${i + 1}: ${error.message}`);
      }
    }

    return results;
  }

  /**
   * Get recommended compression settings based on image type
   */
  getRecommendedSettings(imageType: 'profile' | 'thumbnail' | 'banner' | 'gallery'): ImageCompressionOptions {
    switch (imageType) {
      case 'profile':
        return {
          width: 300,
          height: 300,
          fit: 'cover',
          format: 'jpeg',
          quality: 85,
        };
      case 'thumbnail':
        return {
          width: 150,
          height: 150,
          fit: 'cover',
          format: 'webp',
          quality: 80,
        };
      case 'banner':
        return {
          width: 1200,
          height: 400,
          fit: 'cover',
          format: 'jpeg',
          quality: 90,
        };
      case 'gallery':
        return {
          width: 800,
          height: 600,
          fit: 'inside',
          format: 'webp',
          quality: 85,
        };
      default:
        return {
          format: 'jpeg',
          quality: 80,
        };
    }
  }

  /**
   * Compress image to target size in bytes
   */
  async compressToSize(
    buffer: Buffer,
    targetSizeInBytes: number = ONE_HUNDRED_KILOBYTES,
    options: Omit<ImageCompressionOptions, 'quality'> = {},
  ): Promise<CompressionResult> {
    try {
      const originalSize = buffer.length;

      // If image is already smaller than or equal to target size, return as is
      if (originalSize <= targetSizeInBytes) {
        this.logger.log(`Image already at or below target size: ${originalSize} <= ${targetSizeInBytes} bytes`);
        return {
          originalSize,
          compressedSize: originalSize,
          compressionRatio: 0,
          format: options.format || 'unknown',
          width: 0,
          height: 0,
          buffer,
        };
      }

      let currentBuffer = buffer;
      let currentSize = originalSize;
      let quality = 100;
      let iterations = 0;
      const maxIterations = 10; // Prevent infinite loops

      while (currentSize > targetSizeInBytes && iterations < maxIterations) {
        iterations++;

        // Calculate quality based on size ratio
        const sizeRatio = divide(targetSizeInBytes, currentSize);
        quality = Math.max(1, Math.floor(multiply(sizeRatio, 100)));

        this.logger.log(
          `Iteration ${iterations}: Current size ${currentSize}, Target ${targetSizeInBytes}, Quality ${quality}%`,
        );

        // Compress with calculated quality
        const result = await this.compressFromBuffer(currentBuffer, {
          ...options,
          quality,
        });

        currentBuffer = result.buffer;
        currentSize = result.compressedSize;

        // If we can't compress further (quality is already at minimum)
        if (quality <= 1 && currentSize > targetSizeInBytes) {
          this.logger.warn(
            `Cannot compress further: Quality at minimum (1%) but size still ${currentSize} > ${targetSizeInBytes}`,
          );
          break;
        }
      }

      const finalResult: CompressionResult = {
        originalSize,
        compressedSize: currentSize,
        compressionRatio: ((originalSize - currentSize) / originalSize) * 100,
        format: options.format || 'unknown',
        width: 0,
        height: 0,
        buffer: currentBuffer,
      };

      this.logger.log(
        `Compressed to size: ${originalSize} -> ${currentSize} bytes (${finalResult.compressionRatio.toFixed(2)}% reduction) in ${iterations} iterations`,
      );

      return finalResult;
    } catch (error) {
      this.logger.error('Error compressing image to size:', error);
      throw new Error(`Failed to compress image to size: ${error.message}`);
    }
  }
}
