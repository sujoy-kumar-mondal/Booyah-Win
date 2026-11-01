import en from '../locales/en.json';

export type SupportedLanguage = 'en' | 'bn';
export type TranslationKey = keyof typeof en;
export type TranslationParams = Record<string, string | number>;

export interface LanguageContextValue {
  language: SupportedLanguage;
  isFirstVisitModalOpen: boolean;
  setLanguage: (lang: SupportedLanguage, options?: { syncServer?: boolean }) => Promise<void>;
  closeFirstVisitModal: () => void;
  t: (key: TranslationKey | string, params?: TranslationParams) => string;
  formatEnum: (category: 'status' | 'gameMode' | 'teamMode' | 'walletStatus' | 'txnType' | 'position', value: string) => string;
}
