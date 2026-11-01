/* eslint-disable no-undef */
/**
 * Migration 1710000000029:
 * Add 'lone_wolf' to game_mode enum and seed lone wolf match rules settings.
 */
exports.up = (pgm) => {
  pgm.sql(`
    -- 1. Add lone_wolf to game_mode enum
    ALTER TYPE game_mode ADD VALUE IF NOT EXISTS 'lone_wolf';

    -- 2. Seed lone wolf rules in app_settings if not already present
    INSERT INTO app_settings (key, value)
    VALUES
      ('match_rules_lw_image_key', '""'::jsonb),
      ('match_rules_lw_en', '"Instructions Before Joining :\\nEnter your FF MAX account name only (no changes allowed)\\nMatch room ID and password will be sent 2-3 minutes before the match\\nRead Other Rules Carefully\\nNo Refunds if player forgets to Join Match\\n\\nEligibility Rules:\\nOnly players with Level 40+ ID\\nHeadshot rate must be below 70% in Lone Wolf career\\nPlay only on Android, iOS, tablets, or phones (emulators are not allowed)\\n\\nRoom Structure:\\nRounds : 9 (First team to win 5 rounds wins the match)\\nCharacter Skill : Yes\\nGun Attributes : Yes\\nAll guns are Allowed Except Double Vector\\nRefund For Players Killed By Hackers\\nEmulators : No\\nTotal Teams : 2 (1v1 for Solo, 2v2 for Duo)\\n\\nProhibited Behaviour/Not Allowed:\\n- Aimbot / Hacking / No Recoil\\n- Ryden [Makdi Character] & A124\\n- Double Vector & Throwables (Grenades, Flash Freeze, etc.)\\n- Zone Packing / Heal Battle\\n- Game modifying tools (Config, Scripts, etc.)\\n- Exploiting Glitches or Bugs\\n- Teaming up with opponents\\n- Inviting unregistered players\\n\\nFair Play Rules:\\nPlayers may be asked to provide their Match Screen recording (HUD) within 2 days of the match. Failure to submit the recording when requested will result in an immediate ban of the Booyah Win account and rejection of withdrawals.\\n\\nSome Important Tips:\\nBlacklisted Game-ID''s are not allowed to play and immediate ban will be issued if we got any report from Garena.\\nIf a player is found violating any of the rules, the prize will not be processed, and it may result in a ban.\\nRules can be changed without any prior notice.\\nIf you are killed by any hacker/team-up player, record evidence for a full refund.\\nAbusing any of the Player/Host will lead to an immediate ban.\\n\\nRaise Your Query:\\nRaise issues with customer support within 2 hours of match end time\\n\\nNote:\\nBooyah Win reserves the right to modify prizes and rules."'::jsonb),
      ('match_rules_lw_bn', '"যোগদানের পূর্বের নির্দেশাবলী :\\nশুধুমাত্র আপনার FF MAX অ্যাকাউন্টের নাম লিখুন (কোনো পরিবর্তন গ্রহণযোগ্য নয়)\\nম্যাচ শুরুর ২-৩ মিনিট আগে ম্যাচ রুম আইডি এবং পাসওয়ার্ড পাঠানো হবে\\nঅন্যান্য নিয়মাবলী সতর্কতার সাথে পড়ুন\\nকোনো খেলোয়াড় ম্যাচে যোগ দিতে ভুলে গেলে কোনো রিফান্ড দেওয়া হবে না\\n\\nযোগ্যতার নিয়মাবলী:\\nশুধুমাত্র লেভেল ৪০+ (Level 40+) আইডি অনুমোদিত\\nLone Wolf ক্যারিয়ারে হেডশট রেট অবশ্যই ৭০%-এর নিচে হতে হবে\\nশুধুমাত্র Android, iOS, ট্যাবলেট বা ফোনে খেলুন (ইমুলেটর সম্পূর্ণ নিষিদ্ধ)\\n\\nরুমের কাঠামো:\\nরাউন্ড : ৯ (প্রথমে ৫টি রাউন্ড জয়ী দল বিজয়ী হবে)\\nচরিত্রের দক্ষতা (Character Skill) : হ্যাঁ\\nবন্দুকের বৈশিষ্ট্য (Gun Attributes) : হ্যাঁ\\nDouble Vector ছাড়া সব বন্দুক অনুমোদিত\\nহ্যাকারের হাতে নিহত খেলোয়াড়দের রিফান্ড দেওয়া হবে\\nইমুলেটর : না\\nমোট দল : ২টি (Solo-এর জন্য 1v1, Duo-এর জন্য 2v2)\\n\\nনিষিদ্ধ আচরণ / যা অনুমোদিত নয়:\\n- Aimbot / হ্যাকিং / No Recoil\\n- Ryden ও A124 চরিত্র\\n- Double Vector ও Throwables (Grenades, Flash Freeze ইত্যাদি)\\n- Zone Packing / Heal Battle\\n- গেম পরিবর্তনকারী টুলস\\n- গ্লিচ (Glitches) বা বাগ (Bugs)\\n- বিপক্ষ দলের সাথে টিম-আপ করা\\n- অনিবন্ধিত খেলোয়াড়দের আমন্ত্রণ জানানো\\n\\nন্যায্য খেলার নিয়ম:\\nখেলোয়াড়দের ম্যাচের ২ দিনের মধ্যে তাদের ম্যাচ স্ক্রিন রেকর্ডিং (HUD) জমা দিতে বলা হতে পারে। অনুরোধের পর রেকর্ডিং জমা দিতে ব্যর্থ হলে Booyah Win অ্যাকাউন্ট অবিলম্বে ব্যান করা হবে এবং যেকোনো পেন্ডিং উইথড্রয়াল বাতিল করা হবে।\\n\\nগুরুত্বপূর্ণ কিছু টিপস:\\n- ব্ল্যাকলিস্টেড গেম-আইডি দিয়ে খেলা যাবে না এবং গেরিনা থেকে কোনো রিপোর্ট পেলে তাৎক্ষণিক ব্যান করা হবে।\\n- কোনো খেলোয়াড় নিয়ম লঙ্ঘন করলে পুরস্কার প্রদান করা হবে না এবং অ্যাকাউন্ট ব্যান হতে পারে।\\n- কোনো পূর্ব নোটিশ ছাড়াই নিয়ম পরিবর্তন করা হতে পারে।\\n- হ্যাকার বা টিম-আপ খেলোয়াড়ের হাতে নিহত হলে পূর্ণ রিফান্ডের জন্য প্রমাণ রেকর্ড করুন।\\n- কোনো খেলোয়াড় বা হোস্টের সাথে দুর্ব্যবহার করলে অবিলম্বে ব্যান করা হবে।\\n\\nআপনার অভিযোগ জানান:\\nম্যাচ শেষ হওয়ার ২ ঘণ্টার মধ্যে কাস্টমার সাপোর্টে অভিযোগ জানান।\\n\\nদ্রষ্টব্য:\\nBooyah Win যেকোনো পুরষ্কার এবং নিয়মাবলী পরিবর্তন করার অধিকার সংরক্ষণ করে."'::jsonb)
    ON CONFLICT (key) DO NOTHING;
  `);
};

exports.down = (pgm) => {
  // Enum values in Postgres cannot be removed safely with DROP VALUE
  pgm.sql(`
    DELETE FROM app_settings WHERE key IN ('match_rules_lw_image_key', 'match_rules_lw_en', 'match_rules_lw_bn');
  `);
};

