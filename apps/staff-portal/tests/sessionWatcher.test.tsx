import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useStaffSessionWatcher } from '../src/hooks/useStaffSessionWatcher';
import { SessionReplacedModal } from '../src/components/common/SessionReplacedModal';
import { STAFF_TOKEN_STORAGE_KEY, ApiError } from '../src/api/client';
import { ErrorCodes } from '@booyah/shared';
import * as staffApi from '../src/api/staff';
import { staffMeGuard } from '../src/api/guards';
import { loadContractFixture } from './contractFixtures';

const WatcherComponent: React.FC<{
  token: string | null;
  onReplaced: () => void;
  onUnauth: () => void;
}> = ({ token, onReplaced, onUnauth }) => {
  useStaffSessionWatcher({
    token,
    onSessionReplaced: onReplaced,
    onUnauthenticated: onUnauth,
  });
  return <div>Watcher Active</div>;
};

describe('Staff Session Watcher & SessionReplacedModal', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
    vi.clearAllMocks();

    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: 0 } },
    });
  });

  describe('useStaffSessionWatcher Lifecycle & Responses', () => {
    it('triggers onSessionReplaced and clears token on SESSION_REPLACED error', async () => {
      sessionStorage.setItem(STAFF_TOKEN_STORAGE_KEY, 'test-token');

      vi.spyOn(staffApi, 'getStaffMe').mockRejectedValue(
        new ApiError(401, ErrorCodes.SESSION_REPLACED, 'Your session was replaced on another device')
      );

      const onReplaced = vi.fn();
      const onUnauth = vi.fn();

      render(
        <QueryClientProvider client={queryClient}>
          <WatcherComponent token="test-token" onReplaced={onReplaced} onUnauth={onUnauth} />
        </QueryClientProvider>
      );

      // Trigger online event to immediately trigger check
      await act(async () => {
        window.dispatchEvent(new Event('online'));
      });

      await waitFor(() => {
        expect(onReplaced).toHaveBeenCalledTimes(1);
      });
      expect(onUnauth).not.toHaveBeenCalled();
      expect(sessionStorage.getItem(STAFF_TOKEN_STORAGE_KEY)).toBeNull();
    });

    it('triggers onUnauthenticated and clears token on UNAUTHENTICATED error', async () => {
      sessionStorage.setItem(STAFF_TOKEN_STORAGE_KEY, 'test-token');

      vi.spyOn(staffApi, 'getStaffMe').mockRejectedValue(
        new ApiError(401, ErrorCodes.UNAUTHENTICATED, 'Authentication required')
      );

      const onReplaced = vi.fn();
      const onUnauth = vi.fn();

      render(
        <QueryClientProvider client={queryClient}>
          <WatcherComponent token="test-token" onReplaced={onReplaced} onUnauth={onUnauth} />
        </QueryClientProvider>
      );

      await act(async () => {
        window.dispatchEvent(new Event('online'));
      });

      await waitFor(() => {
        expect(onUnauth).toHaveBeenCalledTimes(1);
      });
      expect(onReplaced).not.toHaveBeenCalled();
      expect(sessionStorage.getItem(STAFF_TOKEN_STORAGE_KEY)).toBeNull();
    });

    it('ignores RATE_LIMITED and transient errors silently, keeping token intact', async () => {
      sessionStorage.setItem(STAFF_TOKEN_STORAGE_KEY, 'test-token');

      vi.spyOn(staffApi, 'getStaffMe').mockRejectedValue(
        new ApiError(429, ErrorCodes.RATE_LIMITED, 'Too many requests')
      );

      const onReplaced = vi.fn();
      const onUnauth = vi.fn();

      render(
        <QueryClientProvider client={queryClient}>
          <WatcherComponent token="test-token" onReplaced={onReplaced} onUnauth={onUnauth} />
        </QueryClientProvider>
      );

      await act(async () => {
        window.dispatchEvent(new Event('online'));
      });

      await waitFor(() => {
        expect(staffApi.getStaffMe).toHaveBeenCalled();
      });

      expect(onReplaced).not.toHaveBeenCalled();
      expect(onUnauth).not.toHaveBeenCalled();
      expect(sessionStorage.getItem(STAFF_TOKEN_STORAGE_KEY)).toBe('test-token');
    });

    it('Requirement 5: stays silent and never logs the staff user out on NETWORK_ERROR', async () => {
      sessionStorage.setItem(STAFF_TOKEN_STORAGE_KEY, 'test-token');

      const onReplaced = vi.fn();
      const onUnauth = vi.fn();

      vi.spyOn(staffApi, 'getStaffMe').mockRejectedValueOnce(
        new ApiError('NETWORK_ERROR', 'Cannot reach the server. Check that the API is running.', {}, 0)
      );

      render(
        <QueryClientProvider client={queryClient}>
          <WatcherComponent token="test-token" onReplaced={onReplaced} onUnauth={onUnauth} />
        </QueryClientProvider>
      );

      await act(async () => {
        window.dispatchEvent(new Event('online'));
      });

      await waitFor(() => {
        expect(staffApi.getStaffMe).toHaveBeenCalled();
      });

      expect(onReplaced).not.toHaveBeenCalled();
      expect(onUnauth).not.toHaveBeenCalled();
      expect(sessionStorage.getItem(STAFF_TOKEN_STORAGE_KEY)).toBe('test-token');
    });

    it('Requirement 5: stays silent and never logs the staff user out on NON_JSON_RESPONSE', async () => {
      sessionStorage.setItem(STAFF_TOKEN_STORAGE_KEY, 'test-token');

      const onReplaced = vi.fn();
      const onUnauth = vi.fn();

      vi.spyOn(staffApi, 'getStaffMe').mockRejectedValueOnce(
        new ApiError('NON_JSON_RESPONSE', 'The server sent an unexpected response.', {}, 200)
      );

      render(
        <QueryClientProvider client={queryClient}>
          <WatcherComponent token="test-token" onReplaced={onReplaced} onUnauth={onUnauth} />
        </QueryClientProvider>
      );

      await act(async () => {
        window.dispatchEvent(new Event('online'));
      });

      await waitFor(() => {
        expect(staffApi.getStaffMe).toHaveBeenCalled();
      });

      expect(onReplaced).not.toHaveBeenCalled();
      expect(onUnauth).not.toHaveBeenCalled();
      expect(sessionStorage.getItem(STAFF_TOKEN_STORAGE_KEY)).toBe('test-token');
    });

    it('in production mode, guard failure on /staff/me produces unexpected response error and does NOT log out the user', async () => {
      sessionStorage.setItem(STAFF_TOKEN_STORAGE_KEY, 'test-token');

      const onReplaced = vi.fn();
      const onUnauth = vi.fn();

      vi.spyOn(staffApi, 'getStaffMe').mockRejectedValueOnce(
        new ApiError('UNEXPECTED_RESPONSE', 'unexpected response, please refresh', {}, 500)
      );

      render(
        <QueryClientProvider client={queryClient}>
          <WatcherComponent token="test-token" onReplaced={onReplaced} onUnauth={onUnauth} />
        </QueryClientProvider>
      );

      await act(async () => {
        window.dispatchEvent(new Event('online'));
      });

      await waitFor(() => {
        expect(staffApi.getStaffMe).toHaveBeenCalled();
      });

      expect(onReplaced).not.toHaveBeenCalled();
      expect(onUnauth).not.toHaveBeenCalled();
      expect(sessionStorage.getItem(STAFF_TOKEN_STORAGE_KEY)).toBe('test-token');
    });

    it('skips check if document is hidden', async () => {
      sessionStorage.setItem(STAFF_TOKEN_STORAGE_KEY, 'test-token');

      const spy = vi.spyOn(staffApi, 'getStaffMe').mockResolvedValue(
        loadContractFixture('GET_staff_me.json', staffMeGuard, 'GET /staff/me')
      );

      // Mock document.visibilityState
      Object.defineProperty(document, 'visibilityState', {
        value: 'hidden',
        configurable: true,
      });

      render(
        <QueryClientProvider client={queryClient}>
          <WatcherComponent token="test-token" onReplaced={vi.fn()} onUnauth={vi.fn()} />
        </QueryClientProvider>
      );

      await act(async () => {
        document.dispatchEvent(new Event('visibilitychange'));
      });

      expect(spy).not.toHaveBeenCalled();

      // Reset visibilityState
      Object.defineProperty(document, 'visibilityState', {
        value: 'visible',
        configurable: true,
      });
    });
  });

  describe('SessionReplacedModal Portal & Inert Behavior', () => {
    it('renders inside modal-root, applies inert to #root, and restores when closed', async () => {
      const rootDiv = document.getElementById('root')!;
      const onDismiss = vi.fn();

      expect(rootDiv.hasAttribute('inert')).toBe(false);

      const { rerender } = render(
        <SessionReplacedModal isOpen={true} onDismiss={onDismiss} />
      );

      const modalContainer = screen.getByTestId('session-dialog-container');
      expect(modalContainer).toBeInTheDocument();
      // Should be mounted in modal-root
      expect(document.getElementById('modal-root')?.contains(modalContainer)).toBe(true);

      // Root element must have inert attribute applied
      expect(rootDiv.hasAttribute('inert')).toBe(true);

      // Close modal
      rerender(<SessionReplacedModal isOpen={false} onDismiss={onDismiss} />);
      expect(screen.queryByTestId('session-dialog-container')).not.toBeInTheDocument();
      expect(rootDiv.hasAttribute('inert')).toBe(false);
    });
  });
});
