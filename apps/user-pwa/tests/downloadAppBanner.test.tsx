import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  isEligibleAndroidBrowser,
  isValidHttpsDownloadUrl,
  dismissDownloadBanner,
  isBannerDismissed,
  DOWNLOAD_BANNER_STORAGE_KEY,
  DISMISSAL_DURATION_MS,
} from '../src/utils/deviceDetection.js';
import { DownloadAppBanner } from '../src/components/common/DownloadAppBanner.js';
import { InstallationHelpModal } from '../src/components/common/InstallationHelpModal.js';
import { DOWNLOAD_APP_STRINGS } from '../src/constants/downloadAppStrings.js';
import { Landing } from '../src/pages/Landing.js';
import { Login } from '../src/pages/Login.js';
import { Register } from '../src/pages/Register.js';
import { Profile } from '../src/pages/Profile.js';
import { AuthProvider } from '../src/context/AuthContext.js';
import { MaintenanceProvider } from '../src/context/MaintenanceContext.js';

// Sample User Agents
const ANDROID_CHROME_UA =
  'Mozilla/5.0 (Linux; Android 13; SM-S908B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.5790.166 Mobile Safari/537.36';
const ANDROID_FIREFOX_UA =
  'Mozilla/5.0 (Android 13; Mobile; rv:109.0) Gecko/115.0 Firefox/115.0';
const ANDROID_WEBVIEW_UA_1 =
  'Mozilla/5.0 (Linux; U; Android 13; en-us; SM-G998B Build/TP1A.220624.014; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/115.0.0.0 Mobile Safari/537.36';
const ANDROID_WEBVIEW_UA_2 =
  'Mozilla/5.0 (Linux; Android 10; SM-A205U; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/88.0.4324.93 Mobile Safari/537.36';
const IPHONE_SAFARI_UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 16_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.5 Mobile/15E148 Safari/604.1';
const IPAD_SAFARI_UA =
  'Mozilla/5.0 (iPad; CPU OS 16_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.5 Mobile/15E148 Safari/604.1';
const WINDOWS_CHROME_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36';
const MAC_SAFARI_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.5 Safari/605.1.15';
const LINUX_FIREFOX_UA =
  'Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:109.0) Gecko/20100101 Firefox/115.0';

const VALID_HTTPS_URL = 'https://github.com/booyah-win/app/releases/download/v1.0.0/booyah-win.apk';

describe('Player Website Download App Banner & Installation Help', () => {
  let queryClient: QueryClient;
  const originalEnv = { ...import.meta.env };

  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    vi.restoreAllMocks();

    document.body.innerHTML = `
      <div id="root"></div>
      <div id="modal-root"></div>
    `;

    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    // Default valid download url in import.meta.env for banner tests
    (import.meta.env as any).VITE_APP_DOWNLOAD_URL = VALID_HTTPS_URL;
    (import.meta.env as any).VITE_APP_VERSION = 'v1.0.0';
    (import.meta.env as any).VITE_APP_SHA256 =
      'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';
  });

  afterEach(() => {
    (import.meta.env as any).VITE_APP_DOWNLOAD_URL = originalEnv.VITE_APP_DOWNLOAD_URL;
    (import.meta.env as any).VITE_APP_VERSION = originalEnv.VITE_APP_VERSION;
    (import.meta.env as any).VITE_APP_SHA256 = originalEnv.VITE_APP_SHA256;
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // 1. VISIBILITY MATRIX
  // ─────────────────────────────────────────────────────────────────────────────
  describe('1. Device and Environment Visibility Matrix', () => {
    it('shows banner to Android browser visitors (Chrome / Firefox)', () => {
      const eligibleChrome = isEligibleAndroidBrowser({
        userAgent: ANDROID_CHROME_UA,
        referrer: '',
        isStandalone: false,
        downloadUrl: VALID_HTTPS_URL,
      });
      expect(eligibleChrome).toBe(true);

      const eligibleFirefox = isEligibleAndroidBrowser({
        userAgent: ANDROID_FIREFOX_UA,
        referrer: '',
        isStandalone: false,
        downloadUrl: VALID_HTTPS_URL,
      });
      expect(eligibleFirefox).toBe(true);
    });

    it('hides banner inside installed PWA (display-mode: standalone)', () => {
      const eligible = isEligibleAndroidBrowser({
        userAgent: ANDROID_CHROME_UA,
        referrer: '',
        isStandalone: true,
        downloadUrl: VALID_HTTPS_URL,
      });
      expect(eligible).toBe(false);

      // Verify rendering
      const { container } = render(
        <DownloadAppBanner
          detectionOptions={{
            userAgent: ANDROID_CHROME_UA,
            referrer: '',
            isStandalone: true,
            downloadUrl: VALID_HTTPS_URL,
          }}
        />
      );
      expect(container.firstChild).toBeNull();
      expect(screen.queryByTestId('download-app-banner')).not.toBeInTheDocument();
    });

    it('hides banner inside Trusted Web Activity (TWA: document.referrer starts with android-app://)', () => {
      const eligible = isEligibleAndroidBrowser({
        userAgent: ANDROID_CHROME_UA,
        referrer: 'android-app://com.booyahwin.twa',
        isStandalone: false,
        downloadUrl: VALID_HTTPS_URL,
      });
      expect(eligible).toBe(false);

      const { container } = render(
        <DownloadAppBanner
          detectionOptions={{
            userAgent: ANDROID_CHROME_UA,
            referrer: 'android-app://com.booyahwin.twa',
            isStandalone: false,
            downloadUrl: VALID_HTTPS_URL,
          }}
        />
      );
      expect(container.firstChild).toBeNull();
      expect(screen.queryByTestId('download-app-banner')).not.toBeInTheDocument();
    });

    it('hides banner inside common WebViews (user agent contains "wv")', () => {
      expect(
        isEligibleAndroidBrowser({
          userAgent: ANDROID_WEBVIEW_UA_1,
          referrer: '',
          isStandalone: false,
          downloadUrl: VALID_HTTPS_URL,
        })
      ).toBe(false);

      expect(
        isEligibleAndroidBrowser({
          userAgent: ANDROID_WEBVIEW_UA_2,
          referrer: '',
          isStandalone: false,
          downloadUrl: VALID_HTTPS_URL,
        })
      ).toBe(false);

      const { container } = render(
        <DownloadAppBanner
          detectionOptions={{
            userAgent: ANDROID_WEBVIEW_UA_1,
            referrer: '',
            isStandalone: false,
            downloadUrl: VALID_HTTPS_URL,
          }}
        />
      );
      expect(container.firstChild).toBeNull();
      expect(screen.queryByTestId('download-app-banner')).not.toBeInTheDocument();
    });

    it('hides banner on iOS devices (iPhone and iPad)', () => {
      expect(
        isEligibleAndroidBrowser({
          userAgent: IPHONE_SAFARI_UA,
          referrer: '',
          isStandalone: false,
          downloadUrl: VALID_HTTPS_URL,
        })
      ).toBe(false);

      expect(
        isEligibleAndroidBrowser({
          userAgent: IPAD_SAFARI_UA,
          referrer: '',
          isStandalone: false,
          downloadUrl: VALID_HTTPS_URL,
        })
      ).toBe(false);

      const { container } = render(
        <DownloadAppBanner
          detectionOptions={{
            userAgent: IPHONE_SAFARI_UA,
            referrer: '',
            isStandalone: false,
            downloadUrl: VALID_HTTPS_URL,
          }}
        />
      );
      expect(container.firstChild).toBeNull();
    });

    it('hides banner on desktop browsers (Windows, Mac, Linux)', () => {
      expect(
        isEligibleAndroidBrowser({
          userAgent: WINDOWS_CHROME_UA,
          referrer: '',
          isStandalone: false,
          downloadUrl: VALID_HTTPS_URL,
        })
      ).toBe(false);

      expect(
        isEligibleAndroidBrowser({
          userAgent: MAC_SAFARI_UA,
          referrer: '',
          isStandalone: false,
          downloadUrl: VALID_HTTPS_URL,
        })
      ).toBe(false);

      expect(
        isEligibleAndroidBrowser({
          userAgent: LINUX_FIREFOX_UA,
          referrer: '',
          isStandalone: false,
          downloadUrl: VALID_HTTPS_URL,
        })
      ).toBe(false);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // 2. DOWNLOAD URL VALIDATION MATRIX
  // ─────────────────────────────────────────────────────────────────────────────
  describe('2. Download URL Validation Matrix', () => {
    it('validates HTTPS download URLs strictly', () => {
      expect(isValidHttpsDownloadUrl(VALID_HTTPS_URL)).toBe(true);
      expect(isValidHttpsDownloadUrl('https://example.com/app.apk')).toBe(true);

      // Must reject non-HTTPS protocols
      expect(isValidHttpsDownloadUrl('http://insecure.example.com/app.apk')).toBe(false);
      expect(isValidHttpsDownloadUrl('ftp://example.com/app.apk')).toBe(false);
      expect(isValidHttpsDownloadUrl('file:///android_asset/app.apk')).toBe(false);

      // Must reject missing, empty, or malformed strings
      expect(isValidHttpsDownloadUrl(undefined)).toBe(false);
      expect(isValidHttpsDownloadUrl(null)).toBe(false);
      expect(isValidHttpsDownloadUrl('')).toBe(false);
      expect(isValidHttpsDownloadUrl('   ')).toBe(false);
      expect(isValidHttpsDownloadUrl('not-a-valid-url')).toBe(false);
    });

    it('never shows banner when download URL is missing or invalid', () => {
      // Missing / undefined URL
      expect(
        isEligibleAndroidBrowser({
          userAgent: ANDROID_CHROME_UA,
          downloadUrl: undefined,
        })
      ).toBe(false);

      // Insecure HTTP URL
      expect(
        isEligibleAndroidBrowser({
          userAgent: ANDROID_CHROME_UA,
          downloadUrl: 'http://example.com/download.apk',
        })
      ).toBe(false);

      // Empty string
      expect(
        isEligibleAndroidBrowser({
          userAgent: ANDROID_CHROME_UA,
          downloadUrl: '',
        })
      ).toBe(false);

      // Render check with invalid URL
      const { container } = render(
        <DownloadAppBanner
          detectionOptions={{
            userAgent: ANDROID_CHROME_UA,
            downloadUrl: 'http://example.com/download.apk',
          }}
        />
      );
      expect(container.firstChild).toBeNull();
      expect(screen.queryByTestId('download-app-banner')).not.toBeInTheDocument();
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // 3. DISMISSAL AND 7-DAY EXPIRY
  // ─────────────────────────────────────────────────────────────────────────────
  describe('3. Banner Dismissal and 7-Day Expiry', () => {
    it('clicking dismiss button stores 7-day expiration in localStorage and hides banner immediately', () => {
      const fixedNow = 1700000000000;
      vi.spyOn(Date, 'now').mockReturnValue(fixedNow);

      render(
        <DownloadAppBanner
          detectionOptions={{
            userAgent: ANDROID_CHROME_UA,
            referrer: '',
            isStandalone: false,
            downloadUrl: VALID_HTTPS_URL,
            now: fixedNow,
          }}
        />
      );

      const banner = screen.getByTestId('download-app-banner');
      expect(banner).toBeInTheDocument();

      const dismissBtn = screen.getByTestId('dismiss-banner-btn');
      act(() => {
        fireEvent.click(dismissBtn);
      });

      // Banner must be removed from DOM
      expect(screen.queryByTestId('download-app-banner')).not.toBeInTheDocument();

      // Check localStorage entry
      const stored = localStorage.getItem(DOWNLOAD_BANNER_STORAGE_KEY);
      expect(stored).toBe(String(fixedNow + DISMISSAL_DURATION_MS));
      expect(isBannerDismissed(fixedNow + 1000)).toBe(true);
    });

    it('keeps banner hidden during 7 days, but re-displays after 7 days have elapsed', () => {
      const startTime = 1700000000000;
      dismissDownloadBanner(startTime);

      // 6 days later: still dismissed
      const sixDaysLater = startTime + 6 * 24 * 60 * 60 * 1000;
      expect(
        isEligibleAndroidBrowser({
          userAgent: ANDROID_CHROME_UA,
          referrer: '',
          isStandalone: false,
          downloadUrl: VALID_HTTPS_URL,
          now: sixDaysLater,
        })
      ).toBe(false);

      // 7 days later minus 1 second: still dismissed
      const sevenDaysMinus1s = startTime + DISMISSAL_DURATION_MS - 1000;
      expect(
        isEligibleAndroidBrowser({
          userAgent: ANDROID_CHROME_UA,
          referrer: '',
          isStandalone: false,
          downloadUrl: VALID_HTTPS_URL,
          now: sevenDaysMinus1s,
        })
      ).toBe(false);

      // 7 days later plus 1 second: expiry elapsed -> banner eligible again!
      const sevenDaysPlus1s = startTime + DISMISSAL_DURATION_MS + 1000;
      expect(
        isEligibleAndroidBrowser({
          userAgent: ANDROID_CHROME_UA,
          referrer: '',
          isStandalone: false,
          downloadUrl: VALID_HTTPS_URL,
          now: sevenDaysPlus1s,
        })
      ).toBe(true);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // 4. BANNER BUTTON, ATTRIBUTES, ACCESSIBILITY & HELP DIALOG
  // ─────────────────────────────────────────────────────────────────────────────
  describe('4. Banner Attributes, Accessibility, and Installation Help Dialog', () => {
    it('renders button labelled exactly "Download App" with rel="noopener noreferrer"', () => {
      render(
        <DownloadAppBanner
          detectionOptions={{
            userAgent: ANDROID_CHROME_UA,
            referrer: '',
            isStandalone: false,
            downloadUrl: VALID_HTTPS_URL,
          }}
        />
      );

      const downloadBtn = screen.getByTestId('download-app-btn');
      expect(downloadBtn).toBeInTheDocument();
      // Button labelled exactly "Download App"
      expect(downloadBtn.textContent).toContain('Download App');
      expect(DOWNLOAD_APP_STRINGS.downloadButton).toBe('Download App');

      // Attributes
      expect(downloadBtn).toHaveAttribute('href', VALID_HTTPS_URL);
      expect(downloadBtn).toHaveAttribute('rel', 'noopener noreferrer');
      expect(downloadBtn).toHaveAttribute('target', '_blank');

      // Dismiss button has accessible aria-label
      const dismissBtn = screen.getByTestId('dismiss-banner-btn');
      expect(dismissBtn).toHaveAttribute('aria-label', DOWNLOAD_APP_STRINGS.dismissAriaLabel);
    });

    it('opens accessible Installation Help dialog with steps, Play Protect warning, and safety warning (without Version or Checksum)', async () => {
      const rootEl = document.getElementById('root')!;
      const modalRootEl = document.getElementById('modal-root')!;

      render(
        <DownloadAppBanner
          detectionOptions={{
            userAgent: ANDROID_CHROME_UA,
            referrer: '',
            isStandalone: false,
            downloadUrl: VALID_HTTPS_URL,
          }}
        />,
        { container: rootEl }
      );

      const helpBtn = screen.getByTestId('install-help-btn');
      expect(helpBtn).toHaveTextContent(DOWNLOAD_APP_STRINGS.installHelpButton);

      // Modal not yet rendered
      expect(screen.queryByTestId('installation-help-modal')).not.toBeInTheDocument();

      // Click to open help dialog
      act(() => {
        fireEvent.click(helpBtn);
      });

      // 1. Rendered inside #modal-root via createPortal, not inside #root
      const modal = screen.getByTestId('installation-help-modal');
      expect(modalRootEl.contains(modal)).toBe(true);
      expect(rootEl.contains(modal)).toBe(false);

      // 2. #root gets inert attribute for focus trapping
      expect(rootEl.hasAttribute('inert')).toBe(true);

      // 3. Dialog role and accessibility attributes
      expect(modal).toHaveAttribute('role', 'dialog');
      expect(modal).toHaveAttribute('aria-modal', 'true');
      expect(modal).toHaveAttribute('aria-labelledby', 'installation-help-title');

      // 4. Simple steps and explanations present
      expect(screen.getByText(DOWNLOAD_APP_STRINGS.dialogTitle)).toBeInTheDocument();
      expect(screen.getByText(DOWNLOAD_APP_STRINGS.step1Title)).toBeInTheDocument();
      expect(screen.getByText(DOWNLOAD_APP_STRINGS.step2Title)).toBeInTheDocument();
      expect(screen.getByText(DOWNLOAD_APP_STRINGS.step3Title)).toBeInTheDocument(); // Play Protect warning explanation
      expect(screen.getByText(DOWNLOAD_APP_STRINGS.safetyWarningTitle)).toBeInTheDocument(); // Official source warning
      expect(screen.getByText(DOWNLOAD_APP_STRINGS.safetyWarningDesc)).toBeInTheDocument();

      // 5. Version and Checksum are NOT rendered per user requirement
      expect(screen.queryByTestId('installation-help-version')).not.toBeInTheDocument();
      expect(screen.queryByTestId('installation-help-checksum')).not.toBeInTheDocument();
      expect(screen.queryByTestId('copy-checksum-btn')).not.toBeInTheDocument();

      // 6. Close dialog via primary close button
      const closeBtn = screen.getByTestId('installation-help-close-btn');
      act(() => {
        fireEvent.click(closeBtn);
      });

      expect(screen.queryByTestId('installation-help-modal')).not.toBeInTheDocument();
      expect(rootEl.hasAttribute('inert')).toBe(false);
    });

    it('closes Installation Help dialog on Escape key press', () => {
      const rootEl = document.getElementById('root')!;

      render(
        <InstallationHelpModal
          isOpen={true}
          onClose={vi.fn()}
        />,
        { container: rootEl }
      );

      const modal = screen.getByTestId('installation-help-modal');
      expect(modal).toBeInTheDocument();

      // Fire Escape key
      fireEvent.keyDown(window, { key: 'Escape' });
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // 5. SCREEN PLACEMENT & NO LAYOUT OVERLAP
  // ─────────────────────────────────────────────────────────────────────────────
  describe('5. Screen Placement & Profile Download Button', () => {
    it('is mounted at the top of Landing page and does not overlap bottom navigation', async () => {
      // Mock Android browser user agent
      vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue(ANDROID_CHROME_UA);

      render(
        <QueryClientProvider client={queryClient}>
          <MemoryRouter>
            <AuthProvider>
              <MaintenanceProvider>
                <Landing />
              </MaintenanceProvider>
            </AuthProvider>
          </MemoryRouter>
        </QueryClientProvider>
      );

      const landingPage = screen.getByTestId('landing-page');
      expect(landingPage).toBeInTheDocument();

      const banner = screen.getByTestId('download-app-banner');
      expect(banner).toBeInTheDocument();

      // Verify the banner is the first child inside landing page, positioned well above hero content
      expect(landingPage.firstChild).toBe(banner);
    });

    it('is NOT shown on Login page per user configuration', () => {
      vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue(ANDROID_CHROME_UA);

      render(
        <QueryClientProvider client={queryClient}>
          <MemoryRouter>
            <AuthProvider>
              <Login />
            </AuthProvider>
          </MemoryRouter>
        </QueryClientProvider>
      );

      expect(screen.queryByTestId('download-app-banner')).not.toBeInTheDocument();
    });

    it('is NOT shown on Registration page per user configuration', () => {
      vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue(ANDROID_CHROME_UA);

      render(
        <QueryClientProvider client={queryClient}>
          <MemoryRouter>
            <AuthProvider>
              <Register />
            </AuthProvider>
          </MemoryRouter>
        </QueryClientProvider>
      );

      expect(screen.queryByTestId('download-app-banner')).not.toBeInTheDocument();
    });

    it('renders a permanent download button in Profile section for logged-in users', () => {
      // Set test user in localStorage to simulate logged-in session
      localStorage.setItem('auth_token', 'mock_token_123');
      localStorage.setItem(
        'auth_user',
        JSON.stringify({
          id: 'u1',
          name: 'Player One',
          email: 'player@example.com',
          mobile: '9876543210',
          ffId: '1234567890',
          ffName: 'ProPlayer',
          upiId: 'player@upi',
          walletBalancePaise: 50000,
          bonusBalancePaise: 10000,
          kycStatus: 'verified',
        })
      );

      render(
        <QueryClientProvider client={queryClient}>
          <MemoryRouter>
            <AuthProvider>
              <Profile />
            </AuthProvider>
          </MemoryRouter>
        </QueryClientProvider>
      );

      const downloadSection = screen.getByTestId('profile-download-app-section');
      expect(downloadSection).toBeInTheDocument();

      const profileDownloadBtn = screen.getByTestId('profile-download-app-btn');
      expect(profileDownloadBtn).toBeInTheDocument();
      expect(profileDownloadBtn).toHaveAttribute('href', VALID_HTTPS_URL);
      expect(profileDownloadBtn).toHaveAttribute('rel', 'noopener noreferrer');
      expect(profileDownloadBtn).toHaveAttribute('target', '_blank');
      expect(profileDownloadBtn.textContent).toContain('Download App');
    });
  });
});
