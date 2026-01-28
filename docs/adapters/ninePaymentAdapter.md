# NinePaymentAdapter Documentation

## Overview

The `NinePaymentAdapter` is a service designed to interact with the external Nigerian wallet provider, 9Payment. This adapter facilitates the creation and management of wallets, as well as other wallet-related operations, by leveraging the 9Payment API.

## Key Features

- **Wallet Creation**: Provides functionality to create wallets for users via the `createBank` method.
- **Transaction Management**: Supports crediting wallets and retrieving wallet or account information.
- **Error Handling**: Implements robust error handling to ensure smooth operation.
- **Integration with 9Payment**: Fully integrated with the 9Payment API for seamless communication.

## Methods

### `createBank(payload: VirtualPermanentAccountPayload): Promise<VirtualPermanentAccountResponse>`

Creates a wallet for a user by interacting with the 9Payment API.

- **Parameters**:
  - `payload`: An object containing user details such as name, phone number, address, and BVN.
- **Returns**: A promise that resolves to a `VirtualPermanentAccountResponse` object containing wallet details.
- **Error Handling**: Throws an `InternalServerErrorException` if the API call fails.

### `async processWebhook(payload: ProcessWebhookPayload<NinePaymentNotificationRequeryPayload>): Promise<ProcessWebhookResponse<NinePaymentNotificationRequeryResponse>>`

Process a webhook from the ninePayments.

- **Parameters**:
  - `payload`: An object containing the webhook details.
- **Returns**: A promise that resolves to the response from the 9Payment API.
- **Error Handling**: Throws an `InternalServerErrorException` if the API call fails.

### `creditBank(payload: CreditTransactionPayload<any>): Promise<any>`

Credits a wallet by transferring funds to it.

- **Parameters**:
  - `payload`: An object containing transaction details such as amount and metadata.
- **Returns**: A promise that resolves to the response from the 9Payment API.
- **Error Handling**: Throws an `InternalServerErrorException` if the API call fails.

### `getAccountInfo(payload: Record<any, any>): Promise<any>`

Retrieves information about a specific wallet or account.

- **Parameters**:
  - `payload`: An object containing the account details.
- **Returns**: A promise that resolves to the account information.
- **Error Handling**: Throws an `InternalServerErrorException` if the API call fails.

### `getWallet(payload: GetWalletPayload): Promise<any>`

Fetches wallet details using the 9Payment API.

- **Parameters**:
  - `payload`: An object containing the wallet details, such as the account number.
- **Returns**: A promise that resolves to the wallet information.
- **Error Handling**: Throws an `InternalServerErrorException` if the API call fails.

### `debitBank(payload: DebitTransactionPayload<any>): Promise<any>`

Debits a wallet by transferring funds out of it. This method is currently not implemented and will throw a `NotImplementedException`.

- **Parameters**:
  - `payload`: An object containing the debit transaction details.
- **Error Handling**: Throws a `NotImplementedException`.

## Implementation Details

### Wallet Creation

The `createBank` method formats the user details into the required structure for the 9Payment API. It generates a unique transaction tracking reference and sends a POST request to the `/open_wallet` endpoint. If the API response indicates failure, an exception is thrown.

### Transaction Tracking Reference

A unique transaction tracking reference is generated using the current timestamp and a random 12-digit number. This ensures that each transaction is uniquely identifiable.

### Error Handling

All methods include error handling to catch and log errors from the 9Payment API. If an error occurs, an `InternalServerErrorException` is thrown with a descriptive message.

## Example Usage

```typescript
const payload = {
  first_name: 'John',
  last_name: 'Doe',
  phone_number: '1234567890',
  gender: 'male',
  date_of_birth: '1990-01-01',
  address: '123 Main St',
  bvn: '12345678901',
  email: 'john.doe@example.com',
};

const response = await ninePaymentAdapter.createBank(payload);
console.log(response);
```

## Notes

- Ensure that the required environment variables and API keys for 9Payment are correctly configured.
- The adapter is designed to be extensible, allowing additional features to be added as needed.
