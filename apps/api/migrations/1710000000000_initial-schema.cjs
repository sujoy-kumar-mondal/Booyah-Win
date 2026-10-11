/* eslint-disable no-undef */
exports.up = (pgm) => {
  pgm.sql(`
CREATE EXTENSION IF NOT EXISTS citext;

-- ---------- ENUMS ----------
CREATE TYPE game_mode      AS ENUM ('battle_royale', 'clash_squad');
CREATE TYPE team_mode      AS ENUM ('solo', 'duo', 'squad');
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
  pan_enc       BYTEA,
  aadhaar_enc   BYTEA,
  created_by    BIGINT REFERENCES staff(id),
  deleted_at    TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------- USERS ----------
CREATE TABLE users (
  id               BIGSERIAL PRIMARY KEY,
  email            CITEXT NOT NULL UNIQUE,
  name             TEXT NOT NULL,
  mobile           TEXT NOT NULL UNIQUE,
  ff_id            TEXT NOT NULL UNIQUE,
  ff_name          TEXT NOT NULL,
  upi_id           TEXT NOT NULL,
  date_of_birth    DATE NOT NULL,
  referral_code    TEXT NOT NULL UNIQUE,
  referred_by      BIGINT REFERENCES users(id),
  mobile_changed_at  TIMESTAMPTZ,
  ff_id_changed_at   TIMESTAMPTZ,
  ff_name_changed_at TIMESTAMPTZ,
  upi_changed_at     TIMESTAMPTZ,
  deleted_at       TIMESTAMPTZ,
  deleted_reason   TEXT,
  deleted_by       BIGINT REFERENCES staff(id),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT users_age_18_plus CHECK (date_of_birth <= (CURRENT_DATE - INTERVAL '18 years'))
);

-- ---------- AUTH (no passwords) ----------
CREATE TABLE otp_requests (
  id          BIGSERIAL PRIMARY KEY,
  email       CITEXT NOT NULL,
  audience    TEXT NOT NULL CHECK (audience IN ('user', 'staff')),
  purpose     TEXT NOT NULL CHECK (purpose IN ('register', 'login')),
  code_hash   TEXT NOT NULL,
  attempts    INT NOT NULL DEFAULT 0,
  expires_at  TIMESTAMPTZ NOT NULL,
  verified_at TIMESTAMPTZ,
  consumed_at TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON otp_requests (email, created_at DESC);

CREATE TABLE sessions (
  id            UUID PRIMARY KEY,
  account_type  TEXT NOT NULL CHECK (account_type IN ('user', 'staff')),
  account_id    BIGINT NOT NULL,
  device_info   TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (account_type, account_id)
);

-- ---------- WALLETS & LEDGER ----------
CREATE TABLE wallets (
  user_id    BIGINT PRIMARY KEY REFERENCES users(id),
  add_money  NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (add_money >= 0),
  cashback   NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (cashback  >= 0),
  winning    NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (winning   >= 0)
);

CREATE TABLE wallet_ledger (
  id             BIGSERIAL PRIMARY KEY,
  user_id        BIGINT NOT NULL REFERENCES users(id),
  wallet         wallet_kind NOT NULL,
  type           ledger_type NOT NULL,
  amount         NUMERIC(12,2) NOT NULL,
  balance_after  NUMERIC(12,2) NOT NULL,
  total_after    NUMERIC(12,2) NOT NULL,
  ref_type       TEXT,
  ref_id         BIGINT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON wallet_ledger (user_id, created_at DESC);
CREATE INDEX ON wallet_ledger (user_id, type);

-- ---------- DEPOSITS (manual QR) ----------
CREATE TABLE deposit_requests (
  id             BIGSERIAL PRIMARY KEY,
  user_id        BIGINT NOT NULL REFERENCES users(id),
  amount         NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  utr            TEXT NOT NULL UNIQUE,
  screenshot_url TEXT NOT NULL,
  status         request_status NOT NULL DEFAULT 'pending',
  reject_reason  TEXT,
  reviewed_by    BIGINT REFERENCES staff(id),
  needs_admin    BOOLEAN NOT NULL DEFAULT false,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_at    TIMESTAMPTZ
);

-- ---------- WITHDRAWALS ----------
CREATE TABLE withdrawal_requests (
  id            BIGSERIAL PRIMARY KEY,
  user_id       BIGINT NOT NULL REFERENCES users(id),
  amount        NUMERIC(12,2) NOT NULL CHECK (amount >= 50),
  upi_id        TEXT NOT NULL,
  status        withdraw_status NOT NULL DEFAULT 'pending',
  reject_reason TEXT,
  payout_ref    TEXT,
  processed_by  BIGINT REFERENCES staff(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at  TIMESTAMPTZ
);

-- ---------- ENTRY TIERS ----------
CREATE TABLE entry_tiers (
  id                  BIGSERIAL PRIMARY KEY,
  game_mode           game_mode NOT NULL,
  team_mode           team_mode NOT NULL,
  entry_fee           NUMERIC(12,2) NOT NULL CHECK (entry_fee > 0),
  kill_price          NUMERIC(12,2) NOT NULL DEFAULT 0,
  min_kills_for_reward INT NOT NULL DEFAULT 2,
  max_players         INT NOT NULL,
  min_players         INT NOT NULL,
  deleted_at          TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE tier_position_prizes (
  tier_id   BIGINT NOT NULL REFERENCES entry_tiers(id),
  position  INT NOT NULL CHECK (position >= 1),
  prize     NUMERIC(12,2) NOT NULL CHECK (prize >= 0),
  PRIMARY KEY (tier_id, position)
);

-- ---------- MATCHES ----------
CREATE TABLE matches (
  id             BIGSERIAL PRIMARY KEY,
  tier_id        BIGINT NOT NULL REFERENCES entry_tiers(id),
  game_mode      game_mode NOT NULL,
  team_mode      team_mode NOT NULL,
  entry_fee      NUMERIC(12,2) NOT NULL,
  kill_price     NUMERIC(12,2) NOT NULL,
  min_kills_for_reward INT NOT NULL,
  position_prizes JSONB NOT NULL,
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

CREATE TABLE teams (
  id          BIGSERIAL PRIMARY KEY,
  match_id    BIGINT NOT NULL REFERENCES matches(id),
  leader_id   BIGINT NOT NULL REFERENCES users(id),
  name        TEXT,
  size        INT NOT NULL,
  status      TEXT NOT NULL DEFAULT 'forming'
              CHECK (status IN ('forming', 'confirmed', 'disbanded')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

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
  paid_add_money  NUMERIC(12,2) NOT NULL DEFAULT 0,
  paid_cashback   NUMERIC(12,2) NOT NULL DEFAULT 0,
  paid_winning    NUMERIC(12,2) NOT NULL DEFAULT 0,
  refunded_at     TIMESTAMPTZ,
  kills           INT,
  position        INT,
  payout          NUMERIC(12,2),
  joined_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (match_id, user_id)
);

-- ---------- RESULTS ----------
CREATE TABLE match_results (
  id              BIGSERIAL PRIMARY KEY,
  match_id        BIGINT NOT NULL UNIQUE REFERENCES matches(id),
  entries         JSONB NOT NULL,
  screenshot_url  TEXT NOT NULL,
  status          result_status NOT NULL DEFAULT 'pending_approval',
  submitted_by    BIGINT NOT NULL REFERENCES staff(id),
  approved_by     BIGINT REFERENCES staff(id),
  reject_reason   TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  approved_at     TIMESTAMPTZ
);

-- ---------- REFERRALS ----------
CREATE TABLE referrals (
  id           BIGSERIAL PRIMARY KEY,
  referrer_id  BIGINT NOT NULL REFERENCES users(id),
  referred_id  BIGINT NOT NULL UNIQUE REFERENCES users(id),
  reward       NUMERIC(12,2) NOT NULL DEFAULT 5,
  credited_at  TIMESTAMPTZ
);

-- ---------- AUDIT ----------
CREATE TABLE audit_logs (
  id          BIGSERIAL PRIMARY KEY,
  staff_id    BIGINT REFERENCES staff(id),
  action      TEXT NOT NULL,
  target_type TEXT,
  target_id   BIGINT,
  details     JSONB,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------- APP SETTINGS ----------
CREATE TABLE app_settings (
  key        TEXT PRIMARY KEY,
  value      TEXT NOT NULL,
  updated_by BIGINT REFERENCES staff(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------- UNIQUE INDEXES ----------
CREATE UNIQUE INDEX users_upi_unique ON users (lower(upi_id));
  `);
};

exports.down = (pgm) => {
  pgm.sql(`
DROP TABLE IF EXISTS audit_logs;
DROP TABLE IF EXISTS referrals;
DROP TABLE IF EXISTS match_results;
DROP TABLE IF EXISTS match_players;
DROP TABLE IF EXISTS team_invites;
DROP TABLE IF EXISTS teams;
DROP TABLE IF EXISTS matches;
DROP TABLE IF EXISTS tier_position_prizes;
DROP TABLE IF EXISTS entry_tiers;
DROP TABLE IF EXISTS withdrawal_requests;
DROP TABLE IF EXISTS deposit_requests;
DROP TABLE IF EXISTS wallet_ledger;
DROP TABLE IF EXISTS wallets;
DROP TABLE IF EXISTS sessions;
DROP TABLE IF EXISTS otp_requests;
DROP TABLE IF EXISTS users;
DROP TABLE IF EXISTS staff;
DROP TABLE IF EXISTS app_settings;

DROP TYPE IF EXISTS staff_role;
DROP TYPE IF EXISTS result_status;
DROP TYPE IF EXISTS match_status;
DROP TYPE IF EXISTS withdraw_status;
DROP TYPE IF EXISTS request_status;
DROP TYPE IF EXISTS ledger_type;
DROP TYPE IF EXISTS wallet_kind;
DROP TYPE IF EXISTS team_mode;
DROP TYPE IF EXISTS game_mode;
  `);
};
