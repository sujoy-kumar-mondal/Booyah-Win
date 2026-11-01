import { useState, useEffect, useCallback, useRef } from 'react';

export function useCountdown(initialSeconds = 60) {
  const [secondsLeft, setSecondsLeft] = useState(0);
  const timerRef = useRef<any>(null);

  const startCountdown = useCallback(
    (seconds = initialSeconds) => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      setSecondsLeft(seconds);
      timerRef.current = setInterval(() => {
        setSecondsLeft((prev) => {
          if (prev <= 1) {
            clearInterval(timerRef.current);
            timerRef.current = null;
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    },
    [initialSeconds]
  );

  const resetCountdown = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setSecondsLeft(0);
  }, []);

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, []);

  return {
    secondsLeft,
    isCounting: secondsLeft > 0,
    startCountdown,
    resetCountdown,
  };
}
