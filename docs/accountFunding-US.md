# End-to-End User Journey: Registration to Account Funding

This document maps the complete user journey from registration through KYC verification to successful account funding, showing how webhook responses from external providers map to database tables and field transformations.

## Overview

Based on application logs analysis, the user journey involves 6 main phases:

1. **User Registration & Email Verification** - Email verification codes and user creation
2. **KYC Verification via Sumsub** - Identity verification and document processing  
3. **External Account Creation (ZeroHash)** - Participant creation for payment processing
4. **Bank Account Linking (Plaid)** - Connecting user's bank account for funding
5. **Account Funding Process** - Risk evaluation and payment initiation
6. **Payment Processing Webhooks** - Status updates and balance settlement

---

## Phase 1: User Registration & Email Verification

### Database Operations

1. **Email Verification Code Creation**
   ```sql
   INSERT INTO account_verifications (
     id, email, code, is_used, expiration_time, created_at, updated_at
   ) VALUES (
     'uuid', 'user@example.com', 'hashed_code', false, '2024-01-01 12:00:00', NOW(), NOW()
   );
   ```

2. **User Registration**
   ```sql
   -- Main user record
   INSERT INTO users (
     id, first_name, last_name, username, email, password, 
     is_email_verified, is_active, country_id, created_at, updated_at
   ) VALUES (
     'user_uuid', 'John', 'Doe', 'johndoe', 'user@example.com', 'hashed_password',
     true, true, 'US', NOW(), NOW()
   );
   
   -- User profile
   INSERT INTO user_profiles (
     id, user_id, created_at, updated_at
   ) VALUES (
     'profile_uuid', 'user_uuid', NOW(), NOW()
   );
   
   -- User roles assignment
   INSERT INTO users_roles (user_id, role_id) VALUES 
     ('user_uuid', 'user_role_id'),
     ('user_uuid', 'active_user_role_id');
   
   -- Access and refresh tokens
   INSERT INTO access_tokens (user_id, token, expiration_time, identity) VALUES (...);
   INSERT INTO refresh_tokens (user_id, token, expiration_time, is_used) VALUES (...);
   ```

### Log Patterns
```
AccountVerificationService - Initializing sending Verification
RegisterService.register - User registered successfully
```

---

## Phase 2: KYC Verification via Sumsub

### Webhook Field Mappings

| Sumsub Webhook Field | Database Table | Database Field | Transformation |
|---------------------|----------------|----------------|----------------|
| `externalUserId` | `kyc_verifications` | `user_id` | Direct mapping |
| `applicantId` | `kyc_verifications` | `provider_ref` | Direct mapping |
| `type` | - | - | Used for webhook routing |
| `reviewResult.reviewAnswer` | `kyc_verifications` | `status` | `"green"` → `"approved"` |
| `reviewResult.moderationComment` | `kyc_verifications` | `error_message` | Direct mapping |
| `createdAtMs` | `kyc_verifications` | `submitted_at` | Convert timestamp |

### Database Operations

1. **KYC Verification Record Creation** (on `applicantCreated`)
   ```sql
   INSERT INTO kyc_verifications (
     id, user_id, provider, provider_ref, attempt, status, 
     submitted_at, created_at, updated_at
   ) VALUES (
     'kyc_uuid', 'user_uuid', 'sumsub', 'applicantId_123', 1, 'init',
     '2024-01-01 12:00:00', NOW(), NOW()
   );
   ```

2. **KYC Status Update** (on `applicantReviewed` with green status)
   ```sql
   UPDATE kyc_verifications SET
     status = 'approved',
     provider_status = 'completed',
     reviewed_at = '2024-01-01 12:05:00',
     identity_type = 'PASSPORT',
     identity_value = 'hashed_document_number',
     metadata = '{"address": {"country": "US", "state": "CA"}}',
     updated_at = NOW()
   WHERE provider_ref = 'applicantId_123';
   ```

3. **KYC Status Log Entry**
   ```sql
   INSERT INTO kyc_status_logs (
     id, kyc_verification_id, from_status, to_status, 
     change_reason, created_at, updated_at
   ) VALUES (
     'log_uuid', 'kyc_uuid', 'init', 'approved', 
     'Sumsub review completed', NOW(), NOW()
   );
   ```

4. **User Details Update** (from KYC response)
   ```sql
   UPDATE users SET
     first_name = 'John',
     last_name = 'Doe',
     updated_at = NOW()
   WHERE id = 'user_uuid';
   
   UPDATE user_profiles SET
     dob = '1990-01-01',
     address_line1 = '123 Main St',
     city = 'San Francisco',
     state_or_province = 'CA',
     postal_code = '94102',
     updated_at = NOW()
   WHERE user_id = 'user_uuid';
   ```

### Log Patterns
```
SumsubWebhookService.processWebhook - Processing Webhook for user [user_id]
handleKycSuccessAndCreateWallets - Handling KYC success and creating wallets
```

---

## Phase 3: External Account Creation (ZeroHash)

### Process Flow
1. **Automatic Participant Creation** (triggered by KYC approval)
2. **External Account Record Creation** 
3. **Webhook Status Updates**

### Database Operations

1. **External Account Creation**
   ```sql
   INSERT INTO external_accounts (
     id, user_id, participant_code, provider, status, 
     provider_kyc_status, created_at, updated_at
   ) VALUES (
     'ext_acc_uuid', 'user_uuid', 'ZH_PARTICIPANT_CODE', 'zerohash', 
     'pending', 'approved', NOW(), NOW()
   );
   ```

2. **Fiat Wallet Creation** (for all supported currencies)
   ```sql
   INSERT INTO fiat_wallets (
     id, user_id, asset, balance, credit_balance, status, created_at, updated_at
   ) VALUES 
     ('wallet_usd_uuid', 'user_uuid', 'USD', 0, 0, 'active', NOW(), NOW()),
     ('wallet_eur_uuid', 'user_uuid', 'EUR', 0, 0, 'active', NOW(), NOW());
   ```

### ZeroHash Webhook Field Mappings

| ZeroHash Webhook Field | Database Table | Database Field | Transformation |
|-----------------------|----------------|----------------|----------------|
| `participant_code` | `external_accounts` | `participant_code` | Direct mapping |
| `participant_status` | `external_accounts` | `provider_kyc_status` | Lowercase conversion |
| `external_account_id` | `external_accounts` | `external_account_ref` | Direct mapping |
| `external_account_status` | `external_accounts` | `status` | Lowercase conversion |

### Status Priority Mapping
```typescript
// Provider KYC Status Priority (higher number = higher priority)
enum KycStatusPriority {
  not_started = 1,
  submitted = 2,
  under_review = 3,
  approved = 4,  // Terminal - no downgrades allowed
}

// External Account Status Priority
enum ExternalAccountStatusPriority {
  pending = 1,
  approved = 2,
  rejected = 3,   // Terminal
  closed = 4,     // Terminal  
  locked = 5,     // Terminal
  disabled = 6,   // Terminal
}
```

### Log Patterns
```
ParticipantService - Creating participant for user [kycData.userId]
Created external account [external_account.id] with participant code: [participant_code]
```

---

## Phase 4: Bank Account Linking (Plaid)

### Process Flow
1. **Plaid Link Token Exchange**
2. **Account Information Retrieval**
3. **Processor Token Creation**
4. **ZeroHash Account Linking**
5. **External Account Record Update**

### Plaid Integration Field Mappings

| Plaid Response Field | Database Table | Database Field | Notes |
|---------------------|----------------|----------------|--------|
| `access_token` | `external_accounts` | `linked_access_token` | For future API calls |
| `item.item_id` | `external_accounts` | `linked_item_ref` | Plaid item reference |
| `accounts[].account_id` | `external_accounts` | `linked_account_ref` | Selected account ID |
| `processor_token` | `external_accounts` | `linked_processor_token` | For ZeroHash integration |
| `institution.name` | `external_accounts` | `bank_name` | Bank display name |
| `institution.institution_id` | `external_accounts` | `bank_ref` | Bank identifier |
| `accounts[].name` | `external_accounts` | `account_name` | Account nickname |
| `accounts[].type` | `external_accounts` | `account_type` | Account type |
| `accounts[].mask` | `external_accounts` | `account_number` | Masked account number |

### Database Operations

```sql
UPDATE external_accounts SET
  external_account_ref = 'zh_external_account_id',
  linked_provider = 'plaid',
  linked_item_ref = 'plaid_item_id',
  linked_account_ref = 'plaid_account_id', 
  linked_access_token = 'access_token',
  linked_processor_token = 'processor_token',
  bank_name = 'Chase Bank',
  bank_ref = 'ins_56',
  account_name = 'Chase Checking',
  account_type = 'depository',
  account_number = '0000',
  updated_at = NOW()
WHERE id = 'ext_acc_uuid' AND user_id = 'user_uuid';
```

### Log Patterns
```
PlaidExternalAccountService - Starting handleTokenExchangeAndAccountLink for user [user.id]
Step 1: Exchanging public_token for access_token...
Step 5e: Updating Zerohash ExternalAccount record...
ExternalAccount id=[existing.id] successfully linked to bank account: [account.id]
```

---

## Phase 5: Account Funding Process

### Process Flow
1. **Risk Signal Evaluation** (Plaid Signal API)
2. **RFQ Quote Request** (ZeroHash)
3. **Transaction Record Creation**
4. **Fiat Wallet Transaction Creation**
5. **Payment Execution**

### Database Operations

1. **Initial Transaction Creation**
   ```sql
   INSERT INTO transactions (
     id, user_id, reference, external_reference, asset, amount,
     balance_before, balance_after, transaction_type, status, 
     metadata, description, created_at, updated_at
   ) VALUES (
     'trans_uuid', 'user_uuid', 'rfq_quote_ref', NULL, 'USD', 10000,
     0, 0, 'deposit', 'pending',
     '{"fiat_wallet_id": "wallet_uuid", "signal_evaluation": {...}, "rfq_response": {...}}',
     'External account funding - pending execution', NOW(), NOW()
   );
   ```

2. **Fiat Wallet Transaction Creation**
   ```sql
   INSERT INTO fiat_wallet_transactions (
     id, transaction_id, fiat_wallet_id, user_id, transaction_type,
     amount, balance_before, balance_after, currency, status,
     provider, provider_reference, source, destination, description,
     created_at, updated_at
   ) VALUES (
     'fwt_uuid', 'trans_uuid', 'wallet_uuid', 'user_uuid', 'deposit',
     10000, 0, 0, 'USD', 'pending',
     'zerohash', 'rfq_quote_ref', 'external_account', 'fiat_wallet',
     'External account funding - pending execution', NOW(), NOW()
   );
   ```

3. **Transaction Update with External Reference**
   ```sql
   UPDATE transactions SET
     external_reference = 'zh_transaction_id',
     status = 'processing',
     processed_at = NOW(),
     updated_at = NOW()
   WHERE id = 'trans_uuid';
   ```

### Log Patterns
```
ExternalAccountService - Processing fund request for user [user.id]
Signal evaluation: ACCEPT (ruleset: default)
RFQ quote received: [rfqResponse.quoteRef]
Transaction created with ID: [transaction.id] for quote: [rfqResponse.quoteRef]
```

---

## Phase 5b: Payment Execution

### Process Flow
1. **Transaction Validation** (Verify pending status and ownership)
2. **External Account Verification** (Validate participant and account references)
3. **Payment Execution** (ZeroHash API call)
4. **Transaction Status Update** (Set to processing/pending)
5. **Fiat Wallet Transaction Update** (Update corresponding record)

### API Endpoint

**POST** `/external-accounts/fund/execute`

### Request Payload
```json
{
  "transactionId": "fd64d9ab-e1fd-41b6-ae8d-90e4403f3303",
  "participantCode": "M0HRBN", 
  "externalAccountRef": "8f9f9aea-fd43-4cc9-9727-261042f0cb47"
}
```

### Response Structure
```json
{
  "message": "Payment executed successfully",
  "data": {
    "transaction_id": "fd64d9ab-e1fd-41b6-ae8d-90e4403f3303",
    "external_reference": "zh_transaction_abc123",
    "status": "submitted",
    "request_id": "req_789",
    "warning": "Optional warning message"
  },
  "statusCode": 200,
  "timestamp": "2024-01-01T12:30:00.000Z"
}
```

### Database Operations

1. **Transaction Validation and Update**
   ```sql
   -- First, validate transaction exists and is owned by user
   SELECT * FROM transactions 
   WHERE id = 'transaction_uuid' 
     AND user_id = 'user_uuid' 
     AND status = 'pending';
   
   -- Update with ZeroHash transaction reference (from /payments/execute response)
   UPDATE transactions SET
     external_reference = 'zh_transaction_id',
     status = CASE 
       WHEN 'zh_response_status' = 'submitted' THEN 'processing'
       ELSE 'pending'
     END,
     processed_at = CASE 
       WHEN 'zh_response_status' = 'submitted' THEN NOW()
       ELSE processed_at
     END,
     updated_at = NOW()
   WHERE id = 'transaction_uuid';
   ```

2. **Fiat Wallet Transaction Update**
   ```sql
   -- Update corresponding fiat wallet transaction
   UPDATE fiat_wallet_transactions SET
     status = CASE 
       WHEN 'zh_response_status' = 'submitted' THEN 'processing'
       ELSE 'pending'
     END,
     processed_at = CASE 
       WHEN 'zh_response_status' = 'submitted' THEN NOW()
       ELSE processed_at
     END,
     updated_at = NOW()
   WHERE transaction_id = 'transaction_uuid';
   ```

### ZeroHash API Integration

#### Execute Payment Request
```json
{
  "participant_code": "M0HRBN",
  "quote_id": "quote_ref_from_fund_step",
  "ach_signed_agreement": 1640995200,
  "external_account_id": "8f9f9aea-fd43-4cc9-9727-261042f0cb47",
  "description": "debit"
}
```

#### Execute Payment Response
```json
{
  "message": {
    "request_id": "req_789",
    "transaction_id": "zh_transaction_abc123",
    "status": "submitted",
    "warning": "Optional warning message"
  }
}
```

### Error Handling

| Error Type | HTTP Status | Description |
|------------|-------------|-------------|
| `NotFoundException` | 404 | Transaction not found |
| `ForbiddenException` | 403 | Transaction belongs to different user |
| `BadRequestException` | 400 | Transaction not in pending status |
| `NotFoundException` | 404 | External account not found |
| `BadGatewayException` | 502 | ZeroHash API error |

### Log Patterns
```
ExternalAccountService - Processing execute fund request for user [user.id]
Found existing transaction: [transaction.id] for quote: [quoteRef]
Executing payment using external account adapter
Payment executed successfully: [executeResponse.transactionRef]
Transaction updated with ID: [updatedTransaction.id]
Fiat wallet transaction updated with ID: [fiatWalletTransaction.id]
```

#### ZeroHash Execute Payment Response Mapping

When the `/payments/execute` API call succeeds, the `transaction_id` from the response is stored as the `external_reference` in the transactions table. This enables webhook lookups to find the correct transaction record.

| ZeroHash Response Field | Database Table | Database Field | Purpose |
|------------------------|----------------|----------------|---------|
| `transaction_id` | `transactions` | `external_reference` | Payment webhook matching |
| `status` | `transactions` | `status` | Initial status update |
| `request_id` | Response only | N/A | Request tracking |

---

## Phase 6: Payment Processing Webhooks

### ZeroHash Payment Status Webhooks

#### Field Mappings

| ZeroHash Field | Database Table | Database Field | Status Mapping |
|----------------|----------------|----------------|----------------|
| `transaction_id` | `transactions` | `external_reference` | Used for lookup |
| `payment_status` | `transactions` | `status` | See mapping below |
| `reason_code` | `transactions` | `metadata.provider_metadata` | Direct mapping |
| `reason_description` | `transactions` | `metadata.provider_metadata` | Direct mapping |
| `ach_failure_reason` | `transactions` | `failure_reason` | On failure |

#### Payment Status Mapping
```typescript
const paymentStatusMap: Record<string, TransactionStatus> = {
  'submitted': 'pending',
  'pending': 'pending', 
  'pending_trade': 'processing',
  'posted': 'processing',
  'settled': 'completed',
  'cancelled': 'cancelled',
  'failed': 'failed',
  'returned': 'failed',
  'rejected': 'failed',
  'retried': 'processing'
};
```

### ZeroHash Trade Status Webhooks

#### Field Mappings

| ZeroHash Field | Database Table | Database Field | Notes |
|----------------|----------------|----------------|--------|
| `client_trade_id` | `fiat_wallet_transactions` | `provider_quote_ref` | Used for lookup |
| `trade_state` | `fiat_wallet_transactions` | `status` | See mapping below |
| `trade_id` | `fiat_wallet_transactions` | `provider_metadata.trade_id` | ZeroHash internal ID |
| `trade_id` | `fiat_wallet_transactions` | `provider_reference` | Only when `trade_state = "accepted"` |
| `trade_price` | `fiat_wallet_transactions` | `provider_metadata.trade_price` | Exchange rate |
| `trade_quantity` | `fiat_wallet_transactions` | `provider_metadata.trade_quantity` | USDC amount |
| `total_notional` | `fiat_wallet_transactions` | `provider_metadata.total_notional` | USD total |

#### Special Processing for Accepted Trades

When a trade status webhook is received with `trade_state = "accepted"`, the system performs additional processing:

- The `trade_id` is stored in both `provider_metadata.trade_id` (for reference) and `provider_reference` (for tracking)
- This allows for better tracking of the ZeroHash internal trade lifecycle
- The `provider_reference` field enables easier lookup and correlation of subsequent trade-related events

#### Trade Status Mapping
```typescript
const tradeStatusMap: Record<string, TransactionStatus> = {
  'active': 'pending',
  'pending': 'pending',
  'accepted': 'processing', 
  'terminated': 'completed',
  'rejected': 'failed',
  'cancelled': 'cancelled',
  'expired': 'failed',
  'settled': 'completed'
};
```

### ZeroHash Balance Change Webhooks

#### Validation Requirements

The webhook service validates the following conditions before processing:
- `participant_code` is present
- `account_type` equals 'available'
- `run_type` equals 'settlement'  
- `asset` is a supported stablecoin (validated using utility class)

#### Field Mappings

| ZeroHash Field | Path | Database Impact | Notes |
|----------------|------|-----------------|--------|
| `participant_code` | `payload.participant_code` | Lookup external account | Required |
| `account_type` | `payload.account_type` | Validation filter | Must be 'available' |
| `run_type` | `payload.run_type` | Validation filter | Must be 'settlement' |
| `asset` | `payload.asset` | Validation filter | Must be supported stablecoin |
| `balance` | `payload.balance` | Wallet balance update | **For final_settlement only** |
| `movements[].trade_id` | `movements[].trade_id` | Match to transaction | Trade correlation |
| `timestamp` | `payload.timestamp` | Metadata | Settlement timestamp |

#### Balance Update Process

##### For final_settlement movements:

1. **Find Transaction by Trade ID**
   ```sql
   SELECT * FROM fiat_wallet_transactions 
   WHERE user_id = 'user_uuid' 
     AND provider = 'zerohash'
     AND provider_reference = 'trade_id_from_webhook';
   ```

2. **Update Wallet Balance from Payload**
   ```sql
   UPDATE fiat_wallets SET
     balance = [balance_from_payload_in_cents],
     updated_at = NOW()
        WHERE id = 'wallet_uuid';
   ```

3. **Update Transaction and Fiat Wallet Transaction**
   ```sql
   -- Update main transaction
   UPDATE transactions SET
     status = 'completed',
     balance_after = [balance_from_payload_in_cents],
     completed_at = NOW()
   WHERE id = 'transaction_uuid';
   
   -- Update fiat wallet transaction
   UPDATE fiat_wallet_transactions SET
     status = 'completed',
     balance_after = [balance_from_payload_in_cents],
     completed_at = NOW()
   WHERE id = 'fiat_wallet_transaction_uuid';
   ```

##### Special Processing Notes:

- **Enhanced Lookup**: Transactions are found using `trade_id` stored in `provider_reference` (from accepted trades)
- **Absolute Balance**: Uses the `balance` field from the payload instead of calculating from `change`
- **Validation**: Only processes webhooks with `account_type = 'available'` and `run_type = 'settlement'`
- **Required Trade ID**: Transaction must exist with the `trade_id` in `provider_reference` field

### Log Patterns
```
ZerohashWebhookService - ZeroHash webhook received: payment_status_changed
Transaction id=[transaction.id] status: processing → completed
Processing USDC.SOL balance change: [changeAmount] ([changeInCents] cents) for trade_id: [trade_id]
Successfully processed USDC.SOL settlement for trade [trade_id]: [changeAmount] USDC.SOL added to wallet [fiatWallet.id]
```

---

## Transaction Status Flow

### Main Transaction States
```
pending → processing → completed
pending → failed
pending → cancelled
```

### Fiat Wallet Transaction States  
```
pending → processing → completed
pending → failed
pending → cancelled
```

### Status Synchronization
- Both `transactions` and `fiat_wallet_transactions` tables maintain synchronized status
- Webhooks update both records atomically
- Balance changes only occur on `completed` status

---

## Database Schema Summary

### Core Tables Involved

1. **users** - Main user account information
2. **user_profiles** - Extended user profile data
3. **account_verifications** - Email verification codes
4. **kyc_verifications** - KYC status and details
5. **kyc_status_logs** - KYC status change history
6. **external_accounts** - Provider account linkages
7. **fiat_wallets** - User wallet balances
8. **fiat_wallet_transactions** - Wallet transaction history
9. **transactions** - Main transaction records
10. **users_roles** - User role assignments
11. **access_tokens** - Authentication tokens
12. **refresh_tokens** - Token refresh records

### Key Relationships

```sql
users (1) ← (1) user_profiles
users (1) ← (n) kyc_verifications  
users (1) ← (n) external_accounts
users (1) ← (n) fiat_wallets
users (1) ← (n) transactions
users (1) ← (n) fiat_wallet_transactions

transactions (1) ← (n) fiat_wallet_transactions
fiat_wallets (1) ← (n) fiat_wallet_transactions
external_accounts (1) ← (n) fiat_wallet_transactions (via provider)
```

---

## Error Handling & Edge Cases

### Webhook Retry Logic
- Failed webhooks are retried automatically by providers
- Duplicate webhooks are handled via status priority checks
- Race conditions prevented using distributed locking

### Status Priority Enforcement
- No downgrades from terminal states (`approved`, `completed`, `failed`)
- Status transitions follow defined priority hierarchy
- Unknown statuses are logged but don't update records

### Balance Consistency
- All balance updates use database transactions
- Concurrent updates prevented via row locking
- Balance validation ensures no negative balances

---

## Monitoring & Observability

### Key Log Patterns for Monitoring

1. **Registration Flow**
   ```
   RegisterService.register - User registered successfully
   ```

2. **KYC Progress**
   ```
   SumsubWebhookService.processWebhook - Processing Webhook for user [user_id]
   handleKycSuccessAndCreateWallets - Handling KYC success
   ```

3. **Account Linking**
   ```
   ExternalAccount id=[id] successfully linked to bank account: [account_id]
   ```

4. **Funding Success**
   ```
   Successfully processed USDC.SOL settlement for trade [trade_id]
   ```

5. **Error Conditions**
   ```
   Error processing webhook: [error.message]
   Fund request failed
   ```

### Critical Metrics to Track

- User registration completion rate
- KYC approval/rejection rates  
- Bank account linking success rate
- Funding transaction success rate
- Webhook processing latency
- Balance reconciliation accuracy

This comprehensive mapping enables full traceability from external provider webhooks through to internal database state changes, supporting both operational monitoring and debugging of the end-to-end user journey. 