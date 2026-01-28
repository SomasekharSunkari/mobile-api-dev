export interface ImageCompressionOptions {
  quality?: number; // 1-100
  format?: 'jpeg' | 'png' | 'webp' | 'avif';
  width?: number;
  height?: number;
  fit?: 'cover' | 'contain' | 'fill' | 'inside' | 'outside';
  position?: 'top' | 'right top' | 'right' | 'right bottom' | 'bottom' | 'left bottom' | 'left' | 'left top' | 'center';
  background?: string;
  blur?: number; // 0.3-1000
  sharpen?: number; // 0.3-1000
  grayscale?: boolean;
  rotate?: number; // 0, 90, 180, 270
  flip?: boolean;
  flop?: boolean;
}

export interface CompressionResult {
  originalSize: number;
  compressedSize: number;
  compressionRatio: number;
  format: string;
  width: number;
  height: number;
  buffer: Buffer;
}
