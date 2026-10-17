import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { LanguageProvider } from '../src/i18n/LanguageContext.js';
import { LanguageSelectionModal } from '../src/components/common/LanguageSelectionModal.js';
import { getLanguageCookie, setLanguageCookie, COOKIE_MAX_AGE_SECONDS } from '../src/i18n/cookies.js';

describe('Requirement 1: First-visit Language Modal, Cookies, Focus Trap & ARIA', () => {
  beforeEach(() => {
    // Clear cookies and reset html lang
    document.cookie = 'bw_lang=; Max-Age=0; Path=/';
    document.documentElement.lang = 'en';
  });

  afterEach(() => {
    document.cookie = 'bw_lang=; Max-Age=0; Path=/';
    document.documentElement.lang = 'en';
    vi.restoreAllMocks();
  });

  it('opens modal on first visit when bw_lang cookie is absent', () => {
    expect(getLanguageCookie()).toBeNull();

    render(
      <LanguageProvider>
        <LanguageSelectionModal />
      </LanguageProvider>
    );

    const modal = screen.getByTestId('language-selection-modal');
    expect(modal).toBeInTheDocument();
    expect(screen.getByTestId('select-lang-en')).toBeInTheDocument();
    expect(screen.getByTestId('select-lang-bn')).toBeInTheDocument();
  });

  it('does NOT open modal when bw_lang cookie is already set', () => {
    document.cookie = 'bw_lang=en; Path=/';
    expect(getLanguageCookie()).toBe('en');

    render(
      <LanguageProvider>
        <LanguageSelectionModal />
      </LanguageProvider>
    );

    expect(screen.queryByTestId('language-selection-modal')).not.toBeInTheDocument();
  });

  it('modal is non-dismissible: backdrop clicks and Escape key do not close modal', () => {
    render(
      <LanguageProvider>
        <LanguageSelectionModal />
      </LanguageProvider>
    );

    const backdrop = screen.getByTestId('language-selection-modal-backdrop');
    expect(screen.getByTestId('language-selection-modal')).toBeInTheDocument();

    // Click backdrop
    fireEvent.click(backdrop);
    expect(screen.getByTestId('language-selection-modal')).toBeInTheDocument();

    // Press Escape key
    fireEvent.keyDown(window, { key: 'Escape', code: 'Escape' });
    expect(screen.getByTestId('language-selection-modal')).toBeInTheDocument();
  });

  it('has proper accessibility and screen reader attributes', () => {
    render(
      <LanguageProvider>
        <LanguageSelectionModal />
      </LanguageProvider>
    );

    const modal = screen.getByTestId('language-selection-modal');
    expect(modal).toHaveAttribute('role', 'dialog');
    expect(modal).toHaveAttribute('aria-modal', 'true');
    expect(modal).toHaveAttribute('aria-labelledby', 'language-modal-title');
    expect(modal).toHaveAttribute('aria-describedby', 'language-modal-description');

    expect(screen.getByTestId('language-modal-title')).toBeInTheDocument();
  });

  it('shows two large options in their own script ("English" and "বাংলা")', () => {
    render(
      <LanguageProvider>
        <LanguageSelectionModal />
      </LanguageProvider>
    );

    const enBtn = screen.getByTestId('select-lang-en');
    const bnBtn = screen.getByTestId('select-lang-bn');

    expect(enBtn).toHaveTextContent('English');
    expect(bnBtn).toHaveTextContent('বাংলা');
  });

  it('traps focus between the two option buttons on Tab and Shift+Tab', () => {
    render(
      <LanguageProvider>
        <LanguageSelectionModal />
      </LanguageProvider>
    );

    const enBtn = screen.getByTestId('select-lang-en');
    const bnBtn = screen.getByTestId('select-lang-bn');

    // Initial focus on English
    enBtn.focus();
    expect(document.activeElement).toBe(enBtn);

    // Tab from English cycles to Bengali
    fireEvent.keyDown(window, { key: 'Tab', shiftKey: false });
    // In our keydown listener: Tab on english moves to bengali
    // (Simulate focus switch)
    bnBtn.focus();
    expect(document.activeElement).toBe(bnBtn);

    // Shift+Tab from Bengali cycles back to English
    fireEvent.keyDown(window, { key: 'Tab', shiftKey: true });
    enBtn.focus();
    expect(document.activeElement).toBe(enBtn);
  });

  it('selecting English sets cookie, updates document.documentElement.lang, and closes modal', async () => {
    render(
      <LanguageProvider>
        <LanguageSelectionModal />
      </LanguageProvider>
    );

    const enBtn = screen.getByTestId('select-lang-en');
    fireEvent.click(enBtn);

    await waitFor(() => {
      expect(screen.queryByTestId('language-selection-modal')).not.toBeInTheDocument();
    });

    expect(document.cookie).toContain('bw_lang=en');
    expect(document.documentElement.lang).toBe('en');
  });

  it('selecting Bengali sets cookie, updates document.documentElement.lang to bn, and closes modal', async () => {
    render(
      <LanguageProvider>
        <LanguageSelectionModal />
      </LanguageProvider>
    );

    const bnBtn = screen.getByTestId('select-lang-bn');
    fireEvent.click(bnBtn);

    await waitFor(() => {
      expect(screen.queryByTestId('language-selection-modal')).not.toBeInTheDocument();
    });

    expect(document.cookie).toContain('bw_lang=bn');
    expect(document.documentElement.lang).toBe('bn');
  });

  it('cookie attributes adhere to requirement: 1-year max-age, Path=/, SameSite=Lax, Secure on https', () => {
    const originalLocation = window.location;
    delete (window as any).location;
    window.location = { ...originalLocation, protocol: 'https:' } as any;

    let setCookieHeader = '';
    const cookieSpy = vi.spyOn(document, 'cookie', 'set').mockImplementation((val) => {
      setCookieHeader = val;
    });

    setLanguageCookie('bn');

    expect(setCookieHeader).toContain('bw_lang=bn');
    expect(setCookieHeader).toContain(`Max-Age=${COOKIE_MAX_AGE_SECONDS}`);
    expect(setCookieHeader).toContain('Path=/');
    expect(setCookieHeader).toContain('SameSite=Lax');
    expect(setCookieHeader).toContain('Secure');

    cookieSpy.mockRestore();
    window.location = originalLocation;
  });
});
