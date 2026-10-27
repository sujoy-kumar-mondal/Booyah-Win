# Booyah Win

Booyah Win is a high-reliability, zero-running-cost tournament platform designed for competitive Free Fire players. Players participate in custom room matches using wallet balances to win cash prizes, backed by strict financial invariants, automated room credential management, and anti-cheat operations.

---

## 1. Architecture & Tech Stack

Booyah Win is architected as an enterprise-grade TypeScript monorepo with zero floating-point financial math, automated database migrations, and a complete suite of mobile and desktop web applications.

```
booyah-win/
├── apps/
│   ├── api/             # Express.js REST API with PostgreSQL backend
│   ├── user-pwa/        # React 18 + Vite Player Progressive Web App (mobile-first)
│   └── staff-portal/    # React 18 + Vite Staff Operations & Admin Dashboard
├── packages/
│   └── shared/          # Shared domain types, Zod schemas, error codes & constants
├── docs/                # Comprehensive API reference & contract fixtures
├── deploy/              # Cloud production deployment guides & RLS SQL scripts
└── scripts/             # Smoke tests and environment check utilities
```

### 1.1 Backend API (`apps/api`)
- **Runtime**: Node.js 20 LTS, TypeScript (strict mode)
- **API Framework**: Express.js, `zod` input validation, `helmet` security headers, `cors`, `express-rate-limit`
- **Database Engine**: PostgreSQL 15+ via `pg` (parameterized queries, explicit transaction row locking `FOR UPDATE`, `statement_timeout = 30000ms`, `lock_timeout = 8000ms`)
- **Financial Arithmetic**: Strict integer paise internally (`100 paise = ₹1.00`), stored as `NUMERIC(12,2)` in PostgreSQL; zero JavaScript IEEE-754 floats
- **Database Migrations**: `node-pg-migrate`
- **Authentication**: Passwordless Email + OTP with HMAC-SHA256 verification and single-device JWT sessions
- **Email Delivery**: Dual-mode email infrastructure:
  - **Brevo HTTPS REST API** (`BREVO_API_KEY`): Recommended for cloud platforms like Render to bypass outbound SMTP port blocking.
  - **Gmail SMTP** (`GMAIL_USER`, `GMAIL_APP_PASSWORD`): Standard SMTP delivery for local development.
- **File Storage**: Supabase Storage private bucket with time-limited signed URLs (60s validity)
- **Structured Logging**: `pino` with automatic redaction of tokens, OTPs, passwords, PAN, Aadhaar, UPI IDs, and screenshot paths

### 1.2 Player Progressive Web App (`apps/user-pwa`)
- **Framework**: React 18, Vite, TypeScript
- **Styling**: Tailwind CSS with an esports cyberpunk dark theme
- **Localization**: Full English (`en`) and Bengali (`bn`) translation parity with backend-synced user preference
- **Offline & PWA**: Service Worker with asset caching and immediate updates via Workbox
- **Icons**: Lucide React

### 1.3 Staff & Operations Portal (`apps/staff-portal`)
- **Framework**: React 18, Vite, Tailwind CSS
- **Authentication**: Staff email + OTP with step-up elevation for destructive operations (user deletion, balance adjustment, result reversal)
- **Tournament Lifecycle**: Match creation, automated room ID/password disclosure 15 minutes before start, result recording, and prize payouts

---

## 2. Platform Features

### 2.1 Player Experience
- **Esports Dark Theme**: High-contrast, mobile-first esports design optimized for fast touch interactions and responsive viewports.
- **Persistent Player Top Bar**: Displays avatar with smart initials fallback (e.g. `SKM` for "Sujoy Kumar Mondal"), username, live wallet pill with one-tap deposit access, Help & Support icon, and notifications bell.
- **Auto-Sliding Promotional Carousel**: Dynamic tournament announcement banners with touch swipe, auto-slide interval, and indicator dots.
- **Important Notice Ticker**: Live marquee announcement bar for rule updates (e.g. sniper weapon bans) with full dialog viewer.
- **Match Lobby Cards**: Real-time badges for `BATTLE ROYALE | DUO`, `CLASH SQUAD | SQUAD`, `SOLO`, dynamic countdown badges (`in 51m`, `Live`, `Room Open`), prize pool and per-kill prize breakdown, entry fee, team status, and real-time player capacity bar.
- **Jitter-Free Bottom Navigation**: Solid 5-column CSS grid navigation (`Home`, `Matches`, `Ranks`, `Wallet`, `Account`) with zero layout shift when switching tabs.
- **Customer Support Integration**: Dedicated support hub (`/support`) with one-tap WhatsApp chat, direct phone calling, and email support links.
- **Native Android APK Download**: Direct APK download button and banner for `Booyah_Win.apk` via GitHub Releases or hosted storage.

### 2.2 Financial & Integrity Engine
- **Triple-Wallet System**: Separate balances for `Add Money` (deposits), `Cashback` (bonus funds), and `Winning` (tournament earnings).
- **Priority Deduction**: Match entry fees deduct automatically from Cashback first, then Add Money, and finally Winning balances.
- **Manual UPI Deposits**: Players upload payment screenshots and UTR transaction references; duplicate UTR checks prevent double-crediting.
- **Two-Stage Withdrawals**: Staff verify withdrawal requests before marking them paid; held amounts are locked in the winning wallet and automatically restored on rejection.
- **Anti-Sniping Room Security**: Custom room ID and password are strictly quarantined and only revealed to joined players 15 minutes before the scheduled match start time.

---

## 3. Monorepo Scripts Reference

| Command | Workspace | Description |
|---|---|---|
| `npm run dev:api` | `apps/api` | Starts backend Express API development server on `http://localhost:3000` |
| `npm run dev:pwa` | `apps/user-pwa` | Starts Player PWA development server on `http://localhost:5173` |
| `npm run dev:staff` | `apps/staff-portal` | Starts Staff Portal development server on `http://localhost:5174` |
| `npm run test` | `apps/api` | Runs API unit and integration test suite against `TEST_DATABASE_URL` (490+ tests) |
| `npm run test:pwa` | `apps/user-pwa` | Runs Player PWA component and contracts parity test suite (285 tests) |
| `npm run test:staff` | `apps/staff-portal` | Runs Staff Portal UI and contracts parity test suite |
| `npm run test:all` | Root | Runs all backend and frontend test suites across the monorepo |
| `npm run build` | Root | Compiles all packages and builds production bundles for API and both frontends |
| `npm run build:api` | `apps/api` | Compiles `packages/shared` and builds the backend API |
| `npm run build:frontends` | Frontends | Builds production distribution bundles for `user-pwa` and `staff-portal` |
| `npm run migrate:dev` | `apps/api` | Applies pending database migrations to development database |
| `npm run migrate:test` | `apps/api` | Applies migrations to test database (enforces `_test` suffix) |
| `npm run seed:admin` | `apps/api` | Seeds initial administrator account from environment variables |
| `npm run seed:settings` | `apps/api` | Seeds platform business settings and support contact details |
| `npm run seed:tiers` | `apps/api` | Seeds standard entry tiers and tournament prize structures |
| `npm run check:env` | `apps/api` | Validates live connection to Database, Supabase Storage, and Email delivery |
| `npm run smoke` | Root | Runs live end-to-end smoke tests against a running API server |

---

## 4. Prerequisites

- **Node.js**: `20.x` LTS
- **npm**: `10.x` or higher
- **PostgreSQL**: `15+` running locally for development and test execution

---

## 5. Local Setup

### 5.1 Clone & Install Dependencies

```bash
git clone https://github.com/sujoy-kumar-mondal/Booyah-Win.git
cd booyah-win
npm install
```

### 5.2 Configure Environment Variables

Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```

> **Security Rule**: Never commit `.env` to git. Ensure `.env` is listed in `.gitignore`. Never inspect or edit real `.env` files in automated pipelines.

Set your local database URLs and generate random secrets:
- `DATABASE_URL`: `postgresql://postgres:postgres@localhost:5432/booyah_win_dev`
- `TEST_DATABASE_URL`: `postgresql://postgres:postgres@localhost:5432/booyah_win_test`
- Generate random 64-character strings for `JWT_SECRET`, `OTP_HMAC_SECRET`, and `FILE_URL_SECRET`:
  ```bash
  node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
  ```
- Generate a 32-byte base64 string for `FIELD_ENCRYPTION_KEY`:
  ```bash
  node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
  ```

### 5.3 Create Local Databases & Run Migrations

Create the two local PostgreSQL databases:
```bash
psql -U postgres -c "CREATE DATABASE booyah_win_dev;"
psql -U postgres -c "CREATE DATABASE booyah_win_test;"
```

Run database migrations:
```bash
# Migrate development database
npm run migrate:dev

# Migrate test database (safety check enforces _test suffix)
npm run migrate:test
```

### 5.4 Seed Initial Data

```bash
# Seed initial admin account from ADMIN_EMAIL, ADMIN_NAME, ADMIN_MOBILE
npm run seed:admin

# Seed business settings (min/max deposit, approval threshold, contact info)
npm run seed:settings

# Seed standard entry tiers (Battle Royale & Clash Squad tiers and prizes)
npm run seed:tiers
```

### 5.5 Start Development Servers

Run the backend API:
```bash
npm run dev:api
```
The API starts at `http://localhost:3000`. In development mode, OTP codes are logged directly to the terminal console.

In separate terminals, start the frontend applications:
```bash
# Player PWA
npm run dev:pwa

# Staff Operations Portal
npm run dev:staff
```

---

## 6. Running Tests

Booyah Win includes comprehensive integration tests with strict concurrency, financial invariants, and state-machine tests.

```bash
# Run backend API integration tests
npm test

# Run Player PWA tests (including contracts parity)
npm run test:pwa

# Run Staff Portal tests
npm run test:staff

# Run all tests across the monorepo
npm run test:all
```

### Safety Invariants
1. **Isolated Test Database**: All tests execute strictly against `TEST_DATABASE_URL`. The test harness verifies that the database name ends with `_test` and points to a local host (`localhost` or `127.0.0.1`), refusing to run against remote databases.
2. **Contract Parity**: Frontend test suites validate mock data against actual `docs/contracts/*.json` fixtures.
3. **API Documentation Parity**: `apps/api/tests/api_docs_parity.test.ts` verifies that every Express route is documented in `docs/API.md`.

---

## 7. Android App Distribution (`Booyah_Win.apk`)

Booyah Win can be distributed as a native Android APK or installed as a Progressive Web App (PWA):

1. **APK File Location**: The standalone APK binary is located at [`Booyah_Win.apk`](file:///Booyah_Win.apk) in the repository and uploaded to GitHub Releases:
   ```
   https://github.com/sujoy-kumar-mondal/Booyah-Win/blob/main/Booyah_Win.apk
   ```
2. **Enabling the Download Banner in the PWA**:
   Configure the environment variable `VITE_APP_DOWNLOAD_URL` with the direct HTTPS link to the `.apk` file:
   ```env
   VITE_APP_DOWNLOAD_URL=https://github.com/sujoy-kumar-mondal/Booyah-Win/releases/download/v1.0.0/Booyah_Win.apk
   ```
   When configured, the User PWA automatically displays a prominent "Download Android App" banner on mobile devices.

---

## 8. Email Delivery Configuration

Booyah Win supports dual email delivery strategies:

1. **Brevo HTTPS REST API (Recommended for Cloud Hosting)**:
   - Cloud platforms such as Render block outbound SMTP ports (`25`, `465`, `587`) on free tiers.
   - Set `BREVO_API_KEY` to your Brevo API key (`xkeysib-...`).
   - The application automatically delivers OTP emails via `https://api.brevo.com/v3/smtp/email` over standard HTTPS (port 443), completely bypassing port restrictions.
2. **Gmail SMTP (Local Development)**:
   - Configure `GMAIL_USER` and `GMAIL_APP_PASSWORD` (16-character Google App Password).
   - In local development (`NODE_ENV=development`), OTPs are additionally printed directly to the server console.

---

## 9. Live Environment Connection Check

Before deploying or running in production, test all live connections:

```bash
npm run check:env
```

To test email delivery and send an actual verification email:
```bash
npm run check:env -- --send-to=your-email@example.com
```

The script verifies:
1. **PostgreSQL Database**: Connects and runs `SELECT 1` (validates session pooler port 5432).
2. **Supabase Storage**: Uploads and deletes a probe file in the private storage bucket.
3. **Email Delivery**: Tests Brevo HTTPS API or Gmail SMTP authentication.
4. Output prints strictly `[PASS]` or `[FAIL]` per service with sanitized diagnostic reasons. Never prints credentials or secrets.

---

## 10. Zero-Cost Production Deployment Guide

Follow this guide to host Booyah Win at $0/month.

### Step A: Supabase Setup (Database & Storage)

1. Sign up at [supabase.com](https://supabase.com) and create a free project.
2. **Database Connection Settings**:
   - Go to **Project Settings** -> **Database** -> **Connection Pooling**.
   - Select **Session Pooler** on **Port 5432**.
   - **CRITICAL**: Do **NOT** use the transaction pooler on port 6543. Booyah Win relies on session variables (`statement_timeout = 30000`, `lock_timeout = 8000`) and explicit transaction locking (`FOR UPDATE SKIP LOCKED`), which require session pooling. The production startup check strictly refuses connections containing `:6543`.
3. **Storage Bucket**:
   - Go to **Storage** -> **New Bucket**.
   - Bucket name: `booyah-private`.
   - Toggle **Public bucket** to **OFF** (private bucket).
   - Under bucket settings, allow maximum file size of 2 MB and MIME types: `image/jpeg`, `image/png`, `image/webp`.

### Step B: First-Deploy Checklist

Execute these steps in order when setting up production:

1. **Run Migrations against Supabase**:
   ```bash
   DATABASE_URL="postgresql://postgres.[ref]:[password]@aws-0-[region].pooler.supabase.com:5432/postgres" npm run migrate:dev
   ```
2. **Seed Initial Admin**:
   ```bash
   ADMIN_EMAIL="owner@example.com" ADMIN_NAME="Admin" ADMIN_MOBILE="9876543210" npm run seed:admin
   ```
3. **Seed Business Settings**:
   ```bash
   npm run seed:settings
   ```
4. **Seed Entry Tiers**:
   ```bash
   npm run seed:tiers
   ```
5. **Enable Row Level Security (RLS)**:
   - In Supabase Dashboard, open the **SQL Editor**.
   - Copy and execute the contents of `deploy/enable_rls.sql`.
   - This enables RLS on all 18 tables in the `public` schema. The API connects as the PostgreSQL superuser/owner which automatically bypasses RLS, but direct client querying with the Supabase `anon` key is completely blocked.
6. **Verify Connections**:
   ```bash
   npm run check:env
   ```

### Step C: Deploy API to Render (Free Web Service)

1. Sign up at [render.com](https://render.com) and click **New** -> **Web Service**.
2. Connect your repository.
3. Configure settings:
   - **Environment**: Node
   - **Build Command**: `npm install && npm run build:api`
   - **Start Command**: `npm run start:api`
   - **Health Check Path**: `/health`
4. Add Environment Variables:
   - `NODE_ENV`: `production`
   - `PORT`: `10000`
   - `DATABASE_URL`: `postgresql://postgres.[ref]:[password]@...:5432/postgres` (Session pooler port 5432)
   - `DATABASE_SSL`: `true`
   - `DATABASE_SSL_CA_BASE64`: (Base64-encoded Supabase CA PEM certificate)
   - `JWT_SECRET`: (64-character random string)
   - `OTP_HMAC_SECRET`: (64-character random string)
   - `FIELD_ENCRYPTION_KEY`: (32-byte base64 string)
   - `FILE_URL_SECRET`: (64-character random string)
   - `BREVO_API_KEY`: (Brevo API key) or `GMAIL_USER` + `GMAIL_APP_PASSWORD`
   - `SUPABASE_URL`: `https://[ref].supabase.co`
   - `SUPABASE_SERVICE_KEY`: `eyJ...` (Secret service_role key)
   - `STORAGE_BUCKET`: `booyah-private`
   - `CRON_SECRET`: (64-character random string)
   - `CORS_ORIGINS`: `https://your-user-app.pages.dev,https://your-staff-portal.pages.dev` (No wildcards)

### Step D: Deploy Frontends (Cloudflare Pages / Netlify / Vercel)

Both frontend applications (`apps/user-pwa` and `apps/staff-portal`) are static single-page apps that can be hosted on Cloudflare Pages or Netlify for free:
- **Build Command**: `npm run build:frontends`
- **Output Directories**:
  - User PWA: `apps/user-pwa/dist`
  - Staff Portal: `apps/staff-portal/dist`
- **Build Environment Variables**:
  - `VITE_API_ORIGIN`: `https://your-api.onrender.com`
  - `VITE_STORAGE_ORIGIN`: `https://your-ref.supabase.co`
  - `VITE_API_URL`: `https://your-api.onrender.com`
  - `VITE_APP_DOWNLOAD_URL`: (Optional APK download URL)

### Step E: External Cron Setup (cron-job.org)

Render's free tier spins down after 15 minutes of inactivity. Use cron-job.org to keep it awake and trigger the periodic background scheduler:

1. Register at [cron-job.org](https://cron-job.org).
2. Create a new cron job:
   - **Title**: `Booyah Win Scheduler Tick`
   - **URL**: `https://<your-render-app>.onrender.com/internal/jobs/tick`
   - **Schedule**: Every 5 minutes (`*/5 * * * *`)
   - **HTTP Method**: `POST`
   - **Headers**:
     - `x-cron-secret`: `<CRON_SECRET>`
3. What `/internal/jobs/tick` does:
   - Disbands unconfirmed forming teams 10 minutes before match start and refunds paid players.
   - Cancels upcoming matches that didn't meet minimum players at start time and refunds all joined players.
   - Expires stale team invites.
   - Cleans up expired OTP records older than 24 hours.
   - Keeps Render awake with regular traffic.

---

## 11. Database Backups & Privacy Notice

### Privacy & Data Protection Notice
> **IMPORTANT**: Booyah Win database backups contain sensitive personal data (names, mobile numbers, Free Fire IDs, UPI IDs) and encrypted government identity numbers (AES-256-GCM encrypted PAN and Aadhaar).
> - **Keep backups strictly private and encrypted.**
> - **NEVER store, commit, or push database dumps into git repositories or public storage.**

### Manual Backups (`pg_dump`)
The operator can perform periodic manual backups using `pg_dump`:

```bash
pg_dump -h aws-0-[region].pooler.supabase.com -p 5432 -U postgres.[ref] -d postgres -F c -b -v -f booyah_backup_$(date +%Y%m%d).dump
```

To restore from a backup:
```bash
pg_restore -h aws-0-[region].pooler.supabase.com -p 5432 -U postgres.[ref] -d postgres -v -c booyah_backup_YYYYMMDD.dump
```

---

## 12. Secret Rotation Guide

When rotating credentials, follow the procedures below to avoid service interruption:

| Secret | Impact of Immediate Rotation | Rotation Procedure |
|---|---|---|
| `FIELD_ENCRYPTION_KEY` | **CRITICAL**: Existing PAN and Aadhaar data cannot be decrypted. | 1. Run a migration script that loads all `pan_enc` and `aadhaar_enc`, decrypts using the old key, and re-encrypts using the new key.<br>2. Keep the old key available in environment variables until the re-encryption script finishes.<br>3. Once re-encryption completes, remove the old key and update `FIELD_ENCRYPTION_KEY`. |
| `JWT_SECRET` | **MODERATE**: All active sessions are invalidated; users and staff are logged out. | 1. Update `JWT_SECRET` in Render environment variables.<br>2. Restart the API service.<br>3. Users and staff re-authenticate via fresh OTP. |
| `OTP_HMAC_SECRET` | **LOW**: Any OTP requested within the last 10 minutes becomes invalid. | 1. Update `OTP_HMAC_SECRET` in Render during low-activity hours.<br>2. Users simply request a new OTP. |
| `FILE_URL_SECRET` | **LOW**: In-flight signed URLs (60s validity) fail until re-fetched. | 1. Update `FILE_URL_SECRET` in Render environment variables.<br>2. Restart the API service. |
| `BREVO_API_KEY` / `GMAIL_APP_PASSWORD` | **HIGH**: OTP sending fails until updated. | 1. Update the key in Render environment variables.<br>2. Run `npm run check:env` to verify delivery. |
| `CRON_SECRET` | **LOW**: Scheduled ticks return HTTP 401 until cron-job.org is updated. | 1. Update `CRON_SECRET` in Render environment variables.<br>2. Update the `x-cron-secret` header in cron-job.org. |
| `SUPABASE_SERVICE_KEY` | **HIGH**: Storage uploads and signed screenshot URLs fail. | 1. Generate a new Service Role key in Supabase API settings.<br>2. Update `SUPABASE_SERVICE_KEY` in Render.<br>3. Run `npm run check:env` to verify storage probes. |

---

## 13. Security & Error Handling

- **Money Calculations**: Handled strictly in integer paise in code; stored as `NUMERIC(12,2)` in PostgreSQL. No floating-point math.
- **SQL Injection Prevention**: 100% parameterized queries (`$1, $2, ...`).
- **Database Timeouts**: `statement_timeout = 30000ms`, `lock_timeout = 8000ms`. Postgres lock/query timeouts (`55P03`, `57014`) are mapped to HTTP 503 `DATABASE_BUSY`.
- **Sensitive Data Redaction**: Pino structured logger automatically redacts authorization headers, tokens, OTPs, passwords, PAN, Aadhaar, UPI IDs, and screenshot paths.
- **Rate Limiting Architecture**: In-memory rate limiting state (`express-rate-limit`) is held in process memory, resets upon API server restarts, and assumes a single server instance (e.g. Render Web Service free tier). If horizontally scaling to multiple instances in the future, a Redis-backed rate limiter store (`rate-limit-redis`) should be configured.

---

## 14. Content Security Policy (CSP)

The User PWA enforces strict CSP rules configured at build time:
- `default-src 'self'`
- `img-src 'self' blob: %VITE_API_ORIGIN% %VITE_STORAGE_ORIGIN%` (no wildcards, no `data:` unless needed)
- `connect-src 'self' http://localhost:* ws://localhost:* https://*.render.com %VITE_API_ORIGIN%`
- `object-src 'none'`
- `base-uri 'self'`
