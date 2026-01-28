# Login Security Flow Documentation

## Overview

Onedosh implements a comprehensive multi-layered security system for user authentication that combines rate limiting, risk assessment, device tracking, and two-factor authentication to protect against unauthorized access while maintaining a smooth user experience for legitimate users.

## Security Flow Overview

### Phase 1: Initial Security Checks

```
┌─────────────────────────────────────────────────────────────────┐
│                         USER LOGIN ATTEMPT                     │
│              POST /auth/login + Headers (IP, Fingerprint)      │
└─────────────────────────────┬───────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                     IP RATE LIMITING                           │
│   Check: login_security:attempts:{ip} in Redis                 │
│   Limit: 10 attempts per hour per IP                           │
│                                                                 │
│   BLOCKED → 429 Too Many Requests (15min lockout)             │
│   ALLOWED → Continue to next check                            │
└─────────────────────────────┬───────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                     ACTIVE OTP CHECK                           │
│   Check: login_otp:{ip}:{fingerprint} in Redis                 │
│                                                                 │
│   OTP PENDING → "Please check your messages"                  │
│   NO OTP → Continue to credentials                            │
└─────────────────────────────┬───────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                  CREDENTIAL VALIDATION                         │
│         Hash password + compare with database                  │
│                                                                 │
│   INVALID → Log attempt + increment counter + return error    │
│   VALID → Continue to risk assessment                         │
└─────────────────────────────┬───────────────────────────────────┘
                              │
                              ▼
```

### Phase 2: Risk Assessment & Scoring

```
┌─────────────────────────────────────────────────────────────────┐
│                     RISK SCORE CALCULATION                     │
│                    (Target: < 30 = Safe)                       │
└─────────────────────────────┬───────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    DEVICE TRUST ANALYSIS                       │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ Known device in login_devices table?                   │   │
│  │ YES → +0 points (trusted)                             │   │
│  │ NO  → +40 points (new device risk)                    │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────┬───────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                     LOCATION ANALYSIS                          │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ Compare current IP location vs last login:             │   │
│  │ • Same country     → +0 points                         │   │
│  │ • Different country → +25 points                       │   │
│  │ • Different region → +15 points                        │   │
│  │ • Different city   → +5 points                         │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────┬───────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    VPN/PROXY DETECTION                          │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ IP reputation check:                                   │   │
│  │ Residential/Business → +0 points                      │   │
│  │ VPN/Proxy detected  → +15 points                     │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────┬───────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                   TIME PATTERN ANALYSIS                        │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ Compare with user's historical login times:            │   │
│  │ Normal hours    → +0 points                            │   │
│  │ Unusual timing → +10 points                           │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────┬───────────────────────────────────┘
                              │
                              ▼
```

### Phase 3: Risk Decision & Authentication Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                     FINAL RISK SCORE                          │
│               Sum all risk points from above                   │
└─────────────────────────────┬───────────────────────────────────┘
                              │
                              ▼
                       ┌─────────────┐
                       │ Score < 30? │
                       └──────┬──────┘
                              │
                ┌─────────────┴─────────────┐
                │ YES                   NO  │
                ▼                           ▼
        ┌───────────────┐            ┌──────────────────┐
        │   LOW RISK    │            │   HIGH RISK      │
        │               │            │                  │
        │ Direct Login  │            │ Require OTP      │
        │ Success       │            │ Verification     │
        └───────┬───────┘            └─────────┬────────┘
                │                              │
                ▼                              ▼
┌──────────────────────────────────────────────────────────────────┐
│                     SUCCESS FLOW                               │
│  1. Generate JWT access/refresh tokens                          │
│  2. Track device in login_devices table                         │
│  3. Log successful event in login_events                        │
│  4. Clear IP rate limit attempts from Redis                     │
│  5. Return login success response                               │
└──────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────┐
│                     OTP VERIFICATION FLOW                      │
│                                                                  │
│  1. Check user contact info (phone vs email)                     │
│  2. Generate 6-digit OTP code                                   │
│  3. Store in Redis: login_otp:{ip}:{fingerprint}                │
│     - TTL: 10 minutes                                           │
│     - Max attempts: 3                                           │
│  4. Send via SMS (preferred) or Email (fallback)                │
│  5. Send security notification email                            │
│  6. Return: "Verification required" + masked contact            │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │               USER SUBMITS OTP                          │    │
│  │           POST /auth/verify-otp                         │    │
│  │                                                         │    │
│  │  Valid OTP → Complete Success Flow                     │    │
│  │  Invalid   → Increment attempts, allow retry           │    │
│  │  Expired   → "OTP expired, please login again"        │    │
│  │  Max tries → Block session, require new login         │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                  │
│  RESEND OPTION: POST /auth/resend-otp                          │
│     - Generate new OTP, reset attempt counter                   │
│     - Send new SMS/Email                                        │
└──────────────────────────────────────────────────────────────────┘
```

## Simplified Decision Tree

```
User Login
    │
    ├─ IP Rate Limited? → YES → Block (15min)
    │                   → NO  ↓
    │
    ├─ OTP Pending? → YES → "Check your messages"
    │               → NO  ↓
    │
    ├─ Valid Credentials? → NO → Log & Return Error
    │                     → YES ↓
    │
    ├─ Calculate Risk Score (0-100+ points)
    │   ├─ New Device: +40
    │   ├─ New Location: +0 to +25
    │   ├─ VPN/Proxy: +15
    │   └─ Unusual Time: +10
    │
    └─ Risk Score < 30? → YES → Login Success
                        → NO  → Send OTP
                                     │
                                     ├─ Valid OTP? → YES → Login Success
                                     │             → NO → Retry/Block
                                     │
                                     └─ Need Resend? → Generate New OTP
```


## Risk Scoring System

### Device Trust Assessment

| Condition | Risk Points | Description |
|-----------|-------------|-------------|
| Known Device | +0 | Device fingerprint exists in `login_devices` table |
| New Device | +40 | First time seeing this device fingerprint |

### Location Analysis

| Condition | Risk Points | Description |
|-----------|-------------|-------------|
| Same Country | +0 | Login from same country as last login |
| New Country | +25 | Login from different country |
| New Region | +15 | Same country, different region |
| New City | +5 | Same region, different city |

### VPN/Proxy Detection

| Condition | Risk Points | Description |
|-----------|-------------|-------------|
| Residential IP | +0 | Normal residential or business IP |
| VPN/Proxy | +15 | Detected VPN, proxy, or hosting provider IP |

### Time Pattern Analysis

| Condition | Risk Points | Description |
|-----------|-------------|-------------|
| Normal Hours | +0 | Login during user's typical hours |
| Unusual Pattern | +10 | Login outside normal time patterns |

## Security Configuration

### Rate Limiting
- **Max Attempts**: 10 failed attempts per IP address
- **Time Window**: 1 hour (3600 seconds)
- **Lockout Duration**: 15 minutes (900 seconds)

### OTP Configuration
- **Expiration**: 10 minutes
- **Max Attempts**: 3 verification attempts
- **Delivery**: SMS preferred, Email fallback

### Risk Thresholds
- **Low Risk**: Score < 30 → Direct login
- **High Risk**: Score ≥ 30 → OTP verification required

## Database Schema

### login_devices
Tracks known devices for each user:
```sql
- id (uuid)
- user_id (uuid, FK to users)
- device_fingerprint (string, unique identifier)
- is_trusted (boolean)
- last_login (timestamp)
- last_verified_at (timestamp)
- created_at (timestamp)
- updated_at (timestamp)
```

### login_events
Logs all login attempts for analysis:
```sql
- id (uuid)
- user_id (uuid, FK to users)
- device_id (uuid, FK to login_devices)
- ip_address (string)
- country (string)
- region (string)
- city (string)
- login_time (timestamp)
- user_agent (text)
- success (boolean)
- created_at (timestamp)
- updated_at (timestamp)
```

### ip_country_bans
Manages blocked countries/IPs:
```sql
- id (uuid)
- type (enum: 'ip', 'country')
- value (string)
- reason (text)
- created_at (timestamp)
- updated_at (timestamp)
```

## Redis Data Structure

### Rate Limiting
```
Key: login_security:attempts:{ip_address}
Type: List
Value: [timestamp1, timestamp2, ...]
TTL: 3600 seconds (1 hour)
```

### IP Lockouts
```
Key: login_security:lockout:{ip_address}
Type: String
Value: lockout_expiry_timestamp
TTL: 900 seconds (15 minutes)
```

### OTP Sessions
```
Key: login_otp:{ip_address}:{fingerprint}
Type: String
Value: JSON{code, user_id, expiration, attempts}
TTL: 600 seconds (10 minutes)
```

## API Endpoints

### POST /auth/login
**Request Headers:**
- `X-Forwarded-For`: Client IP address
- `X-Fingerprint`: Device fingerprint

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

**Response (Low Risk):**
```json
{
  "message": "Login successful",
  "credentials": {
    "access_token": "jwt_token",
    "refresh_token": "refresh_token",
    "expiration": "2024-01-01T12:00:00Z"
  },
  "user": { ... }
}
```

**Response (High Risk):**
```json
{
  "message": "Verification required",
  "requiresOtp": true,
  "otpMessage": "Code sent to ******1234",
  "userId": "user_uuid",
  "reasons": ["New device detected", "Login from different country"]
}
```

### POST /auth/verify-otp
**Request Body:**
```json
{
  "userId": "user_uuid",
  "otp": "123456"
}
```

### POST /auth/resend-otp
**Request Body:**
```json
{
  "userId": "user_uuid"
}
```

## Security Features

### Country/IP Blocking
- Configurable country-level restrictions
- IP-based blocking for known threats
- Graceful fallback on service errors

### Device Tracking
- Unique device fingerprinting
- Trust establishment over time
- Sumsub integration for device verification

### Security Notifications
- High-risk login email alerts
- OTP delivery via SMS/Email
- Failed attempt monitoring

### Audit Logging
- All login attempts logged
- Risk score calculation details
- Security event tracking

## Environment Configuration

All security parameters are configurable via environment variables:

```bash
LOGIN_SECURITY_CONFIG_MAX_ATTEMPTS=10
LOGIN_SECURITY_CONFIG_WINDOW_SECONDS=3600
LOGIN_SECURITY_CONFIG_LOCKOUT_DURATION_SECONDS=900
LOGIN_SECURITY_CONFIG_SMS_OTP_THRESHOLD=30
LOGIN_SECURITY_CONFIG_OTP_EXPIRATION_MINUTES=10
LOGIN_SECURITY_CONFIG_OTP_MAX_ATTEMPTS=3
LOGIN_SECURITY_CONFIG_RISK_SCORE_NEW_DEVICE=40
LOGIN_SECURITY_CONFIG_RISK_SCORE_COUNTRY_CHANGE=25
LOGIN_SECURITY_CONFIG_RISK_SCORE_REGION_CHANGE=15
LOGIN_SECURITY_CONFIG_RISK_SCORE_CITY_CHANGE=5
LOGIN_SECURITY_CONFIG_RISK_SCORE_VPN_USAGE=15
```

## Security Best Practices

1. **Progressive Enhancement**: Start with low friction, add security based on risk
2. **User Experience**: Clear messaging about security reasons
3. **Fail-Safe**: Allow access on system errors to avoid lockouts
4. **Monitoring**: Comprehensive logging for security analysis
5. **Compliance**: Audit trails for regulatory requirements

## Integration Points

- **KYC Provider (Sumsub)**: IP geolocation and device verification
- **SMS Service**: OTP delivery
- **Email Service**: Security notifications and email OTP
- **Redis**: Session state and rate limiting
- **PostgreSQL**: Persistent security data
