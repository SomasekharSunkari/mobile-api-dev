# Account Transfer for US Users

## Overview

The Account Transfer system allows US users to fund their OneDosh fiat wallets by transferring money from their linked external bank accounts. The system uses Plaid for bank account linking and risk assessment, and ZeroHash for payment processing and settlement.

---

## System Flow

### 1. Bank Account Linking
Users must first link their bank account using the Plaid integration:

**POST** `/external-accounts/plaid/exchange`

### 2. Fund Initiation
Request a funding quote and initiate the transfer:

**POST** `/external-accounts/fund`

### 3. Fund Execution
Execute the approved funding transaction:

**POST** `/external-accounts/fund/execute`

### 4. Fund Cancellation (Optional)
Cancel a pending funding transaction:

**POST** `/external-accounts/fund/cancel`

---

## Detailed Process

### Step 1: Create Link Token

First, create a Plaid link token for account linking:

**Endpoint**: `POST /external-accounts/link-token`

**Request Body**:
```json
{
  "android_package_name": "com.onedosh.app" // Optional for mobile apps
}
```

**Response**:
```json
{
  "success": true,
  "message": "External account link token created successfully",
  "data": {
    "link_token": "link-production-abc123...",
    "expiration": "2024-01-01T12:00:00Z"
  }
}
```

### Step 2: Complete Plaid Link Flow

Use the link token in your frontend to complete the Plaid Link flow. Once the user selects their bank account, you'll receive a `public_token`.

### Step 3: Exchange Public Token

Exchange the public token for an access token and link the account:

**Endpoint**: `POST /external-accounts/plaid/exchange`

**Request Body**:
```json
{
  "public_token": "public-production-abc123...",
  "metadata": {
    "accounts": [
      {
        "id": "account_id_123",
        "name": "Checking Account",
        "type": "depository",
        "subtype": "checking"
      }
    ],
    "institution": {
      "institution_id": "ins_123",
      "name": "Chase Bank"
    }
  }
}
```

**Response**:
```json
{
  "success": true,
  "message": "Account linked successfully",
  "data": {
    "success": true
  }
}
```

### Step 4: Initiate Funding

Request a funding quote and risk evaluation:

**Endpoint**: `POST /external-accounts/fund`

**Request Body**:
```json
{
  "external_account_id": "ext_account_123",
  "amount": 100.00,
  "currency": "USD",
  "transfer_type": "debit"  // "debit" for funding wallet, "credit" for withdrawal
}
```

**Response**:
```json
{
  "success": true,
  "message": "Fund request initiated successfully",
  "data": {
    "transaction_id": "txn_abc123",
    "quote_ref": "quote_xyz789",
    "amount": 100.00,
    "currency": "USD",
    "external_account": {
      "id": "ext_account_123",
      "account_name": "Checking Account",
      "institution_name": "Chase Bank"
    },
    "signal_evaluation": {
      "result": "ACCEPT",
      "request_ref": "signal_req_123",
      "ruleset": "us_deposit_v1",
      "scores": {
        "accountOwnershipRisk": 0.1,
        "customerInitiatedReturnRisk": 0.05
      }
    },
    "quote": {
      "quote_ref": "quote_xyz789",
      "amount": "100.00",
      "currency": "USD",
      "expires_at": "2024-01-01T12:05:00Z"
    },
    "status": "pending"
  }
}
```

### Step 5: Execute Funding

Execute the approved funding transaction:

**Endpoint**: `POST /external-accounts/fund/execute`

**Request Body**:
```json
{
  "transaction_id": "txn_abc123",
  "external_account_id": "ext_account_123"
}
```

**Response**:
```json
{
  "success": true,
  "message": "Payment executed successfully",
  "data": {
    "transaction_id": "txn_abc123",
    "payment_ref": "payment_def456",
    "status": "processing",
    "amount": 100.00,
    "currency": "USD",
    "estimated_completion": "2024-01-01T15:00:00Z"
  }
}
```

### Step 6: Cancel Funding (Optional)

Cancel a pending funding transaction:

**Endpoint**: `POST /external-accounts/fund/cancel`

**Request Body**:
```json
{
  "transaction_id": "txn_abc123"
}
```

**Response**:
```json
{
  "success": true,
  "message": "Transaction cancelled successfully",
  "data": {
    "transaction_id": "txn_abc123",
    "status": "cancelled"
  }
}
```

---

## Risk Assessment

### Plaid Signal Integration

All funding requests are evaluated using Plaid Signal for risk assessment:

**Risk Factors Evaluated**:
- Account ownership verification
- Customer-initiated return risk
- Historical account behavior
- Transaction patterns

**Risk Results**:
- **ACCEPT**: Transaction approved, can proceed to execution
- **REVIEW**: Manual review required
- **DECLINE**: Transaction rejected

### Risk Scores

The system provides detailed risk scores:
- `accountOwnershipRisk`: Risk that the account doesn't belong to the user (0.0 - 1.0)
- `customerInitiatedReturnRisk`: Risk of customer-initiated returns (0.0 - 1.0)

---

## Payment Processing

### ZeroHash Integration

Approved transactions are processed through ZeroHash:

1. **Quote Generation**: Get real-time pricing and fees
2. **Payment Execution**: Initiate ACH debit from user's bank account
3. **Settlement**: Convert USD to stablecoin and credit user's wallet
4. **Confirmation**: Webhook notifications for status updates

### Transaction States

| State        | Description                                    |
| ------------ | ---------------------------------------------- |
| `pending`    | Quote generated, awaiting execution            |
| `processing` | Payment initiated, awaiting settlement         |
| `completed`  | Payment settled, funds available in wallet     |
| `failed`     | Payment failed, funds not transferred         |
| `cancelled`  | Transaction cancelled by user                  |

---

## Error Handling

### Common Error Responses

**400 Bad Request** - Invalid request data:
```json
{
  "success": false,
  "message": "Validation failed",
  "errors": [
    "Amount must be greater than 0",
    "Currency must be USD"
  ]
}
```

**404 Not Found** - Resource not found:
```json
{
  "success": false,
  "message": "External account not found"
}
```

**409 Conflict** - Existing pending transaction:
```json
{
  "success": false,
  "message": "You already have a pending transaction for this account"
}
```

### Risk Assessment Failures

When risk assessment fails:
```json
{
  "success": false,
  "message": "Transaction declined by risk assessment",
  "data": {
    "signal_evaluation": {
      "result": "DECLINE",
      "reason": "High account ownership risk"
    }
  }
}
```

---

## Rate Limits

All external account endpoints are subject to strict rate limiting:
- **10 requests per minute** per user
- **100 requests per hour** per user

Exceeding rate limits returns HTTP 429 with retry-after header.

---

## Webhook Notifications

Transaction status updates are sent via webhooks:

**Event Types**:
- `payment_status_changed`: Payment status updates
- `account_balance.changed`: Wallet balance updates

See [ZeroHash Webhook Documentation](./webhooks/zeroHashWebhook.md) for details.

---

## Security Considerations

### Data Protection
- Bank account details are encrypted at rest
- Plaid access tokens are securely stored
- PII is handled according to data protection regulations

### Fraud Prevention
- Multi-factor authentication required
- Device fingerprinting
- Behavioral analysis
- Real-time risk scoring

### Compliance
- NACHA ACH compliance
- KYC/AML verification required
- Transaction monitoring and reporting

---

## Testing

### Sandbox Environment

Use Plaid's sandbox environment for testing:
- Sandbox institutions available
- Test account credentials provided
- Simulated transaction flows

### Test Scenarios

Common test cases:
1. Successful funding flow
2. Risk assessment decline
3. Payment failure scenarios
4. Network timeout handling
5. Webhook delivery testing

--- 