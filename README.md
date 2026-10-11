# Booyah Win

Booyah Win is a high-reliability, zero-running-cost tournament platform that lets players join Free Fire custom matches using wallet balances and win cash prizes.

---

## 1. Architecture & Tech Stack

- **Runtime**: Node.js 20 LTS, TypeScript (strict)
- **API Framework**: Express, `zod` validation, `helmet`, `cors`, `express-rate-limit`, `pino` structured logging
- **Database**: PostgreSQL 15+ via `pg` (parameterized SQL, transactions with explicit locking order, zero float money math using integer paise internally and `NUMERIC(12,2)` in PostgreSQL)
- **Database Migrations**: `node-pg-migrate`
- **Authentication**: Passwordless Email + OTP with HMAC-SHA256 verification and single-device JWT sessions
- **File Storage**: Private Supabase Storage bucket with short-lived signed URLs for staff review
- **Email Delivery**: Nodemailer via Gmail SMTP with Google App Password
- **Zero-Cost Deployment**: Render Free Web Service (API), Supabase Free Tier (PostgreSQL + Storage), cron-job.org (external 5-minute tick)

---

## 2. Prerequisites

- **Node.js**: `20.x` LTS
- **npm**: `10.x` or higher
- **PostgreSQL**: `15+` running locally for development and test execution

---

## 3. Local Setup

### 3.1 Clone & Install Dependencies

```bash
git clone https://github.com/sujoy-kumar-mondal/Booyah-Win.git
cd booyah-win
npm install
```

### 3.2 Configure Environment Variables

Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```

> **Security Rule**: Never commit `.env` to git. Ensure `.env` is listed in `.gitignore`.

Set your local database URLs and test credentials:
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

### 3.3 Create Local Databases & Run Migrations

Create two local databases in PostgreSQL:
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

### 3.4 Seed Initial Data

Run the seeding scripts:
```bash
# Seed initial admin account from ADMIN_EMAIL, ADMIN_NAME, ADMIN_MOBILE
npm run seed:admin

# Seed business settings (min/max deposit, approval threshold, contact info)
npm run seed:settings

# Seed standard entry tiers (Battle Royale & Clash Squad tiers and prizes)
npm run seed:tiers
```

### 3.5 Start the Development Server

```bash
npm run dev:api
```
The API starts at `http://localhost:3000`. In development mode, OTP codes are logged directly to the terminal console.

---

## 4. Running Tests

Booyah Win includes comprehensive integration tests with strict concurrency, financial invariants, and state-machine tests.

```bash
npm test
```

> **Safety Invariant**: All tests execute strictly against `TEST_DATABASE_URL`. The test harness verifies that the database name ends with `_test` and points to a local host (`localhost` or `127.0.0.1`), refusing to run against remote databases.

---

## 5. Live Environment Connection Check

Before deploying or running in production, test all live connections:

```bash
npm run check:env
```

To test SMTP and send an actual test email:
```bash
npm run check:env -- --send-to=your-email@example.com
```

The script tests:
1. **PostgreSQL Database**: Connects and runs `SELECT 1` (validates session pooler port 5432).
2. **Supabase Storage**: Uploads and deletes a probe file in the private storage bucket.
3. **Gmail SMTP**: Authenticates with Gmail using App Password (sends test email if `--send-to` is provided).
4. Prints strictly `[PASS]` or `[FAIL]` per service with sanitized reasons. Never prints credentials or secrets.

---

## 6. Zero-Cost Production Deployment Guide

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
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm run start:api`
   - **Health Check Path**: `/health`
4. Add Environment Variables:
   - `NODE_ENV`: `production`
   - `PORT`: `10000`
   - `DATABASE_URL`: `postgresql://postgres.[ref]:[password]@...:5432/postgres` (Session pooler port 5432)
   - `DATABASE_SSL`: `true`
   - `JWT_SECRET`: (64-character random string)
   - `OTP_HMAC_SECRET`: (64-character random string)
   - `FIELD_ENCRYPTION_KEY`: (32-byte base64 string)
   - `FILE_URL_SECRET`: (64-character random string)
   - `GMAIL_USER`: `your-bot@gmail.com`
   - `GMAIL_APP_PASSWORD`: (16-character Google App Password)
   - `SUPABASE_URL`: `https://[ref].supabase.co`
   - `SUPABASE_SERVICE_KEY`: `eyJ...` (Secret service_role key)
   - `STORAGE_BUCKET`: `booyah-private`
   - `CRON_SECRET`: (64-character random string)
   - `CORS_ORIGINS`: `https://your-user-app.vercel.app,https://your-staff-portal.vercel.app` (No wildcards)

### Step D: External Cron Setup (cron-job.org)

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

## 7. Database Backups & Privacy Notice

### Privacy & Data Protection Notice
> **IMPORTANT**: Booyah Win database backups contain sensitive personal data (names, mobile numbers, Free Fire IDs, UPI IDs) and encrypted government identity numbers (AES-256-GCM encrypted PAN and Aadhaar).
> - **Keep backups strictly private and encrypted.**
> - **NEVER store, commit, or push database dumps into git repositories or public storage.**

### Weekly Manual Backups (`pg_dump`)
Supabase's free tier does not provide automated daily backups. The operator must perform weekly manual backups using `pg_dump`:

```bash
pg_dump -h aws-0-[region].pooler.supabase.com -p 5432 -U postgres.[ref] -d postgres -F c -b -v -f booyah_backup_$(date +%Y%m%d).dump
```

To restore from a backup:
```bash
pg_restore -h aws-0-[region].pooler.supabase.com -p 5432 -U postgres.[ref] -d postgres -v -c booyah_backup_YYYYMMDD.dump
```

---

## 8. Secret Rotation Guide

When rotating credentials, follow the procedures below to avoid service interruption:

| Secret | Impact of Immediate Rotation | Rotation Procedure |
|---|---|---|
| `FIELD_ENCRYPTION_KEY` | **CRITICAL**: Existing PAN and Aadhaar data cannot be decrypted. | 1. Write and run a migration script that loads all `pan_enc` and `aadhaar_enc`, decrypts using the old key, and re-encrypts using the new key.<br>2. Keep the old key available in environment variables until the re-encryption script finishes.<br>3. Once re-encryption completes, remove the old key and update `FIELD_ENCRYPTION_KEY`. |
| `JWT_SECRET` | **MODERATE**: All active sessions are invalidated; users, employees, and admins are logged out. | 1. Update `JWT_SECRET` in Render environment variables.<br>2. Restart the API service.<br>3. Users and staff re-authenticate via fresh OTP. |
| `OTP_HMAC_SECRET` | **LOW**: Any OTP requested within the last 10 minutes becomes invalid. | 1. Update `OTP_HMAC_SECRET` in Render during low-activity hours.<br>2. Users simply request a new OTP. |
| `FILE_URL_SECRET` | **LOW**: In-flight signed URLs (60s validity) fail until re-fetched. | 1. Update `FILE_URL_SECRET` in Render environment variables.<br>2. Restart the API service. |
| `GMAIL_APP_PASSWORD` | **HIGH**: OTP sending fails until updated. | 1. Generate a new App Password in Google Account Settings.<br>2. Update `GMAIL_APP_PASSWORD` in Render.<br>3. Run `npm run check:env` to verify SMTP login. |
| `CRON_SECRET` | **LOW**: Scheduled ticks return HTTP 401 until cron-job.org is updated. | 1. Update `CRON_SECRET` in Render environment variables.<br>2. Immediately update the `x-cron-secret` header in cron-job.org. |
| `SUPABASE_SERVICE_KEY` | **HIGH**: Storage uploads and signed screenshot URLs fail. | 1. Generate a new Service Role key in Supabase API settings.<br>2. Update `SUPABASE_SERVICE_KEY` in Render.<br>3. Run `npm run check:env` to verify storage probes. |

---

## 9. Security & Error Handling

- **Money Calculations**: Handled strictly in integer paise in code; stored as `NUMERIC(12,2)` in PostgreSQL. No floating-point math.
- **SQL Injection Prevention**: 100% parameterized queries (`$1, $2, ...`).
- **Database Timeouts**: `statement_timeout = 30000ms`, `lock_timeout = 8000ms`. Postgres lock/query timeouts (`55P03`, `57014`) are mapped to HTTP 503 `DATABASE_BUSY`.
- **Sensitive Data Redaction**: Pino structured logger automatically redacts authorization headers, tokens, OTPs, passwords, PAN, Aadhaar, UPI IDs, and screenshot paths.
- **Rate Limiting Architecture**: In-memory rate limiting state (`express-rate-limit`) is held in process memory, resets upon API server restarts, and assumes a single server instance (e.g. Render Web Service free tier). If horizontally scaling to multiple instances in the future, a Redis-backed rate limiter store (`rate-limit-redis`) should be configured.

