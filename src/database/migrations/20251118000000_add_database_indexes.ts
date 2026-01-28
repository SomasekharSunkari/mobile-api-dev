import { Logger } from '@nestjs/common';
import { Knex } from 'knex';
import { DatabaseSchema } from '../database.schema';
import { DatabaseTables } from '../database.table';

export async function up(knex: Knex): Promise<void> {
  await knex.transaction(async (trx) => {
    Logger.log('Starting to add database indexes...');

    // users table indexes
    await trx.schema.withSchema(DatabaseSchema.apiService).alterTable(DatabaseTables.users, (table) => {
      table.index('country_id', 'users_country_id_idx');
      table.index('status', 'users_status_idx');
      table.index('is_active', 'users_is_active_idx');
      table.index('is_deactivated', 'users_is_deactivated_idx');
    });
    Logger.log('Added indexes to users table');

    // users_profiles table indexes
    await trx.schema.withSchema(DatabaseSchema.apiService).alterTable(DatabaseTables.users_profiles, (table) => {
      table.index('user_id', 'users_profiles_user_id_idx');
    });
    Logger.log('Added indexes to users_profiles table');

    // roles_permissions table indexes
    await trx.schema.withSchema(DatabaseSchema.apiService).alterTable(DatabaseTables.roles_permissions, (table) => {
      table.index('role_id', 'roles_permissions_role_id_idx');
      table.index('permission_id', 'roles_permissions_permission_id_idx');
    });
    Logger.log('Added indexes to roles_permissions table');

    // users_roles table indexes
    await trx.schema.withSchema(DatabaseSchema.apiService).alterTable(DatabaseTables.users_roles, (table) => {
      table.index('user_id', 'users_roles_user_id_idx');
      table.index('role_id', 'users_roles_role_id_idx');
    });
    Logger.log('Added indexes to users_roles table');

    // login_devices table indexes
    await trx.schema.withSchema(DatabaseSchema.apiService).alterTable(DatabaseTables.login_devices, (table) => {
      table.index('user_id', 'login_devices_user_id_idx');
      table.index('device_fingerprint', 'login_devices_device_fingerprint_idx');
    });
    Logger.log('Added indexes to login_devices table');

    // login_events table indexes
    await trx.schema.withSchema(DatabaseSchema.apiService).alterTable(DatabaseTables.login_events, (table) => {
      table.index('user_id', 'login_events_user_id_idx');
      table.index('device_id', 'login_events_device_id_idx');
    });
    Logger.log('Added indexes to login_events table');

    // account_verifications table indexes
    await trx.schema.withSchema(DatabaseSchema.apiService).alterTable(DatabaseTables.account_verifications, (table) => {
      table.index('user_id', 'account_verifications_user_id_idx');
      table.index('is_used', 'account_verifications_is_used_idx');
    });
    Logger.log('Added indexes to account_verifications table');

    // password_resets table indexes
    await trx.schema.withSchema(DatabaseSchema.apiService).alterTable(DatabaseTables.password_resets, (table) => {
      table.index('user_id', 'password_resets_user_id_idx');
      table.index('is_used', 'password_resets_is_used_idx');
    });
    Logger.log('Added indexes to password_resets table');

    // refresh_token table indexes
    await trx.schema.withSchema(DatabaseSchema.apiService).alterTable(DatabaseTables.refresh_token, (table) => {
      table.index('user_id', 'refresh_token_user_id_idx');
      table.index('token', 'refresh_token_token_idx');
      table.index('is_used', 'refresh_token_is_used_idx');
    });
    Logger.log('Added indexes to refresh_token table');

    // account_delete_requests table indexes
    await trx.schema
      .withSchema(DatabaseSchema.apiService)
      .alterTable(DatabaseTables.account_delete_requests, (table) => {
        table.index('user_id', 'account_delete_requests_user_id_idx');
      });
    Logger.log('Added indexes to account_delete_requests table');

    // access_tokens table indexes
    await trx.schema.withSchema(DatabaseSchema.apiService).alterTable(DatabaseTables.access_tokens, (table) => {
      table.index('user_id', 'access_tokens_user_id_idx');
      table.index('token', 'access_tokens_token_idx');
    });
    Logger.log('Added indexes to access_tokens table');

    // tier_configs table indexes
    await trx.schema.withSchema(DatabaseSchema.apiService).alterTable(DatabaseTables.tier_configs, (table) => {
      table.index('tier_id', 'tier_configs_tier_id_idx');
      table.index('country_id', 'tier_configs_country_id_idx');
    });
    Logger.log('Added indexes to tier_configs table');

    // tier_config_verification_requirements table indexes
    await trx.schema
      .withSchema(DatabaseSchema.apiService)
      .alterTable(DatabaseTables.tier_config_verification_requirements, (table) => {
        table.index('tier_config_id', 'tier_config_verification_requirements_tier_config_id_idx');
        table.index('verification_requirement_id', 'tier_config_verification_requirements_verification_req_id_idx');
      });
    Logger.log('Added indexes to tier_config_verification_requirements table');

    // kyc_verifications table indexes
    await trx.schema.withSchema(DatabaseSchema.apiService).alterTable(DatabaseTables.kyc_verifications, (table) => {
      table.index('user_id', 'kyc_verifications_user_id_idx');
      table.index('tier_config_id', 'kyc_verifications_tier_config_id_idx');
      table.index('tier_config_verification_requirement_id', 'kyc_verifications_tier_config_verification_req_id_idx');
      table.index('status', 'kyc_verifications_status_idx');
      table.index('provider', 'kyc_verifications_provider_idx');
    });
    Logger.log('Added indexes to kyc_verifications table');

    // kyc_status_logs table indexes
    await trx.schema.withSchema(DatabaseSchema.apiService).alterTable(DatabaseTables.kyc_status_logs, (table) => {
      table.index('kyc_id', 'kyc_status_logs_kyc_id_idx');
    });
    Logger.log('Added indexes to kyc_status_logs table');

    // transactions table indexes
    await trx.schema.withSchema(DatabaseSchema.apiService).alterTable(DatabaseTables.transactions, (table) => {
      table.index('user_id', 'transactions_user_id_idx');
      table.index('status', 'transactions_status_idx');
      table.index('transaction_type', 'transactions_transaction_type_idx');
      table.index('category', 'transactions_category_idx');
    });
    Logger.log('Added indexes to transactions table');

    // fiat_wallets table indexes
    await trx.schema.withSchema(DatabaseSchema.apiService).alterTable(DatabaseTables.fiat_wallets, (table) => {
      table.index('user_id', 'fiat_wallets_user_id_idx');
      table.index('asset', 'fiat_wallets_asset_idx');
      table.index('status', 'fiat_wallets_status_idx');
    });
    Logger.log('Added indexes to fiat_wallets table');

    // fiat_wallet_transactions table indexes
    await trx.schema
      .withSchema(DatabaseSchema.apiService)
      .alterTable(DatabaseTables.fiat_wallet_transactions, (table) => {
        table.index('transaction_id', 'fiat_wallet_transactions_transaction_id_idx');
        table.index('fiat_wallet_id', 'fiat_wallet_transactions_fiat_wallet_id_idx');
        table.index('user_id', 'fiat_wallet_transactions_user_id_idx');
        table.index('external_account_id', 'fiat_wallet_transactions_external_account_id_idx');
        table.index('status', 'fiat_wallet_transactions_status_idx');
        table.index('transaction_type', 'fiat_wallet_transactions_transaction_type_idx');
      });
    Logger.log('Added indexes to fiat_wallet_transactions table');

    // external_accounts table indexes
    await trx.schema.withSchema(DatabaseSchema.apiService).alterTable(DatabaseTables.external_accounts, (table) => {
      table.index('user_id', 'external_accounts_user_id_idx');
      table.index('fiat_wallet_id', 'external_accounts_fiat_wallet_id_idx');
      table.index('provider', 'external_accounts_provider_idx');
      table.index('status', 'external_accounts_status_idx');
    });
    Logger.log('Added indexes to external_accounts table');

    // virtual_accounts table indexes
    await trx.schema.withSchema(DatabaseSchema.apiService).alterTable(DatabaseTables.virtual_accounts, (table) => {
      table.index('user_id', 'virtual_accounts_user_id_idx');
      table.index('fiat_wallet_id', 'virtual_accounts_fiat_wallet_id_idx');
      table.index('provider', 'virtual_accounts_provider_idx');
    });
    Logger.log('Added indexes to virtual_accounts table');

    // reset_transaction_pins table indexes
    await trx.schema
      .withSchema(DatabaseSchema.apiService)
      .alterTable(DatabaseTables.reset_transaction_pins, (table) => {
        table.index('user_id', 'reset_transaction_pins_user_id_idx');
        table.index('is_used', 'reset_transaction_pins_is_used_idx');
      });
    Logger.log('Added indexes to reset_transaction_pins table');

    // deposit_addresses table indexes
    await trx.schema.withSchema(DatabaseSchema.apiService).alterTable(DatabaseTables.deposit_addresses, (table) => {
      table.index('user_id', 'deposit_addresses_user_id_idx');
      table.index('provider', 'deposit_addresses_provider_idx');
      table.index('asset', 'deposit_addresses_asset_idx');
    });
    Logger.log('Added indexes to deposit_addresses table');

    // rate_transactions table indexes
    await trx.schema.withSchema(DatabaseSchema.apiService).alterTable(DatabaseTables.rate_transactions, (table) => {
      table.index('user_id', 'rate_transactions_user_id_idx');
      table.index('transaction_id', 'rate_transactions_transaction_id_idx');
      table.index('status', 'rate_transactions_status_idx');
    });
    Logger.log('Added indexes to rate_transactions table');

    // user_tiers table indexes
    await trx.schema.withSchema(DatabaseSchema.apiService).alterTable(DatabaseTables.user_tiers, (table) => {
      table.index('user_id', 'user_tiers_user_id_idx');
      table.index('tier_id', 'user_tiers_tier_id_idx');
    });
    Logger.log('Added indexes to user_tiers table');

    // banks table indexes
    await trx.schema.withSchema(DatabaseSchema.apiService).alterTable(DatabaseTables.banks, (table) => {
      table.index('country_id', 'banks_country_id_idx');
      table.index('code', 'banks_code_idx');
      table.index('status', 'banks_status_idx');
    });
    Logger.log('Added indexes to banks table');

    // bank_beneficiaries table indexes
    await trx.schema.withSchema(DatabaseSchema.apiService).alterTable(DatabaseTables.bank_beneficiaries, (table) => {
      table.index('user_id', 'bank_beneficiaries_user_id_idx');
      table.index('currency', 'bank_beneficiaries_currency_idx');
    });
    Logger.log('Added indexes to bank_beneficiaries table');

    // blockchain_beneficiaries table indexes
    await trx.schema
      .withSchema(DatabaseSchema.apiService)
      .alterTable(DatabaseTables.blockchain_beneficiaries, (table) => {
        table.index('user_id', 'blockchain_beneficiaries_user_id_idx');
        table.index('beneficiary_user_id', 'blockchain_beneficiaries_beneficiary_user_id_idx');
        table.index('asset', 'blockchain_beneficiaries_asset_idx');
        table.index('network', 'blockchain_beneficiaries_network_idx');
      });
    Logger.log('Added indexes to blockchain_beneficiaries table');

    // card_users table indexes
    await trx.schema.withSchema(DatabaseSchema.apiService).alterTable(DatabaseTables.card_users, (table) => {
      table.index('user_id', 'card_users_user_id_idx');
      table.index('country_id', 'card_users_country_id_idx');
      table.index('status', 'card_users_status_idx');
    });
    Logger.log('Added indexes to card_users table');

    // account_deactivation_logs table indexes
    await trx.schema
      .withSchema(DatabaseSchema.apiService)
      .alterTable(DatabaseTables.account_deactivation_logs, (table) => {
        table.index('user_id', 'account_deactivation_logs_user_id_idx');
        table.index('deactivated_by_user_id', 'account_deactivation_logs_deactivated_by_user_id_idx');
        table.index('reactivated_by_user_id', 'account_deactivation_logs_reactivated_by_user_id_idx');
        table.index('status', 'account_deactivation_logs_status_idx');
      });
    Logger.log('Added indexes to account_deactivation_logs table');

    // account_deactivation_codes table indexes
    await trx.schema
      .withSchema(DatabaseSchema.apiService)
      .alterTable(DatabaseTables.account_deactivation_codes, (table) => {
        table.index('user_id', 'account_deactivation_codes_user_id_idx');
        table.index('email', 'account_deactivation_codes_email_idx');
        table.index('is_used', 'account_deactivation_codes_is_used_idx');
      });
    Logger.log('Added indexes to account_deactivation_codes table');

    // users_virtual_cards table indexes
    await trx.schema.withSchema(DatabaseSchema.apiService).alterTable(DatabaseTables.users_virtual_cards, (table) => {
      table.index('user_id', 'users_virtual_cards_user_id_idx');
      table.index('card_user_id', 'users_virtual_cards_card_user_id_idx');
      table.index('country_id', 'users_virtual_cards_country_id_idx');
      table.index('status', 'users_virtual_cards_status_idx');
    });
    Logger.log('Added indexes to users_virtual_cards table');

    // paga_ledger_transactions table indexes
    await trx.schema
      .withSchema(DatabaseSchema.apiService)
      .alterTable(DatabaseTables.paga_ledger_transactions, (table) => {
        table.index('account_number', 'paga_ledger_transactions_account_number_idx');
        table.index('status', 'paga_ledger_transactions_status_idx');
        table.index('transaction_type', 'paga_ledger_transactions_transaction_type_idx');
        table.index('reference_number', 'paga_ledger_transactions_reference_number_idx');
        table.index('transaction_reference', 'paga_ledger_transactions_transaction_reference_idx');
      });
    Logger.log('Added indexes to paga_ledger_transactions table');

    // card_transactions table indexes
    await trx.schema.withSchema(DatabaseSchema.apiService).alterTable(DatabaseTables.card_transactions, (table) => {
      table.index('user_id', 'card_transactions_user_id_idx');
      table.index('card_user_id', 'card_transactions_card_user_id_idx');
      table.index('user_virtual_card_id', 'card_transactions_user_virtual_card_id_idx');
      table.index('status', 'card_transactions_status_idx');
      table.index('transaction_type', 'card_transactions_transaction_type_idx');
    });
    Logger.log('Added indexes to card_transactions table');

    // exchange_rates table indexes
    await trx.schema.withSchema(DatabaseSchema.apiService).alterTable(DatabaseTables.exchange_rates, (table) => {
      table.index('provider', 'exchange_rates_provider_idx');
      table.index('buying_currency_code', 'exchange_rates_buying_currency_code_idx');
      table.index('selling_currency_code', 'exchange_rates_selling_currency_code_idx');
      table.index('expires_at', 'exchange_rates_expires_at_idx');
    });
    Logger.log('Added indexes to exchange_rates table');

    // verification_tokens table indexes
    await trx.schema.withSchema(DatabaseSchema.apiService).alterTable(DatabaseTables.verification_tokens, (table) => {
      table.index('user_id', 'verification_tokens_user_id_idx');
      table.index('verification_type', 'verification_tokens_verification_type_idx');
      table.index('is_used', 'verification_tokens_is_used_idx');
    });
    Logger.log('Added indexes to verification_tokens table');

    // feature_flags table indexes
    await trx.schema.withSchema(DatabaseSchema.apiService).alterTable(DatabaseTables.feature_flags, (table) => {
      table.index('enabled', 'feature_flags_enabled_idx');
    });
    Logger.log('Added indexes to feature_flags table');

    // feature_flag_overrides table indexes
    await trx.schema
      .withSchema(DatabaseSchema.apiService)
      .alterTable(DatabaseTables.feature_flag_overrides, (table) => {
        table.index('feature_flag_id', 'feature_flag_overrides_feature_flag_id_idx');
        table.index('user_id', 'feature_flag_overrides_user_id_idx');
      });
    Logger.log('Added indexes to feature_flag_overrides table');

    // support_tickets table indexes
    await trx.schema.withSchema(DatabaseSchema.apiService).alterTable(DatabaseTables.support_tickets, (table) => {
      table.index('user_id', 'support_tickets_user_id_idx');
      table.index('status', 'support_tickets_status_idx');
    });
    Logger.log('Added indexes to support_tickets table');

    Logger.log('Successfully added all database indexes');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.transaction(async (trx) => {
    Logger.log('Starting to remove database indexes...');

    // users table indexes
    await trx.schema.withSchema(DatabaseSchema.apiService).alterTable(DatabaseTables.users, (table) => {
      table.dropIndex('country_id', 'users_country_id_idx');
      table.dropIndex('status', 'users_status_idx');
      table.dropIndex('is_active', 'users_is_active_idx');
      table.dropIndex('is_deactivated', 'users_is_deactivated_idx');
    });

    // users_profiles table indexes
    await trx.schema.withSchema(DatabaseSchema.apiService).alterTable(DatabaseTables.users_profiles, (table) => {
      table.dropIndex('user_id', 'users_profiles_user_id_idx');
    });

    // roles_permissions table indexes
    await trx.schema.withSchema(DatabaseSchema.apiService).alterTable(DatabaseTables.roles_permissions, (table) => {
      table.dropIndex('role_id', 'roles_permissions_role_id_idx');
      table.dropIndex('permission_id', 'roles_permissions_permission_id_idx');
    });

    // users_roles table indexes
    await trx.schema.withSchema(DatabaseSchema.apiService).alterTable(DatabaseTables.users_roles, (table) => {
      table.dropIndex('user_id', 'users_roles_user_id_idx');
      table.dropIndex('role_id', 'users_roles_role_id_idx');
    });

    // login_devices table indexes
    await trx.schema.withSchema(DatabaseSchema.apiService).alterTable(DatabaseTables.login_devices, (table) => {
      table.dropIndex('user_id', 'login_devices_user_id_idx');
      table.dropIndex('device_fingerprint', 'login_devices_device_fingerprint_idx');
    });

    // login_events table indexes
    await trx.schema.withSchema(DatabaseSchema.apiService).alterTable(DatabaseTables.login_events, (table) => {
      table.dropIndex('user_id', 'login_events_user_id_idx');
      table.dropIndex('device_id', 'login_events_device_id_idx');
    });

    // account_verifications table indexes
    await trx.schema.withSchema(DatabaseSchema.apiService).alterTable(DatabaseTables.account_verifications, (table) => {
      table.dropIndex('user_id', 'account_verifications_user_id_idx');
      table.dropIndex('is_used', 'account_verifications_is_used_idx');
    });

    // password_resets table indexes
    await trx.schema.withSchema(DatabaseSchema.apiService).alterTable(DatabaseTables.password_resets, (table) => {
      table.dropIndex('user_id', 'password_resets_user_id_idx');
      table.dropIndex('is_used', 'password_resets_is_used_idx');
    });

    // refresh_token table indexes
    await trx.schema.withSchema(DatabaseSchema.apiService).alterTable(DatabaseTables.refresh_token, (table) => {
      table.dropIndex('user_id', 'refresh_token_user_id_idx');
      table.dropIndex('token', 'refresh_token_token_idx');
      table.dropIndex('is_used', 'refresh_token_is_used_idx');
    });

    // account_delete_requests table indexes
    await trx.schema
      .withSchema(DatabaseSchema.apiService)
      .alterTable(DatabaseTables.account_delete_requests, (table) => {
        table.dropIndex('user_id', 'account_delete_requests_user_id_idx');
      });

    // access_tokens table indexes
    await trx.schema.withSchema(DatabaseSchema.apiService).alterTable(DatabaseTables.access_tokens, (table) => {
      table.dropIndex('user_id', 'access_tokens_user_id_idx');
      table.dropIndex('token', 'access_tokens_token_idx');
    });

    // tier_configs table indexes
    await trx.schema.withSchema(DatabaseSchema.apiService).alterTable(DatabaseTables.tier_configs, (table) => {
      table.dropIndex('tier_id', 'tier_configs_tier_id_idx');
      table.dropIndex('country_id', 'tier_configs_country_id_idx');
    });

    // tier_config_verification_requirements table indexes
    await trx.schema
      .withSchema(DatabaseSchema.apiService)
      .alterTable(DatabaseTables.tier_config_verification_requirements, (table) => {
        table.dropIndex('tier_config_id', 'tier_config_verification_requirements_tier_config_id_idx');
        table.dropIndex('verification_requirement_id', 'tier_config_verification_requirements_verification_req_id_idx');
      });

    // kyc_verifications table indexes
    await trx.schema.withSchema(DatabaseSchema.apiService).alterTable(DatabaseTables.kyc_verifications, (table) => {
      table.dropIndex('user_id', 'kyc_verifications_user_id_idx');
      table.dropIndex('tier_config_id', 'kyc_verifications_tier_config_id_idx');
      table.dropIndex(
        'tier_config_verification_requirement_id',
        'kyc_verifications_tier_config_verification_req_id_idx',
      );
      table.dropIndex('status', 'kyc_verifications_status_idx');
      table.dropIndex('provider', 'kyc_verifications_provider_idx');
    });

    // kyc_status_logs table indexes
    await trx.schema.withSchema(DatabaseSchema.apiService).alterTable(DatabaseTables.kyc_status_logs, (table) => {
      table.dropIndex('kyc_id', 'kyc_status_logs_kyc_id_idx');
    });

    // transactions table indexes
    await trx.schema.withSchema(DatabaseSchema.apiService).alterTable(DatabaseTables.transactions, (table) => {
      table.dropIndex('user_id', 'transactions_user_id_idx');
      table.dropIndex('status', 'transactions_status_idx');
      table.dropIndex('transaction_type', 'transactions_transaction_type_idx');
      table.dropIndex('category', 'transactions_category_idx');
    });

    // fiat_wallets table indexes
    await trx.schema.withSchema(DatabaseSchema.apiService).alterTable(DatabaseTables.fiat_wallets, (table) => {
      table.dropIndex('user_id', 'fiat_wallets_user_id_idx');
      table.dropIndex('asset', 'fiat_wallets_asset_idx');
      table.dropIndex('status', 'fiat_wallets_status_idx');
    });

    // fiat_wallet_transactions table indexes
    await trx.schema
      .withSchema(DatabaseSchema.apiService)
      .alterTable(DatabaseTables.fiat_wallet_transactions, (table) => {
        table.dropIndex('transaction_id', 'fiat_wallet_transactions_transaction_id_idx');
        table.dropIndex('fiat_wallet_id', 'fiat_wallet_transactions_fiat_wallet_id_idx');
        table.dropIndex('user_id', 'fiat_wallet_transactions_user_id_idx');
        table.dropIndex('external_account_id', 'fiat_wallet_transactions_external_account_id_idx');
        table.dropIndex('status', 'fiat_wallet_transactions_status_idx');
        table.dropIndex('transaction_type', 'fiat_wallet_transactions_transaction_type_idx');
      });

    // external_accounts table indexes
    await trx.schema.withSchema(DatabaseSchema.apiService).alterTable(DatabaseTables.external_accounts, (table) => {
      table.dropIndex('user_id', 'external_accounts_user_id_idx');
      table.dropIndex('fiat_wallet_id', 'external_accounts_fiat_wallet_id_idx');
      table.dropIndex('provider', 'external_accounts_provider_idx');
      table.dropIndex('status', 'external_accounts_status_idx');
    });

    // virtual_accounts table indexes
    await trx.schema.withSchema(DatabaseSchema.apiService).alterTable(DatabaseTables.virtual_accounts, (table) => {
      table.dropIndex('user_id', 'virtual_accounts_user_id_idx');
      table.dropIndex('fiat_wallet_id', 'virtual_accounts_fiat_wallet_id_idx');
      table.dropIndex('provider', 'virtual_accounts_provider_idx');
    });

    // reset_transaction_pins table indexes
    await trx.schema
      .withSchema(DatabaseSchema.apiService)
      .alterTable(DatabaseTables.reset_transaction_pins, (table) => {
        table.dropIndex('user_id', 'reset_transaction_pins_user_id_idx');
        table.dropIndex('is_used', 'reset_transaction_pins_is_used_idx');
      });

    // deposit_addresses table indexes
    await trx.schema.withSchema(DatabaseSchema.apiService).alterTable(DatabaseTables.deposit_addresses, (table) => {
      table.dropIndex('user_id', 'deposit_addresses_user_id_idx');
      table.dropIndex('provider', 'deposit_addresses_provider_idx');
      table.dropIndex('asset', 'deposit_addresses_asset_idx');
    });

    // rate_transactions table indexes
    await trx.schema.withSchema(DatabaseSchema.apiService).alterTable(DatabaseTables.rate_transactions, (table) => {
      table.dropIndex('user_id', 'rate_transactions_user_id_idx');
      table.dropIndex('transaction_id', 'rate_transactions_transaction_id_idx');
      table.dropIndex('status', 'rate_transactions_status_idx');
    });

    // user_tiers table indexes
    await trx.schema.withSchema(DatabaseSchema.apiService).alterTable(DatabaseTables.user_tiers, (table) => {
      table.dropIndex('user_id', 'user_tiers_user_id_idx');
      table.dropIndex('tier_id', 'user_tiers_tier_id_idx');
    });

    // banks table indexes
    await trx.schema.withSchema(DatabaseSchema.apiService).alterTable(DatabaseTables.banks, (table) => {
      table.dropIndex('country_id', 'banks_country_id_idx');
      table.dropIndex('code', 'banks_code_idx');
      table.dropIndex('status', 'banks_status_idx');
    });

    // bank_beneficiaries table indexes
    await trx.schema.withSchema(DatabaseSchema.apiService).alterTable(DatabaseTables.bank_beneficiaries, (table) => {
      table.dropIndex('user_id', 'bank_beneficiaries_user_id_idx');
      table.dropIndex('currency', 'bank_beneficiaries_currency_idx');
    });

    // blockchain_beneficiaries table indexes
    await trx.schema
      .withSchema(DatabaseSchema.apiService)
      .alterTable(DatabaseTables.blockchain_beneficiaries, (table) => {
        table.dropIndex('user_id', 'blockchain_beneficiaries_user_id_idx');
        table.dropIndex('beneficiary_user_id', 'blockchain_beneficiaries_beneficiary_user_id_idx');
        table.dropIndex('asset', 'blockchain_beneficiaries_asset_idx');
        table.dropIndex('network', 'blockchain_beneficiaries_network_idx');
      });

    // card_users table indexes
    await trx.schema.withSchema(DatabaseSchema.apiService).alterTable(DatabaseTables.card_users, (table) => {
      table.dropIndex('user_id', 'card_users_user_id_idx');
      table.dropIndex('country_id', 'card_users_country_id_idx');
      table.dropIndex('status', 'card_users_status_idx');
    });

    // account_deactivation_logs table indexes
    await trx.schema
      .withSchema(DatabaseSchema.apiService)
      .alterTable(DatabaseTables.account_deactivation_logs, (table) => {
        table.dropIndex('user_id', 'account_deactivation_logs_user_id_idx');
        table.dropIndex('deactivated_by_user_id', 'account_deactivation_logs_deactivated_by_user_id_idx');
        table.dropIndex('reactivated_by_user_id', 'account_deactivation_logs_reactivated_by_user_id_idx');
        table.dropIndex('status', 'account_deactivation_logs_status_idx');
      });

    // account_deactivation_codes table indexes
    await trx.schema
      .withSchema(DatabaseSchema.apiService)
      .alterTable(DatabaseTables.account_deactivation_codes, (table) => {
        table.dropIndex('user_id', 'account_deactivation_codes_user_id_idx');
        table.dropIndex('email', 'account_deactivation_codes_email_idx');
        table.dropIndex('is_used', 'account_deactivation_codes_is_used_idx');
      });

    // users_virtual_cards table indexes
    await trx.schema.withSchema(DatabaseSchema.apiService).alterTable(DatabaseTables.users_virtual_cards, (table) => {
      table.dropIndex('user_id', 'users_virtual_cards_user_id_idx');
      table.dropIndex('card_user_id', 'users_virtual_cards_card_user_id_idx');
      table.dropIndex('country_id', 'users_virtual_cards_country_id_idx');
      table.dropIndex('status', 'users_virtual_cards_status_idx');
    });

    // paga_ledger_transactions table indexes
    await trx.schema
      .withSchema(DatabaseSchema.apiService)
      .alterTable(DatabaseTables.paga_ledger_transactions, (table) => {
        table.dropIndex('account_number', 'paga_ledger_transactions_account_number_idx');
        table.dropIndex('status', 'paga_ledger_transactions_status_idx');
        table.dropIndex('transaction_type', 'paga_ledger_transactions_transaction_type_idx');
        table.dropIndex('reference_number', 'paga_ledger_transactions_reference_number_idx');
        table.dropIndex('transaction_reference', 'paga_ledger_transactions_transaction_reference_idx');
      });

    // card_transactions table indexes
    await trx.schema.withSchema(DatabaseSchema.apiService).alterTable(DatabaseTables.card_transactions, (table) => {
      table.dropIndex('user_id', 'card_transactions_user_id_idx');
      table.dropIndex('card_user_id', 'card_transactions_card_user_id_idx');
      table.dropIndex('user_virtual_card_id', 'card_transactions_user_virtual_card_id_idx');
      table.dropIndex('status', 'card_transactions_status_idx');
      table.dropIndex('transaction_type', 'card_transactions_transaction_type_idx');
    });

    // exchange_rates table indexes
    await trx.schema.withSchema(DatabaseSchema.apiService).alterTable(DatabaseTables.exchange_rates, (table) => {
      table.dropIndex('provider', 'exchange_rates_provider_idx');
      table.dropIndex('buying_currency_code', 'exchange_rates_buying_currency_code_idx');
      table.dropIndex('selling_currency_code', 'exchange_rates_selling_currency_code_idx');
      table.dropIndex('expires_at', 'exchange_rates_expires_at_idx');
    });

    // verification_tokens table indexes
    await trx.schema.withSchema(DatabaseSchema.apiService).alterTable(DatabaseTables.verification_tokens, (table) => {
      table.dropIndex('user_id', 'verification_tokens_user_id_idx');
      table.dropIndex('verification_type', 'verification_tokens_verification_type_idx');
      table.dropIndex('is_used', 'verification_tokens_is_used_idx');
    });

    // feature_flags table indexes
    await trx.schema.withSchema(DatabaseSchema.apiService).alterTable(DatabaseTables.feature_flags, (table) => {
      table.dropIndex('enabled', 'feature_flags_enabled_idx');
    });

    // feature_flag_overrides table indexes
    await trx.schema
      .withSchema(DatabaseSchema.apiService)
      .alterTable(DatabaseTables.feature_flag_overrides, (table) => {
        table.dropIndex('feature_flag_id', 'feature_flag_overrides_feature_flag_id_idx');
        table.dropIndex('user_id', 'feature_flag_overrides_user_id_idx');
      });

    // support_tickets table indexes
    await trx.schema.withSchema(DatabaseSchema.apiService).alterTable(DatabaseTables.support_tickets, (table) => {
      table.dropIndex('user_id', 'support_tickets_user_id_idx');
      table.dropIndex('status', 'support_tickets_status_idx');
    });

    Logger.log('Successfully removed all database indexes');
  });
}
