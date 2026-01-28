# SumsubAdapter Documentation

## Overview

The `SumsubAdapter` is a NestJS service that implements the `KYCManagementInterface` and extends `SumsubKycServiceAxiosHelper`. It provides a comprehensive interface for interacting with the Sumsub KYC (Know Your Customer) service, handling applicant verification, webhook processing, and AML (Anti-Money Laundering) checks.

## Architecture

```typescript
export class SumsubAdapter extends SumsubKycServiceAxiosHelper implements KYCManagementInterface
```

- **Extends**: `SumsubKycServiceAxiosHelper` - Provides HTTP client functionality for Sumsub API
- **Implements**: `KYCManagementInterface` - Standard KYC operations interface
- **Logger**: Uses NestJS Logger for debugging and monitoring

## Core Functionality

### 1. KYC Details Management

#### `getKycDetails<R = SumsubApplicant>(payload: GetSumsubApplicantPayload)`

Retrieves detailed KYC information for a specific applicant.

```typescript
// Example usage
const kycDetails = await sumsubAdapter.getKycDetails({
  applicantId: 'APP123',
});

// Returns: { data: SumsubApplicant, message: 'SUCCESS', status: 200 }
```

**API Endpoint**: `GET /resources/applicants/{applicantId}/one`

#### `getKycDetailsByUserId<R>(userId: string)`

Retrieves KYC details using the external user ID instead of applicant ID.

```typescript
// Example usage
const kycDetails = await sumsubAdapter.getKycDetailsByUserId('USER123');

// Returns: { data: R, message: 'SUCCESS', status: 200 }
```

**API Endpoint**: `GET /resources/applicants/-;externalUserId={userId}/one`

### 2. Webhook Processing

#### `processWebhook<R>(payload: SumsubWebhookPayload)`

Processes incoming webhook notifications from Sumsub and retrieves updated applicant data.

```typescript
// Example usage
const webhookResult = await sumsubAdapter.processWebhook({
  applicantId: 'APP123',
  type: 'applicantReviewed',
  // ... other webhook payload fields
});

// Returns: { type: string, data: R }
```

**Flow**:

1. Logs the webhook processing with applicant ID
2. Calls `getKycDetails()` to fetch latest applicant data
3. Returns structured response with webhook type and applicant data

### 3. AML (Anti-Money Laundering) Checks

#### `performAMLCheck(payload: SumsubAMLCheckPayload)`

Performs AML verification checks on an applicant.

```typescript
// Example usage
const amlResult = await sumsubAdapter.performAMLCheck({
  applicantId: 'APP123',
  // ... other AML payload fields
});

// Returns: { data: SumsubAMLCheckResponse, message: 'SUCCESS'|'FAILED', status: 200|400 }
```

**API Endpoint**: `POST /resources/applicants/{applicantId}/recheck/aml`

**Success Logic**:

- Checks if `response.data.ok === 1`
- Returns `SUCCESS` with status `200` if true
- Returns `FAILED` with status `400` if false

### 4. Access Token Generation

#### `generateAccessToken<Response, Payload>(data: Payload)`

Generates access tokens for SDK integration.

```typescript
// Example usage
const tokenResult = await sumsubAdapter.generateAccessToken({
  userId: 'USER123',
  levelName: 'basic-kyc-level',
  expiresIn: 3600,
});

// Returns: { data: Response, message: 'SUCCESS', status: 200 }
```

**API Endpoint**: `POST /resources/accessTokens/sdk`

## Not Implemented Methods

The following methods are defined in the interface but not yet implemented:

### `getFullInfo(participantCode: string)`

- **Status**: Not Implemented
- **Throws**: `NotImplementedException`

### `verifySignature()`

- **Status**: Not Implemented
- **Throws**: `NotImplementedException`

### `initiateWidgetKyc()`

- **Status**: Not Implemented
- **Throws**: `NotImplementedException`

### `initiateDirectKyc()`

- **Status**: Not Implemented
- **Throws**: `NotImplementedException`

### `validateKyc()`

- **Status**: Not Implemented
- **Throws**: `NotImplementedException`

## Configuration

### Supported Countries

```typescript
supportedCountries(): string[] {
  return ['US'];
}
```

Currently supports only the United States for KYC operations.

## Error Handling

### HTTP Errors

- All HTTP requests are handled by the parent `SumsubKycServiceAxiosHelper`
- Network errors and API failures are propagated up the call stack

### Business Logic Errors

- AML check failures return appropriate status codes (400 for failed checks)
- Not implemented methods throw `NotImplementedException`

### Logging

- Uses NestJS Logger for debugging
- Logs webhook processing with applicant ID for traceability

## Integration Example

```typescript
// In a service
@Injectable()
export class KycService {
  constructor(private sumsubAdapter: SumsubAdapter) {}

  async processApplicantReview(webhookPayload: SumsubWebhookPayload) {
    // Process webhook and get updated applicant data
    const result = await this.sumsubAdapter.processWebhook(webhookPayload);

    // Perform AML check if needed
    if (result.type === 'applicantReviewed') {
      const amlResult = await this.sumsubAdapter.performAMLCheck({
        applicantId: result.data.id,
      });

      return {
        applicant: result.data,
        amlStatus: amlResult.message,
      };
    }

    return result;
  }
}
```

## Best Practices

1. **Error Handling**: Always wrap adapter calls in try-catch blocks
2. **Logging**: Use the built-in logger for debugging webhook processing
3. **Type Safety**: Leverage TypeScript generics for type-safe responses
4. **Status Checking**: Always verify AML check status before proceeding
5. **Webhook Processing**: Handle different webhook types appropriately

## Dependencies

- **NestJS**: For dependency injection and logging
- **Axios**: For HTTP requests (via parent class)
- **SumsubKycServiceAxiosHelper**: Base HTTP client functionality
- **KYCManagementInterface**: Standard KYC operations contract

## Environment Configuration

The adapter requires the following environment variables:

```env
SUMSUB_APP_TOKEN=sbx:WNpkHNHJEdJgmt8Iw1Qqx4wn.NlOwgm5yTX7Fpq4FqqrOKeJNe0JlujhL
SUMSUB_SECRET_KEY=vvXVCGMA6fOKIovPZbKiRH9SWb4Kje6F
SUMSUB_API_URL=https://api.sumsub.com
SUMSUB_WEBHOOK_PUBLIC_KEY_PATH=/path/to/webhook/public/key
```

## Testing

The adapter includes comprehensive unit tests covering:

- KYC details retrieval
- Webhook processing
- AML checks
- Access token generation
- Error handling scenarios

Run tests with:

```bash
npm test -- --testPathPattern=sumsub.adapter.spec.ts
```

This adapter provides a clean, type-safe interface for all Sumsub KYC operations while maintaining proper error handling and logging throughout the application.
