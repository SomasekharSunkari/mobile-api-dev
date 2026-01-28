import { ConfigProvider } from './core/define-config';
import { EnvironmentService } from './environment/environment.service';

export interface OtpConfig {
  expirationMinutes: number;
  maxAttempts: number;
}

export interface RiskScoreConfig {
  newDevice: number;
  countryChange: number;
  regionChange: number;
  cityChange: number;
  vpnUsage: number;
}

export interface LoginSecurityConfig {
  maxAttempts: number;
  windowSeconds: number;
  lockoutDurationSeconds: number;
  smsOtpThreshold: number;
  otp: OtpConfig;
  riskScores: RiskScoreConfig;
}

export class LoginSecurityConfigProvider extends ConfigProvider<LoginSecurityConfig> {
  getConfig(): LoginSecurityConfig {
    const getRequiredEnvVar = (envVar: string): number => {
      const value = EnvironmentService.getValue(envVar as any);
      if (!value) {
        throw new Error(`Required environment variable ${envVar} is not set`);
      }
      const numValue = Number(value);
      if (Number.isNaN(numValue)) {
        throw new Error(`Environment variable ${envVar} must be a valid number, got: ${value}`);
      }
      return numValue;
    };

    const otpConfig: OtpConfig = {
      expirationMinutes: getRequiredEnvVar('LOGIN_SECURITY_CONFIG_OTP_EXPIRATION_MINUTES'),
      maxAttempts: getRequiredEnvVar('LOGIN_SECURITY_CONFIG_OTP_MAX_ATTEMPTS'),
    };

    const riskScoreConfig: RiskScoreConfig = {
      newDevice: getRequiredEnvVar('LOGIN_SECURITY_CONFIG_RISK_SCORE_NEW_DEVICE'),
      countryChange: getRequiredEnvVar('LOGIN_SECURITY_CONFIG_RISK_SCORE_COUNTRY_CHANGE'),
      regionChange: getRequiredEnvVar('LOGIN_SECURITY_CONFIG_RISK_SCORE_REGION_CHANGE'),
      cityChange: getRequiredEnvVar('LOGIN_SECURITY_CONFIG_RISK_SCORE_CITY_CHANGE'),
      vpnUsage: getRequiredEnvVar('LOGIN_SECURITY_CONFIG_RISK_SCORE_VPN_USAGE'),
    };

    return {
      maxAttempts: getRequiredEnvVar('LOGIN_SECURITY_CONFIG_MAX_ATTEMPTS'),
      windowSeconds: getRequiredEnvVar('LOGIN_SECURITY_CONFIG_WINDOW_SECONDS'),
      lockoutDurationSeconds: getRequiredEnvVar('LOGIN_SECURITY_CONFIG_LOCKOUT_DURATION_SECONDS'),
      smsOtpThreshold: getRequiredEnvVar('LOGIN_SECURITY_CONFIG_SMS_OTP_THRESHOLD'),
      otp: otpConfig,
      riskScores: riskScoreConfig,
    };
  }
}
