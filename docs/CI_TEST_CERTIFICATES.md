# Test Certificates for CI/CD

## Problem

The Zerohash webhook tests require RSA certificate pairs for signature verification testing. These certificates (`*.test.pem`) are gitignored for security reasons, causing CI builds to fail when tests try to read non-existent certificate files.

## Solution

The test suite now generates RSA key pairs dynamically during test execution, eliminating the dependency on filesystem certificates.

## Implementation

### Dynamic Certificate Generation

The test file `src/modules/webhooks/zerohash/zerohash-webhook.spec.ts` now includes:

```typescript
beforeAll(async () => {
  // Generate test RSA key pair on-the-fly
  const keyPair = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: {
      type: 'spki',
      format: 'pem',
    },
    privateKeyEncoding: {
      type: 'pkcs8',
      format: 'pem',
    },
  });

  publicKey = keyPair.publicKey;
  privateKey = keyPair.privateKey;
  // ... rest of setup
});
```

### Optional Certificate Generation Script

For development or debugging purposes, you can generate physical certificate files using:

```bash
npm run generate:test-certs
```

This script creates:

- `certs/zerohash/zerohash-webhook-public.test.pem`
- `certs/zerohash/zerohash-webhook-private.test.pem`

## CI/CD Setup

No special CI configuration is required. The tests will automatically generate the necessary certificates during execution.

## Benefits

1. **CI Compatibility**: Tests run without external dependencies
2. **Security**: No sensitive certificates in version control
3. **Isolation**: Each test run gets fresh, unique certificates
4. **Simplicity**: No manual certificate management required

## Gitignore

The following pattern remains in `.gitignore` to prevent accidental certificate commits:

```
certs/**/*.test.pem
```
