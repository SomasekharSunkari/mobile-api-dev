import { EnvironmentService } from './environment.service';

describe('EnvironmentService', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv, APP_NAME: 'DefaultApp' };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe('getValues', () => {
    it('should return all environment variables with correct values', () => {
      process.env.APP_NAME = 'TestApp';
      process.env.APP_PORT = '3000';
      process.env.APP_HOST = 'localhost';
      process.env.NODE_ENV = 'development';
      process.env.CORS_ORIGINS = 'http://localhost:3000';
      process.env.DB_NAME = 'test_db';
      process.env.DB_USER = 'test_user';
      process.env.DB_HOST = 'localhost';
      process.env.DB_PASSWORD = 'password';
      process.env.DB_DRIVER = 'pg';
      process.env.DB_PORT = '5432';
      process.env.DB_SSL = 'true';

      const values = EnvironmentService.getValues();

      expect(values.app_name).toBe('TestApp');
      expect(values.app_port).toBe(3000);
      expect(values.app_host).toBe('localhost');
      expect(values.node_env).toBe('development');
      expect(values.cors_origins).toBe('http://localhost:3000');
      expect(values.db_name).toBe('test_db');
      expect(values.db_user).toBe('test_user');
      expect(values.db_host).toBe('localhost');
      expect(values.db_password).toBe('password');
      expect(values.db_driver).toBe('pg');
      expect(values.db_port).toBe(5432);
      expect(values.db_ssl).toBe(true);
    });

    it('should parse logger levels from comma-separated string', () => {
      process.env.LOGGER_LEVELS = 'info,debug,error';

      const values = EnvironmentService.getValues();

      expect(values.logger_levels).toEqual(['info', 'debug', 'error']);
    });

    it('should return default logger levels when LOGGER_LEVELS is not set', () => {
      delete process.env.LOGGER_LEVELS;

      const values = EnvironmentService.getValues();

      expect(values.logger_levels).toEqual(['info', 'debug', 'error', 'warn', 'log']);
    });

    it('should parse boolean values correctly for DB_SSL', () => {
      process.env.DB_SSL = 'true';
      let values = EnvironmentService.getValues();
      expect(values.db_ssl).toBe(true);

      process.env.DB_SSL = 'false';
      values = EnvironmentService.getValues();
      expect(values.db_ssl).toBe(false);

      process.env.DB_SSL = 'invalid';
      values = EnvironmentService.getValues();
      expect(values.db_ssl).toBe(false);
    });

    it('should parse boolean values correctly for redis_enable_tls', () => {
      process.env.REDIS_ENABLE_TLS = 'true';
      let values = EnvironmentService.getValues();
      expect(values.redis_enable_tls).toBe(true);

      process.env.REDIS_ENABLE_TLS = 'false';
      values = EnvironmentService.getValues();
      expect(values.redis_enable_tls).toBe(false);
    });

    it('should parse numeric values correctly', () => {
      process.env.APP_PORT = '8080';
      process.env.DB_PORT = '5432';
      process.env.REDIS_PORT = '6379';
      process.env.REDIS_DB = '1';
      process.env.FIREBLOCKS_TIMEOUT = '30000';

      const values = EnvironmentService.getValues();

      expect(values.app_port).toBe(8080);
      expect(values.db_port).toBe(5432);
      expect(values.redis_port).toBe(6379);
      expect(values.redis_db).toBe(1);
      expect(values.fireblocks_timeout).toBe(30000);
    });

    it('should return NaN for invalid numeric values', () => {
      process.env.APP_PORT = 'invalid';

      const values = EnvironmentService.getValues();

      expect(values.app_port).toBeNaN();
    });

    it('should return redis configuration correctly', () => {
      process.env.REDIS_HOST = 'redis.local';
      process.env.REDIS_PORT = '6379';
      process.env.REDIS_PASSWORD = 'redis_password';
      process.env.REDIS_DB = '0';
      process.env.REDIS_ENABLE_TLS = 'true';

      const values = EnvironmentService.getValues();

      expect(values.redis_host).toBe('redis.local');
      expect(values.redis_port).toBe(6379);
      expect(values.redis_password).toBe('redis_password');
      expect(values.redis_db).toBe(0);
      expect(values.redis_enable_tls).toBe(true);
    });

    it('should return sinch configuration correctly', () => {
      process.env.SINCH_API_KEY = 'sinch_key';
      process.env.SINCH_SERVICE_PLAN_ID = 'plan_id';
      process.env.SINCH_REGION = 'us';
      process.env.SINCH_SENDER = 'sender';

      const values = EnvironmentService.getValues();

      expect(values.sinch_api_key).toBe('sinch_key');
      expect(values.sinch_service_plan_id).toBe('plan_id');
      expect(values.sinch_region).toBe('us');
      expect(values.sinch_sender).toBe('sender');
    });

    it('should return zerohash configuration correctly', () => {
      process.env.ZEROHASH_API_KEY = 'zh_key';
      process.env.ZEROHASH_API_URL = 'https://api.zerohash.com';
      process.env.ZEROHASH_API_SECRET = 'zh_secret';
      process.env.ZEROHASH_API_PASSPHRASE = 'zh_passphrase';
      process.env.ZEROHASH_RSA_PUBLIC_KEY = 'rsa_key';
      process.env.ZEROHASH_ACCOUNT_GROUP = 'account_group';
      process.env.ZEROHASH_WEBHOOK_URL = 'https://webhook.url';

      const values = EnvironmentService.getValues();

      expect(values.zerohash_api_key).toBe('zh_key');
      expect(values.zerohash_api_url).toBe('https://api.zerohash.com');
      expect(values.zerohash_api_secret).toBe('zh_secret');
      expect(values.zerohash_api_passphrase).toBe('zh_passphrase');
      expect(values.zerohash_rsa_public_key).toBe('rsa_key');
      expect(values.zerohash_account_group).toBe('account_group');
      expect(values.zerohash_webhook_url).toBe('https://webhook.url');
    });

    it('should return plaid configuration correctly', () => {
      process.env.PLAID_CLIENT_ID = 'plaid_client';
      process.env.PLAID_SECRET = 'plaid_secret';
      process.env.PLAID_ENV = 'sandbox';
      process.env.PLAID_WEBHOOK = 'https://webhook.plaid.com';
      process.env.PLAID_REDIRECT_URI = 'https://redirect.uri';
      process.env.PLAID_SIGNAL_RULESET_KEY = 'ruleset_key';

      const values = EnvironmentService.getValues();

      expect(values.plaid_client_id).toBe('plaid_client');
      expect(values.plaid_secret).toBe('plaid_secret');
      expect(values.plaid_env).toBe('sandbox');
      expect(values.plaid_webhook).toBe('https://webhook.plaid.com');
      expect(values.plaid_redirect_uri).toBe('https://redirect.uri');
      expect(values.plaid_signal_ruleset_key).toBe('ruleset_key');
    });

    it('should return fireblocks configuration correctly', () => {
      process.env.FIREBLOCKS_API_KEY = 'fb_key';
      process.env.FIREBLOCKS_PRIVATE_KEY = 'fb_private_key';
      process.env.FIREBLOCKS_BASE_URL = 'https://api.fireblocks.io';
      process.env.FIREBLOCKS_TIMEOUT = '30000';
      process.env.FIREBLOCKS_WEBHOOK_PUBLIC_KEY = 'fb_webhook_key';

      const values = EnvironmentService.getValues();

      expect(values.fireblocks_api_key).toBe('fb_key');
      expect(values.fireblocks_private_key).toBe('fb_private_key');
      expect(values.fireblocks_base_url).toBe('https://api.fireblocks.io');
      expect(values.fireblocks_timeout).toBe(30000);
      expect(values.fireblocks_webhook_public_key).toBe('fb_webhook_key');
    });

    it('should return sumsub configuration correctly', () => {
      process.env.SUMSUB_API_URL = 'https://api.sumsub.com';
      process.env.SUMSUB_APP_TOKEN = 'sumsub_token';
      process.env.SUMSUB_SECRET_KEY = 'sumsub_secret';
      process.env.SUMSUB_WEBHOOK_SECRET_KEY = 'sumsub_webhook_secret';

      const values = EnvironmentService.getValues();

      expect(values.sumsub_api_url).toBe('https://api.sumsub.com');
      expect(values.sumsub_app_token).toBe('sumsub_token');
      expect(values.sumsub_secret_key).toBe('sumsub_secret');
      expect(values.sumsub_webhook_secret_key).toBe('sumsub_webhook_secret');
    });

    it('should return rain configuration correctly', () => {
      process.env.RAIN_API_KEY = 'rain_key';
      process.env.RAIN_BASE_URL = 'https://api.rain.com';
      process.env.RAIN_PEM = 'rain_pem';
      process.env.RAIN_SECRET = 'rain_secret';
      process.env.RAIN_CLIENT_ID = 'rain_client';
      process.env.RAIN_WEBHOOK_SIGNING_KEY = 'rain_webhook_key';

      const values = EnvironmentService.getValues();

      expect(values.rain_api_key).toBe('rain_key');
      expect(values.rain_base_url).toBe('https://api.rain.com');
      expect(values.rain_pem).toBe('rain_pem');
      expect(values.rain_secret).toBe('rain_secret');
      expect(values.rain_client_id).toBe('rain_client');
      expect(values.rain_webhook_signing_key).toBe('rain_webhook_key');
    });

    it('should return yellowcard configuration correctly', () => {
      process.env.YELLOWCARD_PUBLIC_KEY = 'yc_public';
      process.env.YELLOWCARD_SECRET_KEY = 'yc_secret';
      process.env.YELLOWCARD_API_URL = 'https://api.yellowcard.io';
      process.env.YELLOWCARD_WEBHOOK_SECRET_KEY = 'yc_webhook_secret';

      const values = EnvironmentService.getValues();

      expect(values.yellowcard_public_key).toBe('yc_public');
      expect(values.yellowcard_secret_key).toBe('yc_secret');
      expect(values.yellowcard_api_url).toBe('https://api.yellowcard.io');
      expect(values.yellowcard_webhook_secret_key).toBe('yc_webhook_secret');
    });

    it('should return paga configuration correctly', () => {
      process.env.PAGA_USERNAME = 'paga_user';
      process.env.PAGA_CREDENTIAL = 'paga_cred';
      process.env.PAGA_COLLECT_API_URL = 'https://collect.paga.com';
      process.env.PAGA_BUSINESS_API_URL = 'https://business.paga.com';
      process.env.PAGA_HMAC = 'paga_hmac';
      process.env.PAGA_WEBHOOK_USERNAME = 'webhook_user';
      process.env.PAGA_WEBHOOK_PASSWORD = 'webhook_pass';

      const values = EnvironmentService.getValues();

      expect(values.paga_username).toBe('paga_user');
      expect(values.paga_credential).toBe('paga_cred');
      expect(values.paga_collect_api_url).toBe('https://collect.paga.com');
      expect(values.paga_business_api_url).toBe('https://business.paga.com');
      expect(values.paga_hmac).toBe('paga_hmac');
      expect(values.paga_webhook_username).toBe('webhook_user');
      expect(values.paga_webhook_password).toBe('webhook_pass');
    });

    it('should return AWS S3 configuration correctly', () => {
      process.env.AWS_S3_REGION = 'us-east-1';
      process.env.AWS_S3_ACCESS_KEY_ID = 's3_access_key';
      process.env.AWS_S3_SECRET_ACCESS_KEY = 's3_secret';
      process.env.AWS_S3_BUCKET_NAME = 'test-bucket';
      process.env.AWS_S3_ENDPOINT = 'https://s3.amazonaws.com';
      process.env.AWS_S3_FORCE_PATH_STYLE = 'true';
      process.env.AWS_S3_SIGNATURE_VERSION = 'v4';
      process.env.AWS_S3_MAX_FILE_SIZE = '10485760';
      process.env.AWS_S3_ALLOWED_MIME_TYPES = 'image/png,image/jpeg';
      process.env.AWS_S3_URL_EXPIRATION_TIME = '3600';
      process.env.AWS_S3_ENABLE_ENCRYPTION = 'true';
      process.env.AWS_S3_ENCRYPTION_ALGORITHM = 'AES256';
      process.env.AWS_S3_PUBLIC_READ_PATH = 'public/';
      process.env.AWS_S3_PRIVATE_READ_PATH = 'private/';

      const values = EnvironmentService.getValues();

      expect(values.aws_s3_region).toBe('us-east-1');
      expect(values.aws_s3_access_key_id).toBe('s3_access_key');
      expect(values.aws_s3_secret_access_key).toBe('s3_secret');
      expect(values.aws_s3_bucket_name).toBe('test-bucket');
      expect(values.aws_s3_endpoint).toBe('https://s3.amazonaws.com');
      expect(values.aws_s3_force_path_style).toBe('true');
      expect(values.aws_s3_signature_version).toBe('v4');
      expect(values.aws_s3_max_file_size).toBe('10485760');
      expect(values.aws_s3_allowed_mime_types).toBe('image/png,image/jpeg');
      expect(values.aws_s3_url_expiration_time).toBe('3600');
      expect(values.aws_s3_enable_encryption).toBe('true');
      expect(values.aws_s3_encryption_algorithm).toBe('AES256');
      expect(values.aws_s3_public_read_path).toBe('public/');
      expect(values.aws_s3_private_read_path).toBe('private/');
    });

    it('should return login security configuration with default values', () => {
      delete process.env.LOGIN_SECURITY_CONFIG_MAX_ATTEMPTS;
      delete process.env.LOGIN_SECURITY_CONFIG_WINDOW_SECONDS;
      delete process.env.LOGIN_SECURITY_CONFIG_LOCKOUT_DURATION_SECONDS;
      delete process.env.LOGIN_SECURITY_CONFIG_SMS_OTP_THRESHOLD;
      delete process.env.LOGIN_SECURITY_CONFIG_OTP_EXPIRATION_MINUTES;
      delete process.env.LOGIN_SECURITY_CONFIG_OTP_MAX_ATTEMPTS;
      delete process.env.LOGIN_SECURITY_CONFIG_RISK_SCORE_NEW_DEVICE;
      delete process.env.LOGIN_SECURITY_CONFIG_RISK_SCORE_COUNTRY_CHANGE;
      delete process.env.LOGIN_SECURITY_CONFIG_RISK_SCORE_REGION_CHANGE;
      delete process.env.LOGIN_SECURITY_CONFIG_RISK_SCORE_CITY_CHANGE;
      delete process.env.LOGIN_SECURITY_CONFIG_RISK_SCORE_VPN_USAGE;

      const values = EnvironmentService.getValues();

      expect(values.login_security_config_max_attempts).toBe(10);
      expect(values.login_security_config_window_seconds).toBe(3600);
      expect(values.login_security_config_lockout_duration_seconds).toBe(900);
      expect(values.login_security_config_sms_otp_threshold).toBe(50);
      expect(values.login_security_config_otp_expiration_minutes).toBe(10);
      expect(values.login_security_config_otp_max_attempts).toBe(5);
      expect(values.login_security_config_risk_score_new_device).toBe(40);
      expect(values.login_security_config_risk_score_country_change).toBe(30);
      expect(values.login_security_config_risk_score_region_change).toBe(15);
      expect(values.login_security_config_risk_score_city_change).toBe(10);
      expect(values.login_security_config_risk_score_vpn_usage).toBe(15);
    });

    it('should return login security configuration with custom values', () => {
      process.env.LOGIN_SECURITY_CONFIG_MAX_ATTEMPTS = '5';
      process.env.LOGIN_SECURITY_CONFIG_WINDOW_SECONDS = '1800';
      process.env.LOGIN_SECURITY_CONFIG_LOCKOUT_DURATION_SECONDS = '600';
      process.env.LOGIN_SECURITY_CONFIG_SMS_OTP_THRESHOLD = '25';
      process.env.LOGIN_SECURITY_CONFIG_OTP_EXPIRATION_MINUTES = '5';
      process.env.LOGIN_SECURITY_CONFIG_OTP_MAX_ATTEMPTS = '3';
      process.env.LOGIN_SECURITY_CONFIG_RISK_SCORE_NEW_DEVICE = '50';
      process.env.LOGIN_SECURITY_CONFIG_RISK_SCORE_COUNTRY_CHANGE = '40';
      process.env.LOGIN_SECURITY_CONFIG_RISK_SCORE_REGION_CHANGE = '20';
      process.env.LOGIN_SECURITY_CONFIG_RISK_SCORE_CITY_CHANGE = '15';
      process.env.LOGIN_SECURITY_CONFIG_RISK_SCORE_VPN_USAGE = '20';

      const values = EnvironmentService.getValues();

      expect(values.login_security_config_max_attempts).toBe(5);
      expect(values.login_security_config_window_seconds).toBe(1800);
      expect(values.login_security_config_lockout_duration_seconds).toBe(600);
      expect(values.login_security_config_sms_otp_threshold).toBe(25);
      expect(values.login_security_config_otp_expiration_minutes).toBe(5);
      expect(values.login_security_config_otp_max_attempts).toBe(3);
      expect(values.login_security_config_risk_score_new_device).toBe(50);
      expect(values.login_security_config_risk_score_country_change).toBe(40);
      expect(values.login_security_config_risk_score_region_change).toBe(20);
      expect(values.login_security_config_risk_score_city_change).toBe(15);
      expect(values.login_security_config_risk_score_vpn_usage).toBe(20);
    });

    it('should return logging configuration correctly', () => {
      process.env.COLORIZED_LOGS = 'true';
      process.env.DISABLE_WINSTON_LOGS = 'true';
      process.env.DISABLE_LOGIN_REGION_CHECK = 'true';

      const values = EnvironmentService.getValues();

      expect(values.colorized_logs).toBe(true);
      expect(values.disable_winston_logs).toBe(true);
      expect(values.disable_login_region_check).toBe(true);
    });

    it('should return false for logging booleans when not set to true', () => {
      process.env.COLORIZED_LOGS = 'false';
      process.env.DISABLE_WINSTON_LOGS = 'FALSE';
      process.env.DISABLE_LOGIN_REGION_CHECK = 'invalid';

      const values = EnvironmentService.getValues();

      expect(values.colorized_logs).toBe(false);
      expect(values.disable_winston_logs).toBe(false);
      expect(values.disable_login_region_check).toBe(false);
    });

    it('should return false for logging booleans when values are undefined', () => {
      delete process.env.COLORIZED_LOGS;
      delete process.env.DISABLE_WINSTON_LOGS;
      delete process.env.DISABLE_LOGIN_REGION_CHECK;

      const values = EnvironmentService.getValues();

      expect(values.colorized_logs).toBe(false);
      expect(values.disable_winston_logs).toBe(false);
      expect(values.disable_login_region_check).toBe(false);
    });

    it('should return zendesk configuration correctly', () => {
      process.env.ZENDESK_API_URL = 'https://api.zendesk.com';
      process.env.ZENDESK_SUBDOMAIN = 'test-subdomain';
      process.env.ZENDESK_EMAIL = 'test@zendesk.com';
      process.env.ZENDESK_API_TOKEN = 'zd_token';
      process.env.ZENDESK_API_KEY = 'zd_key';

      const values = EnvironmentService.getValues();

      expect(values.zendesk_api_url).toBe('https://api.zendesk.com');
      expect(values.zendesk_subdomain).toBe('test-subdomain');
      expect(values.zendesk_email).toBe('test@zendesk.com');
      expect(values.zendesk_api_token).toBe('zd_token');
      expect(values.zendesk_api_key).toBe('zd_key');
    });

    it('should return business configuration correctly', () => {
      process.env.BUSINESS_NAME = 'Test Business';
      process.env.BUSINESS_CAC_NUMBER = 'CAC123456';
      process.env.BUSINESS_PHONE = '+1234567890';
      process.env.BUSINESS_EMAIL = 'contact@business.com';

      const values = EnvironmentService.getValues();

      expect(values.business_name).toBe('Test Business');
      expect(values.business_cac_number).toBe('CAC123456');
      expect(values.business_phone).toBe('+1234567890');
      expect(values.business_email).toBe('contact@business.com');
    });

    it('should return ipinfo configuration correctly', () => {
      process.env.IPINFO_TOKEN = 'ipinfo_token';
      process.env.IPINFO_URL = 'https://ipinfo.io';

      const values = EnvironmentService.getValues();

      expect(values.ipinfo_token).toBe('ipinfo_token');
      expect(values.ipinfo_url).toBe('https://ipinfo.io');
    });

    it('should return hibp configuration correctly', () => {
      process.env.HIBP_URL = 'https://api.pwnedpasswords.com';

      const values = EnvironmentService.getValues();

      expect(values.hibp_url).toBe('https://api.pwnedpasswords.com');
    });

    it('should return aiprise configuration correctly', () => {
      process.env.AIPRISE_API_KEY = 'aiprise_key';
      process.env.AIPRISE_API_URL = 'https://api.aiprise.com';

      const values = EnvironmentService.getValues();

      expect(values.aiprise_api_key).toBe('aiprise_key');
      expect(values.aiprise_api_url).toBe('https://api.aiprise.com');
    });

    it('should return encryption configuration correctly', () => {
      process.env.ENCRYPTION_KEY = 'encryption_key_value';
      process.env.ENCRYPTION_IV = 'encryption_iv_value';

      const values = EnvironmentService.getValues();

      expect(values.encryption_key).toBe('encryption_key_value');
      expect(values.encryption_iv).toBe('encryption_iv_value');
    });

    it('should return default underlying currency and participant countries correctly', () => {
      process.env.DEFAULT_UNDERLYING_CURRENCY = 'USD';
      process.env.DEFAULT_PARTICIPANT_COUNTRIES = 'US,NG';

      const values = EnvironmentService.getValues();

      expect(values.default_underlying_currency).toBe('USD');
      expect(values.default_participant_countries).toBe('US,NG');
    });

    it('should return loki configuration correctly', () => {
      process.env.LOKI_URL = 'http://loki:3100';

      const values = EnvironmentService.getValues();

      expect(values.loki_url).toBe('http://loki:3100');
    });

    it('should return firebase configuration correctly', () => {
      process.env.FIREBASE_SECRET_JSON = '{"type":"service_account"}';

      const values = EnvironmentService.getValues();

      expect(values.firebase_secret_json).toBe('{"type":"service_account"}');
    });

    it('should return provider configuration correctly', () => {
      process.env.DEFAULT_KYC_PROVIDER = 'sumsub';
      process.env.DEFAULT_US_KYC_PROVIDER = 'plaid';
      process.env.DEFAULT_NG_KYC_PROVIDER = 'aiprise';
      process.env.DEFAULT_NG_WAAS_ADAPTER = 'paga';
      process.env.DEFAULT_BLOCKCHAIN_WAAS_ADAPTER = 'fireblocks';
      process.env.DEFAULT_CARD_PROVIDER = 'rain';
      process.env.DEFAULT_EXCHANGE_PROVIDER = 'yellowcard';
      process.env.DEFAULT_USD_FIAT_WALLET_PROVIDER = 'zerohash';
      process.env.DEFAULT_NGN_FIAT_WALLET_PROVIDER = 'paga';
      process.env.DEFAULT_SUPPORT_PROVIDER = 'zendesk';

      const values = EnvironmentService.getValues();

      expect(values.default_kyc_provider).toBe('sumsub');
      expect(values.default_us_kyc_provider).toBe('plaid');
      expect(values.default_ng_kyc_provider).toBe('aiprise');
      expect(values.default_ng_waas_adapter).toBe('paga');
      expect(values.default_blockchain_waas_adapter).toBe('fireblocks');
      expect(values.default_card_provider).toBe('rain');
      expect(values.default_exchange_provider).toBe('yellowcard');
      expect(values.default_usd_fiat_wallet_provider).toBe('zerohash');
      expect(values.default_ngn_fiat_wallet_provider).toBe('paga');
      expect(values.default_support_provider).toBe('zendesk');
    });
  });

  describe('getValue', () => {
    it('should return value for a specific environment variable', () => {
      process.env.APP_NAME = 'TestApp';

      const value = EnvironmentService.getValue('APP_NAME');

      expect(value).toBe('TestApp');
    });

    it('should return default value when environment variable is not set', () => {
      delete process.env.UNDEFINED_VAR;

      const value = EnvironmentService.getValue('APP_NAME', 'DefaultApp');

      expect(value).toBe('DefaultApp');
    });

    it('should return undefined when environment variable is not set and no default provided', () => {
      delete process.env.APP_NAME;

      const value = EnvironmentService.getValue('APP_NAME');

      expect(value).toBeUndefined();
    });

    it('should handle case-insensitive key lookup', () => {
      process.env.JWT_SECRET_TOKEN = 'secret_token';

      const value = EnvironmentService.getValue('JWT_SECRET_TOKEN');

      expect(value).toBe('secret_token');
    });
  });

  describe('isDevelopment', () => {
    it('should return true when NODE_ENV is development', () => {
      process.env.NODE_ENV = 'development';

      const result = EnvironmentService.isDevelopment();

      expect(result).toBe(true);
    });

    it('should return false when NODE_ENV is not development', () => {
      process.env.NODE_ENV = 'production';

      const result = EnvironmentService.isDevelopment();

      expect(result).toBe(false);
    });

    it('should return false when NODE_ENV is test', () => {
      process.env.NODE_ENV = 'test';

      const result = EnvironmentService.isDevelopment();

      expect(result).toBe(false);
    });
  });

  describe('isProduction', () => {
    it('should return true when NODE_ENV is production', () => {
      process.env.NODE_ENV = 'production';

      const result = EnvironmentService.isProduction();

      expect(result).toBe(true);
    });

    it('should return false when NODE_ENV is not production', () => {
      process.env.NODE_ENV = 'development';

      const result = EnvironmentService.isProduction();

      expect(result).toBe(false);
    });

    it('should return false when NODE_ENV is test', () => {
      process.env.NODE_ENV = 'test';

      const result = EnvironmentService.isProduction();

      expect(result).toBe(false);
    });
  });

  describe('isTest', () => {
    it('should return true when NODE_ENV is test', () => {
      process.env.NODE_ENV = 'test';

      const result = EnvironmentService.isTest();

      expect(result).toBe(true);
    });

    it('should return false when NODE_ENV is not test', () => {
      process.env.NODE_ENV = 'development';

      const result = EnvironmentService.isTest();

      expect(result).toBe(false);
    });

    it('should return false when NODE_ENV is production', () => {
      process.env.NODE_ENV = 'production';

      const result = EnvironmentService.isTest();

      expect(result).toBe(false);
    });
  });

  describe('isStaging', () => {
    it('should return true when NODE_ENV is staging', () => {
      process.env.NODE_ENV = 'staging';

      const result = EnvironmentService.isStaging();

      expect(result).toBe(true);
    });

    it('should return false when NODE_ENV is not staging', () => {
      process.env.NODE_ENV = 'development';

      const result = EnvironmentService.isStaging();

      expect(result).toBe(false);
    });

    it('should return false when NODE_ENV is production', () => {
      process.env.NODE_ENV = 'production';

      const result = EnvironmentService.isStaging();

      expect(result).toBe(false);
    });

    it('should return false when NODE_ENV is test', () => {
      process.env.NODE_ENV = 'test';

      const result = EnvironmentService.isStaging();

      expect(result).toBe(false);
    });
  });
});
