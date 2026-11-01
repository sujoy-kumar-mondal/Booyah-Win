import { Capacitor } from '@capacitor/core';

export interface SharePayload {
  title: string;
  text: string;
  url: string;
  fullMessage: string;
}

export const BOOYAH_DOMAIN = 'https://booyah-win.vercel.app';

export const DEFAULT_INVITATION_TEXT = `Hey, Download Booyah Win - Play Free Fire Tournaments & Win Money\nJoin tournaments, show your skills and win real cash prizes!`;

export function getAppOrigin(): string {
  if (typeof window !== 'undefined' && window.location?.origin) {
    // Inside native Android WebView, window.location.origin is http://localhost (local assets).
    // Shared referral links must use the public domain so recipients can open them.
    if (Capacitor.isNativePlatform()) {
      const configured = typeof import.meta !== 'undefined' && ((import.meta.env as any)?.VITE_SITE_URL || (import.meta.env as any)?.VITE_APP_URL);
      return (configured || BOOYAH_DOMAIN).replace(/\/+$/, '');
    }
    return window.location.origin.replace(/\/+$/, '');
  }
  return BOOYAH_DOMAIN;
}

export function buildReferralSharePayload(referralCode: string, origin?: string, customInviteText?: string): SharePayload {
  const baseOrigin = (origin || getAppOrigin()).replace(/\/+$/, '');
  const url = `${baseOrigin}/refer/${encodeURIComponent(referralCode)}`;

  const header = (customInviteText && customInviteText.trim()) || DEFAULT_INVITATION_TEXT;
  const title = 'Join Booyah Win - Play Free Fire Tournaments & Win Money';
  const text = `${header.trim()}\nUse my referral code: ${referralCode} and make your booyah into money.\nDownload Link: ${url}`;

  return {
    title,
    text,
    url,
    fullMessage: text,
  };
}

export function getWhatsAppShareUrl(payload: SharePayload): string {
  return `https://wa.me/?text=${encodeURIComponent(payload.fullMessage)}`;
}

export function getTelegramShareUrl(payload: SharePayload): string {
  const shortText = `Hey, Download Booyah Win! Use referral code: ${payload.url.split('/').pop()} for a joining bonus.`;
  return `https://t.me/share/url?url=${encodeURIComponent(payload.url)}&text=${encodeURIComponent(shortText)}`;
}

export function getFacebookShareUrl(payload: SharePayload): string {
  return `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(payload.url)}`;
}

export function getTwitterShareUrl(payload: SharePayload): string {
  const tweetText = `Play Free Fire Tournaments & Win Real Money on Booyah Win! Use code: ${payload.url.split('/').pop()} for a cash bonus:`;
  return `https://twitter.com/intent/tweet?text=${encodeURIComponent(tweetText)}&url=${encodeURIComponent(payload.url)}`;
}
