import React, { useState } from 'react';
import { Share2 } from 'lucide-react';
import { buildReferralSharePayload } from '../../utils/share.js';
import { ShareModal } from './ShareModal.js';
import { Toast } from './Toast.js';

interface ShareButtonProps {
  referralCode: string;
  className?: string;
  buttonText?: string;
}

export const ShareButton: React.FC<ShareButtonProps> = ({
  referralCode,
  className,
  buttonText = 'Share & Earn',
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const payload = buildReferralSharePayload(referralCode);

  const handleShare = async () => {
    if (!referralCode) return;

    // Check if Web Share API is available (primarily mobile devices)
    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      try {
        await navigator.share({
          title: payload.title,
          text: payload.text,
          url: payload.url,
        });
        setToastMessage('Shared successfully!');
      } catch (err: any) {
        // User cancelling the share sheet throws an AbortError - ignore it
        if (err?.name === 'AbortError') {
          return;
        }
        // If navigator.share fails for any other reason, open the fallback modal
        setIsModalOpen(true);
      }
    } else {
      // Fallback for desktop browsers
      setIsModalOpen(true);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={handleShare}
        disabled={!referralCode}
        data-testid="share-and-earn-btn"
        className={
          className ||
          'w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 py-3.5 text-xs font-black text-slate-950 transition active:scale-[0.98] shadow-lg shadow-emerald-500/25 disabled:opacity-50'
        }
      >
        <Share2 className="h-4 w-4 stroke-[2.5]" />
        <span>{buttonText}</span>
      </button>

      <ShareModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        payload={payload}
        referralCode={referralCode}
        onNotify={(msg) => setToastMessage(msg)}
      />

      {toastMessage && (
        <Toast message={toastMessage} onClose={() => setToastMessage(null)} />
      )}
    </>
  );
};
