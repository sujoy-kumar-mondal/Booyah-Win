import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { copyToClipboard } from '../src/utils/formatters.js';

describe('Phase 5 Proof: Clipboard Fallback to execCommand when navigator.clipboard is Unavailable', () => {
  const originalClipboard = navigator.clipboard;
  const originalExecCommand = (document as any).execCommand;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    Object.defineProperty(navigator, 'clipboard', {
      value: originalClipboard,
      writable: true,
      configurable: true,
    });
    if (originalExecCommand !== undefined) {
      document.execCommand = originalExecCommand;
    } else {
      delete (document as any).execCommand;
    }
  });

  it('uses modern navigator.clipboard.writeText when available', async () => {
    const writeTextMock = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: writeTextMock },
      writable: true,
      configurable: true,
    });

    const success = await copyToClipboard('Test Text 123');
    expect(success).toBe(true);
    expect(writeTextMock).toHaveBeenCalledWith('Test Text 123');
  });

  it('falls back to textarea and document.execCommand when navigator.clipboard throws', async () => {
    Object.defineProperty(navigator, 'clipboard', {
      value: {
        writeText: vi.fn().mockRejectedValue(new Error('Permission denied')),
      },
      writable: true,
      configurable: true,
    });

    const execCommandMock = vi.fn().mockReturnValue(true);
    document.execCommand = execCommandMock;

    const success = await copyToClipboard('Fallback Text 456');
    expect(success).toBe(true);
    expect(execCommandMock).toHaveBeenCalledWith('copy');
  });

  it('falls back to execCommand when navigator.clipboard is undefined', async () => {
    Object.defineProperty(navigator, 'clipboard', {
      value: undefined,
      writable: true,
      configurable: true,
    });

    const execCommandMock = vi.fn().mockReturnValue(true);
    document.execCommand = execCommandMock;

    const success = await copyToClipboard('Fallback Text 789');
    expect(success).toBe(true);
    expect(execCommandMock).toHaveBeenCalledWith('copy');
  });
});
