import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useTranslation } from '../i18n/LanguageContext.js';
import { DepositForm } from '../components/wallet/DepositForm.js';
import { useAuth } from '../context/AuthContext.js';

export const AddMoney: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { refreshProfile } = useAuth();

  return (
    <div className="space-y-4" data-testid="wallet-add-money-page">
      {/* Top Header */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => navigate('/wallet')}
          aria-label="Back to Wallet"
          data-testid="add-money-back-btn"
          className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-800/80 border border-slate-700/60 text-slate-300 hover:text-white hover:bg-slate-700 transition-all active:scale-95"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <h1 className="text-xl font-bold text-slate-100 tracking-tight">
          {t('wallet.tabDeposit') || 'Add Money'}
        </h1>
      </div>

      {/* Deposit Form matching Images 4 & 5 */}
      <DepositForm
        onSuccess={() => {
          refreshProfile();
        }}
        onViewDeposits={() => navigate('/wallet/history')}
      />
    </div>
  );
};

