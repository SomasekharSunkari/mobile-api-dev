# Plaid Signal Risk Assessment Integration

## Overview

This document explains how OneDosh integrates Plaid Signal for ACH risk assessment when processing funding requests through the `/fund` endpoint. Plaid Signal is a machine learning-powered service that evaluates the likelihood of ACH returns before processing transactions, enabling us to make informed decisions about funding requests.

## What is Plaid Signal?

Plaid Signal is a real-time risk assessment service that analyzes over 1,000 risk factors to predict ACH return likelihood. It provides:

- **Risk Scores**: Numerical scores (1-99) indicating return probability
- **Risk Tiers**: Simplified LOW/MEDIUM/HIGH risk classifications  
- **Ruleset Results**: Actionable decisions (ACCEPT/REROUTE)
- **Risk Categories**: 
  - **Bank-initiated returns**: NSF, account closed, unauthorized, etc.
  - **Customer-initiated returns**: Disputes, fraud claims, authorization revoked

## How the /fund Endpoint Works

### 1. Request Structure

The `/fund` endpoint accepts the following payload:

```typescript
{
  "participant_code": "P123456",           // ZeroHash participant ID
  "external_account_ref": "ext_acc_123",   // ZeroHash external account reference
  "currency": "USD",                       // Currency code
  "amount": 100.00,                        // Amount to fund
  "description": "COMPANY0",               // Transaction description
  "transfer_type": "debit"                 // Transfer type (debit/credit)
}
```

### 2. Implementation Flow

Here's what happens when you hit the `/fund` endpoint:

```typescript
// 1. Validate External Account
const externalAccount = await this.externalAccountRepository.findOne({
  user_id: user.id,
  participant_code: fundRequest.participant_code,
  external_account_ref: fundRequest.external_account_ref,
});

// 2. Check Plaid Linking Status
if (!externalAccount.linked_access_token || !externalAccount.linked_account_ref) {
  throw new BadRequestException('Account is not linked');
}

// 3. Evaluate Risk Signal
const signalResponse = await this.externalAccountAdapter.evaluateRiskSignal({
  token: externalAccount.linked_access_token,
  accountRef: externalAccount.linked_account_ref,
  amount: fundRequest.amount,
  currency: fundRequest.currency,
}, countryCode);

// 4. Return Signal Evaluation Response
return {
  status: 'pending',
  signalEvaluation: this.buildSignalEvaluationResponse(signalResponse)
};
```

### 3. Current Implementation Status

**Important**: The current implementation only performs risk evaluation and returns the assessment. It does NOT automatically process funding. The actual funding logic is marked as TODO in the codebase.

## Plaid Signal Response Structure

### Signal Evaluation Response

```typescript
interface SignalEvaluationResponse {
  result: 'ACCEPT' | 'REROUTE';           // Only 2 options currently
  rulesetKey?: string;                    // Plaid ruleset identifier
  requestRef: string;                     // Unique request reference
  scores: {
    bankInitiatedReturnRisk?: {
      riskTier: number;                   // 1-5 (1=lowest risk, 5=highest)
      score: number;                      // 1-99 probability score
    };
    customerInitiatedReturnRisk?: {
      riskTier: number;                   // 1-5 (1=lowest risk, 5=highest)  
      score: number;                      // 1-99 probability score
    };
  };
}
```

### Example Response

```json
{
  "status": "pending",
  "signalEvaluation": {
    "result": "ACCEPT",
    "rulesetKey": "default_ruleset_001",
    "requestRef": "signal_req_123456789",
    "scores": {
      "bankInitiatedReturnRisk": {
        "riskTier": 1,
        "score": 15
      },
      "customerInitiatedReturnRisk": {
        "riskTier": 2,
        "score": 25
      }
    }
  }
}
```

## Risk Assessment Logic

### Current Implementation (2 Options Only)

Unlike the full Plaid Signal spec which includes `REVIEW`, our current implementation only handles:

1. **ACCEPT**: Low risk transaction that can potentially proceed
2. **REROUTE**: High risk transaction that should be rejected or escalated

**Note**: There is no `REVIEW` option currently implemented in the system.

### Risk Score Interpretation

- **Risk Tiers**: 1 (lowest) to 5 (highest risk)
- **Scores**: 1-99 probability percentage of return
- **Bank-initiated**: Technical issues (NSF, closed accounts)
- **Customer-initiated**: Fraud, disputes, unauthorized transactions

## What Happens After Signal Evaluation

### Current State (As Implemented)

```typescript
// Current implementation only returns the signal evaluation
return {
  status: 'pending',
  signalEvaluation: signalResponse
  // No further processing yet
};
```

### Future Implementation (TODO)

The codebase contains TODO comments indicating planned functionality:

```typescript
// TODO: Implement next steps based on ruleset result
// TODO: If ACCEPT - proceed with funding
// TODO: If REROUTE - reject funding or escalate for manual review
// TODO: Log transaction attempt for audit purposes
// TODO: Integrate with funding provider
// TODO: Create transaction record
// TODO: Update user's fiat wallet balance
// TODO: Send notification to user about funding status
```

## Integration with Plaid

### Signal Evaluation Process

1. **Account Validation**: Ensures the external account is properly linked to Plaid
2. **Token Usage**: Uses stored `linked_access_token` and `linked_account_ref`
3. **Risk Assessment**: Calls Plaid's Signal API with transaction details
4. **Response Processing**: Formats Plaid's response into our internal structure

### Error Handling

The system handles several error scenarios:

- **Account Not Found**: External account doesn't exist for user
- **Account Not Linked**: Missing Plaid linking information
- **API Failures**: Plaid Signal API errors are logged and re-thrown

## API Documentation

### Endpoint
```
POST /external-accounts/fund
```

### Headers
```
Authorization: Bearer <access_token>
Content-Type: application/json
```

### Request Body
```typescript
{
  participant_code: string;     // Required
  external_account_ref: string; // Required  
  currency: string;            // Required (e.g., "USD")
  amount: number;              // Required, positive number
  description: string;         // Required
  transfer_type: "debit" | "credit"; // Required
}
```

### Response
```typescript
{
  message: "Fund request initiated successfully";
  data: {
    status: "pending";
    signalEvaluation: SignalEvaluationResponse;
  };
  statusCode: 200;
  timestamp: string;
}
```

## Security Considerations

1. **User Authorization**: Only account owners can initiate funding
2. **Account Validation**: Verifies account belongs to authenticated user
3. **Plaid Token Security**: Access tokens are securely stored and validated
4. **Risk Logging**: All signal evaluations are logged for audit purposes

## Current Limitations

1. **No Automatic Funding**: Signal evaluation doesn't trigger actual fund transfer
2. **Binary Decisions**: Only ACCEPT/REROUTE (no REVIEW workflow)
3. **Manual Processing**: Approved transactions require separate processing step
4. **No Transaction Records**: Signal evaluation doesn't create transaction history

## Development Notes

- The `/fund` endpoint is rate-limited (STRICT throttle group)
- All operations are logged for debugging and audit purposes
- The implementation follows the repository pattern for data access
- Swagger documentation is automatically generated for the API 