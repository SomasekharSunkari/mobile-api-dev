# ZeroHash Integration Documentation

## Overview

The `ZeroHashAdapter` suite provides a complete integration with the ZeroHash API, supporting KYC participant creation, bank account linking, and raw HTTP request signing. It consists of:

* **ZerohashAxiosHelper**: Core HTTP client with request signing and optional proxy support.
* **ParticipantAdapter / ZerohashParticipantAdapter**: Abstracts participant creation for supported countries (US, NG).
* **LinkBankAccountAdapter / ZerohashAdapter**: Handles bank account linking via ZeroHash’s `/payments/external_accounts` endpoint.

## Configuration

ZeroHash settings are loaded via `ZerohashConfigProvider`, typically backed by environment variables:

| Variable             | Description                                                     |
| -------------------- | --------------------------------------------------------------- |
| `SCX_API_KEY`        | Your ZeroHash API key                                           |
| `SCX_API_PASSPHRASE` | Your ZeroHash API passphrase                                    |
| `SCX_API_SECRET`     | Base64‑encoded ZeroHash API secret                              |
| `SCX_API_URL`        | Base URL of the ZeroHash API (e.g. `https://api.zerohash.test`) |

## ZerohashAxiosHelper

A reusable HTTP client that:

* Signs every request with HMAC SHA256: `X-SCX-SIGNED` header.
* Adds standard headers: `X-SCX-API-KEY`, `X-SCX-TIMESTAMP`, `X-SCX-PASSPHRASE`.
* Supports GET and POST methods.

### Example

```typescript
const helper = new ZerohashAxiosHelper();
const resp = await helper.post('/participants/customers/new', { /* ... */ });
```

## Participant Creation Flow

ZeroHash participants represent users in the ZeroHash platform. The flow is:

1. **Select provider**: via `ParticipantAdapter.createParticipant` based on country code (`US` or `NG`).
2. **Build payload**: map `ParticipantCreateRequest` to ZeroHash fields (e.g. `first_name`, `tax_id` for US, or `id_number` for NG).
3. **POST** `/participants/customers/new`: create the participant.
4. **Optional**: for NG, upload supporting documents to `/participants/documents` with `X-SCX-FILE-HASH` header.
5. **Return** `{ providerRef }` containing the ZeroHash `participant_code`.

### `ParticipantAdapter`

```ts
async createParticipant(payload: ParticipantCreateRequest)
```

* Validates country against configured `default_participant_countries` (e.g. `"US,NG"`).
* Delegates to `ZerohashParticipantAdapter`.

### `ZerohashParticipantAdapter`

```ts
async createParticipant(payload: ParticipantCreateRequest): Promise<{ providerRef: string }>
```

* Throws `BadGatewayException` on unsupported country or API errors.
* Returns `providerRef` from `response.data.message.participant_code`.

## Bank Account Linking Flow

To link a bank account for an existing ZeroHash participant:

1. **Token exchange & account fetch** via Plaid (US-only).
2. **Fetch approved KYC** and existing `ExternalAccount` record.
3. **POST** `/payments/external_accounts` for each account:

   * Payload: `{ participant_code, account_nickname, plaid_processor_token }`.
4. **Update** local `ExternalAccount` with:

   * `external_account_ref`, `linked_item_ref`, `linked_account_ref`, etc.

### `LinkBankAccountAdapter`

High‑level switch by country:

```ts
linkBankAccount(req, countryCode) =>
  case 'US': use ZerohashAdapter.linkBankAccount(req)
```

### `ZerohashAdapter`

```ts
async linkBankAccount(req: LinkAccountRequest)
```

* Calls `/payments/external_accounts`.
* Returns `{ accountRef, requestRef, ... }`.
* Throws `BadRequestException` on failure.

## Error Handling

* **HTTP errors**: logged in `ZerohashAxiosHelper` and rethrown as Nest exceptions.
* **Business errors**: country mismatches throw `BadGatewayException` or `BadRequestException`.

## Example Usage

```ts
// 1) Create a participant
const { providerRef } = await participantAdapter.createParticipant({
  firstName: 'Alice',
  lastName: 'Smith',
  email: 'alice@example.com',
  address: '123 Main St',
  city: 'NYC',
  state: 'NY',
  country: 'US',
  dob: '1990-01-01',
  kyc: 'pass',
  kycTimestamp: Date.now(),
  compliance: 'pass',
  complianceTimestamp: Date.now(),
  signedTimestamp: Date.now(),
  zip: '10001',
  ssn: '123-45-6789',
});

// 2) Link a bank account
yield await linkBankAccountAdapter
  .linkBankAccount({
    externalRef: providerRef,
    alias: 'My Checking',
    processorToken: 'processor-abc',
  },
  'US',
);
```

## Notes

* Ensure your ZeroHash credentials are set as environment variables.
* For NG participants, replace `ssn` with `passport` and upload documents.
