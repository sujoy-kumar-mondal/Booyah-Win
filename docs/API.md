# Booyah Win API Reference

This reference is generated from the real codebase, Zod validation schemas, Express routers, and integration tests.

---

## 1. Global Conventions

### 1.1 Response Envelope
All API responses follow a standard envelope:
- **Success (HTTP 200/201)**:
  ```json
  {
    "data": { ... }
  }
  ```
- **Error (HTTP 4xx/5xx)**:
  ```json
  {
    "error": {
      "code": "ERROR_CODE_STRING",
      "message": "Human readable message",
      "details": { ... }
    }
  }
  ```

### 1.2 Money Representation
- Database storage: `NUMERIC(12,2)`.
- Internal logic: Strict integer paise (no JavaScript floating-point numbers).
- JSON representation: Decimal strings with exactly two decimal places (e.g. `"10.00"`, `"25.50"`, `"0.00"`).

### 1.3 Identifiers & Display IDs
- Primary keys: Integer strings (e.g. `"123"`).
- Display identifiers: Human-readable prefixed IDs:
  - Transactions: `BW-TXN-<id>`
  - Deposits: `BW-DEP-<id>`
  - Withdrawals: `BW-WTH-<id>`
  - Matches: `BW-MAT-<id>`

### 1.4 Cursor Pagination
List endpoints with pagination return cursor parameters:
```json
{
  "data": {
    "items": [ ... ],
    "nextCursor": "42",
    "hasMore": true
  }
}
```

### 1.5 Master Error Codes
`UNAUTHENTICATED`, `SESSION_REPLACED`, `FORBIDDEN`, `ADMIN_APPROVAL_REQUIRED`, `ADMINS_APPROVE_DIRECTLY`, `VALIDATION_ERROR`, `INVALID_OTP`, `OTP_RATE_LIMITED`, `EMAIL_EXISTS`, `MOBILE_EXISTS`, `FF_ID_EXISTS`, `UPI_EXISTS`, `INVALID_REFERRAL`, `FIELD_COOLDOWN`, `IN_ACTIVE_MATCH`, `LOW_BALANCE`, `UTR_EXISTS`, `DEPOSIT_LIMIT`, `WITHDRAWAL_PENDING`, `UPI_RECENTLY_CHANGED`, `MATCH_FULL`, `ALREADY_JOINED`, `MATCH_NOT_JOINABLE`, `TEAM_INVALID`, `INVITE_EXPIRED`, `RESULT_INVALID`, `RESULT_LOCKED`, `NOT_FOUND`, `RATE_LIMITED`, `INTERNAL_ERROR`, `INVALID_TRANSITION`, `DATABASE_BUSY`, `MAINTENANCE_MODE`.

---

## 2. Deviations & Clarifications vs `BOOYAH_WIN_SPEC.md`
1. **Setting Key `payment_qr_key`**: Added to manage the storage key for the payment QR image. `PATCH /admin/settings` rejects modification of `payment_qr_key`; it is updated exclusively through `POST /admin/settings/payment-qr`.
2. **Error Code `INVALID_TRANSITION`**: Used for invalid state transitions on matches (e.g. cancelling an already live or completed match).
3. **Error Code `DATABASE_BUSY`**: Used for retryable database locks (PostgreSQL `55P03`) and statement query timeouts (`57014`), returning HTTP 503.
4. **Position Ordinal Formatting**: Positions beyond 3rd use English ordinals (`4th`, `11th`, `12th`, `13th`, `21st`, `22nd`, etc.) rather than generic numbers.
5. **Session Pooler Port**: Production strictly requires Supabase session pooler on port 5432 and rejects transaction pooler on port 6543.

---

## 3. Endpoints Catalog

### Group 1: Public & System Endpoints
> **Verified against**: `apps/api/tests/deployment_readiness.test.ts`, `apps/api/tests/settings_and_public.test.ts`, `apps/api/tests/security.test.ts`
> Untested endpoints: **None**

#### `GET /health`
- **Auth**: None
- **Rate Limit**: Dedicated health check rate limit (120 req/min)
- **Description**: Verifies API availability and database connectivity via `SELECT 1`. Returns zero secrets or connection strings.
- **Success Response (200)**:
  ```json
  {
    "status": "ok",
    "database": "connected",
    "timestamp": "2026-10-10T12:00:00.000Z"
  }
  ```
- **Error Responses**:
  - `503`: `{ "status": "error", "database": "disconnected", "timestamp": "..." }`
  - `429 RATE_LIMITED`: Exceeded dedicated health rate limit.

#### `GET /api/v1/status`
- **Auth**: None
- **Rate Limit**: Dedicated status rate limit (60 req/min)
- **Description**: Public endpoint returning maintenance mode status and server timestamp. Includes cache prevention headers (`Cache-Control: no-store, no-cache, must-revalidate, proxy-revalidate`, `Pragma: no-cache`, `Expires: 0`). When database is disconnected, safely returns HTTP 200 with `maintenance_enabled: false`, `unknown: true`.
- **Success Response (200)**:
  ```json
  {
    "data": {
      "maintenance_enabled": false,
      "maintenance_message": "",
      "maintenance_until": null,
      "unknown": false,
      "server_time": "2026-10-13T10:19:39.466Z"
    }
  }
  ```
- **Error Responses**:
  - `429 RATE_LIMITED`: Exceeded dedicated status rate limit.

#### `GET /api/v1/support`
- **Auth**: None
- **Rate Limit**: Global (100 req/min)
- **Description**: Retrieves public support contact details.
- **Success Response (200)**:
  ```json
  {
    "data": {
      "support_email": "support@booyahwin.com",
      "support_whatsapp": "+919876543210"
    }
  }
  ```

#### `GET /api/v1/payment-info`
- **Auth**: None
- **Rate Limit**: Global (100 req/min)
- **Description**: Returns UPI ID, payment QR signed URL, and deposit limits for manual deposits.
- **Success Response (200)**:
  - When configured:
    ```json
    {
      "data": {
        "configured": true,
        "paymentUpiId": "merchant@okhdfcbank",
        "paymentQrUrl": "https://storage.../payment_qr.png?token=...",
        "qrUrl": "https://storage.../payment_qr.png?token=...",
        "minDeposit": "10.00",
        "maxDeposit": "5000.00"
      }
    }
    ```
  - When not configured:
    ```json
    {
      "data": {
        "configured": false,
        "message": "Payment information not configured yet",
        "paymentUpiId": null,
        "paymentQrUrl": null,
        "qrUrl": null,
        "minDeposit": "10.00",
        "maxDeposit": "5000.00"
      }
    }
    ```

#### `GET /api/v1/leaderboard`
- **Auth**: None (Public)
- **Rate Limit**: 60 req/min
- **Description**: Returns top 50 match winners for the current IST week window (Monday 00:00:00 to Sunday 23:59:59 IST). Single-flight 60s server cache invalidated on match result approval, reversal, and user deletion. Only public in-game name (`name`) is exposed; zero private information.
- **Success Response (200)**:
  ```json
  {
    "data": {
      "weekStart": "2026-10-11T18:30:00.000Z",
      "weekEnd": "2026-10-18T18:29:59.000Z",
      "generatedAt": "2026-10-13T13:39:20.037Z",
      "entries": [
        {
          "rank": 1,
          "name": "ProPlayer1",
          "winnings": "250.00"
        }
      ]
    }
  }
  ```

#### `GET /api/v1/rules`
- **Auth**: None (Public)
- **Rate Limit**: 60 req/min
- **Description**: Returns operational game and economy rules (referral bonus amount, cashback entry fee cap percentage, minimum withdrawal amount) read directly from single-source server configuration.
- **Success Response (200)**:
  ```json
  {
    "data": {
      "referralReward": "5.00",
      "maxCashbackUsagePercent": 5,
      "minWithdrawal": "50.00"
    }
  }
  ```

#### `GET /api/v1/files/:key`
- **Auth**: HMAC signed URL (`token` and `expires` query parameters)
- **Rate Limit**: Global (100 req/min)
- **Description**: Serves local files in development/test modes.
- **Query Parameters**:
  - `token`: Hex-encoded HMAC-SHA256 signature
  - `expires`: Unix epoch millisecond timestamp
- **Error Responses**:
  - `403 FORBIDDEN`: Missing, invalid, or expired signature.
  - `404 NOT_FOUND`: File key does not exist or invalid format.

#### `GET /api/v1/status`
- **Auth**: None
- **Rate Limit**: Dedicated status rate limit (60 req/min per IP)
- **Headers**:
  - `Cache-Control`: `no-store`
- **Description**: Returns current maintenance status. Always responds with 200 even if database connection fails (`unknown: true`). Polling clients should respect `Retry-After` on 429.
- **Success Response (200)**:
  ```json
  {
    "data": {
      "maintenance": {
        "enabled": false,
        "message": "Under scheduled maintenance. Please check back shortly.",
        "until": null
      }
    }
  }
  ```
- **Fallback Response when DB unreachable (200)**:
  ```json
  {
    "data": {
      "maintenance": {
        "enabled": false,
        "message": "Status temporarily unavailable",
        "until": null,
        "unknown": true
      }
    }
  }
  ```
- **Error Responses**:
  - `429 RATE_LIMITED`: Exceeded 60 req/min status limit. Returns `Retry-After` header.

---

### Group 2: User Authentication
> **Verified against**: `apps/api/tests/auth.test.ts`
> Untested endpoints: **None**

#### `POST /api/v1/auth/register/request-otp`
- **Auth**: None
- **Rate Limit**: 20 req/hour per IP (Section 5.1)
- **Request Body**:
  ```json
  {
    "email": "player@example.com"
  }
  ```
- **Success Response (200)**:
  ```json
  {
    "data": {
      "message": "OTP sent successfully"
    }
  }
  ```
- **Error Codes**: `VALIDATION_ERROR`, `OTP_RATE_LIMITED`

#### `POST /api/v1/auth/register/verify-otp`
- **Auth**: None
- **Rate Limit**: Maximum 5 attempts per OTP code
- **Request Body**:
  ```json
  {
    "email": "player@example.com",
    "otp": "123456"
  }
  ```
- **Success Response (200)**:
  ```json
  {
    "data": {
      "registrationToken": "eyJhbGciOi..."
    }
  }
  ```
- **Error Codes**: `VALIDATION_ERROR`, `INVALID_OTP`

#### `POST /api/v1/auth/register/complete`
- **Auth**: None (Requires `registrationToken` in body)
- **Rate Limit**: 10 req/min per IP (SEC-02)
- **Request Body**:
  ```json
  {
    "registrationToken": "eyJhbGciOi...",
    "name": "Player One",
    "mobile": "9876543210",
    "ffId": "11223344",
    "ffName": "ProKiller",
    "upiId": "player@upi",
    "dateOfBirth": "2000-01-01",
    "referralCode": "REF456",
    "confirm18Plus": true
  }
  ```
- **Validation**: Age must be 18+; mobile 10 digits; valid UPI ID format; valid Free Fire ID.
- **Success Response (201)**:
  ```json
  {
    "data": {
      "token": "eyJhbGciOi...",
      "user": { ... }
    }
  }
  ```
- **Error Codes**: `VALIDATION_ERROR`, `MOBILE_EXISTS`, `FF_ID_EXISTS`, `UPI_EXISTS`, `INVALID_REFERRAL`, `RATE_LIMITED`

#### `POST /api/v1/auth/login/request-otp`
- **Auth**: None
- **Rate Limit**: 20 req/hour per IP (Section 5.1)
- **Request Body**:
  ```json
  {
    "email": "player@example.com"
  }
  ```
- **Success Response (200)**:
  ```json
  {
    "data": {
      "message": "OTP sent successfully"
    }
  }
  ```
- **Error Codes**: `VALIDATION_ERROR`, `OTP_RATE_LIMITED`

#### `POST /api/v1/auth/login/verify-otp`
- **Auth**: None
- **Rate Limit**: Maximum 5 attempts per OTP code
- **Request Body**:
  ```json
  {
    "email": "player@example.com",
    "otp": "123456"
  }
  ```
- **Success Response (200)**:
  ```json
  {
    "data": {
      "token": "eyJhbGciOi...",
      "user": {
        "id": "1",
        "email": "player@example.com",
        "name": "Player One",
        "mobile": "9876543210",
        "ffId": "11223344",
        "ffName": "ProKiller",
        "upiId": "player@upi",
        "referralCode": "BOOYAH123",
        "dateOfBirth": "2000-01-01"
      }
    }
  }
  ```
- **Error Codes**: `VALIDATION_ERROR`, `INVALID_OTP`

#### `POST /api/v1/auth/logout`
- **Auth**: `requireUser`
- **Success Response (200)**:
  ```json
  {
    "data": {
      "message": "Logged out successfully"
    }
  }
  ```
- **Error Codes**: `UNAUTHENTICATED`, `SESSION_REPLACED`

---

### Group 3: Staff Authentication
> **Verified against**: `apps/api/tests/auth.test.ts`
> Untested endpoints: **None**

#### `POST /api/v1/staff/auth/login/request-otp`
- **Auth**: None
- **Rate Limit**: 20 req/hour per IP (Section 5.1)
- **Request Body**:
  ```json
  {
    "email": "employee@booyahwin.com"
  }
  ```
- **Success Response (200)**:
  ```json
  {
    "data": {
      "message": "If this email is registered, an OTP has been sent"
    }
  }
  ```
- **Error Codes**: `VALIDATION_ERROR`, `OTP_RATE_LIMITED`

#### `POST /api/v1/staff/auth/login/verify-otp`
- **Auth**: None
- **Request Body**:
  ```json
  {
    "email": "employee@booyahwin.com",
    "otp": "654321"
  }
  ```
- **Success Response (200)**:
  ```json
  {
    "data": {
      "token": "eyJhbGciOi...",
      "staff": {
        "id": "1",
        "role": "employee",
        "name": "Jane Employee",
        "email": "employee@booyahwin.com",
        "mobile": "9998887776"
      }
    }
  }
  ```
- **Error Codes**: `VALIDATION_ERROR`, `INVALID_OTP`

#### `POST /api/v1/staff/auth/logout`
- **Auth**: `requireStaff`
- **Success Response (200)**:
  ```json
  {
    "data": {
      "message": "Logged out successfully"
    }
  }
  ```
- **Error Codes**: `UNAUTHENTICATED`, `SESSION_REPLACED`

---

### Group 4: Player Profile & Match History
> **Verified against**: `apps/api/tests/profile_and_admin_management.test.ts`, `apps/api/tests/teams_and_scheduler.test.ts`
> Untested endpoints: **None**

#### `GET /api/v1/me` (and `GET /api/v1/users/me`)
- **Auth**: `requireUser`
- **Success Response (200)**:
  ```json
  {
    "data": {
      "profile": {
        "id": "1",
        "email": "player@example.com",
        "name": "Player One",
        "mobile": "9876543210",
        "ffId": "11223344",
        "ffName": "ProKiller",
        "upiId": "player@upi",
        "dateOfBirth": "2000-01-01",
        "referralCode": "BOOYAH123",
        "referredBy": null,
        "createdAt": "2026-10-01T00:00:00.000Z"
      },
      "wallets": {
        "addMoney": "150.00",
        "cashback": "20.00",
        "winning": "300.00",
        "total": "470.00"
      },
      "cooldowns": {
        "mobileAvailableAt": null,
        "ffIdAvailableAt": null,
        "ffNameAvailableAt": null,
        "upiIdAvailableAt": null
      }
    }
  }
  ```
- **Error Codes**: `UNAUTHENTICATED`, `SESSION_REPLACED`

#### `PATCH /api/v1/me/profile` (and `PATCH /api/v1/users/me/profile`, `PATCH /api/v1/profile`, `PATCH /api/v1/users/profile`)
- **Auth**: `requireUser`
- **Rate Limit**: 10 req/min per user
- **Request Body** (at least one field required):
  ```json
  {
    "mobile": "9876543211",
    "ffId": "99887766",
    "ffName": "NewFFName",
    "upiId": "newupi@upi"
  }
  ```
- **Validation**: 30-day cooldown enforced per field. UPI change blocks withdrawals for 48 hours. `name` and `email` are non-editable.
- **Success Response (200)**:
  ```json
  {
    "data": {
      "profile": { ... },
      "wallets": { ... },
      "cooldowns": { ... }
    }
  }
  ```
- **Error Codes**: `VALIDATION_ERROR`, `FIELD_COOLDOWN`, `MOBILE_EXISTS`, `FF_ID_EXISTS`, `UPI_EXISTS`

#### `GET /api/v1/me/match-history` (and `GET /api/v1/users/me/match-history`, `GET /api/v1/match-history`, `GET /api/v1/users/match-history`)
- **Auth**: `requireUser`
- **Query Parameters**:
  - `cursor`: string (optional)
  - `limit`: number between 1 and 50 (default: 20)
  - `gameMode`: `'battle_royale' | 'clash_squad'` (optional)
  - `teamMode`: `'solo' | 'duo' | 'squad'` (optional)
- **Success Response (200)**:
  ```json
  {
    "data": {
      "items": [
        {
          "matchId": "20",
          "gameMode": "battle_royale",
          "teamMode": "solo",
          "entryFee": "20.00",
          "startTime": "2026-11-05T12:00:00.000Z",
          "matchStatus": "completed",
          "joinedAt": "2026-10-11T17:12:34.863Z",
          "refundedAt": null,
          "kills": 0,
          "position": null,
          "payout": "0.00",
          "displayStatus": "Lost",
          "positionLabel": "Lost"
        }
      ],
      "nextCursor": null,
      "hasMore": false
    }
  }
  ```

#### `GET /api/v1/me/team-invites` (and `GET /api/v1/users/me/team-invites`)
- **Auth**: `requireUser`
- **Success Response (200)**:
  ```json
  {
    "data": {
      "invites": [
        {
          "id": "1",
          "teamId": "3",
          "teamName": "Bravo Team",
          "teamSize": 2,
          "leaderId": "1",
          "leaderName": "Player One",
          "leaderFfId": "12345678",
          "matchId": "13",
          "gameMode": "battle_royale",
          "teamMode": "duo",
          "entryFee": "20.00",
          "startTime": "2026-12-11T12:00:00.000Z",
          "matchStatus": "upcoming",
          "invitedUserId": "2",
          "status": "pending",
          "createdAt": "2026-10-11T17:12:34.779Z",
          "respondedAt": null
        }
      ]
    }
  }
  ```

#### `GET /api/v1/me/leaderboard-rank` (and `GET /api/v1/users/me/leaderboard-rank`)
- **Auth**: `requireUser`
- **Rate Limit**: 60 req/min
- **Description**: Returns the authenticated user's own rank and match winnings for the current IST week window (also when outside top 50), or `null` if the user has no match winnings in the current week window.
- **Success Response (200)**:
  - When user has winnings:
    ```json
    {
      "data": {
        "rank": 1,
        "winnings": "250.00"
      }
    }
    ```
  - When user has no winnings:
    ```json
    {
      "data": null
    }
    ```

#### `GET /api/v1/me/referral-summary` (and `GET /api/v1/users/me/referral-summary`)
- **Auth**: `requireUser`
- **Rate Limit**: 60 req/min
- **Description**: Returns summary counts of the authenticated user's referral performance: `referredCount` (number of registered referrals), `bonusEarnedCount` (number of referrals credited), and `totalBonusEarned` (sum from wallet ledger). Strictly preserves privacy: zero personal details (names, emails, mobiles) of referred users are exposed.
- **Success Response (200)**:
  ```json
  {
    "data": {
      "referralCode": "BOOYAH123",
      "referredCount": 5,
      "bonusEarnedCount": 2,
      "totalBonusEarned": "10.00"
    }
  }
  ```

---

### Group 5: Wallet & Transactions
> **Verified against**: `apps/api/tests/wallet.test.ts`
> Untested endpoints: **None**

#### `POST /api/v1/wallet/deposits`
- **Auth**: `requireUser`
- **Content-Type**: `multipart/form-data`
- **Rate Limit**: 10 req/min per user
- **Form Fields**:
  - `amount`: string (e.g. `"100.00"`)
  - `utr`: string (10-25 alphanumeric characters, Section 4.5)
  - `screenshot`: file (image/jpeg, image/png, image/webp; max 2 MB)
- **Success Response (201)**:
  ```json
  {
    "data": {
      "id": "1",
      "amount": "100.00",
      "utr": "123456789012",
      "screenshotUrl": "/api/v1/files/...",
      "status": "pending",
      "rejectReason": null,
      "needsAdmin": false,
      "createdAt": "2026-10-10T12:00:00.000Z",
      "reviewedAt": null
    }
  }
  ```
- **Error Codes**: `VALIDATION_ERROR`, `UTR_EXISTS`, `DEPOSIT_LIMIT`, `RATE_LIMITED`

#### `GET /api/v1/wallet/deposits`
- **Auth**: `requireUser`
- **Query Parameters**:
  - `cursor`: string (optional, deposit ID)
  - `limit`: number between 1 and 100 (default: 20)
- **Success Response (200)**:
  ```json
  {
    "data": {
      "items": [
        {
          "id": "1",
          "amount": "100.00",
          "utr": "123456789012",
          "screenshotUrl": "/api/v1/files/...",
          "status": "pending",
          "rejectReason": null,
          "needsAdmin": false,
          "createdAt": "2026-10-10T12:00:00.000Z",
          "reviewedAt": null
        }
      ],
      "nextCursor": null
    }
  }
  ```
- **Notes**: `status` is `'pending' | 'employee_approved' | 'approved' | 'rejected'`. Staff identities are never exposed to players.

#### `POST /api/v1/wallet/withdrawals`
- **Auth**: `requireUser`
- **Rate Limit**: 10 req/min per user
- **Request Body**:
  ```json
  {
    "amount": "150.00",
    "upiId": "player@upi",
    "confirm": true
  }
  ```
- **Validation**: Minimum ₹50.00; must not exceed `winning` balance; user cannot have another pending withdrawal; blocked for 48 hours after UPI change.
- **Success Response (201)**:
  ```json
  {
    "data": {
      "id": "1",
      "amount": "150.00",
      "upiId": "player@upi",
      "status": "pending",
      "rejectReason": null,
      "payoutRef": null,
      "createdAt": "2026-10-10T12:00:00.000Z",
      "processedAt": null
    }
  }
  ```
- **Error Codes**: `VALIDATION_ERROR`, `LOW_BALANCE`, `WITHDRAWAL_PENDING`, `UPI_RECENTLY_CHANGED`, `RATE_LIMITED`

#### `GET /api/v1/wallet/withdrawals`
- **Auth**: `requireUser`
- **Query Parameters**:
  - `cursor`: string (optional, withdrawal ID)
  - `limit`: number between 1 and 100 (default: 20)
- **Success Response (200)**:
  ```json
  {
    "data": {
      "items": [
        {
          "id": "1",
          "amount": "150.00",
          "upiId": "player@upi",
          "status": "pending",
          "rejectReason": null,
          "payoutRef": null,
          "createdAt": "2026-10-10T12:00:00.000Z",
          "processedAt": null
        }
      ],
      "nextCursor": null
    }
  }
  ```
- **Notes**: `status` is `'pending' | 'employee_approved' | 'paid' | 'rejected'`. Staff identities are never exposed to players.

#### `GET /api/v1/wallet/transactions`
- **Auth**: `requireUser`
- **Query Parameters**:
  - `cursor`: string (optional, ledger ID)
  - `limit`: number between 1 and 100 (default: 20)
  - `type`: filter key (`add_money`, `referral`, `withdrawal`, `join_fee`, `winning`, `refund`)
- **Success Response (200)**:
  ```json
  {
    "data": {
      "items": [
        {
          "transactionId": "BW-0000010",
          "type": "winning",
          "createdAt": "2026-10-10T15:30:00.000Z",
          "amount": "150.00",
          "remainingAmount": "450.00",
          "wallet": "winning",
          "refType": "match",
          "refId": "1"
        }
      ],
      "nextCursor": null
    }
  }
  ```

---

### Group 6: Matches & Teams
> **Verified against**: `apps/api/tests/matches.test.ts`, `apps/api/tests/teams_and_scheduler.test.ts`
> Untested endpoints: **None**

#### `GET /api/v1/matches`
- **Auth**: `requireUser`
- **Success Response (200)**:
  ```json
  {
    "data": {
      "matches": [
        {
          "id": "2",
          "gameMode": "battle_royale",
          "teamMode": "duo",
          "entryFee": "20.00",
          "prizes": {
            "positions": {
              "1": "300.00"
            },
            "killPrice": "10.00",
            "minKillsForReward": 1
          },
          "joinedPlayers": 1,
          "seatsTaken": 2,
          "maxPlayers": 48,
          "minPlayers": 2,
          "startTime": "2026-12-01T16:00:00.000Z",
          "status": "live",
          "hasJoined": true,
          "isInTeam": true,
          "roomId": "887766",
          "roomPassword": "test-room-password"
        }
      ]
    }
  }
  ```

#### `GET /api/v1/matches/:id`
- **Auth**: `requireUser`
- **Description**: Returns match details. If joined and status is `room_open` or `live`, reveals `roomId` and `roomPassword`.
- **Success Response (200)**:
  ```json
  {
    "data": {
      "match": {
        "id": "2",
        "gameMode": "battle_royale",
        "teamMode": "duo",
        "entryFee": "20.00",
        "prizes": {
          "positions": {
            "1": "300.00"
          },
          "killPrice": "10.00",
          "minKillsForReward": 1
        },
        "joinedPlayers": 1,
        "seatsTaken": 2,
        "maxPlayers": 48,
        "minPlayers": 2,
        "startTime": "2026-12-01T16:00:00.000Z",
        "status": "live",
        "hasJoined": true,
        "isInTeam": true,
        "roomId": "887766",
        "roomPassword": "test-room-password"
      }
    }
  }
  ```
- **Error Codes**: `NOT_FOUND`

#### `POST /api/v1/matches/:id/join` (Solo join)
- **Auth**: `requireUser`
- **Rate Limit**: 10 req/min per user
- **Success Response (200)**:
  ```json
  {
    "data": {
      "message": "Successfully joined match",
      "matchId": "8",
      "joinedAt": "2026-10-11T16:26:06.254Z"
    }
  }
  ```
- **Error Codes**: `MATCH_NOT_JOINABLE`, `MATCH_FULL`, `ALREADY_JOINED`, `LOW_BALANCE`, `IN_ACTIVE_MATCH`

#### `POST /api/v1/matches/:id/teams` (Create team)
- **Auth**: `requireUser`
- **Rate Limit**: 10 req/min per user
- **Request Body**:
  ```json
  {
    "teamName": "Bravo Team",
    "memberFfIds": ["87654321"]
  }
  ```
- **Success Response (201)**:
  ```json
  {
    "data": {
      "team": {
        "id": "3",
        "matchId": "9",
        "leaderId": "1",
        "name": "Bravo Team",
        "size": 2,
        "status": "forming",
        "createdAt": "2026-10-11T16:26:06.275Z",
        "members": [
          {
            "userId": "1",
            "freeFireId": "12345678",
            "name": "",
            "role": "leader",
            "status": "confirmed"
          },
          {
            "userId": "2",
            "freeFireId": "87654321",
            "name": "Player Two",
            "role": "member",
            "status": "pending"
          }
        ]
      }
    }
  }
  ```
- **Error Codes**: `VALIDATION_ERROR`, `MATCH_NOT_JOINABLE`, `MATCH_FULL`, `TEAM_INVALID`, `LOW_BALANCE`, `ALREADY_JOINED`

#### `POST /api/v1/matches/:id/teams/mine/replace`
- **Auth**: `requireUser` (Team Leader)
- **Rate Limit**: 10 req/min per user (SEC-04)
- **Request Body**:
  ```json
  {
    "oldFfId": "87654321",
    "newFfId": "55667788"
  }
  ```
- **Success Response (200)**:
  ```json
  {
    "data": {
      "message": "Invite replaced successfully"
    }
  }
  ```
- **Error Codes**: `VALIDATION_ERROR`, `MATCH_NOT_JOINABLE`, `TEAM_INVALID`, `NOT_FOUND`

#### `DELETE /api/v1/matches/:id/teams/mine`
- **Auth**: `requireUser` (Team Leader)
- **Rate Limit**: 10 req/min per user (SEC-04)
- **Success Response (200)**:
  ```json
  {
    "data": {
      "message": "Team disbanded and members refunded"
    }
  }
  ```
- **Error Codes**: `MATCH_NOT_JOINABLE`, `NOT_FOUND`

#### `POST /api/v1/team-invites/:id/accept`
- **Auth**: `requireUser`
- **Rate Limit**: 10 req/min per user (SEC-04)
- **Success Response (200)**:
  ```json
  {
    "data": {
      "message": "Team invite accepted successfully"
    }
  }
  ```
- **Error Codes**: `NOT_FOUND` (identical 404 for non-existent invite or another user's invite), `INVITE_EXPIRED`, `MATCH_NOT_JOINABLE`, `LOW_BALANCE`, `ALREADY_JOINED`

#### `POST /api/v1/team-invites/:id/decline`
- **Auth**: `requireUser`
- **Rate Limit**: 10 req/min per user (SEC-04)
- **Success Response (200)**:
  ```json
  {
    "data": {
      "message": "Team invite declined"
    }
  }
#### `GET /api/v1/support`
- **Auth**: None (Public)
- **Description**: Returns shared support contact details from system settings.
- **Success Response (200)**:
  ```json
  {
    "data": {
      "supportName": "Booyah Win Support",
      "supportPhone": "+91 9999999999",
      "supportEmail": "support@booyahwin.com",
      "supportHours": "10:00 AM - 10:00 PM IST"
    }
  }
  ```

---

### Group 7: Internal Jobs (Cron)
> **Verified against**: `apps/api/tests/teams_and_scheduler.test.ts`
> Untested endpoints: **None**

#### `POST /internal/jobs/tick` (and `POST /api/v1/internal/jobs/tick`)
- **Auth**: Header `x-cron-secret` matching `CRON_SECRET` (timing-safe)
- **Description**: Idempotent background scheduler executed every 5 minutes.
- **Success Response (200)**:
  ```json
  {
    "data": {
      "deletedOtpsCount": 5,
      "disbandedTeamsCount": 1,
      "cancelledMatchesCount": 0,
      "expiredInvitesCount": 3,
      "timestamp": "2026-10-10T12:05:00.000Z"
    }
  }
  ```
- **Error Codes**: `UNAUTHENTICATED` (401)

---

### Group 8: Staff Management
> **Verified against**: `apps/api/tests/auth.test.ts`, `apps/api/tests/matches.test.ts`, `apps/api/tests/results_and_payouts.test.ts`, `apps/api/tests/wallet.test.ts`, `apps/api/tests/profile_and_admin_management.test.ts`
> Untested endpoints: **None**

#### `GET /api/v1/staff/me`
- **Auth**: `requireStaff`
- **Success Response (200)**:
  ```json
  {
    "data": {
      "profile": {
        "id": "1",
        "role": "employee",
        "name": "Jane Employee",
        "email": "employee@booyahwin.com",
        "mobile": "9998887776"
      }
    }
  }
  ```

#### `GET /api/v1/staff/dashboard`
- **Auth**: `requireStaff`
- **Success Response (200)**:
  ```json
  {
    "data": {
      "pendingDepositsCount": 3,
      "oldestPendingDepositAgeMinutes": 35.5,
      "isOldestDepositOver30Min": true,
      "employeeApprovedDepositsCount": 1,
      "oldestEmployeeApprovedDepositAgeMinutes": 10.0,
      "isOldestEmployeeApprovedDepositOver30Min": false,
      "pendingWithdrawalsCount": 1,
      "oldestPendingWithdrawalAgeMinutes": 1500.0,
      "employeeApprovedWithdrawalsCount": 0,
      "oldestEmployeeApprovedWithdrawalAgeMinutes": null,
      "liveMatchesCount": 1,
      "upcomingMatchesCount": 5,
      "roomOpenMatchesCount": 0,
      "completedMatchesCount": 12,
      "resultsWaitingApprovalCount": 2
    }
  }
  ```

#### `GET /api/v1/staff/entry-tiers`
- **Auth**: `requireStaff`
- **Success Response (200)**:
  ```json
  {
    "data": {
      "tiers": [
        {
          "id": "1",
          "gameMode": "battle_royale",
          "teamMode": "solo",
          "entryFee": "10.00",
          "killPrice": "5.00",
          "minKillsForReward": 2,
          "maxPlayers": 48,
          "minPlayers": 24,
          "positions": [
            { "position": 1, "prize": "100.00" },
            { "position": 2, "prize": "60.00" },
            { "position": 3, "prize": "40.00" }
          ],
          "createdAt": "2026-10-10T12:00:00.000Z"
        }
      ]
    }
  }
  ```

#### `POST /api/v1/staff/matches`
- **Auth**: `requireStaff`
- **Rate Limit**: 30 req/min per staff user (Requirement 4)
- **Request Body**:
  ```json
  {
    "tierId": "1",
    "gameMode": "battle_royale",
    "teamMode": "solo",
    "startTime": "2026-10-11T18:00:00.000Z"
  }
  ```
- **Success Response (201)**:
  ```json
  {
    "data": {
      "id": "2",
      "displayId": "BW-MAT-2",
      "status": "upcoming"
    }
  }
  ```
- **Error Codes**: `VALIDATION_ERROR`, `NOT_FOUND`

#### `GET /api/v1/staff/matches`
- **Auth**: `requireStaff`
- **Query Parameters**:
  - `status`: string
  - `cursor`: string
  - `limit`: number
- **Success Response (200)**:
  ```json
  {
    "data": {
      "items": [ ... ],
      "nextCursor": null,
      "hasMore": false
    }
  }
  ```

#### `GET /api/v1/staff/matches/:id`
- **Auth**: `requireStaff`
- **Success Response (200)**:
  ```json
  {
    "data": {
      "match": {
        "id": "2",
        "tierId": "1",
        "gameMode": "battle_royale",
        "teamMode": "duo",
        "entryFee": "10.00",
        "killPrice": "5.00",
        "minKillsForReward": 2,
        "positionPrizes": {
          "1": "50.00",
          "2": "40.00"
        },
        "maxPlayers": 48,
        "minPlayers": 24,
        "startTime": "2026-10-15T16:00:00.000Z",
        "roomId": "ROOM-12345",
        "roomPassword": "secretpassword",
        "status": "upcoming",
        "cancelReason": null,
        "createdBy": "1",
        "createdAt": "2026-10-10T12:00:00.000Z",
        "joinedCount": 2,
        "players": [
          {
            "userId": "10",
            "name": "Player One",
            "ffId": "111222333",
            "ffName": "BooyahKing",
            "teamId": "5",
            "paidAddMoney": "10.00",
            "paidCashback": "0.00",
            "paidWinning": "0.00",
            "refundedAt": null,
            "joinedAt": "2026-10-10T12:30:00.000Z"
          },
          {
            "userId": "11",
            "name": "Player Two",
            "ffId": "444555666",
            "ffName": "ProShooter",
            "teamId": "5",
            "paidAddMoney": "10.00",
            "paidCashback": "0.00",
            "paidWinning": "0.00",
            "refundedAt": null,
            "joinedAt": "2026-10-10T12:35:00.000Z"
          }
        ],
        "teams": [
          {
            "id": "5",
            "name": "Alpha Squad",
            "size": 2,
            "status": "confirmed",
            "leaderId": "10",
            "memberUserIds": ["10", "11"]
          }
        ]
      }
    }
  }
  ```
- **Notes**:
  - For solo matches (`teamMode: "solo"`), `teams` is an empty array (`[]`) and each player has `teamId: null`.
  - For team modes (`duo`, `squad`, `clash_squad`), `teams` contains all teams for the match (including disbanded teams).
  - `memberUserIds` contains only active (non-refunded) players in that team in joined order.
  - Clients must compare `memberUserIds.length` to `size` to check the current active seat occupancy of the team (e.g. if a member was refunded or left, `memberUserIds.length` will be shorter than `size`).
- **Error Codes**: `NOT_FOUND`, `VALIDATION_ERROR`

#### `POST /api/v1/staff/matches/:id/open-room`
- **Auth**: `requireStaff`
- **Rate Limit**: 30 req/min per staff user (Requirement 4)
- **Request Body**:
  ```json
  {
    "roomId": "123456",
    "roomPassword": "secretpass"
  }
  ```
- **Success Response (200)**:
  ```json
  {
    "data": {
      "id": "2",
      "status": "room_open"
    }
  }
  ```
- **Error Codes**: `VALIDATION_ERROR`, `INVALID_TRANSITION`, `NOT_FOUND`

#### `POST /api/v1/staff/matches/:id/go-live`
- **Auth**: `requireStaff`
- **Rate Limit**: 30 req/min per staff user (Requirement 4)
- **Success Response (200)**:
  ```json
  {
    "data": {
      "message": "Match is now live"
    }
  }
  ```
- **Error Codes**: `INVALID_TRANSITION`, `NOT_FOUND`, `VALIDATION_ERROR`

#### `POST /api/v1/staff/matches/:id/cancel`
- **Auth**: `requireStaff`
- **Rate Limit**: 30 req/min per staff user (Requirement 4)
- **Request Body**:
  ```json
  {
    "reason": "Technical issue with custom room"
  }
  ```
- **Success Response (200)**:
  ```json
  {
    "data": {
      "message": "Match cancelled and players refunded"
    }
  }
  ```
- **Error Codes**: `VALIDATION_ERROR`, `INVALID_TRANSITION`, `NOT_FOUND`

#### `POST /api/v1/staff/matches/:id/result`
- **Auth**: `requireStaff`
- **Rate Limit**: 30 req/min per staff user (Requirement 4)
- **Content-Type**: `multipart/form-data`
- **Form Fields**:
  - `entries`: JSON string containing array of `{ userId, kills, position }`
  - `screenshot`: file (max 2 MB)
- **Validation**: Staff member cannot submit result if they participated in the match.
- **Success Response (201)**:
  ```json
  {
    "data": {
      "result": {
        "id": "1",
        "matchId": "2",
        "status": "pending_approval"
      }
    }
  }
  ```
- **Error Codes**: `VALIDATION_ERROR`, `RESULT_INVALID`, `FORBIDDEN`, `INVALID_TRANSITION`, `NOT_FOUND`

#### `GET /api/v1/staff/matches/:id/result`
- **Auth**: `requireStaff`
- **Success Response (200)**:
  ```json
  {
    "data": {
      "id": "1",
      "matchId": "2",
      "entries": [
        {
          "userId": "10",
          "kills": 3,
          "position": 1
        }
      ],
      "screenshotUrl": "match-results/2/result_123.jpg",
      "signedScreenshotUrl": "http://localhost:3000/api/v1/files/match-results/2/result_123.jpg?token=...",
      "status": "pending_approval",
      "rejectReason": null,
      "submittedBy": "1",
      "approvedBy": null,
      "createdAt": "2026-10-10T16:00:00.000Z",
      "approvedAt": null
    }
  }
  ```
- **Error Codes**: `NOT_FOUND`, `VALIDATION_ERROR`

#### `GET /api/v1/staff/deposits`
- **Auth**: `requireStaff`
- **Query Parameters**:
  - `status`: `'pending' | 'employee_approved' | 'approved' | 'rejected'`
  - `cursor`: string
  - `limit`: number
- **Success Response (200)**:
  ```json
  {
    "data": {
      "items": [
        {
          "id": "1",
          "userId": "10",
          "userEmail": "player@example.com",
          "amount": "100.00",
          "utr": "123456789012",
          "screenshotUrl": "https://storage.booyah.win/uploads/s.jpg?sig=...",
          "status": "pending",
          "rejectReason": null,
          "needsAdmin": false,
          "pendingMinutes": 15,
          "createdAt": "2026-10-10T10:00:00.000Z",
          "reviewedAt": null,
          "reviewedBy": null,
          "employeeReviewedAt": null,
          "employeeReviewedBy": null
        }
      ],
      "nextCursor": null
    }
  }
  ```

#### `POST /api/v1/staff/deposits/:id/verify`
- **Auth**: `requireStaff` (Employees only; admin calling this gets 403 `ADMINS_APPROVE_DIRECTLY`)
- **Rate Limit**: 30 req/min per staff user
- **Validation**: Only pending deposits can be verified. Staff cannot verify their own deposit (`FORBIDDEN`).
- **Success Response (200)**:
  ```json
  {
    "data": {
      "message": "Deposit verified"
    }
  }
  ```
- **Error Codes**: `ADMINS_APPROVE_DIRECTLY`, `FORBIDDEN`, `VALIDATION_ERROR`, `NOT_FOUND`

#### `POST /api/v1/staff/deposits/:id/approve`
- **Auth**: `requireStaff` (Admin only; employees get 403 `FORBIDDEN`)
- **Rate Limit**: 30 req/min per staff user
- **Validation**: Final approval moves money. Admin can approve deposits in `employee_approved` state or directly from `pending` state (audited as `deposit_approved_direct`). Staff cannot approve their own deposit (`FORBIDDEN`).
- **Success Response (200)**:
  ```json
  {
    "data": {
      "message": "Deposit approved"
    }
  }
  ```
- **Error Codes**: `FORBIDDEN`, `VALIDATION_ERROR`, `NOT_FOUND`

#### `POST /api/v1/staff/deposits/:id/reject`
- **Auth**: `requireStaff`
- **Rate Limit**: 30 req/min per staff user
- **Request Body**:
  ```json
  {
    "reason": "Invalid transaction reference"
  }
  ```
- **Validation**: Rejection reason must be at least 5 characters. Employees can reject only `pending` deposits; only administrators can reject `employee_approved` deposits (403 `FORBIDDEN`). Staff cannot reject their own deposit (`FORBIDDEN`).
- **Success Response (200)**:
  ```json
  {
    "data": {
      "message": "Deposit rejected"
    }
  }
  ```
- **Error Codes**: `FORBIDDEN`, `VALIDATION_ERROR`, `NOT_FOUND`

#### `GET /api/v1/staff/withdrawals`
- **Auth**: `requireStaff`
- **Query Parameters**:
  - `status`: `'pending' | 'employee_approved' | 'paid' | 'rejected'`
  - `cursor`: string
  - `limit`: number
- **Success Response (200)**:
  ```json
  {
    "data": {
      "items": [
        {
          "id": "1",
          "userId": "10",
          "userEmail": "player@example.com",
          "amount": "50.00",
          "upiId": "player@upi",
          "status": "pending",
          "rejectReason": null,
          "payoutRef": null,
          "createdAt": "2026-10-10T10:00:00.000Z",
          "processedAt": null,
          "processedBy": null,
          "employeeReviewedAt": null,
          "employeeReviewedBy": null
        }
      ],
      "nextCursor": null
    }
  }
  ```

#### `POST /api/v1/staff/withdrawals/:id/verify`
- **Auth**: `requireStaff` (Employees only; admin calling this gets 403 `ADMINS_APPROVE_DIRECTLY`)
- **Rate Limit**: 30 req/min per staff user
- **Validation**: Only pending withdrawals can be verified. Staff cannot verify their own withdrawal (`FORBIDDEN`).
- **Success Response (200)**:
  ```json
  {
    "data": {
      "message": "Withdrawal verified"
    }
  }
  ```
- **Error Codes**: `ADMINS_APPROVE_DIRECTLY`, `FORBIDDEN`, `VALIDATION_ERROR`, `NOT_FOUND`

#### `POST /api/v1/staff/withdrawals/:id/mark-paid`
- **Auth**: `requireStaff` (Admin only; employees get 403 `FORBIDDEN`)
- **Rate Limit**: 30 req/min per staff user
- **Request Body**:
  ```json
  {
    "payoutRef": "BANK-REF-9988"
  }
  ```
- **Validation**: `payoutRef` is required. Admin can mark paid withdrawals in `employee_approved` state or directly from `pending` state (audited as `withdrawal_paid_direct`). Staff cannot process their own withdrawal (`FORBIDDEN`).
- **Success Response (200)**:
  ```json
  {
    "data": {
      "message": "Withdrawal marked as paid"
    }
  }
  ```
- **Error Codes**: `FORBIDDEN`, `VALIDATION_ERROR`, `NOT_FOUND`

#### `POST /api/v1/staff/withdrawals/:id/reject`
- **Auth**: `requireStaff`
- **Rate Limit**: 30 req/min per staff user
- **Request Body**:
  ```json
  {
    "reason": "Invalid UPI VPA"
  }
  ```
- **Validation**: Rejection reason must be at least 5 characters. Refunds held amount back to winning wallet. Employees can reject only `pending` withdrawals; only administrators can reject `employee_approved` withdrawals (403 `FORBIDDEN`). Staff cannot reject their own withdrawal (`FORBIDDEN`).
- **Success Response (200)**:
  ```json
  {
    "data": {
      "message": "Withdrawal rejected"
    }
  }
  ```
- **Error Codes**: `FORBIDDEN`, `VALIDATION_ERROR`, `NOT_FOUND`

#### `GET /api/v1/staff/users`
- **Auth**: `requireStaff` (Both employees and administrators)
- **Rate Limit**: Global (100 req/min)
- **Description**: Search and list users with cursor pagination. Sensitive fields are masked: `mobile` (`******7890`), `upiId` (`****1234@upi`). Restricted strictly by explicit allowlist (omits `dateOfBirth`, `pan`, `aadhaar`, and referral chain `referredBy`).
- **Query Parameters**:
  - `q`: string (search by name, email, mobile, or Free Fire ID)
  - `cursor`: string
  - `limit`: number
- **Success Response (200)**:
  ```json
  {
    "data": {
      "items": [
        {
          "id": "5",
          "name": "New Player",
          "email": "user@example.com",
          "mobile": "******3299",
          "ffId": "99887766",
          "ffName": "NewPlayerPro",
          "upiId": "user@upi",
          "isDeleted": false,
          "deletedAt": null,
          "createdAt": "2026-10-13T10:19:39.709Z"
        }
      ],
      "nextCursor": null,
      "hasMore": false
    }
  }
  ```
- **Error Codes**: `UNAUTHENTICATED`, `FORBIDDEN`

#### `GET /api/v1/staff/users/:id`
- **Auth**: `requireStaff` (Both employees and administrators)
- **Rate Limit**: 60 req/min per staff user. Additionally, employees have a daily distinct user view cap (default 300 per day). Exceeding this cap returns 429 `RATE_LIMITED` and logs an audit entry `user_view_limit_exceeded`.
- **Description**: Retrieves user detail (profile, wallets, recent ledger, recent matches, and pending requests). Masked fields (`mobile`, `upiId`) and explicit profile allowlist apply. Every staff view (employee and admin) is audited as `user_viewed`.
- **Success Response (200)**:
  ```json
  {
    "data": {
      "profile": {
        "id": "1",
        "name": "Player One",
        "email": "user@example.com",
        "mobile": "******3210",
        "ffId": "12345678",
        "ffName": "ProPlayer1",
        "upiId": "user@upi",
        "isDeleted": false,
        "deletedAt": null,
        "createdAt": "2026-10-13T10:19:39.466Z"
      },
      "wallets": {
        "addMoney": "210.00",
        "cashback": "0.00",
        "winning": "150.00",
        "total": "360.00"
      },
      "recentLedger": [
        {
          "id": 14,
          "wallet": "winning",
          "type": "withdrawal_refund",
          "amount": "50.00",
          "balanceAfter": "150.00",
          "totalAfter": "360.00",
          "refType": "withdrawal",
          "refId": "2",
          "createdAt": "2026-10-13T10:19:39.967Z"
        }
      ],
      "recentMatches": [],
      "pendingRequests": {
        "deposits": [],
        "withdrawals": []
      }
    }
  }
  ```
- **Error Codes**: `UNAUTHENTICATED`, `FORBIDDEN`, `NOT_FOUND`, `RATE_LIMITED`

---

### Group 9: Admin Management
> **Verified against**: `apps/api/tests/admin_employees.test.ts`, `apps/api/tests/entry_tiers.test.ts`, `apps/api/tests/profile_and_admin_management.test.ts`, `apps/api/tests/results_and_payouts.test.ts`, `apps/api/tests/settings_and_public.test.ts`
> Untested endpoints: **None**

#### `GET /api/v1/admin/employees`
- **Auth**: `requireAdmin`
- **Query Parameters**:
  - `q`: string (optional, search by name or email)
  - `cursor`: string (optional)
  - `limit`: number (optional, 1..100, default 20)
- **Success Response (200)**:
  ```json
  {
    "data": {
      "items": [
        {
          "id": "4",
          "role": "employee",
          "name": "Contract Staff",
          "email": "staff@booyah.win",
          "mobile": "9999999999",
          "pan": "XXXXXX234F",
          "aadhaar": "XXXX XXXX 9012",
          "createdBy": "1",
          "createdAt": "2026-10-11T16:21:25.150Z"
        }
      ],
      "nextCursor": null
    }
  }
  ```

#### `POST /api/v1/admin/employees`
- **Auth**: `requireAdmin`
- **Request Body**:
  ```json
  {
    "name": "Jane Employee",
    "email": "jane@example.com",
    "mobile": "9998887776",
    "pan": "ABCDE1234F",
    "aadhaar": "123412341234"
  }
  ```
- **Success Response (201)**:
  ```json
  {
    "data": {
      "employee": {
        "id": "4",
        "role": "employee",
        "name": "Contract Staff",
        "email": "staff@booyah.win",
        "mobile": "9999999999",
        "pan": "XXXXXX234F",
        "aadhaar": "XXXX XXXX 9012",
        "createdBy": "1",
        "createdAt": "2026-10-11T16:21:25.150Z"
      }
    }
  }
  ```
- **Error Codes**: `VALIDATION_ERROR`, `EMAIL_EXISTS`

#### `PATCH /api/v1/admin/employees/:id`
- **Auth**: `requireAdmin`
- **Request Body**:
  ```json
  {
    "name": "Jane Updated",
    "mobile": "9998887770"
  }
  ```
- **Success Response (200)**:
  ```json
  {
    "data": {
      "employee": {
        "id": "4",
        "role": "employee",
        "name": "Contract Staff",
        "email": "staff@booyah.win",
        "mobile": "9999999999",
        "pan": "XXXXXX234F",
        "aadhaar": "XXXX XXXX 9012",
        "createdBy": "1",
        "createdAt": "2026-10-11T16:21:25.150Z"
      }
    }
  }
  ```
- **Error Codes**: `NOT_FOUND`, `EMAIL_EXISTS`, `VALIDATION_ERROR`

#### `DELETE /api/v1/admin/employees/:id`
- **Auth**: `requireAdmin`
- **Success Response (200)**:
  ```json
  {
    "data": {
      "message": "Employee deleted successfully"
    }
  }
  ```
- **Error Codes**: `NOT_FOUND`, `FORBIDDEN` (cannot delete self)

#### `GET /api/v1/admin/tiers`
- **Auth**: `requireAdmin`
- **Success Response (200)**:
  ```json
  {
    "data": {
      "tiers": [
        {
          "id": "1",
          "gameMode": "battle_royale",
          "teamMode": "solo",
          "entryFee": "10.00",
          "killPrice": "5.00",
          "minKillsForReward": 2,
          "maxPlayers": 48,
          "minPlayers": 24,
          "positions": [
            { "position": 1, "prize": "50.00" },
            { "position": 2, "prize": "40.00" },
            { "position": 3, "prize": "30.00" }
          ],
          "createdAt": "2026-10-11T16:21:24.492Z"
        }
      ]
    }
  }
  ```

#### `POST /api/v1/admin/tiers`
- **Auth**: `requireAdmin`
- **Rate Limit**: 30 req/min per staff user (Requirement 4)
- **Request Body**:
  ```json
  {
    "gameMode": "battle_royale",
    "teamMode": "squad",
    "entryFee": "25.00",
    "killPrice": "10.00",
    "minKillsForReward": 2,
    "maxPlayers": 48,
    "minPlayers": 24,
    "positions": [
      { "position": 1, "prize": "100.00" },
      { "position": 2, "prize": "50.00" }
    ]
  }
  ```
- **Success Response (201)**:
  ```json
  {
    "data": {
      "tier": {
        "id": "5",
        "gameMode": "battle_royale",
        "teamMode": "squad",
        "entryFee": "25.00",
        "killPrice": "10.00",
        "minKillsForReward": 2,
        "maxPlayers": 48,
        "minPlayers": 24,
        "positions": [
          { "position": 1, "prize": "100.00" },
          { "position": 2, "prize": "50.00" }
        ],
        "createdAt": "2026-10-11T16:21:25.174Z"
      },
      "warning": "Profit guard warning: Max possible payout (₹620.00) exceeds minimum collected fees (₹600.00)."
    }
  }
  ```
- **Error Codes**: `VALIDATION_ERROR`, `409 VALIDATION_ERROR` (active tier duplicate)

#### `GET /api/v1/admin/tiers/:id`
- **Auth**: `requireAdmin`
- **Success Response (200)**:
  ```json
  {
    "data": {
      "tier": {
        "id": "5",
        "gameMode": "battle_royale",
        "teamMode": "squad",
        "entryFee": "25.00",
        "killPrice": "10.00",
        "minKillsForReward": 2,
        "maxPlayers": 48,
        "minPlayers": 24,
        "positions": [
          { "position": 1, "prize": "100.00" },
          { "position": 2, "prize": "50.00" }
        ],
        "createdAt": "2026-10-11T16:21:25.174Z"
      }
    }
  }
  ```
- **Error Codes**: `NOT_FOUND`

#### `PATCH /api/v1/admin/tiers/:id`
- **Auth**: `requireAdmin`
- **Request Body**: Partial tier fields
- **Success Response (200)**:
  ```json
  {
    "data": {
      "tier": {
        "id": "5",
        "gameMode": "battle_royale",
        "teamMode": "squad",
        "entryFee": "25.00",
        "killPrice": "12.00",
        "minKillsForReward": 2,
        "maxPlayers": 48,
        "minPlayers": 24,
        "positions": [
          { "position": 1, "prize": "100.00" },
          { "position": 2, "prize": "50.00" }
        ],
        "createdAt": "2026-10-11T16:21:25.174Z"
      },
      "warning": "Profit guard warning: Max possible payout (₹714.00) exceeds minimum collected fees (₹600.00)."
    }
  }
  ```
- **Error Codes**: `NOT_FOUND`, `VALIDATION_ERROR`

#### `DELETE /api/v1/admin/tiers/:id`
- **Auth**: `requireAdmin`
- **Success Response (200)**:
  ```json
  {
    "data": {
      "message": "Entry tier deleted successfully"
    }
  }
  ```
- **Error Codes**: `NOT_FOUND`

#### `GET /api/v1/admin/users`
- **Auth**: `requireAdmin`
- **Query Parameters**:
  - `q`: string (search by name, email, mobile, or Free Fire ID)
  - `cursor`: string
  - `limit`: number
- **Success Response (200)**:
  ```json
  {
    "data": {
      "items": [
        {
          "id": "4",
          "name": "New Player",
          "email": "user@example.com",
          "mobile": "9999999999",
          "ffId": "99887766",
          "ffName": "ProPlayerUpdated",
          "upiId": "user@upi",
          "isDeleted": false,
          "deletedAt": null,
          "createdAt": "2026-10-11T16:21:24.738Z"
        }
      ],
      "nextCursor": null,
      "hasMore": false
    }
  }
  ```

#### `GET /api/v1/admin/users/:id`
- **Auth**: `requireAdmin`
- **Success Response (200)**:
  ```json
  {
    "data": {
      "profile": {
        "id": "1",
        "name": "Player One",
        "email": "user@example.com",
        "mobile": "9999999999",
        "ffId": "12345678",
        "ffName": "ProPlayer1",
        "upiId": "user@upi",
        "dateOfBirth": "2000-01-01",
        "referralCode": "L32BS9MW",
        "referredBy": null,
        "isDeleted": false,
        "deletedAt": null,
        "deletedReason": null,
        "deletedBy": null,
        "createdAt": "2026-10-11T16:21:24.504Z"
      },
      "wallets": {
        "addMoney": "130.00",
        "cashback": "0.00",
        "winning": "0.00",
        "total": "130.00"
      },
      "recentLedger": [
        {
          "id": 22,
          "wallet": "winning",
          "type": "winning",
          "amount": "310.00",
          "balanceAfter": "410.00",
          "totalAfter": "540.00",
          "refType": null,
          "refId": "11",
          "createdAt": "2026-10-11T16:21:25.135Z"
        }
      ],
      "matchHistory": [
        {
          "matchId": "11",
          "gameMode": "battle_royale",
          "teamMode": "solo",
          "entryFee": "20.00",
          "startTime": "2026-12-03T10:00:00.000Z",
          "matchStatus": "completed",
          "kills": 1,
          "position": 1,
          "payout": "310.00",
          "displayStatus": "Booyah",
          "joinedAt": "2026-10-11T16:21:25.105Z"
        }
      ]
    }
  }
  ```
- **Error Codes**: `NOT_FOUND`

#### `DELETE /api/v1/admin/users/:id`
- **Auth**: `requireAdmin`
- **Request Body**:
  ```json
  {
    "reason": "Fraudulent activity"
  }
  ```
- **Success Response (200)**:
  ```json
  {
    "data": {
      "id": "5",
      "message": "User deleted successfully"
    }
  }
  ```
- **Error Codes**: `NOT_FOUND`, `VALIDATION_ERROR` (reason < 5 chars), `409 INVALID_TRANSITION` (already deleted)

#### `POST /api/v1/admin/users/:id/adjust`
- **Auth**: `requireAdmin`
- **Rate Limit**: 30 req/min per staff user (Requirement 4)
- **Request Body**:
  ```json
  {
    "wallet": "winning",
    "amount": "20.00",
    "reason": "Tournament bonus reward"
  }
  ```
- **Validation**: `wallet` must be `'add_money' | 'cashback' | 'winning'`. Reason $\ge 5$ characters; signed 2-decimal amount string (e.g. `"-20.00"` for debit); zero amount rejected; debit cannot make balance negative.
- **Success Response (200)**:
  ```json
  {
    "data": {
      "userId": "1",
      "wallet": "winning",
      "amount": "20.00",
      "balances": {
        "addMoney": "130.00",
        "cashback": "0.00",
        "winning": "20.00",
        "total": "150.00"
      }
    }
  }
  ```
- **Error Codes**: `VALIDATION_ERROR`, `LOW_BALANCE`, `NOT_FOUND`

#### `GET /api/v1/admin/results` (and `GET /api/v1/admin/results/queue`)
- **Auth**: `requireAdmin`
- **Success Response (200)**:
  ```json
  {
    "data": {
      "results": [
        {
          "id": "1",
          "matchId": "2",
          "status": "pending_approval",
          "submittedBy": "1",
          "createdAt": "2026-10-10T16:00:00.000Z",
          "screenshotUrl": "match-results/2/result_123.jpg",
          "gameMode": "battle_royale",
          "teamMode": "duo",
          "matchStatus": "live"
        }
      ],
      "count": 1
    }
  }
  ```

#### `GET /api/v1/admin/results/:matchId/preview`
- **Auth**: `requireAdmin`
- **Success Response (200)**:
  ```json
  {
    "data": {
      "entries": [
        {
          "userId": "10",
          "kills": 3,
          "position": 1,
          "killReward": "15.00",
          "positionPrize": "50.00",
          "payout": "65.00",
          "payoutPaise": 6500,
          "isDeleted": false
        }
      ],
      "totalCollected": "40.00",
      "totalCollectedPaise": 4000,
      "totalPayout": "135.00",
      "totalPayoutPaise": 13500,
      "difference": "-95.00",
      "differencePaise": -9500,
      "warning": "Payout exceeds total entry fees collected"
    }
  }
  ```
- **Error Codes**: `NOT_FOUND`, `RESULT_INVALID`, `VALIDATION_ERROR`

#### `POST /api/v1/admin/results/:matchId/approve`
- **Auth**: `requireAdmin`
- **Rate Limit**: 30 req/min per staff user (Requirement 4)
- **Description**: Recomputes payouts, verifies current roster, credits winners' `winning` wallets, and marks match `completed`.
- **Success Response (200)**:
  ```json
  {
    "data": {
      "matchId": "2",
      "status": "approved",
      "message": "Result approved and payouts credited"
    }
  }
  ```
- **Error Codes**: `RESULT_LOCKED`, `RESULT_INVALID`, `INVALID_TRANSITION`, `VALIDATION_ERROR`

#### `POST /api/v1/admin/results/:matchId/reject`
- **Auth**: `requireAdmin`
- **Rate Limit**: 30 req/min per staff user (Requirement 4)
- **Request Body**:
  ```json
  {
    "reason": "Scoreboard screenshot does not match entered kills"
  }
  ```
- **Success Response (200)**:
  ```json
  {
    "data": {
      "matchId": "2",
      "status": "rejected",
      "rejectionReason": "Scoreboard screenshot does not match entered kills"
    }
  }
  ```
- **Error Codes**: `VALIDATION_ERROR`, `RESULT_LOCKED`, `INVALID_TRANSITION`

#### `POST /api/v1/admin/results/:matchId/reverse`
- **Auth**: `requireAdmin`
- **Rate Limit**: 30 req/min per staff user (Requirement 4)
- **Request Body**:
  ```json
  {
    "reason": "Dispute resolved in favor of runner up"
  }
  ```
- **Description**: Atomically debits winning balances credited during approval, records `reversal` ledger entries and audit log. Resets match back to `live` and result back to `rejected`.
- **Success Response (200)**:
  ```json
  {
    "data": {
      "matchId": "2",
      "status": "reversed",
      "message": "Result reversed and payouts debited"
    }
  }
  ```
- **Error Codes**: `VALIDATION_ERROR`, `INVALID_TRANSITION`, `LOW_BALANCE`
  - `400 LOW_BALANCE`:
    ```json
    {
      "error": {
        "code": "LOW_BALANCE",
        "message": "Cannot reverse result: one or more players have insufficient winning balance",
        "details": {
          "affectedUsers": [
            {
              "userId": "10",
              "requiredWinningPaise": 5000,
              "currentWinningPaise": 1000,
              "deficitPaise": 4000
            }
          ]
        }
      }
    }
    ```

#### `GET /api/v1/admin/settings`
- **Auth**: `requireAdmin`
- **Success Response (200)**:
  ```json
  {
    "data": {
      "settings": {
        "min_deposit": "10.00",
        "max_deposit": "5000.00",
        "admin_approval_threshold": "2000.00",
        "support_name": "",
        "support_phone": "",
        "support_email": "",
        "support_hours": "10:00 AM - 10:00 PM IST",
        "payment_upi_id": "",
        "payment_qr_url": "",
        "payment_qr_key": ""
      }
    }
  }
  ```

#### `PATCH /api/v1/admin/settings`
- **Auth**: `requireAdmin`
- **Request Body**: Key-value settings map (rejects `payment_qr_key` and rejects writes to unused `admin_approval_threshold`)
- **Success Response (200)**:
  ```json
  {
    "data": {
      "settings": {
        "min_deposit": "15.00",
        "max_deposit": "6000.00",
        "support_name": "Booyah Support Team"
      }
    }
  }
  ```
- **Error Codes**: `VALIDATION_ERROR`

#### `POST /api/v1/admin/settings/payment-qr`
- **Auth**: `requireAdmin`
- **Content-Type**: `multipart/form-data`
- **Form Fields**:
  - `file`: image file (max 2 MB, JPEG/PNG/WebP)
- **Success Response (200)**:
  ```json
  {
    "data": {
      "paymentQrKey": "https://storage.example.com/placeholder.jpg",
      "qrUrl": "https://storage.example.com/placeholder.jpg"
    }
  }
  ```
- **Error Codes**: `VALIDATION_ERROR`

#### `GET /api/v1/admin/audit-logs`
- **Auth**: `requireAdmin`
- **Query Parameters**:
  - `staffId`: string (optional)
  - `action`: string (optional)
  - `from`: string (optional, ISO date)
  - `to`: string (optional, ISO date)
  - `cursor`: string (optional)
  - `limit`: number (optional, default 20)
- **Success Response (200)**:
  ```json
  {
    "data": {
      "items": [
        {
          "id": "43",
          "staffId": "1",
          "staffName": "Admin User",
          "action": "settings_payment_qr_updated",
          "targetType": "app_settings",
          "targetId": null,
          "details": {
            "newKey": "https://storage.example.com/placeholder.jpg",
            "oldKey": null
          },
          "createdAt": "2026-10-11T16:21:25.279Z"
        }
      ],
      "nextCursor": "34"
    }
  }
  ```
