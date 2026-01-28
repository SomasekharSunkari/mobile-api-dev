# Fireblocks Integration Documentation

## Overview

This documentation provides an in-depth guide to the Fireblocks integration, detailing the functionalities of the `FireblocksAdapter` and `FireblocksAxiosHelper` classes, including comprehensive webhook support.

---

## Table of Contents

- [FireblocksAdapter](#fireblocksadapter)
  - [Webhook Support](#webhook-support)
- [FireblocksAxiosHelper](#fireblocksaxioshelper)
  - [HTTP Methods](#http-methods)
  - [Request Signing](#request-signing)
- [Idempotency Key](#idempotency-key)
  - [Purpose](#purpose)
  - [Usage Guidelines](#usage-guidelines)
  - [Implementation in FireblocksAxiosHelper](#implementation-in-fireblocksaxioshelper)
- [Error Handling](#error-handling)

---

## FireblocksAdapter

The `FireblocksAdapter` provides a NestJS-compatible interface for interacting with the Fireblocks API. It implements the `IBlockchainWaasManagement` interface, offering methods for managing vault accounts, assets, deposit addresses, transactions, and webhooks.

### Features

- Retrieve supported stable assets
- Create vault accounts with user metadata
- Generate deposit addresses for multiple assets
- Fetch vault account and asset balances
- Built-in error handling and logging
- Support for idempotency keys to ensure safe retries
- **Webhook processing with signature verification**
- **Support for both v1 and v2 webhook formats**
- **Webhook resend functionality**

### Installation

Ensure you have the necessary dependencies installed:

```bash
npm install @nestjs/common axios
```

Import the `FireblocksAdapter` into your module:

```typescript
import { Module } from '@nestjs/common';
import { FireblocksAdapter } from './fireblocks.adapter';

@Module({
  providers: [FireblocksAdapter],
  exports: [FireblocksAdapter],
})
export class FireblocksModule {}
```

### Usage

#### Basic Usage

```typescript
import { Injectable } from '@nestjs/common';
import { FireblocksAdapter } from 'src/adapters/blockchain-waas/fireblocks/fireblocks_adapter.ts';

@Injectable()
export class YourService {
  constructor(private readonly fireblocksAdapter: FireblocksAdapter) {}

  async performCriticalOperation() {
    const response = await this.fireblocksAdapter.createAccount({
      user_id: 'user-123',
      user_name: 'John Doe',
      idempotencyKey: 'unique-key-123',
    });

    return response;
  }
}
```

#### Creating a Vault Account

```typescript
const response = await fireblocksAdapter.createAccount({
  user_id: 'user-123',
  user_name: 'John Doe',
  idempotencyKey: 'unique-key-123',
});
```

#### Creating Deposit Addresses

```typescript
const response = await fireblocksAdapter.createWallet({
  user_id: 'user-123',
  account_id: 'vault-456',
  asset_ids: ['USDC', 'DAI'],
  idempotencyKey: 'unique-key-456',
});
```

#### Fetching Vault Account Details

```typescript
const vault = await fireblocksAdapter.getVaultAccount('vault-456');
```

#### Fetching Asset Balance

```typescript
const balance = await fireblocksAdapter.getAssetBalance('vault-456', 'USDC');
```

### API Reference

#### `getAvailableStableAssets(): Promise<Pick<IFireblocksAsset, 'id' | 'name' | 'type' | 'nativeAsset'>[]>`

Fetches and filters supported assets to return only stablecoins based on predefined keywords.

#### `createAccount(params: ICreateAccountParams): Promise<ICreateAccountResponse>`

Creates a new vault account with the provided user information.

- `params.user_id`: User identifier
- `params.user_name`: User's name
- `params.idempotencyKey` (optional): Unique key to ensure idempotency

#### `createWallet(params: ICreateWalletParams): Promise<ICreateWalletResponse>`

Generates deposit addresses for specified assets within a vault account.

- `params.user_id`: User identifier
- `params.account_id`: Vault account ID
- `params.asset_ids`: Array of asset identifiers
- `params.idempotencyKey` (optional): Unique key to ensure idempotency

#### `getVaultAccount(vaultAccountId: string): Promise<IVaultAccount>`

Retrieves details of a specific vault account, including associated assets.

#### `getAssetBalance(vaultAccountId: string, assetId: string): Promise<IVaultAsset>`

Fetches the balance details of a specific asset within a vault account.

#### `estimateTransactionFee(params: IEstimateTransactionFeeParams): Promise<IFireblocksEstimateFeeResponse>`

Estimates transaction fees for operations in Fireblocks. This method provides direct access to Fireblocks' fee estimation API, supporting all transaction types.

Parameters:
- `params.assetId`: The ID of the asset being transferred (e.g., 'ETH', 'BTC')
- `params.amount`: The amount to transfer as a string (e.g., '1.5')
- `params.source`: Source of the funds
  - `type`: Source type (e.g., 'VAULT_ACCOUNT', 'EXCHANGE_ACCOUNT')
  - `id`: ID of the source (e.g., vault account ID)
- `params.destination`: Transaction destination
  - `type`: Destination type (e.g., 'VAULT_ACCOUNT', 'ONE_TIME_ADDRESS')
  - `id`: ID for known destinations
  - `address`: Address for one-time destinations
  - `tag`: Optional tag/memo for certain assets
- `params.operation`: Transaction operation type (default: 'TRANSFER')
- `params.feeLevel`: Preferred fee level (default: 'HIGH')

Returns fee estimates at three priority levels:
- `low`: Conservative fee estimate (may take longer to confirm)
- `medium`: Recommended for most transactions
- `high`: Priority fee estimate (faster confirmation)

Each level contains:
- `networkFee`: The estimated network fee in the asset's smallest unit
- `gasPrice`/`maxFeePerGas`/`maxPriorityFeePerGas`: For EVM chains

#### `createTransaction(params: ICreateTransactionParams): Promise<ICreateTransactionResponse>`

Creates a new transaction in Fireblocks with support for various transaction types and parameters.

Parameters:
- `params.operation`: Transaction operation type (default: 'TRANSFER')
- `params.assetId`: The ID of the asset to transfer
- `params.source`: Source of the funds
- `params.destination`: Transaction destination
- `params.amount`: Amount to transfer
- `params.note`: Optional transaction note
- `params.externalTxId`: Optional external transaction ID
- `params.feeLevel`: Preferred fee level
- `params.idempotencyKey`: Optional key to ensure idempotency
- `params.travelRuleMessage`: Optional travel rule information for compliance

Returns:
- `id`: Transaction ID
- `status`: Transaction status
- `externalTxId`: External transaction ID (if provided)

#### `getTransactionHistory(params: ITransactionHistoryParams): Promise<ITransactionHistoryResponse>`

Retrieves transaction history with filtering and pagination support.

Parameters:
- `params.before`: Filter transactions before this timestamp
- `params.after`: Filter transactions after this timestamp
- `params.status`: Filter by transaction status
- `params.orderBy`: Field to order by ('createdAt' or 'lastUpdated')
- `params.sort`: Sort direction ('ASC' or 'DESC')
- `params.limit`: Maximum number of transactions to return
- `params.sourceType`: Filter by source type
- `params.destType`: Filter by destination type
- `params.assetId`: Filter by asset ID
- `params.sourceId`: Filter by source ID
- `params.nextPageToken`: Token for pagination

Returns:
- `transactions`: Array of transaction history items
- `nextPageToken`: Token for fetching the next page

#### `getTransaction(params: { txId?: string; externalTxId?: string }): Promise<ITransactionHistoryItem>`

Retrieves a transaction by either Fireblocks transaction ID or external transaction ID. If both IDs are provided, the Fireblocks ID takes precedence.

Parameters:
- `params.txId`: Fireblocks transaction ID
- `params.externalTxId`: External transaction ID

Returns a transaction history item containing:
- `id`: Transaction ID
- `externalTxId`: External transaction ID
- `status`: Transaction status
- `operation`: Transaction operation type
- `assetId`: Asset ID
- `source`: Source details
- `destination`: Destination details
- `amount`: Transaction amount
- `fee`: Network fee
- `txHash`: Transaction hash
- `createdAt`: Creation timestamp
- `lastUpdated`: Last update timestamp

### Webhook Support

The `FireblocksAdapter` provides comprehensive webhook support with signature verification and webhook management capabilities.

#### `handleWebhook(payload: string, signature: string, timestamp?: string, version: 'v1' | 'v2' = 'v2'): Promise<IBlockchainWebhookPayload>`

Handles incoming Fireblocks webhooks with automatic signature verification and payload normalization.

Parameters:
- `payload`: The webhook payload as a JSON string
- `signature`: The webhook signature from the `fireblocks-signature` header
- `timestamp`: The timestamp from the `fireblocks-timestamp` header (required for v2 webhooks)
- `version`: The webhook version ('v1' or 'v2', defaults to 'v2')

Returns normalized webhook data in a common format for internal processing.

**Signature Verification:**
- **V1 Webhooks**: Uses RSA-SHA512 signature verification with a public key
- **V2 Webhooks**: Uses HMAC-SHA256 signature verification with a secret key and timestamp validation (5-minute window)

**Supported Webhook Types:**
- `TRANSACTION_CREATED`
- `TRANSACTION_STATUS_UPDATED`
- `TRANSACTION_COMPLETED`
- `TRANSACTION_FAILED`

#### `normalizeWebhookData(webhookData: IFireblocksWebhookV1Payload | IFireblocksWebhookV2Payload): IBlockchainWebhookPayload>`

Normalizes webhook data from both v1 and v2 formats into a common internal format for consistent processing.

Parameters:
- `webhookData`: The webhook payload (v1 or v2 format)

Returns normalized webhook data containing:
- Transaction ID and status
- Source and destination information
- Amount and fee details
- Timestamps and metadata

#### `resendWebhook(params?: { txId?: string; resendCreated?: boolean; resendStatusUpdated?: boolean }): Promise<{ success: boolean } | { messagesCount: number }>`

Resends webhook notifications for failed deliveries or specific transactions.

Parameters:
- `params.txId`: Optional transaction ID to resend specific webhooks
- `params.resendCreated`: Whether to resend the "created" webhook (required if txId provided)
- `params.resendStatusUpdated`: Whether to resend the "status updated" webhook (required if txId provided)

Returns:
- For specific transaction: `{ success: boolean }`
- For all failed webhooks: `{ messagesCount: number }`

**Usage Examples:**

```typescript
// Resend webhooks for a specific transaction
const result = await fireblocksAdapter.resendWebhook({
  txId: 'transaction-123',
  resendCreated: true,
  resendStatusUpdated: true
});

// Resend all failed webhooks
const result = await fireblocksAdapter.resendWebhook();
```

#### `verifyWebhookSignature(payload: string, signature: string, timestamp: string, version: 'v1' | 'v2' = 'v1'): Promise<boolean>`

Verifies the signature of incoming webhook requests for security validation.

Parameters:
- `payload`: The webhook payload as a string
- `signature`: The webhook signature
- `timestamp`: The webhook timestamp (for v2 webhooks)
- `version`: The webhook version

Returns `true` if the signature is valid, `false` otherwise.

**V1 Signature Verification:**
- Uses RSA-SHA512 algorithm
- Requires `FIREBLOCKS_WEBHOOK_PUBLIC_KEY` environment variable
- Signature is Base64 encoded

**V2 Signature Verification:**
- Uses HMAC-SHA256 algorithm
- Requires `FIREBLOCKS_WEBHOOK_SECRET` environment variable
- Signature is Hex encoded
- Includes timestamp validation (5-minute window)

### Webhook Configuration

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

### Webhook Payload Structure

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

### Webhook Security Features

1. **Signature Verification**: All webhooks are verified using the appropriate signature method
2. **Timestamp Validation**: V2 webhooks include timestamp validation (5-minute window)
3. **Version Detection**: Automatic detection of webhook version based on payload structure
4. **Error Handling**: Comprehensive error handling and logging
5. **Idempotency**: Webhook processing is designed to be idempotent

### Interfaces

#### `IFireblocksAsset`

Represents a supported asset in Fireblocks.

- `id`: Asset identifier
- `name`: Asset name
- `type`: Asset type
- `nativeAsset`: Indicates if it's a native asset

#### `IFireblocksCreateAccountRequest`

Request payload for creating a vault account.

- `name`: Account name
- `customerRefId`: Customer reference ID
- `hiddenOnUI`: Visibility flag
- `autoFuel`: Auto-fuel setting
- `vaultType`: Type of vault

#### `IFireblocksCreateAccountResponse`

Response payload after creating a vault account.

- `id`: Vault account ID
- `name`: Account name
- `assets`: List of associated assets
- `hiddenOnUI`: Visibility flag
- `customerRefId`: Customer reference ID
- `autoFuel`: Auto-fuel setting

#### `IFireblocksVaultAsset`

Represents an asset within a vault account.

- `id`: Asset identifier
- `total`: Total amount
- `available`: Available amount
- `pending`: Pending amount
- `lockedAmount`: Locked amount

#### `IFireblocksVaultAccount`

Represents a vault account in Fireblocks.

- `id`: Vault account ID
- `name`: Account name
- `hiddenOnUI`: Visibility flag
- `customerRefId`: Customer reference ID
- `autoFuel`: Auto-fuel setting
- `assets`: List of associated assets

#### `IFireblocksEstimateFeeResponse`

Response from fee estimation request.

- `low`: Fee estimate for low priority
- `medium`: Fee estimate for medium priority
- `high`: Fee estimate for high priority

Each level contains:
- `networkFee`: Network fee in smallest unit
- `gasPrice`: Gas price (EVM chains)
- `maxFeePerGas`: Maximum fee per gas (EVM chains)
- `maxPriorityFeePerGas`: Maximum priority fee per gas (EVM chains)

#### `ITransactionHistoryItem`

Represents a transaction in the history.

- `id`: Transaction ID
- `externalTxId`: External transaction ID
- `status`: Transaction status
- `operation`: Transaction operation type
- `assetId`: Asset ID
- `source`: Source details
  - `type`: Source type
  - `id`: Source ID
  - `address`: Source address
- `destination`: Destination details
  - `type`: Destination type
  - `id`: Destination ID
  - `address`: Destination address
  - `tag`: Destination tag
- `amount`: Transaction amount
- `fee`: Network fee
- `txHash`: Transaction hash
- `createdAt`: Creation timestamp
- `lastUpdated`: Last update timestamp

#### `ITransactionHistoryResponse`

Response from transaction history request.

- `transactions`: Array of transaction history items
- `nextPageToken`: Token for fetching the next page

#### `IFireblocksWebhookV1Payload`

Represents a v1 webhook payload from Fireblocks.

- `type`: Event type (e.g., 'TRANSACTION_STATUS_UPDATED')
- `tenantId`: Tenant identifier
- `timestamp`: Webhook timestamp
- `data`: Transaction data

#### `IFireblocksWebhookV2Payload`

Represents a v2 webhook payload from Fireblocks.

- `id`: Webhook event ID
- `eventType`: Event type
- `eventVersion`: Event version
- `resourceId`: Resource identifier
- `data`: Transaction data
- `createdAt`: Creation timestamp
- `workspaceId`: Workspace identifier

#### `IFireblocksWebhookV1Data`

Represents transaction data in v1 webhooks.

- `id`: Transaction ID
- `status`: Transaction status
- `externalTxId`: External transaction ID
- `txHash`: Transaction hash
- `operation`: Transaction operation
- `assetId`: Asset identifier
- `source`: Source details
- `destination`: Destination details
- `amountInfo`: Amount information
- `feeInfo`: Fee information
- `createdAt`: Creation timestamp
- `lastUpdated`: Last update timestamp

#### `IFireblocksWebhookV2Data`

Represents transaction data in v2 webhooks.

- `id`: Transaction ID
- `externalTxId`: External transaction ID
- `status`: Transaction status
- `txHash`: Transaction hash
- `operation`: Transaction operation
- `assetId`: Asset identifier
- `source`: Source details
- `destination`: Destination details
- `amountInfo`: Amount information
- `feeInfo`: Fee information
- `createdAt`: Creation timestamp
- `lastUpdated`: Last update timestamp

#### `IBlockchainWebhookPayload`

Normalized webhook payload for internal processing.

- `type`/`eventType`: Event type
- `tenantId`/`workspaceId`: Tenant/workspace identifier
- `timestamp`/`createdAt`: Timestamp
- `data`: Normalized transaction data

---

## FireblocksAxiosHelper

The `FireblocksAxiosHelper` class encapsulates HTTP request logic, including request signing and error handling, for interactions with the Fireblocks API.

### HTTP Methods

Provides wrapper methods for standard HTTP operations:

- `get<T>(path: string, params?: any, idempotencyKey?: string): Promise<IFireblocksResponse<T>>`
- `post<T>(path: string, body?: any, idempotencyKey?: string): Promise<IFireblocksResponse<T>>`
- `put<T>(path: string, body?: any, idempotencyKey?: string): Promise<IFireblocksResponse<T>>`
- `patch<T>(path: string, body?: any, idempotencyKey?: string): Promise<IFireblocksResponse<T>>`
- `delete<T>(path: string, idempotencyKey?: string): Promise<IFireblocksResponse<T>>`

Each method supports an optional `idempotencyKey` parameter to ensure idempotent operations.

### Request Signing

Before dispatching any request, the `signRequest` method generates a JWT token with the following payload:

- `uri`: Request URI
- `nonce`: Unique identifier for the request
- `iat`: Issued at timestamp
- `exp`: Expiration timestamp (30 seconds after `iat`)
- `sub`: API key
- `bodyHash`: SHA-256 hash of the request body

This token is then included in the `Authorization` header of the request.

---

## Idempotency Key

### Purpose

The idempotency key ensures that multiple identical requests result in a single operation, preventing unintended side effects such as duplicate transactions. This is particularly useful in scenarios involving network timeouts or retries.

### Usage Guidelines

- **Applicable Methods**: Primarily used with `POST` requests. While `GET` and `DELETE` requests are inherently idempotent, Fireblocks allows the use of idempotency keys with `PUT` and `PATCH` requests as well.
- **Header**: Include the key in the request header as `Idempotency-Key: <unique-key>`.
- **Key Constraints**:

  - Maximum length: 40 characters
  - Validity: 24 hours

- **Behavior**: If a request with a specific idempotency key is successfully processed, subsequent requests with the same key within 24 hours will return the original response without re-executing the operation.

For more detailed information, refer to the Fireblocks API Idempotency documentation: [Fireblocks API Idempotency](https://developers.fireblocks.com/reference/api-idempotency)

### Implementation in FireblocksAxiosHelper

In the `FireblocksAxiosHelper` class, the idempotency key is handled as follows:

```typescript
if (idempotencyKey) {
  config.headers = { 'Idempotency-Key': idempotencyKey };
}
```

This logic is applied across all HTTP methods (`get`, `post`, `put`, `patch`, `delete`) to ensure consistent idempotent behavior.

---

## Error Handling

The `handleRequest` method in `FireblocksAxiosHelper` includes comprehensive error handling:

- **Axios Errors**: Captures and logs detailed error information, including response status and message.
- **Non-Axios Errors**: Logs unexpected errors and rethrows them for upstream handling.

This robust error handling mechanism ensures that issues are appropriately logged and propagated, facilitating easier debugging and resilience.

---

[Fireblocks for Developers](https://www.fireblocks.com/developers)
