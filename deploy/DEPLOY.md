# Booyah Win - Production Deployment & Operations Guide

This guide describes how to deploy and operate Booyah Win at **zero running cost** using:
- **Database & Storage**: Supabase Free Tier (PostgreSQL with session pooling + private storage bucket)
- **Backend API**: Render Free Web Service (Node.js 20 LTS)
- **Frontends**: Cloudflare Pages or Netlify (Staff Portal & Player PWA), with notes for Vercel
- **Job Scheduler**: cron-job.org (Free external 5-minute tick)

---

## 1. Verified vs. Documentation-Only Platform Behaviors

To ensure total transparency, the following distinction applies to hosting capabilities described in this repository:

| Feature / Behavior | Platform | Verification Status | Details |
|---|---|---|---|
| SPA Routing (`_redirects` fallback `/* /index.html 200`) | Cloudflare Pages & Netlify | **Verified by automated tests** | Verified that `_redirects` is emitted into `dist/` with exact rule syntax. |
| Security Headers (`_headers`) | Cloudflare Pages & Netlify | **Verified by automated tests** | Verified that `_headers` is emitted into `dist/` with `frame-ancestors 'none'`, `nosniff`, `DENY`, and immutable cache headers. |
| Strict Build-Time CSP Interpolation | Both Frontends | **Verified by automated tests** | Automated build tests verify that `connect-src` and `img-src` match build-time variables without wildcards (`*`) and without `localhost`. |
| Service Worker `/api` Bypass | Player PWA | **Verified by automated tests** | Automated test verifies compiled `sw.js` never applies caching strategies to `/api`. |
| Edge Ingestion of `_headers` & `_redirects` | Cloudflare Pages & Netlify | **Documentation Only** | Based on official Cloudflare Pages and Netlify documentation specifications. |
| Vercel Header File Incompatibility | Vercel | **Documentation Only** | Official Vercel documentation confirms Vercel ignores `_headers` and `_redirects`, requiring `vercel.json`. |

---

## 2. Environment Variables Inventory (Names Only)

### 2.1 Backend API (Render Web Service)
Never hardcode or commit real credentials. Add these variables in the Render dashboard:

| Variable Name | Description & Invariants |
|---|---|
| `NODE_ENV` | Must be strictly `"production"` (enforced by startup check). |
| `RENDER` | Render automatically sets to `"true"`. |
| `PORT` | Optional (defaults to `3000` or port assigned by Render). |
| `DATABASE_URL` | Supabase **Session Pooler** connection string on port **5432** (never port `6543`). |
| `DATABASE_SSL` | Set to `"true"` for remote Supabase connections. |
| `DATABASE_SSL_CA` | Optional CA certificate PEM text if custom verification is required. |
| `DATABASE_SSL_CA_BASE64` | **Recommended on Render**: Base64-encoded Supabase CA PEM certificate. |
| `DATABASE_SSL_CA_FILE` | **Recommended in PowerShell**: Path to downloaded Supabase CA certificate file (`.crt` / `.pem`). |
| `JWT_SECRET` | Cryptographically random string (min 32 characters, no placeholders). |
| `OTP_HMAC_SECRET` | Cryptographically random string (min 32 characters, no placeholders). |
| `FIELD_ENCRYPTION_KEY` | Exactly 32 bytes base64-encoded (used for AES-256-GCM encryption of PAN/Aadhaar). |
| `FILE_URL_SECRET` | Cryptographically random string (min 32 characters, no placeholders). |
| `GMAIL_USER` | Gmail address used for sending OTP emails. |
| `GMAIL_APP_PASSWORD` | 16-character Google Account App Password. |
| `SUPABASE_URL` | Base URL of Supabase project (e.g. `https://<ref>.supabase.co`). |
| `SUPABASE_SERVICE_KEY` | Supabase secret `service_role` key (bypasses RLS for backend operations). |
| `STORAGE_BUCKET` | Name of private storage bucket (`booyah-private`). |
| `CRON_SECRET` | Secret token (min 16 characters) used to authorize `/internal/jobs/tick`. |
| `CORS_ORIGINS` | Comma-separated HTTPS URLs of the two frontends (e.g. `https://staff.example.com,https://play.example.com`). No wildcards, no `http://`. |

### 2.2 Frontend Sites (Staff Portal & Player PWA)
Set these build-time environment variables in your static host (Cloudflare Pages / Netlify / Vercel):

| Variable Name | Description & Invariants |
|---|---|
| `VITE_API_ORIGIN` | Origin of the API (e.g. `https://booyah-api.onrender.com`). Used for CSP `connect-src`. |
| `VITE_STORAGE_ORIGIN` | Origin of Supabase Storage (e.g. `https://<ref>.supabase.co`). Used for CSP `img-src`. |
| `VITE_API_URL` | Backend URL for API calls (e.g. `https://booyah-api.onrender.com`). |

---

## 3. First-Deploy Order of Operations

Follow this exact sequence when launching a new production environment:

```
[1] Supabase Setup ──> [2] Run Migrations ──> [3] Seed Database ──> [4] Enable RLS
         │
         ▼
[5] check:env ──> [6] Deploy API (Render) ──> [7] Deploy Frontends
         │
         ▼
[8] Configure CORS_ORIGINS ──> [9] Redeploy API ──> [10] Setup Cron Job
```

### Step 1: Supabase Setup (Database, Storage & SSL CA)
1. Sign up at [supabase.com](https://supabase.com) and create a free project.
2. Go to **Project Settings** -> **Database** -> **Connection Pooling**:
   - Select **Session Pooler** on port **5432**.
   - Copy the connection string.
   - **Important**: If your database password contains special characters (such as `@`, `:`, `#`, `%`, `&`, `?`), **URL-encode** them in the connection string (e.g. `@` becomes `%40`, `#` becomes `%23`).
3. **Download Supabase SSL CA Certificate**:
   - Supabase session pooler certificates are signed by Supabase's dedicated Certificate Authority (`prod-ca-2021.crt`).
   - In Supabase dashboard: **Project Settings** -> **Database** -> **SSL Configuration** / Certificate Authority -> Download `prod-ca-2021.crt`.
   - Direct download URL: `https://raw.githubusercontent.com/supabase/supabase/master/certs/prod-ca-2021.crt`
   - Save this file to a secure directory (e.g. `C:\Users\<user>\booyah-secrets\prod-ca-2021.crt`).
   - **Configuration on Operator Machine (PowerShell)**:
     Set `$env:DATABASE_SSL_CA_FILE = "C:\Users\<user>\booyah-secrets\prod-ca-2021.crt"`.
   - **Configuration on Render**:
     Render dashboard web forms may strip newlines from multi-line PEM text. Use `DATABASE_SSL_CA_BASE64`:
     - In PowerShell, generate the base64 string:
       ```powershell
       [Convert]::ToBase64String([IO.File]::ReadAllBytes("C:\path\to\prod-ca-2021.crt"))
       ```
     - In Linux / macOS:
       ```bash
       base64 -w 0 prod-ca-2021.crt
       ```
     - Paste this single-line string into Render Dashboard -> Environment -> `DATABASE_SSL_CA_BASE64`.
   - **Operator Fallback**:
     You can also set the Node.js native fallback `$env:NODE_EXTRA_CA_CERTS = "C:\path\to\prod-ca-2021.crt"`.
   - **SECURITY WARNING**:
     **NEVER set `NODE_TLS_REJECT_UNAUTHORIZED=0`** or disable certificate verification. Disabling certificate verification makes connections vulnerable to Man-In-The-Middle (MITM) attacks. Booyah Win strictly enforces `rejectUnauthorized: true`.
   - **Supabase CA Rotation Notice**:
     Supabase periodically rotates its root/pooler CA certificate before expiration. When Supabase announces or rolls out a CA rotation:
     1. Download the new CA certificate from Supabase.
     2. Convert it to base64.
     3. Update `DATABASE_SSL_CA_BASE64` in Render and trigger a deployment.
4. Go to **Storage** -> **New Bucket**:
   - Bucket name: `booyah-private`.
   - Set **Public bucket** to **OFF** (private bucket).
   - Set allowed MIME types: `image/jpeg`, `image/png`, `image/webp`. Maximum file size: `2MB`.

### Step 2: Run Database Migrations from Operator Machine
The migration runner refuses to execute against remote databases unless `--allow-remote` is passed:

**PowerShell (Windows):**
```powershell
$env:DATABASE_URL = "postgresql://postgres.<ref>:<password>@aws-0-<region>.pooler.supabase.com:5432/postgres"
$env:DATABASE_SSL_CA_FILE = "C:\path\to\prod-ca-2021.crt"
npm run migrate:dev -- --allow-remote
```
*(Remember to close your PowerShell window after running these commands to clear secrets from session history).*

**Bash (Linux / macOS):**
```bash
DATABASE_URL="postgresql://postgres.<ref>:<password>@aws-0-<region>.pooler.supabase.com:5432/postgres" DATABASE_SSL_CA_FILE="/path/to/prod-ca-2021.crt" npm run migrate:dev -- --allow-remote
```

### Step 3: Seed Initial Data
Seed admin, system settings, and default tournament tiers using `--allow-remote`:

**PowerShell (Windows):**
```powershell
$env:DATABASE_URL = "postgresql://postgres.<ref>:<password>@aws-0-<region>.pooler.supabase.com:5432/postgres"
$env:DATABASE_SSL_CA_FILE = "C:\path\to\prod-ca-2021.crt"
$env:ADMIN_EMAIL = "admin@example.com"
$env:ADMIN_NAME = "System Administrator"
$env:ADMIN_MOBILE = "9876543210"

npm run seed:admin -- --allow-remote
npm run seed:settings -- --allow-remote
npm run seed:tiers -- --allow-remote
```

**Bash (Linux / macOS):**
```bash
DATABASE_URL="..." DATABASE_SSL_CA_FILE="/path/to/prod-ca-2021.crt" ADMIN_EMAIL="admin@example.com" ADMIN_NAME="Admin" ADMIN_MOBILE="9876543210" npm run seed:admin -- --allow-remote
DATABASE_URL="..." DATABASE_SSL_CA_FILE="/path/to/prod-ca-2021.crt" npm run seed:settings -- --allow-remote
DATABASE_URL="..." DATABASE_SSL_CA_FILE="/path/to/prod-ca-2021.crt" npm run seed:tiers -- --allow-remote
```

### Step 4: Enable Row Level Security (RLS)
In the Supabase dashboard, open the **SQL Editor**, paste the entire contents of [`deploy/enable_rls.sql`](file:///c:/Users/sujoy/OneDrive/Desktop/booyah-win/deploy/enable_rls.sql), and execute it.
- This secures all 18 tables in the `public` schema against unauthorized client-side access via the public anon key.
- The Node.js backend connects as the database owner/superuser which automatically bypasses RLS.

### Step 5: Verify Environment Connections (`check:env`)
Run the connection check to verify database, Supabase storage probe, and Gmail SMTP:

**PowerShell (Windows):**
```powershell
$env:DATABASE_URL = "postgresql://postgres.<ref>:<password>@aws-0-<region>.pooler.supabase.com:5432/postgres"
$env:DATABASE_SSL_CA_FILE = "C:\path\to\prod-ca-2021.crt"
$env:SUPABASE_URL = "https://<ref>.supabase.co"
$env:SUPABASE_SERVICE_KEY = "eyJhbGciOi..."
$env:GMAIL_USER = "mailer@example.com"
$env:GMAIL_APP_PASSWORD = "abcdefghijklmnop"

npm run check:env -- --allow-remote
```
Ensure all services print `[PASS]`.

**Close the terminal window immediately after completing steps 2-5 to ensure no credentials linger in memory or terminal scrollback.**

### Step 6: Deploy API to Render
1. Create a new **Web Service** on [render.com](https://render.com).
2. Connect your repository.
3. Configure settings:
   - **Runtime**: Node
   - **Node Version**: 20 LTS (pinned via `.nvmrc` and `engines`)
   - **Build Command**: `npm install --include=dev && npm run build:api`
   - **Start Command**: `npm run start:api`
   - **Health Check Path**: `/health`
4. Add all environment variables listed in Section 2.1.
5. Deploy service. Check deployment logs to confirm:
   `Booyah Win API server running on port 10000 (0.0.0.0) [NODE_ENV=production]`

### Step 7: Deploy Frontends (Static Host)
Deploy `apps/staff-portal` and `apps/user-pwa` to Cloudflare Pages or Netlify:
- **Build Command**: `npm run build:frontends` (or individual `npm run build --workspace=apps/staff-portal`)
- **Output Directory**: `dist`
- **Environment Variables**: `VITE_API_ORIGIN`, `VITE_STORAGE_ORIGIN`, `VITE_API_URL`

### Step 8: Update CORS_ORIGINS on Render
Once the frontend URLs are known (e.g. `https://booyah-staff.pages.dev,https://booyah-play.pages.dev`):
1. In Render dashboard, set `CORS_ORIGINS` to the exact comma-separated HTTPS URLs.
2. Trigger **Manual Deploy** -> **Deploy latest commit** (or restart service) so the API enforces the new origins.

### Step 9: Configure External Cron Job (cron-job.org)
Render's free tier spins down after 15 minutes of inactivity. cron-job.org keeps the API awake and triggers scheduled match cutoffs:
1. Register at [cron-job.org](https://cron-job.org).
2. Create a new cron job:
   - **Title**: `Booyah Win Scheduler Tick`
   - **URL**: `https://<your-api-slug>.onrender.com/internal/jobs/tick`
   - **Schedule**: Every 5 minutes (`*/5 * * * *`)
   - **HTTP Method**: `POST`
   - **Headers**:
     - `x-cron-secret`: `<CRON_SECRET>`
3. **Execution Timeout Notice**:
   - Free tier cron-job.org requests time out after **30 seconds**.
   - `/internal/jobs/tick` executes fast batch queries (disband forming teams 10m before start, cancel unfilled matches, expire stale invites, clean old OTPs) and completes in under 2 seconds. Keep operations inside this job brief.

---

## 4. Static Hosting Platform Configurations

### 4.1 Cloudflare Pages & Netlify
Both platforms automatically detect:
- `_redirects`: handles SPA client-side routing fallback (`/* /index.html 200`).
- `_headers`: configures immutable cache rules for `/assets/*`, `no-cache` for `/index.html`, `/sw.js`, `/registerSW.js`, and strict security headers with Content Security Policy.

### 4.2 Vercel Configuration Notice
**Important**: Vercel does **not** read `_headers` or `_redirects`. If deploying either frontend to Vercel, create a `vercel.json` file in the frontend root:

```json
{
  "rewrites": [
    {
      "source": "/(.*)",
      "destination": "/index.html"
    }
  ],
  "headers": [
    {
      "source": "/assets/(.*)",
      "headers": [
        { "key": "Cache-Control", "value": "public, max-age=31536000, immutable" }
      ]
    },
    {
      "source": "/(index.html|sw.js|registerSW.js)",
      "headers": [
        { "key": "Cache-Control", "value": "no-cache, no-store, must-revalidate" }
      ]
    },
    {
      "source": "/(.*)",
      "headers": [
        { "key": "X-Frame-Options", "value": "DENY" },
        { "key": "X-Content-Type-Options", "value": "nosniff" },
        { "key": "Referrer-Policy", "value": "strict-origin-when-cross-origin" },
        { "key": "Permissions-Policy", "value": "camera=(), microphone=(), geolocation=()" },
        {
          "key": "Content-Security-Policy",
          "value": "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; font-src 'self' data:; img-src 'self' blob: https://<your-storage-ref>.supabase.co; connect-src 'self' https://<your-api-slug>.onrender.com; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none';"
        }
      ]
    }
  ]
}
```

> **Note on `frame-ancestors 'none'`**:
> Per W3C CSP Level 3 specification, the `frame-ancestors` directive is ignored by browsers when served inside `<meta http-equiv="Content-Security-Policy">` tags. It is enforced exclusively via HTTP response headers (`_headers` on Netlify/Cloudflare Pages or `vercel.json` on Vercel).

---

## 5. Database Backups & Data Protection Notice

### 5.1 Privacy & Data Protection Notice
> **CRITICAL**: Booyah Win database dumps contain sensitive personal data (names, mobile numbers, UPI IDs) and encrypted government identity tokens (PAN and Aadhaar).
> - **Never store backups inside the git repository.** The backup scripts refuse to write into the repository directory.
> - **Never push backup dumps to GitHub or public storage.**
> - Keep all backups encrypted and stored on secure local/external storage.

### 5.2 Weekly Backup (`pg_dump`)
Run the backup script weekly. It prompts for the connection string and an external destination directory:

**PowerShell (Windows):**
```powershell
.\scripts\backup-db.ps1
```

**Bash (Linux / macOS):**
```bash
./scripts/backup-db.sh
```

**Manual pg_dump command:**
```bash
pg_dump "$DATABASE_URL" -F c -b -v -f ~/secure_backups/booyah_backup_$(date +%Y%m%d_%H%M%S).dump
```

### 5.3 Restoring from Backup
To restore a backup into a clean database:
```bash
pg_restore -d "$DATABASE_URL" -v -c ~/secure_backups/booyah_backup_YYYYMMDD_HHMMSS.dump
```

---

## 6. Screenshot Retention & Storage Pruning

Screenshots uploaded by players for deposit verification and match results are stored in the private Supabase bucket `booyah-private` under `screenshots/`.

### 6.1 Retention Policy
- **Pending & In-Review Items**: Retain indefinitely until reviewed and resolved.
- **Resolved Records**:
  - Deposit screenshots for approved or rejected deposits older than **30 days** may be pruned.
  - Match result screenshots for verified payouts older than **60 days** may be pruned.

### 6.2 Listing & Pruning Old Screenshots
You can list and remove old screenshots via the Supabase Dashboard or via curl with the service key:

1. **List files in bucket**:
   ```bash
   curl -X POST "https://<ref>.supabase.co/storage/v1/object/list/booyah-private" \
     -H "Authorization: Bearer <SUPABASE_SERVICE_KEY>" \
     -H "Content-Type: application/json" \
     -d '{"prefix": "screenshots/", "limit": 100, "sortBy": {"column": "created_at", "order": "asc"}}'
   ```
2. **Delete obsolete screenshot files**:
   ```bash
   curl -X DELETE "https://<ref>.supabase.co/storage/v1/object/booyah-private" \
     -H "Authorization: Bearer <SUPABASE_SERVICE_KEY>" \
     -H "Content-Type: application/json" \
     -d '{"prefixes": ["screenshots/old-file-1.png", "screenshots/old-file-2.png"]}'
   ```
*(Do not delete files referenced by active, pending deposit or match disputes).*

---

## 7. Troubleshooting Common Deployment Errors

### 7.1 Database SSL Error: `SELF_SIGNED_CERT_IN_CHAIN` / Untrusted Certificate
- **Symptom**: `Failed: The database certificate is not trusted. Set DATABASE_SSL_CA, DATABASE_SSL_CA_BASE64 or DATABASE_SSL_CA_FILE to Supabase's CA certificate` or Node.js error code `SELF_SIGNED_CERT_IN_CHAIN`.
- **Cause**: Supabase session pooler certificates are signed by Supabase's private Certificate Authority (`prod-ca-2021.crt`), which is not part of Node.js's default public root CA bundle.
- **Resolution**:
  1. Download `prod-ca-2021.crt` from Supabase (**Project Settings** -> **Database** -> **SSL Configuration** / Certificate Authority, or direct URL: `https://raw.githubusercontent.com/supabase/supabase/master/certs/prod-ca-2021.crt`).
  2. In local PowerShell: set `$env:DATABASE_SSL_CA_FILE = "C:\path\to\prod-ca-2021.crt"`.
  3. In Render: convert `prod-ca-2021.crt` to base64 (`[Convert]::ToBase64String([IO.File]::ReadAllBytes("prod-ca-2021.crt"))`) and configure `DATABASE_SSL_CA_BASE64` in Render Environment Settings.
  4. Ensure `DATABASE_SSL="true"`. Never disable TLS verification (`rejectUnauthorized: true` is strictly enforced).

### 7.2 Supabase Storage Check Fails: `HTTP status 400` / MIME Type Rejection
- **Symptom**: `check:env` storage probe fails with HTTP 400 or `"mime type not supported"`.
- **Cause**: The private bucket `booyah-private` restricts allowed MIME types to `image/jpeg, image/png, image/webp`. The health check probe uploads a 1x1 PNG (`image/png`) to `_healthcheck/`.
- **Resolution**:
  1. Open Supabase Dashboard -> **Storage** -> select `booyah-private` -> **Edit Bucket**.
  2. Verify that Allowed MIME types includes `image/jpeg`, `image/png`, and `image/webp`.
  3. Ensure bucket is private (Public bucket OFF) and maximum file size is at least 2MB.
  4. Note: The cause of HTTP 400 is confirmed only once a real run no longer returns it or prints the service's own error message.
