import { EnvironmentService } from './environment/environment.service';
import { RainConfigProvider, RainConfig } from './rain.config';

jest.mock('./environment/environment.service');

describe('RainConfigProvider', () => {
  let rainConfigProvider: RainConfigProvider;

  beforeEach(() => {
    rainConfigProvider = new RainConfigProvider();
    jest.clearAllMocks();
  });

  describe('getConfig', () => {
    it('should return rain configuration with all required fields', () => {
      const mockConfig = {
        apiKey: 'test-api-key',
        apiUrl: 'https://api.rain.com',
        pem: 'test-pem-content',
        secret: 'test-secret',
        clientId: 'test-client-id',
        webhookSigningKey: 'test-signing-key',
      };

      (EnvironmentService.getValue as jest.Mock).mockImplementation((key: string) => {
        const envMap: Record<string, string> = {
          RAIN_API_KEY: mockConfig.apiKey,
          RAIN_BASE_URL: mockConfig.apiUrl,
          RAIN_PEM: mockConfig.pem,
          RAIN_SECRET: mockConfig.secret,
          RAIN_CLIENT_ID: mockConfig.clientId,
          RAIN_WEBHOOK_SIGNING_KEY: mockConfig.webhookSigningKey,
        };
        return envMap[key];
      });

      const config = rainConfigProvider.getConfig();

      expect(config.apiKey).toBe(mockConfig.apiKey);
      expect(config.apiUrl).toBe(mockConfig.apiUrl);
      expect(config.pem).toBe(mockConfig.pem);
      expect(config.secret).toBe(mockConfig.secret);
      expect(config.clientId).toBe(mockConfig.clientId);
      expect(config.webhookSigningKey).toBe(mockConfig.webhookSigningKey);
    });

    it('should call EnvironmentService.getValue for each config field', () => {
      (EnvironmentService.getValue as jest.Mock).mockReturnValue('test-value');

      rainConfigProvider.getConfig();

      expect(EnvironmentService.getValue).toHaveBeenCalledWith('RAIN_API_KEY');
      expect(EnvironmentService.getValue).toHaveBeenCalledWith('RAIN_BASE_URL');
      expect(EnvironmentService.getValue).toHaveBeenCalledWith('RAIN_PEM');
      expect(EnvironmentService.getValue).toHaveBeenCalledWith('RAIN_SECRET');
      expect(EnvironmentService.getValue).toHaveBeenCalledWith('RAIN_CLIENT_ID');
      expect(EnvironmentService.getValue).toHaveBeenCalledWith('RAIN_WEBHOOK_SIGNING_KEY');
    });

    it('should return RainConfig interface compliant object', () => {
      (EnvironmentService.getValue as jest.Mock).mockReturnValue('test');

      const config: RainConfig = rainConfigProvider.getConfig();

      expect(config).toHaveProperty('apiKey');
      expect(config).toHaveProperty('apiUrl');
      expect(config).toHaveProperty('pem');
      expect(config).toHaveProperty('secret');
      expect(config).toHaveProperty('clientId');
      expect(config).toHaveProperty('webhookSigningKey');
    });
  });
});
