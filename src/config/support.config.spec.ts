import { EnvironmentService } from './environment/environment.service';
import { SupportConfigProvider, SupportConfig } from './support.config';

jest.mock('./environment/environment.service');

describe('SupportConfigProvider', () => {
  let supportConfigProvider: SupportConfigProvider;

  beforeEach(() => {
    supportConfigProvider = new SupportConfigProvider();
    jest.clearAllMocks();
  });

  describe('getConfig', () => {
    it('should return support configuration with all required fields', () => {
      const mockConfig = {
        default_support_provider: 'zendesk',
      };

      (EnvironmentService.getValue as jest.Mock).mockImplementation((key: string) => {
        const envMap: Record<string, string> = {
          DEFAULT_SUPPORT_PROVIDER: mockConfig.default_support_provider,
        };
        return envMap[key];
      });

      const config = supportConfigProvider.getConfig();

      expect(config.default_support_provider).toBe(mockConfig.default_support_provider);
    });

    it('should call EnvironmentService.getValue for each config field', () => {
      (EnvironmentService.getValue as jest.Mock).mockReturnValue('test-value');

      supportConfigProvider.getConfig();

      expect(EnvironmentService.getValue).toHaveBeenCalledWith('DEFAULT_SUPPORT_PROVIDER');
    });

    it('should return SupportConfig interface compliant object', () => {
      (EnvironmentService.getValue as jest.Mock).mockReturnValue('zendesk');

      const config: SupportConfig = supportConfigProvider.getConfig();

      expect(config).toHaveProperty('default_support_provider');
    });
  });
});
