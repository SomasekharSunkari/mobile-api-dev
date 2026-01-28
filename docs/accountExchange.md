# Account Exchange & Transfer

## Overview

The Account Exchange system enables users to exchange between different fiat currencies (e.g., USD to NGN) and transfer funds to other OneDosh users. The system uses ZeroHash for exchange execution and settlement, with real-time exchange rates and transparent fee structures.

---

## System Capabilities

### 1. Currency Exchange
Convert between supported fiat currencies using real-time exchange rates:

**POST** `/fiat-wallets/exchange`

### 2. Peer-to-Peer Transfer
Transfer funds directly to other OneDosh users:

**POST** `/fiat-wallets/transfer`

### 3. Exchange Execution
Execute approved exchange transactions:

**POST** `/fiat-wallets/exchange/execute`

### 4. Exchange Cancellation
Cancel pending exchange transactions:

**POST** `/fiat-wallets/exchange/cancel`

---

## Currency Exchange

### Initiate Exchange

Exchange one currency for another in your fiat wallets:

**Endpoint**: `POST /fiat-wallets/exchange`

**Request Body**:
```json
{
  "from": "USD",
  "to": "NGN", 
  "amount": 100.00
}
```

**Response**:
```json
{
  "success": true,
  "message": "Exchange initiated successfully",
  "data": {
    "source_transaction_id": "txn_source_123",
    "destination_transaction_id": "txn_dest_456", 
    "client_withdrawal_request_id": "withdraw_ref_789",
    "from_currency": "USD",
    "to_currency": "NGN",
    "source_amount": 100.00,
    "expected_destination_amount": 76500.00,
    "exchange_rate": 765.00,
    "rate_reference": "rate_ref_abc123",
    "status": "initiated",
    "message": "Exchange quote generated successfully"
  }
}
```

### Exchange Process Flow

1. **Balance Validation**: System verifies sufficient balance in source currency
2. **Rate Lookup**: Current exchange rates are fetched from rate providers
3. **Transaction Creation**: Source (debit) and destination (credit) transactions are created
4. **Quote Generation**: ZeroHash withdrawal quote is obtained
5. **Status**: Exchange remains in `initiated` status pending execution

### Execute Exchange

Execute a pending exchange transaction:

**Endpoint**: `POST /fiat-wallets/exchange/execute`

**Request Body**:
```json
{
  "source_transaction_id": "txn_source_123"
}
```

**Response**:
```json
{
  "success": true,
  "message": "Exchange execution initiated successfully",
  "data": {
    "withdrawal_request_id": "withdrawal_req_456",
    "status": "processing",
    "expected_completion": "2024-01-01T15:00:00Z"
  }
}
```

### Cancel Exchange

Cancel a pending exchange transaction:

**Endpoint**: `POST /fiat-wallets/exchange/cancel`

**Request Body**:
```json
{
  "source_transaction_id": "txn_source_123"
}
```

**Response**:
```json
{
  "success": true,
  "message": "Exchange cancelled successfully",
  "data": {
    "source_transaction_id": "txn_source_123",
    "destination_transaction_id": "txn_dest_456",
    "status": "cancelled"
  }
}
```

---

## Peer-to-Peer Transfer

### Initiate Transfer

Transfer funds to another OneDosh user:

**Endpoint**: `POST /fiat-wallets/transfer`

**Request Body**:
```json
{
  "username": "recipient_user",
  "amount": 50.00,
  "asset": "USD"
}
```

**Response**:
```json
{
  "success": true,
  "message": "Transfer initiated successfully",
  "data": {
    "sender_transaction_id": "txn_sender_123",
    "recipient_transaction_id": "txn_recipient_456",
    "client_transfer_id": "transfer_ref_789",
    "transfer_id": "zh_transfer_abc123",
    "amount": 50.00,
    "asset": "USD", 
    "recipient": "recipient_user",
    "status": "approved",
    "message": "Transfer initiated successfully"
  }
}
```

### Transfer Process Flow

1. **Recipient Validation**: System verifies recipient user exists and is active
2. **Self-Transfer Prevention**: Prevents users from transferring to themselves
3. **Account Verification**: Validates both sender and recipient have ZeroHash accounts
4. **Transaction Creation**: Creates linked debit (sender) and credit (recipient) transactions
5. **ZeroHash Transfer**: Initiates transfer via ZeroHash fiat wallet adapter
6. **Real-time Processing**: Transfer is processed immediately via ZeroHash

---

## Supported Currencies

### Currently Supported

| Currency | Code | Smallest Unit | Exchange Support |
| -------- | ---- | ------------- | ---------------- |
| US Dollar | USD | Cents | ✅ |
| Nigerian Naira | NGN | Kobo | ✅ |

### Exchange Pairs

Currently supported exchange combinations:
- **USD → NGN**: US Dollars to Nigerian Naira

Future exchange pairs will be added based on market demand and regulatory compliance.

---

## Exchange Rates

### Rate Sources

Exchange rates are provided by integrated rate providers with real-time updates.

### Rate Types

- **Buy Rate**: Rate for buying a currency (not currently used)
- **Sell Rate**: Rate for selling a currency (used for USD → NGN exchanges)

### Rate Transparency

All exchange rates include:
- Current rate at time of quote
- Rate reference for tracking
- Rate validity period
- Fee structure

---

## Transaction States

### Exchange Transaction States

| State | Description |
| ----- | ----------- |
| `initiated` | Exchange quote generated, awaiting execution |
| `processing` | Exchange being processed via ZeroHash |
| `completed` | Exchange completed, balances updated |
| `failed` | Exchange failed, balances reverted |
| `cancelled` | Exchange cancelled by user |

### Transfer Transaction States

| State | Description |
| ----- | ----------- |
| `approved` | Transfer approved and processed |
| `pending` | Transfer initiated, awaiting confirmation |
| `completed` | Transfer completed successfully |
| `failed` | Transfer failed |
| `cancelled` | Transfer cancelled |

---

## Fee Structure

### Exchange Fees

Exchange fees are determined by:
- ZeroHash withdrawal fees
- Network fees for stablecoin transactions
- OneDosh service fees (if applicable)

All fees are transparently disclosed before execution.

### Transfer Fees

P2P transfers within OneDosh:
- **Same Currency**: Currently no fees
- **Cross-Currency**: Exchange fees apply
- **ZeroHash Fees**: Network and processing fees as applicable

---

## Security & Compliance

### Transaction Security

- All transactions require user authentication
- Multi-factor authentication for large amounts
- Real-time fraud monitoring
- Transaction limits based on user verification level

### Compliance Features

- **AML Monitoring**: All large transactions are monitored
- **KYC Requirements**: Users must complete verification for high-value transactions
- **Transaction Reporting**: Automated reporting for regulatory compliance
- **Audit Trail**: Complete transaction history maintained

### Rate Limiting

Exchange and transfer endpoints have rate limits:
- **5 exchanges per hour** per user
- **10 transfers per hour** per user
- **Daily volume limits** based on user tier

---

## Error Handling

### Common Errors

**Insufficient Balance**:
```json
{
  "success": false,
  "message": "Insufficient balance for exchange"
}
```

**User Not Found**:
```json
{
  "success": false,
  "message": "User with username 'invalid_user' not found"
}
```

**Unsupported Exchange**:
```json
{
  "success": false,
  "message": "Only USD to NGN exchange is currently supported"
}
```

**Self-Transfer Attempt**:
```json
{
  "success": false,
  "message": "Cannot transfer to yourself"
}
```

### Exchange Rate Errors

**No Rates Available**:
```json
{
  "success": false,
  "message": "No exchange rates available for the requested currency"
}
```

**Invalid Transaction Status**:
```json
{
  "success": false,
  "message": "Transaction is not in pending status: completed"
}
```

---

## Webhook Integration

### Webhook Events

Exchange and transfer status updates are delivered via webhooks:

**Event Types**:
- `trade.status_changed`: Exchange status updates
- `account_balance.changed`: Balance updates from completed transactions

### Example Webhook Payload

```json
{
  "event_type": "trade.status_changed",
  "participant_code": "USER123",
  "trade_id": "trade_abc123",
  "status": "completed",
  "asset": "USD",
  "amount": "100.00",
  "timestamp": "2024-01-01T12:00:00Z"
}
```

See [ZeroHash Webhook Documentation](./webhooks/zeroHashWebhook.md) for complete webhook details.

---

## API Rate Limits

### Standard Limits

- **Exchange Initiation**: 5 requests per hour
- **Transfer Initiation**: 10 requests per hour  
- **Balance Queries**: 60 requests per hour
- **Transaction History**: 30 requests per hour

### Enhanced Limits

Users with higher verification tiers receive increased limits:
- **Tier 2**: 2x standard limits
- **Tier 3**: 5x standard limits
- **Enterprise**: Custom limits

---

## Testing

### Sandbox Environment

Test exchange and transfer functionality:

**Test Scenarios**:
1. Successful USD to NGN exchange
2. P2P transfer between test users
3. Exchange cancellation flow
4. Insufficient balance handling
5. Rate expiration scenarios

### Test Users

Sandbox environment provides test users:
- Pre-funded wallets in multiple currencies
- Linked ZeroHash accounts
- Various verification levels

### Mock Exchange Rates

Sandbox uses predictable exchange rates:
- USD/NGN: 765.00 (fixed for testing)
- Rate updates every 5 minutes
- Configurable rate volatility

---

## Monitoring & Analytics

### Transaction Monitoring

Real-time monitoring includes:
- **Success Rates**: Exchange and transfer completion rates
- **Processing Times**: Average time from initiation to completion
- **Error Rates**: Failed transaction analysis
- **Volume Tracking**: Daily/monthly transaction volumes

### Performance Metrics

Key performance indicators:
- **Exchange Rate Accuracy**: Deviation from market rates
- **Settlement Speed**: Time to final settlement
- **System Uptime**: API availability metrics
- **User Satisfaction**: Transaction success from user perspective

--- 