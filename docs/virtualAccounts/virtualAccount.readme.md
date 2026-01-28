# Virtual Account Documentation

## Overview

The Virtual Account module provides functionality for creating and managing virtual accounts for users. This module integrates with external services to generate virtual accounts and store the details in the system. Virtual accounts are created once a user is verified, enabling seamless financial operations.

## Key Features

- **Virtual Account Creation**: Automatically creates a virtual account for verified users.
- **Integration with External Services**: Leverages the `WaasAdapter` to interact with external providers for account creation.
- **Account Management**: Allows fetching all virtual accounts associated with a user.
- **Error Handling**: Implements robust error handling to ensure smooth operation.

## How It Works

### Virtual Account Creation

1. **User Verification**: A virtual account is created only after the user is verified.
2. **Payload Preparation**: The `VirtualAccountService` prepares the payload required for the external service, including user details such as name, address, and BVN.
3. **External Service Integration**: The service uses the `WaasAdapter` to call the external provider's API and create the virtual account.
4. **Database Storage**: The virtual account details returned by the external provider are stored in the database using the `VirtualAccountRepository`.

#### Code Flow

- The `create` method in `VirtualAccountService` is responsible for creating a virtual account.
- It fetches user details from the `UserRepository` and prepares the payload.
- The `WaasAdapter` is used to interact with the external provider.
- The response from the external provider is saved in the database.

#### Example

```typescript
const payload: VirtualPermanentAccountPayload = {
  address: user.userProfile?.address_line1,
  bvn: data.bvn,
  date_of_birth: user.userProfile?.dob?.toString(),
  email: user.email,
  first_name: user.first_name,
  gender: user.userProfile?.gender,
  last_name: user.last_name,
  phone_number: user.phone_number,
};

const response = await this.waasAdapter.createBank(payload);
const virtualAccount = await this.virtualAccountRepository.create({
  user_id: userId,
  fiat_wallet_id: data.fiat_wallet_id,
  account_name: response.account_name,
  account_number: response.account_number,
  bank_name: response.bank_name,
  bank_ref: response.provider_ref,
  ...
});
```

### Fetching Virtual Accounts

1. **API Endpoint**: The `findAll` method in `VirtualAccountController` provides an endpoint to fetch all virtual accounts for a user.
2. **Service Call**: The controller calls the `findAll` method in `VirtualAccountService` to retrieve the accounts.
3. **Query Parameters**: Optionally, a `walletId` can be provided to filter the accounts by wallet.

#### Code Flow

- The `findAll` method in `VirtualAccountController` handles the API request.
- It retrieves the user ID from the request and calls the service method.
- The service method queries the database using the `VirtualAccountRepository`.

#### Example

```typescript
@Get('')
async findAll(@User() user: UserModel, @Query() query: { walletId?: string }) {
  const userId = user.id;
  const virtualAccounts = await this.virtualAccountService.findAll(userId, query);

  return this.transformResponse('VirtualAccount fetched successfully', virtualAccounts, HttpStatus.CREATED);
}
```

## Error Handling

- **Account Creation**: If any error occurs during account creation, an `InternalServerErrorException` is thrown with a descriptive message.
- **Fetching Accounts**: If an error occurs while fetching accounts, an `InternalServerErrorException` is thrown.

## Notes

- Ensure that the user is verified before attempting to create a virtual account.
- The `DEFAULT_NG_WAAS_ADAPTER` environment variable must be correctly configured to select the appropriate external provider.

## API Endpoints

### Create Virtual Account

- **Method**: POST
- **Endpoint**: `/virtual-accounts`
- **Description**: Creates a virtual account for a verified user.

### Fetch Virtual Accounts

- **Method**: GET
- **Endpoint**: `/virtual-accounts`
- **Description**: Fetches all virtual accounts for a user.
- **Query Parameters**:
  - `walletId` (optional): Filters accounts by wallet ID.

## Example Usage

### Creating a Virtual Account

```typescript
const data = { bvn: '12345678901', fiat_wallet_id: 'wallet123' };
const userId = 'user123';
const virtualAccount = await virtualAccountService.create(userId, data);
console.log(virtualAccount);
```

### Fetching Virtual Accounts

```typescript
const userId = 'user123';
const query = { walletId: 'wallet123' };
const virtualAccounts = await virtualAccountService.findAll(userId, query);
console.log(virtualAccounts);
```
