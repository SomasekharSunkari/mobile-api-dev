import { EnvironmentService } from '../config';

export const App = {
  environment: EnvironmentService.getValue('NODE_ENV'),
  development: 'development',
  production: 'production',
  staging: 'staging',
  isDevelopment: EnvironmentService.getValue('NODE_ENV') === 'development',
  isProduction: EnvironmentService.getValue('NODE_ENV') === 'production',
  isStaging: EnvironmentService.getValue('NODE_ENV') === 'staging',

  port: EnvironmentService.getValue('APP_PORT'),
};
