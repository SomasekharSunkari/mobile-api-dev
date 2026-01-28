import { EnvironmentService } from './environment/environment.service';
import { ZendeskConfigProvider, ZendeskConfig } from './zendesk.config';

jest.mock('./environment/environment.service');

describe('ZendeskConfigProvider', () => {
  let zendeskConfigProvider: ZendeskConfigProvider;

  beforeEach(() => {
    zendeskConfigProvider = new ZendeskConfigProvider();
    jest.clearAllMocks();
  });

  describe('getConfig', () => {
    it('should return zendesk configuration with all required fields', () => {
      const mockConfig = {
        apiUrl: 'https://example.zendesk.com/api/v2',
        email: 'test@example.com',
        apiToken: 'test-token',
        subdomain: 'example',
      };

      (EnvironmentService.getValue as jest.Mock).mockImplementation((key: string) => {
        const envMap: Record<string, string> = {
          ZENDESK_API_URL: mockConfig.apiUrl,
          ZENDESK_EMAIL: mockConfig.email,
          ZENDESK_API_TOKEN: mockConfig.apiToken,
          ZENDESK_SUBDOMAIN: mockConfig.subdomain,
        };
        return envMap[key];
      });

      const config = zendeskConfigProvider.getConfig();

      expect(config.apiUrl).toBe(mockConfig.apiUrl);
      expect(config.email).toBe(mockConfig.email);
      expect(config.apiToken).toBe(mockConfig.apiToken);
      expect(config.subdomain).toBe(mockConfig.subdomain);
    });

    it('should construct apiUrl from subdomain when ZENDESK_API_URL is not provided', () => {
      (EnvironmentService.getValue as jest.Mock).mockImplementation((key: string) => {
        const envMap: Record<string, string> = {
          ZENDESK_API_URL: '',
          ZENDESK_EMAIL: 'test@example.com',
          ZENDESK_API_TOKEN: 'test-token',
          ZENDESK_SUBDOMAIN: 'example',
        };
        return envMap[key] || '';
      });

      const config = zendeskConfigProvider.getConfig();

      expect(config.apiUrl).toBe('https://example.zendesk.com/api/v2');
    });

    it('should use ZENDESK_API_URL when provided', () => {
      (EnvironmentService.getValue as jest.Mock).mockImplementation((key: string) => {
        const envMap: Record<string, string> = {
          ZENDESK_API_URL: 'https://custom.zendesk.com/api/v2',
          ZENDESK_EMAIL: 'test@example.com',
          ZENDESK_API_TOKEN: 'test-token',
          ZENDESK_SUBDOMAIN: 'example',
        };
        return envMap[key] || '';
      });

      const config = zendeskConfigProvider.getConfig();

      expect(config.apiUrl).toBe('https://custom.zendesk.com/api/v2');
    });

    it('should call EnvironmentService.getValue for each config field', () => {
      (EnvironmentService.getValue as jest.Mock).mockReturnValue('test-value');

      zendeskConfigProvider.getConfig();

      expect(EnvironmentService.getValue).toHaveBeenCalledWith('ZENDESK_API_URL');
      expect(EnvironmentService.getValue).toHaveBeenCalledWith('ZENDESK_EMAIL');
      expect(EnvironmentService.getValue).toHaveBeenCalledWith('ZENDESK_API_TOKEN');
      expect(EnvironmentService.getValue).toHaveBeenCalledWith('ZENDESK_SUBDOMAIN');
    });

    it('should return ZendeskConfig interface compliant object', () => {
      (EnvironmentService.getValue as jest.Mock).mockReturnValue('test');

      const config: ZendeskConfig = zendeskConfigProvider.getConfig();

      expect(config).toHaveProperty('apiUrl');
      expect(config).toHaveProperty('email');
      expect(config).toHaveProperty('apiToken');
      expect(config).toHaveProperty('subdomain');
    });
  });
});
