import '@testing-library/jest-dom';
import { beforeEach, vi } from 'vitest';

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  vi.clearAllMocks();

  document.body.innerHTML = '<div id="root"></div><div id="modal-root"></div>';
});

// Ensure navigator.onLine is true in jsdom
Object.defineProperty(navigator, 'onLine', {
  value: true,
  writable: true,
  configurable: true,
});

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock URL.createObjectURL and URL.revokeObjectURL
if (!URL.createObjectURL) {
  URL.createObjectURL = vi.fn(() => 'blob:mock-object-url');
}
if (!URL.revokeObjectURL) {
  URL.revokeObjectURL = vi.fn();
}
