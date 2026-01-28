# Dosh Points

A ledger-based rewards system for tracking user points.

## Database Schema

### Tables

- **`dosh_points_accounts`** - One account per user, stores current balance
- **`dosh_points_events`** - Configurable event types (e.g., ONBOARDING_BONUS)
- **`dosh_points_transactions`** - Immutable ledger of all credits/debits

### Key Constraints

- `user_id` is unique on accounts (1:1 with users)
- `idempotency_key` is unique on transactions (prevents duplicates)
- `event_code` references events table

## API Endpoints

### GET /dosh-points/account

Returns the user's Dosh Points account (creates if not exists).

**Response:**
```json
{
  "id": "account_id",
  "user_id": "user_id",
  "balance": 10,
  "status": "active"
}
```

### GET /dosh-points/transactions

Returns paginated transaction history.

**Query Params:**
- `page` (default: 1)
- `limit` (default: 10)

**Response:**
```json
{
  "dosh_points_transactions": [...],
  "pagination": {
    "current_page": 1,
    "total": 5,
    "limit": 10
  }
}
```

## Crediting Points

Use `DoshPointsTransactionService.creditPoints()`:

```typescript
await doshPointsTransactionService.creditPoints({
  user_id: 'user_123',
  event_code: 'ONBOARDING_BONUS',
  source_reference: 'tier_456', // Unique identifier for this credit
  description: 'Optional override',
  metadata: { optional: 'data' }
});
```

### Idempotency

The system prevents duplicate credits:

1. **Redis Lock** - Prevents race conditions across app instances
2. **Database Check** - Finds existing transaction before creating
3. **Unique Constraint** - `idempotency_key` column as safety net

### One-Time Events

Events with `is_one_time_per_user: true` can only be earned once per user, regardless of source_reference.

### Retry Behavior

| Scenario | Result |
|----------|--------|
| Same request twice (same user + event + source) | Returns existing transaction (idempotent) |
| One-time event, different source | Throws `ALREADY_EARNED` error |
| Multi-use event, different source | Creates new transaction |

## Event Configuration

Events are stored in `dosh_points_events` table:

| Field | Description |
|-------|-------------|
| `code` | Unique identifier (e.g., ONBOARDING_BONUS) |
| `default_points` | Points awarded for this event |
| `is_active` | Whether event can be triggered |
| `is_one_time_per_user` | Prevent duplicate per user |
| `start_date` / `end_date` | Optional campaign dates |

## Integration Points

### Registration (Register Service)

When a user successfully registers, they receive the registration bonus:

```typescript
// In register.service.ts → register()
await this.doshPointsTransactionService.creditPoints({
  user_id: account.id,
  event_code: 'REGISTRATION_BONUS',
  source_reference: account.id,
});
```

### KYC Success (Sumsub Webhook)

When a user completes tier1 KYC, they receive the onboarding bonus:

```typescript
// In sumsub-webhook.service.ts → createUserTier()
if (tier.level === 1) {
  await this.doshPointsTransactionService.creditPoints({
    user_id: userId,
    event_code: 'ONBOARDING_BONUS',
    source_reference: userTier.id,
  });
}
```

### First Deposit (ZeroHash Webhook)

When a user completes their first USD deposit, they receive the first deposit bonus:

```typescript
// In zerohash-webhook.service.ts → updateWalletBalanceFromPayload()
const completedDeposits = await this.fiatWalletTransactionRepository
  .query()
  .where({
    user_id: userId,
    transaction_type: FiatWalletTransactionType.DEPOSIT,
    status: TransactionStatus.COMPLETED,
    currency: 'USD',
  })
  .limit(2)
  .select('id');

if (completedDeposits.length === 1) {
  await this.doshPointsTransactionService.creditPoints({
    user_id: userId,
    event_code: 'FIRST_DEPOSIT_USD',
    source_reference: tradeId,
  });
}
```

### In-App Notifications

After a successful point credit, an in-app notification with type `REWARDS` is automatically sent to the user.

## Error Handling

Custom `DoshPointsException` types:

| Type | When |
|------|------|
| `EVENT_NOT_FOUND` | Event code doesn't exist |
| `EVENT_INACTIVE` | Event is disabled |
| `EVENT_NOT_STARTED` | Before `start_date` date |
| `EVENT_ENDED` | After `end_date` date |
| `ALREADY_EARNED` | One-time event already claimed |

## Module Structure

```
src/modules/doshPoints/
├── doshPoints.controller.ts    # API endpoints
├── doshPoints.module.ts        # NestJS module
├── doshPoints.interface.ts     # Shared interfaces
├── doshPointsAccount/
│   ├── doshPointsAccount.service.ts
│   └── doshPointsAccount.repository.ts
├── doshPointsTransaction/
│   ├── doshPointsTransaction.service.ts
│   └── doshPointsTransaction.repository.ts
└── doshPointsEvent/
    ├── doshPointsEvent.service.ts
    └── doshPointsEvent.repository.ts
```

## Adding New Events

1. Add to seed file or insert directly:

```sql
INSERT INTO dosh_points_events (id, code, name, default_points, is_active, is_one_time_per_user)
VALUES ('unique_id', 'REFERRAL_BONUS', 'Referral Bonus', 5, true, false);
```

2. Call `creditPoints()` from the appropriate trigger point in your code.

