/**
 * Migration: Create important_updates table and seed initial announcements
 */

/* eslint-disable no-undef */
exports.up = (pgm) => {
  pgm.sql(`
    CREATE TABLE IF NOT EXISTS important_updates (
      id            BIGSERIAL PRIMARY KEY,
      title         TEXT NOT NULL,
      category      TEXT NOT NULL DEFAULT 'Announcement',
      date_display  TEXT NOT NULL,
      heading       TEXT NOT NULL,
      summary       TEXT,
      points        JSONB NOT NULL DEFAULT '[]'::jsonb,
      notice        TEXT,
      link_url      TEXT,
      link_text     TEXT,
      sort_order    INT NOT NULL DEFAULT 0,
      is_active     BOOLEAN NOT NULL DEFAULT true,
      created_by    BIGINT REFERENCES staff(id),
      created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE INDEX IF NOT EXISTS idx_important_updates_active_order ON important_updates (is_active, sort_order ASC, id ASC);

    -- Seed the 5 initial important updates
    INSERT INTO important_updates (title, category, date_display, heading, summary, points, notice, link_url, link_text, sort_order, is_active)
    VALUES
      (
        '🔥🚨 Important Update – Lone Wolf Headshot Mode',
        'Announcement',
        '23 Jul',
        'Headshot-Only Mode Rules & Fair Play',
        'Headshot-only mode regulations, prohibited weapons, and strict disqualification rules.',
        '[{"label": "Headshot Requirement", "text": "Only kills registered via headshot are counted for victory and prize verification."}, {"label": "Prohibited Items", "text": "Grenades, flashbangs, smoke canisters, and character skill abuse (e.g. Chrono shield) are strictly prohibited."}, {"label": "Disqualification", "text": "Referees review match replay screenshots. Any body-shot kill abuse results in match forfeiture without refund."}]'::jsonb,
        'Ensure your Free Fire game recording is enabled for potential dispute submission.',
        NULL,
        NULL,
        1,
        true
      ),
      (
        '🔥🚨 Notification About Snipers Ban 🔥🚨',
        'Announcement',
        '28 May',
        'Weapon Restrictions in Squad & Clash Squad',
        'AWM, M82B, and Kar98k are strictly forbidden in Clash Squad and Squad matches.',
        '[{"label": "Strict Sniper Ban", "text": "All sniper rifles (AWM, M82B, Kar98k) are prohibited across all Clash Squad (CS) and Squad tournament custom rooms."}, {"label": "Prize Forfeiture", "text": "Any player or team caught purchasing or firing a sniper rifle will immediately forfeit all winnings and per-kill bounties."}, {"label": "Mobile Only", "text": "Tournaments are exclusively for Android and iOS mobile devices. PC emulators or modified APKs trigger an automatic permanent platform ban."}]'::jsonb,
        'Fair play is monitored by live room referees and post-match audit checks.',
        NULL,
        NULL,
        2,
        true
      ),
      (
        '🏆 Tournaments Are Back! 🎮 : Be Ready',
        'Announcement',
        '7 May',
        'Daily Tournament Schedule & UPI Payouts',
        'Daily Scrims, Battle Royale Solo & Duo, and CS custom rooms have officially resumed.',
        '[{"label": "Daily Scrims Active", "text": "Join Battle Royale Solo, Duo, Squad, and Clash Squad matches hosted every hour."}, {"label": "Instant UPI Withdrawals", "text": "Prize winnings are credited to your Booyah Win wallet within 15 minutes of match conclusion for fast UPI transfer."}, {"label": "Free Fire ID Parity", "text": "Ensure your registered in-game UID and Free Fire name match your lobby slot exactly to prevent kick-outs."}]'::jsonb,
        'Room ID & Password unlock in the app exactly 15 minutes before the scheduled match time.',
        '/matches',
        'Explore Matches',
        3,
        true
      ),
      (
        '🚨 Limit for CS/LW Players!',
        'Announcement',
        '17 Jan',
        'Match Entry & Punctuality Policy',
        'Daily tournament entry limits and slot reservations to ensure fair queueing.',
        '[{"label": "Room Punctuality", "text": "Players must enter the Free Fire custom room within 10 minutes of room credentials being published."}, {"label": "Queue Reservation", "text": "To avoid slot hoarding, do not register for overlapping matches. Unattended slots will not be refunded."}, {"label": "Fair Matchmaking", "text": "Teams must only invite verified registered teammates into team lobby slots."}]'::jsonb,
        'Contact Customer Support immediately if you experience room entry connectivity issues.',
        '/support',
        'Customer Support',
        4,
        true
      ),
      (
        '✨✨ Staff Applications Open!',
        'Announcement',
        '20 Jul',
        'Join the Booyah Win Tournament Operations Team',
        'Booyah Win is recruiting tournament referees, room creators, and support staff.',
        '[{"label": "Role Responsibilities", "text": "Create verified Free Fire custom rooms, supervise fair play, and upload final match scoreboard screenshots."}, {"label": "Eligibility Criteria", "text": "Must be 18+ years of age, possess a valid government ID (Aadhaar/PAN), and have competitive Free Fire experience."}, {"label": "How to Apply", "text": "Send an email to support@booyah.win or contact staff via Help & Support with your gaming resume and contact information."}]'::jsonb,
        'Selected applicants will undergo verification and referee training before room hosting rights are granted.',
        '/support',
        'Contact Support',
        5,
        true
      );
  `);
};

exports.down = (pgm) => {
  pgm.sql(`
    DROP INDEX IF EXISTS idx_important_updates_active_order;
    DROP TABLE IF EXISTS important_updates;
  `);
};
