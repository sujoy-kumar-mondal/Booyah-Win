export interface SharePayload {
  title: string;
  text: string;
  url: string;
  fullMessage: string;
}

export function getAppOrigin(): string {
  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin;
  }
  return 'https://booyah-win.vercel.app';
}

export function buildReferralSharePayload(referralCode: string, origin?: string): SharePayload {
  const baseOrigin = (origin || getAppOrigin()).replace(/\/+$/, '');
  const url = `${baseOrigin}/refer/${encodeURIComponent(referralCode)}`;

  const title = 'Join Booyah Win - Play Free Fire Tournaments & Win Money';
  const text = `Hey, Download Booyah Win - Play Free Fire Tournaments & Win Money\nJoin tournaments, show your skills and win real cash prizes!\nUse my referral code: ${referralCode} and get a joining bonus.\nDownload Link: ${url}`;

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
