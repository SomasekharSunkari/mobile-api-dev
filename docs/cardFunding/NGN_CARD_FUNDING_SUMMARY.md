# NGN Card Funding - Implementation Summary

## Overview

This document summarizes the implementation of card funding using Nigerian Naira (NGN) wallet. Users can fund their cards by converting NGN to USD through YellowCard exchange, then transferring the USD to Rain for card funding.

## Feature Description

**User Flow:**

1. User enters NGN amount (e.g., ₦100,000)
2. System shows exchange rate, fees, and net USD they'll receive
3. User confirms and executes
4. System converts NGN → USD via YellowCard
5. System transfers USD to Rain deposit address
6. Card is funded with USD (fee deducted)

**Example:**

- Input: ₦100,000
- After exchange: $128.00 USD
- Card funding fee: $0.64 (0.5% of $128.00)
- Card receives: $128.00 initially
- After fee: $127.36 final balance

---

## Architecture

### 2-Step Flow (Same as NGN→USD Exchange)

**Step 1: Initialize**

- User calls `POST /card/:card_id/fund/initiate`
- System validates card, initializes exchange, calculates fees
- Returns summary with all amounts and fees

**Step 2: Execute**

- User calls `POST /card/:card_id/fund/execute`
- System creates card transaction, queues processor
- Processor handles all sending (NGN to YellowCard via Paga)

### Key Components

1. **CardService Methods**
   - `initializeCardFundingFromNGN()` - Initialize exchange and calculate fees
   - `executeCardFundingFromNGN()` - Create card transaction and queue processor

2. **CardFundingFromNGNProcessor**
   - Handles all sending (like `processExecuteNgToUSDExchange`)
   - Gets transaction data from Redis
   - Creates source transactions
   - Accepts pay-in request
   - Sends NGN to YellowCard via Paga
   - Sets everything to PENDING

3. **Webhooks**
   - **YellowCard webhook**: Completes exchange, credits USD, triggers transfer to Rain
   - **Rain webhook**: Credits card, deducts fee, completes transaction

---

## Fee and Amount Calculation

### Exchange Fees (YellowCard)

- **Charged in USD**: $0.65 (example)
- **Converted to NGN**: $0.65 × Exchange Rate = ₦507.81
- **Deducted from NGN amount**: ₦100,000 - ₦507.81 = ₦99,492.19

### Card Funding Fee (OneDosh)

- **Rate**: 0.5% of USD amount received
- **Calculation**: $128.00 × 0.5% = $0.64
- **Deducted from card balance** after funding completes

### Total NGN Debit

```
NGN Amount: ₦100,000
Exchange Fees (NGN): -₦507.81 (USD fees converted)
NGN Withdrawal Fee: +₦50 (Paga)
Total: ₦99,542.19
```

### Card Transaction Amount

- **Amount field**: $127.36 (net amount for display - what user receives)
- **Fee field**: $0.64 (stored separately, deducted later)
- **Card receives**: $128.00 initially, then $0.64 deducted = $127.36 final

---

## Database Changes

### Migration

- Add `parent_exchange_transaction_id` column to `card_transactions` table
- Foreign key to `transactions` table
- Allows linking card funding to exchange transaction

### Model Updates

- Update `ICardTransaction` interface
- Update `CardTransactionModel` with new field and relation
- Update validation schema

---

## API Endpoints

### Initialize Card Funding

```
POST /card/:card_id/fund/initiate
Body: {
  "amount": 100000,
  "rate_id": "rate-uuid-123"
}
Response: {
  "transaction_id": "TXN-REF-789",
  "ngn_amount": 100000,
  "usd_amount_after_exchange": 128.00,
  "exchange_fee_usd": 0.65,
  "card_fee_usd": 0.64,
  "net_usd_you_will_receive": 127.36,
  "total_ngn_debited": 99542.19
}
```

### Execute Card Funding

```
POST /card/:card_id/fund/execute
Body: {
  "transaction_id": "TXN-REF-789",
  "transaction_pin": "123456"
}
Response: {
  "transaction_id": "card-txn-123",
  "exchange_transaction_id": "TXN-REF-789",
  "card_funding_job_id": "job-789",
  "status": "processing"
}
```

---

## Implementation Flow

### Step 1: Initialize

1. Validate card (exists, not blocked)
2. Validate Rain deposit address exists
3. Call `initializeNgToUSDExchange` (same as normal exchange)
4. Calculate card funding fee (0.5% of USD received)
5. Store card funding context in Redis
6. Return summary to user

### Step 2: Execute

1. Validate card
2. Get card funding context from Redis
3. Create card transaction (amount = net USD, fee stored separately)
4. Update context with card transaction ID
5. Queue `CardFundingFromNGNProcessor`

### Step 3: Processor

1. Get transaction data from Redis
2. Get pay-in request from YellowCard
3. Calculate fees
4. Validate user balance
5. Create source transactions (INITIATED status)
6. Accept pay-in request
7. Send NGN to YellowCard via Paga (`waasAdapter.transferToOtherBank`)
8. Set card transaction to PENDING
9. **All sending complete, webhooks handle completion**

### Step 4: YellowCard Webhook

1. Exchange transaction → COMPLETED
2. User receives USD in wallet
3. Check for card funding context
4. If found, transfer USD to Rain deposit address
5. Update card transaction with transfer reference

### Step 5: Rain Webhook

1. Funds arrive at deposit address
2. Card credited with $128.00
3. Fee deducted ($0.64) via `chargeFundingFee()`
4. Card transaction → SUCCESSFUL
5. Final balance: $127.36

---

## Key Technical Details

### Redis Context Storage

- Key: `card_funding_context:{transaction_id}`
- TTL: 1 hour
- Stores: cardId, userId, depositAddress, amounts, fees, rateId

### Transaction Linking

- Card transaction has `parent_exchange_transaction_id`
- Links card funding to exchange transaction
- Enables tracking and reconciliation

### Amount Storage

- **NGN**: Stored in kobo (1 NGN = 100 kobo)
- **USD**: Stored in cents (1 USD = 100 cents)
- All calculations use smallest units

### Fee Handling

- **Exchange fees**: Charged in USD by YellowCard, converted to NGN for debit
- **Card funding fee**: Charged in USD, deducted from card balance
- **Fees don't compound**: Each fee calculated independently

### Processor Pattern

- **No waiting for webhooks**: Processor does all sending, sets to PENDING
- **Webhooks complete**: YellowCard and Rain webhooks handle completion
- **Idempotent**: All operations can be retried safely

---

## Error Handling

### Exchange Fails

- Exchange transaction: FAILED
- Card transaction: DECLINED
- NGN refunded from escrow
- Context removed from Redis

### Exchange Succeeds, Transfer Fails

- Exchange: COMPLETED
- Card transaction: DECLINED
- USD remains in user wallet
- User can retry or manual intervention

### Rain Webhook Never Arrives

- Exchange: COMPLETED
- Transfer: COMPLETED
- Card transaction: PENDING (stuck)
- Monitoring/alerting needed
- Manual intervention may be required

---

## Testing Requirements

### Unit Tests

- [ ] `initializeCardFundingFromNGN` - Validation, fee calculation
- [ ] `executeCardFundingFromNGN` - Context retrieval, card transaction creation
- [ ] `CardFundingFromNGNProcessor` - Transaction data, Paga transfer

### Integration Tests

- [ ] Full flow: Initialize → Execute → Processor → Webhooks
- [ ] Exchange failure handling
- [ ] Card funding failure handling
- [ ] Webhook completion flow

### Edge Cases

- [ ] Rate expiration during processing
- [ ] Insufficient balance scenarios
- [ ] Concurrent requests (lock handling)
- [ ] Context not found scenarios

---

## Implementation Checklist

### Database & Models

- [ ] Create migration for `parent_exchange_transaction_id`
- [ ] Update `ICardTransaction` interface
- [ ] Update `CardTransactionModel`
- [ ] Update validation schema

### DTOs

- [ ] Create `InitiateCardFundingFromNGNDto`
- [ ] Create `ExecuteCardFundingFromNGNDto`

### Services

- [ ] Add escrow service methods (store/get/update/remove card funding context)
- [ ] Implement `CardService.initializeCardFundingFromNGN`
- [ ] Implement `CardService.executeCardFundingFromNGN`

### Controller

- [ ] Add `POST /card/:card_id/fund/initiate` endpoint
- [ ] Add `POST /card/:card_id/fund/execute` endpoint

### Processor

- [ ] Create `CardFundingFromNGNProcessor`
- [ ] Implement `processCardFundingFromNGN` (all sending logic)
- [ ] Implement `sendMoneyToYellowcard` (Paga transfer)
- [ ] Implement `createAFeeRecordForTheTransactionForThePagaLedgerAccounts`

### Webhooks

- [ ] Enhance `YellowCardWebhookService.handlePaymentComplete` to trigger USD transfer

### Testing

- [ ] Unit tests for all new methods
- [ ] Integration tests for full flow
- [ ] Error scenario tests

### Documentation

- [ ] Update API documentation (Swagger)
- [ ] Add request/response examples

---

## Important Notes

1. **Exact Same Pattern as Exchange**: Follows the same flow as `initializeNgToUSDExchange` → `executeExchange` → `processExecuteNgToUSDExchange`

2. **Processor Does All Sending**: No waiting for webhooks in processor. It sends NGN to YellowCard and sets everything to PENDING.

3. **Webhooks Handle Completion**: YellowCard webhook completes exchange and triggers USD transfer. Rain webhook completes card funding.

4. **Card Transaction Amount**: Shows net amount ($127.36) for display, but card receives full amount ($128.00) initially, then fee deducted.

5. **YellowCard Fees in USD**: Exchange fees are charged in USD, converted to NGN using exchange rate for debit calculation.

6. **Idempotency**: All operations are idempotent. Retries won't cause duplicate transactions.

7. **Transaction Linking**: Card transaction linked to exchange transaction via `parent_exchange_transaction_id` for tracking.

---

## Files to Create/Modify

### New Files

- `src/modules/card/dto/initiateCardFundingFromNGN.dto.ts`
- `src/modules/card/dto/executeCardFundingFromNGN.dto.ts`
- `src/services/queue/processors/card/card-funding-from-ngn.processor.ts`
- `src/database/migrations/XXXXXX_add_parent_exchange_transaction_id_to_card_transactions.ts`

### Modified Files

- `src/database/models/cardTransaction/cardTransaction.interface.ts`
- `src/database/models/cardTransaction/cardTransaction.model.ts`
- `src/database/models/cardTransaction/cardTransaction.validation.ts`
- `src/modules/exchange/fiat-exchange/ng-to-usd-exchange.service/ng-to-usd-exchange.escrow.service.ts`
- `src/modules/card/card.service.ts`
- `src/modules/card/card.controller.ts`
- `src/modules/webhooks/yellowcard/yellowcard-webhook.service.ts`

---

## Dependencies

### Required Services

- `NgToUsdExchangeService` - For exchange initialization
- `NgToUsdExchangeEscrowService` - For Redis context storage
- `CardFundingFromNGNProcessor` - For background processing
- `FiatWalletService` - For USD transfer to Rain
- `ExchangeAdapter` - For YellowCard API calls
- `WaasAdapter` - For Paga bank transfers

### Required Repositories

- `CardTransactionRepository`
- `TransactionRepository`
- `FiatWalletTransactionRepository`
- `DepositAddressRepository`

