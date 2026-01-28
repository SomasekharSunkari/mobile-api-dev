import { ConfigProvider } from './core/define-config';
import { EnvironmentService } from './environment/environment.service';

export interface SupportConfig {
  /** Default support provider */
  default_support_provider: string;
}

export class SupportConfigProvider extends ConfigProvider<SupportConfig> {
  getConfig(): SupportConfig {
    return {
      default_support_provider: EnvironmentService.getValue('DEFAULT_SUPPORT_PROVIDER'),
    };
  }
}
