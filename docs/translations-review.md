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
| `nav.home` | Home | হোম |
| `nav.matches` | Matches | ম্যাচ |
| `nav.wallet` | Wallet | ওয়ালেট |
| `nav.leaderboard` | Leaderboard | লিডারবোর্ড |
| `nav.profile` | Profile | প্রোফাইল |
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
| `auth.requestOtp` | Request OTP | OTP অনুরোধ করুন |
| `auth.requestingOtp` | Sending OTP... | OTP পাঠানো হচ্ছে... |
| `auth.verifyOtp` | Verify OTP | OTP যাচাই করুন |
| `auth.verifyingOtp` | Verifying... | যাচাই করা হচ্ছে... |
| `auth.enterOtp` | Enter 6-Digit OTP | ৬-সংখ্যার OTP লিখুন |
| `auth.otpSentMessage` | We sent a 6-digit code to | আমরা একটি ৬-সংখ্যার কোড পাঠিয়েছি এখানে: |
| `auth.changeEmail` | Change Email | ইমেইল পরিবর্তন করুন |
| `auth.resendOtp` | Resend OTP | OTP পুনরায় পাঠান |
| `auth.resendIn` | Resend OTP in | OTP পুনরায় পাঠানোর সময় বাকি |
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
| `auth.referralCodePlaceholder` | Enter 8-character referral code | ৮-সংখ্যার রেফারেল কোড লিখুন |
| `auth.completeRegistration` | Complete Registration | নিবন্ধন সম্পন্ন করুন |
| `auth.completingRegistration` | Setting up your account... | আপনার অ্যাকাউন্ট তৈরি করা হচ্ছে... |
| `auth.alreadyHaveAccount` | Already registered? | ইতিমধ্যেই অ্যাকাউন্ট আছে? |
| `auth.dontHaveAccount` | Don't have an account? | কোনো অ্যাকাউন্ট নেই? |
| `auth.loginLink` | Login here | এখানে লগইন করুন |
| `auth.registerLink` | Register here | এখানে নিবন্ধন করুন |
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
| `matches.spotsLeft` | Spots Left | আসন বাকি |
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
| `matches.teamNamePlaceholder` | Enter team name | দলের নাম লিখুন |
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
| `wallet.unutilized` | Add Money Balance | জমা ব্যালেন্স |
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
| `wallet.withdrawCooldownNotice` | Withdrawals are locked for 48 hours after updating your registered UPI ID. | নিবন্ধিত UPI ID পরিবর্তনের পর নিরাপত্তার স্বার্থে ৪৮ ঘণ্টার জন্য উত্তোলন স্থগিত থাকে। |
| `wallet.submitWithdrawal` | Request Withdrawal | উত্তোলনের অনুরোধ করুন |
| `wallet.submittingWithdrawal` | Processing request... | অনুরোধ প্রক্রিয়া করা হচ্ছে... |
| `wallet.noTransactions` | No wallet transactions recorded yet. | এখনও পর্যন্ত কোনো লেনদেনের তথ্য নেই। |
| `wallet.noRequests` | No active deposit or withdrawal requests. | কোনো সক্রিয় জমা বা উত্তোলনের অনুরোধ নেই। |
| `leaderboard.title` | Leaderboards | লিডারবোর্ড |
| `leaderboard.subtitle` | Top Free Fire players ranked by tournament winnings | টুর্নামেন্টের উইনিংসের ভিত্তিতে সেরা Free Fire খেলোয়াড়দের তালিকা |
| `leaderboard.weeklyTab` | Weekly Ranks | সাপ্তাহিক র্যাঙ্ক |
| `leaderboard.monthlyTab` | Monthly Ranks | মাসিক র্যাঙ্ক |
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
| `profile.uploadPhoto` | Upload Photo | ছবি আপলোড করুন |
| `profile.removePhoto` | Remove Photo | ছবি সরিয়ে ফেলুন |
| `profile.photoRequirements` | JPEG, PNG, or WebP up to 2 MB. | সর্বোচ্চ ২ MB সাইজের JPEG, PNG বা WebP ছবি। |
| `profile.fullName` | Full Name | পুরো নাম |
| `profile.email` | Email Address | ইমেইল ঠিকানা |
| `profile.emailUnchangeable` | Email cannot be changed after registration. | নিবন্ধনের পর ইমেইল পরিবর্তন করা যাবে না। |
| `profile.mobile` | Mobile Number | মোবাইল নম্বর |
| `profile.ffId` | Free Fire UID | Free Fire UID |
| `profile.ffName` | In-Game Name | ইন-গেম নাম |
| `profile.upiId` | Payout UPI ID | উত্তোলনের UPI ID |
| `profile.dateOfBirth` | Date of Birth | জন্ম তারিখ |
| `profile.referralCode` | My Referral Code | আমার রেফারেল কোড |
| `profile.languagePreferenceTitle` | Language Preference | ভাষার পছন্দ |
| `profile.languagePreferenceSubtitle` | Choose your preferred language for the application | অ্যাপ্লিকেশনে আপনার পছন্দের ভাষা নির্বাচন করুন |
| `profile.cooldownWarning` | Profile fields (Mobile, Free Fire UID, In-Game Name, UPI ID) can only be updated once every 30 days. | প্রোফাইলের তথ্য (মোবাইল, Free Fire UID, ইন-গেম নাম, UPI ID) প্রতি ৩০ দিনে কেবল একবার পরিবর্তন করা যাবে। |
| `profile.upiLockWarning` | Changing your UPI ID locks withdrawals for 48 hours for security. | নিরাপত্তার স্বার্থে UPI ID পরিবর্তন করলে পরবর্তী ৪৮ ঘণ্টার জন্য উত্তোলন বন্ধ থাকবে। |
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
| `install.howToInstall` | Installation Guide | ইনস্টলেশন নির্দেশিকা |
| `install.chromeStep1` | 1. Tap the browser menu (three dots in top right). | ১. ব্রাউজার মেনুতে ট্যাপ করুন (উপরে ডানদিকের তিনটি বিন্দু)। |
| `install.chromeStep2` | 2. Select 'Install app' or 'Add to Home screen'. | ২. 'Install app' বা 'Add to Home screen' নির্বাচন করুন। |
| `install.chromeStep3` | 3. Open Booyah Win directly from your home screen. | ৩. সরাসরি আপনার হোম স্ক্রিন থেকে Booyah Win ওপেন করুন। |
| `terms.modalTitle` | Terms of Service | ব্যবহারের শর্তাবলী |
| `terms.modalPlaceholder` | By using Booyah Win, you agree that you are at least 18 years of age and reside in an Indian state where skill-based gaming is legally permitted. Cheating, team-teaming, or exploiting game glitches will result in immediate disqualification and permanent ban without refund. Winnings are disbursed via UPI subject to proof verification. | Booyah Win ব্যবহার করে আপনি সম্মত হচ্ছেন যে আপনার বয়স কমপক্ষে ১৮ বছর এবং আপনি এমন একটি ভারতীয় রাজ্যে বাস করেন যেখানে দক্ষতাভিত্তিক গেমিং আইনত অনুমোদিত। চিটিং, টিমিং বা গেমের ত্রুতির অন্যায্য সুযোগ নিলে কোনো রিফান্ড ছাড়াই তাৎক্ষণিক বহিষ্কার ও স্থায়ীভাবে নিষিদ্ধ করা হবে। প্রমাণ যাচাই সাপেক্ষে UPI-এর মাধ্যমে পুরস্কার প্রদান করা হয়। |
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
| `errors.UPI_RECENTLY_CHANGED` | Withdrawals are locked for 48 hours following a UPI ID change. | UPI ID পরিবর্তনের পর ৪৮ ঘণ্টার জন্য উত্তোলন বন্ধ থাকে। |
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
