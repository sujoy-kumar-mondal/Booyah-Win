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
`UNAUTHENTICATED`, `SESSION_REPLACED`, `FORBIDDEN`, `ADMIN_APPROVAL_REQUIRED`, `VALIDATION_ERROR`, `INVALID_OTP`, `OTP_RATE_LIMITED`, `EMAIL_EXISTS`, `MOBILE_EXISTS`, `FF_ID_EXISTS`, `UPI_EXISTS`, `INVALID_REFERRAL`, `FIELD_COOLDOWN`, `IN_ACTIVE_MATCH`, `LOW_BALANCE`, `UTR_EXISTS`, `DEPOSIT_LIMIT`, `WITHDRAWAL_PENDING`, `UPI_RECENTLY_CHANGED`, `MATCH_FULL`, `ALREADY_JOINED`, `MATCH_NOT_JOINABLE`, `TEAM_INVALID`, `INVITE_EXPIRED`, `RESULT_INVALID`, `RESULT_LOCKED`, `NOT_FOUND`, `RATE_LIMITED`, `INTERNAL_ERROR`, `INVALID_TRANSITION`, `DATABASE_BUSY`.

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
- **Description**: Returns UPI ID and payment QR signed URL for manual deposits.
- **Success Response (200)**:
  ```json
  {
    "data": {
      "upiId": "merchant@okhdfcbank",
      "qrUrl": "https://storage.../payment_qr.png?token=..."
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
      "message": "Staff OTP sent successfully"
    }
  }
  ```
- **Error Codes**: `VALIDATION_ERROR`, `NOT_FOUND` (if not registered staff member), `OTP_RATE_LIMITED`

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
      "message": "Staff logged out successfully"
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
- **Success Response (200)**:
  ```json
  {
    "data": {
      "items": [
        {
          "matchId": "1",
          "matchDisplayId": "BW-MAT-1",
          "gameMode": "battle_royale",
          "teamMode": "solo",
          "startTime": "2026-10-10T15:00:00.000Z",
          "status": "completed",
          "kills": 5,
          "position": 1,
          "prizeWon": "150.00",
          "positionLabel": "Booyah",
          "refunded": false
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
    "data": [
      {
        "id": "1",
        "teamId": "10",
        "teamName": "Squad Alpha",
        "matchId": "5",
        "matchTitle": "Squad BR #5",
        "entryFee": "20.00",
        "invitedBy": "Leader One",
        "status": "pending",
        "createdAt": "2026-10-10T14:30:00.000Z"
      }
    ]
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
  - `utr`: string (12 alphanumeric characters)
  - `screenshot`: file (image/jpeg, image/png, image/webp; max 2 MB)
- **Success Response (201)**:
  ```json
  {
    "data": {
      "id": "1",
      "displayId": "BW-DEP-1",
      "amount": "100.00",
      "utr": "123456789012",
      "status": "pending",
      "screenshotUrl": "/api/v1/files/...",
      "createdAt": "2026-10-10T12:00:00.000Z"
    }
  }
  ```
- **Error Codes**: `VALIDATION_ERROR`, `UTR_EXISTS`, `DEPOSIT_LIMIT`, `RATE_LIMITED`

#### `GET /api/v1/wallet/deposits`
- **Auth**: `requireUser`
- **Success Response (200)**:
  ```json
  {
    "data": [
      {
        "id": "1",
        "displayId": "BW-DEP-1",
        "amount": "100.00",
        "utr": "123456789012",
        "status": "approved",
        "createdAt": "2026-10-10T12:00:00.000Z"
      }
    ]
  }
  ```

#### `POST /api/v1/wallet/withdrawals`
- **Auth**: `requireUser`
- **Rate Limit**: 10 req/min per user
- **Request Body**:
  ```json
  {
    "amount": "150.00"
  }
  ```
- **Validation**: Minimum ₹50.00; must not exceed `winning` balance; user cannot have another pending withdrawal; blocked for 48 hours after UPI change.
- **Success Response (201)**:
  ```json
  {
    "data": {
      "id": "1",
      "displayId": "BW-WTH-1",
      "amount": "150.00",
      "status": "pending",
      "createdAt": "2026-10-10T12:00:00.000Z"
    }
  }
  ```
- **Error Codes**: `VALIDATION_ERROR`, `LOW_BALANCE`, `WITHDRAWAL_PENDING`, `UPI_RECENTLY_CHANGED`, `RATE_LIMITED`

#### `GET /api/v1/wallet/withdrawals`
- **Auth**: `requireUser`
- **Success Response (200)**:
  ```json
  {
    "data": [
      {
        "id": "1",
        "displayId": "BW-WTH-1",
        "amount": "150.00",
        "status": "pending",
        "createdAt": "2026-10-10T12:00:00.000Z"
      }
    ]
  }
  ```

#### `GET /api/v1/wallet/transactions`
- **Auth**: `requireUser`
- **Query Parameters**:
  - `cursor`: string (optional)
  - `limit`: number (default: 20, max: 50)
  - `type`: comma-separated ledger types (`join_fee`, `winning`, `refund`, etc.)
- **Success Response (200)**:
  ```json
  {
    "data": {
      "items": [
        {
          "id": "10",
          "displayId": "BW-TXN-10",
          "type": "winning",
          "walletKind": "winning",
          "amount": "150.00",
          "balanceAfter": "450.00",
          "description": "Prize won in match BW-MAT-1",
          "createdAt": "2026-10-10T15:30:00.000Z"
        }
      ],
      "nextCursor": null,
      "hasMore": false
    }
  }
  ```

---

### Group 6: Matches & Teams
> **Verified against**: `apps/api/tests/matches.test.ts`, `apps/api/tests/teams_and_scheduler.test.ts`
> Untested endpoints: **None**

#### `GET /api/v1/matches`
- **Auth**: Optional `requireUser`
- **Query Parameters**:
  - `status`: `'upcoming' | 'room_open' | 'live' | 'completed' | 'cancelled'`
  - `gameMode`: `'battle_royale' | 'clash_squad'`
  - `teamMode`: `'solo' | 'duo' | 'squad'`
  - `cursor`: string
  - `limit`: number (default: 20)
- **Success Response (200)**:
  ```json
  {
    "data": {
      "items": [
        {
          "id": "1",
          "displayId": "BW-MAT-1",
          "gameMode": "battle_royale",
          "teamMode": "solo",
          "status": "upcoming",
          "entryFee": "10.00",
          "prizePool": "400.00",
          "totalSeats": 48,
          "seatsTaken": 24,
          "startTime": "2026-10-10T18:00:00.000Z",
          "isJoined": false
        }
      ],
      "nextCursor": null,
      "hasMore": false
    }
  }
  ```

#### `GET /api/v1/matches/:id`
- **Auth**: Optional `requireUser`
- **Description**: Returns match details. If joined and status is `room_open` or `live`, reveals `roomId` and `roomPassword`.
- **Success Response (200)**:
  ```json
  {
    "data": {
      "id": "1",
      "displayId": "BW-MAT-1",
      "gameMode": "battle_royale",
      "teamMode": "solo",
      "status": "room_open",
      "roomId": "123456",
      "roomPassword": "pass",
      "rules": "Default competitive rules",
      "prizes": [
        { "position": 1, "label": "Booyah", "amount": "200.00" }
      ],
      "perKillReward": "5.00"
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
      "joined": true,
      "matchId": "1",
      "paid": {
        "cashback": "0.50",
        "addMoney": "9.50",
        "winning": "0.00"
      }
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
    "teamName": "Warriors",
    "memberFfIds": ["22334455", "33445566", "44556677"]
  }
  ```
- **Success Response (201)**:
  ```json
  {
    "data": {
      "teamId": "5",
      "status": "forming",
      "invitedMembers": 3
    }
  }
  ```
- **Error Codes**: `VALIDATION_ERROR`, `MATCH_NOT_JOINABLE`, `MATCH_FULL`, `TEAM_INVALID`, `LOW_BALANCE`

#### `POST /api/v1/matches/:id/teams/mine/replace`
- **Auth**: `requireUser` (Team Leader)
- **Rate Limit**: 10 req/min per user (SEC-04)
- **Request Body**:
  ```json
  {
    "oldFfId": "22334455",
    "newFfId": "99001122"
  }
  ```
- **Success Response (200)**:
  ```json
  {
    "data": {
      "replaced": true
    }
  }
  ```
- **Error Codes**: `VALIDATION_ERROR`, `MATCH_NOT_JOINABLE`, `TEAM_INVALID`, `FORBIDDEN`

#### `DELETE /api/v1/matches/:id/teams/mine`
- **Auth**: `requireUser` (Team Leader)
- **Rate Limit**: 10 req/min per user (SEC-04)
- **Success Response (200)**:
  ```json
  {
    "data": {
      "disbanded": true,
      "refundedMembers": 2
    }
  }
  ```
- **Error Codes**: `MATCH_NOT_JOINABLE`, `FORBIDDEN`, `INVALID_TRANSITION`

#### `POST /api/v1/team-invites/:id/accept`
- **Auth**: `requireUser`
- **Rate Limit**: 10 req/min per user (SEC-04)
- **Success Response (200)**:
  ```json
  {
    "data": {
      "accepted": true,
      "teamStatus": "confirmed"
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
      "declined": true
    }
  }
  ```
- **Error Codes**: `NOT_FOUND` (identical 404 for non-existent invite or another user's invite), `INVITE_EXPIRED`

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
      "pendingDeposits": 3,
      "pendingWithdrawals": 1,
      "upcomingMatches": 5,
      "liveMatches": 1,
      "resultsPendingApproval": 2
    }
  }
  ```

#### `GET /api/v1/staff/entry-tiers`
- **Auth**: `requireStaff`
- **Success Response (200)**:
  ```json
  {
    "data": [
      {
        "id": "1",
        "name": "BR Bronze",
        "gameMode": "battle_royale",
        "entryFee": "10.00",
        "perKillReward": "5.00",
        "minPlayers": 24,
        "maxPlayers": 48
      }
    ]
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
        "status": "upcoming"
      }
    }
  }
  ```
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
  - `entries`: JSON string containing array of `{ playerId, kills, position }`
  - `screenshot`: file (max 2 MB)
- **Validation**: Staff member cannot submit result if they participated in the match.
- **Success Response (201)**:
  ```json
  {
    "data": {
      "resultId": "1",
      "matchId": "2",
      "status": "pending_approval"
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
      "result": { ... }
    }
  }
  ```
- **Error Codes**: `NOT_FOUND`, `VALIDATION_ERROR`

#### `GET /api/v1/staff/deposits`
- **Auth**: `requireStaff`
- **Query Parameters**:
  - `status`: `'pending' | 'approved' | 'rejected'`
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

#### `POST /api/v1/staff/deposits/:id/approve`
- **Auth**: `requireStaff`
- **Rate Limit**: 30 req/min per staff user (Requirement 4)
- **Validation**: If deposit amount > `admin_approval_threshold`, employees are blocked with `ADMIN_APPROVAL_REQUIRED`.
- **Success Response (200)**:
  ```json
  {
    "data": {
      "id": "1",
      "status": "approved"
    }
  }
  ```
- **Error Codes**: `ADMIN_APPROVAL_REQUIRED`, `INVALID_TRANSITION`, `NOT_FOUND`, `VALIDATION_ERROR`

#### `POST /api/v1/staff/deposits/:id/reject`
- **Auth**: `requireStaff`
- **Rate Limit**: 30 req/min per staff user (Requirement 4)
- **Request Body**:
  ```json
  {
    "reason": "Invalid transaction reference"
  }
  ```
- **Success Response (200)**:
  ```json
  {
    "data": {
      "id": "1",
      "status": "rejected"
    }
  }
  ```
- **Error Codes**: `VALIDATION_ERROR`, `INVALID_TRANSITION`, `NOT_FOUND`

#### `GET /api/v1/staff/withdrawals`
- **Auth**: `requireStaff`
- **Query Parameters**:
  - `status`: `'pending' | 'paid' | 'rejected'`
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

#### `POST /api/v1/staff/withdrawals/:id/mark-paid`
- **Auth**: `requireStaff`
- **Rate Limit**: 30 req/min per staff user (Requirement 4)
- **Request Body**:
  ```json
  {
    "payoutRef": "BANK-REF-9988"
  }
  ```
- **Success Response (200)**:
  ```json
  {
    "data": {
      "id": "1",
      "status": "paid"
    }
  }
  ```
- **Error Codes**: `VALIDATION_ERROR`, `INVALID_TRANSITION`, `NOT_FOUND`

#### `POST /api/v1/staff/withdrawals/:id/reject`
- **Auth**: `requireStaff`
- **Rate Limit**: 30 req/min per staff user (Requirement 4)
- **Request Body**:
  ```json
  {
    "reason": "Invalid UPI VPA"
  }
  ```
- **Success Response (200)**:
  ```json
  {
    "data": {
      "id": "1",
      "status": "rejected"
    }
  }
  ```
- **Error Codes**: `VALIDATION_ERROR`, `INVALID_TRANSITION`, `NOT_FOUND`

---

### Group 9: Admin Management
> **Verified against**: `apps/api/tests/admin_employees.test.ts`, `apps/api/tests/entry_tiers.test.ts`, `apps/api/tests/profile_and_admin_management.test.ts`, `apps/api/tests/results_and_payouts.test.ts`, `apps/api/tests/settings_and_public.test.ts`
> Untested endpoints: **None**

#### `GET /api/v1/admin/employees`
- **Auth**: `requireAdmin`
- **Success Response (200)**:
  ```json
  {
    "data": [
      {
        "id": "2",
        "name": "Jane Employee",
        "email": "jane@example.com",
        "mobile": "9998887776",
        "role": "employee",
        "maskedAadhaar": "XXXX-XXXX-1234"
      }
    ]
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
      "id": "2",
      "name": "Jane Employee",
      "email": "jane@example.com"
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
      "id": "2",
      "name": "Jane Updated"
    }
  }
  ```

#### `DELETE /api/v1/admin/employees/:id`
- **Auth**: `requireAdmin`
- **Success Response (200)**:
  ```json
  {
    "data": {
      "deleted": true
    }
  }
  ```
- **Error Codes**: `NOT_FOUND`, `FORBIDDEN` (cannot delete self)

#### `GET /api/v1/admin/tiers`
- **Auth**: `requireAdmin`
- **Success Response (200)**:
  ```json
  {
    "data": [
      {
        "id": "1",
        "name": "BR Bronze",
        "gameMode": "battle_royale",
        "entryFee": "10.00",
        "perKillReward": "5.00",
        "minPlayers": 24,
        "maxPlayers": 48,
        "prizes": [
          { "position": 1, "label": "Booyah", "amount": "200.00" }
        ]
      }
    ]
  }
  ```

#### `POST /api/v1/admin/tiers`
- **Auth**: `requireAdmin`
- **Rate Limit**: 30 req/min per staff user (Requirement 4)
- **Request Body**:
  ```json
  {
    "name": "BR Silver",
    "gameMode": "battle_royale",
    "entryFee": "20.00",
    "perKillReward": "10.00",
    "minPlayers": 24,
    "maxPlayers": 48,
    "prizes": [
      { "position": 1, "label": "Booyah", "amount": "400.00" }
    ]
  }
  ```
- **Success Response (201)**:
  ```json
  {
    "data": { ... }
  }
  ```
- **Error Codes**: `VALIDATION_ERROR`

#### `GET /api/v1/admin/tiers/:id`
- **Auth**: `requireAdmin`
- **Success Response (200)**:
  ```json
  {
    "data": { ... }
  }
  ```
- **Error Codes**: `NOT_FOUND`

#### `PATCH /api/v1/admin/tiers/:id`
- **Auth**: `requireAdmin`
- **Request Body**: Partial tier fields
- **Success Response (200)**:
  ```json
  {
    "data": { ... }
  }
  ```

#### `DELETE /api/v1/admin/tiers/:id`
- **Auth**: `requireAdmin`
- **Success Response (200)**:
  ```json
  {
    "data": {
      "deleted": true
    }
  }
  ```

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
      "items": [ ... ],
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
      "profile": { ... },
      "wallets": { ... },
      "depositCount": 5,
      "totalDeposited": "500.00",
      "withdrawalCount": 2,
      "totalWithdrawn": "300.00"
    }
  }
  ```

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
      "deleted": true
    }
  }
  ```
- **Error Codes**: `NOT_FOUND`, `409 INVALID_TRANSITION` (already deleted)

#### `POST /api/v1/admin/users/:id/adjust`
- **Auth**: `requireAdmin`
- **Rate Limit**: 30 req/min per staff user (Requirement 4)
- **Request Body**:
  ```json
  {
    "walletKind": "winning",
    "amount": "50.00",
    "operation": "credit",
    "reason": "Compensation for platform glitch"
  }
  ```
- **Validation**: Reason $\ge 5$ characters; amount $> 0.00$; debit cannot exceed available balance.
- **Success Response (200)**:
  ```json
  {
    "data": {
      "adjusted": true,
      "wallets": { ... }
    }
  }
  ```
- **Error Codes**: `VALIDATION_ERROR`, `LOW_BALANCE`, `NOT_FOUND`

#### `GET /api/v1/admin/results` (and `GET /api/v1/admin/results/queue`)
- **Auth**: `requireAdmin`
- **Success Response (200)**:
  ```json
  {
    "data": [
      {
        "id": "1",
        "matchId": "2",
        "status": "pending_approval",
        "submittedBy": "1",
        "submittedAt": "2026-10-10T16:00:00.000Z"
      }
    ]
  }
  ```

#### `GET /api/v1/admin/results/:matchId/preview`
- **Auth**: `requireAdmin`
- **Success Response (200)**:
  ```json
  {
    "data": {
      "matchId": "2",
      "payouts": [ ... ],
      "totalPayout": "450.00"
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
      "resultId": "1",
      "status": "approved",
      "totalPaid": "450.00"
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
      "resultId": "1",
      "status": "rejected"
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
- **Description**: Atomically debits winning balances credited during approval, records `reversal` ledger entries and audit log.
- **Success Response (200)**:
  ```json
  {
    "data": {
      "resultId": "1",
      "reversed": true,
      "status": "rejected"
    }
  }
  ```
- **Error Codes**: `VALIDATION_ERROR`, `INVALID_TRANSITION`

#### `GET /api/v1/admin/settings`
- **Auth**: `requireAdmin`
- **Success Response (200)**:
  ```json
  {
    "data": {
      "min_deposit": "10.00",
      "max_deposit": "5000.00",
      "admin_approval_threshold": "2000.00",
      "support_email": "support@booyahwin.com",
      "support_whatsapp": "+919876543210",
      "payment_upi_id": "merchant@upi",
      "payment_qr_key": "payment-qr/abc.png"
    }
  }
  ```

#### `PATCH /api/v1/admin/settings`
- **Auth**: `requireAdmin`
- **Request Body**: Key-value settings map (rejects `payment_qr_key`)
- **Success Response (200)**:
  ```json
  {
    "data": { ... }
  }
  ```
- **Error Codes**: `VALIDATION_ERROR`

#### `POST /api/v1/admin/settings/payment-qr`
- **Auth**: `requireAdmin`
- **Content-Type**: `multipart/form-data`
- **Form Fields**:
  - `file`: image file (max 2 MB)
- **Success Response (200)**:
  ```json
  {
    "data": {
      "qrUrl": "https://storage.../qr.png?token=...",
      "key": "payment-qr/12345.png"
    }
  }
  ```
- **Error Codes**: `VALIDATION_ERROR`

#### `GET /api/v1/admin/audit-logs`
- **Auth**: `requireAdmin`
- **Query Parameters**:
  - `cursor`: string
  - `limit`: number
- **Success Response (200)**:
  ```json
  {
    "data": {
      "items": [
        {
          "id": "1",
          "action": "deposit_approved",
          "actorType": "staff",
          "actorId": "1",
          "targetType": "deposit_request",
          "targetId": "10",
          "details": { "amount": "500.00" },
          "createdAt": "2026-10-10T12:00:00.000Z"
        }
      ],
      "nextCursor": null,
      "hasMore": false
    }
  }
  ```
