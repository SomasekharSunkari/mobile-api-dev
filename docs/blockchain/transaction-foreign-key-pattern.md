# Transaction Foreign Key Pattern

This document explains the pattern used to avoid foreign key constraint issues when creating related transactions in the database.

## Problem

When creating a main transaction record within a blockchain wallet transaction's database transaction scope, the main transaction is not committed until the entire transaction completes. This can cause foreign key constraint issues if other parts of the system try to reference the main transaction before it's committed.

## Solution

Create both transactions within the same transaction scope but update the `main_transaction_id` after the transaction is committed.

## Pattern Implementation

### Before (Problematic)
```typescript
return await this.blockchainWalletTransactionRepository.transaction(async (trx) => {
  const mainTransaction = await this.transactionRepository.create(mainTransactionData, trx);
  
  // ❌ This creates a foreign key reference before the main transaction is committed
  await this.blockchainWalletTransactionRepository.update(
    transactionId,
    { 
      status: TransactionStatus.COMPLETED,
      main_transaction_id: mainTransaction.id  // FK reference created here
    },
    { trx }
  );
  
  return { blockchainWalletTransaction, mainTransaction };
});
```

### After (Fixed)
```typescript
// Create both transactions within the same transaction scope
const result = await this.blockchainWalletTransactionRepository.transaction(async (trx) => {
  const mainTransaction = await this.transactionRepository.create(mainTransactionData, trx);
  
  // ✅ Update status but NOT main_transaction_id yet
  await this.blockchainWalletTransactionRepository.update(
    transactionId,
    { 
      status: TransactionStatus.COMPLETED
      // main_transaction_id will be updated after transaction is committed
    },
    { trx }
  );
  
  return { blockchainWalletTransaction, mainTransaction };
});

// ✅ After the transaction is committed, update the main_transaction_id
// This ensures the main transaction is committed and available for foreign key references
await this.blockchainWalletTransactionRepository.update(
  transactionId,
  { main_transaction_id: result.mainTransaction.id }
);
```

## Methods Updated

### 1. `BlockchainWalletTransactionService.markTransactionAsSuccessful`

**Purpose**: Marks a blockchain wallet transaction as successful and creates a corresponding main transaction record.

**Changes**:
- Creates main transaction within the blockchain wallet transaction scope
- Updates blockchain wallet transaction status within the scope
- Updates `main_transaction_id` after the transaction is committed

### 2. `BlockchainWalletService.fundWallet`

**Purpose**: Credits a blockchain wallet and creates a completed transaction record.

**Changes**:
- Creates both blockchain wallet transaction and main transaction within the same scope
- Updates blockchain wallet transaction status within the scope
- Updates `main_transaction_id` after the transaction is committed

### 3. `BlockchainWalletService.revertWalletDebit`

**Purpose**: Reverts a wallet debit operation and creates a failed transaction record.

**Changes**:
- Creates main transaction within the blockchain wallet transaction scope
- Updates blockchain wallet transaction status within the scope
- Updates `main_transaction_id` after the transaction is committed

## Benefits

### 1. **Eliminates Foreign Key Constraint Issues**
- Main transaction is fully committed before any foreign key references are created
- No more "referenced record does not exist" errors

### 2. **Maintains Data Consistency**
- Both transactions are still created atomically within the same transaction scope
- If the main transaction creation fails, the entire operation is rolled back

### 3. **Preserves Transaction Integrity**
- All critical operations (wallet balance updates, transaction creation) happen atomically
- Only the foreign key reference is updated after commit

### 4. **Improves System Reliability**
- Eliminates race conditions where other processes might try to reference uncommitted transactions
- Reduces database constraint violation errors

## Implementation Details

### Transaction Flow
1. **Start Transaction**: Begin database transaction
2. **Create Main Transaction**: Create the main transaction record
3. **Update Blockchain Transaction**: Update status and other fields (but NOT `main_transaction_id`)
4. **Commit Transaction**: All changes are committed atomically
5. **Update Foreign Key**: Update `main_transaction_id` after commit

### Error Handling
- If any operation within the transaction scope fails, everything is rolled back
- If the foreign key update fails after commit, the main transaction still exists and can be referenced
- Logging is added to track when foreign key updates occur

### Logging
```typescript
this.logger.log(`Updated blockchain wallet transaction ${transactionId} with main_transaction_id: ${result.mainTransaction.id}`);
```

## Testing Considerations

When testing this pattern:

1. **Verify Atomicity**: Ensure that if main transaction creation fails, blockchain wallet transaction is not updated
2. **Verify Foreign Key Update**: Ensure `main_transaction_id` is properly set after transaction commit
3. **Test Concurrent Access**: Verify that other processes can reference the main transaction after it's committed
4. **Test Error Scenarios**: Ensure proper error handling if foreign key update fails

## Migration Notes

This pattern is backward compatible and doesn't require database schema changes. The only change is in the order of operations:

- **Before**: Create FK reference within transaction scope
- **After**: Create FK reference after transaction commit

Existing code that references these methods will continue to work without changes. 