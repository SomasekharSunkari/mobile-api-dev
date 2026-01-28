# ZeroHash Webhook Integration

## Overview

The ZeroHash Webhook integration allows your application to receive real-time updates from ZeroHash about participant (KYC), external account, payment, and trade events. Incoming payloads are validated, dispatched to handler logic, and persisted in your system.

---

## Endpoint

**POST** `/webhooks/zerohash`
**Response** `200 OK`

* **Required Header**
  `X-ZH-Hook-Payload-Type`: one of the ZeroHash event types (e.g. `participant_status_changed`).

* **Body**
  Raw JSON payload. Example for `participant_status_changed`:

  ```json
  {
    "participant_code": "ZXCV1234",
    "participant_status": "APPROVED"
  }
  ```

* **Success Response**

  ```json
  {
    "message": "Webhook processed successfully",
    "data": {}
  }
  ```

---

## Supported Event Types

| Event Type                        | Description                                       |
| --------------------------------- | ------------------------------------------------- |
| `participant_status_changed`      | KYC status changed for a participant              |
| `external_account_status_changed` | Status changed for a linked external bank account |
| `participant_updated`             | Participant details updated (logged only)         |
| `account_balance.changed`         | Account balance changed with movements            |
| `payment_status_changed`          | Payment status changed for external account funding |
| `trade.status_changed`            | Trade status changed for exchange transactions    |

---

## Processing Flow

1. **Receive & Validate**

   * Parse JSON body (buffer or object).
   * Verify `X-ZH-Hook-Payload-Type` header and presence of `participant_code`.
   * Reject with **400 Bad Request** on missing/invalid data.

2. **Lookup ExternalAccount**

   * Call `ExternalAccountService.findOne({ participant_code })`.
   * Reject with **400 Bad Request** if no matching record.

3. **Dispatch by Event Type**

   * **participant\_status\_changed**

     * Lock on `participant_code`.
     * Compare incoming KYC status vs. current (`provider_kyc_status`).
     * Update only if it represents a valid upgrade (no downgrades from approved).

   * **external\_account\_status\_changed**

     * Lock on external account reference.
     * Compare incoming vs. current `status`.
     * Update only if it represents a valid upgrade (no downgrades from terminal statuses).

   * **participant\_updated**

     * Logged for audit; no database changes.

   * **account\_balance.changed**

     * Process balance movements for supported stablecoins (USDC.SOL, USDT.ETH, etc.)
     * Handle different movement types:
       - `final_settlement`: Exchange trade completions
       - `transfer`: P2P transfers between participants  
       - `withdrawal_confirmed`: Completed withdrawals from collateral accounts
       - `withdrawal_pending`: Pending withdrawals
     * Update fiat wallet transactions and balances based on movement type
     * Only process movements for `available` account type (except withdrawal_confirmed from collateral)

   * **payment\_status\_changed**

     * Process external account funding payment status updates
     * Update fiat wallet transaction status and user balances
     * Handle status transitions: initiated → completed/failed/cancelled

   * **trade.status\_changed**

     * Process exchange trade status updates  
     * Update fiat wallet transaction status for currency exchanges
     * Handle status transitions: initiated → completed/failed/cancelled

4. **Respond**
   Always return **200 OK** once processing completes.

---

## Movement Processing

### Supported Movement Types

| Movement Type        | Description                                    | Required Fields         |
| -------------------- | ---------------------------------------------- | ----------------------- |
| `final_settlement`   | Completion of currency exchange trades         | `trade_id`, `change`    |
| `transfer`           | P2P transfers between participants             | `transfer_request_id`, `change` |
| `withdrawal_confirmed` | Completed withdrawals from collateral accounts | `withdrawal_request_id`, `change` |
| `withdrawal_pending` | Pending withdrawals                            | `withdrawal_request_id`, `change` |

### Account Types

- **available**: Standard account for regular transactions
- **collateral**: Special account type (only processed for withdrawal_confirmed movements)

### Supported Assets

The system processes movements for supported stablecoins in the format `CURRENCY.NETWORK`:
- USDC.SOL, USDT.SOL (Solana network)
- USDC.ETH, USDT.ETH (Ethereum network)  
- USDC.TRON, USDT.TRON (Tron network)

---

## Status Priority

Prevent unintended downgrades by assigning numeric priorities:

### KYC Status

| Status                | Priority |
| --------------------- | -------- |
| `not_started`         | 0        |
| `pending`             | 1        |
| `approved`            | 2        |
| `rejected` / `closed` | terminal |

### External Account Status

| Status                           | Priority |
| -------------------------------- | -------- |
| `pending`                        | 1        |
| `active`                         | 2        |
| `disabled` / `closed` / `locked` | terminal |

### Payment Status

| Status       | Description                           |
| ------------ | ------------------------------------- |
| `initiated`  | Payment has been initiated            |
| `completed`  | Payment completed successfully        |
| `failed`     | Payment failed                        |
| `cancelled`  | Payment was cancelled                 |

### Trade Status

| Status       | Description                           |
| ------------ | ------------------------------------- |
| `initiated`  | Trade has been initiated              |
| `completed`  | Trade completed successfully          |
| `failed`     | Trade failed                          |
| `cancelled`  | Trade was cancelled                   |

---

## Error Handling

* **400 Bad Request**: Missing/invalid header or payload, or record not found.
* **500 Internal Server Error**: Unexpected exceptions.

All webhook processing errors are logged with full context for debugging.

---

## Webhook Security

* ZeroHash webhooks include signature validation (implementation depends on ZeroHash specifications)
* All webhook payloads are logged for audit purposes
* Failed webhook processing is logged with error details

---
