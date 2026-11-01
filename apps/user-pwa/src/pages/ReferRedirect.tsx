import React, { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';

export const ReferRedirect: React.FC = () => {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();

  useEffect(() => {
    const raw = (code || '').trim();
    const cleanCode = raw.replace(/^@/, '').toLowerCase();
    if (cleanCode && /^[a-z0-9_]{3,20}$/.test(cleanCode)) {
      navigate(`/register?ref=${encodeURIComponent(cleanCode)}`, { replace: true });
    } else {
      navigate('/register', { replace: true });
    }
  }, [code, navigate]);

  return (
    <div className="flex h-[60vh] items-center justify-center" data-testid="refer-redirect-loading">
      <div className="flex flex-col items-center gap-3 text-slate-400">
        <Loader2 className="h-6 w-6 animate-spin text-emerald-400" />
        <p className="text-xs font-semibold">Redirecting to create account...</p>
      </div>
    </div>
  );
};

