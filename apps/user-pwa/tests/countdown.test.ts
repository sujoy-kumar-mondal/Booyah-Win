import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useCountdown } from '../src/hooks/useCountdown.js';

describe('useCountdown Hook (60s OTP Cooldown)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('initializes with 0 seconds left and isCounting false', () => {
    const { result } = renderHook(() => useCountdown(60));
    expect(result.current.secondsLeft).toBe(0);
    expect(result.current.isCounting).toBe(false);
  });

  it('counts down from 60 to 0 and stops', () => {
    const { result } = renderHook(() => useCountdown(60));

    act(() => {
      result.current.startCountdown(60);
    });

    expect(result.current.secondsLeft).toBe(60);
    expect(result.current.isCounting).toBe(true);

    // Advance 30 seconds
    act(() => {
      vi.advanceTimersByTime(30000);
    });
    expect(result.current.secondsLeft).toBe(30);
    expect(result.current.isCounting).toBe(true);

    // Advance remaining 30 seconds
    act(() => {
      vi.advanceTimersByTime(30000);
    });
    expect(result.current.secondsLeft).toBe(0);
    expect(result.current.isCounting).toBe(false);
  });

  it('resetCountdown resets countdown to 0 immediately', () => {
    const { result } = renderHook(() => useCountdown(60));

    act(() => {
      result.current.startCountdown(60);
    });
    expect(result.current.secondsLeft).toBe(60);

    act(() => {
      result.current.resetCountdown();
    });
    expect(result.current.secondsLeft).toBe(0);
    expect(result.current.isCounting).toBe(false);
  });
});
