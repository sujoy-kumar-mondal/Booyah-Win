import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { LanguageProvider, useTranslation } from '../src/i18n/LanguageContext.js';
import { AuthProvider, useAuth } from '../src/context/AuthContext.js';
import { Profile } from '../src/pages/Profile.js';
import { Landing } from '../src/pages/Landing.js';
import * as userApi from '../src/api/user.js';
import { setStoredToken, clearStoredToken } from '../src/api/client.js';
import { getLanguageCookie } from '../src/i18n/cookies.js';

describe('Requirement 2 & 7: Server Language Sync, Login Rules & Instant Switching', () => {
  const mockUserFixture = (lang: 'en' | 'bn' = 'en') => ({
    profile: {
      id: 'usr-123',
      name: 'Test Player',
      email: 'test@example.com',
      mobile: '9876543210',
      ffId: '12345678',
      ffName: 'Player1',
      upiId: 'test@upi',
      dateOfBirth: '2000-01-01',
      referralCode: 'REF123',
      referredBy: null,
      avatarUrl: null,
      language: lang,
    },
    wallets: {
      addMoney: '50.00',
      cashback: '10.00',
      winning: '100.00',
      total: '160.00',
    },
    cooldowns: {
      mobileAvailableAt: null,
      ffIdAvailableAt: null,
      ffNameAvailableAt: null,
      upiIdAvailableAt: null,
    },
  });

  beforeEach(() => {
    vi.restoreAllMocks();
    document.cookie = 'bw_lang=; Max-Age=0; Path=/';
    document.documentElement.lang = 'en';
    setStoredToken('test-jwt-token');
  });

  afterEach(() => {
    document.cookie = 'bw_lang=; Max-Age=0; Path=/';
    document.documentElement.lang = 'en';
    clearStoredToken();
    vi.restoreAllMocks();
  });

  describe('Login Rule: Server vs Cookie Sync', () => {
    it('applies server language when no cookie exists on login', async () => {
      expect(getLanguageCookie()).toBeNull();

      vi.spyOn(userApi, 'getMe').mockResolvedValue(mockUserFixture('bn') as any);
      const updateLangSpy = vi.spyOn(userApi, 'updateUserLanguage').mockResolvedValue({ success: true } as any);

      // Component that triggers login on mount
      const TestLoginConsumer: React.FC = () => {
        const { login } = useAuth();
        const { language } = useTranslation();
        return (
          <div>
            <span data-testid="current-lang">{language}</span>
            <button
              data-testid="trigger-login-btn"
              onClick={() => login('mock-token', mockUserFixture('bn').profile as any)}
            >
              Trigger Login
            </button>
          </div>
        );
      };

      render(
        <MemoryRouter>
          <LanguageProvider>
            <AuthProvider>
              <TestLoginConsumer />
            </AuthProvider>
          </LanguageProvider>
        </MemoryRouter>
      );

      fireEvent.click(screen.getByTestId('trigger-login-btn'));

      await waitFor(() => {
        expect(document.cookie).toContain('bw_lang=bn');
        expect(document.documentElement.lang).toBe('bn');
        expect(screen.getByTestId('current-lang')).toHaveTextContent('bn');
      });

      // No server update needed because server already has 'bn'
      expect(updateLangSpy).not.toHaveBeenCalled();
    });

    it('keeps cookie and updates server when cookie exists and differs from server language', async () => {
      // Cookie is Bengali ('bn')
      document.cookie = 'bw_lang=bn; Path=/';
      expect(getLanguageCookie()).toBe('bn');

      // Server returns English ('en')
      vi.spyOn(userApi, 'getMe').mockResolvedValue(mockUserFixture('en') as any);
      const updateLangSpy = vi.spyOn(userApi, 'updateUserLanguage').mockResolvedValue({ success: true } as any);

      const TestLoginConsumer: React.FC = () => {
        const { login } = useAuth();
        const { language } = useTranslation();
        return (
          <div>
            <span data-testid="current-lang">{language}</span>
            <button
              data-testid="trigger-login-btn"
              onClick={() => login('mock-token', mockUserFixture('en').profile as any)}
            >
              Trigger Login
            </button>
          </div>
        );
      };

      render(
        <MemoryRouter>
          <LanguageProvider>
            <AuthProvider>
              <TestLoginConsumer />
            </AuthProvider>
          </LanguageProvider>
        </MemoryRouter>
      );

      fireEvent.click(screen.getByTestId('trigger-login-btn'));

      await waitFor(() => {
        // Cookie remains 'bn'
        expect(getLanguageCookie()).toBe('bn');
        // Server updated to match cookie
        expect(updateLangSpy).toHaveBeenCalledWith('bn');
      });
    });
  });

  describe('Instant Switching Without Page Reload', () => {
    it('switching language in Profile applies instantly and syncs to server', async () => {
      vi.spyOn(userApi, 'getMe').mockResolvedValue(mockUserFixture('en') as any);
      const updateLangSpy = vi.spyOn(userApi, 'updateUserLanguage').mockResolvedValue({ success: true } as any);

      render(
        <MemoryRouter>
          <LanguageProvider>
            <AuthProvider>
              <Profile />
            </AuthProvider>
          </LanguageProvider>
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByTestId('profile-language-section')).toBeInTheDocument();
      });

      const bnBtn = screen.getByTestId('profile-lang-bn');
      fireEvent.click(bnBtn);

      await waitFor(() => {
        expect(document.documentElement.lang).toBe('bn');
        expect(document.cookie).toContain('bw_lang=bn');
      });

      // Assert server received update
      expect(updateLangSpy).toHaveBeenCalledWith('bn');
    });

    it('switching language in Landing footer applies instantly without reload', async () => {
      render(
        <MemoryRouter>
          <LanguageProvider>
            <AuthProvider>
              <Landing />
            </AuthProvider>
          </LanguageProvider>
        </MemoryRouter>
      );

      const footer = screen.getByTestId('landing-footer');
      expect(footer).toBeInTheDocument();

      const bnBtn = screen.getByTestId('landing-lang-bn');
      fireEvent.click(bnBtn);

      await waitFor(() => {
        expect(document.documentElement.lang).toBe('bn');
        expect(document.cookie).toContain('bw_lang=bn');
      });

      const enBtn = screen.getByTestId('landing-lang-en');
      fireEvent.click(enBtn);

      await waitFor(() => {
        expect(document.documentElement.lang).toBe('en');
        expect(document.cookie).toContain('bw_lang=en');
      });
    });
  });
});
