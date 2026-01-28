import { ConfigProvider } from './core/define-config';
import { EnvironmentService } from './environment';

export interface SinchConfig {
  apiKey: string;
  servicePlanId: string;
  region: string;
  sender: string;
}

export class SinchConfigProvider extends ConfigProvider<SinchConfig> {
  getConfig(): SinchConfig {
    return {
      apiKey: EnvironmentService.getValue('SINCH_API_KEY') || '',
      servicePlanId: EnvironmentService.getValue('SINCH_SERVICE_PLAN_ID') || '',
      region: EnvironmentService.getValue('SINCH_REGION') || 'us',
      sender: EnvironmentService.getValue('SINCH_SENDER') || '',
    };
  }
}
