# WaasAdapter Documentation

## Overview

The `WaasAdapter` is a service designed to facilitate the creation and management of virtual accounts. It provides a flexible architecture that allows integration with multiple virtual account providers. This flexibility is achieved through a provider-based approach, where the adapter dynamically selects the appropriate provider based on the environment configuration.

## Key Features

- **Virtual Account Generation**: The `WaasAdapter` enables the creation of virtual accounts using the `createBank` method.
- **Provider Flexibility**: The adapter is designed to work with any virtual account provider. Currently, it supports the `NinePaymentAdapter` as a provider.
- **Transaction Management**: The adapter includes methods for crediting and debiting virtual accounts, as well as retrieving account and wallet information.
- **Error Handling**: Comprehensive error handling is implemented to ensure robust operation.

## Methods

### `createBank(payload: VirtualPermanentAccountPayload): Promise<VirtualPermanentAccountResponse>`

Creates a virtual bank account using the configured provider.

- **Parameters**:
  - `payload`: An object containing the details required to create a virtual account, such as name, phone number, and address.
- **Returns**: A promise that resolves to a `VirtualPermanentAccountResponse` object containing account details.
- **Error Handling**: Throws an `InternalServerErrorException` if the provider encounters an error.

### `async processWebhook(payload: ProcessWebhookPayload): Promise<ProcessWebhookResponse>`

Process a web using the configured provider.

- **Parameters**:
  - `payload`: An object containing the details to process webhooks.
- **Returns**: A promise that resolves to a `ProcessWebhookResponse` object containing account details.
- **Error Handling**: Throws an `InternalServerErrorException` if the provider encounters an error.

### `creditBank(payload: CreditTransactionPayload<any>): Promise<any>`

Credits a virtual bank account.

- **Parameters**:
  - `payload`: An object containing the credit transaction details.
- **Returns**: A promise that resolves to the response from the provider.
- **Error Handling**: Throws an `InternalServerErrorException` if the provider encounters an error.

### `getAccountInfo(payload: CreditTransactionPayload<any>): Promise<any>`

Retrieves information about a virtual account.

- **Parameters**:
  - `payload`: An object containing the account details.
- **Returns**: A promise that resolves to the account information.
- **Error Handling**: Throws an `InternalServerErrorException` if the provider encounters an error.

### `getWallet(payload: GetWalletPayload): Promise<any>`

Retrieves wallet information for a virtual account.

- **Parameters**:
  - `payload`: An object containing the wallet details.
- **Returns**: A promise that resolves to the wallet information.
- **Error Handling**: Throws an `InternalServerErrorException` if the provider encounters an error.

### `debitBank(payload: DebitTransactionPayload<any>): Promise<any>`

Debits a virtual bank account. This method is currently not implemented and will throw a `NotImplementedException`.

- **Parameters**:
  - `payload`: An object containing the debit transaction details.
- **Error Handling**: Throws a `NotImplementedException`.

## Provider Selection

The `WaasAdapter` dynamically selects the appropriate provider based on the `DEFAULT_NG_WAAS_ADAPTER` environment variable. For example:

- If the environment variable is set to `9payment`, the `NinePaymentAdapter` is used.

## Usage

To use the `WaasAdapter`, inject it into your service or controller and call the desired methods. Ensure that the `DEFAULT_NG_WAAS_ADAPTER` environment variable is correctly configured to select the appropriate provider.

## Example

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

const response = await waasAdapter.createBank(payload);
console.log(response);
```

## Notes

- Ensure that the required environment variables are set up correctly.
- The adapter is designed to be extensible, allowing additional providers to be integrated with minimal changes.
