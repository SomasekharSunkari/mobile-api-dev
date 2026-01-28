import { ConfigProvider } from './core/define-config';

export interface ResendConfig {
  apiKey: string;
  from: string;
  host?: string;
  port?: number;
  password?: string;
}

export class ResendConfigProvider extends ConfigProvider<ResendConfig> {
  getConfig(): ResendConfig {
    return {
      apiKey: process.env.RESEND_API_KEY || '',
      from: process.env.RESEND_FROM || '',
      host: process.env.RESEND_HOST || '',
      port: Number(process.env.RESEND_PORT) || 6379,
      password: process.env.RESEND_PASSWORD || undefined,
    };
  }
}
