import { Injectable, LogLevel } from '@nestjs/common';
import * as env from 'dotenv';
import { IEnvironmentVariables } from './environment.interface';

// load all env
env.config();

@Injectable()
export class EnvironmentService {
  // get all values from env
  public static getValues(): IEnvironmentVariables {
    return {
      app_name: process.env.APP_NAME,
      app_port: Number(process.env.APP_PORT),
      app_host: process.env.APP_HOST,
      node_env: process.env.NODE_ENV,
      logger_levels: (process.env.LOGGER_LEVELS?.split(',') as LogLevel[]) || ['info', 'debug', 'error', 'warn', 'log'],
      cors_origins: process.env.CORS_ORIGINS,
      db_name: process.env.DB_NAME,
      db_user: process.env.DB_USER,
      db_host: process.env.DB_HOST,
      db_password: process.env.DB_PASSWORD,
      db_driver: process.env.DB_DRIVER,
      db_port: Number(process.env.DB_PORT),
      db_ssl: process.env.DB_SSL === 'true',

      jwt_secret_token: process.env.JWT_SECRET_TOKEN,

      ipinfo_token: process.env.IPINFO_TOKEN,
      ipinfo_url: process.env.IPINFO_URL,

      // Redis configuration
      redis_host: process.env.REDIS_HOST,
      redis_port: Number(process.env.REDIS_PORT),
      redis_password: process.env.REDIS_PASSWORD,
      redis_db: Number(process.env.REDIS_DB),
      redis_enable_tls: process.env.REDIS_ENABLE_TLS === 'true',

      // Sinch configuration
      sinch_api_key: process.env.SINCH_API_KEY,
      sinch_service_plan_id: process.env.SINCH_SERVICE_PLAN_ID,
      sinch_region: process.env.SINCH_REGION,
      sinch_sender: process.env.SINCH_SENDER,

      // hibp configuration
      hibp_url: process.env.HIBP_URL,

      // Zerohash configuration
      zerohash_api_key: process.env.ZEROHASH_API_KEY,
      zerohash_api_url: process.env.ZEROHASH_API_URL,
      zerohash_api_secret: process.env.ZEROHASH_API_SECRET,
      zerohash_api_passphrase: process.env.ZEROHASH_API_PASSPHRASE,
      zerohash_rsa_public_key: process.env.ZEROHASH_RSA_PUBLIC_KEY,
      default_underlying_currency: process.env.DEFAULT_UNDERLYING_CURRENCY,
      default_participant_countries: process.env.DEFAULT_PARTICIPANT_COUNTRIES,

      // Default KYC provider
      default_kyc_provider: process.env.DEFAULT_KYC_PROVIDER,

      // Default USA KYC provider
      default_us_kyc_provider: process.env.DEFAULT_US_KYC_PROVIDER,

      plaid_client_id: process.env.PLAID_CLIENT_ID,
      plaid_secret: process.env.PLAID_SECRET,
      plaid_env: process.env.PLAID_ENV,
      plaid_webhook: process.env.PLAID_WEBHOOK,
      plaid_redirect_uri: process.env.PLAID_REDIRECT_URI,
      plaid_signal_ruleset_key: process.env.PLAID_SIGNAL_RULESET_KEY,

      // aiprise configuration
      aiprise_api_key: process.env.AIPRISE_API_KEY,
      aiprise_api_url: process.env.AIPRISE_API_URL,

      // default ngn kyc provider
      default_ng_kyc_provider: process.env.DEFAULT_NG_KYC_PROVIDER,

      // waas providers configuration,
      default_ng_waas_adapter: process.env.DEFAULT_NG_WAAS_ADAPTER,

      // encryption configuration
      encryption_key: process.env.ENCRYPTION_KEY,
      encryption_iv: process.env.ENCRYPTION_IV,

      // zerohash webhook url
      zerohash_webhook_url: process.env.ZEROHASH_WEBHOOK_URL,

      // fireblocks configuration
      fireblocks_api_key: process.env.FIREBLOCKS_API_KEY,
      fireblocks_private_key: process.env.FIREBLOCKS_PRIVATE_KEY,
      fireblocks_base_url: process.env.FIREBLOCKS_BASE_URL,
      fireblocks_timeout: Number(process.env.FIREBLOCKS_TIMEOUT),
      fireblocks_webhook_public_key: process.env.FIREBLOCKS_WEBHOOK_PUBLIC_KEY,
      default_blockchain_waas_adapter: process.env.DEFAULT_BLOCKCHAIN_WAAS_ADAPTER,

      // rain configuration
      rain_api_key: process.env.RAIN_API_KEY,
      rain_base_url: process.env.RAIN_BASE_URL,
      // sumsub configurations
      sumsub_api_url: process.env.SUMSUB_API_URL,
      sumsub_app_token: process.env.SUMSUB_APP_TOKEN,
      sumsub_secret_key: process.env.SUMSUB_SECRET_KEY,
      sumsub_webhook_secret_key: process.env.SUMSUB_WEBHOOK_SECRET_KEY,

      // rain pem
      rain_pem: process.env.RAIN_PEM,
      rain_secret: process.env.RAIN_SECRET,
      rain_client_id: process.env.RAIN_CLIENT_ID,
      rain_webhook_signing_key: process.env.RAIN_WEBHOOK_SIGNING_KEY,
      // card config
      default_card_provider: process.env.DEFAULT_CARD_PROVIDER,

      // yellowcard configurations
      yellowcard_public_key: process.env.YELLOWCARD_PUBLIC_KEY,
      yellowcard_secret_key: process.env.YELLOWCARD_SECRET_KEY,
      yellowcard_api_url: process.env.YELLOWCARD_API_URL,
      yellowcard_webhook_secret_key: process.env.YELLOWCARD_WEBHOOK_SECRET_KEY,

      // exchange config
      default_exchange_provider: process.env.DEFAULT_EXCHANGE_PROVIDER,

      // loki config
      loki_url: process.env.LOKI_URL,

      // fiat wallet config
      default_usd_fiat_wallet_provider: process.env.DEFAULT_USD_FIAT_WALLET_PROVIDER,
      default_ngn_fiat_wallet_provider: process.env.DEFAULT_NGN_FIAT_WALLET_PROVIDER,

      // zerohash account group
      zerohash_account_group: process.env.ZEROHASH_ACCOUNT_GROUP,

      // firebase config
      firebase_secret_json: process.env.FIREBASE_SECRET_JSON,

      // aws s3 config
      aws_s3_region: process.env.AWS_S3_REGION,
      aws_s3_access_key_id: process.env.AWS_S3_ACCESS_KEY_ID,
      aws_s3_secret_access_key: process.env.AWS_S3_SECRET_ACCESS_KEY,
      aws_s3_bucket_name: process.env.AWS_S3_BUCKET_NAME,
      aws_s3_endpoint: process.env.AWS_S3_ENDPOINT,
      aws_s3_force_path_style: process.env.AWS_S3_FORCE_PATH_STYLE,
      aws_s3_signature_version: process.env.AWS_S3_SIGNATURE_VERSION,
      aws_s3_max_file_size: process.env.AWS_S3_MAX_FILE_SIZE,
      aws_s3_allowed_mime_types: process.env.AWS_S3_ALLOWED_MIME_TYPES,
      aws_s3_url_expiration_time: process.env.AWS_S3_URL_EXPIRATION_TIME,
      aws_s3_enable_encryption: process.env.AWS_S3_ENABLE_ENCRYPTION,
      aws_s3_encryption_algorithm: process.env.AWS_S3_ENCRYPTION_ALGORITHM,
      aws_s3_public_read_path: process.env.AWS_S3_PUBLIC_READ_PATH,
      aws_s3_private_read_path: process.env.AWS_S3_PRIVATE_READ_PATH,

      // paga configurations
      paga_username: process.env.PAGA_USERNAME,
      paga_credential: process.env.PAGA_CREDENTIAL,
      paga_collect_api_url: process.env.PAGA_COLLECT_API_URL,
      paga_business_api_url: process.env.PAGA_BUSINESS_API_URL,
      paga_hmac: process.env.PAGA_HMAC,
      paga_webhook_username: process.env.PAGA_WEBHOOK_USERNAME,
      paga_webhook_password: process.env.PAGA_WEBHOOK_PASSWORD,
      // login security configuration
      login_security_config_max_attempts: Number(process.env.LOGIN_SECURITY_CONFIG_MAX_ATTEMPTS || 10),
      login_security_config_window_seconds: Number(process.env.LOGIN_SECURITY_CONFIG_WINDOW_SECONDS || 3600),
      login_security_config_lockout_duration_seconds: Number(
        process.env.LOGIN_SECURITY_CONFIG_LOCKOUT_DURATION_SECONDS || 900,
      ),
      login_security_config_sms_otp_threshold: Number(process.env.LOGIN_SECURITY_CONFIG_SMS_OTP_THRESHOLD || 50),
      login_security_config_otp_expiration_minutes: Number(
        process.env.LOGIN_SECURITY_CONFIG_OTP_EXPIRATION_MINUTES || 10,
      ),
      login_security_config_otp_max_attempts: Number(process.env.LOGIN_SECURITY_CONFIG_OTP_MAX_ATTEMPTS || 5),
      login_security_config_risk_score_new_device: Number(
        process.env.LOGIN_SECURITY_CONFIG_RISK_SCORE_NEW_DEVICE || 40,
      ),
      login_security_config_risk_score_country_change: Number(
        process.env.LOGIN_SECURITY_CONFIG_RISK_SCORE_COUNTRY_CHANGE || 30,
      ),
      login_security_config_risk_score_region_change: Number(
        process.env.LOGIN_SECURITY_CONFIG_RISK_SCORE_REGION_CHANGE || 15,
      ),
      login_security_config_risk_score_city_change: Number(
        process.env.LOGIN_SECURITY_CONFIG_RISK_SCORE_CITY_CHANGE || 10,
      ),
      login_security_config_risk_score_vpn_usage: Number(process.env.LOGIN_SECURITY_CONFIG_RISK_SCORE_VPN_USAGE || 15),

      // logging config
      colorized_logs: process.env.COLORIZED_LOGS?.toLowerCase() === 'true',
      disable_winston_logs: process.env.DISABLE_WINSTON_LOGS?.toLowerCase() === 'true',
      disable_login_region_check: process.env.DISABLE_LOGIN_REGION_CHECK?.toLowerCase() === 'true',

      // support config
      default_support_provider: process.env.DEFAULT_SUPPORT_PROVIDER,

      // zendesk config
      zendesk_api_url: process.env.ZENDESK_API_URL,
      zendesk_subdomain: process.env.ZENDESK_SUBDOMAIN,
      zendesk_email: process.env.ZENDESK_EMAIL,
      zendesk_api_token: process.env.ZENDESK_API_TOKEN,
      zendesk_api_key: process.env.ZENDESK_API_KEY,
      zendesk_jwt_key_id: process.env.ZENDESK_JWT_KEY_ID,
      zendesk_jwt_shared_secret: process.env.ZENDESK_JWT_SHARED_SECRET,

      // business config
      business_name: process.env.BUSINESS_NAME,
      business_cac_number: process.env.BUSINESS_CAC_NUMBER,
      business_phone: process.env.BUSINESS_PHONE,
      business_email: process.env.BUSINESS_EMAIL,
    };
  }

  // get single value from env
  public static getValue(envName: Uppercase<keyof IEnvironmentVariables>, defaultValue?: string) {
    return EnvironmentService.getValues()[envName.toLowerCase()] || defaultValue;
  }

  public static isDevelopment() {
    return EnvironmentService.getValue('NODE_ENV') === 'development';
  }

  public static isProduction(): boolean {
    return EnvironmentService.getValue('NODE_ENV') === 'production';
  }

  public static isTest(): boolean {
    return EnvironmentService.getValue('NODE_ENV') === 'test';
  }
  public static isStaging(): boolean {
    return EnvironmentService.getValue('NODE_ENV') === 'staging';
  }
}
