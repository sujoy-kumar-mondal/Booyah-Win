-- Booyah Win : PostgreSQL schema (Supabase / Neon free tier compatible)
-- Money columns use NUMERIC(12,2): exact rupees and paise, no float rounding errors.

CREATE EXTENSION IF NOT EXISTS citext;

-- ---------- ENUMS ----------
CREATE TYPE game_mode      AS ENUM ('battle_royale', 'clash_squad');
CREATE TYPE team_mode      AS ENUM ('solo', 'duo', 'squad');           -- clash_squad uses 'squad'
CREATE TYPE wallet_kind    AS ENUM ('add_money', 'cashback', 'winning');
CREATE TYPE ledger_type    AS ENUM ('add_money', 'referral', 'join_fee', 'refund',
                                    'winning', 'withdrawal_hold', 'withdrawal_paid',
                                    'withdrawal_refund', 'admin_adjustment', 'reversal');
CREATE TYPE request_status AS ENUM ('pending', 'approved', 'rejected');
CREATE TYPE withdraw_status AS ENUM ('pending', 'paid', 'rejected');
CREATE TYPE match_status   AS ENUM ('upcoming', 'room_open', 'live', 'completed', 'cancelled');
CREATE TYPE result_status  AS ENUM ('pending_approval', 'approved', 'rejected');
CREATE TYPE staff_role     AS ENUM ('admin', 'employee');

-- ---------- STAFF (admin + employees) ----------
CREATE TABLE staff (
  id            BIGSERIAL PRIMARY KEY,
  role          staff_role NOT NULL DEFAULT 'employee',
  name          TEXT NOT NULL,
  mobile        TEXT NOT NULL,
  email         CITEXT NOT NULL UNIQUE,
  pan_enc       BYTEA,            -- AES-256-GCM encrypted in app code; key in env var
  aadhaar_enc   BYTEA,            -- show masked value only (e.g. XXXX-XXXX-1234)
  created_by    BIGINT REFERENCES staff(id),
  deleted_at    TIMESTAMPTZ,      -- soft delete
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- Seed the first admin from an env var (ADMIN_EMAIL) in a one-time script, not in code.

-- ---------- USERS ----------
CREATE TABLE users (
  id               BIGSERIAL PRIMARY KEY,
  email            CITEXT NOT NULL UNIQUE,          -- not modifiable
  name             TEXT NOT NULL,                   -- not modifiable
  mobile           TEXT NOT NULL UNIQUE,
  ff_id            TEXT NOT NULL UNIQUE,
  ff_name          TEXT NOT NULL,
  upi_id           TEXT NOT NULL,
  date_of_birth    DATE NOT NULL,
  referral_code    TEXT NOT NULL UNIQUE,            -- generated, not modifiable
  referred_by      BIGINT REFERENCES users(id),
  -- "modifiable once a month": check these timestamps in app code (>= 30 days)
  mobile_changed_at  TIMESTAMPTZ,
  ff_id_changed_at   TIMESTAMPTZ,
  ff_name_changed_at TIMESTAMPTZ,
  upi_changed_at     TIMESTAMPTZ,                   -- also blocks withdrawals for 24-48h
  deleted_at       TIMESTAMPTZ,
  deleted_reason   TEXT,
  deleted_by       BIGINT REFERENCES staff(id),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT users_age_18_plus CHECK (date_of_birth <= (CURRENT_DATE - INTERVAL '18 years'))
);

-- ---------- AUTH (no passwords) ----------
-- Pending registrations live here, NOT in users, until the form is complete.
CREATE TABLE otp_requests (
  id          BIGSERIAL PRIMARY KEY,
  email       CITEXT NOT NULL,
  audience    TEXT NOT NULL CHECK (audience IN ('user', 'staff')),   -- which portal requested it
  purpose     TEXT NOT NULL CHECK (purpose IN ('register', 'login')),
  code_hash   TEXT NOT NULL,                        -- hash of the OTP, never the OTP itself
  attempts    INT NOT NULL DEFAULT 0,               -- lock after e.g. 5 wrong tries
  expires_at  TIMESTAMPTZ NOT NULL,                 -- now() + 10 minutes
  verified_at TIMESTAMPTZ,                          -- registration form allowed after this
  consumed_at TIMESTAMPTZ,                          -- registration complete sets this; prevents reuse
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON otp_requests (email, created_at DESC);   -- for rate limiting

-- One active session per account: a new login replaces the old row.
CREATE TABLE sessions (
  id            UUID PRIMARY KEY,
  account_type  TEXT NOT NULL CHECK (account_type IN ('user', 'staff')),
  account_id    BIGINT NOT NULL,
  device_info   TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (account_type, account_id)
);
-- Login = INSERT ... ON CONFLICT (account_type, account_id) DO UPDATE SET id = new_uuid.
-- Every request checks that the session id in the token equals sessions.id.

-- ---------- WALLETS & LEDGER ----------
CREATE TABLE wallets (
  user_id    BIGINT PRIMARY KEY REFERENCES users(id),
  add_money  NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (add_money >= 0),
  cashback   NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (cashback  >= 0),
  winning    NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (winning   >= 0)
);
-- Always: SELECT ... FROM wallets WHERE user_id = $1 FOR UPDATE inside a transaction.

CREATE TABLE wallet_ledger (
  id             BIGSERIAL PRIMARY KEY,
  user_id        BIGINT NOT NULL REFERENCES users(id),
  wallet         wallet_kind NOT NULL,
  type           ledger_type NOT NULL,
  amount         NUMERIC(12,2) NOT NULL,            -- positive = credit, negative = debit
  balance_after  NUMERIC(12,2) NOT NULL,            -- that wallet after this entry
  total_after    NUMERIC(12,2) NOT NULL,            -- all three wallets after this entry
  ref_type       TEXT,                              -- 'match', 'deposit', 'withdrawal', ...
  ref_id         BIGINT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON wallet_ledger (user_id, created_at DESC);
CREATE INDEX ON wallet_ledger (user_id, type);       -- history filters

-- ---------- DEPOSITS (manual QR) ----------
CREATE TABLE deposit_requests (
  id             BIGSERIAL PRIMARY KEY,
  user_id        BIGINT NOT NULL REFERENCES users(id),
  amount         NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  utr            TEXT NOT NULL UNIQUE,              -- blocks reuse of a transaction id
  screenshot_url TEXT NOT NULL,
  status         request_status NOT NULL DEFAULT 'pending',
  reject_reason  TEXT,
  reviewed_by    BIGINT REFERENCES staff(id),
  needs_admin    BOOLEAN NOT NULL DEFAULT false,    -- true above your threshold
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_at    TIMESTAMPTZ
);

-- ---------- WITHDRAWALS ----------
CREATE TABLE withdrawal_requests (
  id            BIGSERIAL PRIMARY KEY,
  user_id       BIGINT NOT NULL REFERENCES users(id),
  amount        NUMERIC(12,2) NOT NULL CHECK (amount >= 50),
  upi_id        TEXT NOT NULL,                      -- snapshot of the confirmed UPI id
  status        withdraw_status NOT NULL DEFAULT 'pending',
  reject_reason TEXT,
  payout_ref    TEXT,                               -- UPI reference after paying
  processed_by  BIGINT REFERENCES staff(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at  TIMESTAMPTZ
);
-- On request: debit winning wallet (type withdrawal_hold). On reject: credit back (withdrawal_refund).

-- ---------- ENTRY TIERS (admin-defined) ----------
CREATE TABLE entry_tiers (
  id                  BIGSERIAL PRIMARY KEY,
  game_mode           game_mode NOT NULL,
  team_mode           team_mode NOT NULL,
  entry_fee           NUMERIC(12,2) NOT NULL CHECK (entry_fee > 0),
  kill_price          NUMERIC(12,2) NOT NULL DEFAULT 0,
  min_kills_for_reward INT NOT NULL DEFAULT 2,
  max_players         INT NOT NULL,                 -- 48 for BR, 8 for CS
  min_players         INT NOT NULL,
  deleted_at          TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE tier_position_prizes (
  tier_id   BIGINT NOT NULL REFERENCES entry_tiers(id),
  position  INT NOT NULL CHECK (position >= 1),     -- 1 = booyah
  prize     NUMERIC(12,2) NOT NULL CHECK (prize >= 0),
  PRIMARY KEY (tier_id, position)
);

-- ---------- MATCHES ----------
CREATE TABLE matches (
  id             BIGSERIAL PRIMARY KEY,
  tier_id        BIGINT NOT NULL REFERENCES entry_tiers(id),
  game_mode      game_mode NOT NULL,
  team_mode      team_mode NOT NULL,
  -- snapshot of the tier at creation, so later tier edits never change this match
  entry_fee      NUMERIC(12,2) NOT NULL,
  kill_price     NUMERIC(12,2) NOT NULL,
  min_kills_for_reward INT NOT NULL,
  position_prizes JSONB NOT NULL,                   -- e.g. {"1":50,"2":40,"3":30}
  max_players    INT NOT NULL,
  min_players    INT NOT NULL,
  start_time     TIMESTAMPTZ NOT NULL,
  room_id        TEXT,
  room_password  TEXT,
  status         match_status NOT NULL DEFAULT 'upcoming',
  cancel_reason  TEXT,
  created_by     BIGINT NOT NULL REFERENCES staff(id),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON matches (status, start_time);

CREATE TABLE teams (                                -- for duo, squad and Clash Squad
  id          BIGSERIAL PRIMARY KEY,
  match_id    BIGINT NOT NULL REFERENCES matches(id),
  leader_id   BIGINT NOT NULL REFERENCES users(id), -- receives position prizes
  name        TEXT,
  size        INT NOT NULL,                          -- 2 (duo) or 4 (squad / clash squad)
  status      TEXT NOT NULL DEFAULT 'forming'
              CHECK (status IN ('forming', 'confirmed', 'disbanded')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Teammates are invited by Free Fire ID; each pays their own entry fee when they accept.
CREATE TABLE team_invites (
  id               BIGSERIAL PRIMARY KEY,
  team_id          BIGINT NOT NULL REFERENCES teams(id),
  invited_user_id  BIGINT NOT NULL REFERENCES users(id),
  status           TEXT NOT NULL DEFAULT 'pending'
                   CHECK (status IN ('pending', 'accepted', 'declined', 'expired')),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  responded_at     TIMESTAMPTZ,
  UNIQUE (team_id, invited_user_id)
);

CREATE TABLE match_players (
  id              BIGSERIAL PRIMARY KEY,
  match_id        BIGINT NOT NULL REFERENCES matches(id),
  user_id         BIGINT NOT NULL REFERENCES users(id),
  team_id         BIGINT REFERENCES teams(id),
  -- how the entry fee was paid, so a cancel refunds each wallet exactly
  paid_add_money  NUMERIC(12,2) NOT NULL DEFAULT 0,
  paid_cashback   NUMERIC(12,2) NOT NULL DEFAULT 0,
  paid_winning    NUMERIC(12,2) NOT NULL DEFAULT 0,
  refunded_at     TIMESTAMPTZ,
  -- result (filled when the result is approved)
  kills           INT,
  position        INT,                              -- 1,2,3...; NULL = lost
  payout          NUMERIC(12,2),
  joined_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (match_id, user_id)                          -- one join per match
);

-- ---------- RESULTS (employee submits, admin approves) ----------
CREATE TABLE match_results (
  id              BIGSERIAL PRIMARY KEY,
  match_id        BIGINT NOT NULL UNIQUE REFERENCES matches(id),  -- one result per match (idempotent)
  entries         JSONB NOT NULL,                   -- [{user_id, kills, position}, ...]
  screenshot_url  TEXT NOT NULL,                    -- required proof
  status          result_status NOT NULL DEFAULT 'pending_approval',
  submitted_by    BIGINT NOT NULL REFERENCES staff(id),
  approved_by     BIGINT REFERENCES staff(id),
  reject_reason   TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  approved_at     TIMESTAMPTZ
);
-- Mistakes after approval are fixed with 'reversal' ledger entries, never by editing rows.

-- ---------- REFERRALS ----------
CREATE TABLE referrals (
  id           BIGSERIAL PRIMARY KEY,
  referrer_id  BIGINT NOT NULL REFERENCES users(id),
  referred_id  BIGINT NOT NULL UNIQUE REFERENCES users(id),
  reward       NUMERIC(12,2) NOT NULL DEFAULT 5,
  credited_at  TIMESTAMPTZ                            -- set on referred user's first approved deposit or first match
);

-- ---------- AUDIT ----------
CREATE TABLE audit_logs (
  id          BIGSERIAL PRIMARY KEY,
  staff_id    BIGINT REFERENCES staff(id),
  action      TEXT NOT NULL,                         -- 'deposit_approved', 'result_submitted', 'user_deleted', ...
  target_type TEXT,
  target_id   BIGINT,
  details     JSONB,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ===== KEY TRANSACTIONS (implement each as ONE database transaction) =====
-- JOIN MATCH:
--   1. lock wallets row FOR UPDATE; lock matches row FOR UPDATE
--   2. check status = 'upcoming'/'room_open', player count < max_players
--   3. cashback_part = LEAST(cashback, entry_fee * 0.05)
--      rest = entry_fee - cashback_part; take rest from add_money, then winning
--      reject with "low balance" if the total is not enough
--   4. insert match_players (with paid_* amounts) -> UNIQUE blocks double join
--   5. insert wallet_ledger rows for each wallet used; update wallets
-- CANCEL MATCH: for each match_players row, credit paid_* back to the same wallets,
--   write 'refund' ledger rows, set refunded_at, set matches.status = 'cancelled'.
-- APPROVE RESULT: validate players/positions/kills, compute payouts from the match
--   snapshot, credit winning wallet, write 'winning' ledger rows, set match completed.

-- ---------- ADDITIONS ----------
-- Admin-editable settings (support contact, payment QR, limits).
CREATE TABLE app_settings (
  key        TEXT PRIMARY KEY,      -- support_name, support_phone, support_email,
                                    -- payment_qr_url, payment_upi_id, min_deposit,
                                    -- max_deposit, admin_approval_threshold
  value      TEXT NOT NULL,
  updated_by BIGINT REFERENCES staff(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- One account per UPI id (blocks multi-account abuse).
CREATE UNIQUE INDEX users_upi_unique ON users (lower(upi_id));
