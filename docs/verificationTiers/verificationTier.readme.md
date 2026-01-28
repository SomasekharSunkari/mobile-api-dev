# Verification Tiers and Verification Tier Config Documentation

This document provides an overview of how Tiers and Tier Configurations are managed in the system, including their seeding, database integration, and their relationship with the KYC Verification Service.

---

## 1. Tiers: Seeding and Database Integration

Tiers represent the levels of user verification and account privileges. Each tier has specific attributes such as deposit limits, balance limits, and descriptions.

### Tier Model

The `TierModel` defines the structure of the Tier entity in the database. It includes properties such as:

- `name`: The name of the tier (e.g., "Basic", "Advanced").
- `level`: The level of the tier (e.g., 1, 2, 3).
- `description`: A description of the tier.
- `minimum_deposit`: The minimum deposit amount required for the tier.
- `maximum_deposit`: The maximum deposit amount allowed for the tier.
- `minimum_balance`: The minimum balance required for the tier.
- `maximum_balance`: The maximum balance allowed for the tier.

The `TierModel` is located in the file:
`src/database/models/tier/tier.model.ts`

### Seeding Tiers

Tiers can be seeded into the database using migration or seed files. These files define the initial set of tiers and their attributes. For example:

```typescript
exports.seed = function (knex) {
  return knex('tiers').insert([
    {
      name: 'Basic',
      level: 1,
      description: 'Basic Tier',
      minimum_deposit: 100,
      maximum_deposit: 1000,
      minimum_balance: 50,
      maximum_balance: 5000,
    },
    {
      name: 'Advanced',
      level: 2,
      description: 'Advanced Tier',
      minimum_deposit: 1000,
      maximum_deposit: 10000,
      minimum_balance: 500,
      maximum_balance: 50000,
    },
  ]);
};
```

---

## 2. Tier Config: Seeding and Database Integration

Tier Configurations define the rules and requirements for each tier, such as the country-specific settings and verification steps.

### Tier Config Model

The `TierConfigModel` defines the structure of the Tier Config entity in the database. It includes properties such as:

- `country_id`: The ID of the country the configuration applies to.
- `level`: The tier level this configuration applies to.
- `verifications`: A JSON array of verification steps required for the tier.

### Seeding Tier Configurations

Tier Configurations can be seeded into the database using migration or seed files. These files define the initial set of configurations and their attributes. For example:

```typescript
exports.seed = function (knex) {
  return knex('tier_configs').insert([
    { country_id: '1', level: 1, verifications: JSON.stringify(['email_verification', 'phone_verification']) },
    { country_id: '1', level: 2, verifications: JSON.stringify(['document_verification', 'address_verification']) },
  ]);
};
```

### Relationship with Tiers

Each Tier Config is associated with a specific tier level and country. This relationship ensures that users in different countries can have customized tier requirements.

---

## 3. Tier Config Service: Methods and Usage

The `TierConfigService` provides methods to manage Tier Configurations, including creating, updating, and deleting configurations.

### Key Methods

#### `create(data: CreateTierConfigDto)`

Creates a new Tier Config in the database. It ensures that no duplicate levels exist for the same country.

#### `update(id: string, data: UpdateTierConfigDto)`

Updates an existing Tier Config by ID. It validates the existence of the configuration before updating.

#### `findAll(query: FetchQuery & { countryId: string })`

Fetches all Tier Configurations for a specific country.

#### `findOne(id: string)`

Fetches a single Tier Config by ID.

#### `delete(id: string)`

Deletes a Tier Config by ID.

The `TierConfigService` is located in the file:
`src/modules/tierConfig/tierConfig.service.ts`

---

## 4. Integration with KYC Verification Service

The `KycVerificationService` integrates with the `TierConfigService` to determine the next tier configuration for a user during the KYC process.

### Workflow

1. **Determine Current Tier**:
   The `getNextKycTierConfig` method in `KycVerificationService` fetches the user's current tier and determines the next tier configuration based on their KYC status.

2. **Fetch Tier Config**:
   The `TierConfigService` is used to fetch the appropriate tier configuration for the user's country and current tier level.

3. **Update KYC Record**:
   The KYC record is updated with the new tier configuration and status.

### Example Integration

```typescript
async getNextKycTierConfig(userId: string, countryId: string) {
  let level = 2;
  const kyc = await this.kycVerificationRepository.findOne(
    { user_id: userId },
    {},
    { graphFetch: 'tierConfig' },
  );

  if (kyc && kyc.status === 'success') {
    level = 3;
  }

  const tierConfig = await this.tierConfigRepository.findOne({ country_id: countryId, level });

  if (!tierConfig) {
    throw new NotFoundException('Tier config not found, You are done with all your kyc');
  }

  return tierConfig;
}
```

---

## Summary

- **Tiers** define the levels of user verification and account privileges.
- **Tier Configurations** define the rules and requirements for each tier, customized by country.
- The `TierConfigService` provides methods to manage Tier Configurations.
- The `KycVerificationService` integrates with the `TierConfigService` to orchestrate the KYC process and determine the next tier for a user.

For more details, refer to the following files:

- `src/database/models/tier/tier.model.ts`
- `src/modules/tierConfig/tierConfig.service.ts`
- `src/modules/auth/kycVerification/kycVerification.service.ts`
