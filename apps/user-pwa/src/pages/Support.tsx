import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Headphones, Phone, Mail, Clock, AlertCircle } from 'lucide-react';
import { fetchSupportInfo, type SupportInfo } from '../api/support.js';
import { useTranslation } from '../i18n/LanguageContext.js';

export const Support: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [support, setSupport] = useState<SupportInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadSupport() {
      setIsLoading(true);
      setError(null);
      try {
        const data = await fetchSupportInfo();
        setSupport(data);
      } catch (err: any) {
        setError(err?.message || t('support.loadError'));
      } finally {
        setIsLoading(false);
      }
    }
    loadSupport();
  }, []);

  const isConfigured = Boolean(
    support && (support.supportPhone.trim() || support.supportEmail.trim())
  );

  return (
    <div data-testid="support-page" className="space-y-4">
      <div className="flex items-center gap-3 pb-3 border-b border-slate-800">
        <button
          type="button"
          onClick={() => navigate(-1)}
          aria-label="Back"
          className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-800 bg-slate-900 text-slate-300 hover:bg-slate-800 hover:text-white transition active:scale-95"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div className="flex items-center gap-2">
          <Headphones className="h-5 w-5 text-emerald-400" />
          <h1 className="text-lg font-bold text-slate-100">{t('support.helpAndSupport')}</h1>
        </div>
      </div>

      {isLoading && (
        <div data-testid="support-loading" className="py-12 text-center text-xs text-slate-400">
          <p>{t('support.loading')}</p>
        </div>
      )}

      {error && (
        <div
          data-testid="support-error"
          className="rounded-xl border border-rose-500/20 bg-rose-500/10 p-4 text-xs text-rose-300 flex items-center gap-2"
        >
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {!isLoading && !error && support && (
        <>
          {isConfigured ? (
            <div data-testid="support-configured-state" className="space-y-3">
              <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-4 space-y-3 shadow-md">
                <h3 className="font-bold text-slate-100 text-sm">
                  {support.supportName === 'Support Team' ? t('support.team') : support.supportName}
                </h3>

                {support.supportPhone && (
                  <div className="flex items-center gap-3 text-xs">
                    <Phone className="h-4 w-4 text-emerald-400 shrink-0" />
                    <div>
                      <span className="text-slate-400 block text-[10px]">{t('support.phoneSupport')}</span>
                      <a
                        href={`tel:${support.supportPhone}`}
                        data-testid="support-phone-link"
                        className="font-medium text-slate-200 hover:text-emerald-400"
                      >
                        {support.supportPhone}
                      </a>
                    </div>
                  </div>
                )}

                {support.supportEmail && (
                  <div className="flex items-center gap-3 text-xs">
                    <Mail className="h-4 w-4 text-emerald-400 shrink-0" />
                    <div>
                      <span className="text-slate-400 block text-[10px]">{t('support.emailSupport')}</span>
                      <a
                        href={`mailto:${support.supportEmail}`}
                        data-testid="support-email-link"
                        className="font-medium text-slate-200 hover:text-emerald-400"
                      >
                        {support.supportEmail}
                      </a>
                    </div>
                  </div>
                )}

                {support.supportHours && (
                  <div className="flex items-center gap-3 text-xs">
                    <Clock className="h-4 w-4 text-emerald-400 shrink-0" />
                    <div>
                      <span className="text-slate-400 block text-[10px]">{t('support.operatingHours')}</span>
                      <span data-testid="support-hours-text" className="font-medium text-slate-200">
                        {support.supportHours}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div
              data-testid="support-not-configured-state"
              className="rounded-2xl border border-slate-800 bg-slate-900/40 p-8 text-center text-xs text-slate-400 space-y-2"
            >
              <Headphones className="mx-auto h-8 w-8 text-slate-600" />
              <h4 className="text-sm font-bold text-slate-300">{t('support.notConfiguredTitle')}</h4>
              <p>{t('support.notConfiguredDesc')}</p>
            </div>
          )}
        </>
      )}
    </div>
  );
};
