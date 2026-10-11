import React, { useRef, useEffect } from 'react';

interface OtpInputProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

export const OtpInput: React.FC<OtpInputProps> = ({ value, onChange, disabled = false }) => {
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const digits = value.split('').slice(0, 6);
  while (digits.length < 6) {
    digits.push('');
  }

  useEffect(() => {
    // Focus first empty input on mount if not disabled
    if (!disabled && inputRefs.current[0]) {
      inputRefs.current[0].focus();
    }
  }, [disabled]);

  const handleChange = (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const char = e.target.value.slice(-1);
    if (!/^\d*$/.test(char)) return;

    const newDigits = [...digits];
    newDigits[index] = char;
    const combined = newDigits.join('').slice(0, 6);
    onChange(combined);

    if (char && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      if (!digits[index] && index > 0) {
        inputRefs.current[index - 1]?.focus();
      }
    } else if (e.key === 'ArrowLeft' && index > 0) {
      inputRefs.current[index - 1]?.focus();
    } else if (e.key === 'ArrowRight' && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').trim();
    const cleanDigits = pasted.replace(/\D/g, '').slice(0, 6);
    if (cleanDigits) {
      onChange(cleanDigits);
      const targetIndex = Math.min(cleanDigits.length, 5);
      inputRefs.current[targetIndex]?.focus();
    }
  };

  return (
    <div className="flex items-center justify-between gap-2" data-testid="otp-input-container">
      {digits.map((digit, i) => (
        <input
          key={i}
          ref={(el) => (inputRefs.current[i] = el)}
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          autoComplete="one-time-code"
          maxLength={1}
          value={digit}
          disabled={disabled}
          onChange={(e) => handleChange(i, e)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          onPaste={handlePaste}
          aria-label={`Digit ${i + 1} of verification code`}
          className="h-14 w-12 rounded-xl border border-slate-700 bg-slate-900 text-center font-mono text-2xl font-bold text-slate-100 transition-all focus:border-emerald-500 focus:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-50"
        />
      ))}
    </div>
  );
};
