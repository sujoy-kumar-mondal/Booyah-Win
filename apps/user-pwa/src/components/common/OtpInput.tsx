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
    // Focus first input on mount or when value is cleared (e.g. on resend)
    if (!disabled && (value === '' || digits.every((d) => d === '')) && inputRefs.current[0]) {
      inputRefs.current[0].focus();
    }
  }, [value, disabled]);

  const handleChange = (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    const clean = raw.replace(/\D/g, '');

    // Multi-digit entry (e.g. mobile clipboard paste, keyboard chip, or SMS autofill)
    if (clean.length > 1) {
      if (clean.length >= 6) {
        onChange(clean.slice(0, 6));
        inputRefs.current[5]?.focus();
        return;
      }

      // If typing 1 char over an existing digit (e.g. "3" -> "34" or "43")
      if (clean.length === 2 && digits[index]) {
        const newChar = raw.endsWith(digits[index]) ? raw[0] : raw.slice(-1);
        if (/^\d$/.test(newChar)) {
          const newDigits = [...digits];
          newDigits[index] = newChar;
          onChange(newDigits.join('').slice(0, 6));
          if (index < 5) {
            inputRefs.current[index + 1]?.focus();
          }
        }
        return;
      }

      // Pasting fewer than 6 digits
      const newDigits = [...digits];
      let cur = index;
      for (const char of clean) {
        if (cur < 6) {
          newDigits[cur] = char;
          cur++;
        }
      }
      onChange(newDigits.join('').slice(0, 6));
      const targetIndex = Math.min(cur, 5);
      inputRefs.current[targetIndex]?.focus();
      return;
    }

    // Single digit entry or clearing
    const char = clean;
    const newDigits = [...digits];
    newDigits[index] = char;
    onChange(newDigits.join('').slice(0, 6));

    if (char && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      if (!digits[index] && index > 0) {
        const newDigits = [...digits];
        newDigits[index - 1] = '';
        onChange(newDigits.join(''));
        inputRefs.current[index - 1]?.focus();
      }
    } else if (e.key === 'ArrowLeft' && index > 0) {
      inputRefs.current[index - 1]?.focus();
    } else if (e.key === 'ArrowRight' && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement | HTMLDivElement>) => {
    e.preventDefault();
    const pasted = e.clipboardData?.getData('text') || '';
    const cleanDigits = pasted.replace(/\D/g, '').slice(0, 6);
    if (cleanDigits) {
      onChange(cleanDigits);
      const targetIndex = Math.min(cleanDigits.length, 5);
      inputRefs.current[targetIndex]?.focus();
    }
  };

  return (
    <div
      className="flex items-center justify-between gap-1.5 sm:gap-2 w-full max-w-sm mx-auto"
      data-testid="otp-input-container"
      onPaste={handlePaste}
    >
      {digits.map((digit, i) => (
        <input
          key={i}
          ref={(el) => (inputRefs.current[i] = el)}
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          autoComplete={i === 0 ? 'one-time-code' : 'off'}
          maxLength={6}
          value={digit}
          disabled={disabled}
          onFocus={(e) => e.target.select()}
          onChange={(e) => handleChange(i, e)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          onPaste={handlePaste}
          aria-label={`Digit ${i + 1} of verification code`}
          className="flex-1 min-w-0 max-w-[48px] h-12 sm:h-14 rounded-xl border border-slate-700 bg-slate-900 text-center font-mono text-xl sm:text-2xl font-bold text-slate-100 transition-all focus:border-emerald-500 focus:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-50"
        />
      ))}
    </div>
  );
};
