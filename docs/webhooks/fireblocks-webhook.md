# Fireblocks Webhook Integration

This document describes the Fireblocks webhook integration for the Onedosh payment platform.

## Overview

The Fireblocks webhook integration supports both v1 and v2 webhook formats with proper signature verification for security. The integration includes a complete webhook processing pipeline with automatic version detection, signature verification, and payload normalization.

## Architecture

The webhook integration consists of several components:

- **FireblocksWebhookController**: Handles incoming webhook requests
- **FireblocksWebhookService**: Processes webhook logic and validation
- **FireblocksAdapter**: Provides signature verification and webhook management
- **BlockchainWalletService**: Processes webhook data for business logic

## Webhook Endpoint

**URL**: `POST /webhooks/fireblocks`

## Supported Webhook Versions

### V1 Webhooks
- **Signature Method**: RSA-SHA512
- **Header**: `fireblocks-signature` (Base64 encoded)
- **Version Detection**: Presence of `fireblocks-api-version` header
- **Public Key**: Configured via `FIREBLOCKS_WEBHOOK_PUBLIC_KEY` environment variable

### V2 Webhooks
- **Signature Method**: HMAC-SHA256
- **Header**: `fireblocks-signature` (Hex encoded)
- **Timestamp Header**: `fireblocks-timestamp` (Unix timestamp)
- **Secret**: Configured via `FIREBLOCKS_WEBHOOK_SECRET` environment variable

## Required Headers

### For V1 Webhooks
```
fireblocks-signature: <base64-encoded-signature>
fireblocks-api-version: <version>
```

### For V2 Webhooks
```
fireblocks-signature: <hex-encoded-signature>
fireblocks-timestamp: <unix-timestamp>
```

## Webhook Processing Flow

1. **Request Reception**: `FireblocksWebhookController` receives the webhook request
2. **Header Validation**: Validates required headers are present
3. **Version Detection**: Automatically detects webhook version based on payload structure
4. **Signature Verification**: Verifies webhook signature using appropriate method
5. **Payload Processing**: Processes webhook through blockchain wallet service
6. **Response**: Returns appropriate success/error response

## Webhook Payload Structure

The webhook payload follows the Fireblocks webhook format:

```json
{
  "type": "TRANSACTION_STATUS_UPDATED",
  "tenantId": "a460e89b-4c00-5fe6-8de8-5d4a882d791b",
  "timestamp": 1750511462129,
  "data": {
    "id": "d61a49ed-0584-440f-80f3-baf053765d98",
    "createdAt": 1750511401803,
    "lastUpdated": 1750511401803,
    "assetId": "FTHL_B69Q58V3_T2KE",
    "source": {
      "id": "0",
      "type": "VAULT_ACCOUNT",
      "name": "Client individual (per client)",
      "subType": ""
    },
    "destination": {
      "id": "1",
      "type": "VAULT_ACCOUNT",
      "name": "dApps",
      "subType": ""
    },
    "amount": 1,
    "sourceAddress": "",
    "destinationAddress": "",
    "destinationAddressDescription": "",
    "destinationTag": "",
    "status": "SUBMITTED",
    "txHash": "",
    "subStatus": "",
    "signedBy": [],
    "createdBy": "9438524d-766f-48ed-b67c-a0da14404ca0",
    "rejectedBy": "",
    "amountUSD": 1,
    "addressType": "",
    "note": "",
    "exchangeTxId": "",
    "requestedAmount": 1,
    "feeCurrency": "ETH_TEST6",
    "operation": "TRANSFER",
    "customerRefId": null,
    "amountInfo": {
      "amount": "1",
      "requestedAmount": "1",
      "amountUSD": "1.00"
    },
    "feeInfo": {},
    "destinations": [],
    "externalTxId": null,
    "blockInfo": {},
    "signedMessages": [],
    "assetType": "ERC20"
  }
}
```

## Supported Webhook Types

- `TRANSACTION_CREATED`
- `TRANSACTION_STATUS_UPDATED`
- `TRANSACTION_COMPLETED`
- `TRANSACTION_FAILED`

## Environment Configuration

Add the following environment variables to your configuration:

```bash
# For V1 webhooks (RSA-SHA512 signature verification)
FIREBLOCKS_WEBHOOK_PUBLIC_KEY="-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAw+fZuC+0vDYTf8fYnCN6
71iHg98lPHBmafmqZqb+TUexn9sH6qNIBZ5SgYFxFK6dYXIuJ5uoORzihREvZVZP
8DphdeKOMUrMr6b+Cchb2qS8qz8WS7xtyLU9GnBn6M5mWfjkjQr1jbilH15Zvcpz
ECC8aPUAy2EbHpnr10if2IHkIAWLYD+0khpCjpWtsfuX+LxqzlqQVW9xc6z7tshK
eCSEa6Oh8+ia7Zlu0b+2xmy2Arb6xGl+s+Rnof4lsq9tZS6f03huc+XVTmd6H2We
WxFMfGyDCX2akEg2aAvx7231/6S0vBFGiX0C+3GbXlieHDplLGoODHUt5hxbPJnK
IwIDAQAB
-----END PUBLIC KEY-----"

# For V2 webhooks (HMAC-SHA256 signature verification)
FIREBLOCKS_WEBHOOK_SECRET="your-webhook-secret"
```

## Response Format

### Success Response
```json
{
  "success": true,
  "message": "Fireblocks webhook processed successfully",
  "data": {
    "success": true,
    "message": "Webhook processed successfully",
    "transactionId": "d61a49ed-0584-440f-80f3-baf053765d98",
    "status": "SUBMITTED"
  }
}
```

### Error Response
```json
{
  "success": false,
  "message": "Fireblocks webhook processing failed",
  "data": {
    "success": false,
    "message": "Invalid webhook signature"
  }
}
```

## Security Features

1. **Signature Verification**: All webhooks are verified using the appropriate signature method
2. **Timestamp Validation**: V2 webhooks include timestamp validation (5-minute window)
3. **Version Detection**: Automatic detection of webhook version based on payload structure
4. **Error Handling**: Comprehensive error handling and logging
5. **Idempotency**: Webhook processing is designed to be idempotent

## Implementation Details

### FireblocksWebhookController

The controller handles incoming webhook requests and provides the main entry point:

```typescript
@Controller('/webhooks/fireblocks')
export class FireblocksWebhookController extends BaseController {
  @Post()
  async handleWebhook(
    @Body() body: IFireblocksWebhookV1Payload | IFireblocksWebhookV2Payload,
    @Headers() headers: Record<string, string>,
  ) {
    // Process webhook and return response
  }
}
```

### FireblocksWebhookService

The service provides webhook processing logic:

- **Header Validation**: Ensures required headers are present
- **Version Detection**: Automatically detects webhook version
- **Payload Processing**: Handles webhook through blockchain wallet service
- **Error Handling**: Comprehensive error handling and logging

### FireblocksAdapter Webhook Methods

The adapter provides several webhook-related methods:

#### `handleWebhook(payload: string, signature: string, timestamp?: string, version: 'v1' | 'v2' = 'v2')`

Main webhook processing method with signature verification and payload normalization.

#### `verifyWebhookSignature(payload: string, signature: string, timestamp: string, version: 'v1' | 'v2' = 'v1')`

Verifies webhook signatures using appropriate cryptographic methods.

#### `normalizeWebhookData(webhookData: IFireblocksWebhookV1Payload | IFireblocksWebhookV2Payload)`

Normalizes webhook data from both v1 and v2 formats into a common internal format.

#### `resendWebhook(params?: { txId?: string; resendCreated?: boolean; resendStatusUpdated?: boolean })`

Resends webhook notifications for failed deliveries or specific transactions.

## Webhook Management

### Resending Failed Webhooks

You can resend failed webhooks using the blockchain wallet service:

```typescript
// Resend webhooks for a specific transaction
const result = await blockchainWalletService.resendWebhook({
  txId: 'transaction-123',
  resendCreated: true,
  resendStatusUpdated: true
});

// Resend all failed webhooks
const result = await blockchainWalletService.resendWebhook();
```

### Webhook Monitoring

The system provides comprehensive logging for webhook monitoring:

- Webhook reception and processing
- Signature verification results
- Error details and stack traces
- Transaction status updates

## Testing

Use the provided test suite to verify webhook functionality:

```bash
npm test -- --testPathPattern=fireblocks-webhook.controller.spec.ts
```

### Test Scenarios

1. **Valid V1 Webhook**: Test with proper RSA-SHA512 signature
2. **Valid V2 Webhook**: Test with proper HMAC-SHA256 signature and timestamp
3. **Invalid Signature**: Test with incorrect signature
4. **Missing Headers**: Test with missing required headers
5. **Expired Timestamp**: Test V2 webhook with expired timestamp
6. **Invalid Payload**: Test with malformed JSON payload

## Sandbox Configuration

For testing in the Fireblocks sandbox environment, use the provided public key in the configuration above.

## Troubleshooting

### Common Issues

1. **Invalid Signature**: Ensure the correct public key/secret is configured
2. **Timestamp Expired**: V2 webhooks have a 5-minute timestamp window
3. **Missing Headers**: Ensure all required headers are present
4. **Version Detection**: Check payload structure matches expected format

### Debug Logging

Enable debug logging to troubleshoot webhook issues:

```typescript
// In your application configuration
const logger = new Logger('FireblocksWebhook');
logger.debug('Webhook processing details');
```

## API Reference

For detailed API documentation, see the [Fireblocks API Reference](https://developers.fireblocks.com/reference).

## Related Documentation

- [Fireblocks Integration README](../src/adapters/blockchain-waas/fireblocks/README.md)
- [Blockchain Wallet Service](../src/modules/blockchainWallet(test)/blockchainWallet.service.ts)
- [Fireblocks Adapter](../src/adapters/blockchain-waas/fireblocks/fireblocks_adapter.ts) 