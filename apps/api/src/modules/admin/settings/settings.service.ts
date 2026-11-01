import { paiseToString, stringToPaise, parseCashbackPercentToBasisPoints, ErrorCodes } from '@booyah/shared';
import { query, withTransaction } from '../../../db/index.js';
import { AppError } from '../../../middleware/errorHandler.js';
import { invalidateMaintenanceCache } from '../../../middleware/maintenance.js';
import { writeAuditLog } from '../../../utils/audit.js';
import { uploadScreenshot, getSignedUrl, deleteFile } from '../../../utils/storage.js';

export const DEFAULT_MATCH_RULES_EN = `Instructions Before Joining
1. Enter your FF MAX account name only (no changes allowed later).
2. Match Room ID and Password will be sent 5-7 minutes before the match.
3. Make sure NOT to use Double Vector & M79.
4. Make sure NOT to use Ryden [Makdi Character].
5. If a player forgets to join the match, no refunds will be given. Please play responsibly.
6. Please review the reward pool distribution carefully before joining. The displayed pool on the card may represent a total distribution or demo amount.
7. In FF FULL MAP, FF FULL MAP 2 Matches, Double Snipers are banned. If found using a Sniper, no rewards will be processed.
8. In ALL MODES Horse [GHODA] is banned. If found using Horse[GHODA], no rewards will be processed.
9. In Survival Matches, Snipers, Double Snipers are banned. If found using a Sniper, no rewards will be processed.

Eligibility Rules
1. Only players with a Level 40+ ID are allowed.
2. Headshot rate must be <= 70% in BR career.
3. Play only on Android, iOS, tablets, or phones (Emulators are NOT allowed).

Prohibited Behaviour / Not Allowed
- Aimbot / Hacking / No Recoil
- Ryden [Makdi Character]
- Snipers in Survival Matches
- Double Vector & M79
- Game modifying tools (Config, Scripts, etc.)
- Exploiting Glitches or Bugs
- Teaming up with opponents
- Inviting unregistered players

Fair Play Rules
Players may be asked to provide their Match Screen Recording (HUD) within 2 days. Failure to submit will result in an immediate ban of the Booyah Win account and rejection of withdrawals.

Important Guidelines
- Blacklisted Game-IDs are not allowed. Any report from Garena will result in an immediate ban.
- If slots are not full, then the winning rewards may get changed as per the structure.
- If a player violates rules, rewards will not be processed, and it will lead to a permanent ban.
- If the room is full, keep a screenshot of the full room ready for a refund.
- If killed by a hacker/team-up player, record video evidence for a refund.
- Abusing any Player/Host will lead to an immediate ban.
- Note: If we find any suspicious gameplay, the player can be asked for match screen recording. If not provided, the account will be suspended immediately.

Raise Your Query
- Raise issues with customer support within 2 hours of match end time.
- Booyah Win reserves the right to modify exciting rewards and rules.`;

export const DEFAULT_MATCH_RULES_BN = `যোগদানের পূর্বের নির্দেশাবলী
১. শুধুমাত্র আপনার FF MAX অ্যাকাউন্টের নাম লিখুন (পরবর্তীতে কোনো পরিবর্তন করা যাবে না)।
২. ম্যাচ শুরুর ৫-৭ মিনিট আগে ম্যাচ রুম আইডি এবং পাসওয়ার্ড পাঠানো হবে।
৩. কোনো অবস্থাতেই Double Vector এবং M79 ব্যবহার করবেন না।
৪. কোনো অবস্থাতেই Ryden [মাকড়সা চরিত্র / Makdi Character] ব্যবহার করবেন না।
৫. কোনো খেলোয়াড় যদি ম্যাচে যোগ দিতে ভুলে যান, তবে কোনো রিফান্ড দেওয়া হবে না। দয়া করে দায়িত্বের সাথে খেলুন।
৬. যোগদানের পূর্বে পুরষ্কার বিতরণের নিয়মাবলী সতর্কতার সাথে পর্যালোচনা করুন। কার্ডে প্রদর্শিত পুলটি মোট বণ্টন বা ডেমো পরিমাণ হতে পারে।
৭. FF FULL MAP এবং FF FULL MAP 2 ম্যাচে Double Sniper সম্পূর্ণ নিষিদ্ধ। Sniper ব্যবহার করলে কোনো পুরষ্কার দেওয়া হবে না।
৮. সমস্ত মোডে ঘোড়া [Horse/GHODA] ব্যবহার সম্পূর্ণ নিষিদ্ধ। ঘোড়া ব্যবহার করলে কোনো পুরষ্কার দেওয়া হবে না।
৯. Survival ম্যাচে Sniper এবং Double Sniper সম্পূর্ণ নিষিদ্ধ। Sniper ব্যবহার করলে কোনো পুরষ্কার দেওয়া হবে না।

যোগ্যতার নিয়মাবলী
১. শুধুমাত্র লেভেল ৪০+ (Level 40+) আইডি অনুমোদিত।
২. BR ক্যারিয়ারে হেডশট রেট অবশ্যই <= ৭০% হতে হবে।
৩. শুধুমাত্র Android, iOS, ট্যাবলেট বা ফোনে খেলুন (ইমুলেটর সম্পূর্ণ নিষিদ্ধ)।

নিষিদ্ধ আচরণ / যা অনুমোদিত নয়
- Aimbot / হ্যাকিং / No Recoil
- Ryden [মাকড়সা চরিত্র / Makdi Character]
- Survival ম্যাচে Snipers
- Double Vector ও M79
- গেম পরিবর্তনকারী টুলস (Config, Scripts ইত্যাদি)
- গ্লিচ (Glitches) বা বাগ (Bugs) অপব্যবহার করা
- বিপক্ষ দলের খেলোয়াড়দের সাথে টিম-আপ (Teaming up) করা
- অনিবন্ধিত খেলোয়াড়দের আমন্ত্রণ জানানো

ন্যায্য খেলার নিয়ম
খেলোয়াড়দের ২ দিনের মধ্যে তাদের ম্যাচ স্ক্রিন রেকর্ডিং (HUD) জমা দিতে বলা হতে পারে। ব্যর্থ হলে তাৎক্ষণিকভাবে Booyah Win অ্যাকাউন্ট নিষিদ্ধ করা হবে এবং টাকা তোলা (Withdrawals) বাতিল করা হবে।

গুরুত্বপূর্ণ নির্দেশিকা
- ব্ল্যাকলিস্টেড গেম-আইডি অনুমোদিত নয়। গেরিনা (Garena) থেকে যেকোনো রিপোর্টের ক্ষেত্রে তাৎক্ষণিক ব্যান করা হবে।
- যদি স্লট পূর্ণ না হয়, তবে কাঠামো অনুযায়ী জয়ের পুরস্কার পরিবর্তিত হতে পারে।
- কোনো খেলোয়াড় নিয়ম লঙ্ঘন করলে, কোনো পুরস্কার দেওয়া হবে না এবং স্থায়ীভাবে অ্যাকাউন্ট ব্যান করা হবে।
- যদি কাস্টম রুম পূর্ণ থাকে, তবে রিফান্ডের জন্য পূর্ণ রুমের একটি স্ক্রিনশট প্রস্তুত রাখুন।
- হ্যাকার বা টিম-আপ খেলোয়াড়ের হাতে নিহত হলে, রিফান্ডের জন্য ভিডিও প্রমাণ রেকর্ড করুন।
- যেকোনো খেলোয়াড় বা হোস্টের সাথে দুর্ব্যবহার করলে তাৎক্ষণিকভাবে ব্যান করা হবে।
- দ্রষ্টব্য: কোনো সন্দেহজনক গেমপ্লে ধরা পড়লে, খেলোয়াড়ের কাছে ম্যাচ স্ক্রিন রেকর্ডিং চাওয়া হতে পারে। না দিলে অ্যাকাউন্ট অবিলম্বে স্থগিত করা হবে।

প্রশ্ন বা অভিযোগ
- ম্যাচ শেষ হওয়ার ২ ঘণ্টার মধ্যে কাস্টমার সাপোর্টে সমস্যা জানান।
- Booyah Win যেকোনো উত্তেজনাপূর্ণ পুরষ্কার এবং নিয়মাবলী পরিবর্তন বা সংশোধন করার অধিকার সংরক্ষণ করে।`;

export const DEFAULT_MATCH_RULES_CS_EN = `Instructions Before Joining :
Enter your FF MAX account name only (no changes allowed)
Match room ID and password will be sent 2-3 minutes before the match
Read Other Rules Carefully
No Refunds if player forgots to Join Match

Eligibility Rules:
Only players with Level 40+ ID
Headshot rate must be below 70% in CS career
Play only on Android, iOS, tablets, or phones (emulators are not allowed)

Room Structure:
Rounds : 7
Default Coins : 9950
Character Skill : Yes
Gun Attributes : Yes
All guns are Allowed Except Double Vector
Refund For Players Killed By Hackers
Emulators : No
Mode : Random Store
Chips are Allowed
Gloo Breaking is Allowed

Prohibited Behaviour/Not Allowed:
Aimbot
Heal Battle
Ryden & A124
No recoil
Hacking
Double Vector & Throwables(Grenades,Flash Freeze,etc.)
Zone Packing
Game modifying tools
Glitches
Bugs
Teaming up with opponents
Inviting players who are not registered

Fair Play Rules:
Players may be asked to provide their Match Screen recording (HUD) within 2 days of the match. Failure to submit the recording when requested will result in an immediate ban of the Booyah Win account and rejection of any pending withdrawals.

Some Important Tips:
Blacklisted Game-ID's are not allowed to play and immediate ban will be issued if we got any report from Garena .
Note if there is any mistake in room structure then immediately report it to host or customer support for action/if not updated then lateron no actions will be taken.
If a player is found violating any of the rules, the prize will not be processed, and it may result in a ban.
Rules can be changed without any prior notice.
If you are killed by any hacker/team-up player, record evidence for a full refund.
Abusing any of the Player/Host will lead to an immediate ban.

Raise Your Query:
Raise issues with customer support within 2 hours of match end time

Note:
Booyah Win reserves the right to modify prizes and rules.`;

export const DEFAULT_MATCH_RULES_CS_BN = `যোগদানের পূর্বের নির্দেশাবলী :
শুধুমাত্র আপনার FF MAX অ্যাকাউন্টের নাম লিখুন (কোনো পরিবর্তন গ্রহণযোগ্য নয়)
ম্যাচ শুরুর ২-৩ মিনিট আগে ম্যাচ রুম আইডি এবং পাসওয়ার্ড পাঠানো হবে
অন্যান্য নিয়মাবলী সতর্কতার সাথে পড়ুন
কোনো খেলোয়াড় ম্যাচে যোগ দিতে ভুলে গেলে কোনো রিফান্ড দেওয়া হবে না

যোগ্যতার নিয়মাবলী:
শুধুমাত্র লেভেল ৪০+ (Level 40+) আইডি অনুমোদিত
CS ক্যারিয়ারে হেডশট রেট অবশ্যই ৭০%-এর নিচে হতে হবে
শুধুমাত্র Android, iOS, ট্যাবলেট বা ফোনে খেলুন (ইমুলেটর সম্পূর্ণ নিষিদ্ধ)

রুমের কাঠামো:
রাউন্ড : ৭
ডিফল্ট কয়েন : ৯৯৫০
চরিত্রের দক্ষতা (Character Skill) : হ্যাঁ
বন্দুকের বৈশিষ্ট্য (Gun Attributes) : হ্যাঁ
Double Vector ছাড়া সব বন্দুক অনুমোদিত
হ্যাকারের হাতে নিহত খেলোয়াড়দের রিফান্ড দেওয়া হবে
ইমুলেটর : না
মোড : Random Store
চিপস (Chips) অনুমোদিত
গ্লু ওয়াল ভাঙা (Gloo Breaking) অনুমোদিত

নিষিদ্ধ আচরণ / যা অনুমোদিত নয়:
- Aimbot
- Heal Battle
- Ryden ও A124 চরিত্র
- No recoil
- হ্যাকিং
- Double Vector ও Throwables (Grenades, Flash Freeze ইত্যাদি)
- Zone Packing
- গেম পরিবর্তনকারী টুলস
- গ্লিচ (Glitches)
- বাগ (Bugs)
- বিপক্ষ দলের সাথে টিম-আপ করা
- অনিবন্ধিত খেলোয়াড়দের আমন্ত্রণ জানানো

ন্যায্য খেলার নিয়ম:
খেলোয়াড়দের ম্যাচের ২ দিনের মধ্যে তাদের ম্যাচ স্ক্রিন রেকর্ডিং (HUD) জমা দিতে বলা হতে পারে। অনুরোধের পর রেকর্ডিং জমা দিতে ব্যর্থ হলে Booyah Win অ্যাকাউন্ট অবিলম্বে ব্যান করা হবে এবং যেকোনো পেন্ডিং উইথড্রয়াল বাতিল করা হবে।

গুরুত্বপূর্ণ কিছু টিপস:
- ব্ল্যাকলিস্টেড গেম-আইডি দিয়ে খেলা যাবে না এবং গেরিনা (Garena) থেকে কোনো রিপোর্ট পেলে তাৎক্ষণিক ব্যান করা হবে।
- মনে রাখবেন রুমের কাঠামোতে কোনো ভুল থাকলে অবিলম্বে হোস্ট বা কাস্টমার সাপোর্টে জানান। আপডেট না জানালে পরবর্তীতে কোনো ব্যবস্থা নেওয়া হবে না।
- কোনো খেলোয়াড় নিয়ম লঙ্ঘন করলে পুরস্কার প্রদান করা হবে না এবং অ্যাকাউন্ট ব্যান হতে পারে।
- কোনো পূর্ব নোটিশ ছাড়াই নিয়ম পরিবর্তন করা হতে পারে।
- হ্যাকার বা টিম-আপ খেলোয়াড়ের হাতে নিহত হলে পূর্ণ রিফান্ডের জন্য প্রমাণ রেকর্ড করুন।
- কোনো খেলোয়াড় বা হোস্টের সাথে দুর্ব্যবহার করলে অবিলম্বে ব্যান করা হবে।

আপনার অভিযোগ জানান:
ম্যাচ শেষ হওয়ার ২ ঘণ্টার মধ্যে কাস্টমার সাপোর্টে অভিযোগ জানান।

দ্রষ্টব্য:
Booyah Win যেকোনো পুরষ্কার এবং নিয়মাবলী পরিবর্তন করার অধিকার সংরক্ষণ করে।`;

export const DEFAULT_MATCH_RULES_LW_EN = `Instructions Before Joining :
Enter your FF MAX account name only (no changes allowed)
Match room ID and password will be sent 2-3 minutes before the match
Read Other Rules Carefully
No Refunds if player forgets to Join Match

Eligibility Rules:
Only players with Level 40+ ID
Headshot rate must be below 70% in Lone Wolf career
Play only on Android, iOS, tablets, or phones (emulators are not allowed)

Room Structure:
Rounds : 9 (First team to win 5 rounds wins the match)
Character Skill : Yes
Gun Attributes : Yes
All guns are Allowed Except Double Vector
Refund For Players Killed By Hackers
Emulators : No
Total Teams : 2 (1v1 for Solo, 2v2 for Duo)

Prohibited Behaviour/Not Allowed:
- Aimbot / Hacking / No Recoil
- Ryden [Makdi Character] & A124
- Double Vector & Throwables (Grenades, Flash Freeze, etc.)
- Zone Packing / Heal Battle
- Game modifying tools (Config, Scripts, etc.)
- Exploiting Glitches or Bugs
- Teaming up with opponents
- Inviting unregistered players

Fair Play Rules:
Players may be asked to provide their Match Screen recording (HUD) within 2 days of the match. Failure to submit the recording when requested will result in an immediate ban of the Booyah Win account and rejection of withdrawals.

Some Important Tips:
Blacklisted Game-ID's are not allowed to play and immediate ban will be issued if we got any report from Garena.
If a player is found violating any of the rules, the prize will not be processed, and it may result in a ban.
Rules can be changed without any prior notice.
If you are killed by any hacker/team-up player, record evidence for a full refund.
Abusing any of the Player/Host will lead to an immediate ban.

Raise Your Query:
Raise issues with customer support within 2 hours of match end time

Note:
Booyah Win reserves the right to modify prizes and rules.`;

export const DEFAULT_MATCH_RULES_LW_BN = `যোগদানের পূর্বের নির্দেশাবলী :
শুধুমাত্র আপনার FF MAX অ্যাকাউন্টের নাম লিখুন (কোনো পরিবর্তন গ্রহণযোগ্য নয়)
ম্যাচ শুরুর ২-৩ মিনিট আগে ম্যাচ রুম আইডি এবং পাসওয়ার্ড পাঠানো হবে
অন্যান্য নিয়মাবলী সতর্কতার সাথে পড়ুন
কোনো খেলোয়াড় ম্যাচে যোগ দিতে ভুলে গেলে কোনো রিফান্ড দেওয়া হবে না

যোগ্যতার নিয়মাবলী:
শুধুমাত্র লেভেল ৪০+ (Level 40+) আইডি অনুমোদিত
Lone Wolf ক্যারিয়ারে হেডশট রেট অবশ্যই ৭০%-এর নিচে হতে হবে
শুধুমাত্র Android, iOS, ট্যাবলেট বা ফোনে খেলুন (ইমুলেটর সম্পূর্ণ নিষিদ্ধ)

রুমের কাঠামো:
রাউন্ড : ৯ (প্রথমে ৫টি রাউন্ড জয়ী দল বিজয়ী হবে)
চরিত্রের দক্ষতা (Character Skill) : হ্যাঁ
বন্দুকের বৈশিষ্ট্য (Gun Attributes) : হ্যাঁ
Double Vector ছাড়া সব বন্দুক অনুমোদিত
হ্যাকারের হাতে নিহত খেলোয়াড়দের রিফান্ড দেওয়া হবে
ইমুলেটর : না
মোট দল : ২টি (Solo-এর জন্য 1v1, Duo-এর জন্য 2v2)

নিষিদ্ধ আচরণ / যা অনুমোদিত নয়:
- Aimbot / হ্যাকিং / No Recoil
- Ryden ও A124 চরিত্র
- Double Vector ও Throwables (Grenades, Flash Freeze ইত্যাদি)
- Zone Packing / Heal Battle
- গেম পরিবর্তনকারী টুলস
- গ্লিচ (Glitches) বা বাগ (Bugs)
- বিপক্ষ দলের সাথে টিম-আপ করা
- অনিবন্ধিত খেলোয়াড়দের আমন্ত্রণ জানানো

ন্যায্য খেলার নিয়ম:
খেলোয়াড়দের ম্যাচের ২ দিনের মধ্যে তাদের ম্যাচ স্ক্রিন রেকর্ডিং (HUD) জমা দিতে বলা হতে পারে। অনুরোধের পর রেকর্ডিং জমা দিতে ব্যর্থ হলে Booyah Win অ্যাকাউন্ট অবিলম্বে ব্যান করা হবে এবং যেকোনো পেন্ডিং উইথড্রয়াল বাতিল করা হবে।

গুরুত্বপূর্ণ কিছু টিপস:
- ব্ল্যাকলিস্টেড গেম-আইডি দিয়ে খেলা যাবে না এবং গেরিনা থেকে কোনো রিপোর্ট পেলে তাৎক্ষণিক ব্যান করা হবে।
- কোনো খেলোয়াড় নিয়ম লঙ্ঘন করলে পুরস্কার প্রদান করা হবে না এবং অ্যাকাউন্ট ব্যান হতে পারে।
- কোনো পূর্ব নোটিশ ছাড়াই নিয়ম পরিবর্তন করা হতে পারে।
- হ্যাকার বা টিম-আপ খেলোয়াড়ের হাতে নিহত হলে পূর্ণ রিফান্ডের জন্য প্রমাণ রেকর্ড করুন।
- কোনো খেলোয়াড় বা হোস্টের সাথে দুর্ব্যবহার করলে অবিলম্বে ব্যান করা হবে।

আপনার অভিযোগ জানান:
ম্যাচ শেষ হওয়ার ২ ঘণ্টার মধ্যে কাস্টমার সাপোর্টে অভিযোগ জানান।

দ্রষ্টব্য:
Booyah Win যেকোনো পুরষ্কার এবং নিয়মাবলী পরিবর্তন করার অধিকার সংরক্ষণ করে।`;

export const DEFAULT_INVITATION_TEXT = `Hey, Download Booyah Win - Play Free Fire Tournaments & Win Money\nJoin tournaments, show your skills and win real cash prizes!`;

export const DEFAULT_SETTINGS: Record<string, string> = {
  min_deposit: '10.00',
  max_deposit: '5000.00',
  min_withdrawal: '50.00',
  max_withdrawal: '10000.00',
  admin_approval_threshold: '2000.00',
  joining_reward: '0.00',
  referral_reward: '5.00',
  support_name: '',
  support_phone: '',
  support_email: '',
  support_hours: '10:00 AM - 10:00 PM IST',
  payment_upi_id: '',
  payment_qr_url: '',
  payment_qr_key: '',
  maintenance_enabled: 'false',
  maintenance_message: 'Under scheduled maintenance. Please check back shortly.',
  maintenance_until: '',
  cashback_max_percent: '5',
  community_whatsapp: 'https://chat.whatsapp.com/demo',
  community_instagram: 'https://instagram.com/booyahwin',
  community_telegram: 'https://t.me/booyahwin',
  community_youtube: 'https://youtube.com/@booyahwin',
  match_rules_image_url: '',
  match_rules_image_key: '',
  match_rules_cs_image_url: '',
  match_rules_cs_image_key: '',
  match_rules_lw_image_url: '',
  match_rules_lw_image_key: '',
  match_rules_en: DEFAULT_MATCH_RULES_EN,
  match_rules_bn: DEFAULT_MATCH_RULES_BN,
  match_rules_cs_en: DEFAULT_MATCH_RULES_CS_EN,
  match_rules_cs_bn: DEFAULT_MATCH_RULES_CS_BN,
  match_rules_lw_en: DEFAULT_MATCH_RULES_LW_EN,
  match_rules_lw_bn: DEFAULT_MATCH_RULES_LW_BN,
  invitation_text: DEFAULT_INVITATION_TEXT,
};

export class SettingsService {
  /**
   * Idempotent seed for app_settings table defaults.
   */
  static async seedDefaults(): Promise<void> {
    for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
      await query(
        `INSERT INTO app_settings (key, value)
         VALUES ($1, $2)
         ON CONFLICT (key) DO NOTHING`,
        [key, value]
      );
    }
  }

  /**
   * Returns all settings as a key-value map.
   */
  static async getAllSettings(): Promise<Record<string, string>> {
    const res = await query('SELECT key, value FROM app_settings');
    const settings: Record<string, string> = { ...DEFAULT_SETTINGS };
    for (const row of res.rows) {
      if (row.key in DEFAULT_SETTINGS) {
        settings[row.key] = row.value;
      }
    }
    if (settings.payment_qr_key && settings.payment_qr_key.trim()) {
      try {
        const qrUrl = await getSignedUrl(settings.payment_qr_key.trim(), 3600);
        if (qrUrl) {
          settings.payment_qr_url = qrUrl;
        }
      } catch {
        // ignore storage/signing error
      }
    }
    if (settings.match_rules_image_key && settings.match_rules_image_key.trim()) {
      try {
        const bannerUrl = await getSignedUrl(settings.match_rules_image_key.trim(), 3600);
        if (bannerUrl) {
          settings.match_rules_image_url = bannerUrl;
        }
      } catch {
        // ignore storage/signing error
      }
    }
    if (settings.match_rules_cs_image_key && settings.match_rules_cs_image_key.trim()) {
      try {
        const csBannerUrl = await getSignedUrl(settings.match_rules_cs_image_key.trim(), 3600);
        if (csBannerUrl) {
          settings.match_rules_cs_image_url = csBannerUrl;
        }
      } catch {
        // ignore storage/signing error
      }
    }
    if (settings.match_rules_lw_image_key && settings.match_rules_lw_image_key.trim()) {
      try {
        const lwBannerUrl = await getSignedUrl(settings.match_rules_lw_image_key.trim(), 3600);
        if (lwBannerUrl) {
          settings.match_rules_lw_image_url = lwBannerUrl;
        }
      } catch {
        // ignore storage/signing error
      }
    }
    return settings;
  }

  /**
   * Returns public support details (Section 14).
   * Does not expose individual employee numbers.
   */
  static async getSupportInfo(): Promise<{
    supportName: string;
    supportPhone: string;
    supportEmail: string;
    supportHours: string;
  }> {
    const settings = await this.getAllSettings();
    return {
      supportName: settings.support_name || 'Booyah Win Support',
      supportPhone: settings.support_phone || '',
      supportEmail: settings.support_email || '',
      supportHours: settings.support_hours || '10:00 AM - 10:00 PM IST',
    };
  }

  /**
   * Returns official community social media links.
   */
  static async getCommunityLinks(): Promise<{
    whatsapp: string;
    instagram: string;
    telegram: string;
    youtube: string;
  }> {
    const settings = await this.getAllSettings();
    return {
      whatsapp: settings.community_whatsapp || 'https://chat.whatsapp.com/demo',
      instagram: settings.community_instagram || 'https://instagram.com/booyahwin',
      telegram: settings.community_telegram || 'https://t.me/booyahwin',
      youtube: settings.community_youtube || 'https://youtube.com/@booyahwin',
    };
  }

  /**
   * Returns payment details (Section 7.1).
   * While payment_upi_id is empty, returns clear "not configured" response. QR is optional.
   */
  static async getPaymentInfo(): Promise<{
    configured: boolean;
    message?: string;
    paymentUpiId?: string | null;
    paymentQrUrl?: string | null;
    qrUrl?: string | null;
    minDeposit: string;
    maxDeposit: string;
    minWithdrawal: string;
    maxWithdrawal: string;
  }> {
    const settings = await this.getAllSettings();
    const upiId = settings.payment_upi_id?.trim() || '';

    if (!upiId) {
      return {
        configured: false,
        message: 'Payment information not configured yet',
        paymentUpiId: null,
        paymentQrUrl: null,
        qrUrl: null,
        minDeposit: settings.min_deposit || '10.00',
        maxDeposit: settings.max_deposit || '5000.00',
        minWithdrawal: settings.min_withdrawal || '50.00',
        maxWithdrawal: settings.max_withdrawal || '10000.00',
      };
    }

    let qrUrl: string | null = null;
    if (settings.payment_qr_key && settings.payment_qr_key.trim()) {
      try {
        qrUrl = await getSignedUrl(settings.payment_qr_key.trim(), 3600);
      } catch {
        qrUrl = null;
      }
    } else if (settings.payment_qr_url && settings.payment_qr_url.trim()) {
      qrUrl = settings.payment_qr_url.trim();
    }

    return {
      configured: true,
      paymentUpiId: upiId,
      paymentQrUrl: qrUrl,
      qrUrl,
      minDeposit: settings.min_deposit || '10.00',
      maxDeposit: settings.max_deposit || '5000.00',
      minWithdrawal: settings.min_withdrawal || '50.00',
      maxWithdrawal: settings.max_withdrawal || '10000.00',
    };
  }

  /**
   * Returns tournament rules, policies, and banner image (Section 11.5).
   * Supports mode-specific rules for Battle Royale and Clash Squad.
   */
  static async getMatchRules(gameMode?: string): Promise<{
    imageUrl: string;
    rulesEn: string;
    rulesBn: string;
  }> {
    const settings = await this.getAllSettings();
    const isClashSquad =
      typeof gameMode === 'string' &&
      (gameMode.trim().toLowerCase() === 'clash_squad' ||
        gameMode.trim().toLowerCase() === 'cs');
    const isLoneWolf =
      typeof gameMode === 'string' &&
      (gameMode.trim().toLowerCase() === 'lone_wolf' ||
        gameMode.trim().toLowerCase() === 'lw');

    const rulesEn = isLoneWolf
      ? (settings.match_rules_lw_en || DEFAULT_MATCH_RULES_LW_EN)
      : isClashSquad
      ? (settings.match_rules_cs_en || DEFAULT_MATCH_RULES_CS_EN)
      : (settings.match_rules_en || DEFAULT_MATCH_RULES_EN);

    const rulesBn = isLoneWolf
      ? (settings.match_rules_lw_bn || DEFAULT_MATCH_RULES_LW_BN)
      : isClashSquad
      ? (settings.match_rules_cs_bn || DEFAULT_MATCH_RULES_CS_BN)
      : (settings.match_rules_bn || DEFAULT_MATCH_RULES_BN);

    const imageUrl = isLoneWolf
      ? (settings.match_rules_lw_image_url || '')
      : isClashSquad
      ? (settings.match_rules_cs_image_url || '')
      : (settings.match_rules_image_url || settings.match_rules_br_image_url || '');

    return {
      imageUrl,
      rulesEn,
      rulesBn,
    };
  }

  /**
   * Admin updates settings. Validates money limits and writes audit log in transaction.
   * Rejects direct modification of payment_qr_key (only upload endpoint writes it).
   */
  static async updateSettings(
    adminId: string,
    updates: Record<string, string | null | undefined>
  ): Promise<Record<string, string>> {
    if ('payment_qr_key' in updates && updates.payment_qr_key !== undefined) {
      throw new AppError(
        'VALIDATION_ERROR',
        'payment_qr_key cannot be updated directly; use the upload endpoint',
        400
      );
    }
    if ('match_rules_image_key' in updates && updates.match_rules_image_key !== undefined) {
      throw new AppError(
        'VALIDATION_ERROR',
        'match_rules_image_key cannot be updated directly; use the upload endpoint',
        400
      );
    }
    if ('match_rules_cs_image_key' in updates && updates.match_rules_cs_image_key !== undefined) {
      throw new AppError(
        'VALIDATION_ERROR',
        'match_rules_cs_image_key cannot be updated directly; use the upload endpoint',
        400
      );
    }
    if ('match_rules_lw_image_key' in updates && updates.match_rules_lw_image_key !== undefined) {
      throw new AppError(
        'VALIDATION_ERROR',
        'match_rules_lw_image_key cannot be updated directly; use the upload endpoint',
        400
      );
    }

    if (updates.admin_approval_threshold !== undefined) {
      throw new AppError(
        ErrorCodes.VALIDATION_ERROR,
        'admin_approval_threshold is no longer configurable (all requests require admin approval)',
        400
      );
    }

    const current = await this.getAllSettings();

    // Check money limits logic if provided
    if (updates.min_deposit !== undefined || updates.max_deposit !== undefined) {
      const newMin = updates.min_deposit ?? current.min_deposit ?? '10.00';
      const newMax = updates.max_deposit ?? current.max_deposit ?? '5000.00';

      const minPaise = stringToPaise(newMin);
      const maxPaise = stringToPaise(newMax);

      if (minPaise <= 0) {
        throw new AppError(ErrorCodes.VALIDATION_ERROR, 'Minimum deposit must be greater than zero', 400);
      }
      if (maxPaise < minPaise) {
        throw new AppError(
          ErrorCodes.VALIDATION_ERROR,
          'Maximum deposit cannot be less than minimum deposit',
          400
        );
      }
    }

    // Check withdrawal limits logic if provided
    if (updates.min_withdrawal !== undefined || updates.max_withdrawal !== undefined) {
      const newMinW = updates.min_withdrawal ?? current.min_withdrawal ?? '50.00';
      const newMaxW = updates.max_withdrawal ?? current.max_withdrawal ?? '10000.00';

      const minWPaise = stringToPaise(newMinW);
      const maxWPaise = stringToPaise(newMaxW);

      if (minWPaise <= 0) {
        throw new AppError(ErrorCodes.VALIDATION_ERROR, 'Minimum withdrawal must be greater than zero', 400);
      }
      if (maxWPaise < minWPaise) {
        throw new AppError(
          ErrorCodes.VALIDATION_ERROR,
          'Maximum withdrawal cannot be less than minimum withdrawal',
          400
        );
      }
    }

    if (updates.cashback_max_percent !== undefined && updates.cashback_max_percent !== null) {
      try {
        parseCashbackPercentToBasisPoints(updates.cashback_max_percent);
      } catch (err: any) {
        throw new AppError(ErrorCodes.VALIDATION_ERROR, err.message, 400);
      }
    }

    if (updates.joining_reward !== undefined && updates.joining_reward !== null) {
      const joiningPaise = stringToPaise(updates.joining_reward);
      if (joiningPaise < 0) {
        throw new AppError(ErrorCodes.VALIDATION_ERROR, 'Joining reward cannot be negative', 400);
      }
    }

    if (updates.referral_reward !== undefined && updates.referral_reward !== null) {
      const refPaise = stringToPaise(updates.referral_reward);
      if (refPaise < 0) {
        throw new AppError(ErrorCodes.VALIDATION_ERROR, 'Referral reward cannot be negative', 400);
      }
    }

    if (updates.invitation_text !== undefined && updates.invitation_text !== null) {
      if (updates.invitation_text.length > 500) {
        throw new AppError(ErrorCodes.VALIDATION_ERROR, 'Invitation text must be at most 500 characters', 400);
      }
    }

    const result = await withTransaction(async (client) => {
      const keysToUpdate: string[] = Object.keys(updates).filter(
        (key) => updates[key] !== undefined
      );

      // Fetch existing values for audit log
      const existingRes = await client.query<{ key: string; value: string }>(
        `SELECT key, value FROM app_settings WHERE key = ANY($1)`,
        [keysToUpdate]
      );
      const oldMap: Record<string, string> = {};
      for (const row of existingRes.rows) {
        oldMap[row.key] = row.value;
      }

      const changes: Record<string, { old: string; new: string }> = {};
      for (const key of keysToUpdate) {
        const val = updates[key];
        const oldVal = oldMap[key] ?? DEFAULT_SETTINGS[key] ?? '';
        const newVal = (val === null || val === undefined) ? '' : val;
        changes[key] = { old: oldVal, new: newVal };

        await client.query(
          `INSERT INTO app_settings (key, value, updated_by, updated_at)
           VALUES ($1, $2, $3, now())
           ON CONFLICT (key)
           DO UPDATE SET value = EXCLUDED.value, updated_by = EXCLUDED.updated_by, updated_at = now()`,
          [key, newVal, adminId]
        );
      }

      const auditDetails: Record<string, any> = {
        updatedKeys: keysToUpdate,
        changes,
      };

      if (updates.cashback_max_percent !== undefined) {
        const oldCashback = oldMap['cashback_max_percent'] ?? DEFAULT_SETTINGS['cashback_max_percent'] ?? '5';
        const newCashback = updates.cashback_max_percent === null ? '5' : updates.cashback_max_percent;
        auditDetails.oldValue = oldCashback;
        auditDetails.newValue = newCashback;
        auditDetails.old = oldCashback;
        auditDetails.new = newCashback;
      }

      // Rule #9: Audit row in transaction
      await writeAuditLog(client, {
        staffId: adminId,
        action: 'settings_updated',
        targetType: 'app_settings',
        details: auditDetails,
      });

      // Load all settings
      const res = await client.query('SELECT key, value FROM app_settings');
      const updatedMap: Record<string, string> = { ...DEFAULT_SETTINGS };
      for (const row of res.rows) {
        if (row.key in DEFAULT_SETTINGS) {
          updatedMap[row.key] = row.value;
        }
      }
      if (updatedMap.payment_qr_key && updatedMap.payment_qr_key.trim()) {
        try {
          const qrUrl = await getSignedUrl(updatedMap.payment_qr_key.trim(), 3600);
          if (qrUrl) {
            updatedMap.payment_qr_url = qrUrl;
          }
        } catch {
          // ignore storage/signing error
        }
      }
      if (updatedMap.match_rules_image_key && updatedMap.match_rules_image_key.trim()) {
        try {
          const bannerUrl = await getSignedUrl(updatedMap.match_rules_image_key.trim(), 3600);
          if (bannerUrl) {
            updatedMap.match_rules_image_url = bannerUrl;
          }
        } catch {
          // ignore storage/signing error
        }
      }
      if (updatedMap.match_rules_cs_image_key && updatedMap.match_rules_cs_image_key.trim()) {
        try {
          const csBannerUrl = await getSignedUrl(updatedMap.match_rules_cs_image_key.trim(), 3600);
          if (csBannerUrl) {
            updatedMap.match_rules_cs_image_url = csBannerUrl;
          }
        } catch {
          // ignore storage/signing error
        }
      }
      if (updatedMap.match_rules_lw_image_key && updatedMap.match_rules_lw_image_key.trim()) {
        try {
          const lwBannerUrl = await getSignedUrl(updatedMap.match_rules_lw_image_key.trim(), 3600);
          if (lwBannerUrl) {
            updatedMap.match_rules_lw_image_url = lwBannerUrl;
          }
        } catch {
          // ignore storage/signing error
        }
      }
      return updatedMap;
    });

    invalidateMaintenanceCache();
    return result;
  }

  /**
   * Upload payment QR image:
   * - Uploads file (validates <= 2MB, magic bytes).
   * - Updates payment_qr_key in app_settings in transaction.
   * - If commit fails, deletes the new file.
   * - If commit succeeds, deletes the old file (if any).
   */
  static async uploadPaymentQr(
    adminId: string,
    fileBuffer: Buffer
  ): Promise<{ paymentQrKey: string; qrUrl: string }> {
    const newKey = await uploadScreenshot(fileBuffer);

    let oldKey: string | null = null;
    try {
      await withTransaction(async (client) => {
        const curr = await client.query(
          "SELECT value FROM app_settings WHERE key = 'payment_qr_key' FOR UPDATE"
        );
        if (curr.rowCount && curr.rows[0].value) {
          oldKey = curr.rows[0].value.trim();
        }

        await client.query(
          `INSERT INTO app_settings (key, value, updated_by, updated_at)
           VALUES ('payment_qr_key', $1, $2, now())
           ON CONFLICT (key)
           DO UPDATE SET value = EXCLUDED.value, updated_by = EXCLUDED.updated_by, updated_at = now()`,
          [newKey, adminId]
        );

        await writeAuditLog(client, {
          staffId: adminId,
          action: 'settings_payment_qr_updated',
          targetType: 'app_settings',
          details: { oldKey, newKey },
        });
      });
    } catch (err) {
      try {
        await deleteFile(newKey);
      } catch {
        // ignore delete failure on rollback
      }
      throw err;
    }

    // Delete old image only after successful commit
    if (oldKey && oldKey !== newKey) {
      try {
        await deleteFile(oldKey);
      } catch {
        // ignore delete error for old file
      }
    }

    const qrUrl = await getSignedUrl(newKey, 3600);
    return { paymentQrKey: newKey, qrUrl };
  }

  /**
   * Upload tournament match banner image (supports Battle Royale, Clash Squad, and Lone Wolf):
   * - Uploads file (validates <= 2MB, magic bytes).
   * - Updates match_rules_image_key / match_rules_image_url (or match_rules_cs_* / match_rules_lw_*) in app_settings in transaction.
   * - If commit fails, deletes the new file.
   * - If commit succeeds, deletes the old file (if any).
   */
  static async uploadMatchBanner(
    adminId: string,
    fileBuffer: Buffer,
    gameMode?: string
  ): Promise<{ matchRulesImageKey: string; matchRulesImageUrl: string; gameMode?: string }> {
    const isClashSquad =
      typeof gameMode === 'string' &&
      (gameMode.trim().toLowerCase() === 'clash_squad' ||
        gameMode.trim().toLowerCase() === 'cs');
    const isLoneWolf =
      typeof gameMode === 'string' &&
      (gameMode.trim().toLowerCase() === 'lone_wolf' ||
        gameMode.trim().toLowerCase() === 'lw');

    const keyField = isLoneWolf
      ? 'match_rules_lw_image_key'
      : isClashSquad
      ? 'match_rules_cs_image_key'
      : 'match_rules_image_key';
    const urlField = isLoneWolf
      ? 'match_rules_lw_image_url'
      : isClashSquad
      ? 'match_rules_cs_image_url'
      : 'match_rules_image_url';
    const auditAction = isLoneWolf
      ? 'settings_match_banner_lw_updated'
      : isClashSquad
      ? 'settings_match_banner_cs_updated'
      : 'settings_match_banner_updated';
    const resolvedMode = isLoneWolf ? 'lone_wolf' : isClashSquad ? 'clash_squad' : 'battle_royale';

    const newKey = await uploadScreenshot(fileBuffer);

    let oldKey: string | null = null;
    try {
      await withTransaction(async (client) => {
        const curr = await client.query(
          `SELECT value FROM app_settings WHERE key = $1 FOR UPDATE`,
          [keyField]
        );
        if (curr.rowCount && curr.rows[0].value) {
          oldKey = curr.rows[0].value.trim();
        }

        const bannerUrl = await getSignedUrl(newKey, 3600);

        await client.query(
          `INSERT INTO app_settings (key, value, updated_by, updated_at)
           VALUES ($1, $2, $3, now())
           ON CONFLICT (key)
           DO UPDATE SET value = EXCLUDED.value, updated_by = EXCLUDED.updated_by, updated_at = now()`,
          [keyField, newKey, adminId]
        );

        await client.query(
          `INSERT INTO app_settings (key, value, updated_by, updated_at)
           VALUES ($1, $2, $3, now())
           ON CONFLICT (key)
           DO UPDATE SET value = EXCLUDED.value, updated_by = EXCLUDED.updated_by, updated_at = now()`,
          [urlField, bannerUrl, adminId]
        );

        await writeAuditLog(client, {
          staffId: adminId,
          action: auditAction,
          targetType: 'app_settings',
          details: { oldKey, newKey, gameMode: resolvedMode },
        });
      });
    } catch (err) {
      try {
        await deleteFile(newKey);
      } catch {
        // ignore delete failure on rollback
      }
      throw err;
    }

    // Delete old image only after successful commit
    if (oldKey && oldKey !== newKey) {
      try {
        await deleteFile(oldKey);
      } catch {
        // ignore delete error for old file
      }
    }

    const matchRulesImageUrl = await getSignedUrl(newKey, 3600);
    return {
      matchRulesImageKey: newKey,
      matchRulesImageUrl,
      ...(isLoneWolf ? { gameMode: 'lone_wolf' } : isClashSquad ? { gameMode: 'clash_squad' } : {}),
    };
  }

  /**
   * Reset tournament match banner image back to default.
   */
  static async deleteMatchBanner(adminId: string, gameMode?: string): Promise<void> {
    const isClashSquad =
      typeof gameMode === 'string' &&
      (gameMode.trim().toLowerCase() === 'clash_squad' ||
        gameMode.trim().toLowerCase() === 'cs');
    const isLoneWolf =
      typeof gameMode === 'string' &&
      (gameMode.trim().toLowerCase() === 'lone_wolf' ||
        gameMode.trim().toLowerCase() === 'lw');

    const keyField = isLoneWolf
      ? 'match_rules_lw_image_key'
      : isClashSquad
      ? 'match_rules_cs_image_key'
      : 'match_rules_image_key';
    const urlField = isLoneWolf
      ? 'match_rules_lw_image_url'
      : isClashSquad
      ? 'match_rules_cs_image_url'
      : 'match_rules_image_url';
    const auditAction = isLoneWolf
      ? 'settings_match_banner_lw_deleted'
      : isClashSquad
      ? 'settings_match_banner_cs_deleted'
      : 'settings_match_banner_deleted';
    const resolvedMode = isLoneWolf ? 'lone_wolf' : isClashSquad ? 'clash_squad' : 'battle_royale';

    let oldKey: string | null = null;
    await withTransaction(async (client) => {
      const curr = await client.query(
        `SELECT value FROM app_settings WHERE key = $1 FOR UPDATE`,
        [keyField]
      );
      if (curr.rowCount && curr.rows[0].value) {
        oldKey = curr.rows[0].value.trim();
      }

      const keysToDelete = [keyField, urlField];

      await client.query(
        `UPDATE app_settings SET value = '', updated_by = $1, updated_at = now()
         WHERE key = ANY($2)`,
        [adminId, keysToDelete]
      );

      await writeAuditLog(client, {
        staffId: adminId,
        action: auditAction,
        targetType: 'app_settings',
        details: { oldKey, gameMode: resolvedMode },
      });
    });

    if (oldKey) {
      try {
        await deleteFile(oldKey);
      } catch {
        // ignore delete error
      }
    }
  }
}
