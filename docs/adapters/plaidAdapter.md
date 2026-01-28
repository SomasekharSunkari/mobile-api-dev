# Plaid Integration Documentation

## Overview

The Plaid integration enables your backend to issue link-tokens, exchange them for access tokens, fetch account data, and generate processor tokens for downstream providers (e.g. ZeroHash). It’s wired into our `LinkBankAccountAdapter`, which dispatches calls to `PlaidAdapter` based on country codes.

## Key Features

* **Link Token Creation**
  Initialize Plaid Link in the front-end by calling `createLinkToken`, which returns a short-lived link token and expiration.

* **Public → Access Token Exchange**
  Convert the `public_token` from Plaid Link into an `access_token` and `item_id` via `exchangeToken`.

* **Account Retrieval**
  Pull user bank account details (`account_id`, balances, names, masks, etc.) through `getAccounts`.

* **Processor Token Generation**
  Produce a Plaid–ZeroHash processor token for a specific account with `createProcessorToken`.

## Configuration

All Plaid settings are managed by `PlaidConfigProvider`, which reads from environment variables:

* `PLAID_CLIENT_ID`
* `PLAID_SECRET`
* `PLAID_ENV` (e.g. `sandbox`, `development`, `production`)
* `PLAID_WEBHOOK`
* `PLAID_REDIRECT_URI`

Ensure these are set before running any Plaid-related flows.

## Adapter Architecture

```
LinkBankAccountAdapter
  ├─ createLinkToken → PlaidAdapter.createLinkToken
  ├─ exchangeToken   → PlaidAdapter.exchangeToken
  ├─ getAccounts     → PlaidAdapter.getAccounts
  └─ createProcessorToken → PlaidAdapter.createProcessorToken
```

> For non-US flows, `LinkBankAccountAdapter` will reject requests with a `NotImplementedException`.

## Core Methods

### `createLinkToken(req: CreateTokenRequest): CreateTokenResponse`

* **Inputs**:

  * `clientName`: Your platform’s name (e.g. “OneDosh”)
  * `user`: `{ userRef, fullName, email, phone, dob, address }`
  * `androidPackageName?`, `customizationName?`
* **Outputs**:

  * `token`: Plaid link token
  * `expiration`: ISO timestamp when it expires
  * `requestRef`: Plaid’s internal request ID

### `exchangeToken(req: { publicToken }): TokenExchangeResponse`

* **Inputs**:

  * `publicToken` from the front-end
* **Outputs**:

  * `accessToken`, `itemId` (item\_id), `requestRef`

### `getAccounts(req: { accessToken }): AccountsResponse`

* **Inputs**:

  * `accessToken`
* **Outputs**:

  * `accounts`: Array of `{ ref, name, mask, balances, type, subtype, … }`
  * `item`: Metadata about the Plaid item
  * `requestRef`

### `createProcessorToken(req: { accessToken, accountRef }): ProcessorTokenResponse`

* **Inputs**:

  * `accessToken`, `accountRef` (account\_id)
  * `processor` (defaults to ZeroHash)
* **Outputs**:

  * `processorToken`, `requestRef`

## Error Handling

* All network errors are caught and re-thrown as NestJS HTTP exceptions (`InternalServerErrorException`).
* Unimplemented country codes return `NotImplementedException`.

## Example Flow

1. **Backend**: call `createLinkToken(...)` → send token to frontend.
2. **Frontend**: initialize Plaid Link with received token → user selects account.
3. **Frontend**: receive `public_token` → POST to your server.
4. **Backend**: call `exchangeToken({ publicToken })` → get `accessToken`.
5. **Backend**: call `getAccounts({ accessToken })` → validate accounts.
6. **Backend**: call `createProcessorToken({ accessToken, accountRef })` → get `processorToken` for downstream.

---

