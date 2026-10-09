# Booyah Win: Complete Build Specification

> **How to use this document:** Give this file AND `booyah_win_schema.sql` to the AI. Tell it to build milestone by milestone (Section 20), run the tests in Section 19 after each milestone, and ask before deviating from anything written here. Where this spec is silent, the AI must choose the simplest safe option and list it under "Assumptions" in its reply.

---

## 1. Product Overview

**Booyah Win** lets players join Free Fire custom matches using wallet money and win prizes.

Three clients, one server:

| Client | Users | Type |
|---|---|---|
| **User App** | Players | PWA (installable web app, mobile-first) |
| **Staff Portal, Employee area** | Employees | Web app (desktop-first) |
| **Staff Portal, Admin area** | Admin (the owner) | Same web app, extra role-gated pages |

```
User PWA ──┐
           ├──> REST API (Node/Express) ──> PostgreSQL
Staff web ─┘            └──> File storage (screenshots, QR image)
```

### Hard constraints
1. **Zero running cost.** Free tiers only. No AWS. No paid services.
2. **No passwords anywhere.** Email + OTP login for users, employees and admin.
3. **One active device per account.** A new login logs out the old one.
4. **Money correctness over everything.** Wallet changes are atomic and recorded in a ledger.
5. Users cannot delete their own accounts.
6. Booyah means 1st position.

---

## 2. Tech Stack (fixed, do not substitute)

| Layer | Choice |
|---|---|
| Runtime | Node.js 20 LTS, TypeScript (strict) |
| API | Express, `zod` validation, `helmet`, `cors`, `express-rate-limit`, `pino` logging |
| DB access | `pg` (raw parameterized SQL), migrations with `node-pg-migrate` |
| Auth tokens | `jsonwebtoken` (HS256) |
| Email (OTP) | `nodemailer` with Gmail SMTP and a Google **App Password** |
| File upload | `multer` (memory storage), stored in a **private** Supabase Storage bucket; staff view files via short-lived signed URLs |
| Database | PostgreSQL on Supabase or Neon free tier |
| User App | React + Vite + TypeScript + React Router + TanStack Query + Tailwind, PWA via `vite-plugin-pwa` |
| Staff Portal | React + Vite + TypeScript + React Router + TanStack Query + Tailwind (one app, role-based routes) |
| Tests | `vitest` + `supertest` |
| Hosting | API on Render free web service; frontends on Vercel or Netlify free tier; DB as above |
| Scheduler | External free cron (cron-job.org) calls `POST /internal/jobs/tick` every 5 minutes (also keeps Render awake) |

### Monorepo layout
```
booyah-win/
  apps/
    api/            # Express API
      src/
        config/ db/ middleware/ modules/ jobs/ utils/
        modules/{auth,users,wallet,deposits,withdrawals,matches,teams,results,tiers,staff,admin,settings}/
      migrations/
      tests/
    user-pwa/
    staff-portal/
  packages/
    shared/         # shared types, zod schemas, constants
  README.md
```

---

## 3. Environment Variables (never commit; provide `.env.example`)

```
DATABASE_URL=
JWT_SECRET=                  # 64+ random chars
OTP_HMAC_SECRET=             # 64+ random chars
FIELD_ENCRYPTION_KEY=        # 32 bytes base64, for PAN/Aadhaar (AES-256-GCM)
GMAIL_USER=
GMAIL_APP_PASSWORD=
SUPABASE_URL=
SUPABASE_SERVICE_KEY=
STORAGE_BUCKET=booyah-private
ADMIN_EMAIL=                 # seeds the first admin (one-time script)
ADMIN_NAME=
CRON_SECRET=                 # for /internal/jobs/tick
CORS_ORIGINS=                # comma-separated allowed origins
NODE_ENV=
```

Business settings (min/max deposit, admin approval threshold, support contact, payment QR/UPI) live in the `app_settings` table, editable by admin. Seed defaults: `min_deposit=10`, `max_deposit=5000`, `admin_approval_threshold=2000`.

---

## 4. Global Rules

### 4.1 Money
- DB columns are `NUMERIC(12,2)`. **Never use JavaScript floats for money.** Convert to integer paise in code (or use `decimal.js`), do math in integers, and send/receive money as **strings** in the API (`"9.50"`).
- Every balance change is: (a) update `wallets` row, (b) insert `wallet_ledger` row(s), in **one DB transaction**.
- Lock order to avoid deadlocks: `matches` row first, then `teams`, then `wallets` rows in ascending `user_id`. Use `SELECT ... FOR UPDATE`.
- Wallet columns have `CHECK >= 0`. A failed check must return a clean error, not a 500.

### 4.2 Time
Store UTC (`timestamptz`). Display in **IST (Asia/Kolkata)** in all UIs.

### 4.3 API conventions
- Base path `/api/v1`. JSON only (multipart for uploads).
- IDs are returned as strings.
- Success: `{ "data": ... }`. Error: `{ "error": { "code": "LOW_BALANCE", "message": "...", "details": {} } }`.
- Pagination: `?limit=20&cursor=<id>`; response includes `nextCursor` or `null`.
- All input validated with zod; unknown fields rejected.

### 4.4 Display IDs
- Transaction ID shown to users: `BW-` + ledger id zero-padded to 7 digits (e.g., `BW-0000123`).
- Match ID shown: `M` + id (e.g., `M45`).

### 4.5 Standard validations
| Field | Rule |
|---|---|
| Email | valid format, lowercased, max 254 |
| Name | 2-60 chars, letters/spaces/dots |
| Mobile | `^[6-9]\d{9}$` (10-digit Indian mobile) |
| Free Fire ID | digits only, 6-15 length |
| Free Fire Name | 1-30 chars |
| UPI ID | `^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z]{2,64}$` |
| UTR / transaction ID | `^[A-Za-z0-9]{10,25}$`, stored uppercase |
| PAN | `^[A-Z]{5}[0-9]{4}[A-Z]$` |
| Aadhaar | 12 digits |
| Date of birth | must be 18+ today |
| Screenshots | JPG/PNG/WebP, max 2 MB, content-type verified by magic bytes |

---

## 5. Authentication (applies to users, employees, admin)

### 5.1 OTP rules
- 6-digit numeric via `crypto.randomInt`. Store **HMAC-SHA256** hash only (`otp_requests.code_hash`).
- Expires in **10 minutes**. Max **5 wrong attempts** per OTP, then it is dead.
- Resend cooldown **60 seconds**. Max **5 OTP requests per email per hour**. Per-IP limit: 20 OTP requests per hour. Cooldown and hourly limits apply to every email, whether registered or not.
- OTP is single-use (`verified_at` set on success, and `consumed_at` set when registration completes).
- OTP email: plain text, subject "Your Booyah Win login code", body states the code and 10-minute expiry. Never log OTPs.
- `audience` column (`user` or `staff`) keeps user OTPs and staff OTPs separate.

### 5.2 Session rules (one device only)
- `sessions` table has `UNIQUE(account_type, account_id)`. Login does `INSERT ... ON CONFLICT (account_type, account_id) DO UPDATE SET id = <new uuid>`.
- Token = JWT `{ sub: accountId, typ: "user"|"staff", sid: <session uuid>, role }`, expiry 30 days (user) / 12 hours (staff).
- Auth middleware verifies JWT, loads the session row using both `typ` and `sub`, and rejects if `sid` differs: HTTP 401 `SESSION_REPLACED`. Missing/expired: 401 `UNAUTHENTICATED`. Reject wrong token type (`typ="user"` rejected on `/staff/*`, `typ="staff"` rejected on `/me`).
- Clients: on `SESSION_REPLACED`, clear token and show "You were logged out because your account was used on another device."
- Soft-deleted accounts: delete the session row and block login.
- Staff web uses `Authorization: Bearer <token>` (no cookie); User PWA uses `Authorization: Bearer` stored in memory + localStorage.

### 5.3 User registration (account exists only after the form is submitted)

1. `POST /auth/register/request-otp` `{ email }`
   - If email already belongs to a user: 409 `EMAIL_EXISTS` ("Already registered, please login").
   - Else create `otp_requests` row (`audience=user`, `purpose=register`), email OTP.
2. `POST /auth/register/verify-otp` `{ email, otp }`
   - On success returns `registrationToken` (JWT, 15 min, `{ email, otpId, purpose: "register" }`). Nothing is written to `users`.
3. `POST /auth/register/complete` `{ registrationToken, name, mobile, ffId, ffName, upiId, dateOfBirth, confirm18Plus: true, referralCode? }`
   - Validate everything (Section 4.5). Check uniqueness of email, mobile, ffId, upiId (case-insensitive). On conflict: 409 with field-specific code (`MOBILE_EXISTS`, `FF_ID_EXISTS`, `UPI_EXISTS`).
   - Referral code, if given, must exist and belong to a non-deleted user, else 400 `INVALID_REFERRAL`.
   - In ONE transaction: insert `users` (generate unique `referral_code`: 8 chars from `ABCDEFGHJKLMNPQRSTUVWXYZ23456789`), insert `wallets` (all zeros), insert `referrals` row if a code was used (`credited_at = NULL`), mark `otp_requests.consumed_at = now()`, create session.
   - Response: session token + profile. Client redirects to dashboard.
4. A token cannot be reused after completion (enforced by checking `consumed_at` on the OTP request row).

### 5.4 Login (users)
1. `POST /auth/login/request-otp` `{ email }`: always respond 200 with a generic message ("If this email is registered, an OTP has been sent"). Only send mail if the user exists and is not deleted. Rate limits tracked for all emails to prevent enumeration.
2. `POST /auth/login/verify-otp` `{ email, otp }`: on success replace session, return token. Failure: generic 400 `INVALID_OTP`.
3. `POST /auth/logout` deletes the session row.
4. `GET /me` returns profile, wallet summary.

### 5.5 Staff login (employees + admin)
Same flow under `/staff/auth/login/request-otp`, `/staff/auth/login/verify-otp`, `/staff/auth/logout`, `GET /staff/me`. Looks up the `staff` table (`audience=staff`). No self-registration; accounts are created by admin only.
- **Admin seeding:** one-time script `npm run seed:admin` reads `ADMIN_EMAIL`, `ADMIN_NAME`, and `ADMIN_MOBILE` from env and inserts a `staff` row with `role='admin'` if none exists. `ADMIN_MOBILE` is required (10-digit Indian mobile). The admin credentials are never hardcoded in source.

---

## 6. Wallets

Three wallets per user: `add_money`, `cashback`, `winning`.

| Wallet | Credited by | Withdrawable | Usable for entry fee |
|---|---|---|---|
| add_money | approved deposits | No | Yes |
| cashback | referral rewards | No | Yes, capped at **5% of the entry fee** per join |
| winning | match payouts | **Yes** | Yes |

### 6.1 Entry fee allocation algorithm (the only way fees are charged)
Work in integer paise. For entry fee `F`:
1. `cashbackPart = min(wallet.cashback, round_down(F × 0.05))`
2. `remaining = F − cashbackPart`
3. `fromAddMoney = min(wallet.add_money, remaining)`; `remaining −= fromAddMoney`
4. `fromWinning = min(wallet.winning, remaining)`; `remaining −= fromWinning`
5. If `remaining > 0` → reject with 402 `LOW_BALANCE` ("Low balance, please add money"). Nothing is charged.
6. Otherwise debit each wallet, write one ledger row per wallet used (type `join_fee`), and store the three amounts in `match_players.paid_add_money / paid_cashback / paid_winning`.

**Worked examples (entry fee ₹10):**
| cashback | add_money | winning | Result |
|---|---|---|---|
| 5.00 | 20.00 | 0 | cashback 0.50, add_money 9.50 |
| 0 | 20.00 | 0 | add_money 10.00 |
| 5.00 | 0 | 30.00 | cashback 0.50, winning 9.50 |
| 0 | 4.00 | 6.00 | add_money 4.00, winning 6.00 |
| 0 | 4.00 | 5.00 | `LOW_BALANCE` |

### 6.2 Refunds
A refund (match cancelled, team disbanded, invite expired) credits **exactly** the stored `paid_*` amounts back to the **same wallets**, writes `refund` ledger rows, and sets `refunded_at`. A row with `refunded_at` set must never be refunded twice.

### 6.3 Referrals
- Reward: **₹5 into the referrer's cashback wallet**.
- Credited exactly once, when the referred user's **first approved deposit OR first match join happens, whichever is first**. Set `referrals.credited_at`; ledger type `referral`.
- Referral code cannot be edited. Self-referral is impossible (code is chosen before the account exists, but also reject if the referrer shares mobile/UPI/ffId).

### 6.4 Transaction history (user)
`GET /wallet/transactions?type=&limit=&cursor=`
- Each item: `type`, `transactionId` (display ID), `createdAt`, `amount` (signed), `remainingAmount` (= `ledger.total_after`, total across all three wallets after the entry).
- Filter chips: **All, Add Money, Referral, Withdrawal, Joining Fee**, plus Winning and Refund. Mapping: `withdrawal` = `withdrawal_hold` + `withdrawal_refund`.

---

## 7. Add Money (manual QR payment)

### 7.1 User flow
1. User opens Add Money: sees payment QR image, the UPI ID text, min/max limits (`GET /payment-info`).
2. Pays outside the app, then fills the form: **amount**, **transaction ID (UTR)**, **payment screenshot**.
3. `POST /wallet/deposits` (multipart). Rules: amount within min/max; UTR unique (409 `UTR_EXISTS`); screenshot required; max **3 pending deposits** per user.
4. Status shown as Pending with the text "Verified within 30 minutes". `GET /wallet/deposits` lists own requests with status and rejection reason.

### 7.2 Staff flow
- `GET /staff/deposits?status=pending` (oldest first; highlight anything pending over 30 minutes). Screenshot via signed URL.
- `POST /staff/deposits/:id/approve`:
  - If `needs_admin` is true (amount ≥ `admin_approval_threshold`, set at creation) and caller is not admin → 403 `ADMIN_APPROVAL_REQUIRED`.
  - One transaction: lock deposit `FOR UPDATE`, require `status='pending'`, credit `add_money`, ledger `add_money`, set status approved + `reviewed_by`, trigger referral reward check (6.3), write audit log.
- `POST /staff/deposits/:id/reject` `{ reason }` (reason required, min 5 chars).
- A staff member cannot approve a deposit that belongs to their own user account if they also have one (compare emails). Return 403.

---

## 8. Withdrawals

### 8.1 User flow
- `POST /wallet/withdrawals` `{ amount, upiId, confirm: true }`
  - `amount ≥ 50` and `≤ winning` balance.
  - The UPI screen shows the saved UPI ID and requires the user to **re-enter and confirm** it. The server checks `upiId` equals the user's stored UPI (case-insensitive) and `confirm === true`.
  - Blocked for **48 hours after the last UPI change** (`users.upi_changed_at`): 403 `UPI_RECENTLY_CHANGED`.
  - Only **one pending withdrawal** at a time (409 `WITHDRAWAL_PENDING`).
  - One transaction: debit `winning`, ledger `withdrawal_hold`, insert request with `upi_id` snapshot, status `pending`.
- Message: "Withdrawals are settled within 24 hours."

### 8.2 Staff flow
- `GET /staff/withdrawals?status=pending` (oldest first, show UPI ID with copy button).
- `POST /staff/withdrawals/:id/mark-paid` `{ payoutRef }`: employee pays via their UPI app first, then records the UPI reference. Status `paid`. (No extra ledger row; the hold row is the user's visible withdrawal.)
- `POST /staff/withdrawals/:id/reject` `{ reason }`: credit amount back to `winning`, ledger `withdrawal_refund`, status `rejected`.
- Withdrawals ≥ `admin_approval_threshold` can only be marked paid by admin.
- All actions are audit logged.

---

## 9. Profile

`GET /me`, `PATCH /me/profile`

| Field | Editable? |
|---|---|
| Name | No |
| Email | No |
| Referral ID | No |
| Mobile | Once per 30 days |
| Free Fire ID | Once per 30 days |
| Free Fire Name | Once per 30 days |
| UPI ID | Once per 30 days (also starts the 48h withdrawal lock) |

- Each field has its own `*_changed_at`. If less than 30 days since the last change: 429 `FIELD_COOLDOWN` with `availableAt`.
- Sending a non-editable field → 400. Unchanged values are ignored (do not reset the cooldown).
- Uniqueness re-checked for mobile, ffId, upiId.
- **No delete-account endpoint exists for users.**
- Cannot change FF ID or FF name while the user is in a match with status `upcoming`, `room_open` or `live` (409 `IN_ACTIVE_MATCH`), to protect result entry.

---

## 10. Entry Tiers (admin-defined)

Admin creates tiers; employees choose from them. Tiers are never hardcoded.

### 10.1 Fields
| Field | Notes |
|---|---|
| gameMode | `battle_royale` or `clash_squad` |
| teamMode | solo / duo / squad for Battle Royale. Clash Squad is always `squad` (two teams of 4) |
| entryFee | required, > 0 |
| killPrice | required for Battle Royale; 0 for Clash Squad |
| minKillsForReward | default 2 |
| maxPlayers | BR: 48 default. CS: 8 (fixed) |
| minPlayers | BR default 24; CS 8 |
| positions | list of `{ position, prize }`, contiguous from 1 (e.g., booyah; or booyah+second+third+fourth). Clash Squad has only position 1 |

- Validation: unique among non-deleted tiers on (gameMode, teamMode, entryFee). Positions must be 1..N with no gaps, prizes ≥ 0.
- **Profit guard (warning only, not blocking):** show admin "Max possible payout vs. minimum collected". Max payout (BR) = sum of position prizes + `killPrice × (maxPlayers − 1)`. Minimum collected = `entryFee × minPlayers`. Warn if collected is less than max payout.
- Edit and delete are soft (`deleted_at`). **Editing never changes existing matches** because matches snapshot the rules.

### 10.2 Seed data
| Tier | Mode | Team | Fee | Kill price | Min kills | Max/Min players | Positions |
|---|---|---|---|---|---|---|---|
| 1 | Battle Royale | solo | ₹10 | ₹5 | 2 | 48 / 24 | 1: ₹50, 2: ₹40, 3: ₹30 |
| 2 | Clash Squad | squad | ₹50 | 0 | n/a | 8 / 8 | 1: ₹75 |

---

## 11. Matches

### 11.1 Lifecycle
```
upcoming ──> room_open ──> live ──> completed
    └────────────┴──────────┴──> cancelled
```
| Transition | Who | Rules |
|---|---|---|
| create → `upcoming` | employee/admin | start time must be in the future |
| → `room_open` | employee/admin | requires room ID + room password |
| → `live` | employee/admin | |
| → `completed` | automatic on result approval | |
| → `cancelled` | employee/admin before `live`; admin only once `live` | reason required, refunds everyone |

### 11.2 Match creation form (employee)
1. Select **Match mode** (Battle Royale / Clash Squad).
2. If Battle Royale: select **Team mode** (solo / duo / squad).
3. Select **Entry tier** (dropdown of active tiers matching mode and team mode).
4. Select **Start time**.
5. Create. The API copies the tier into the match (snapshot: `entry_fee`, `kill_price`, `min_kills_for_reward`, `position_prizes` JSON, `max_players`, `min_players`).

### 11.3 Employee match list
`GET /staff/matches?status=&gameMode=&teamMode=&from=&to=`: filters are all optional and combinable. Each row shows joined count, status, start time, and actions (open room, go live, cancel, add result).

### 11.4 User match list
`GET /matches` returns matches with status `upcoming`, `room_open`, `live`. Each card shows: game mode, team mode, entry fee, prizes (positions, kill price and "minimum 2 kills to earn kill reward"), joined/max players, start time, status, and whether the current user has joined.
- `room_id` and `room_password` are returned **only** to users who have joined, and only when status is `room_open` or `live`.
- If the user's usable balance is below the entry fee, the Join button shows "Low balance, please add money" and links to Add Money. (The server enforces this too.)

### 11.5 Joining (solo Battle Royale)
`POST /matches/:id/join`: one DB transaction:
1. Lock match `FOR UPDATE`; lock the user's wallet.
2. Require status `upcoming` or `room_open`, and `start_time` not passed.
3. Reject if confirmed player count ≥ `max_players` (409 `MATCH_FULL`).
4. Run the allocation algorithm (6.1); on shortfall 402 `LOW_BALANCE`.
5. Insert `match_players` (UNIQUE `(match_id, user_id)` → 409 `ALREADY_JOINED`).
6. Debit wallets, write ledger rows.
7. Trigger referral reward check (first match).

A user can join a match **only once**, and cannot join if their account is deleted.

### 11.6 Teams (duo, squad, Clash Squad)
Team size: duo 2, squad 4, Clash Squad 4 (two teams per match; each team fills 4 of the 8 seats).

**Team form (leader):** `POST /matches/:id/teams` `{ teamName?, memberFfIds: [...] }`
- `memberFfIds` has `size − 1` entries; each must be a registered, non-deleted user, not the leader, not already in this match, no duplicates.
- One transaction: check capacity for the **whole team** (seats reserved immediately), charge the leader's entry fee (6.1), create `teams` row (`status='forming'`), `match_players` row for the leader, and a `team_invites` row per teammate (`pending`).
- Capacity rule: reserved seats = confirmed players + seats of forming teams.

**Teammate side:** `GET /me/team-invites`, `POST /team-invites/:id/accept`, `POST /team-invites/:id/decline`.
- Accept: one transaction, charge that user's entry fee (6.1) and add their `match_players` row. Fails with `LOW_BALANCE` if they cannot pay. When all invites are accepted, set team `status='confirmed'`.
- Decline or expiry: the seat stays reserved until the cutoff (below), so the leader may invite a replacement: `POST /matches/:id/teams/mine/replace` `{ oldFfId, newFfId }`.

**Cutoff (10 minutes before start time):** any team still `forming` is disbanded by the scheduler: all paid entries refunded exactly (6.2), pending invites set to `expired`, seats released.
- Leader may disband earlier: `DELETE /matches/:id/teams/mine` (refund all paid members).
- Clash Squad: the match starts only with 2 `confirmed` teams.

### 11.7 Auto-cancel
At `start_time`, if confirmed players < `min_players` (Clash Squad: fewer than 2 confirmed teams), the scheduler cancels the match and refunds everyone (reason: "Not enough players").

### 11.8 Match cancel (manual)
`POST /staff/matches/:id/cancel` `{ reason }`: one transaction: lock match, status check, refund every `match_players` row not yet refunded using stored `paid_*` amounts, set `matches.status='cancelled'`, disband teams, audit log.

---

## 12. Match Results and Payouts

### 12.1 Submission (employee)
Employee opens a match (status `live`) and clicks **Add Result**.

**Form, Battle Royale:** a row for every confirmed player, pre-filled `kills=0`, `position=Lost`. Each row: player (display `FFName (FFID)`), **Kills** (integer ≥ 0), **Position** dropdown (Booyah, Second, Third, ... up to the tier's positions, plus **Lost**). Plus a required **match result screenshot** upload.

**Form, Clash Squad:** choose the **winning team** (dropdown of the 2 teams). Plus the required screenshot.

`POST /staff/matches/:id/result` (multipart: `entries` JSON + `screenshot`). Creates/updates `match_results` with status `pending_approval`. **No money moves yet.**

### 12.2 Validation (server)
- Every entry's player is a confirmed member of this match; no duplicates.
- Non-lost positions are unique and exist in the match's `position_prizes`; exactly one position 1 must exist.
- `0 ≤ kills ≤ confirmedPlayers − 1`, and the sum of all kills ≤ `confirmedPlayers − 1`.
- Clash Squad: winning team belongs to the match.
- Screenshot present and valid.

### 12.3 Approval (admin)
- Employees can only submit. **Admin** approves or rejects (`POST /admin/results/:matchId/approve`, `/reject {reason}`). Admin may also submit and approve their own entry in one action (audit logged).
- Rejected results go back to the employee, who can fix and resubmit (same row, back to `pending_approval`; keep the old version in audit log).
- Approved results are **locked**. One result row per match (UNIQUE `match_id`), approving is idempotent (second approve → 409).

### 12.4 Payout calculation (on approval, one transaction)
**Battle Royale**, per player entry with kills `k`, position `p`:
```
killReward     = (k >= min_kills_for_reward) ? k * kill_price : 0
positionPrize  = position_prizes[p] or 0
```
- Solo: the player receives `killReward + positionPrize`.
- Duo/Squad: `killReward` goes to the individual player who got the kills; `positionPrize` goes to the **team leader**.

**Clash Squad:** the winning team's **leader** receives `position_prizes[1]` (₹75). Everyone else receives nothing.

**Examples (solo ₹10 tier: kill ₹5, min 2 kills, prizes 50/40/30):**
| Player | Kills | Position | Payout |
|---|---|---|---|
| A | 5 | Booyah | 25 + 50 = **₹75** |
| B | 6 | Lost | 30 + 0 = **₹30** |
| C | 1 | Second | 0 + 40 = **₹40** |
| D | 1 | Lost | **₹0** |

For each payout: credit `winning` wallet, write one `winning` ledger row (ref = match), store `kills`, `position`, `payout` on `match_players`, set match `completed`. Deleted users are skipped (payout recorded as 0).

### 12.5 Reversal (mistakes after approval)
`POST /admin/results/:matchId/reverse` `{ reason }`: debits the previously paid amounts from `winning` wallets with ledger type `reversal`, sets the match back to `live` and the result to `rejected`. If any user's `winning` balance is too low, the whole reversal fails with the list of affected users (admin settles manually via balance adjustment). Never edit ledger rows or past payouts.

---

## 13. History (user)

### 13.1 Transaction history: see 6.4.

### 13.2 Match history
`GET /me/match-history?gameMode=&teamMode=&limit=&cursor=`
| Game mode | Fields shown |
|---|---|
| Battle Royale | Match ID, team mode, entry fee, **kills**, **position** (Booyah / Second / Third / Lost) |
| Clash Squad | Match ID, team mode (squad), entry fee, **Booyah** or **Lost** |

- Matches still in progress show "Result pending"; cancelled matches show "Cancelled (refunded)".
- Filters: game mode (Battle Royale / Clash Squad) and team mode (solo / duo / squad), combinable.

---

## 14. Support / Contact Page

`GET /support` returns the shared support contact (name, phone, email, hours) from `app_settings`. **Individual employee numbers are not exposed.** Admin edits these in Settings.

---

## 15. Staff Portal: Employee Area

Pages (all require staff login):
1. **Dashboard:** counts of pending deposits, pending withdrawals, live/upcoming matches; the oldest pending deposit highlighted if over 30 min.
2. **Matches:** list with filters, Create Match form (11.2), match detail (players, teams), actions: Open Room (room ID + password), Go Live, Cancel (reason), Add Result (12.1).
3. **Deposits queue** (Section 7.2).
4. **Withdrawals queue** (Section 8.2).

Employees **cannot**: view PAN/Aadhaar, create tiers, approve results, adjust balances, delete users, manage staff.

---

## 16. Staff Portal: Admin Area

Admin sees everything employees see, plus:

### 16.1 Employee management
- **Create employee:** Name (required), Mobile (required), Email (required, unique), PAN (optional), Aadhaar (optional).
- PAN/Aadhaar are encrypted with AES-256-GCM (`FIELD_ENCRYPTION_KEY`, random IV per value) and **always returned masked** (last 4 characters visible, e.g., `XXXX XXXX 1234`). To change them, admin re-enters the full value; leaving blank keeps the existing one.
- **Edit** all fields. **Delete** = soft delete (`deleted_at`) and kill the session.
- **List with filter** by name or email (case-insensitive `ILIKE`, paginated).
- Admin cannot create other admins or delete themselves.

### 16.2 Entry tier management: Section 10 (create, edit, delete, list).

### 16.3 User management
- `GET /admin/users?q=` search by name or email (also accept mobile/FF ID).
- User detail: profile, three wallet balances, recent ledger, match history.
- **Delete user** `DELETE /admin/users/:id` `{ reason }`: reason required (min 5 chars, e.g., "Cheating"). Soft delete: set `deleted_at`, `deleted_reason`, `deleted_by`; remove session; user can no longer log in. Ledger and history are kept. The deleted user's balance is left as is (no action required). Pending deposits/withdrawals stay visible to staff.
- **Balance adjustment** `POST /admin/users/:id/adjust` `{ wallet, amount, reason }`: signed amount, ledger type `admin_adjustment`, audit logged. Cannot make a wallet negative.

### 16.4 Result approvals: Section 12.3. Reversal: 12.5.

### 16.5 Settings
Edit `app_settings`: support contact, payment QR image (upload), payment UPI ID, min/max deposit, admin approval threshold.

### 16.6 Audit log
`GET /admin/audit-logs?staffId=&action=&from=&to=`. Every staff action that touches money, matches, users or staff writes an `audit_logs` row (who, action, target, details JSON).

---

## 17. Scheduler (`POST /internal/jobs/tick`, header `x-cron-secret`)

Runs idempotently every 5 minutes:
1. Delete `otp_requests` older than 1 day.
2. Disband forming teams past the 10-minute-before-start cutoff and refund (11.6).
3. Auto-cancel under-filled matches past `start_time` (11.7).
4. Expire stale `team_invites`.

Each job runs inside transactions and is safe to run twice at once (use row locks, `FOR UPDATE SKIP LOCKED` where appropriate).

---

## 18. Security Checklist

- Parameterized SQL only; zod validation on every endpoint.
- `helmet`, strict CORS allowlist, request body size limits (1 MB JSON).
- Rate limits: global 100 req/min/IP; OTP endpoints per 5.1; join/deposit/withdrawal 10 req/min/user.
- File uploads: size and magic-byte checks, random object names, private bucket, signed URLs (60 s) for staff.
- Secrets only in env vars. `.env` in `.gitignore`. Never log OTPs, tokens, PAN, Aadhaar.
- Role guards: `requireUser`, `requireStaff`, `requireAdmin`. Every staff endpoint re-checks role server-side.
- Users can only read their own rows (always filter by `req.user.id`).
- Audit logs are append-only (no update/delete endpoints).
- Operator note: legal and regulatory compliance for operating a paid-entry gaming service in India (including the Promotion and Regulation of Online Gaming Act, 2025) is the operator's responsibility and is **not** handled by this software.

---

## 19. Testing Requirements

The AI must write and pass these before moving on:

**Wallet and money**
- Allocation table in 6.1 (all five rows) plus edge cases: fee ₹0.50, cashback less than the 5% cap, all wallets zero.
- Parallel joins: 60 simultaneous joins on a 48-seat solo match → exactly 48 succeed, 12 get `MATCH_FULL`, no negative wallets.
- Two simultaneous joins by the same user with enough money for only one → exactly one succeeds.
- Cancel refund returns the exact `paid_*` amounts to the exact wallets; calling cancel twice refunds once.
- Withdrawal hold and reject round trip leaves the balance unchanged.

**Auth**
- OTP expiry, 5-attempt lockout, resend cooldown, hourly limit.
- Registration does **not** create a `users` row until `complete` succeeds.
- New login invalidates the old token (`SESSION_REPLACED`).
- Staff OTP cannot be used on the user endpoint and vice versa.

**Rules**
- UTR duplicate rejected; deposit above threshold needs admin.
- Profile 30-day cooldowns; non-editable fields rejected; UPI change blocks withdrawal for 48h.
- Referral reward credited exactly once on first approved deposit or first join.
- Result validation (duplicate players, duplicate positions, kills too high) and payout examples in 12.4.
- Approving a result twice does not double-pay.
- Deleted user cannot log in; ledger history preserved.

---

## 20. Build Order (milestones)

0. **Setup:** monorepo, TypeScript, lint, migrations from `booyah_win_schema.sql`, config, logger, error handler, `.env.example`.
1. **Auth:** OTP, sessions, user registration/login, staff login, admin seed script, middleware.
2. **Staff & settings:** admin employee CRUD (encrypted PAN/Aadhaar), settings, audit logging helper.
3. **Entry tiers:** admin CRUD, seed data, profit-guard warning.
4. **Wallet core:** ledger service (allocation, credit, debit, refund), deposits (user + staff), withdrawals (user + staff), referrals, transaction history.
5. **Matches:** create/list/filter, open room, go live, cancel + refunds, user list, solo join.
6. **Teams:** team form, invites, accept/decline, replace, disband, scheduler jobs.
7. **Results:** submission, validation, admin approval, payouts, reversal.
8. **History & profile:** match history, profile edit rules, support page.
9. **User PWA** screens (Section 21.1) against the real API.
10. **Staff Portal** screens (Section 21.2).
11. **Hardening & deploy:** rate limits, full test run, README with deploy steps (Render, Vercel/Netlify, Neon/Supabase, cron-job.org), manual `pg_dump` backup instructions.

---

## 21. Screens

### 21.1 User PWA (mobile-first, bottom navigation)
1. **Login:** email → OTP → dashboard. "New here? Register" uses the same email → OTP step, then the registration form.
2. **Registration form:** Name, Mobile, Free Fire ID, Free Fire Name, UPI ID, Date of Birth, 18+ checkbox, Referral ID (optional).
3. **Home:** wallet summary (3 wallets + total), ongoing matches.
4. **Matches:** list, match detail (prizes, rules, room details after joining), Join / team form for duo, squad, Clash Squad.
5. **Team invites:** pending invites with Accept / Decline and entry fee shown.
6. **Wallet:** three balances, Add Money, Withdraw, pending requests with status.
7. **Add Money:** QR image, UPI ID, form (amount, UTR, screenshot).
8. **Withdraw:** amount, confirm UPI ID dialog (re-enter and confirm), 24-hour message, 50 minimum.
9. **History:** two tabs (Transactions, Matches) with filter chips.
10. **Profile:** editable fields with cooldown hints ("Next change available on ..."), locked fields shown greyed out.
11. **Support:** shared contact details.
12. **Global:** "logged out on another device" dialog, low-balance prompt, offline notice (PWA).

### 21.2 Staff Portal
- Login (OTP), role-based sidebar.
- Employee pages: Dashboard, Matches (list, create, detail, add result), Deposits, Withdrawals.
- Admin-only pages: Employees, Entry Tiers, Users, Result Approvals, Settings, Audit Log.

---

## 22. Error Codes

`UNAUTHENTICATED`, `SESSION_REPLACED`, `FORBIDDEN`, `ADMIN_APPROVAL_REQUIRED`, `VALIDATION_ERROR`, `INVALID_OTP`, `OTP_RATE_LIMITED`, `EMAIL_EXISTS`, `MOBILE_EXISTS`, `FF_ID_EXISTS`, `UPI_EXISTS`, `INVALID_REFERRAL`, `FIELD_COOLDOWN`, `IN_ACTIVE_MATCH`, `LOW_BALANCE`, `UTR_EXISTS`, `DEPOSIT_LIMIT`, `WITHDRAWAL_PENDING`, `UPI_RECENTLY_CHANGED`, `MATCH_FULL`, `ALREADY_JOINED`, `MATCH_NOT_JOINABLE`, `TEAM_INVALID`, `INVITE_EXPIRED`, `RESULT_INVALID`, `RESULT_LOCKED`, `NOT_FOUND`, `RATE_LIMITED`, `INTERNAL_ERROR`.

---

## 23. Assumptions Made (confirm or change)

1. User app is a **PWA** (no Play Store fee). It can later be wrapped for the Play Store.
2. Entry-fee allocation falls through cashback (capped 5%) → add_money → winning, and may split across add_money and winning.
3. Kill rewards: a player with 2 or more kills is paid for **all** their kills; with 1 kill, nothing.
4. In team modes, the position prize goes to the **team leader**; kill rewards go to the individual killer. In Clash Squad only the winning team's leader is paid.
5. Teammates pay their own entry fees when they accept the invite.
6. Min players: BR 24, CS 8 (admin editable per tier).
7. Deposit limits ₹10-₹5,000 and admin approval threshold ₹2,000 (admin editable).
8. Withdrawal lock after UPI change: 48 hours.
9. A deleted user's pending match payouts are skipped.

## 24. Out of Scope (v1)

Push notifications, in-app chat, automatic payment gateway, KYC, TDS handling, automatic result import from the game, multi-language UI, native Android/iOS builds.

---

## 25. Definition of Done

- [ ] All milestones complete and every test in Section 19 passes.
- [ ] No money calculation uses floating-point numbers.
- [ ] Every wallet change has a matching ledger row, inside one transaction.
- [ ] The concurrency tests pass repeatedly (run them 10 times).
- [ ] No secrets in the repo; `.env.example` is complete.
- [ ] README explains local setup, migrations, admin seeding, zero-cost deployment and backups.
- [ ] The AI lists every deviation and assumption in its final message.
