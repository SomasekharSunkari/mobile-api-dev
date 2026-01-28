# Sumsub Webhook Service Documentation

## Overview

The `SumsubWebhookService` is a NestJS service that handles incoming webhook notifications from the Sumsub KYC (Know Your Customer) service. It processes various webhook events related to applicant verification status changes and automatically updates user profiles, KYC statuses, and creates virtual accounts when appropriate.

## Architecture

```typescript
@Injectable()
export class SumsubWebhookService
```

The service uses dependency injection to integrate with multiple repositories and services:

- **KycVerificationService**: Manages KYC verification status
- **KycStatusLogService**: Logs KYC status changes
- **KYCAdapter**: Interfaces with Sumsub API
- **UserProfileRepository**: Updates user profile information
- **UserRepository**: Manages user data
- **FiatWalletService**: Handles fiat wallet operations
- **WaasAdapter**: Creates virtual accounts
- **VirtualAccountRepository**: Manages virtual account data

## Core Functionality

### Main Webhook Processing

#### `processWebhook(payload: SumsubWebhookPayload)`

The main entry point that processes incoming webhook notifications from Sumsub.

**Supported Webhook Types:**

1. **`applicantCreated`** - New applicant created
2. **`applicantReset`** - Applicant verification reset
3. **`applicantReviewed`** - Applicant review completed
4. **`applicantOnHold`** - Applicant verification put on hold

```typescript
// Example webhook payload
{
  applicantId: 'APP123',
  type: 'applicantReviewed',
  externalUserId: 'USER123',
  reviewResult: {
    reviewAnswer: 'GREEN', // or 'RED'
    moderationComment: 'Approved'
  }
}
```

### Webhook Event Handlers

#### 1. Applicant Creation/Reset

```typescript
private async createDistinctUserKyc(userId: string, providerRef: string)
```

**Purpose**: Creates or resets KYC verification for a user
**Flow**:

1. Checks if KYC verification already exists for the user
2. If not, initiates a new KYC verification
3. Logs the operation for debugging

#### 2. KYC Success Handling

```typescript
private async handleKycSuccessAndCreateWallets(payload: SumsubWebhookPayload)
```

**Purpose**: Processes successful KYC verification (GREEN status)
**Flow**:

1. Retrieves detailed KYC information from Sumsub
2. Updates KYC status and logs the change
3. Updates user profile with verified information
4. Creates fiat wallets and virtual accounts (for Nigerian users)

#### 3. KYC Failure Handling

```typescript
private async handleKycFailure(payload: SumsubWebhookPayload)
```

**Purpose**: Processes failed KYC verification (RED status)
**Flow**:

1. Retrieves KYC details from Sumsub
2. Updates KYC status to REJECTED
3. Logs the rejection with moderation comments

#### 4. KYC On-Hold Handling

```typescript
private async handleKycOnHold(payload: SumsubWebhookPayload)
```

**Purpose**: Processes KYC verification put on hold
**Flow**:

1. Retrieves KYC details from Sumsub
2. Updates KYC status to IN_REVIEW
3. Logs the status change

## KYC Status Management

### Status Mapping

```typescript
private getKycStatus(data: string): KycVerificationEnum
```

Maps Sumsub review answers to internal KYC statuses:

- **`GREEN`** → `APPROVED`
- **`RED`** → `REJECTED`
- **Other** → `IN_REVIEW`

### KYC Update Process

```typescript
private async updateKycAndKycLog(data: SumsubApplicant)
```

**Updates**:

- KYC verification status
- Provider reference
- Identity information
- Review metadata
- Timestamps
- Status change logs

## User Profile Management

### Profile Update Process

```typescript
private async updateUserDetails(data: SumsubApplicant)
```

**Updates User Information**:

- First name, last name, middle name
- Date of birth
- Address information (line1, city, postal code, state)

**Updates User Profile**:

- Date of birth (formatted for database)
- Address details from KYC verification

## Virtual Account Creation

### Nigerian Virtual Account Creation

```typescript
private async createNGVirtualAccount(userId: string, data: { bvn: string; dob: string })
```

**Purpose**: Creates virtual accounts for Nigerian users after successful KYC
**Requirements**:

- User must be from Nigeria (country code: 'NG')
- User must have a valid address
- BVN (Bank Verification Number) from KYC

**Flow**:

1. Retrieves user profile with address information
2. Gets or creates fiat wallet for NGN currency
3. Checks for existing virtual account
4. Creates virtual account via WaaS adapter
5. Stores virtual account details in database

**Virtual Account Data**:

- Account name and number
- Bank name (9 Payment Service Bank)
- Provider reference
- Address information
- Initial balance (0.00)

## Error Handling

### Exception Types

- **`InternalServerErrorException`**: For critical errors during processing
- **User not found errors**: When user data is missing
- **Address validation errors**: When required address is missing

### Logging

- Uses NestJS Logger for debugging
- Logs all major operations and errors
- Provides traceability for webhook processing

## Integration Points

### External Services

- **Sumsub API**: For KYC details retrieval
- **WaaS (Wallet as a Service)**: For virtual account creation
- **Database**: For user, KYC, and virtual account storage

### Internal Services

- **KYC Verification Service**: Status management
- **Fiat Wallet Service**: Wallet operations
- **User Management**: Profile updates

## Configuration Requirements

### Environment Variables

```env
# Sumsub Configuration
SUMSUB_APP_TOKEN=your_app_token
SUMSUB_SECRET_KEY=your_secret_key
SUMSUB_API_URL=https://api.sumsub.com
SUMSUB_WEBHOOK_PUBLIC_KEY_PATH=/path/to/public/key

# WaaS Configuration (for virtual accounts)
WAAS_API_URL=your_waas_api_url
WAAS_API_KEY=your_waas_api_key
```

### Database Dependencies

- Users table
- User profiles table
- KYC verification table
- KYC status logs table
- Virtual accounts table
- Fiat wallets table

## Security Considerations

### Webhook Authentication

- Webhook signatures are verified by the `SumsubWebhookAuthGuard`
- HMAC-SHA256 signature validation
- Prevents unauthorized webhook processing

### Data Validation

- Validates user existence before processing
- Validates required address information
- Validates KYC data completeness

## Testing

The service includes comprehensive unit tests covering:

- Webhook event processing
- KYC status updates
- User profile updates
- Virtual account creation
- Error handling scenarios

Run tests with:

```bash
npm test -- --testPathPattern=sumsub-webhook.spec.ts
```

## Best Practices

1. **Error Handling**: Always wrap operations in try-catch blocks
2. **Logging**: Log all major operations for debugging
3. **Validation**: Validate data before processing
4. **Idempotency**: Handle duplicate webhook events gracefully
5. **Security**: Verify webhook signatures before processing

## Usage Example

```typescript
// In a controller
@Post('webhook')
@UseGuards(SumsubWebhookAuthGuard)
async handleWebhook(@Body() payload: SumsubWebhookPayload) {
  return await this.sumsubWebhookService.processWebhook(payload);
}
```

This service provides a robust, secure, and comprehensive solution for processing Sumsub KYC webhooks while maintaining data integrity and providing proper error handling throughout the application.
