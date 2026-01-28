import { Test, TestingModule } from '@nestjs/testing';
import { Readable } from 'stream';
import { ImageCompressionOptions } from './imageCompressor.interface';
import { ImageCompressorService } from './imageCompressor.service';

// Mock sharp
jest.mock('sharp', () => {
  const mockSharp = jest.fn();
  const mockInstance = {
    resize: jest.fn().mockReturnThis(),
    rotate: jest.fn().mockReturnThis(),
    flip: jest.fn().mockReturnThis(),
    flop: jest.fn().mockReturnThis(),
    blur: jest.fn().mockReturnThis(),
    sharpen: jest.fn().mockReturnThis(),
    grayscale: jest.fn().mockReturnThis(),
    jpeg: jest.fn().mockReturnThis(),
    png: jest.fn().mockReturnThis(),
    webp: jest.fn().mockReturnThis(),
    avif: jest.fn().mockReturnThis(),
    metadata: jest.fn(),
    toBuffer: jest.fn(),
  };

  mockSharp.mockReturnValue(mockInstance);
  mockSharp.mockImplementation(() => mockInstance);

  return mockSharp;
});

describe('ImageCompressorService', () => {
  let service: ImageCompressorService;
  let mockSharp: any;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ImageCompressorService],
    }).compile();

    service = module.get<ImageCompressorService>(ImageCompressorService);
    mockSharp = jest.requireMock('sharp');
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('compressFromBuffer', () => {
    it('should compress image from buffer successfully', async () => {
      const mockBuffer = Buffer.from('mock-image-data');
      const mockCompressedBuffer = Buffer.from('compressed-image-data');
      const mockMetadata = {
        width: 800,
        height: 600,
        format: 'jpeg',
      };

      const mockInstance = mockSharp();
      mockInstance.metadata.mockResolvedValue(mockMetadata);
      mockInstance.toBuffer.mockResolvedValue(mockCompressedBuffer);

      const options: ImageCompressionOptions = {
        quality: 80,
        format: 'jpeg',
        width: 400,
        height: 300,
      };

      const result = await service.compressFromBuffer(mockBuffer, options);

      expect(mockSharp).toHaveBeenCalledWith(mockBuffer);
      expect(mockInstance.resize).toHaveBeenCalledWith({
        width: 400,
        height: 300,
        fit: 'inside',
        position: 'center',
        background: undefined,
      });
      expect(mockInstance.jpeg).toHaveBeenCalledWith({ quality: 80 });
      expect(result).toEqual({
        originalSize: mockBuffer.length,
        compressedSize: mockCompressedBuffer.length,
        compressionRatio: expect.any(Number),
        format: 'jpeg',
        width: 400,
        height: 300,
        buffer: mockCompressedBuffer,
      });
    });

    it('should handle errors during compression', async () => {
      const mockBuffer = Buffer.from('mock-image-data');
      const mockInstance = mockSharp();
      mockInstance.metadata.mockRejectedValue(new Error('Invalid image'));

      await expect(service.compressFromBuffer(mockBuffer)).rejects.toThrow('Failed to compress image: Invalid image');
    });
  });

  describe('compressFromFile', () => {
    it('should compress image from file successfully', async () => {
      const mockCompressedBuffer = Buffer.from('compressed-image-data');
      const mockMetadata = {
        width: 800,
        height: 600,
        format: 'jpeg',
      };

      const mockInstance = mockSharp();
      mockInstance.metadata.mockResolvedValue(mockMetadata);
      mockInstance.toBuffer.mockResolvedValue(mockCompressedBuffer);

      const filePath = '/path/to/image.jpg';
      const options: ImageCompressionOptions = { quality: 85 };

      const result = await service.compressFromFile(filePath, options);

      expect(mockSharp).toHaveBeenCalledWith(filePath);
      expect(result).toBeDefined();
    });

    it('should handle file not found errors', async () => {
      const mockInstance = mockSharp();
      mockInstance.toBuffer.mockRejectedValue(new Error('File not found'));

      await expect(service.compressFromFile('/nonexistent/file.jpg')).rejects.toThrow(
        'Failed to compress image from file: File not found',
      );
    });
  });

  describe('compressFromStream', () => {
    it('should compress image from stream successfully', async () => {
      const mockBuffer = Buffer.from('mock-image-data');
      const mockCompressedBuffer = Buffer.from('compressed-image-data');
      const mockMetadata = {
        width: 800,
        height: 600,
        format: 'jpeg',
      };

      const mockInstance = mockSharp();
      mockInstance.metadata.mockResolvedValue(mockMetadata);
      mockInstance.toBuffer.mockResolvedValue(mockCompressedBuffer);

      const stream = new Readable();
      stream.push(mockBuffer);
      stream.push(null);

      const result = await service.compressFromStream(stream);

      expect(result).toBeDefined();
    });

    it('should handle stream errors', async () => {
      const stream = new Readable();
      stream.destroy(new Error('Stream error'));

      await expect(service.compressFromStream(stream)).rejects.toThrow(
        'Failed to compress image from stream: Stream error',
      );
    });
  });

  describe('resize', () => {
    it('should resize image to specific dimensions', async () => {
      const mockBuffer = Buffer.from('mock-image-data');
      const mockCompressedBuffer = Buffer.from('compressed-image-data');
      const mockMetadata = {
        width: 800,
        height: 600,
        format: 'jpeg',
      };

      const mockInstance = mockSharp();
      mockInstance.metadata.mockResolvedValue(mockMetadata);
      mockInstance.toBuffer.mockResolvedValue(mockCompressedBuffer);

      const result = await service.resize(mockBuffer, 400, 300);

      expect(mockInstance.resize).toHaveBeenCalledWith({
        width: 400,
        height: 300,
        fit: 'inside',
        position: 'center',
        background: undefined,
      });
      expect(result).toBeDefined();
    });
  });

  describe('convertFormat', () => {
    it('should convert image to WebP format', async () => {
      const mockBuffer = Buffer.from('mock-image-data');
      const mockCompressedBuffer = Buffer.from('compressed-image-data');
      const mockMetadata = {
        width: 800,
        height: 600,
        format: 'jpeg',
      };

      const mockInstance = mockSharp();
      mockInstance.metadata.mockResolvedValue(mockMetadata);
      mockInstance.toBuffer.mockResolvedValue(mockCompressedBuffer);

      const result = await service.convertFormat(mockBuffer, 'webp', { quality: 85 });

      expect(mockInstance.webp).toHaveBeenCalledWith({ quality: 85 });
      expect(result).toBeDefined();
    });
  });

  describe('createThumbnail', () => {
    it('should create thumbnail with default dimensions', async () => {
      const mockBuffer = Buffer.from('mock-image-data');
      const mockCompressedBuffer = Buffer.from('compressed-image-data');
      const mockMetadata = {
        width: 800,
        height: 600,
        format: 'jpeg',
      };

      const mockInstance = mockSharp();
      mockInstance.metadata.mockResolvedValue(mockMetadata);
      mockInstance.toBuffer.mockResolvedValue(mockCompressedBuffer);

      const result = await service.createThumbnail(mockBuffer);

      expect(mockInstance.resize).toHaveBeenCalledWith({
        width: 150,
        height: 150,
        fit: 'cover',
        position: 'center',
        background: undefined,
      });
      expect(mockInstance.jpeg).toHaveBeenCalledWith({ quality: 80 });
      expect(result).toBeDefined();
    });

    it('should create thumbnail with custom dimensions', async () => {
      const mockBuffer = Buffer.from('mock-image-data');
      const mockCompressedBuffer = Buffer.from('compressed-image-data');
      const mockMetadata = {
        width: 800,
        height: 600,
        format: 'jpeg',
      };

      const mockInstance = mockSharp();
      mockInstance.metadata.mockResolvedValue(mockMetadata);
      mockInstance.toBuffer.mockResolvedValue(mockCompressedBuffer);

      const result = await service.createThumbnail(mockBuffer, 200, 200, { quality: 90 });

      expect(mockInstance.resize).toHaveBeenCalledWith({
        width: 200,
        height: 200,
        fit: 'cover',
        position: 'center',
        background: undefined,
      });
      expect(mockInstance.jpeg).toHaveBeenCalledWith({ quality: 90 });
      expect(result).toBeDefined();
    });
  });

  describe('optimizeForWeb', () => {
    it('should optimize image for web with default quality', async () => {
      const mockBuffer = Buffer.from('mock-image-data');
      const mockCompressedBuffer = Buffer.from('compressed-image-data');
      const mockMetadata = {
        width: 800,
        height: 600,
        format: 'jpeg',
      };

      const mockInstance = mockSharp();
      mockInstance.metadata.mockResolvedValue(mockMetadata);
      mockInstance.toBuffer.mockResolvedValue(mockCompressedBuffer);

      const result = await service.optimizeForWeb(mockBuffer);

      expect(mockInstance.webp).toHaveBeenCalledWith({ quality: 85 });
      expect(result).toBeDefined();
    });

    it('should optimize image for web with custom quality', async () => {
      const mockBuffer = Buffer.from('mock-image-data');
      const mockCompressedBuffer = Buffer.from('compressed-image-data');
      const mockMetadata = {
        width: 800,
        height: 600,
        format: 'jpeg',
      };

      const mockInstance = mockSharp();
      mockInstance.metadata.mockResolvedValue(mockMetadata);
      mockInstance.toBuffer.mockResolvedValue(mockCompressedBuffer);

      const result = await service.optimizeForWeb(mockBuffer, 95);

      expect(mockInstance.webp).toHaveBeenCalledWith({ quality: 95 });
      expect(result).toBeDefined();
    });
  });

  describe('getMetadata', () => {
    it('should get image metadata successfully', async () => {
      const mockBuffer = Buffer.from('mock-image-data');
      const mockMetadata = {
        width: 800,
        height: 600,
        format: 'jpeg',
        size: 1024,
      };

      const mockInstance = mockSharp();
      mockInstance.metadata.mockResolvedValue(mockMetadata);

      const result = await service.getMetadata(mockBuffer);

      expect(mockSharp).toHaveBeenCalledWith(mockBuffer);
      expect(result).toEqual(mockMetadata);
    });

    it('should handle metadata errors', async () => {
      const mockBuffer = Buffer.from('mock-image-data');
      const mockInstance = mockSharp();
      mockInstance.metadata.mockRejectedValue(new Error('Invalid image format'));

      await expect(service.getMetadata(mockBuffer)).rejects.toThrow(
        'Failed to get image metadata: Invalid image format',
      );
    });
  });

  describe('isValidImage', () => {
    it('should return true for valid image', async () => {
      const mockBuffer = Buffer.from('mock-image-data');
      const mockInstance = mockSharp();
      mockInstance.metadata.mockResolvedValue({});

      const result = await service.isValidImage(mockBuffer);

      expect(result).toBe(true);
    });

    it('should return false for invalid image', async () => {
      const mockBuffer = Buffer.from('invalid-image-data');
      const mockInstance = mockSharp();
      mockInstance.metadata.mockRejectedValue(new Error('Invalid image'));

      const result = await service.isValidImage(mockBuffer);

      expect(result).toBe(false);
    });
  });

  describe('batchCompress', () => {
    it('should compress multiple images successfully', async () => {
      const mockBuffer1 = Buffer.from('mock-image-1');
      const mockBuffer2 = Buffer.from('mock-image-2');
      const mockCompressedBuffer = Buffer.from('compressed-image-data');
      const mockMetadata = {
        width: 800,
        height: 600,
        format: 'jpeg',
      };

      const mockInstance = mockSharp();
      mockInstance.metadata.mockResolvedValue(mockMetadata);
      mockInstance.toBuffer.mockResolvedValue(mockCompressedBuffer);

      const images = [
        { buffer: mockBuffer1, options: { quality: 80 } },
        { buffer: mockBuffer2, options: { quality: 90 } },
      ];

      const results = await service.batchCompress(images);

      expect(results).toHaveLength(2);
      expect(results[0]).toBeDefined();
      expect(results[1]).toBeDefined();
    });

    it('should handle errors in batch compression', async () => {
      const mockBuffer1 = Buffer.from('mock-image-1');
      const mockBuffer2 = Buffer.from('mock-image-2');
      const mockInstance = mockSharp();
      mockInstance.metadata.mockRejectedValue(new Error('Invalid image'));

      const images = [
        { buffer: mockBuffer1, options: { quality: 80 } },
        { buffer: mockBuffer2, options: { quality: 90 } },
      ];

      await expect(service.batchCompress(images)).rejects.toThrow(
        'Failed to compress image 1: Failed to compress image: Invalid image',
      );
    });
  });

  describe('compressToSize', () => {
    it('should return original image if already at or below target size', async () => {
      const mockBuffer = Buffer.from('small-image-data');
      const targetSize = 1000; // Target size larger than image

      const result = await service.compressToSize(mockBuffer, targetSize);

      expect(result.originalSize).toBe(mockBuffer.length);
      expect(result.compressedSize).toBe(mockBuffer.length);
      expect(result.compressionRatio).toBe(0);
      expect(result.buffer).toEqual(mockBuffer);
    });

    it('should compress image to target size', async () => {
      const mockBuffer = Buffer.from('large-image-data-that-needs-compression');
      const mockCompressedBuffer = Buffer.from('compressed-image-data');
      const targetSize = 5; // Very small target to force compression
      const mockMetadata = {
        width: 800,
        height: 600,
        format: 'jpeg',
      };

      const mockInstance = mockSharp();
      mockInstance.metadata.mockResolvedValue(mockMetadata);
      mockInstance.toBuffer.mockResolvedValue(mockCompressedBuffer);

      const result = await service.compressToSize(mockBuffer, targetSize, { format: 'jpeg' });

      expect(result.compressedSize).toBe(mockCompressedBuffer.length);
      expect(result.compressionRatio).toBeGreaterThan(0);
      expect(result.originalSize).toBe(mockBuffer.length);
    });

    it('should handle errors during compression', async () => {
      const mockBuffer = Buffer.from('large-image');
      const targetSize = 5; // Small target to force compression
      const mockInstance = mockSharp();
      mockInstance.metadata.mockRejectedValue(new Error('Compression failed'));

      await expect(service.compressToSize(mockBuffer, targetSize)).rejects.toThrow(
        'Failed to compress image to size: Failed to compress image: Compression failed',
      );
    });

    it('should work with different formats', async () => {
      const mockBuffer = Buffer.from('large-image');
      const mockCompressedBuffer = Buffer.from('compressed-webp');
      const targetSize = 5; // Small target to force compression
      const mockMetadata = {
        width: 800,
        height: 600,
        format: 'webp',
      };

      const mockInstance = mockSharp();
      mockInstance.metadata.mockResolvedValue(mockMetadata);
      mockInstance.toBuffer.mockResolvedValue(mockCompressedBuffer);

      const result = await service.compressToSize(mockBuffer, targetSize, { format: 'webp' });

      expect(result.format).toBe('webp');
      expect(result.compressedSize).toBe(mockCompressedBuffer.length);
    });
  });

  describe('getRecommendedSettings', () => {
    it('should return profile settings', () => {
      const settings = service.getRecommendedSettings('profile');

      expect(settings).toEqual({
        width: 300,
        height: 300,
        fit: 'cover',
        format: 'jpeg',
        quality: 85,
      });
    });

    it('should return thumbnail settings', () => {
      const settings = service.getRecommendedSettings('thumbnail');

      expect(settings).toEqual({
        width: 150,
        height: 150,
        fit: 'cover',
        format: 'webp',
        quality: 80,
      });
    });

    it('should return banner settings', () => {
      const settings = service.getRecommendedSettings('banner');

      expect(settings).toEqual({
        width: 1200,
        height: 400,
        fit: 'cover',
        format: 'jpeg',
        quality: 90,
      });
    });

    it('should return gallery settings', () => {
      const settings = service.getRecommendedSettings('gallery');

      expect(settings).toEqual({
        width: 800,
        height: 600,
        fit: 'inside',
        format: 'webp',
        quality: 85,
      });
    });
  });

  describe('applyTransformations', () => {
    it('should apply all transformations correctly', async () => {
      const mockBuffer = Buffer.from('mock-image-data');
      const mockCompressedBuffer = Buffer.from('compressed-image-data');
      const mockMetadata = {
        width: 800,
        height: 600,
        format: 'jpeg',
      };

      const mockInstance = mockSharp();
      mockInstance.metadata.mockResolvedValue(mockMetadata);
      mockInstance.toBuffer.mockResolvedValue(mockCompressedBuffer);

      const options: ImageCompressionOptions = {
        width: 400,
        height: 300,
        rotate: 90,
        flip: true,
        flop: true,
        blur: 5,
        sharpen: 2,
        grayscale: true,
        format: 'png',
        quality: 85,
      };

      const result = await service.compressFromBuffer(mockBuffer, options);

      expect(mockInstance.resize).toHaveBeenCalledWith({
        width: 400,
        height: 300,
        fit: 'inside',
        position: 'center',
        background: undefined,
      });
      expect(mockInstance.rotate).toHaveBeenCalledWith(90);
      expect(mockInstance.flip).toHaveBeenCalled();
      expect(mockInstance.flop).toHaveBeenCalled();
      expect(mockInstance.blur).toHaveBeenCalledWith(5);
      expect(mockInstance.sharpen).toHaveBeenCalledWith(2);
      expect(mockInstance.grayscale).toHaveBeenCalled();
      expect(mockInstance.png).toHaveBeenCalledWith({ quality: 85 });
      expect(result).toBeDefined();
    });
  });
});
