export interface IEnvironmentVariables {
  app_port: number;
  app_host: string;
  app_name: string;

  logger_levels: string[];

  cors_origins: string;

  db_host: string;
  db_port: number;
  db_user: string;
  db_password: string;
  db_name: string;
  db_driver: string;
  db_ssl: boolean;

  node_env: string;
  jwt_secret_token: string;

  ipinfo_token: string;
  ipinfo_url: string;

  // Redis configuration
  redis_host: string;
  redis_port: number;
  redis_password: string;
  redis_db: number;
  redis_enable_tls: boolean;

  // Sinch configuration
  sinch_api_key: string;
  sinch_service_plan_id: string;
  sinch_region: string;
  sinch_sender: string;

  // hibp configuration
  hibp_url: string;

  // Zerohash configuration
  zerohash_api_key: string;
  zerohash_api_url: string;
  zerohash_api_secret: string;
  zerohash_api_passphrase: string;
  zerohash_rsa_public_key: string;
  default_underlying_currency: string;
  default_participant_countries: string;

  // Default KYC provider
  default_kyc_provider: string;

  // Default USA KYC provider
  default_us_kyc_provider: string;

  plaid_client_id: string;
  plaid_secret: string;
  plaid_env: string;
  plaid_webhook: string;
  plaid_redirect_uri: string;
  plaid_signal_ruleset_key: string;

  // Aiprise kyc provider
  aiprise_api_url: string;
  aiprise_api_key: string;

  // default ngn kyc provider
  default_ng_kyc_provider: string;

  // waas providers configuration,
  default_ng_waas_adapter: string;

  // encryption configuration
  encryption_key: string;
  encryption_iv: string;

  // zerohash webhook url
  zerohash_webhook_url: string;

  // fireblocks config
  fireblocks_api_key: string;
  fireblocks_private_key: string;
  fireblocks_base_url: string;
  fireblocks_timeout: number;
  fireblocks_webhook_public_key: string;
  default_blockchain_waas_adapter: string;

  // rain configuration
  rain_api_key: string;
  rain_base_url: string;
  rain_client_id: string;
  rain_webhook_signing_key: string;

  // sumsub config
  sumsub_app_token: string;
  sumsub_secret_key: string;
  sumsub_api_url: string;
  sumsub_webhook_secret_key: string;

  // rain pem
  rain_pem: string;
  rain_secret: string;

  // card config
  default_card_provider: string;

  // yellowcard config
  yellowcard_public_key: string;
  yellowcard_secret_key: string;
  yellowcard_api_url: string;
  yellowcard_webhook_secret_key: string;

  // exchange config
  default_exchange_provider: string;

  // loki config
  loki_url: string;

  // fiat wallet config
  default_usd_fiat_wallet_provider: string;
  default_ngn_fiat_wallet_provider: string;

  // zerohash account group
  zerohash_account_group: string;

  // firebase config
  firebase_secret_json: string;

  // AWS S3 config
  aws_s3_region: string;
  aws_s3_access_key_id: string;
  aws_s3_secret_access_key: string;
  aws_s3_bucket_name: string;
  aws_s3_endpoint: string;
  aws_s3_force_path_style: string;
  aws_s3_signature_version: string;
  aws_s3_max_file_size: string;
  aws_s3_allowed_mime_types: string;
  aws_s3_url_expiration_time: string;
  aws_s3_enable_encryption: string;
  aws_s3_encryption_algorithm: string;
  aws_s3_public_read_path: string;
  aws_s3_private_read_path: string;

  // paga config
  paga_username: string;
  paga_credential: string;
  paga_collect_api_url: string;
  paga_business_api_url: string;
  paga_hmac: string;
  paga_webhook_username: string;
  paga_webhook_password: string;
  // login security configuration
  login_security_config_max_attempts: number;
  login_security_config_window_seconds: number;
  login_security_config_lockout_duration_seconds: number;
  login_security_config_sms_otp_threshold: number;
  login_security_config_otp_expiration_minutes: number;
  login_security_config_otp_max_attempts: number;
  login_security_config_risk_score_new_device: number;
  login_security_config_risk_score_country_change: number;
  login_security_config_risk_score_region_change: number;
  login_security_config_risk_score_city_change: number;
  login_security_config_risk_score_vpn_usage: number;

  // logging config
  colorized_logs: boolean;
  disable_winston_logs: boolean;
  disable_login_region_check: boolean;

  // support config
  default_support_provider: string;

  // zendesk config
  zendesk_api_url?: string;
  zendesk_subdomain?: string;
  zendesk_email?: string;
  zendesk_api_token?: string;
  zendesk_api_key?: string;
  zendesk_jwt_key_id?: string;
  zendesk_jwt_shared_secret?: string;

  // business config
  business_name?: string;
  business_cac_number?: string;
  business_phone?: string;
  business_email?: string;
}
