import React, { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { Check, Clipboard, ArrowRight, ShieldCheck } from 'lucide-react';
import { useTranslation } from '../i18n/LanguageContext.js';

export const CopyOtp: React.FC = () => {
  const [searchParams] = useSearchParams();
  const { language } = useTranslation();
  const rawCode = searchParams.get('code') || searchParams.get('otp') || '';
  const email = searchParams.get('email') || '';
  const code = rawCode.replace(/\D/g, '').slice(0, 6);

  const [copied, setCopied] = useState(false);

  const copyToClipboard = async () => {
    if (!code) return;
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(code);
        setCopied(true);
        return;
      }
    } catch {}

    try {
      const ta = document.createElement('textarea');
      ta.value = code;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      setCopied(true);
    } catch {}
  };

  useEffect(() => {
    if (code) {
      copyToClipboard();
    }
  }, [code]);

  const loginUrl = `/login?otp=${encodeURIComponent(code)}${email ? `&email=${encodeURIComponent(email)}` : ''}`;

  return (
    <div
      data-testid="copy-otp-page"
      className="flex flex-col justify-center py-6 sm:py-10 w-full max-w-md mx-auto px-4"
    >
      {/* Brand Header */}
      <div className="mb-6 text-center">
        <img
          src="/assets/logo_full.png"
          alt="Booyah Win - Tournament Platform"
          className="mx-auto h-20 w-auto object-contain drop-shadow-[0_4px_16px_rgba(244,162,45,0.18)]"
        />
        <h1 className="sr-only">Booyah Win</h1>
      </div>

      <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-5 sm:p-7 shadow-xl backdrop-blur-md text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
          <ShieldCheck className="h-6 w-6" />
        </div>

        <h2 className="text-xl font-black text-slate-100 tracking-tight">
          {language === 'bn' ? 'যাচাইকরণ কোড' : 'Verification Code'}
        </h2>
        <p className="text-xs text-slate-400 mt-1 mb-5">
          {language === 'bn'
            ? 'আপনার ৬-সংখ্যার OTP কোড নিচে দেওয়া হয়েছে'
            : 'Your 6-digit one-time verification code is ready'}
        </p>

        {code ? (
          <>
            {/* Code Box */}
            <div className="mb-4 rounded-xl border border-dashed border-emerald-500/40 bg-slate-950/80 py-4 px-6">
              <span className="font-mono text-3xl font-extrabold tracking-[8px] text-emerald-400 select-all">
                {code}
              </span>
            </div>

            {/* Status Message */}
            {copied ? (
              <div
                data-testid="copy-success-badge"
                className="mb-5 inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 px-3.5 py-1 text-xs font-semibold text-emerald-400"
              >
                <Check className="h-3.5 w-3.5" />
                <span>
                  {language === 'bn' ? 'কোড ক্লিপবোর্ডে কপি করা হয়েছে!' : 'Code copied to clipboard!'}
                </span>
              </div>
            ) : (
              <p className="text-xs text-slate-400 mb-5">
                {language === 'bn' ? 'কপি করতে নিচের বোতামে চাপুন' : 'Tap button below to copy code'}
              </p>
            )}

            {/* Action Buttons */}
            <div className="space-y-3">
              <button
                type="button"
                onClick={copyToClipboard}
                data-testid="copy-otp-action-btn"
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 py-3 text-sm font-bold text-slate-950 transition-all hover:bg-emerald-400 active:scale-[0.98]"
              >
                {copied ? <Check className="h-4 w-4" /> : <Clipboard className="h-4 w-4" />}
                {copied
                  ? language === 'bn' ? 'আবার কপি করুন' : 'Copy Again'
                  : language === 'bn' ? 'কোড কপি করুন' : 'Copy Code'}
              </button>

              <Link
                to={loginUrl}
                data-testid="copy-otp-continue-btn"
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-800/80 py-3 text-sm font-semibold text-slate-200 transition-all hover:bg-slate-700 hover:text-white"
              >
                <span>{language === 'bn' ? 'লগইন পেজে যান' : 'Continue to Login'}</span>
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </>
        ) : (
          <div className="text-sm text-slate-400 py-4">
            <p>{language === 'bn' ? 'কোনো যাচাইকরণ কোড পাওয়া যায়নি।' : 'No verification code found in link.'}</p>
            <Link to="/login" className="mt-3 inline-block font-semibold text-emerald-400 hover:underline">
              {language === 'bn' ? 'লগইন পেজে যান' : 'Go to Login'}
            </Link>
          </div>
        )}
      </div>
    </div>
  );
};

