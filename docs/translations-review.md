# Booyah Win Translation Review (English & বাংলা)

This document contains the translation glossary and the exhaustive key-by-key review table for native Bengali review and parity verification.

---

## 1. Glossary of Main Terms

| Term | English | Bengali (বাংলা) | Notes & Context |
| :--- | :--- | :--- | :--- |
| **Booyah Win** | Booyah Win | Booyah Win | Brand name. Strictly untranslated. |
| **Free Fire** | Free Fire | Free Fire | Game title. Strictly untranslated. |
| **Wallet** | Wallet | ওয়ালেট | Refers to player account balances (Deposit, Cashback, Winnings). |
| **Deposit** | Deposit / Add Money | জমা / টাকা যোগ করুন | Action of adding funds to the wallet via UPI. |
| **Withdrawal** | Withdrawal | উত্তোলন | Action of sending verified tournament winnings to player's UPI. |
| **Cashback** | Cashback | ক্যাশব্যাক | Promotional credit earned from referral program and platform bonuses. |
| **Winnings** | Winnings | উইনিংস / জয়ের টাকা | Pure tournament prize money that is eligible for withdrawal. |
| **Entry Fee** | Entry Fee | এন্ট্রি ফি | Tournament buy-in deducted upon joining a match. |
| **Match** | Match | ম্যাচ | Tournament instance (Battle Royale, Clash Squad, or Lone Wolf). |
| **Room ID** | Room ID | রুম আইডি | Custom Free Fire lobby numeric identification. |
| **Leaderboard** | Leaderboard | লিডারবোর্ড | Weekly and monthly rankings based on tournament prize earnings. |
| **Referral** | Referral | রেফারেল | Player invitation program with lifetime cashback rewards. |
| **OTP** | OTP | OTP | One-Time Password for passwordless login and verification. |
| **UPI** | UPI | UPI | Unified Payments Interface for Indian bank transfers. |
| **UTR** | UTR | UTR | 12-digit Unique Transaction Reference from banking apps. |
| **System Maintenance** | System Maintenance | সিস্টেম রক্ষণাবেক্ষণ | Scheduled downtime state pausing matchmaking and wallet operations. |
| **Download App** | Download App | অ্যাপ ডাউনলোড করুন | Direct button to install the official native Android APK. |
| **APK** | APK | APK | Android Package Kit binary format. Strictly untranslated. |

---

## 2. Unchanging Entities & Formatting Rules

As per Section 3 of the task specifications:
1. **Never Translated**:
   - `Booyah Win` (Brand name and logo)
   - `Free Fire` (Game title)
   - Player names (User custom names and Free Fire in-game names)
   - Free Fire IDs (UID numeric strings)
   - Technical payment terms: `UTR`, `UPI`, `OTP`
   - Numeric money amounts (e.g., `Rs50.00`, `₹150.00`)
2. **Digits & Dates**:
   - Latin numerals (`0-9`) are strictly maintained for all money, IDs, OTP codes, and dates (using `numberingSystem: 'latn'`).
   - Timestamps follow Indian Standard Time (IST) convention (`Asia/Kolkata`).

---

## 3. Exhaustive Translation Key Review Table

| Key | English | Bengali (বাংলা) |
| :--- | :--- | :--- |
| `common.appName` | Booyah Win | Booyah Win |
| `common.english` | English | English |
| `common.bengali` | বাংলা | বাংলা |
| `common.confirm` | Confirm | নিশ্চিত করুন |
| `common.cancel` | Cancel | বাতিল |
| `common.save` | Save | সংরক্ষণ করুন |
| `common.edit` | Edit | সম্পাদনা |
| `common.delete` | Delete | মুছে ফেলুন |
| `common.close` | Close | বন্ধ করুন |
| `common.back` | Back | ফিরে যান |
| `common.submit` | Submit | জমা দিন |
| `common.submitting` | Submitting... | জমা দেওয়া হচ্ছে... |
| `common.retry` | Retry | পুনরায় চেষ্টা করুন |
| `common.loading` | Loading... | লোড হচ্ছে... |
| `common.copy` | Copy | কপি করুন |
| `common.copied` | Copied! | কপি করা হয়েছে! |
| `common.copiedToClipboard` | Copied to clipboard | ক্লিপবোর্ডে কপি করা হয়েছে |
| `common.search` | Search | অনুসন্ধান |
| `common.refresh` | Refresh | রিফ্রেশ করুন |
| `common.viewAll` | View All | সব দেখুন |
| `common.details` | Details | বিস্তারিত |
| `common.success` | Success | সফল |
| `common.error` | Error | ত্রুটি |
| `common.warning` | Warning | সতর্কতা |
| `common.info` | Info | তথ্য |
| `common.optional` | Optional | ঐচ্ছিক |
| `common.required` | Required | প্রয়োজনীয় |
| `common.learnMore` | Learn More | আরও জানুন |
| `common.language` | Language | ভাষা |
| `common.slowServer` | Waking up the server, this can take up to a minute | সার্ভার চালু করা হচ্ছে, এতে এক মিনিট পর্যন্ত সময় লাগতে পারে |
| `maintenance.systemMaintenance` | System Maintenance | সিস্টেম রক্ষণাবেক্ষণ |
| `maintenance.expectedFinish` | Expected to finish | সমাপ্তির সম্ভাব্য সময় |
| `nav.home` | Home | হোম |
| `nav.matches` | Matches | ম্যাচ |
| `nav.wallet` | Wallet | ওয়ালেট |
| `nav.leaderboard` | Leaderboard | লিডারবোর্ড |
| `nav.ranks` | Ranks | র‌্যাঙ্ক |
| `nav.profile` | Profile | প্রোফাইল |
| `nav.account` | Account | অ্যাকাউন্ট |
| `modal.language.title` | Choose your language | Choose your language |
| `modal.language.subtitle` | আপনার পছন্দের ভাষা নির্বাচন করুন | আপনার পছন্দের ভাষা নির্বাচন করুন |
| `modal.language.description` | Select the language you want to use throughout the application. You can change this anytime from your profile or footer. | পুরো অ্যাপ্লিকেশনে ব্যবহারের জন্য আপনার পছন্দের ভাষা নির্বাচন করুন। আপনি পরবর্তীতে প্রোফাইল বা ফুটার থেকে যেকোনো সময় এটি পরিবর্তন করতে পারবেন। |
| `landing.heroTitle` | Compete, Win, and Earn in Free Fire Tournaments | Free Fire টুর্নামেন্টে অংশ নিন, খেলুন এবং জিতুন |
| `landing.heroSubtitle` | India's premier competitive gaming platform. Play verified daily tournaments with instant UPI withdrawals, transparent anti-cheat rules, and fair play. | ভারতের শীর্ষস্থানীয় প্রতিযোগিতামূলক গেমিং প্ল্যাটফর্ম। তাৎক্ষণিক UPI উত্তোলন, স্বচ্ছ অ্যান্টি-চিট নিয়ম এবং ফেয়ার প্লে সহ খেলুন প্রতিদিনের যাচাইকৃত টুর্নামেন্ট। |
| `landing.playNow` | Play Now | এখনই খেলুন |
| `landing.loginWithOtp` | Login with OTP | OTP দিয়ে লগইন করুন |
| `landing.registerNow` | Create Account | অ্যাকাউন্ট তৈরি করুন |
| `landing.exploreMatches` | Explore Matches | ম্যাচগুলি দেখুন |
| `landing.activePlayers` | Active Players | সক্রিয় খেলোয়াড় |
| `landing.matchesHosted` | Matches Hosted | অনুষ্ঠিত ম্যাচ |
| `landing.payoutsGiven` | Winnings Distributed | বিতরণকৃত পুরস্কার |
| `landing.whyChooseUs` | Why Gamers Choose Booyah Win | কেন গেমাররা Booyah Win বেছে নেন |
| `landing.instantWithdrawalsTitle` | Instant Withdrawals | তাৎক্ষণিক উত্তোলন |
| `landing.instantWithdrawalsDesc` | Get your winnings directly to your UPI ID promptly after tournament verification. | টুর্নামেন্ট যাচাইয়ের পরপরই আপনার জয়ের টাকা সরাসরি আপনার UPI ID-তে পান। |
| `landing.fairPlayTitle` | 100% Fair Play | 100% ফেয়ার প্লে |
| `landing.fairPlayDesc` | Strict anti-cheat protocols, human-reviewed screenshots, and verified Free Fire identities. | কঠোর অ্যান্টি-চিট প্রোটোকল, ম্যানুয়ালি যাচাইকৃত স্ক্রিনশট এবং নিশ্চিত Free Fire পরিচয়। |
| `landing.support247Title` | Support | সহায়তা |
| `landing.support247Desc` | Dedicated customer support available to assist with room keys, deposits, and queries. | রুম আইডি, জমা বা যেকোনো সমস্যায় সহায়তা করার জন্য নিবেদিত কাস্টমার সাপোর্ট টিম সর্বদা প্রস্তুত। |
| `landing.howItWorksTitle` | How It Works | এটি কীভাবে কাজ করে |
| `landing.step1Title` | 1. Choose Your Match | ১. আপনার ম্যাচ নির্বাচন করুন |
| `landing.step1Desc` | Browse upcoming Battle Royale, Clash Squad, or Lone Wolf tournaments and register your spot. | আসন্ন Battle Royale, Clash Squad বা Lone Wolf টুর্নামেন্ট ব্রাউজ করুন এবং আপনার আসন নিশ্চিত করুন। |
| `landing.step2Title` | 2. Join the Room & Play | ২. রুমে প্রবেশ করুন এবং খেলুন |
| `landing.step2Desc` | Get room credentials 15 minutes before match time. Enter Free Fire custom room and show your skills. | ম্যাচ শুরুর ১৫ মিনিট আগে রুম আইডি এবং পাসওয়ার্ড পান। Free Fire কাস্টম রুমে যোগ দিয়ে আপনার দক্ষতা দেখান। |
| `landing.step3Title` | 3. Claim Your Winnings | ৩. আপনার জয়ের টাকা পান |
| `landing.step3Desc` | Results are verified promptly. Winnings are credited to your wallet for instant withdrawal. | ফলাফল দ্রুত যাচাই করা হয় এবং জয়ের টাকা সরাসরি আপনার ওয়ালেটে জমা হয় যা সাথে সাথে উত্তোলনযোগ্য। |
| `landing.footerTerms` | Terms of Service | ব্যবহারের শর্তাবলী |
| `landing.footerPrivacy` | Privacy Policy | গোপনীয়তা নীতি |
| `landing.footerSupport` | Support & Help | সহায়তা ও সাপোর্ট |
| `landing.footerCopyright` | © 2026 Booyah Win. All rights reserved. 18+ only. | © 2026 Booyah Win. সর্বস্বত্ব সংরক্ষিত। শুধুমাত্র ১৮ বছর বা তদূর্ধ্বদের জন্য। |
| `auth.loginTitle` | Welcome Back | স্বাগতম |
| `auth.loginSubtitle` | Enter your registered email to receive a login OTP | লগইন OTP পেতে আপনার নিবন্ধিত ইমেইল লিখুন |
| `auth.registerTitle` | Create an Account | একটি নতুন অ্যাকাউন্ট খুলুন |
| `auth.registerSubtitle` | Join thousands of competitive Free Fire players today | আজই হাজার হাজার প্রতিযোগী Free Fire খেলোয়াড়দের সাথে যোগ দিন |
| `auth.emailLabel` | Email Address | ইমেইল ঠিকানা |
| `auth.emailPlaceholder` | Enter your email address | আপনার ইমেইল ঠিকানা লিখুন |
| `auth.requestOtp` | Continue with OTP | OTP দিয়ে এগিয়ে যান |
| `auth.getVerificationCode` | Continue with OTP | OTP দিয়ে এগিয়ে যান |
| `auth.requestingOtp` | Sending Code... | কোড পাঠানো হচ্ছে... |
| `auth.verifyOtp` | Verify & Log In | যাচাই করে লগইন করুন |
| `auth.verifyEmail` | Verify & Log In | যাচাই করে লগইন করুন |
| `auth.codeSentSuccess` | 6-digit verification code sent successfully | ৬-সংখ্যার যাচাইকরণ কোড সফলভাবে পাঠানো হয়েছে |
| `auth.verifyingOtp` | Verifying... | যাচাই করা হচ্ছে... |
| `auth.enterOtp` | Security Code (OTP) | নিরাপত্তা কোড (OTP) |
| `auth.otpSentMessage` | Enter the 6-digit verification code sent to | প্রেরিত ৬-সংখ্যার যাচাইকরণ কোডটি লিখুন: |
| `auth.changeEmail` | Change email | ইমেইল পরিবর্তন করুন |
| `auth.resendOtp` | Resend OTP | OTP পুনরায় পাঠান |
| `auth.resendIn` | Resend in | পুনরায় পাঠানোর সময় বাকি |
| `auth.nameLabel` | Full Name | পুরো নাম |
| `auth.namePlaceholder` | Enter your full name as per Aadhaar/PAN | Aadhaar বা PAN অনুযায়ী আপনার পুরো নাম লিখুন |
| `auth.mobileLabel` | Mobile Number | মোবাইল নম্বর |
| `auth.mobilePlaceholder` | Enter 10-digit mobile number | ১০-সংখ্যার মোবাইল নম্বর লিখুন |
| `auth.ffIdLabel` | Free Fire ID (UID) | Free Fire ID (UID) |
| `auth.ffIdPlaceholder` | Enter numeric Free Fire UID (e.g. 123456789) | সংখ্যার Free Fire UID লিখুন (যেমন: 123456789) |
| `auth.ffNameLabel` | Free Fire In-Game Name | Free Fire ইন-গেম নাম |
| `auth.ffNamePlaceholder` | Enter exact in-game name | সঠিক ইন-গেম নাম লিখুন |
| `auth.upiIdLabel` | UPI ID for Payouts | উত্তোলনের জন্য UPI ID |
| `auth.upiIdPlaceholder` | example@upi | example@upi |
| `auth.dobLabel` | Date of Birth | জন্ম তারিখ |
| `auth.dobPlaceholder` | YYYY-MM-DD | YYYY-MM-DD |
| `auth.dobHelp` | You must be at least 18 years old to participate. | অংশগ্রহণের জন্য আপনার বয়স কমপক্ষে ১৮ বছর হতে হবে। |
| `auth.confirm18` | I confirm that I am 18 years of age or older and agree to the platform rules. | আমি নিশ্চিত করছি যে আমার বয়স ১৮ বছর বা তার বেশি এবং আমি প্ল্যাটফর্মের সমস্ত নিয়মে সম্মত। |
| `auth.referralCodeLabel` | Referral Code (Optional) | রেফারেল কোড (ঐচ্ছিক) |
| `auth.referralCodePlaceholder` | Enter friend's username | বন্ধুর ইউজারনেম লিখুন |
| `auth.completeRegistration` | Complete Registration | নিবন্ধন সম্পন্ন করুন |
| `auth.completingRegistration` | Setting up your account... | আপনার অ্যাকাউন্ট তৈরি করা হচ্ছে... |
| `auth.alreadyHaveAccount` | Already registered? | ইতিমধ্যে নিবন্ধিত? |
| `auth.dontHaveAccount` | New here? | নতুন সদস্য? |
| `auth.loginLink` | Log In | লগইন করুন |
| `auth.registerLink` | Create an Account | অ্যাকাউন্ট তৈরি করুন |
| `auth.logInAgain` | Log In Again | আবার লগইন করুন |
| `home.welcome` | Welcome | স্বাগতম |
| `home.quickActions` | Quick Actions | দ্রুত অ্যাকশন |
| `home.walletCard` | Wallet Balances | ওয়ালেট ব্যালেন্স |
| `home.totalBalance` | Total Balance | মোট ব্যালেন্স |
| `home.addMoney` | Add Money | টাকা যোগ করুন |
| `home.cashback` | Cashback | ক্যাশব্যাক |
| `home.winnings` | Winnings | উইনিংস |
| `home.depositAction` | Deposit | জমা দিন |
| `home.withdrawAction` | Withdraw | উত্তোলন |
| `home.upcomingTitle` | Featured Matches | বিশেষ ম্যাচসমূহ |
| `home.liveTitle` | Live & In-Progress Matches | লাইভ ও চলমান ম্যাচসমূহ |
| `home.roomReadyTitle` | Room Credentials Ready! | রুমের তথ্য প্রস্তুত! |
| `home.roomReadyDesc` | Your match room is now open. Tap to view Room ID and password. | আপনার ম্যাচ রুম এখন উন্মুক্ত। রুম আইডি এবং পাসওয়ার্ড দেখতে ট্যাপ করুন। |
| `home.noMatches` | No active matches right now. Check back shortly for newly scheduled rooms! | বর্তমানে কোনো সক্রিয় ম্যাচ নেই। নতুন ম্যাচের শিডিউল দেখতে শীঘ্রই পুনরায় চেক করুন! |
| `home.referBannerTitle` | Refer & Earn Cashback | রেফার করুন এবং ক্যাশব্যাক জিতুন |
| `home.referBannerSubtitle` | Invite your squad mates and receive cash rewards on every tournament they enter. | আপনার স্কোয়াড বন্ধুদের আমন্ত্রণ জানান এবং তারা টুর্নামেন্টে যোগ দিলেই নগদ পুরস্কার পান। |
| `matches.filterAll` | All Matches | সকল ম্যাচ |
| `matches.modeBR` | Battle Royale | Battle Royale |
| `matches.modeCS` | Clash Squad | Clash Squad |
| `matches.modeLW` | Lone Wolf | Lone Wolf |
| `matches.filterSolo` | Solo | Solo |
| `matches.filterDuo` | Duo | Duo |
| `matches.filterSquad` | Squad | Squad |
| `matches.entryFee` | Entry Fee | এন্ট্রি ফি |
| `matches.prizePool` | Prize Pool | প্রাইজ পুল |
| `matches.killPrize` | Per Kill | প্রতি কিল |
| `matches.startTime` | Start Time | শুরুর সময় |
| `matches.spotsLeft` | {count} spots left | {count} টি স্লট বাকি |
| `matches.full` | Full | পরিপূর্ণ |
| `matches.joinMatch` | Join Match | ম্যাচে যোগ দিন |
| `matches.joined` | Joined | যুক্ত হয়েছেন |
| `matches.viewDetails` | View Details | বিস্তারিত দেখুন |
| `matches.detailTitle` | Match Overview | ম্যাচের বিবরণ |
| `matches.rules` | Tournament Rules | টুর্নামেন্টের নিয়মাবলী |
| `matches.payoutBreakdown` | Payout Structure | পুরস্কারের বিভাজন |
| `matches.roomInfo` | Room Information | রুমের তথ্য |
| `matches.roomId` | Room ID | রুম আইডি |
| `matches.roomPassword` | Password | পাসওয়ার্ড |
| `matches.roomPending` | Credentials will appear 15 minutes before the match start time. | ম্যাচ শুরুর ১৫ মিনিট আগে রুমের বিবরণ প্রদর্শিত হবে। |
| `matches.myTeam` | My Team | আমার দল |
| `matches.teamLeader` | Team Leader | টিম লিডার |
| `matches.teamMember` | Team Member | টিম মেম্বার |
| `matches.replaceTeammate` | Replace Teammate | সতীর্থ পরিবর্তন করুন |
| `matches.inviteTeammate` | Invite Teammate | সতীর্থকে আমন্ত্রণ জানান |
| `matches.disbandTeam` | Disband Team | দল ভেঙে দিন |
| `matches.onlyLeaderCanChange` | Only team leader can change teammate. | শুধুমাত্র টিম লিডারই সতীর্থ পরিবর্তন করতে পারবেন। |
| `matches.soloJoinConfirm` | Confirm Match Entry | ম্যাচে প্রবেশের নিশ্চিতকরণ |
| `matches.soloJoinNotice` | Entry fee will be deducted from your wallet balance. Please ensure your Free Fire game is updated before room time. | আপনার ওয়ালেট ব্যালেন্স থেকে এন্ট্রি ফি কেটে নেওয়া হবে। রুমের সময়ের আগেই আপনার Free Fire গেমটি আপডেট করা আছে কিনা নিশ্চিত করুন। |
| `matches.teamFormTitle` | Form Your Squad | আপনার স্কোয়াড গঠন করুন |
| `matches.teamName` | Team Name | দলের নাম |
| `matches.teamNamePlaceholder` | e.g. Thunder Strikers | যেমন: থান্ডার স্ট্রাইকার্স |
| `matches.teammateFfId` | Teammate Free Fire UID | সতীর্থের Free Fire UID |
| `matches.teammateFfIdPlaceholder` | Enter numeric Free Fire UID | সংখ্যার Free Fire UID লিখুন |
| `matches.sendInvite` | Send Invite | আমন্ত্রণ পাঠান |
| `matches.pendingInvites` | Pending Invites | অপেক্ষমাণ আমন্ত্রণসমূহ |
| `matches.inviteStatusPending` | Awaiting acceptance | গ্রহণের অপেক্ষায় |
| `matches.inviteStatusAccepted` | Accepted | গৃহীত হয়েছে |
| `matches.cancelInvite` | Cancel Invite | আমন্ত্রণ বাতিল করুন |
| `matches.teamCutoffRule` | Teams cannot be modified within 15 minutes of match start. | ম্যাচ শুরুর ১৫ মিনিটের মধ্যে দলে কোনো পরিবর্তন করা যাবে না। |
| `wallet.title` | My Wallet | আমার ওয়ালেট |
| `wallet.tabDeposit` | Add Money | টাকা যোগ করুন |
| `wallet.tabWithdraw` | Withdraw | টাকা তুলুন |
| `wallet.tabTransactions` | Transactions | লেনদেন |
| `wallet.tabRequests` | Requests | অনুরোধ |
| `wallet.unutilized` | Deposited Balance | জমা ব্যালেন্স |
| `wallet.cashbackBalance` | Cashback Balance | ক্যাশব্যাক ব্যালেন্স |
| `wallet.winningBalance` | Withdrawable Winnings | উত্তোলনযোগ্য উইনিংস |
| `wallet.depositAmount` | Deposit Amount (INR) | জমার পরিমাণ (INR) |
| `wallet.depositAmountPlaceholder` | Enter amount to add | যোগ করার পরিমাণ লিখুন |
| `wallet.quickAdd` | Quick Add | দ্রুত নির্বাচন |
| `wallet.utrLabel` | Bank 12-Digit UTR / Transaction Reference | ব্যাংকের ১২-সংখ্যার UTR / লেনদেন রেফারেন্স |
| `wallet.utrPlaceholder` | e.g. 123456789012 | যেমন: 123456789012 |
| `wallet.utrHelp` | Found in your UPI app payment receipt details. | আপনার UPI অ্যাপের পেমেন্ট রসিদে এটি পাওয়া যাবে। |
| `wallet.screenshotLabel` | Payment Screenshot Proof | পেমেন্ট স্ক্রিনশটের প্রমাণ |
| `wallet.uploadProof` | Upload Payment Receipt (PNG, JPEG) | পেমেন্ট রসিদ আপলোড করুন (PNG, JPEG) |
| `wallet.submitDeposit` | Submit Deposit Request | জমার অনুরোধ পাঠাতে চাপুন |
| `wallet.submittingDeposit` | Submitting receipt... | রসিদ জমা দেওয়া হচ্ছে... |
| `wallet.depositInstructionsTitle` | How to Add Money via UPI | UPI-এর মাধ্যমে টাকা যোগ করার নিয়ম |
| `wallet.depositStep1` | 1. Scan the official UPI QR or copy the UPI ID below. | ১. অফিসিয়াল UPI QR স্ক্যান করুন অথবা নিচের UPI ID কপি করুন। |
| `wallet.depositStep2` | 2. Transfer the exact amount using any UPI app (GPay, PhonePe, Paytm). | ২. যেকোনো UPI অ্যাপ (GPay, PhonePe, Paytm) ব্যবহার করে সঠিক পরিমাণ টাকা পাঠান। |
| `wallet.depositStep3` | 3. Enter the 12-digit UTR reference and upload the payment receipt. | ৩. ১২-সংখ্যার UTR রেফারেন্স নম্বর লিখুন এবং পেমেন্টের স্ক্রিনশট আপলোড করুন। |
| `wallet.withdrawAmount` | Withdrawal Amount (INR) | উত্তোলনের পরিমাণ (INR) |
| `wallet.withdrawAmountPlaceholder` | Enter amount to withdraw | উত্তোলনের পরিমাণ লিখুন |
| `wallet.withdrawUpi` | Destination UPI ID | প্রাপক UPI ID |
| `wallet.withdrawNotice` | Winnings are transferred directly to your registered UPI ID. Requests are processed promptly. | জয়ের টাকা সরাসরি আপনার নিবন্ধিত UPI ID-তে পাঠানো হবে। অনুরোধগুলো দ্রুত প্রক্রিয়া করা হয়। |
| `wallet.withdrawCooldownNotice` | Withdrawals are locked for 24 hours after updating your registered UPI ID. | নিবন্ধিত UPI ID পরিবর্তনের পর নিরাপত্তার স্বার্থে ২৪ ঘণ্টার জন্য উত্তোলন স্থগিত থাকে। |
| `wallet.submitWithdrawal` | Request Withdrawal | উত্তোলনের অনুরোধ করুন |
| `wallet.submittingWithdrawal` | Processing request... | অনুরোধ প্রক্রিয়া করা হচ্ছে... |
| `wallet.noTransactions` | No wallet transactions recorded yet. | এখনও পর্যন্ত কোনো লেনদেনের তথ্য নেই। |
| `wallet.noRequests` | No active deposit or withdrawal requests. | কোনো সক্রিয় জমা বা উত্তোলনের অনুরোধ নেই। |
| `leaderboard.title` | Leaderboards | লিডারবোর্ড |
| `leaderboard.subtitle` | Top Free Fire players ranked by tournament winnings | টুর্নামেন্টের উইনিংসের ভিত্তিতে সেরা Free Fire খেলোয়াড়দের তালিকা |
| `leaderboard.weeklyTab` | Weekly Ranks | সাপ্তাহিক র্যাঙ্ক |
| `leaderboard.monthlyTab` | Monthly Ranks | মাসিক র্যাঙ্ক |
| `leaderboard.overallTab` | Overall Ranks | সর্বকালীন র্যাঙ্ক |
| `leaderboard.monthlyTitle` | Monthly Leaderboard | মাসিক লিডারবোর্ড |
| `leaderboard.overallTitle` | Overall Leaderboard | সর্বকালীন লিডারবোর্ড |
| `leaderboard.notRanked` | not ranked | র‍্যাঙ্ক নেই |
| `leaderboard.prizeCol` | Prize | পুরস্কার |
| `leaderboard.yourRank` | Your Standing | আপনার অবস্থান |
| `leaderboard.unranked` | Play a match this week to earn your leaderboard rank! | লিডারবোর্ডে আপনার অবস্থান দেখতে এই সপ্তাহে একটি ম্যাচে অংশ নিন! |
| `leaderboard.rankCol` | Rank | র্যাঙ্ক |
| `leaderboard.playerCol` | Player | খেলোয়াড় |
| `leaderboard.winningsCol` | Winnings | উইনিংস |
| `leaderboard.noData` | Leaderboard calculations in progress. Rankings refresh hourly. | লিডারবোর্ড গণনা চলছে। র্যাঙ্কিং প্রতি ঘণ্টায় রিফ্রেশ হয়। |
| `profile.title` | My Profile | আমার প্রোফাইল |
| `profile.personalDetails` | Personal Details | ব্যক্তিগত বিবরণ |
| `profile.gamingDetails` | Free Fire Profile | Free Fire প্রোফাইল |
| `profile.payoutDetails` | Payout Details | পেমেন্ট বিবরণ |
| `profile.avatarTitle` | Profile Picture | প্রোফাইল ছবি |
| `profile.uploadPhoto` | Upload profile photo | প্রোফাইল ছবি আপলোড করুন |
| `profile.removePhoto` | Remove Photo | ছবি সরিয়ে ফেলুন |
| `profile.photoRequirements` | JPEG, PNG, or WebP up to 2 MB. | সর্বোচ্চ ২ MB সাইজের JPEG, PNG বা WebP ছবি। |
| `profile.fullName` | Full Name | পুরো নাম |
| `profile.email` | Email Address | ইমেইল ঠিকানা |
| `profile.emailUnchangeable` | Email cannot be changed after registration. | নিবন্ধনের পর ইমেইল পরিবর্তন করা যাবে না। |
| `profile.mobile` | Mobile Number | মোবাইল নম্বর |
| `profile.ffId` | Free Fire UID | Free Fire UID |
| `profile.ffName` | In-Game Name | ইন-গেম নাম |
| `profile.upiId` | UPI ID | UPI ID |
| `profile.dateOfBirth` | Date of Birth | জন্মতারিখ |
| `profile.referralCode` | My Referral Code | আমার রেফারেল কোড |
| `profile.languagePreferenceTitle` | Language Preference | ভাষার পছন্দ |
| `profile.languagePreferenceSubtitle` | Choose your preferred language for the application | অ্যাপ্লিকেশনে আপনার পছন্দের ভাষা নির্বাচন করুন |
| `profile.cooldownWarning` | Profile fields (Mobile, Free Fire UID, In-Game Name, UPI ID) can only be updated once every 30 days. | প্রোফাইলের তথ্য (মোবাইল, Free Fire UID, ইন-গেম নাম, UPI ID) প্রতি ৩০ দিনে কেবল একবার পরিবর্তন করা যাবে। |
| `profile.upiLockWarning` | Changing your UPI ID locks withdrawals for 24 hours for security. | নিরাপত্তার স্বার্থে UPI ID পরিবর্তন করলে পরবর্তী ২৪ ঘণ্টার জন্য উত্তোলন বন্ধ থাকবে। |
| `profile.logoutButton` | Log Out | লগআউট |
| `profile.logoutConfirmTitle` | Log out from Booyah Win? | Booyah Win থেকে লগআউট করতে চান? |
| `profile.logoutConfirmText` | You will need to verify an OTP to log back into your account on this device. | এই ডিভাইসে পুনরায় লগইন করার জন্য আপনাকে আবার OTP যাচাই করতে হবে। |
| `referral.title` | Refer & Earn | রেফার ও আয় করুন |
| `referral.subtitle` | Earn lifetime cash rewards for every tournament your friends play | আপনার বন্ধুরা টুর্নামেন্টে খেললেই পান আজীবন নগদ পুরস্কার |
| `referral.yourCode` | Your Exclusive Referral Code | আপনার অনন্য রেফারেল কোড |
| `referral.copyCode` | Copy Code | কোড কপি করুন |
| `referral.shareOnWhatsApp` | Share on WhatsApp | WhatsApp-এ শেয়ার করুন |
| `referral.shareOnTelegram` | Share on Telegram | Telegram-এ শেয়ার করুন |
| `referral.totalReferred` | Total Friends Invited | মোট আমন্ত্রিত বন্ধু |
| `referral.cashbackEarned` | Referral Earnings | রেফারেল উপার্জন |
| `referral.howItWorks` | How the Referral Program Works | রেফারেল প্রোগ্রাম যেভাবে কাজ করে |
| `referral.step1` | Share your unique referral link or 8-character code with your gaming friends. | আপনার বন্ধুদের সাথে আপনার অনন্য রেফারেল লিঙ্ক বা ৮-সংখ্যার কোড শেয়ার করুন। |
| `referral.step2` | Friends enter your code during account registration. | বন্ধুরা অ্যাকাউন্ট নিবন্ধনের সময় আপনার কোডটি প্রবেশ করাবে। |
| `referral.step3` | You earn cashback directly to your wallet every time they join cash tournaments. | তারা যখনই নগদ টুর্নামেন্টে যোগ দেবে, আপনি সরাসরি আপনার ওয়ালেটে ক্যাশব্যাক পাবেন। |
| `support.title` | Player Support | খেলোয়াড় সহায়তা |
| `support.subtitle` | We are here to help with room issues, payments, and account queries | রুমের সমস্যা, লেনদেন বা অ্যাকাউন্ট সংক্রান্ত যেকোনো সহায়তায় আমরা প্রস্তুত |
| `support.hoursTitle` | Support Hours | সহায়তার সময়সীমা |
| `support.hoursValue` | 10:00 AM - 10:00 PM IST | সকাল ১০:০০ - রাত ১০:০০ IST |
| `support.emailUs` | Email Support | ইমেইল সহায়তা |
| `support.whatsappUs` | WhatsApp Support | WhatsApp সহায়তা |
| `support.telegramUs` | Telegram Community | Telegram কমিউনিটি |
| `support.averageResponse` | Average response time: Under 15 minutes during operating hours. | গড় প্রতিক্রিয়ার সময়: সহায়তা চলাকালীন ১৫ মিনিটের মধ্যে। |
| `banners.maintenanceTitle` | Scheduled Platform Maintenance | প্ল্যাটফর্মের নির্ধারিত রক্ষণাবেক্ষণ |
| `banners.maintenanceDesc` | We are performing system upgrades to ensure fair play and reliability. Match gameplay and deposits will resume shortly. | ফেয়ার প্লে এবং সিস্টেমের নির্ভরযোগ্যতা নিশ্চিত করতে রক্ষণাবেক্ষণ চলছে। ম্যাচ খেলা এবং টাকা জমা শীঘ্রই পুনরায় শুরু হবে। |
| `banners.slowServer` | The server is taking longer than usual to respond. Please hang tight... | সার্ভার প্রতিক্রিয়া জানাতে স্বাভাবিকের চেয়ে বেশি সময় নিচ্ছে। অনুগ্রহ করে কিছুক্ষণ অপেক্ষা করুন... |
| `banners.sessionReplacedTitle` | Session Logged Out | সেশন বন্ধ করা হয়েছে |
| `banners.sessionReplacedMessage` | Your account was logged in from another device. For security, only one device may be active at a time. | আপনার অ্যাকাউন্টটি অন্য একটি ডিভাইস থেকে লগইন করা হয়েছে। নিরাপত্তার কারণে একসাথে একটি ডিভাইসই সক্রিয় থাকতে পারে। |
| `install.bannerTitle` | Install Booyah Win App | Booyah Win অ্যাপ ইনস্টল করুন |
| `install.bannerSubtitle` | Add to your home screen for faster room alerts and smooth gameplay. | দ্রুত রুম নোটিফিকেশন এবং মসৃণ গেমপ্লের জন্য আপনার হোম স্ক্রিনে যুক্ত করুন। |
| `install.installButton` | Install App | অ্যাপ ইনস্টল করুন |
| `install.howToInstall` | How to Install | কীভাবে ইনস্টল করবেন |
| `install.chromeStep1` | 1. Tap the browser menu (three dots in top right). | ১. ব্রাউজার মেনুতে ট্যাপ করুন (উপরে ডানদিকের তিনটি বিন্দু)। |
| `install.chromeStep2` | 2. Select 'Install app' or 'Add to Home screen'. | ২. 'Install app' বা 'Add to Home screen' নির্বাচন করুন। |
| `install.chromeStep3` | 3. Open Booyah Win directly from your home screen. | ৩. সরাসরি আপনার হোম স্ক্রিন থেকে Booyah Win ওপেন করুন। |
| `terms.modalTitle` | Terms of Service | ব্যবহারের শর্তাবলী |
| `terms.modalPlaceholder` | By using Booyah Win, you agree that you are at least 18 years of age and reside in an Indian state where skill-based gaming is legally permitted. Cheating, team-teaming, or exploiting game glitches will result in immediate disqualification and permanent ban without refund. Winnings are disbursed via UPI subject to proof verification. | Booyah Win ব্যবহার করে আপনি সম্মত হচ্ছেন যে আপনার বয়স কমপক্ষে ১৮ বছর এবং আপনি এমন একটি ভারতীয় রাজ্যে বাস করেন যেখানে দক্ষতাভিত্তিক গেমিং আইনত অনুমোদিত। চিটিং, টিমিং বা গেমের ত্রুটির অন্যায্য সুযোগ নিলে কোনো রিফান্ড ছাড়াই তাৎক্ষণিক বহিষ্কার ও স্থায়ীভাবে নিষিদ্ধ করা হবে। প্রমাণ যাচাই সাপেক্ষে UPI-এর মাধ্যমে পুরস্কার প্রদান করা হয়। |
| `privacy.modalTitle` | Privacy Policy | গোপনীয়তা নীতি |
| `privacy.modalPlaceholder` | Booyah Win collects your email, mobile number, Free Fire ID, and UPI details solely for account authentication, tournament matchmaking, and payout disbursement. We never sell or share your personal data with third-party advertisers. All sensitive information is encrypted in transit and at rest. | Booyah Win শুধুমাত্র অ্যাকাউন্ট প্রমাণীকরণ, টুর্নামেন্ট ম্যাচমেকিং এবং উইনিংস বিতরণের জন্য আপনার ইমেইল, মোবাইল নম্বর, Free Fire ID এবং UPI তথ্য সংগ্রহ করে। আমরা কখনোই আপনার ব্যক্তিগত তথ্য তৃতীয় পক্ষের বিজ্ঞাপনদাতাদের কাছে বিক্রি বা শেয়ার করি না। সমস্ত সংবেদনশীল ডেটা ট্রানজিট এবং স্টোরেজে এনক্রিপ্ট করা থাকে। |
| `enums.status.upcoming` | Upcoming | আসন্ন |
| `enums.status.room_open` | Room Open | রুম উন্মুক্ত |
| `enums.status.live` | Live Now | লাইভ চলছে |
| `enums.status.completed` | Completed | সম্পন্ন |
| `enums.status.cancelled` | Cancelled | বাতিল |
| `enums.gameMode.battle_royale` | Battle Royale | Battle Royale |
| `enums.gameMode.clash_squad` | Clash Squad | Clash Squad |
| `enums.gameMode.lone_wolf` | Lone Wolf | Lone Wolf |
| `enums.teamMode.solo` | Solo | Solo |
| `enums.teamMode.duo` | Duo | Duo |
| `enums.teamMode.squad` | Squad | Squad |
| `enums.walletStatus.pending` | Pending Review | পর্যালোচনাধীন |
| `enums.walletStatus.approved` | Approved | অনুমোদিত |
| `enums.walletStatus.rejected` | Rejected | প্রত্যাখ্যাত |
| `enums.txnType.deposit` | Deposit | জমা |
| `enums.txnType.withdrawal` | Withdrawal | উত্তোলন |
| `enums.txnType.entry_fee` | Match Entry Fee | ম্যাচ এন্ট্রি ফি |
| `enums.txnType.prize` | Match Winnings | ম্যাচ উইনিংস |
| `enums.txnType.refund` | Match Refund | ম্যাচ রিফান্ড |
| `enums.txnType.cashback` | Cashback Reward | ক্যাশব্যাক পুরস্কার |
| `enums.txnType.bonus` | Promotional Bonus | প্রমোশনাল বোনাস |
| `enums.position.booyah` | Booyah (1st Place) | Booyah (১ম স্থান) |
| `enums.position.second` | 2nd Place | ২য় স্থান |
| `enums.position.third` | 3rd Place | ৩য় স্থান |
| `enums.position.fourth` | 4th Place | ৪র্থ স্থান |
| `enums.position.fifth` | 5th Place | ৫ম স্থান |
| `enums.position.lost` | Eliminated | এলিমিনেটেড |
| `enums.position.pending` | Result Pending | ফলাফল অপেক্ষমাণ |
| `enums.position.cancelled` | Cancelled & Refunded | বাতিল ও রিফান্ডকৃত |
| `errors.UNAUTHENTICATED` | Your session has expired. Please log in again. | আপনার সেশনের মেয়াদ শেষ হয়েছে। অনুগ্রহ করে পুনরায় লগইন করুন। |
| `errors.SESSION_REPLACED` | You were logged out because your account was used on another device. | আপনার অ্যাকাউন্টটি অন্য ডিভাইসে ব্যবহার করায় আপনি লগআউট হয়ে গেছেন। |
| `errors.FORBIDDEN` | Only team leader can change teammates. | শুধুমাত্র টিম লিডারই সতীর্থ পরিবর্তন করতে পারবেন। |
| `errors.ADMIN_APPROVAL_REQUIRED` | This transaction requires administrator review. | এই লেনদেনটির জন্য অ্যাডমিনের পর্যালোচনার প্রয়োজন। |
| `errors.VALIDATION_ERROR` | Please check your inputs and try again. | অনুগ্রহ করে আপনার তথ্য পরীক্ষা করুন এবং পুনরায় চেষ্টা করুন। |
| `errors.INVALID_OTP` | Invalid or expired OTP code. Please check the code or request a new one. | ভুল বা মেয়াদোত্তীর্ণ OTP কোড। অনুগ্রহ করে কোডটি যাচাই করুন বা নতুন OTP চান। |
| `errors.OTP_RATE_LIMITED` | Too many OTP requests. Please wait a few moments before requesting another. | খুব বেশি OTP চাওয়া হয়েছে। কিছুক্ষণ অপেক্ষা করে পুনরায় চেষ্টা করুন। |
| `errors.USERNAME_EXISTS` | This username is already taken. Please choose another. | এই ইউজারনেমটি ইতিমধ্যে নেওয়া হয়েছে। অন্য একটি বেছে নিন। |
| `errors.EMAIL_EXISTS` | This email is already registered. Please log in instead. | এই ইমেইলটি ইতিমধ্যেই নিবন্ধিত। অনুগ্রহ করে লগইন করুন। |
| `errors.MOBILE_EXISTS` | This mobile number is already linked to another account. | এই মোবাইল নম্বরটি অন্য অ্যাকাউন্টের সাথে যুক্ত। |
| `errors.FF_ID_EXISTS` | This Free Fire ID is already registered to another player. | এই Free Fire ID-টি অন্য খেলোয়াড়ের নামে নিবন্ধিত। |
| `errors.UPI_EXISTS` | This UPI ID is already registered to another account. | এই UPI ID-টি অন্য অ্যাকাউন্টে ব্যবহৃত হচ্ছে। |
| `errors.INVALID_REFERRAL` | Invalid referral code. Please check the code or leave it blank. | ভুল রেফারেল কোড। কোডটি পরীক্ষা করুন বা ফাঁকা রাখুন। |
| `errors.FIELD_COOLDOWN` | This field was changed recently and cannot be updated yet. | এই তথ্যটি সম্প্রতি পরিবর্তন করা হয়েছে এবং এখনই পরিবর্তনযোগ্য নয়। |
| `errors.IN_ACTIVE_MATCH` | You cannot modify profile details while enrolled in an upcoming or live match. | আসন্ন বা লাইভ ম্যাচে যুক্ত থাকা অবস্থায় প্রোফাইলের তথ্য পরিবর্তন করা যাবে না। |
| `errors.LOW_BALANCE` | Insufficient wallet balance. Please add money to continue. | অপর্যাপ্ত ওয়ালেট ব্যালেন্স। চালিয়ে যেতে টাকা যোগ করুন। |
| `errors.UTR_EXISTS` | This transaction UTR has already been submitted. | এই লেনদেনের UTR ইতিপূর্বে জমা দেওয়া হয়েছে। |
| `errors.DEPOSIT_LIMIT` | Deposit amount is outside the allowed limits. | জমার পরিমাণ নির্ধারিত সীমার বাইরে। |
| `errors.WITHDRAWAL_PENDING` | You already have a pending withdrawal request in progress. | আপনার ইতিমধ্যে একটি উত্তোলনের অনুরোধ প্রক্রিয়াধীন রয়েছে। |
| `errors.UPI_RECENTLY_CHANGED` | Withdrawals are locked for 24 hours following a UPI ID change. | UPI ID পরিবর্তনের পর ২৪ ঘণ্টার জন্য উত্তোলন বন্ধ থাকে। |
| `errors.MATCH_FULL` | This match is full. Please browse other available matches. | এই ম্যাচটি পরিপূর্ণ। অনুগ্রহ করে অন্যান্য উপলব্ধ ম্যাচ ব্রাউজ করুন। |
| `errors.ALREADY_JOINED` | You have already joined this match. | আপনি ইতিমধ্যে এই ম্যাচে যোগ দিয়েছেন। |
| `errors.MATCH_NOT_JOINABLE` | This match is no longer accepting new players. | এই ম্যাচটিতে আর নতুন খেলোয়াড় নেওয়া হচ্ছে না। |
| `errors.TEAM_INVALID` | Invalid team configuration or player roster. | দলের বিন্যাস বা খেলোয়াড়দের তালিকায় ত্রুটি রয়েছে। |
| `errors.INVITE_EXPIRED` | This team invitation has expired. | দলের এই আমন্ত্রণের মেয়াদ শেষ হয়ে গেছে। |
| `errors.RESULT_INVALID` | The submitted match results are invalid. | জমা দেওয়া ম্যাচের ফলাফল গ্রহণযোগ্য নয়। |
| `errors.RESULT_LOCKED` | Match results have been approved and locked. | ম্যাচের ফলাফল অনুমোদিত এবং লক করা হয়েছে। |
| `errors.NOT_FOUND` | The requested resource was not found. | অনুরোধকৃত তথ্য খুঁজে পাওয়া যায়নি। |
| `errors.RATE_LIMITED` | Too many requests. Please slow down and try again shortly. | অতিরিক্ত অনুরোধ করা হয়েছে। অনুগ্রহ করে কিছুক্ষণ পর আবার চেষ্টা করুন। |
| `errors.INTERNAL_ERROR` | An unexpected system error occurred. Please try again. | একটি অপ্রত্যাশিত সিস্টেম ত্রুটি ঘটেছে। অনুগ্রহ করে আবার চেষ্টা করুন। |
| `errors.INVALID_TRANSITION` | This match action cannot be performed in its current status. | ম্যাচটির বর্তমান অবস্থায় এই কাজটি সম্পাদন করা সম্ভব নয়। |
| `errors.DATABASE_BUSY` | The server is temporarily busy. Please retry in a few seconds. | সার্ভার সাময়িকভাবে ব্যস্ত। কয়েক সেকেন্ড পর আবার চেষ্টা করুন। |
| `errors.ADMINS_APPROVE_DIRECTLY` | Admins approve directly | অ্যাডমিন সরাসরি অনুমোদন করেন |
| `errors.MAINTENANCE_MODE` | The platform is currently undergoing scheduled maintenance. Please try again shortly. | প্ল্যাটফর্মটিতে নির্ধারিত রক্ষণাবেক্ষণ চলছে। অনুগ্রহ করে কিছুক্ষণ পর আবার চেষ্টা করুন। |
| `errors.REAUTH_REQUIRED` | Security verification required. Please verify OTP to proceed. | নিরাপত্তা যাচাইকরণ প্রয়োজন। চালিয়ে যেতে OTP যাচাই করুন। |
| `common.support` | Support | সহায়তা |
| `common.addMoney` | Add Money | টাকা যোগ করুন |
| `common.withdraw` | Withdraw | উত্তোলন |
| `common.active` | ACTIVE | সক্রিয় |
| `home.totalUsableBalance` | Total Usable Balance | মোট ব্যবহারযোগ্য ব্যালেন্স |
| `home.secure100` | 100% Secure | 100% নিরাপদ |
| `home.leaderboard` | Leaderboard | লিডারবোর্ড |
| `home.weeklyTop50` | Weekly Top 50 | সাপ্তাহিক সেরা 50 |
| `home.referAndEarn` | Refer & Earn | রেফার ও ইনকাম |
| `home.cashbackBonus` | Cashback bonus | ক্যাশব্যাক বোনাস |
| `home.customMatchLobby` | Custom Match Lobby | কাস্টম ম্যাচ লবি |
| `home.liveRoomsTitle` | Live Custom Match Rooms | লাইভ কাস্টম ম্যাচ রুম |
| `home.liveRoomsDesc` | Battle Royale & Clash Squad custom rooms are live! Join tournaments, compete with your squad, and win real cash prizes. | Battle Royale এবং Clash Squad কাস্টম রুম লাইভ রয়েছে! টুর্নামেন্টে যোগ দিন, আপনার স্কোয়াডের সাথে খেলুন এবং নগদ পুরস্কার জিতুন। |
| `home.enterMatchLobby` | Enter Match Lobby | ম্যাচ লবিতে প্রবেশ করুন |
| `home.antiCheatNotice` | Strict anti-cheat monitoring active across all rooms. | সকল রুমে কঠোর অ্যান্টি-চিট নজরদারি সক্রিয় রয়েছে। |
| `home.prizeLabel` | Prize: {amount} | পুরস্কার: {amount} |
| `home.idLabel` | ID: {id} | ID: {id} |
| `home.player` | Player | খেলোয়াড় |
| `support.helpAndSupport` | Help & Support | সহায়তা ও সাপোর্ট |
| `support.loading` | Loading support information... | সহায়তার তথ্য লোড হচ্ছে... |
| `support.loadError` | Failed to load support information. | সহায়তার তথ্য লোড করতে ব্যর্থ হয়েছে। |
| `support.team` | Support Team | সাপোর্ট টিম |
| `support.phoneSupport` | Phone Support | ফোন সহায়তা |
| `support.emailSupport` | Email Support | ইমেইল সহায়তা |
| `support.operatingHours` | Operating Hours | কার্যক্রমের সময়সীমা |
| `support.notConfiguredTitle` | Support Not Yet Configured | সহায়তা চ্যানেল এখনও কনফিগার করা হয়নি |
| `support.notConfiguredDesc` | Our customer support channels are currently being updated. Please check back soon or reach out through the platform announcements. | আমাদের কাস্টমার সাপোর্ট চ্যানেলগুলো বর্তমানে আপডেট করা হচ্ছে। অনুগ্রহ করে কিছুক্ষণ পর আবার দেখুন। |
| `leaderboard.weeklyTitle` | Weekly Leaderboard | সাপ্তাহিক লিডারবোর্ড |
| `leaderboard.guestTitle` | Join The Battle | যুদ্ধে যোগ দিন |
| `leaderboard.guestSubtitle` | Login or register to claim your rank and prizes | আপনার র‌্যাংক ও পুরস্কার দাবি করতে লগইন বা নিবন্ধন করুন |
| `leaderboard.loadingWeek` | Loading week... | সপ্তাহ লোড হচ্ছে... |
| `leaderboard.refresh` | Refresh leaderboard | লিডারবোর্ড রিফ্রেশ করুন |
| `leaderboard.resetNotice` | Resets every Monday at 12:00 AM IST · Only match winnings count · Ties broken by earlier win | প্রতি সোমবার রাত 12:00 AM IST-এ রিসেট হয় · শুধুমাত্র টুর্নামেন্টের জয় গণনা করা হয় · সমান উইনিংসে আগে জয়ী অগ্রাধিকার পায় |
| `leaderboard.loadError` | Failed to load leaderboard. Please try again. | লিডারবোর্ড লোড করা যায়নি। অনুগ্রহ করে আবার চেষ্টা করুন। |
| `leaderboard.rank1Champion` | Rank 1 · Champion | র‌্যাংক 1 · চ্যাম্পিয়ন |
| `leaderboard.rank2` | Rank 2 | র‌্যাংক 2 |
| `leaderboard.rank3` | Rank 3 | র‌্যাংক 3 |
| `leaderboard.awaiting2nd` | Awaiting 2nd Place | ২য় স্থানের অপেক্ষায় |
| `leaderboard.awaiting3rd` | Awaiting 3rd Place | ৩য় স্থানের অপেক্ষায় |
| `leaderboard.noWinnersTitle` | No Winners Yet This Week | এই সপ্তাহে এখনও কোনো বিজয়ী নেই |
| `leaderboard.noWinnersDesc` | Be the first to join a match, claim victory, and take the #1 spot! | ম্যাচে যোগ দিন, জয় ছিনিয়ে নিন এবং সবার প্রথমে ১ম স্থান অধিকার করুন! |
| `leaderboard.topContenders` | Top Contenders (4 – 50) | শীর্ষ প্রতিযোগী (4 – 50) |
| `leaderboard.yourRankTitle` | Your Rank | আপনার র‌্যাংক |
| `leaderboard.rankN` | Rank #{rank} | র‌্যাংক #{rank} |
| `leaderboard.unrankedDesc` | Unranked — win a match to enter | র‌্যাংকহীন — লিডারবোর্ডে প্রবেশ করতে একটি ম্যাচ জিতুন |
| `leaderboard.yourWinnings` | Your Winnings | আপনার মোট জয় |
| `matches.tabMatches` | Matches | ম্যাচ |
| `matches.tabHistory` | History | ইতিহাস |
| `matches.filterAllGames` | All Games | সকল গেম |
| `matches.filterAllTeams` | all | সব |
| `matches.loadingMatches` | Loading match rooms... | ম্যাচ রুম লোড হচ্ছে... |
| `matches.loadFailed` | Failed to load matches | ম্যাচ লোড করা যায়নি |
| `matches.loadFailedRefresh` | Failed to load matches. Please tap refresh. | ম্যাচ লোড করতে সমস্যা হয়েছে। রিফ্রেশ বাটনে ট্যাপ করুন। |
| `matches.tryAgain` | Try Again | আবার চেষ্টা করুন |
| `matches.noMatchesAvailable` | No Matches Available | কোনো ম্যাচ উপলব্ধ নেই |
| `matches.adjustFilters` | Check back later or adjust your filters above. | পরে আবার দেখুন অথবা উপরের ফিল্টার পরিবর্তন করুন। |
| `matches.firstPlacePrize` | 1st Place Prize | ১ম স্থান পুরস্কার |
| `matches.killPrice` | Kill Price | প্রতি কিল মূল্য |
| `matches.prizeLabel` | Prize: {amount} | পুরস্কার: {amount} |
| `matches.perKill` | per kill | প্রতি কিল |
| `matches.soloSeatStatus` | {joined} / {max} players joined | {joined} / {max} জন খেলোয়াড় যোগ দিয়েছেন |
| `matches.teamSeatStatus` | {reserved} seats reserved vs {joined} players joined | {reserved}টি আসন সংরক্ষিত বনাম {joined} জন যোগ দিয়েছেন |
| `matches.minKillsReward` | Minimum {count} kills to earn kill rewards | কিল পুরস্কার পেতে ন্যূনতম {count}টি কিল করতে হবে |
| `matches.matchDetails` | Match Details | ম্যাচের বিবরণ |
| `matches.startTimeIST` | Start Time (IST) | শুরুর সময় (IST) |
| `matches.seatsStatus` | Seats Status | আসনের অবস্থা |
| `matches.statusLabel` | Status | অবস্থা |
| `matches.positionPrizes` | Position Prizes | র‌্যাংক পুরস্কার |
| `matches.rankN` | Rank {rank} | র‌্যাংক {rank} |
| `matches.roomCredentials` | Room Access Credentials | রুম অ্যাক্সেস তথ্য |
| `matches.pending` | Pending | অপেক্ষমাণ |
| `matches.hidePassword` | Hide Password | পাসওয়ার্ড লুকান |
| `matches.revealPassword` | Reveal Password | পাসওয়ার্ড দেখুন |
| `matches.teamChangesRuleNote` | Team changes close 10 minutes before the start and also if one time changed | ম্যাচ শুরুর ১০ মিনিট পূর্বে এবং একবার পরিবর্তন করা হলে টিম পরিবর্তন বন্ধ হয়ে যাবে |
| `matches.teamChangesClosedReplaced` | Team changes closed (Already changed) | টিম পরিবর্তন বন্ধ (ইতিমধ্যে পরিবর্তন করা হয়েছে) |
| `matches.teamChangesClosedCutoff` | Team changes closed (10m before start) | টিম পরিবর্তন বন্ধ (ম্যাচ শুরুর ১০ মিনিট আগে) |
| `matches.softLowBalanceHint` | Your total wallet balance ({balance}) is below the entry fee. You can still proceed; if balance is insufficient, you can add money. | আপনার ওয়ালেট ব্যালেন্স ({balance}) এন্ট্রি ফির চেয়ে কম। আপনি এখনও এগিয়ে যেতে পারেন; অপর্যাপ্ত হলে টাকা যোগ করতে পারবেন। |
| `matches.closed` | Closed | বন্ধ |
| `matches.completed` | Completed | সম্পন্ন |
| `matches.cancelled` | Cancelled | বাতিল |
| `matches.alreadyJoinedBtn` | ✓ Already Joined | ✓ ইতিমধ্যে যোগ দিয়েছেন |
| `matches.matchFullBtn` | Match Full | ম্যাচ পূর্ণ |
| `matches.registrationClosedBtn` | Registration Closed | নিবন্ধন বন্ধ |
| `matches.formTeamBtn` | Form {mode} Team | {mode} টিম গঠন করুন |
| `matches.ruleCashbackPercent` | Up to {percent}% can come from cashback; the rest from Deposited, then Winning | সর্বোচ্চ {percent}% ক্যাশব্যাক থেকে কাটা হবে; বাকি টাকা জমা ও জয়ের ব্যালেন্স থেকে |
| `matches.ruleCashbackFallback` | A portion of the fee can come from cashback; the rest from Deposited, then Winning | ফি-এর একটি অংশ ক্যাশব্যাক থেকে কাটা যাবে; বাকি টাকা জমা ও জয়ের ব্যালেন্স থেকে |
| `matches.insufficientWalletBalance` | Insufficient wallet balance to join this match. | এই ম্যাচে যোগ দিতে ওয়ালেটে পর্যাপ্ত ব্যালেন্স নেই। |
| `matches.matchAlreadyFull` | This match is already full. | এই ম্যাচটি ইতিমধ্যেই পূর্ণ হয়ে গেছে। |
| `matches.alreadyJoinedMatch` | You have already joined this match. | আপনি ইতিমধ্যেই এই ম্যাচে যোগ দিয়েছেন। |
| `matches.registrationClosed` | Registration for this match is closed. | এই ম্যাচের জন্য নিবন্ধন বন্ধ হয়ে গেছে। |
| `matches.invalidTeamConfig` | Invalid team configuration. | অকার্যকর টিম কনফিগারেশন। |
| `matches.unableToJoin` | Unable to join match. | ম্যাচে যোগ দেওয়া যায়নি। |
| `matches.networkFailedCheckMatches` | Network request failed. Please check "My Matches" before trying again. | নেটওয়ার্ক সমস্যা হয়েছে। আবার চেষ্টা করার আগে অনুগ্রহ করে "আমার ম্যাচ" দেখুন। |
| `matches.confirmAndPay` | Confirm & Pay {fee} | নিশ্চিত করুন এবং {fee} প্রদান করুন |
| `matches.joiningMatch` | Joining Match... | ম্যাচে যোগ হচ্ছে... |
| `matches.addMoneyToWallet` | Add Money to Wallet | ওয়ালেটে টাকা যোগ করুন |
| `matches.successJoined` | Successfully joined match! | সফলভাবে ম্যাচে যোগ দিয়েছেন! |
| `matches.matchHistory` | Match History | ম্যাচের ইতিহাস |
| `matches.noHistoryYet` | No match history available yet | এখনও কোনো ম্যাচের ইতিহাস নেই |
| `matches.resultStatus` | Result | ফলাফল |
| `matches.myWinnings` | Winnings | মোট জয় |
| `matches.tabRules` | RULES | নিয়মাবলী |
| `matches.tabPlayers` | PLAYERS | খেলোয়াড়বৃন্দ |
| `matches.tabPrizePool` | PRIZE POOL | পুরস্কার পুল |
| `matches.tabReward` | REWARD | পুরস্কার |
| `matches.colPosition` | Position | অবস্থান |
| `matches.colTeamNum` | Team | দল |
| `matches.colTeamName` | Team Name | দলের নাম |
| `matches.colPlayersKills` | Players & Kills | খেলোয়াড় ও কিল |
| `matches.colReward` | Reward | পুরস্কার |
| `matches.colPlayer` | Player | খেলোয়াড় |
| `matches.colKills` | Kills | কিল |
| `matches.killsLabel` | kills | কিল |
| `matches.matchCancelled` | Match Cancelled | ম্যাচ বাতিল করা হয়েছে |
| `matches.cancelReasonLabel` | Reason | কারণ |
| `matches.defaultCancelReason` | This match was cancelled and all entry fees were refunded to participants' wallets. | এই ম্যাচটি বাতিল করা হয়েছে এবং সমস্ত অংশগ্রহণকারীদের ওয়ালেটে এন্ট্রি ফি ফেরত দেওয়া হয়েছে। |
| `matches.rewardsPending` | Match rewards will be displayed once results are approved. | ফলাফল অনুমোদিত হওয়ার পরে ম্যাচের পুরস্কার প্রদর্শিত হবে। |
| `matches.matchWasCancelledRefunded` | This match was cancelled. All fees were refunded. | এই ম্যাচটি বাতিল করা হয়েছে। সমস্ত ফি ফেরত দেওয়া হয়েছে। |
| `matches.totalPrize` | TOTAL PRIZE | মোট পুরস্কার |
| `matches.joiningStatus` | Joining status | যোগদানের অবস্থা |
| `matches.rulesAndPolicies` | Rules and Policies | নিয়ম ও নীতিসমূহ |
| `matches.selectLanguage` | SELECT LANGUAGE / ভাষা নির্বাচন করুন | SELECT LANGUAGE / ভাষা নির্বাচন করুন |
| `matches.languageEnglish` | ENGLISH | ENGLISH |
| `matches.languageBangla` | বাংলা | বাংলা |
| `matches.readRulesBeforeJoining` | READ RULES BEFORE JOINING | যোগদানের আগে নিয়ম পড়ুন |
| `matches.ruleMinLevel` | MINIMUM LEVEL 40+ | ন্যূনতম লেভেল ৪০+ |
| `matches.ruleHackNotAllowed` | HACK NOT ALLOWED | হ্যাক সম্পূর্ণ নিষিদ্ধ |
| `matches.ruleInvitingUnregistered` | INVITING UNREGISTER NOT ALLOWED | অনিবন্ধিতদের আমন্ত্রণ নিষিদ্ধ |
| `matches.ruleIdpTime` | I'DP TIME:- 5-8 MIN BEFORE MATCH START TIME | আইডি-পাসওয়ার্ড সময়: ম্যাচ শুরুর ৫-৮ মিনিট আগে |
| `matches.joinedPlayersCount` | {count} players | {count} জন খেলোয়াড় |
| `matches.noPlayersJoinedYet` | No players have joined yet. | এখনো কোনো খেলোয়াড় যোগ দেননি। |
| `matches.prizeDistributionDetails` | Prize Distribution Details: | পুরস্কার বিতরণের বিবরণ: |
| `matches.firstPlaceDetails` | 1st Place: INR {amount} + Kill Points | ১ম স্থান: INR {amount} + কিল পয়েন্ট |
| `matches.nthPlaceDetails` | {place} Place: INR {amount} + Kill Points | {place} স্থান: INR {amount} + কিল পয়েন্ট |
| `matches.joinNow` | JOIN NOW | এখনই যোগ দিন |
| `wallet.totalBalanceTitle` | Total Wallet Balance | মোট ওয়ালেট ব্যালেন্স |
| `wallet.protected100` | 100% Protected | 100% সুরক্ষিত |
| `wallet.unutilizedBalance` | Deposited Balance | জমা করা ব্যালেন্স |
| `wallet.cashbackTitle` | Cashback Balance | ক্যাশব্যাক ব্যালেন্স |
| `wallet.winningsTitle` | Withdrawable Winnings | উত্তোলনযোগ্য জয়ের ব্যালেন্স |
| `wallet.ruleNoticePercent` | Up to {percent}% cashback applies automatically when joining matches. | ম্যাচে যোগদানের সময় সর্বোচ্চ {percent}% ক্যাশব্যাক স্বয়ংক্রিয়ভাবে ব্যবহৃত হয়। |
| `wallet.ruleNoticeFallback` | Cashback applies automatically when joining matches per platform rules. | নিয়ম অনুযায়ী ম্যাচে যোগদানের সময় ক্যাশব্যাক স্বয়ংক্রিয়ভাবে ব্যবহৃত হয়। |
| `wallet.tabOverview` | Overview | সারসংক্ষেপ |
| `profile.accountCredentials` | Account Credentials | অ্যাকাউন্টের তথ্য |
| `profile.verifiedAccount` | Verified Account | যাচাইকৃত অ্যাকাউন্ট |
| `profile.username` | Username | ইউজারনেম |
| `profile.freeFireName` | Free Fire Name | Free Fire নাম |
| `profile.freeFireUID` | Free Fire UID | Free Fire UID |
| `profile.mobileNumber` | Mobile Number | মোবাইল নম্বর |
| `profile.payoutUpiId` | Payout UPI ID | উত্তোলনের UPI ID |
| `profile.verified18` | 18+ Verified | ১৮+ নিশ্চিত |
| `profile.yourReferralCode` | Your Referral Code | আপনার রেফারেল কোড |
| `profile.viewReferralDashboard` | View Full Referral Dashboard & Stats | সম্পূর্ণ রেফারেল ড্যাশবোর্ড ও পরিসংখ্যান দেখুন |
| `profile.editCredentials` | Edit Credentials | তথ্য পরিবর্তন করুন |
| `profile.androidAppTitle` | Booyah Win Android App | Booyah Win অ্যান্ড্রয়েড অ্যাপ |
| `profile.androidAppDesc` | Play faster with native alerts & instant notifications | দ্রুত রুম নোটিফিকেশন পেতে ইনস্টল করুন |
| `profile.downloadAppBtn` | Download App | অ্যাপ ডাউনলোড করুন |
| `profile.active` | ACTIVE | সক্রিয় |
| `profile.updating` | Updating... | আপডেট হচ্ছে... |
| `profile.saveChanges` | Save Changes | পরিবর্তন সংরক্ষণ করুন |
| `profile.cancel` | Cancel | বাতিল |
| `profile.editProfileTitle` | Edit Credentials | তথ্য পরিবর্তন করুন |
| `profile.editProfileDesc` | Update your game credentials & payout UPI | আপনার গেমের বিবরণ ও পে-আউট UPI আপডেট করুন |
| `profile.mobileLocked` | Mobile number can be changed after {date} | মোবাইল নম্বর {date} তারিখের পর পরিবর্তন করা যাবে |
| `profile.ffIdLocked` | Free Fire UID can be changed after {date} | Free Fire UID {date} তারিখের পর পরিবর্তন করা যাবে |
| `profile.ffNameLocked` | Free Fire Name can be changed after {date} | Free Fire নাম {date} তারিখের পর পরিবর্তন করা যাবে |
| `profile.upiLocked` | UPI ID can be changed after {date} | UPI ID {date} তারিখের পর পরিবর্তন করা যাবে |
| `profile.photoSuccess` | Profile photo updated successfully! | প্রোফাইল ছবি সফলভাবে আপডেট হয়েছে! |
| `profile.photoMax2Mb` | Profile image must be less than 2 MB. | ছবির সাইজ ২ এমবি-র কম হতে হবে। |
| `profile.photoValidFormat` | Please upload a valid image (JPEG, PNG, or WebP). | অনুগ্রহ করে সঠিক ফরম্যাটের ছবি (JPEG, PNG, বা WebP) দিন। |
| `profile.credentialsSuccess` | Profile credentials updated successfully! | প্রোফাইলের তথ্য সফলভাবে আপডেট হয়েছে! |
| `profile.cooldownError` | One or more fields are currently under a 30-day cooldown. | এক বা একাধিক ফিল্ড বর্তমানে ৩০ দিনের কুলডাউনে রয়েছে। |
| `profile.updateFailed` | Failed to update profile. Please try again. | প্রোফাইল আপডেট করতে ব্যর্থ হয়েছে। অনুগ্রহ করে আবার চেষ্টা করুন। |
| `referral.instantCashback` | Instant Cashback Rewards | তাৎক্ষণিক ক্যাশব্যাক পুরস্কার |
| `referral.rewardNotice` | You get ₹{reward} cashback when your friend makes their first approved deposit. | আপনার বন্ধু প্রথম সফল ডিপোজিট করলে আপনি ₹{reward} ক্যাশব্যাক পাবেন। |
| `referral.yourReferralCode` | Your Referral Code | আপনার রেফারেল কোড |
| `referral.copy` | Copy | কপি করুন |
| `referral.copied` | Copied! | কপি হয়েছে! |
| `referral.shareWhatsApp` | Share on WhatsApp | WhatsApp-এ শেয়ার করুন |
| `referral.moreOptions` | More Sharing Options | অন্যান্য অপশন |
| `referral.performanceStats` | Referral Performance | রেফারেল পরিসংখ্যান |
| `referral.friendsJoined` | Friends Joined | যোগদানকারী বন্ধু |
| `referral.cashbackEarnedTotal` | Cashback Earned | অর্জিত ক্যাশব্যাক |
| `referral.backToProfile` | Back to Profile | প্রোফাইলে ফিরুন |
| `install.installApp` | Install App | অ্যাপ ইনস্টল করুন |
| `leaderboard.loginBtn` | Login | লগইন |
| `leaderboard.registerBtn` | Register | নিবন্ধন |
| `matches.confirmJoinTitle` | Confirm Join Match | ম্যাচে যোগ নিশ্চিত করুন |
| `matches.deductionBreakdown` | Deduction Breakdown: | কর্তন বিবরণ: |
| `matches.done` | Done | সম্পন্ন |
| `matches.confirmAndJoin` | Confirm & Join | নিশ্চিত করুন এবং যোগ দিন |
| `matches.joining` | Joining... | যোগ হচ্ছে... |
| `matches.maintenanceWarning` | Joining matches is disabled during maintenance. | রক্ষণাবেক্ষণ চলাকালীন ম্যাচে যোগ দেওয়া বন্ধ থাকে। |
| `matches.breakdownCashback` | Cashback: {amount} | ক্যাশব্যাক: {amount} |
| `matches.breakdownAddMoney` | Deposited: {amount} | জমা ব্যালেন্স: {amount} |
| `matches.breakdownWinning` | Winning: {amount} | জয়ের ব্যালেন্স: {amount} |
| `wallet.cardAddMoney` | Deposited | জমা ব্যালেন্স |
| `wallet.cardEntryFees` | Entry fees | এন্ট্রি ফি |
| `wallet.cardCashback` | Cashback | ক্যাশব্যাক |
| `wallet.cardCashbackSubtitle` | Can be used sometime | মাঝে মাঝে ব্যবহারযোগ্য |
| `wallet.cardWinning` | Winning | জয়ের ব্যালেন্স |
| `wallet.cardWithdrawable` | Withdrawable | উত্তোলনযোগ্য |
| `wallet.maxPercentJoin` | Max {percent}% / join | সর্বোচ্চ {percent}% / ম্যাচ |
| `wallet.cappedPerJoin` | Capped per join | ম্যাচ প্রতি নির্দিষ্ট সীমা |
| `wallet.bannerExplain` | Deposited & Cashback can be used for tournament entry fees. Only Winning can be withdrawn. | জমা ব্যালেন্স ও ক্যাশব্যাক টুর্নামেন্ট এন্ট্রি ফির জন্য ব্যবহার করা যাবে। কেবল জয়ের ব্যালেন্স উত্তোলন করা যাবে। |
| `wallet.bannerPercent` | Cashback covers at most {percent}% of an entry fee per match. | প্রতি ম্যাচে ক্যাশব্যাক দিয়ে এন্ট্রি ফির সর্বোচ্চ {percent}% পর্যন্ত দেওয়া যাবে। |
| `wallet.bannerCapped` | Cashback covers a capped portion of an entry fee per match. | প্রতি ম্যাচে ক্যাশব্যাক দিয়ে এন্ট্রি ফির নির্দিষ্ট অংশ পরিশোধ করা যাবে। |
| `wallet.depositAndPayouts` | Deposit & Payouts | জমা ও উত্তোলন |
| `wallet.viewRequestsStatus` | View status of all requests | সব অনুরোধের স্ট্যাটাস দেখুন |
| `wallet.transactionHistory` | Transaction History | লেনদেনের ইতিহাস |
| `wallet.allCreditsDebitsRefunds` | All credits, debits & refunds | সকল ক্রেডিট, ডেবিট ও রিফান্ড |
| `wallet.recentTransactions` | Recent Transactions | সাম্প্রতিক লেনদেন |
| `wallet.viewAll` | View all | সব দেখুন |
| `wallet.loadingPaymentDetails` | Loading payment details... | পেমেন্টের বিবরণ লোড হচ্ছে... |
| `wallet.paymentOfflineTitle` | Payment System Offline | পেমেন্ট সিস্টেম অফলাইন |
| `wallet.paymentNotConfigured` | Payment information not configured yet | পেমেন্টের তথ্য এখনও কনফিগার করা হয়নি |
| `wallet.paymentDisabledNotice` | Deposits are temporarily disabled. Please check back shortly or contact support. | টাকা জমা সাময়িকভাবে বন্ধ আছে। অনুগ্রহ করে কিছুক্ষণ পর আবার চেষ্টা করুন বা সাপোর্টে যোগাযোগ করুন। |
| `wallet.step1ScanPay` | Step 1: Scan & Pay via UPI | ধাপ ১: UPI এর মাধ্যমে স্ক্যান ও পেমেন্ট করুন |
| `wallet.minMaxDeposit` | Min Rs{min} • Max Rs{max} | সর্বনিম্ন Rs{min} • সর্বোচ্চ Rs{max} |
| `wallet.officialQr` | Official Booyah Win QR | অফিসিয়াল Booyah Win QR |
| `wallet.qrUnavailable` | QR Code unavailable. Please use the UPI ID below. | QR কোড উপলব্ধ নেই। অনুগ্রহ করে নিচের UPI ID ব্যবহার করুন। |
| `wallet.merchantUpiId` | Merchant UPI ID | মার্চেন্ট UPI ID |
| `wallet.step2EnterDetails` | Step 2: Enter Transaction Details | ধাপ ২: লেনদেনের বিবরণ লিখুন |
| `wallet.amountPaid` | Amount Paid (Rs) | প্রদত্ত টাকা (Rs) |
| `wallet.utrTransactionId` | UTR / Transaction ID (12-25 digits/letters) | UTR / ট্রানজ্যাকশন ID (১২-২৫ সংখ্যা/অক্ষর) |
| `wallet.utrExampleBtn` | Where to find? | কীভাবে পাবেন? |
| `wallet.utrModalTitle` | Where to Find UTR Number | UTR নম্বর কীভাবে খুঁজে পাবেন |
| `wallet.utrModalSubtitle` | 12-digit transaction reference number from your UPI app | আপনার UPI অ্যাপ থেকে পাওয়া ১২-সংখ্যার রেফারেন্স নম্বর |
| `wallet.utrExplanation` | After making your UPI payment, your UPI app generates a 12-digit Unique Transaction Reference (UTR). Enter this number below to verify your deposit. | UPI পেমেন্ট সম্পন্ন করার পর আপনার অ্যাপ একটি ১২-সংখ্যার ইউনিক ট্রানজ্যাকশন রেফারেন্স (UTR) তৈরি করে। আপনার ডিপোজিট নিশ্চিত করতে নিচের ফর্মে এই নম্বরটি লিখুন। |
| `wallet.utrTabGpay` | Google Pay | Google Pay |
| `wallet.utrTabPhonepe` | PhonePe | PhonePe |
| `wallet.utrTabOther` | Paytm / Others | Paytm / অন্যান্য |
| `wallet.utrGpayStep1` | Open the completed transaction receipt in Google Pay. | Google Pay-তে সম্পন্ন হওয়া লেনদেনের রসিদটি খুলুন। |
| `wallet.utrGpayStep2` | Locate the 12-digit UPI transaction ID in the red box (e.g. 613511592698). | লাল বক্সে চিহ্নিত ১২-সংখ্যার UPI transaction ID (যেমন: 613511592698) দেখুন। |
| `wallet.utrPhonepeStep1` | Open the completed transaction receipt in PhonePe. | PhonePe-তে সম্পন্ন হওয়া লেনদেনের রসিদটি খুলুন। |
| `wallet.utrPhonepeStep2` | Click on "Transfer Details" to reveal the 12-digit UTR in the red box (e.g. 959654454573). | "Transfer Details"-এ ট্যাপ করে লাল বক্সে চিহ্নিত ১২-সংখ্যার UTR (যেমন: 959654454573) কপি করে নিন। |
| `wallet.utrPaytmStep1` | Open the completed transaction receipt in Paytm. | Paytm-এ সম্পন্ন হওয়া লেনদেনের রসিদটি খুলুন। |
| `wallet.utrPaytmStep2` | Locate the 12-digit UPI Ref No in the red box (e.g. 318308043065). | লাল বক্সে চিহ্নিত ১২-সংখ্যার UPI Ref No (যেমন: 318308043065) দেখুন। |
| `wallet.utrOtherDesc` | In Paytm, BHIM, Amazon Pay or mobile banking apps, look for "UPI Ref No.", "Ref No.", or "UPI Reference ID" (12 digits). | Paytm, BHIM, Amazon Pay বা ব্যাংকিং অ্যাপে "UPI Ref No.", "Ref No." বা "UPI Reference ID" (১২ ডিজিট) খুঁজে নিন। |
| `wallet.utrGotIt` | Got It | বুঝেছি |
| `wallet.paymentScreenshot` | Payment Screenshot (JPG/PNG/WebP, max 2 MB) | পেমেন্টের স্ক্রিনশট (JPG/PNG/WebP, সর্বোচ্চ ২ MB) |
| `wallet.chooseScreenshot` | Choose Screenshot | স্ক্রিনশট নির্বাচন করুন |
| `wallet.maxSize2Mb` | Max size 2 MB | সর্বোচ্চ সাইজ ২ MB |
| `wallet.change` | Change | পরিবর্তন |
| `wallet.depositMaintenanceWarning` | Deposits are temporarily disabled during maintenance. | রক্ষণাবেক্ষণের সময় টাকা জমা সাময়িকভাবে বন্ধ থাকে। |
| `wallet.uploading` | Uploading... | আপলোড হচ্ছে... |
| `wallet.depositSubmitted` | Deposit Submitted | জমার অনুরোধ জমা হয়েছে |
| `wallet.reviewNotice` | Usually reviewed within 30 minutes, final approval can take a bit longer | সাধারণত ৩০ মিনিটের মধ্যে পর্যালোচনা করা হয়, চূড়ান্ত অনুমোদনে কিছুটা বেশি সময় লাগতে পারে |
| `wallet.requestId` | Request ID: | অনুরোধ ID: |
| `wallet.amount` | Amount: | পরিমাণ: |
| `wallet.utrRef` | UTR / Ref: | UTR / রেফারেন্স: |
| `wallet.status` | Status: | স্ট্যাটাস: |
| `wallet.statusUnderReview` | Under review | পর্যালোচনাধীন |
| `wallet.addMore` | Add More | আরও জমা করুন |
| `wallet.myDeposits` | My Deposits | আমার জমাসমূহ |
| `wallet.depositConfirmFailed` | We couldn't confirm your submission. Check History before sending again | আমরা আপনার অনুরোধটি নিশ্চিত করতে পারিনি। পুনরায় জমা দেওয়ার আগে History চেক করুন |
| `wallet.utrAlreadySubmitted` | This UTR has already been submitted | এই UTR-টি ইতিমধ্যে জমা দেওয়া হয়েছে |
| `wallet.depositLimitPending` | You may have at most 3 pending deposits at a time | আপনার একসাথে সর্বোচ্চ ৩টি পেন্ডিং জমার অনুরোধ থাকতে পারে |
| `wallet.tooManyRequests` | Too many requests. Please slow down. | খুব বেশি অনুরোধ করা হয়েছে। অনুগ্রহ করে কিছুক্ষণ অপেক্ষা করুন। |
| `wallet.validationFailed` | Validation failed. Please verify your details. | যাচাইকরণ ব্যর্থ হয়েছে। অনুগ্রহ করে আপনার বিবরণ যাচাই করুন। |
| `wallet.depositFailed` | Failed to submit deposit. Please try again. | জমার অনুরোধ পাঠাতে ব্যর্থ হয়েছে। অনুগ্রহ করে আবার চেষ্টা করুন। |
| `wallet.withdrawableBalanceCard` | Withdrawable Balance | উত্তোলনযোগ্য ব্যালেন্স |
| `wallet.minWithdraw` | Min Rs50.00 | সর্বনিম্ন Rs50.00 |
| `wallet.minMaxWithdraw` | Min Rs{min} • Max Rs{max} | সর্বনিম্ন Rs{min} • সর্বোচ্চ Rs{max} |
| `wallet.withdrawExplanation` | Only Winning balance can be withdrawn. Deposited & Cashback are reserved for match entry fees. | কেবল জয়ের ব্যালেন্স উত্তোলন করা যাবে। জমা ব্যালেন্স ও ক্যাশব্যাক ম্যাচ এন্ট্রি ফির জন্য সংরক্ষিত। |
| `wallet.settlementNotice` | Withdrawals are settled within 24 hours to your verified UPI ID. | ২৪ ঘণ্টার মধ্যে আপনার যাচাইকৃত UPI ID-তে উত্তোলন সম্পন্ন করা হয়। |
| `wallet.requestPayout` | Request Payout | উত্তোলনের অনুরোধ |
| `wallet.withdrawAmountField` | Withdrawal Amount (Rs) | উত্তোলনের পরিমাণ (Rs) |
| `wallet.verifiedSavedUpi` | Verified Saved UPI ID | যাচাইকৃত সংরক্ষিত UPI ID |
| `wallet.noUpiSaved` | No UPI ID saved in profile | প্রোফাইলে কোনো UPI ID সংরক্ষিত নেই |
| `wallet.reenterUpiLabel` | Re-enter UPI ID to Confirm | নিশ্চিত করতে পুনরায় UPI ID লিখুন |
| `wallet.reenterUpiPlaceholder` | Type your saved UPI ID | সংরক্ষিত UPI ID লিখুন |
| `wallet.confirmUpiAgreement` | I confirm that the UPI ID entered above matches my verified account and is correct. | আমি নিশ্চিত করছি যে উপরে প্রবেশ করানো UPI ID আমার যাচাইকৃত অ্যাকাউন্টের সাথে মিলেছে এবং সঠিক। |
| `wallet.withdrawMaintenanceWarning` | Withdrawals are temporarily disabled during maintenance. | রক্ষণাবেক্ষণের সময় উত্তোলন সাময়িকভাবে বন্ধ থাকে। |
| `wallet.confirmWithdrawalBtn` | Confirm Withdrawal | উত্তোলন নিশ্চিত করুন |
| `wallet.withdrawalRequested` | Withdrawal Requested | উত্তোলনের অনুরোধ গৃহীত হয়েছে |
| `wallet.settledWithin24h` | Withdrawals are settled within 24 hours | উত্তোলন ২৪ ঘণ্টার মধ্যে সম্পন্ন হয় |
| `wallet.payoutUpi` | Payout UPI: | পে-আউট UPI: |
| `wallet.statusProcessing` | Processing | প্রক্রিয়াধীন |
| `wallet.newRequest` | New Request | নতুন অনুরোধ |
| `wallet.myWithdrawals` | My Withdrawals | আমার উত্তোলনসমূহ |
| `wallet.withdrawConfirmFailed` | We couldn't confirm your submission. Check History before sending again | আমরা আপনার অনুরোধটি নিশ্চিত করতে পারিনি। পুনরায় অনুরোধ করার আগে History চেক করুন |
| `wallet.upiRecentlyChangedBlocked` | Withdrawals are blocked for 24 hours after a UPI ID change | UPI ID পরিবর্তনের পর ২৪ ঘণ্টার জন্য উত্তোলন বন্ধ থাকে |
| `wallet.withdrawalAlreadyPending` | You already have a pending withdrawal request | আপনার ইতিমধ্যে একটি পেন্ডিং উত্তোলনের অনুরোধ রয়েছে |
| `wallet.insufficientWinningBalance` | Insufficient winning balance for this withdrawal | এই উত্তোলনের জন্য পর্যাপ্ত জয়ের ব্যালেন্স নেই |
| `wallet.withdrawValidationFailed` | Validation failed. Check your entered details. | যাচাইকরণ ব্যর্থ হয়েছে। আপনার দেওয়া বিবরণ চেক করুন। |
| `wallet.withdrawalFailed` | Withdrawal request failed. Please try again. | উত্তোলনের অনুরোধ ব্যর্থ হয়েছে। অনুগ্রহ করে আবার চেষ্টা করুন। |
| `wallet.upiNotMatching` | UPI ID does not match your saved UPI ID | UPI ID আপনার সংরক্ষিত UPI ID-এর সাথে মেলেনি |
| `wallet.confirmUpiRequired` | Please confirm that the UPI ID is correct | অনুগ্রহ করে নিশ্চিত করুন যে UPI ID সঠিক |
| `wallet.verifiedByStaff` | Verified by staff, waiting for final approval | স্টাফ দ্বারা যাচাইকৃত, চূড়ান্ত অনুমোদনের অপেক্ষায় |
| `wallet.statusApproved` | Approved | অনুমোদিত |
| `wallet.statusPaid` | Paid | পরিশোধিত |
| `wallet.statusRejected` | Rejected | প্রত্যাখ্যাত |
| `wallet.loadingDeposits` | Loading deposits... | জমার তথ্য লোড হচ্ছে... |
| `wallet.noDepositsFound` | No deposit requests found | কোনো জমার অনুরোধ পাওয়া যায়নি |
| `wallet.noDepositsDesc` | Submit a deposit to add funds to your wallet. | আপনার ওয়ালেটে টাকা যোগ করতে জমার অনুরোধ পাঠান। |
| `wallet.depositId` | Deposit ID: {id} | জমা ID: {id} |
| `wallet.utrColon` | UTR: | UTR: |
| `wallet.submittedColon` | Submitted: | জমাকৃত: |
| `wallet.reasonColon` | Reason: {reason} | কারণ: {reason} |
| `wallet.loadMore` | Load more | আরও লোড করুন |
| `wallet.loadingWithdrawals` | Loading withdrawals... | উত্তোলনের তথ্য লোড হচ্ছে... |
| `wallet.noWithdrawalsFound` | No withdrawal requests found | কোনো উত্তোলনের অনুরোধ পাওয়া যায়নি |
| `wallet.noWithdrawalsDesc` | You have not requested any payouts yet. | আপনি এখনও কোনো উত্তোলনের অনুরোধ করেননি। |
| `wallet.withdrawalId` | Withdrawal ID: {id} | উত্তোলন ID: {id} |
| `wallet.upiIdColon` | UPI ID: | UPI ID: |
| `wallet.requestedColon` | Requested: | অনুরোধের সময়: |
| `wallet.payoutRefColon` | Payout Ref: | পে-আউট রেফারেন্স: |
| `wallet.chipAll` | All | সব |
| `wallet.chipAddMoney` | Deposited | জমা টাকা |
| `wallet.chipReferral` | Referral | রেফারেল |
| `wallet.chipJoiningReward` | Joining Reward | জয়েনিং রিওয়ার্ড |
| `wallet.chipWithdrawal` | Withdrawal | উত্তোলন |
| `wallet.chipJoiningFee` | Joining Fee | এন্ট্রি ফি |
| `wallet.chipWinning` | Winning | জয়ের টাকা |
| `wallet.chipRefund` | Refund | রিফান্ড |
| `wallet.recentTenTransactions` | Recent 10 Transactions | সাম্প্রতিক ১০টি লেনদেন |
| `wallet.loadingTransactions` | Loading transaction history... | লেনদেনের ইতিহাস লোড হচ্ছে... |
| `wallet.noTransactionsFound` | No transactions found | কোনো লেনদেন পাওয়া যায়নি |
| `wallet.noTransactionsDesc` | Transactions will appear here as you add funds, enter matches, or receive rewards. | আপনি টাকা যোগ করলে, ম্যাচে অংশ নিলে বা পুরস্কার পেলে এখানে লেনদেন দেখা যাবে। |
| `wallet.balColon` | Bal: | ব্যালেন্স: |
| `wallet.welcomeBonus` | Welcome Bonus | ওয়েলকাম বোনাস |
| `wallet.welcomeBonusDesc` | Welcome to Booyah Win! Your Joining Reward has been credited directly to your Deposit wallet. | বুয়াহ উইনে স্বাগতম! আপনার জয়েনিং রিওয়ার্ড সরাসরি ডিপোজিট ওয়ালেটে যোগ করা হয়েছে। |
| `referral.sharedSuccessfully` | Shared successfully! | সফলভাবে শেয়ার করা হয়েছে! |
| `referral.shareAndEarn` | Share & Earn | শেয়ার করুন ও আয় করুন |
| `referral.shareWithFriends` | Share with Friends | বন্ধুদের সাথে শেয়ার করুন |
| `referral.earnTogether` | Earn instant cash bonuses together | একসাথে তাৎক্ষণিক ক্যাশ বোনাস জিতুন |
| `referral.yourCodeLabel` | Your Code | আপনার কোড |
| `referral.shareDirectly` | Share Directly | সরাসরি শেয়ার করুন |
| `referral.copyReferralLink` | Copy Referral Link | রেফারেল লিংক কপি করুন |
| `referral.linkCopied` | Referral link copied to clipboard! | রেফারেল লিংক ক্লিপবোর্ডে কপি করা হয়েছে! |
| `referral.openingShare` | Opening share window... | শেয়ার উইন্ডো খোলা হচ্ছে... |
| `referral.shareDirectlyWhatsApp` | Share Directly on WhatsApp | সরাসরি WhatsApp-এ শেয়ার করুন |
| `referral.yourActivity` | Your Referral Activity | আপনার রেফারেল কার্যকলাপ |
| `referral.bonusesUnlocked` | Bonuses Unlocked | বোনাস আনলক হয়েছে |
| `referral.totalEarned` | Total Earned | মোট অর্জিত |
| `referral.howItWorksGuide` | How It Works | এটি কীভাবে কাজ করে |
| `referral.guideStep1` | Send your unique referral code or link to your friends. | আপনার বন্ধুদের আপনার অনন্য রেফারেল কোড বা লিংক পাঠান। |
| `referral.guideStep2` | Your friend enters your code during registration. | আপনার বন্ধু নিবন্ধনের সময় আপনার কোডটি লিখবেন। |
| `referral.guideStep3` | When your friend makes their first approved deposit, you instantly get ₹{reward} cashback credited! | যখন আপনার বন্ধু প্রথম সফল ডিপোজিট করবেন, তখন আপনি তাৎক্ষণিকভাবে ₹{reward} ক্যাশব্যাক পাবেন! |
| `profile.subtitle` | Account overview & game credentials | অ্যাকাউন্ট ওভারভিউ ও গেমের বিবরণ |
| `profile.needHelpSupport` | Need Help? Contact Customer Support | সাহায্য প্রয়োজন? কাস্টমার সাপোর্টে যোগাযোগ করুন |
| `profile.nonEditableDetails` | Non-Editable Details | অপরিবর্তনযোগ্য বিবরণ |
| `profile.locked` | Locked | লক করা |
| `profile.nameLockedDesc` | Name cannot be changed after registration. | নিবন্ধনের পরে নাম পরিবর্তন করা যাবে না। |
| `profile.emailLockedDesc` | Email is permanently linked to your account. | ইমেইল স্থায়ীভাবে আপনার অ্যাকাউন্টের সাথে যুক্ত। |
| `profile.editableCredentials` | Editable Credentials | পরিবর্তনযোগ্য বিবরণ |
| `profile.cooldown30Days` | Cooldown: 30 days per change | কুলডাউন: প্রতি পরিবর্তনে ৩০ দিন |
| `profile.cooldownActive` | Cooldown Active | কুলডাউন সক্রিয় |
| `profile.upiNotice48h` | Note: If you change your UPI ID, withdrawals will be disabled for 24 hours for security. | নোট: অ্যাকাউন্ট সুরক্ষার জন্য আপনার UPI ID পরিবর্তন করলে ২৪ ঘণ্টার জন্য উত্তোলন বন্ধ থাকবে। |
| `profile.saveProfileBtn` | Save Profile Changes | পরিবর্তন সংরক্ষণ করুন |
| `profile.savingProfileBtn` | Saving Changes... | সংরক্ষণ করা হচ্ছে... |
| `profile.editProfileBtn` | Edit Profile | প্রোফাইল পরিবর্তন |
| `profile.registeredEmail` | Registered Email | নিবন্ধিত ইমেইল |
| `matches.teamChangesCutoffNotice` | Notice: Team changes close 10 minutes before the start | বিজ্ঞপ্তি: ম্যাচ শুরুর ১০ মিনিট আগে দল পরিবর্তন বন্ধ হবে |
| `matches.teamChangesCutoffRule` | Rule: Team changes close 10 minutes before the start | নিয়ম: ম্যাচ শুরুর ১০ মিনিট আগে দল পরিবর্তন বন্ধ হবে |
| `matches.inGameName` | Player (In-Game Name) | খেলোয়াড় (ইন-গেম নাম) |
| `matches.selectTeammateToReplace` | Select which teammate you want to replace | কোন সতীর্থকে পরিবর্তন করতে চান নির্বাচন করুন |
| `matches.checkToEnable` | Check to enable | সক্রিয় করতে চেক করুন |
| `matches.noTeammatesToReplace` | No teammates found to replace. | পরিবর্তন করার জন্য কোনো সতীর্থ পাওয়া যায়নি। |
| `matches.selectTeammateError` | Please check a teammate to replace. | অনুগ্রহ করে পরিবর্তন করতে একজন সতীর্থকে চেক করুন। |
| `matches.playerNotFound` | Player not found. | খেলোয়াড় পাওয়া যায়নি। |
| `matches.invalidTeamReplacement` | Invalid team or member replacement. | ভুল দল বা সদস্য প্রতিস্থাপন। |
| `matches.cutoffReachedError` | Registration for this match is closed (10-minute cutoff reached). | এই ম্যাচের নিবন্ধন বন্ধ রয়েছে (১০ মিনিটের সীমা অতিক্রান্ত)। |
| `matches.totalTeamFee` | Total Team Fee | দলের মোট ফি |
| `matches.teamNameLabel` | Team Name | দলের নাম |
| `matches.teammateUidLabel` | Teammate {n} Username or User ID | সহযোদ্ধা {n}-এর ইউজারনেম বা ইউজার আইডি |
| `matches.createTeamBtn` | Create Team & Pay | দল তৈরি করুন ও পরিশোধ করুন |
| `matches.creatingTeam` | Creating Team... | দল তৈরি হচ্ছে... |
| `matches.replaceMemberTitle` | Replace Team Member | দলের সদস্য প্রতিস্থাপন |
| `matches.disbandTeamTitle` | Disband Team | দল ভেঙে দিন |
| `matches.currentMemberUid` | Current Member Free Fire UID | বর্তমান সদস্যের Free Fire UID |
| `matches.newMemberUid` | New Member Free Fire UID | নতুন সদস্যের Free Fire UID |
| `matches.confirmReplaceBtn` | Confirm Replace | প্রতিস্থাপন নিশ্চিত করুন |
| `matches.confirmDisbandBtn` | Disband Team | দল ভেঙে দিন |
| `matches.disbandWarning` | Are you sure you want to disband your team? All members will be removed and fees refunded according to platform rules. | আপনি কি নিশ্চিত যে আপনি আপনার দলটি ভেঙে দিতে চান? সমস্ত সদস্যকে সরিয়ে দেওয়া হবে এবং নিয়ম অনুযায়ী ফি ফেরত দেওয়া হবে। |
| `matches.acceptInviteConfirm` | Accept Team Invitation | দলের আমন্ত্রণ গ্রহণ করুন |
| `matches.acceptInviteNotice` | Joining fee will be deducted from your wallet balance upon acceptance. | আমন্ত্রণ গ্রহণ করলে আপনার ওয়ালেট ব্যালেন্স থেকে এন্ট্রি ফি কেটে নেওয়া হবে। |
| `matches.matchStartTimeIST` | Match Start Time: | ম্যাচ শুরুর সময়: |
| `matches.exactEntryFee` | Entry Fee: | এন্ট্রি ফি: |
| `matches.confirmAcceptBtn` | Confirm & Accept | নিশ্চিত ও গ্রহণ করুন |
| `matches.decline` | Decline | প্রত্যাখ্যান |
| `matches.accept` | Accept | গ্রহণ |
| `matches.noPendingInvites` | No pending team invites | কোনো পেন্ডিং দলের আমন্ত্রণ নেই |
| `matches.invitesWillShow` | Invitations from team leaders will appear here. | দলনেতাদের পাঠানো আমন্ত্রণ এখানে দেখা যাবে। |
| `matches.allGameModes` | All Game Modes | সকল গেম মোড |
| `matches.allTeamModes` | All Team Modes | সকল টিম মোড |
| `matches.loadingHistory` | Loading match history... | ম্যাচের ইতিহাস লোড হচ্ছে... |
| `matches.failedLoadHistory` | Failed to load match history | ম্যাচের ইতিহাস লোড করতে ব্যর্থ হয়েছে |
| `matches.noHistoryDesc` | Your past matches, ranks, and prizes will appear here. | আপনার বিগত ম্যাচ, র‍্যাঙ্ক এবং পুরস্কার এখানে দেখা যাবে। |
| `matches.kills` | Kills | কিল |
| `matches.prizeWon` | Prize Won | অর্জিত পুরস্কার |
| `common.loadMore` | Load More | আরও দেখুন |
| `wallet.copied` | Copied | কপি হয়েছে |
| `wallet.txnDeposit` | Deposit | জমা |
| `wallet.txnReferralReward` | Referral Reward | রেফারেল পুরস্কার |
| `wallet.txnJoiningReward` | Joining Reward | জয়েনিং রিওয়ার্ড |
| `wallet.txnMatchEntryFee` | Match Entry Fee | ম্যাচ এন্ট্রি ফি |
| `wallet.txnMatchWinning` | Match Winning | ম্যাচ জয় |
| `wallet.txnWithdrawal` | Withdrawal | উত্তোলন |
| `wallet.txnWithdrawalRefund` | Withdrawal Refund | উত্তোলন রিফান্ড |
| `wallet.txnFeeRefund` | Fee Refund | ফি রিফান্ড |
| `wallet.txnAdminAdjustment` | Adjustment | সমন্বয় |
| `wallet.txnResultReversal` | Result Reversal | ফলাফল প্রত্যাবর্তন |
| `referral.referAndEarn` | Refer & Earn | রেফার করুন ও আয় করুন |
| `referral.codeCopied` | Referral code copied! | রেফারেল কোড কপি করা হয়েছে! |
| `profile.myProfile` | My Profile | আমার প্রোফাইল |
| `profile.logout` | Logout | লগআউট |
| `profile.profilePhoto` | Profile Photo | প্রোফাইল ছবি |
| `profile.photoFormatHelp` | JPEG, PNG or WebP under 2 MB | JPEG, PNG বা WebP সর্বোচ্চ ২ MB |
| `profile.freeFireIdUid` | Free Fire ID (UID) | Free Fire ID (UID) |
| `profile.freeFireInGameName` | Free Fire In-Game Name | Free Fire ইন-গেম নাম |
| `matches.formTeamTitle` | Form {mode} Team | {mode} দল গঠন করুন |
| `matches.teamEntryFee` | Team Entry Fee | দলের এন্ট্রি ফি |
| `matches.entryFeePerPlayer` | Entry Fee per Player | খেলোয়াড় প্রতি এন্ট্রি ফি |
| `matches.teamSize` | Team Size | দলের সদস্য সংখ্যা |
| `matches.teamSizePlayers` | {count} players | {count} জন খেলোয়াড় |
| `matches.deductedFromWallet` | Deducted from your wallet | আপনার ওয়ালেট থেকে কাটা হবে |
| `matches.teamNameOptional` | Team Name (Optional) | দলের নাম (ঐচ্ছিক) |
| `matches.teammateUidsRequired` | Teammate Usernames or User IDs ({count} required) | সহযোদ্ধার ইউজারনেম বা ইউজার আইডি ({count} জন প্রয়োজন) |
| `matches.teammateUidRequiredSingle` | Teammate Username or User ID (1 required) | সহযোদ্ধার ইউজারনেম বা ইউজার আইডি (১ জন প্রয়োজন) |
| `matches.checking` | Checking... | যাচাই করা হচ্ছে... |
| `matches.invalidUidCheck` | Invalid username or User ID, check or register the player | ভুল ইউজারনেম বা ইউজার আইডি, যাচাই করুন বা খেলোয়াড়কে নিবন্ধন করান |
| `matches.allTeammatesRequired` | Please enter all {count} teammate username(s) or User ID(s). | অনুগ্রহ করে সকল {count} জন সহযোদ্ধার ইউজারনেম বা ইউজার আইডি দিন। |
| `matches.uniqueTeammatesRequired` | Each teammate username or User ID must be unique. | প্রতিটি সহযোদ্ধার ইউজারনেম বা ইউজার আইডি আলাদা হতে হবে। |
| `matches.teammateUidInvalidAt` | Teammate {index} username or User ID is invalid. Please check or register the player. | সহযোদ্ধা {index}-এর ইউজারনেম বা ইউজার আইডি ভুল। অনুগ্রহ করে যাচাই করুন বা নিবন্ধন করান। |
| `matches.insufficientWalletTeamFee` | Insufficient wallet balance. Team entry fee requires {fee}. | ওয়ালেটে পর্যাপ্ত টাকা নেই। দলের এন্ট্রি ফির জন্য {fee} প্রয়োজন। |
| `matches.teamAlreadyJoined` | You or a teammate has already joined this match. | আপনি বা আপনার দলের কোনো সদস্য ইতিমধ্যে এই ম্যাচে যোগ দিয়েছেন। |
| `matches.onlyLeaderCanChangeTeammate` | Only team leader can change teammate. | কেবল দলনেতা সহযোদ্ধা পরিবর্তন করতে পারবেন। |
| `matches.cannotDisbandCutoff` | Cannot disband team within 10 minutes of match start. | ম্যাচ শুরুর ১০ মিনিট পূর্বে দল ভাঙা যাবে না। |
| `matches.oldFfIdLabel` | Current Teammate Free Fire ID | বর্তমান সহযোদ্ধার Free Fire ID |
| `matches.oldFfIdPlaceholder` | Old Free Fire ID | পুরাতন Free Fire ID |
| `matches.newFfIdLabel` | New Teammate Username or User ID | নতুন সহযোদ্ধার ইউজারনেম বা ইউজার আইডি |
| `matches.newFfIdPlaceholder` | New Teammate Username or User ID | নতুন সহযোদ্ধার ইউজারনেম বা ইউজার আইডি |
| `matches.bothUidsRequired` | Please enter both the current and new Free Fire IDs. | অনুগ্রহ করে বর্তমান ও নতুন উভয় Free Fire ID দিন। |
| `matches.noPendingInvitesTitle` | No Pending Invites | কোনো পেন্ডিং আমন্ত্রণ নেই |
| `matches.noPendingInvitesDesc` | When teammates invite you to Duo or Squad matches, they appear here. | সহযোদ্ধারা আপনাকে Duo বা Squad ম্যাচে আমন্ত্রণ জানালে তা এখানে দেখা যাবে। |
| `matches.inviteAcceptedSuccess` | Invite accepted successfully! | আমন্ত্রণ সফলভাবে গ্রহণ করা হয়েছে! |
| `matches.inviteDeclined` | Invite declined. | আমন্ত্রণ প্রত্যাখ্যান করা হয়েছে। |
| `matches.insufficientWalletAcceptInvite` | Insufficient wallet balance to accept this invite. | এই আমন্ত্রণ গ্রহণ করার জন্য ওয়ালেটে পর্যাপ্ত ব্যালেন্স নেই। |
| `matches.noMatchesPlayedTitle` | No Matches Played Yet | এখনও কোনো ম্যাচ খেলা হয়নি |
| `downloadApp.bannerTitle` | Booyah Win for Android | Android-এর জন্য Booyah Win |
| `downloadApp.bannerSubtitle` | Official APK for faster gameplay & instant match alerts | দ্রুত গেমপ্লে ও তাত্ক্ষণিক ম্যাচ সতর্কতার জন্য অফিসিয়াল APK |
| `downloadApp.downloadButton` | Download App | Download App |
| `downloadApp.installHelpButton` | Installation help | ইনস্টলেশন সহায়তা |
| `downloadApp.dismissAriaLabel` | Dismiss download app banner | ডাউনলোড অ্যাপ ব্যানার বন্ধ করুন |
| `downloadApp.dialogTitle` | How to Install on Android | Android-এ কীভাবে ইনস্টল করবেন |
| `downloadApp.dialogSubtitle` | Official guide to installing the Booyah Win APK safely | নিরাপদে Booyah Win APK ইনস্টল করার অফিসিয়াল গাইড |
| `downloadApp.step1Title` | 1. Download the APK | ১. APK ডাউনলোড করুন |
| `downloadApp.step1Desc` | Tap "Download App". If your browser displays "File might be harmful", tap "Download anyway". This is a standard Android prompt for apps downloaded outside Google Play. | "Download App"-এ চাপ দিন। আপনার ব্রাউজারে "File might be harmful" দেখালে "Download anyway" নির্বাচন করুন। এটি Google Play-এর বাইরে ডাউনলোড করা অ্যাপের জন্য স্বাভাবিক প্রম্পট। |
| `downloadApp.step2Title` | 2. Allow Installation | ২. ইনস্টলেশনের অনুমতি দিন |
| `downloadApp.step2Desc` | Open the downloaded file from your notifications or Downloads folder. If prompted, tap "Settings" and enable "Allow from this source", then return and tap "Install". | নোটিফিকেশন বা Downloads ফোল্ডার থেকে ফাইলটি খুলুন। অনুরোধ করা হলে "Settings"-এ গিয়ে "Allow from this source" চালু করুন, তারপর ফিরে এসে "Install"-এ চাপ দিন। |
| `downloadApp.step3Title` | 3. Google Play Protect Warning | ৩. Google Play Protect সতর্কতা |
| `downloadApp.step3Desc` | If Google Play Protect warns that the app is unrecognized, tap "More details" followed by "Install anyway". Our APK is 100% verified, virus-free, and safe. | Google Play Protect যদি অ্যাপটিকে অচেনা বলে সতর্কতা দেয়, তবে "More details"-এ চাপ দিয়ে "Install anyway" নির্বাচন করুন। আমাদের APK ১০০% যাচাইকৃত এবং নিরাপদ। |
| `downloadApp.safetyWarningTitle` | Official Source Warning | অফিসিয়াল সোর্স সতর্কতা |
| `downloadApp.safetyWarningDesc` | The APK file should come ONLY from this official site. Never download or accept Booyah Win APK files from third-party links, Telegram, or WhatsApp. | APK ফাইলটি কেবল এই অফিসিয়াল ওয়েবসাইট থেকেই ডাউনলোড করুন। তৃতীয় পক্ষের লিংক, Telegram বা WhatsApp থেকে Booyah Win APK কখনো গ্রহণ করবেন না। |
| `downloadApp.closeDialog` | Got It | বুঝেছি |
| `profile.changePhoto` | Change profile photo | প্রোফাইল ছবি পরিবর্তন করুন |
| `matches.replace` | Replace | পরিবর্তন করুন |
| `matches.replacing` | Replacing... | পরিবর্তন করা হচ্ছে... |
| `matches.keepTeam` | Keep Team | দল রাখুন |
| `matches.disbandAndRefund` | Disband & Refund | দল ভাঙুন ও রিফান্ড নিন |
| `matches.disbanding` | Disbanding... | দল ভাঙা হচ্ছে... |
| `matches.failedToReplaceTeammate` | Failed to replace teammate. | দলের সদস্য পরিবর্তন করতে ব্যর্থ হয়েছে। |
| `matches.failedToDisband` | Failed to disband team. | দল ভেঙে দিতে ব্যর্থ হয়েছে। |
| `matches.errorVerifyingUid` | Error verifying UID. | UID যাচাইয়ে ত্রুটি। |
| `matches.teamInviteBadge` | Team Invite | দলের আমন্ত্রণ |
| `matches.teamInvitation` | Team Invitation | দলের আমন্ত্রণ |
| `matches.team` | Team | দল |
| `matches.matchMode` | Match Mode | ম্যাচ মোড |
| `matches.invitedBy` | Invited by: | আমন্ত্রণকারী: |
| `matches.invitedUser` | Invited user: | আমন্ত্রিত ব্যবহারকারী: |
| `matches.invitedUserLabel` | Invited User | আমন্ত্রিত ব্যবহারকারী |
| `matches.exactEntryFeeLabel` | Exact Entry Fee | সঠিক এন্ট্রি ফি |
| `matches.rewards` | Rewards | পুরস্কার |
| `matches.matchStartTimeLabel` | Match Start Time | ম্যাচ শুরুর সময় |
| `matches.you` | You | আপনি |
| `matches.startsAt` | Starts: | শুরু: |
| `matches.killReward` | Kill Reward | কিল রিওয়ার্ড |
| `matches.none` | None | নেই |
| `matches.tbd` | TBD | TBD |
| `matches.confirmAcceptInviteTitle` | Confirm Accept Invite | আমন্ত্রণ গ্রহণ নিশ্চিত করুন |
| `matches.accepting` | Accepting... | গ্রহণ করা হচ্ছে... |
| `common.loadingMore` | Loading more... | আরও লোড হচ্ছে... |
| `common.networkErrorTryAgain` | Network error. Please try again. | নেটওয়ার্ক ত্রুটি। অনুগ্রহ করে পুনরায় চেষ্টা করুন। |
| `matches.matchFullError` | This match is already full. | এই ম্যাচটি ইতিমধ্যেই পূর্ণ হয়ে গেছে। |
| `matches.failedToAcceptInvite` | Failed to accept invite. | আমন্ত্রণ গ্রহণ করতে ব্যর্থ হয়েছে। |
| `matches.failedToDeclineInvite` | Failed to decline invite. | আমন্ত্রণ প্রত্যাখ্যান করতে ব্যর্থ হয়েছে। |
| `wallet.transactionDetailsTitle` | Transaction Details | লেনদেনের বিবরণ |
| `wallet.statusSuccessful` | Successful | সফল |
| `wallet.statusCancelled` | Cancelled | বাতিল |
| `wallet.statusPending` | Pending Review | পর্যালোচনাধীন |
| `wallet.deductedFrom` | Deducted From | কর্তন করা হয়েছে |
| `wallet.creditedTo` | Credited To | যোগ করা হয়েছে |
| `wallet.balanceAfterTxn` | Balance After Transaction | লেনদেনের পর ব্যালেন্স |
| `wallet.transactionIdLabel` | Transaction ID | লেনদেন আইডি |
| `wallet.matchInformation` | Match Information | ম্যাচের তথ্য |
| `wallet.viewMatchDetails` | View Match Details | ম্যাচের বিবরণ দেখুন |
| `wallet.paymentDetails` | Payment Details | পেমেন্টের বিবরণ |
| `wallet.needHelpWithTxn` | Need help with this transaction? | এই লেনদেন নিয়ে সাহায্যের প্রয়োজন? |
| `wallet.contactSupport` | Contact Support | সাপোর্টে যোগাযোগ করুন |
| `wallet.copiedToClipboard` | Copied to clipboard! | ক্লিপবোর্ডে কপি করা হয়েছে! |
| `wallet.moneySplit` | Money Split: | টাকার বিভাজন: |
| `wallet.requestMadeTime` | Request Made Time | অনুরোধ করার সময় |
| `wallet.referredUser` | Referred User | রেফার করা ব্যবহারকারী |
| `wallet.reason` | Reason | কারণ |
| `wallet.filterFromDate` | From: | শুরু: |
| `wallet.filterToDate` | To: | শেষ: |
| `wallet.clearDateFilter` | Clear date filter | তারিখ ফিল্টার মুছুন |
| `aboutUs.title` | About Us | আমাদের সম্পর্কে |
| `aboutUs.heroSubtitle` | India's Premier Free Fire Esports Platform | ভারতের প্রিমিয়ার ফ্রি ফায়ার ইস্পোর্টস প্ল্যাটফর্ম |
| `aboutUs.heroDesc` | Booyah Win is dedicated to transforming grassroots mobile gaming into a professional competitive arena. We host daily custom rooms, scrims, and grand tournaments for players across India. | বুয়াহ উইন তৃণমূল স্তরের মোবাইল গেমিংকে একটি পেশাদার প্রতিযোগিতামূলক প্ল্যাটফর্মে রূপান্তরিত করতে নিবেদিত। আমরা প্রতিদিন সারা ভারতের খেলোয়াড়দের জন্য কাস্টম রুম, স্ক্রিম এবং টুর্নামেন্ট আয়োজন করি। |
| `aboutUs.whyChooseUs` | Why Players Choose Booyah Win | খেলোয়াড়রা কেন বুয়াহ উইন বেছে নেয় |
| `aboutUs.pillarAntiCheatTitle` | Strict Anti-Cheat & Fair Play | কঠোর অ্যান্টি-চিট ও ফেয়ার প্লে |
| `aboutUs.pillarAntiCheatDesc` | Zero tolerance for emulators, hacks, or modified game clients. Every match is monitored by tournament staff, and end-game scoreboards undergo manual screenshot verification. | এমুলেটর, হ্যাক বা পরিবর্তিত গেম ক্লায়েন্টের বিরুদ্ধে শূন্য সহনশীলতা। প্রতিটি ম্যাচ টুর্নামেন্ট স্টাফ দ্বারা পর্যবেক্ষণ করা হয় এবং স্ক্রিনশট যাচাইয়ের মাধ্যমে স্কোর নিশ্চিত করা হয়। |
| `aboutUs.pillarSkillTitle` | 100% Skill-Based Gaming | ১০০% দক্ষতা-ভিত্তিক গেমিং |
| `aboutUs.pillarSkillDesc` | Booyah Win operates in full compliance with Indian laws regarding games of skill. Match outcomes depend entirely on individual aim, team coordination, strategy, and game sense. | বুয়াহ উইন দক্ষতা-ভিত্তিক গেম সংক্রান্ত ভারতীয় আইনের পূর্ণ সম্মতিতে পরিচালিত হয়। ম্যাচের ফলাফল সম্পূর্ণ খেলোয়াড়ের নিশানা, দলের সমন্বয় এবং কৌশলের উপর নির্ভরশীল। |
| `aboutUs.pillarPayoutTitle` | Instant UPI Withdrawals | তাৎক্ষণিক UPI উত্তোলন |
| `aboutUs.pillarPayoutDesc` | Your winnings belong to you. We process automated and verified withdrawals directly to your UPI ID without hidden deductions or unnecessary holding periods. | আপনার উপার্জিত অর্থ আপনারই। কোনো লুকানো চার্জ বা অপ্রয়োজনীয় অপেক্ষা ছাড়াই সরাসরি আপনার UPI আইডিতে টাকা পৌঁছে যায়। |
| `aboutUs.pillarSupportTitle` | Dedicated Customer Support | সার্বক্ষণিক কাস্টমার সাপোর্ট |
| `aboutUs.pillarSupportDesc` | Have questions or encountered a room dispute? Our dedicated support team is available daily via WhatsApp and email to resolve issues promptly. | কোনো প্রশ্ন বা রুমে কোনো বিরোধ দেখা দিলে আমাদের সাপোর্ট টিম হোয়াটসঅ্যাপ ও ইমেলের মাধ্যমে দ্রুত সমাধানের জন্য সর্বদা প্রস্তুত। |
| `aboutUs.legalNoticeTitle` | Legal & Corporate Notice | আইনি ও করপোরেট বিজ্ঞপ্তি |
| `aboutUs.legalNoticeDesc` | Booyah Win is operated by Booyah Win Technologies. All Free Fire game names, trademarks, and logos are property of Garena International. Booyah Win is an independent tournament organizer and is not affiliated with or endorsed by Garena. | বুয়াহ উইন পরিচালিত হয় বুয়াহ উইন টেকনোলজিস দ্বারা। সমস্ত ফ্রি ফায়ার গেমের নাম, ট্রেডমার্ক ও লোগো গারেনা ইন্টারন্যাশনালের সম্পত্তি। বুয়াহ উইন একটি স্বাধীন টুর্নামেন্ট আয়োজক এবং গারেনার সাথে অনুমোদিত বা সম্পর্কিত নয়। |
| `privacyPolicy.title` | Privacy Policy | গোপনীয়তা নীতি |
| `privacyPolicy.heroTitle` | Your Privacy Matters to Us | আপনার গোপনীয়তা আমাদের কাছে অত্যন্ত গুরুত্বপূর্ণ |
| `privacyPolicy.lastUpdated` | Last updated: October 2026. Booyah Win is committed to safeguarding player personal data and maintaining the highest standards of financial security and fairness. | সর্বশেষ আপডেট: অক্টোবর ২০২৬। বুয়াহ উইন খেলোয়াড়দের ব্যক্তিগত তথ্য সুরক্ষিত রাখতে এবং সর্বোচ্চ আর্থিক নিরাপত্তা বজায় রাখতে প্রতিশ্রুতিবদ্ধ। |
| `privacyPolicy.sec1Title` | 1. Information We Collect | ১. আমরা যে তথ্য সংগ্রহ করি |
| `privacyPolicy.sec1Desc` | When you register and participate in tournaments on Booyah Win, we collect: | বুয়াহ উইনে নিবন্ধন এবং টুর্নামেন্টে অংশগ্রহণের সময় আমরা সংগ্রহ করি: |
| `privacyPolicy.sec1AccountDetailsLabel` | Account Details: | অ্যাকাউন্টের বিবরণ: |
| `privacyPolicy.sec1AccountDetailsText` | Full name, mobile number, email address, username, and date of birth (to enforce 18+ legal eligibility). | পুরো নাম, মোবাইল নম্বর, ইমেল ঠিকানা, ইউজারনেম এবং জন্ম তারিখ (১৮+ বয়সের আইনি যোগ্যতা নিশ্চিত করতে)। |
| `privacyPolicy.sec1GameInfoLabel` | Game Information: | গেমের তথ্য: |
| `privacyPolicy.sec1GameInfoText` | Free Fire User ID (UID) and In-Game Name (IGN) to verify room entry and distribute prizes. | কাস্টম রুমে প্রবেশ এবং পুরস্কার বিতরণের জন্য ফ্রি ফায়ার ইউজার আইডি (UID) এবং ইন-গেম নাম (IGN)। |
| `privacyPolicy.sec1FinancialInfoLabel` | Financial Information: | আর্থিক তথ্য: |
| `privacyPolicy.sec1FinancialInfoText` | Payout UPI ID (we never collect or store banking passwords, debit card PINs, or OTPs). | টাকা উত্তোলনের জন্য UPI ID (আমরা কখনোই ব্যাংক পাসওয়ার্ড, ডেবিট কার্ড পিন বা ওটিপি সংরক্ষণ করি না)। |
| `privacyPolicy.sec1SecurityInfoLabel` | Security & Session Data: | নিরাপত্তা ও সেশন তথ্য: |
| `privacyPolicy.sec1SecurityInfoText` | IP address, device fingerprints, and security tokens to prevent fraud and multi-accounting. | প্রতারণা এবং একাধিক অ্যাকাউন্ট রোধে আইপি ঠিকানা ও ডিভাইস তথ্য। |
| `privacyPolicy.sec2Title` | 2. How We Use Your Information | ২. আমরা যেভাবে আপনার তথ্য ব্যবহার করি |
| `privacyPolicy.sec2Item1` | Facilitating custom tournament match rooms, seat reservations, and team invites. | কাস্টম টুর্নামেন্ট রুম তৈরি, আসন সংরক্ষণ এবং দলের আমন্ত্রণ পরিচালনা। |
| `privacyPolicy.sec2Item2` | Processing entry fees and crediting instant kill and placement winnings to your wallet. | প্রবেশ ফি গ্রহণ এবং প্রতি কিল ও বিজয়ী স্থান অনুযায়ী সরাসরি ওয়ালেটে টাকা যোগ করা। |
| `privacyPolicy.sec2Item3` | Auditing gameplay scores via screenshot verification to eliminate cheating or hacking. | চিটিং বা হ্যাকিং রোধে স্ক্রিনশট যাচাইয়ের মাধ্যমে ম্যাচের স্কোর অডিট করা। |
| `privacyPolicy.sec2Item4` | Sending essential OTP verification codes and critical match schedule notifications. | প্রয়োজনীয় OTP যাচাইকরণ কোড এবং গুরুত্বপূর্ণ ম্যাচের সময়সূচির নোটিফিকেশন পাঠানো। |
| `privacyPolicy.sec3Title` | 3. No Data Selling | ৩. তথ্য বিক্রি না করার অঙ্গীকার |
| `privacyPolicy.sec3Desc` | Booyah Win will never sell, lease, or monetize your personal information or contact details to third-party marketing agencies or advertisers. Your data is used exclusively to operate your tournament experience. | বুয়াহ উইন কখনোই আপনার ব্যক্তিগত তথ্য কোনো তৃতীয় পক্ষের বিপণন সংস্থা বা বিজ্ঞাপনদাতাদের কাছে বিক্রি বা ভাড়া দেয় না। আপনার ডেটা শুধুমাত্র টুর্নামেন্ট পরিচালনার কাজে ব্যবহৃত হয়। |
| `privacyPolicy.sec4Title` | 4. Financial Data Protection | ৪. আর্থিক তথ্যের সুরক্ষা |
| `privacyPolicy.sec4Desc` | All deposit and withdrawal transactions use secure Indian banking UPI networks. Wallet balances are segregated into deposited, promotional cashback, and withdrawable winnings to guarantee exact financial reconciliation. | টাকা জমা ও তোলার সকল লেনদেনে নিরাপদ ভারতীয় UPI নেটওয়ার্ক ব্যবহৃত হয়। ওয়ালেটের টাকা ডিপোজিট, ক্যাশব্যাক ও উইনিংসে বিভক্ত থাকে যাতে স্বচ্ছ আর্থিক হিসাব বজায় থাকে। |
| `privacyPolicy.sec5Title` | 5. Account Rights & Deletion | ৫. অ্যাকাউন্টের অধিকার ও মুছে ফেলা |
| `privacyPolicy.sec5Desc` | Players have full rights to inspect their account profile, update mobile or UPI credentials (subject to 30-day anti-tampering cooldowns), and request permanent account deletion by contacting Customer Support. | খেলোয়াড়দের নিজেদের অ্যাকাউন্টের বিবরণ দেখার, মোবাইল বা UPI পরিবর্তন করার (৩০ দিনের অ্যান্টি-ট্যাম্পারিং কুলডাউন প্রযোজ্য) এবং কাস্টমার সাপোর্টের সাথে যোগাযোগ করে অ্যাকাউন্ট স্থায়ীভাবে মুছে ফেলার পূর্ণ অধিকার রয়েছে। |
| `privacyPolicy.questionsTitle` | Questions Regarding Privacy? | গোপনীয়তা সংক্রান্ত কোনো প্রশ্ন আছে? |
| `privacyPolicy.questionsDesc` | If you have inquiries about our privacy policies or data protection measures, contact our grievance team anytime. | আমাদের গোপনীয়তা নীতি বা ডেটা সুরক্ষা ব্যবস্থা সম্পর্কে কোনো প্রশ্ন থাকলে নির্দ্বিধায় আমাদের সাপোর্ট টিমের সাথে যোগাযোগ করুন। |
| `privacyPolicy.contactSupportLink` | Contact Customer Support → | কাস্টমার সাপোর্টে যোগাযোগ করুন → |
| `community.title` | Join Community | কমিউনিটিতে যোগ দিন |
| `community.bannerTitle` | Official Booyah Win Channels | অফিসিয়াল বুয়াহ উইন চ্যানেল |
| `community.bannerDesc` | Stay connected with 50,000+ passionate Free Fire players! Get immediate tournament room notifications, match rules updates, and daily giveaways. | ৫০,০০০+ ফ্রি ফায়ার খেলোয়াড়দের সাথে যুক্ত থাকুন! টুর্নামেন্ট রুমের তাৎক্ষণিক নোটিফিকেশন, নিয়মের আপডেট এবং প্রতিদিনের গিভঅ্যাওয়ে পান। |
| `community.whatsappTitle` | WhatsApp Community | হোয়াটসঅ্যাপ কমিউনিটি |
| `community.whatsappDesc` | Instant match room IDs, password notifications, and match schedules sent directly to your phone. | ম্যাচ রুম আইডি, পাসওয়ার্ডের নোটিফিকেশন এবং টুর্নামেন্টের সময়সূচি সরাসরি আপনার ফোনে পান। |
| `community.joinWhatsapp` | Join WhatsApp | হোয়াটসঅ্যাপে যুক্ত হন |
| `community.instagramTitle` | Instagram Page | ইনস্টাগ্রাম পেজ |
| `community.instagramDesc` | Follow for top plays, daily winner highlights, tournament announcements, and special promo codes. | সেরা গেমপ্লে, বিজয়ীদের তালিকা, টুর্নামেন্টের ঘোষণা এবং বিশেষ প্রোমো কোডের জন্য অনুসরণ করুন। |
| `community.followInstagram` | Follow on Instagram | ইনস্টাগ্রামে ফলো করুন |
| `community.telegramTitle` | Telegram Channel | টেলিগ্রাম চ্যানেল |
| `community.telegramDesc` | Real-time updates, flash scrims, fastest room slots alerts, and community discussions. | রিয়েল-টাইম আপডেট, বিশেষ স্ক্রিম, দ্রুত রুম স্লট সতর্কতা এবং কমিউনিটি আলোচনা। |
| `community.joinTelegram` | Join Telegram | টেলিগ্রামে যুক্ত হন |
| `community.youtubeTitle` | YouTube Channel | ইউটিউব চ্যানেল |
| `community.youtubeDesc` | Watch match highlights, live tournament streams, pro tips, and grand finale showdowns. | ম্যাচের হাইলাইটস, লাইভ টুর্নামেন্ট স্ট্রিম, প্রো টিপস এবং গ্র্যান্ড ফিনালে লাইভ দেখুন। |
| `community.subscribeYoutube` | Subscribe on YouTube | ইউটিউবে সাবস্ক্রাইব করুন |
| `communityPopup.badge` | Player Community | প্লেয়ার কমিউনিটি |
| `communityPopup.title` | Join Our Official Community | আমাদের অফিসিয়াল কমিউনিটিতে যোগ দিন |
| `communityPopup.subtitle` | Connect with 50,000+ Free Fire players! Get instant match room credentials, schedule announcements, and daily giveaways. | ৫০,০০০+ ফ্রি ফায়ার খেলোয়াড়দের সাথে যুক্ত থাকুন! তাৎক্ষণিক রুম আইডি-পাসওয়ার্ড এবং গিভঅ্যাওয়ে পান। |
| `communityPopup.join` | Join | যুক্ত হন |
| `communityPopup.follow` | Follow | ফলো করুন |
| `communityPopup.subscribe` | Subscribe | সাবস্ক্রাইব |
| `communityPopup.maybeLater` | Maybe Later | পরে দেখুন |
| `communityPopup.viewAll` | View Community Page | কমিউনিটি পেজে যান |
| `myStatistics.title` | My Statistics | আমার পরিসংখ্যান |
| `myStatistics.loading` | Loading your match records... | ম্যাচের রেকর্ড লোড হচ্ছে... |
| `myStatistics.overallPerformance` | Overall Performance | সামগ্রিক পারফরম্যান্স |
| `myStatistics.matchesPlayed` | Matches Played | খেলা ম্যাচ |
| `myStatistics.totalKills` | Total Kills | মোট কিল |
| `myStatistics.totalWinnings` | Total Winnings | মোট জয়ী অর্থ |
| `myStatistics.avgKillsPerMatch` | Avg. Kills / Match | গড় কিল / ম্যাচ |
| `myStatistics.recentCompletedMatches` | Recent Completed Matches | সম্প্রতি শেষ হওয়া ম্যাচ |
| `myStatistics.noCompletedMatches` | No Completed Matches Yet | এখনও কোনো ম্যাচ সম্পন্ন হয়নি |
| `myStatistics.noCompletedDesc` | Participate in custom rooms and finish matches to see your kill counts and placement prize breakdown here. | কাস্টম রুমে অংশগ্রহণ করে ম্যাচ শেষ করুন এবং এখানে আপনার কিল সংখ্যা ও পুরস্কারের বিবরণ দেখুন। |
| `myStatistics.exploreMatches` | Explore Matches | ম্যাচসমূহ দেখুন |
| `myStatistics.killsCount` | {count} Kills | {count} টি কিল |
| `myStatistics.rankLabel` | Rank #{rank} | র‌্যাঙ্ক #{rank} |
| `myStatistics.wonLabel` | Won: {amount} | পুরস্কার: {amount} |
| `notifications.title` | Notifications | নোটিফিকেশন |
| `notifications.noNotifications` | No Notifications | কোনো নোটিফিকেশন নেই |
| `notifications.allCaughtUp` | You are all caught up! Match room credentials and tournament updates will appear here. | আপনি সব আপডেট দেখে ফেলেছেন! ম্যাচের রুমের তথ্য এবং টুর্নামেন্ট সংক্রান্ত আপডেট এখানে দেখতে পাবেন। |
| `updates.title` | Important updates | গুরুত্বপূর্ণ আপডেট |
| `updates.filterAll` | All | সকল |
| `updates.filterAnnouncement` | Announcement | ঘোষণা |
| `updates.filterRule` | Rule | নিয়মাবলী |
| `updates.filterAlert` | Alert | সতর্কবার্তা |
| `updates.noUpdatesFound` | No Updates Found | কোনো আপডেট পাওয়া যায়নি |
| `updates.noUpdatesDesc` | There are no announcements currently matching this filter. | এই ক্যাটাগরিতে বর্তমানে কোনো ঘোষণা নেই। |
| `updates.readDetails` | Read Details | বিস্তারিত পড়ুন |
| `updates.officialAnnouncement` | Official Announcement | অফিসিয়াল ঘোষণা |
| `updates.keyInformation` | Key Information & Rules | মূল তথ্য ও নিয়মাবলী |
| `updates.importantNotice` | Important Notice | জরুরি বিজ্ঞপ্তি |
| `updates.exploreMatches` | Explore Matches | ম্যাচসমূহ দেখুন |
| `gameUid.title` | Game UID Details | গেম UID এর বিবরণ |
| `gameUid.identityTitle` | FREE FIRE IN-GAME IDENTITY | ফ্রি ফায়ার ইন-গেম পরিচয় |
| `gameUid.identityDesc` | Ensure your Free Fire UID and in-game name match your Free Fire profile exactly. Match hosts verify these details before starting custom tournament rooms. | নিশ্চিত করুন আপনার ফ্রি ফায়ার UID এবং ইন-গেম নাম আপনার ফ্রি ফায়ার প্রোফাইলের সাথে হুবহু মিল রয়েছে। কাস্টম টুর্নামেন্ট রুম শুরু করার আগে হোস্টরা এই তথ্য যাচাই করে থাকেন। |
| `gameUid.updateTitle` | UPDATE IN-GAME CREDENTIALS | ইন-গেম তথ্য আপডেট করুন |
| `gameUid.ffNameLabel` | Free Fire In-Game Name | ফ্রি ফায়ার ইন-গেম নাম |
| `gameUid.ffIdLabel` | Free Fire UID (Numeric only) | ফ্রি ফায়ার UID (শুধুমাত্র সংখ্যা) |
| `gameUid.editButton` | Edit Credentials | তথ্য পরিবর্তন করুন |
| `gameUid.cancelButton` | Cancel | বাতিল |
| `gameUid.saveButton` | Save Changes | সংরক্ষণ করুন |
| `gameUid.successMsg` | Game UID credentials updated successfully! | গেম UID সফলভাবে আপডেট করা হয়েছে! |
| `profile.credentialsTitle` | ACCOUNT CREDENTIALS | অ্যাকাউন্টের তথ্য |
| `profile.fullNameLabel` | Full Legal Name | সম্পূর্ণ নাম |
| `profile.mobileLabel` | Mobile Number | মোবাইল নম্বর |
| `profile.emailLabel` | Email Address (Verified) | ইমেল ঠিকানা (যাচাইকৃত) |
| `profile.emailNote` | Permanent email linked to your account | আপনার অ্যাকাউন্টের সাথে স্থায়ীভাবে যুক্ত ইমেল |
| `profile.dobLabel` | Date of Birth | জন্ম তারিখ |
| `profile.dobNote` | Permanent date of birth registered with your account | আপনার অ্যাকাউন্টে নিবন্ধিত স্থায়ী জন্ম তারিখ |
| `profile.gameUidSection` | Free Fire In-Game UID & Name | ফ্রি ফায়ার ইন-গেম UID ও নাম |
| `profile.manageGameUid` | Manage Game UID | গেম UID পরিচালনা করুন |
| `profile.upiLabel` | UPI ID (For Withdrawals) | UPI ID (টাকা তোলার জন্য) |
| `profile.cooldownRuleTitle` | 30-Day Modification Rule | ৩০ দিনের পরিবর্তন নিয়ম |
| `profile.cooldownRuleDesc` | Only Name, Mobile, and UPI ID can be changed. Each field can only be updated once every 30 days. | শুধুমাত্র নাম, মোবাইল নম্বর এবং UPI ID পরিবর্তন করা যাবে। প্রতিটি তথ্য প্রতি ৩০ দিনে কেবল একবার পরিবর্তন করা সম্ভব। |
| `profile.editBtn` | Edit Profile | প্রোফাইল এডিট করুন |
| `profile.saveBtn` | Save Changes | সংরক্ষণ করুন |
| `profile.cancelBtn` | Cancel | বাতিল |
| `profile.successMsg` | Profile updated successfully! | প্রোফাইল সফলভাবে আপডেট করা হয়েছে! |
| `account.statsPlayed` | PLAYED | খেলা ম্যাচ |
| `account.statsKills` | KILLS | কিল |
| `account.statsWin` | WIN | জয় |
| `account.guestTitle` | Guest Player | অতিথি খেলোয়াড় |
| `account.guestSubtitle` | Create an account or login to join tournaments, track stats, and win real cash! | টুর্নামেন্টে যোগ দিতে, পরিসংখ্যান দেখতে এবং বাস্তব টাকা জিততে একটি অ্যাকাউন্ট তৈরি করুন বা লগইন করুন! |
| `account.createAccountBtn` | Create Account | অ্যাকাউন্ট তৈরি করুন |
| `account.loginBtn` | Login | লগইন করুন |
| `account.secAccountSettings` | ACCOUNT SETTINGS | অ্যাকাউন্ট সেটিংস |
| `account.secCommunitySupport` | COMMUNITY & SUPPORT | কমিউনিটি ও সাপোর্ট |
| `account.secAboutLegal` | ABOUT & LEGAL | আমাদের সম্পর্কে ও আইনি তথ্য |
| `account.menuMyProfile` | My Profile | আমার প্রোফাইল |
| `account.menuGameUid` | Game UID Details | গেম UID এর বিবরণ |
| `account.menuMyStatistics` | My Statistics | আমার পরিসংখ্যান |
| `account.menuJoinCommunity` | Join Community | কমিউনিটিতে যোগ দিন |
| `account.menuSupport` | Customer Support | কাস্টমার সাপোর্ট |
| `account.menuImportantUpdates` | Important Updates | গুরুত্বপূর্ণ আপডেট |
| `account.menuShareRefer` | Refer App | শেয়ার ও রেফার |
| `account.menuAboutUs` | About Us | আমাদের সম্পর্কে |
| `account.menuPrivacyPolicy` | Privacy Policy | গোপনীয়তা নীতি |
| `account.menuSelectLanguage` | Select Language | ভাষা নির্বাচন করুন |
| `account.menuDownloadApp` | Download App | অফিসিয়াল অ্যান্ড্রয়েড অ্যাপ ডাউনলোড করুন |
| `account.menuLogout` | Log Out | লগআউট |
| `account.logoutModalTitle` | Confirm Log Out | লগআউট নিশ্চিত করুন |
| `account.logoutModalDesc` | Are you sure you want to log out of your Booyah Win account? | আপনি কি নিশ্চিত যে আপনার বুয়াহ উইন অ্যাকাউন্ট থেকে লগআউট করতে চান? |
| `account.cancel` | Cancel | বাতিল |
| `transactionDetail.title` | Transaction Details | লেনদেনের বিবরণ |
| `transactionDetail.creditedTo` | CREDITED TO | জমা হয়েছে |
| `transactionDetail.debitedFrom` | DEBITED FROM | কর্তন হয়েছে |
| `transactionDetail.targetWallet` | Target Wallet | টার্গেট ওয়ালেট |
| `transactionDetail.sourceWallet` | Source Wallet | উৎস ওয়ালেট |
| `transactionDetail.moneySplit` | Money Split: | টাকার বিভাজন: |
| `transactionDetail.balanceAfter` | Balance After Transaction | লেনদেনের পর ব্যালেন্স |
| `transactionDetail.txnId` | Transaction ID | লেনদেন আইডি |
| `transactionDetail.timestamp` | Timestamp | তারিখ ও সময় |
| `transactionDetail.refType` | Reference Type | রেফারেন্সের ধরন |
| `transactionDetail.depositReceipt` | Deposit Receipt & UTR | জমার রশিদ ও UTR |
| `transactionDetail.screenshot` | Screenshot | স্ক্রিনশট |
| `transactionDetail.utrRef` | UTR / Reference | UTR / রেফারেন্স |
| `transactionDetail.status` | Status | স্ট্যাটাস |
| `transactionDetail.reviewedBy` | Reviewed By | পর্যালোচক |
| `transactionDetail.rejectionReason` | Rejection Reason | বাতিলের কারণ |
| `transactionDetail.withdrawalDetails` | Withdrawal Details | উত্তোলনের বিবরণ |
| `transactionDetail.payoutRef` | Payout Reference | পেআউট রেফারেন্স |
| `transactionDetail.beneficiaryUpi` | Beneficiary UPI ID | প্রাপকের UPI ID |
| `transactionDetail.needHelp` | Need help with this transaction? | এই লেনদেন সম্পর্কে সাহায্য প্রয়োজন? |
| `transactionDetail.contactSupport` | Contact Support | সাপোর্টে যোগাযোগ করুন |
| `transactionDetail.refTournamentMatch` | Tournament Match | টুর্নামেন্ট ম্যাচ |
| `transactionDetail.refDeposit` | Deposit | জমা |
| `transactionDetail.refWithdrawal` | Withdrawal | উত্তোলন |
| `transactionDetail.refReferral` | Referral | রেফারেল |
| `transactionDetail.refJoiningReward` | Joining Reward | জয়েনিং রিওয়ার্ড |
| `transactionDetail.refAdjustment` | Adjustment | সমন্বয় |
| `transactionDetail.refWithdrawalRefund` | Withdrawal Refund | উত্তোলন ফেরত |
| `transactionDetail.refResultReversal` | Result Reversal | ফলাফল প্রত্যাবর্তন |
| `transactionDetail.refFeeRefund` | Fee Refund | ফি ফেরত |
| `transactionDetail.statusSuccessful` | Successful | সফল |
| `transactionDetail.statusPendingReview` | Pending Review | পর্যালোচনাধীন |
| `transactionDetail.statusRejected` | Rejected | বাতিল |
| `transactionDetail.statusCancelled` | Cancelled | বাতিলকৃত |
| `referral.backToAccount` | Back to Account | অ্যাকাউন্টে ফিরে যান |
| `auth.didntReceiveCode` | Didn't receive code? | কোড পাননি? |
| `updates.understand` | I Understand & Agree | আমি বুঝতে পেরেছি ও সম্মত |
| `gameUid.cooldownNotice` | Note: Changing your Free Fire details triggers a 30-day security cooldown. Changes are blocked while enrolled in an upcoming or live match. | দ্রষ্টব্য: ফ্রি ফায়ার বিবরণ পরিবর্তন করলে ৩০ দিনের সিকিউরিটি কুলডাউন প্রযোজ্য হবে। চলমান বা আসন্ন ম্যাচে অংশগ্রহণকালে পরিবর্তন করা যাবে না। |
| `myStatistics.perMatch` | match | ম্যাচ |
| `matches.tabUpcoming` | Upcoming | আসন্ন |
| `matches.tabLive` | Live | লাইভ |
| `matches.tabMyMatches` | My Matches | আমার ম্যাচ |
| `matches.tabCompleted` | Completed | সম্পন্ন |
| `matches.join` | Join | যোগ দিন |
| `matches.entry` | Entry | এন্ট্রি |
| `matches.noJoinedMatches` | No Joined Matches | কোনো যুক্ত ম্যাচ নেই |
| `matches.noJoinedMatchesDesc` | You haven't joined any matches yet. Browse Upcoming matches to join and compete! | আপনি এখনো কোনো ম্যাচে যোগ দেননি। প্রতিযোগিতা করতে আসন্ন ম্যাচগুলি দেখুন! |
