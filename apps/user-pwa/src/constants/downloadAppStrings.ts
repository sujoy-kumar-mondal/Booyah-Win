/**
 * Download App & Installation Help user-facing strings
 *
 * Requirements:
 * - All text goes through a single constants file so it can be translated later.
 * - Button must be labelled exactly "Download App".
 */

export const DOWNLOAD_APP_STRINGS = {
  bannerTitle: 'Booyah Win for Android',
  bannerSubtitle: 'Official APK for faster gameplay & instant match alerts',
  downloadButton: 'Download App',
  installHelpButton: 'Installation help',
  dismissAriaLabel: 'Dismiss download app banner',

  // Installation Help Modal
  dialogTitle: 'How to Install on Android',
  dialogSubtitle: 'Official guide to installing the Booyah Win APK safely',
  step1Title: '1. Download the APK',
  step1Desc:
    'Tap "Download App". If your browser displays "File might be harmful", tap "Download anyway". This is a standard Android prompt for apps downloaded outside Google Play.',
  step2Title: '2. Allow Installation',
  step2Desc:
    'Open the downloaded file from your notifications or Downloads folder. If prompted, tap "Settings" and enable "Allow from this source", then return and tap "Install".',
  step3Title: '3. Google Play Protect Warning',
  step3Desc:
    'If Google Play Protect warns that the app is unrecognized, tap "More details" followed by "Install anyway". Our APK is 100% verified, virus-free, and safe.',
  safetyWarningTitle: 'Official Source Warning',
  safetyWarningDesc:
    'The APK file should come ONLY from this official site. Never download or accept Booyah Win APK files from third-party links, Telegram, or WhatsApp.',
  versionLabel: 'Version',
  checksumLabel: 'SHA-256 Checksum',
  checksumCopied: 'Copied!',
  copyChecksum: 'Copy Checksum',
  closeDialog: 'Got It',
} as const;
