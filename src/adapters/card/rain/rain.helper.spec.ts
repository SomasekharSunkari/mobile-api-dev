import { InternalServerErrorException } from '@nestjs/common';
import { RainConfigProvider } from '../../../config/rain.config';
import { RainHelper } from './rain.helper';

// Mock RainConfigProvider
jest.mock('../../../config/rain.config');
const MockedRainConfigProvider = RainConfigProvider as jest.MockedClass<typeof RainConfigProvider>;

describe('RainHelper', () => {
  let rainHelper: RainHelper;
  let mockConfig: any;

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock configuration
    mockConfig = {
      pem: '-----BEGIN PUBLIC KEY-----\nMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA...\n-----END PUBLIC KEY-----',
      secret: '1234567890abcdef1234567890abcdef',
      apiKey: 'test-api-key',
      apiUrl: 'https://api.test.rain.com',
    };

    // Mock RainConfigProvider
    MockedRainConfigProvider.mockImplementation(() => ({
      getConfig: jest.fn().mockReturnValue(mockConfig),
    }));

    // Create instance
    rainHelper = new RainHelper();
  });

  describe('constructor', () => {
    it('should initialize with Rain configuration', () => {
      expect(MockedRainConfigProvider).toHaveBeenCalled();
    });
  });

  describe('generateSessionId', () => {
    it('should throw error when PEM is missing', async () => {
      const configWithoutPem = { ...mockConfig, pem: undefined };
      MockedRainConfigProvider.mockImplementation(() => ({
        getConfig: jest.fn().mockReturnValue(configWithoutPem),
      }));

      rainHelper = new RainHelper();

      await expect(rainHelper.generateSessionId()).rejects.toThrow(new InternalServerErrorException('Pem is required'));
    });

    it('should throw error when secret is not a valid hex string', async () => {
      const configWithInvalidSecret = { ...mockConfig, secret: 'invalid-hex-string' };
      MockedRainConfigProvider.mockImplementation(() => ({
        getConfig: jest.fn().mockReturnValue(configWithInvalidSecret),
      }));

      rainHelper = new RainHelper();

      await expect(rainHelper.generateSessionId()).rejects.toThrow(
        new InternalServerErrorException('Secret must be a hex string'),
      );
    });
  });

  describe('decryptSecret', () => {
    it('should throw error when base64Secret is missing', async () => {
      await expect(rainHelper.decryptSecret('', 'valid-iv')).rejects.toThrow(
        new InternalServerErrorException('Base64 secret is required'),
      );
    });

    it('should throw error when base64Iv is missing', async () => {
      await expect(rainHelper.decryptSecret('valid-secret', '')).rejects.toThrow(
        new InternalServerErrorException('Base64 IV is required'),
      );
    });

    it('should throw error when secret key is missing', async () => {
      const configWithoutSecret = { ...mockConfig, secret: undefined };
      MockedRainConfigProvider.mockImplementation(() => ({
        getConfig: jest.fn().mockReturnValue(configWithoutSecret),
      }));

      rainHelper = new RainHelper();

      await expect(rainHelper.decryptSecret('valid-secret', 'valid-iv')).rejects.toThrow(
        new InternalServerErrorException('Secret key must be a hex string'),
      );
    });

    it('should throw error when secret key is not a valid hex string', async () => {
      const configWithInvalidSecret = { ...mockConfig, secret: 'invalid-hex' };
      MockedRainConfigProvider.mockImplementation(() => ({
        getConfig: jest.fn().mockReturnValue(configWithInvalidSecret),
      }));

      rainHelper = new RainHelper();

      await expect(rainHelper.decryptSecret('valid-secret', 'valid-iv')).rejects.toThrow(
        new InternalServerErrorException('Secret key must be a hex string'),
      );
    });
  });

  describe('Error handling integration', () => {
    it('should handle configuration errors gracefully', () => {
      MockedRainConfigProvider.mockImplementation(() => {
        throw new Error('Config loading failed');
      });

      expect(() => new RainHelper()).toThrow('Config loading failed');
    });
  });
});
