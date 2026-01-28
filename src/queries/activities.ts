export const getUserActivitiesQuery = () => {
  return `
    SELECT 
      'transaction' as activity_type,
      id,
      user_id,
      transaction_type as action,
      description,
      created_at as activity_date,
      JSON_BUILD_OBJECT(
        'amount', amount,
        'asset', asset,
        'status', status,
        'category', category,
        'reference', reference
      ) as metadata
    FROM api_service.transactions 
    WHERE user_id = ? AND deleted_at IS NULL

    UNION ALL

    SELECT 
      'kyc_status' as activity_type,
      ksl.id,
      kv.user_id,
      CONCAT('KYC status changed to ', ksl.new_status) as action,
      COALESCE(ksl.comment, 'KYC verification status updated') as description,
      ksl.created_at as activity_date,
      JSON_BUILD_OBJECT(
        'old_status', ksl.old_status,
        'new_status', ksl.new_status,
        'provider', kv.provider
      ) as metadata
    FROM api_service.kyc_status_logs ksl
    JOIN api_service.kyc_verifications kv ON ksl.kyc_id = kv.id
    WHERE kv.user_id = ? AND ksl.deleted_at IS NULL

    UNION ALL

    SELECT 
      'external_account' as activity_type,
      id,
      user_id,
      CASE 
        WHEN created_at = updated_at THEN 'external_account_linked'
        ELSE 'external_account_updated'
      END as action,
      CONCAT(COALESCE(bank_name, 'External'), ' account managed') as description,
      created_at as activity_date,
      JSON_BUILD_OBJECT(
        'provider', provider,
        'bank_name', bank_name,
        'account_type', account_type,
        'status', status
      ) as metadata
    FROM api_service.external_accounts 
    WHERE user_id = ? AND deleted_at IS NULL

    UNION ALL

    SELECT 
      'blockchain_account' as activity_type,
      id,
      user_id,
      CASE 
        WHEN created_at = updated_at THEN 'blockchain_account_created'
        ELSE 'blockchain_account_updated'
      END as action,
      CONCAT(provider, ' blockchain account managed') as description,
      created_at as activity_date,
      JSON_BUILD_OBJECT(
        'provider', provider,
        'status', status,
        'provider_ref', provider_ref
      ) as metadata
    FROM api_service.blockchain_accounts 
    WHERE user_id = ? AND deleted_at IS NULL

    UNION ALL

    SELECT 
      'virtual_account' as activity_type,
      id,
      user_id,
      'virtual_account_created' as action,
      CONCAT(COALESCE(bank_name, 'Virtual'), ' account created') as description,
      created_at as activity_date,
      JSON_BUILD_OBJECT(
        'provider', provider,
        'bank_name', bank_name,
        'account_name', account_name,
        'account_number', account_number
      ) as metadata
    FROM api_service.virtual_accounts 
    WHERE user_id = ? AND deleted_at IS NULL
  `;
};
