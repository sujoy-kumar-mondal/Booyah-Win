import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import en from '../locales/en.json';
import { getLanguageCookie, setLanguageCookie } from './cookies.js';
import type { SupportedLanguage, TranslationKey, TranslationParams, LanguageContextValue } from './types.js';
import { updateUserLanguage } from '../api/user.js';
import { getStoredToken } from '../api/client.js';

let bnCache: Record<string, string> | null = null;

export async function loadBengaliTranslations(): Promise<Record<string, string>> {
  if (bnCache) return bnCache;
  const mod = await import('../locales/bn.json');
  bnCache = (mod.default || mod) as Record<string, string>;
  return bnCache;
}

const LanguageContext = createContext<LanguageContextValue | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const initialCookie = getLanguageCookie();
  const [language, setLanguageState] = useState<SupportedLanguage>(() => initialCookie || 'en');
  const [isFirstVisitModalOpen, setIsFirstVisitModalOpen] = useState<boolean>(() => !initialCookie);
  const [bnTranslations, setBnTranslations] = useState<Record<string, string> | null>(() => bnCache);
  const activeLangRef = useRef<SupportedLanguage>(language);
  activeLangRef.current = language;

  // Sync <html lang="..."> attribute
  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.lang = language;
    }
  }, [language]);

  // Precache Bengali translations if initially English, or load immediately if initially Bengali
  useEffect(() => {
    if (language === 'bn') {
      if (!bnTranslations) {
        loadBengaliTranslations().then((loaded) => {
          setBnTranslations(loaded);
        });
      }
    } else {
      // Precache in background when browser is idle or shortly after mount
      const timer = setTimeout(() => {
        loadBengaliTranslations().then((loaded) => {
          setBnTranslations(loaded);
        });
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [language, bnTranslations]);

  // Listen for external language changes (e.g. from login server sync)
  useEffect(() => {
    const handleLangChanged = (e: Event) => {
      const customEvent = e as CustomEvent<SupportedLanguage>;
      const newLang = customEvent.detail;
      if (newLang === 'en' || newLang === 'bn') {
        if (newLang === 'bn' && !bnTranslations) {
          loadBengaliTranslations().then((loaded) => {
            setBnTranslations(loaded);
          });
        }
        setLanguageState(newLang);
        activeLangRef.current = newLang;
        setIsFirstVisitModalOpen(false);
      }
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('bw_lang_changed', handleLangChanged);
      return () => window.removeEventListener('bw_lang_changed', handleLangChanged);
    }
  }, [bnTranslations]);

  const setLanguage = useCallback(
    async (newLang: SupportedLanguage, options?: { syncServer?: boolean }) => {
      // If switching to Bengali and not loaded yet, load it first to avoid flash of English
      if (newLang === 'bn' && !bnTranslations) {
        const loaded = await loadBengaliTranslations();
        setBnTranslations(loaded);
      }

      setLanguageCookie(newLang);
      setLanguageState(newLang);
      activeLangRef.current = newLang;
      if (typeof document !== 'undefined') {
        document.documentElement.lang = newLang;
      }

      // Close first visit modal if open
      setIsFirstVisitModalOpen(false);

      // Asynchronously sync with server if logged in and not explicitly skipped
      const token = getStoredToken();
      if (token && options?.syncServer !== false) {
        updateUserLanguage(newLang).catch(() => {
          // ignore network errors on language sync
        });
      }
    },
    [bnTranslations]
  );

  const closeFirstVisitModal = useCallback(() => {
    setIsFirstVisitModalOpen(false);
  }, []);

  const t = useCallback(
    (key: TranslationKey | string, params?: TranslationParams): string => {
      const isBn = activeLangRef.current === 'bn';
      let template: string | undefined;

      if (isBn && bnTranslations && key in bnTranslations) {
        template = bnTranslations[key];
      } else if (key in en) {
        template = (en as Record<string, string>)[key];
      }

      if (template === undefined) {
        return key;
      }

      if (params) {
        return template.replace(/\{(\w+)\}/g, (_, p) => {
          return params[p] !== undefined ? String(params[p]) : `{${p}}`;
        });
      }

      return template;
    },
    [bnTranslations]
  );

  const formatEnum = useCallback(
    (
      category: 'status' | 'gameMode' | 'teamMode' | 'walletStatus' | 'txnType' | 'position',
      value: string
    ): string => {
      if (!value) return '';
      const key = `enums.${category}.${value.toLowerCase()}`;
      const translated = t(key);
      // If no translation found, t(key) returns key. In that case, return raw value.
      return translated !== key ? translated : value;
    },
    [t]
  );

  return (
    <LanguageContext.Provider
      value={{
        language,
        isFirstVisitModalOpen,
        setLanguage,
        closeFirstVisitModal,
        t,
        formatEnum,
      }}
    >
      {children}
    </LanguageContext.Provider>
  );
};

export function useTranslation(): LanguageContextValue {
  const context = useContext(LanguageContext);
  if (!context) {
    return {
      language: 'en',
      isFirstVisitModalOpen: false,
      setLanguage: async () => {},
      closeFirstVisitModal: () => {},
      t: (key: TranslationKey, params?: TranslationParams) => {
        let text: string = (en as Record<string, string>)[key] || key;
        if (params) {
          for (const [paramKey, val] of Object.entries(params)) {
            text = text.replace(new RegExp(`\\{${paramKey}\\}`, 'g'), String(val));
          }
        }
        return text;
      },
      formatEnum: (category: string, value: string) => {
        const key = `enums.${category}.${value}` as TranslationKey;
        const translated = (en as Record<string, string>)[key];
        return translated || value;
      },
    };
  }
  return context;
}
