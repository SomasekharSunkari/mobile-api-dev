# OneDosh Wayfinder Backend API

This document provides comprehensive documentation for the backend API implementation, architecture, and integration.

## Table of Contents

1. [Introduction](#introduction)
2. [System Setup](#system-setup)
3. [Project Structure](#project-structure)
4. [Database Integration](#database-integration)
5. [Authentication & Authorization](#authentication--authorization)
6. [Error Handling](#error-handling)
7. [API Documentation](#api-documentation)
8. [Middleware Implementation](#middleware-implementation)
9. [Models and Repositories](#models-and-repositories)
10. [Development Workflow](#development-workflow)
    - [GitHub Integration with Jira](#github-integration-with-jira)
11. [Wallet Management System](#wallet-management-system)
12. [KYC and Link Bank Account Flow](#kyc-and-bank-account-linking-flow)

## Introduction

The backend API is built using NestJS framework and provides a RESTful API for the OneDosh Wayfinder application. It implements a modular architecture with comprehensive error handling, authentication, and database integration.

## System Setup

### Prerequisites

- Node.js (v20+)
- Yarn/npm
- Docker (for PostgreSQL)

### Setting Up the Database

```sh
docker run --name postgres -e POSTGRES_PASSWORD=postgres -e POSTGRES_USER=postgres -e POSTGRES_DB=wayfinderdb -p 5432:5432 -d postgres:latest
```

### Environment Configuration

Create a `.env` file based on `.env.example` with the following variables:

```
NODE_ENV=development
PORT=3000
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=postgres
DB_NAME=wayfinderdb
JWT_SECRET_TOKEN=your_secret_token
JWT_EXPIRATION_MINS=60
```

### Installation and Running

```sh
# Install dependencies
yarn install

# Run migrations
yarn migrate:latest
```

# System Setup Instructions

To successfully run the system seamlessly, please follow the steps below.

## 1. Install `just` Binary
Download and install the **`just`** binary from the link below:  
🔗 [Just Installation Guide](https://github.com/casey/just)

## 2. Install a Terminal Emulator (Optional)
Most operating systems come with a terminal emulator by default.  
If yours does not, it is recommended to install **tmux**:  
🔗 [tmux Installation Guide](https://github.com/tmux/tmux/wiki/Installing)

## 3. Ensure Docker is Running
Make sure **Docker** is installed and running on your system.  
> **Note:**  
> If Docker causes your PC to hang, you will not be able to use the Grafana UI, which may slow down debugging.

### Optional: Remove Docker Compose Check
If Docker is causing issues and you wish to bypass the Docker Compose check:
1. Open the `justfile`.
2. Locate the **`dev`** command area (around **line 207**).
3. Remove the `compose-up` command.

## 4. Setup SSH Private Key
1. Copy the private key from **Confluence**.
2. Navigate into the `./zh-proxy` directory.
3. Create a file named `staging.pem`.
4. Paste the private key content into `staging.pem`.

## 5. Start the Service
Once the above steps are completed, start the service with:

```bash
just dev
```

## Project Structure

The project follows a modular architecture with the following main directories:

- `src/`: Main source code
  - `config/`: Environment and configuration management
  - `constants/`: Application constants
  - `database/`: Database connection, models, and migrations
  - `decorators/`: Custom decorators
  - `middlewares/`: Application middleware
  - `modules/`: Feature modules
  - `base/`: Base classes and interfaces

## Database Integration

### KnexJS Configuration

The application uses KnexJS as the query builder with Objection.js as the ORM. The database configuration is defined in `knexfile.ts` at the root of the project.

### Database Connection

Database connection is managed through the `KnexDB` class in `src/database/database.connection.ts`. This implements a singleton pattern to ensure a single database connection throughout the application lifecycle.

### Migration Pattern

Migrations are located in `src/database/migrations/` and follow a timestamp-based naming convention. Each migration includes:

- `up()`: Function for applying changes
- `down()`: Function for rolling back changes

Example migration:

```typescript
export async function up(knex: Knex): Promise<void> {
  return knex.transaction(async (trx: any) =>
    trx.schema.createSchemaIfNotExists(DatabaseSchema.apiService).then(() =>
      trx.schema.hasTable(DatabaseTables.users).then((tableExists: boolean) => {
        if (!tableExists) {
          return trx.schema
            .withSchema(DatabaseSchema.apiService)
            .createTable(DatabaseTables.users, (tableBuilder: any) => {
              // Table definition
            });
        }
      }),
    ),
  );
}
```

Run migrations with:

```sh
yarn mg:up  # Apply pending migrations
yarn mg:down  # Rollback last batch of migrations
 npx knex migrate:make create_<table name>_table  # Create a new migration file
```

## Authentication & Authorization

### JWT Implementation

The application uses JWT (JSON Web Tokens) for authentication, implemented in the `auth` module.

#### JWT Strategy

JWT authentication is implemented using Passport.js with a custom strategy in `src/modules/auth/strategies/jwt-strategy.service.ts`. The strategy:

1. Extracts the JWT token from the Authorization header
2. Validates the token using the configured secret
3. Retrieves the user from the database
4. Verifies the user is active
5. Provides the user object to the request

#### JWT Guard

The `JwtAuthGuard` in `src/modules/auth/strategies/jwt-auth.guard.ts` protects routes that require authentication.

#### Token Generation

Tokens are generated in the `AuthService` with:

```typescript
public async signJwt({ uuid, id, email, phone }: Partial<TokenPayload>) {
  const token = this.jwtService.sign(
    { uuid, email, phone, id },
    {
      audience: uuid,
    },
  );

  const expiration = addMinutes(new Date(), JWT_EXPIRATION_MINS);

  return { token, expiration };
}
```

### Role-Based Access Control

The system implements role-based access control with:

- `Role` model: Defines available roles
- `Permission` model: Defines atomic permissions
- `RolePermission` model: Maps roles to permissions
- `UserRole` model: Assigns roles to users

## Error Handling

### Global Exception Filter

The application uses a global exception filter defined in `src/app.error.ts` that handles:

1. Validation errors from Objection.js
2. HTTP exceptions
3. Database errors (foreign key violations, unique constraints, etc.)
4. Custom application exceptions

Each error returns a consistent response structure:

```typescript
{
  statusCode: number;
  message: string;
  type: string;
  data: any;
  timestamp: string;
  path: string;
}
```


## Middleware Implementation

### Global Middleware

Global middleware is applied in the `Server.attachMiddleware` method in `main.ts`:

- `ValidationPipe`: Handles DTO validation
- `IpMiddleware`: Extracts client IP address
- `AccessBlockerMiddleware`: Blocks requests from flagged IPs and logs the attempts in the database

### Custom Middleware

Custom middleware includes:

- `DecodeAndDecompressAuthHeader`: Processes authorization headers
- Additional middleware for specific routes

## Models and Repositories

### Base Model

All models extend the `BaseModel` class defined in `src/database/base/base.model.ts`, which provides:

- Automatic ID generation (CUID)
- Timestamp management (`created_at`, `updated_at`)
- Soft delete functionality (`deleted_at`)

```typescript
export class BaseModel
  extends SoftDeleteMixin({
    columnName: 'deleted_at',
    deletedValue: new Date(),
  })(Model)
  implements IBase {
  // Implementation
}
```

### Model Implementation

Models are organized in the `src/database/models/` directory with each model having:

- Model class (`*.model.ts`): Defines the table schema and relationships
- Interface (`*.interface.ts`): TypeScript interface for type safety
- Validation schema (`*.validation.ts`): JSON schema for validation

Example model:

```typescript
export class UserModel extends BaseModel implements IUser {
  // Properties

  static get tableName() {
    return DatabaseSchema.apiService + '.' + DatabaseTables.users;
  }

  static get jsonSchema() {
    return UserValidationSchema;
  }

  static get relationMappings() {
    // Define relationships
  }
}
```

### Repositories

Repositories extend models to provide business logic and database operations.

## API Documentation

API documentation is generated using Swagger and available at the `/docs` endpoint. The Swagger configuration is set up in `main.ts`:

```typescript
public static async bootSwaggerDocs(app: NestExpressApplication) {
  // Configuration
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, document);
}
```

In development mode, the API specification is saved to `one-dosh.spec.json`.

### Postman

- [Postman Collection](./docs/postman/postman_collection.json)
- [Postman Environment](./docs/postman/postman_environment.json)

> Import both files into Postman for local API testing.

### Swagger UI

- [Live Swagger Documentation](http://localhost:9000/docs)

> Start the server locally and visit the URL above to explore the full OpenAPI spec.

### Starting a KYC Flow

To initiate a KYC process for a user via Zerohash:

1. Make a POST request to:

```
{{baseUrl}}/auth/kyc/widget/start
```

This will register the user for KYC and return widget configuration data for the frontend.

### Simulating Zerohash Webhooks

To test KYC status updates via webhooks:

#### 1. Simulate "onboarding_status_updated"

```sh
yarn sign:zh:o
```

- You'll be prompted to enter a **user ID**.
- The script will output:
  - JSON payload for the webhook body
  - Signature for the `x-zh-hook-rsa-signature-256` header
  - Event name for the `x-zh-hook-payload-type` header (use `onboarding_status_updated`)

Paste these into a POST request to:

```
{{baseUrl}}/webhooks/zerohash
```

#### 2. Simulate "participant_status_updated"

```sh
yarn sign:zh:p
```

- Enter the same or another valid **user ID**.
- Use the generated output to simulate a `participant_status_updated` webhook in the same way.

#### 3. Simulate "participant_onboarding_status_updated"

```sh
yarn sign:zh:po
```

- Enter the same or another valid **user ID**.
- Use the generated output to simulate a `participant_onboarding_status_updated` webhook in the same way.

> This setup helps test your signature verification and webhook handling logic end-to-end.

### Tier KYC Verification

To initiate a KYC process for a user via Zerohash:

1. Make a POST request to:

```
{{baseUrl}}/auth/kyc/widget/start
```

This will register the user for KYC and return widget configuration data for the frontend.

### Simulating Zerohash Webhooks

To test KYC status updates via webhooks:

#### 1. Simulate "onboarding_status_updated"

```sh
yarn sign:zh:o
```

- You'll be prompted to enter a **user ID**.
- The script will output:
  - JSON payload for the webhook body
  - Signature for the `x-zh-hook-rsa-signature-256` header
  - Event name for the `x-zh-hook-payload-type` header (use `onboarding_status_updated`)

Paste these into a POST request to:

```
{{baseUrl}}/webhooks/zerohash
```

#### 2. Simulate "participant_status_updated"

```sh
yarn sign:zh:p
```

- Enter the same or another valid **user ID**.
- Use the generated output to simulate a `participant_status_updated` webhook in the same way.

#### 3. Simulate "participant_onboarding_status_updated"

```sh
yarn sign:zh:po
```

- Enter the same or another valid **user ID**.
- Use the generated output to simulate a `participant_onboarding_status_updated` webhook in the same way.

> This setup helps test your signature verification and webhook handling logic end-to-end.

The system manages user verification through tiered configurations. Each tier defines required verifications and limits. Users progress through tiers based on successful KYC completion. The process involves:

1. **Tier Configuration**: Admins define tiers with specific requirements and limits.
2. **KYC Initiation**: Users start the KYC process, and the system determines the next applicable tier.
3. **Verification**: Users complete the required verifications for their tier.
4. **Progression**: Upon successful verification, users advance to the next tier, if available.

### Aiprise Adapter

The system manages aiprise adapter by implementing the kycAdapter, The aiprise adapter has a method (processWebhooks) which processes webhooks (using the aiprise events callback url), this method verify the verification_session_id, and then returns the verification details These are the flow.

1. User initiate aiprise kyc verification on the frontend with a callback_url
2. Aiprise sends a post request to the callback_url (which is /auth/kyc/process-webhook)
3. The flow continues Kyc verification controller -> Kyc verification service -> Kyc Adapter (which verify the kyc authenticity) -> Kyc verification service.
4. Hence from there, it creates a record to the kyc verification repository and then returns it to the frontend.

## Bank Account Linking Module

This module allows users to securely link their external bank accounts using a token exchange and metadata flow. The system supports linking multiple accounts and integrates with an external custody/compliance API.

### Features

- Frontend token generation and secure public-to-access token exchange
- Support for linking multiple bank accounts in a single session
- Integration with an external account verification and custody service
- Normalized database schema for storing linked bank account metadata
- Extensible adapter pattern for multi-country and multi-provider support
- Fully tested with coverage for key services, adapters, and models

### Architecture

- **Adapter Layer**: Handles external API integration per country or provider.
- **Dispatcher Adapter**: Determines correct adapter to use based on country.
- **Service Layer**: Coordinates country lookup, user profile validation, account linking, and persistence.
- **Repository Layer**: Handles database interactions with `linked_bank_accounts`.
- **Model Layer**: Validates and defines structure for linked account records.

## Development Workflow

### Code Style and Linting

The project uses ESLint and Prettier for code style enforcement:

- `.eslintrc.js`: ESLint configuration
- `.prettierrc`: Prettier configuration

Run linting with:

```sh
yarn lint
```

### Testing

Tests are located in the `test/` directory. Run tests with:

```sh
yarn test          # Run unit tests
yarn test:e2e      # Run end-to-end tests
yarn test:cov      # Run tests with coverage
```

### Build Process

The build process is configured in `nest-cli.json` and `tsconfig.json`. Build the application with:

```sh
yarn build
```

This generates the compiled JavaScript in the `dist/` directory.

### GitHub Integration with Jira

The project uses GitHub integration with Jira to automatically link commits, branches, and pull requests to Jira issues. This integration streamlines the development workflow and provides better traceability between code changes and project tasks.

#### Branch Naming Convention

When creating branches, include the Jira issue key in the branch name to automatically link it to the corresponding Jira ticket:

```sh
# Format: <issue-key>-<descriptive-name>
git checkout -b OD-123-add-user-authentication
git checkout -b OD-456-fix-wallet-balance-calculation
```

#### Commit Message Format

Include the Jira issue key in your commit messages to automatically link commits to Jira issues:

```sh
# Format: <issue-key>: <commit message>
git commit -m "OD-123: Implement JWT authentication strategy"
git commit -m "OD-456: Fix race condition in wallet balance updates"

# For multiple issues
git commit -m "OD-123 OD-124: Add user registration and email verification"
```

#### Pull Request Integration

When creating pull requests on GitHub:

1. Include the Jira issue key in the PR title or description
2. The integration will automatically:
   - Link the PR to the Jira issue
   - Update the issue status based on PR state
   - Show PR status in the Jira issue view

```markdown
# PR Title Examples
OD-123: Implement user authentication module
[OD-456] Fix wallet transaction locking mechanism

# PR Description
Resolves OD-123
Fixes OD-456
Closes OD-789
```

#### Viewing Integration in Jira

Once commits and PRs are linked:

1. Navigate to the Jira issue
2. Click on the **Development** panel on the right side
3. View all linked:
   - Branches
   - Commits
   - Pull requests
   - Build status (if CI/CD is configured)

#### Smart Commits

Use smart commits to perform actions on Jira issues directly from commit messages:

```sh
# Transition issue to "In Progress"
git commit -m "OD-123 #in-progress: Start implementing authentication"

# Add time tracking
git commit -m "OD-123 #time 2h 30m: Complete JWT implementation"

# Add comment
git commit -m "OD-123 #comment: Implemented basic auth flow, pending tests"

# Transition to done
git commit -m "OD-123 #done: Complete user authentication feature"

# Combine multiple commands
git commit -m "OD-123 #time 3h #comment: Fixed security vulnerabilities #done"
```

#### Available Smart Commit Commands

| Command | Description | Example |
|---------|-------------|---------|
| `#comment` | Add a comment to the issue | `OD-123 #comment: Updated implementation` |
| `#time` | Log work time | `OD-123 #time 2h 30m` |
| `#in-progress` | Move to In Progress | `OD-123 #in-progress` |
| `#done` | Move to Done | `OD-123 #done` |
| `#resolve` | Resolve the issue | `OD-123 #resolve` |
| `#close` | Close the issue | `OD-123 #close` |

#### Best Practices

1. **Always reference Jira issues**: Include the issue key in all branches, commits, and PRs
2. **Use descriptive branch names**: Combine issue key with clear description
3. **Keep commits atomic**: One logical change per commit with appropriate Jira reference
4. **Update issue status**: Use smart commits to keep Jira issues up-to-date
5. **Link related issues**: Reference multiple issues when changes span across tickets
6. **Review integration**: Verify that commits and PRs appear in Jira after pushing

#### Troubleshooting

If commits or PRs don't appear in Jira:

1. Verify the Jira issue key is correct and exists
2. Ensure the GitHub repository is properly connected to Jira
3. Check that you have the necessary permissions in both GitHub and Jira
4. Wait a few minutes for the integration to sync
5. Contact the project administrator if issues persist

## Wallet Management System

The `OneDosh Payment Core` includes a robust wallet management system allowing users to handle fiat currencies with secure transaction processing. This system provides the foundation for cross-border payments and currency exchanges.

### Core Components

#### 1. Transaction System

The transaction system provides a comprehensive record of all financial activities:

```typescript
// Key transaction statuses
enum TransactionStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
}
```

#### 2. Fiat Wallet Management

Users can hold balances in multiple supported currencies:

- Each user can have multiple fiat wallets (one per currency)
- Wallets track main balance and credit balance separately
- All operations use atomic transactions with database locking to prevent race conditions

#### 3. Fiat Wallet Transactions

The system records detailed transaction history for auditing and user reporting:

```typescript
// Transaction types
enum FiatWalletTransactionType {
  DEPOSIT = 'deposit', // Adding funds to wallet
  WITHDRAWAL = 'withdrawal', // Removing funds from wallet
  TRANSFER_IN = 'transfer_in', // Funds received from another user
  TRANSFER_OUT = 'transfer_out', // Funds sent to another user
}
```

#### 4. Currency Management

The platform adheres to ISO 4217 currency standards:

- Currently supports USD and NGN with standardized formatting
- All amounts stored in the smallest currency unit (cents, kobo, etc.)
- Currency utility methods for validation and formatting

### Key Features

#### Distributed Locking Mechanism

The wallet system uses Redis-based distributed locks to prevent race conditions during balance updates:

```typescript
// Example of updating a wallet balance with locking
await walletService.updateBalance(walletId, amount, transactionId, FiatWalletTransactionType.DEPOSIT, {
  description: 'Bank deposit',
});
```

The locking mechanism ensures:

- Only one process can update a specific wallet at a time
- Failed operations don't leave wallets in inconsistent states
- Atomic updates across multiple database tables

#### Transaction Record Keeping

Every wallet operation creates detailed records with:

- Balance before and after the transaction
- Complete timestamp history (created, processed, completed, failed)
- Provider details for external payment processors
- Metadata for additional context

### Use Cases

#### 1. Funding a User's Wallet

```
1. User selects funding method (bank transfer, card payment)
2. System creates a pending transaction
3. When provider confirms payment, the system:
   a. Acquires a lock on the wallet
   b. Updates the wallet balance
   c. Creates transaction records
   d. Releases the lock
4. User sees updated balance and transaction history
```

#### 2. Cross-Border Payments

```
1. Sender initiates payment from USD wallet to a recipient in Nigeria (NGN)
2. System calculates exchange rate and fees
3. Upon confirmation:
   a. Locks sender's USD wallet and deducts amount
   b. Converts to NGN (potentially via stablecoin bridge)
   c. Credits recipient's NGN wallet
   d. Creates transaction records in both wallets
   e. Releases all locks
```

#### 3. Handling Concurrent Transactions

The system is designed to safely handle multiple simultaneous operations:

- Multiple deposit attempts to the same wallet
- Withdrawal attempt during an ongoing deposit
- System maintenance during active transactions

### Implementation Considerations

1. **Performance**: Locks are short-lived and targeted to specific wallets
2. **Resilience**: Lock timeouts and automatic retries prevent deadlocks
3. **Consistency**: All balance changes use atomic transactions
4. **Auditability**: Comprehensive transaction records for compliance
5. **User Experience**: Detailed transaction history and real-time balance updates

### API Endpoints

The wallet system exposes RESTful endpoints for:

- Creating and retrieving wallets
- Viewing transaction history
- Initiating deposits and withdrawals
- Checking wallet balances
- Processing transfers between users

Detailed OpenAPI documentation is available in the Swagger UI at `/docs`.

## AccessBlockMiddleware

The `AccessBlockMiddleware` is a middleware for blocking access to certain routes based on IP address, geographic location, or other criteria. It is designed to enhance security by preventing unauthorized or malicious access attempts.

### Purpose

This middleware performs the following tasks:

- Retrieves the client's IP address and geographic information.
- Checks if the access should be blocked based on predefined rules using the `BanService`.
- Logs blocked access attempts for auditing purposes.
- Responds with a `403 Forbidden` status if access is blocked.
- Handles errors gracefully and provides a structured error response.

### How It Works

1. The middleware extracts the client's IP address and geographic information.
2. It calls the `BanService` to determine if the access should be blocked.
3. If access is blocked, it logs the attempt and throws a `ForbiddenException`.
4. If no blocking rules are triggered, the request proceeds to the next middleware or handler.

## KYC and Bank Account Linking Flow

##  1. KYC Initiation & Webhook Handling

### Step 1 – Start KYC
```http
POST /auth/kyc/widget/start
```
**Action**:
- Calls `ZerohashAdapter.initiateWidgetKyc()`
- Inserts a record into `api_service.kyc_verifications`

---

### Step 2 – Webhook: `kyc_verifications.status` → `submitted`

```json
{
  "participant_code": "5VCZC5",
  "participant_status": "submitted",
  "kyc_attempts": 0,
  ...
}
```

---

### Step 3 – Webhook: `kyc_verifications.status` → `approved`

```json
{
  "participant_code": "5VCZC5",
  "participant_status": "approved",
  ...
}
```

---

### Step 4 – Webhook: `participant_updated`

```json
{
  "participant_code": "5VCZC5",
  "idv": "not_applicable",
  "liveness_check": "not_applicable",
  "tax_id": true,
  "edd": false,
  "edd_required": false
}
```

 **Logging only** — this is not persisted to any DB table currently.

---

### Final KYC Verification Record

```json
{
  "id": "ttog3i7sg7lg493b63fds2jx",
  "user_id": "e09urk58y4r0dbz7yamerd7d",
  "country_id": "cma6yirpc0000w5mi97kv1ffo",
  "tier_config_id": "cmakvvocg00012v6mzvfixlk8",
  "provider": "zerohash",
  "provider_ref": "5VCZC5",
  "attempt": 0,
  "status": "approved",
  "error_message": null,
  "submitted_at": "2025-06-05 22:09:03.264+00",
  "reviewed_at": "2025-06-05 22:10:49.35+00",
  "identity_type": null,
  "identity_value": null,
  "metadata": null,
  "provider_status": "approved",
  "created_at": "2025-06-05 22:08:51.369+00",
  "updated_at": "2025-06-05 22:10:49.362+00",
  "deleted_at": null
}

```

---

##  2. External Bank Account Linking

### Step 5 – Begin Bank Link
```http
POST /external-accounts/link-token
```

---

### Step 6 – Webhook: `external_account.status` → `pending`

```json
{
  "external_account_id": "c5ac4b0a-5a52-45de-bf95-28930e699f91",
  "account_nickname": "Plaid Checking",
  "external_account_status": "pending"
}
```


---

### Step 7 – Webhook: `external_account.status` → `approved`

```json
{
  "account_type": "checking",
  "external_account_status": "approved"
}
```

---

### Final External Account Record

```json
{
  "id": "mwgppsa1wmuy3iepurh7a60p",
  "user_id": "e09urk58y4r0dbz7yamerd7d",
  "external_account_ref": "c5ac4b0a-5a52-45de-bf95-28930e699f91",
  "status": "approved",
  "provider": "plaid",
  "item_id": "kgxNkvrGeGCb9rRxRQzxuoGKQVJj9bUWR7vK7",
  "account_ref": "9BdmKJgxvxUEkjWgWydguzyAVoD4kLFqGMVRx",
  "access_token": "**********************************************",
  "processor_token": "*********************************************",
  "bank_ref": "ins_56",
  "bank_name": "Chase",
  "account_number": "0000",
  "routing_number": null,
  "nuban": null,
  "swift_code": null,
  "expiration_date": null,
  "capabilities": null,
  "account_name": "Plaid Checking",
  "account_type": "depository",
  "created_at": "2025-06-05 22:15:16.179+00",
  "updated_at": "2025-06-05 22:15:21.25+00",
  "deleted_at": null
}
```

---

